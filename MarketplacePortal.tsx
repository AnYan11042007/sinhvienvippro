/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, update, push, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { ShoppingBag, Award, Tag, Gift, CheckCircle2, AlertCircle, Sparkles, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MarketplacePortalProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface ShopItem {
  id: string;
  name: string;
  type: 'frame' | 'title';
  price: number;
  value: string; // Avatar URL ring, or title string
  desc: string;
}

const SHOP_ITEMS: ShopItem[] = [
  // Frames
  { id: 'frame_gold', name: 'Khung Hoàng Gia Gold', type: 'frame', price: 15000, value: 'gold-ring', desc: 'Khung Avatar mạ vàng ròng 24K óng ánh sang trọng bậc nhất.' },
  { id: 'frame_neon', name: 'Khung Cầu Vồng Neon', type: 'frame', price: 25000, value: 'neon-ring', desc: 'Khung Neon nhấp nháy đa sắc chuyển động chuẩn 120 FPS.' },
  { id: 'frame_cyber', name: 'Khung Hologram Cyberpunk', type: 'frame', price: 50000, value: 'cyber-ring', desc: 'Khung ảnh ba chiều đậm chất khoa học viễn tưởng siêu tương lai.' },
  // Titles
  { id: 'title_academic', name: 'Danh Hiệu: Chúa Tể Học Thuật', type: 'title', price: 30000, value: 'Chúa Tể Học Thuật', desc: 'Danh hiệu tối thượng dành cho học bá có công lực phi phàm.' },
  { id: 'title_investor', name: 'Danh Hiệu: Ông Trùm Đầu Tư', type: 'title', price: 40000, value: 'Ông Trùm Đầu Tư', desc: 'Hiển thị danh hiệu quý tộc của tay chơi thao túng Sàn Vàng.' },
  { id: 'title_casino', name: 'Danh Hiệu: Thần Bài Las Vegas', type: 'title', price: 80000, value: 'Thần Bài Las Vegas', desc: 'Khẳng định vị thế ông hoàng đỏ đen thống trị sòng bài S88.' },
  { id: 'title_vip', name: 'Danh Hiệu: Đại Gia Học Đường', type: 'title', price: 100000, value: 'Đại Gia Học Đường', desc: 'Tôn vinh sinh viên sở hữu khối lượng tài sản PP vô địch thiên hạ.' }
];

export default function MarketplacePortal({ uid, user, onShowResult }: MarketplacePortalProps) {
  const [activeTab, setActiveTab] = useState<'shop' | 'inventory' | 'gift' | 'promo'>('shop');
  const [promoCode, setPromoCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Loaded user inventory elements
  const [myInventory, setMyInventory] = useState<{ frames: string[]; titles: string[] }>({
    frames: [],
    titles: []
  });

  const [giftTarget, setGiftTarget] = useState('');
  const [giftAmount, setGiftAmount] = useState('');
  const [giftMsg, setGiftMsg] = useState('');

  // Fetch or sync user inventory
  useEffect(() => {
    const invRef = ref(db, `users/${uid}/inventory`);
    const unsub = onValue(invRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setMyInventory({
          frames: val.frames || [],
          titles: val.titles || []
        });
      }
    });

    // Make sure we initialize default inventory structure if empty
    return () => unsub();
  }, [uid]);

  const handleBuyItem = async (item: ShopItem) => {
    setIsProcessing(true);
    try {
      // Retrieve dynamic up-to-date user data to avoid stale React props desynchronization
      const userSnap = await get(ref(db, `users/${uid}`));
      if (!userSnap.exists()) {
        onShowResult('THẤT BẠI', 'Tài khoản không tồn tại trên hệ thống!', false);
        setIsProcessing(false);
        return;
      }
      const freshUser = userSnap.val();
      const myPP = freshUser.pp || 0;

      if (myPP < item.price) {
        onShowResult('THẤT BẠI', `Bạn không có đủ ${item.price.toLocaleString()} PP để mua vật phẩm này!`, false);
        setIsProcessing(false);
        return;
      }

      // Check if user already owns it
      const owned = item.type === 'frame' 
        ? myInventory.frames.includes(item.value)
        : myInventory.titles.includes(item.value);

      if (owned) {
        onShowResult('THẤT BẠI', 'Bạn đã sở hữu vật phẩm này rồi!', false);
        setIsProcessing(false);
        return;
      }

      // Deduct PP & Add item to inventory
      const newPP = myPP - item.price;
      const updatedInv = { ...myInventory };
      if (item.type === 'frame') {
        updatedInv.frames = [...updatedInv.frames, item.value];
      } else {
        updatedInv.titles = [...updatedInv.titles, item.value];
      }

      await update(ref(db, `users/${uid}`), {
        pp: newPP,
        inventory: updatedInv
      });

      // Write transaction logs
      await push(ref(db, 'transactions'), {
        sender: uid,
        senderName: freshUser.name || 'Sinh Viên',
        receiver: 'SYSTEM_SHOP',
        receiverName: 'Cửa hàng S-System',
        amount: item.price,
        message: `Mua vật phẩm: ${item.name}`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      confetti({
        particleCount: 120,
        spread: 60,
        origin: { y: 0.6 }
      });

      onShowResult('MUA THÀNH CÔNG!', `Chúc mừng! Bạn đã sở hữu thành công "${item.name}".\nVui lòng vào mục Kho Đồ để kích hoạt trang bị!`, true);
    } catch (err) {
      onShowResult('THẤT BẠI', 'Có lỗi xảy ra khi mua vật phẩm!', false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEquipItem = async (type: 'frame' | 'title', value: string) => {
    setIsProcessing(true);
    try {
      if (type === 'frame') {
        // Equip avatar frame
        await update(ref(db, `users/${uid}`), { activeFrame: value });
        onShowResult('KÍCH HOẠT THÀNH CÔNG!', 'Kích hoạt Khung Avatar thành công!', true);
      } else {
        // Equip custom title
        await update(ref(db, `users/${uid}`), { title: value });
        onShowResult('KÍCH HOẠT THÀNH CÔNG!', 'Kích hoạt Danh Hiệu độc quyền thành công!', true);
      }
    } catch (err) {
      onShowResult('THẤT BẠI', 'Lỗi kích hoạt trang bị!', false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveEquip = async (type: 'frame' | 'title') => {
    setIsProcessing(true);
    try {
      if (type === 'frame') {
        await update(ref(db, `users/${uid}`), { activeFrame: null });
        onShowResult('GỠ TRANG BỊ', 'Đã gỡ Khung Avatar!', true);
      } else {
        await update(ref(db, `users/${uid}`), { title: null });
        onShowResult('GỠ TRANG BỊ', 'Đã gỡ Danh Hiệu!', true);
      }
    } catch (err) {
      onShowResult('THẤT BẠI', 'Lỗi gỡ trang bị!', false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    setIsProcessing(true);
    try {
      const codeRef = ref(db, `promo_codes/${code}`);
      const snap = await get(codeRef);

      if (!snap.exists()) {
        onShowResult('THẤT BẠI', 'Mã quà tặng (Promo Code) không tồn tại hoặc đã hết hạn sử dụng!', false);
        setIsProcessing(false);
        return;
      }

      const pData = snap.val();
      const claimedBy = pData.claimedBy || {};

      if (claimedBy[uid]) {
        onShowResult('THẤT BẠI', 'Bạn đã nhận quà từ mã khuyến mãi này trước đó rồi!', false);
        setIsProcessing(false);
        return;
      }

      if (pData.maxClaims && Object.keys(claimedBy).length >= pData.maxClaims) {
        onShowResult('THẤT BẠI', 'Rất tiếc! Mã khuyến mãi này đã đạt giới hạn lượt sử dụng tối đa.', false);
        setIsProcessing(false);
        return;
      }

      // Claim success
      const currentPP = user?.pp || 0;
      const reward = pData.rewardPP || 5000;

      await update(ref(db, `users/${uid}`), { pp: currentPP + reward });
      await update(ref(db, `promo_codes/${code}/claimedBy`), { [uid]: Date.now() });

      // Write transactions
      await push(ref(db, 'transactions'), {
        sender: 'PROMO_CODE_CENTER',
        senderName: 'Trung tâm Quà tặng',
        receiver: uid,
        receiverName: user?.name || 'Sinh Viên',
        amount: reward,
        message: `Đổi mã Promo Code: ${code}`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      confetti({
        particleCount: 150,
        spread: 80,
        colors: ['#00ff80', '#00f0ff', '#ffd700']
      });

      onShowResult('ĐỔI QUÀ THÀNH CÔNG!', `Bạn húp trọn thành công +${reward.toLocaleString()} PP miễn phí vào ví ngân hàng!`, true);
      setPromoCode('');
    } catch (err) {
      onShowResult('THẤT BẠI', 'Có lỗi xảy ra khi xử lý mã quà tặng!', false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendGift = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = giftTarget.trim();
    const amt = parseInt(giftAmount);

    if (!target) {
      onShowResult('THẤT BẠI', 'Vui lòng nhập UID người nhận quà!', false);
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      onShowResult('THẤT BẠI', 'Số PP quà tặng không hợp lệ!', false);
      return;
    }
    if (target === uid) {
      onShowResult('THẤT BẠI', 'Bạn không thể tự gửi quà tặng PP cho chính mình!', false);
      return;
    }

    const myPP = user?.pp || 0;
    if (myPP < amt) {
      onShowResult('THẤT BẠI', `Ví PP không đủ để thực hiện giao dịch quà tặng!`, false);
      return;
    }

    setIsProcessing(true);
    try {
      // Check target UID exists
      const targetRef = ref(db, `users/${target}`);
      const tSnap = await get(targetRef);

      if (!tSnap.exists()) {
        onShowResult('THẤT BẠI', 'Không tìm thấy tài khoản sinh viên có UID tương ứng!', false);
        setIsProcessing(false);
        return;
      }

      const tData = tSnap.val();
      const targetPP = tData.pp || 0;

      // Transfer PP
      await update(ref(db, `users/${uid}`), { pp: myPP - amt });
      await update(ref(db, `users/${target}`), { pp: targetPP + amt });

      // Add transactions
      await push(ref(db, 'transactions'), {
        sender: uid,
        senderName: user?.name || 'Sinh Viên',
        receiver: target,
        receiverName: tData.name || 'Sinh Viên',
        amount: amt,
        message: giftMsg.trim() || 'Quà tặng PP thân ái!',
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      // Notify target (add to notification node)
      await push(ref(db, `notifications/${target}`), {
        title: '🎁 QUÀ TẶNG BẤT NGỜ',
        message: `Bạn được nhận +${amt.toLocaleString()} PP từ sinh viên ${user?.name}. Lời nhắn: "${giftMsg || 'Quà tặng PP thân ái!'}"`,
        time: new Date().toLocaleTimeString('vi-VN'),
        timestamp: Date.now()
      });

      onShowResult('GỬI QUÀ THÀNH CÔNG!', `Gửi thành công gói quà tặng ${amt.toLocaleString()} PP cho sinh viên ${tData.name}!`, true);
      setGiftTarget('');
      setGiftAmount('');
      setGiftMsg('');
    } catch (err) {
      onShowResult('THẤT BẠI', 'Gặp lỗi khi gửi quà tặng!', false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Marketplace navbar tabs */}
      <div className="flex border-b border-white/5 pb-2 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('shop')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'shop'
              ? 'bg-[#ff003c] text-white shadow-[0_0_15px_rgba(255,0,60,0.3)]'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> [ CỬA HÀNG ]
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-[#ff003c] text-white shadow-[0_0_15px_rgba(255,0,60,0.3)]'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Award className="w-4 h-4" /> [ KHO ĐỒ CỦA TÔI ]
        </button>

        <button
          onClick={() => setActiveTab('gift')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'gift'
              ? 'bg-[#ff003c] text-white shadow-[0_0_15px_rgba(255,0,60,0.3)]'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Gift className="w-4 h-4" /> [ TẶNG QUÀ PHƯƠNG XA ]
        </button>

        <button
          onClick={() => setActiveTab('promo')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'promo'
              ? 'bg-[#ff003c] text-white shadow-[0_0_15px_rgba(255,0,60,0.3)]'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Tag className="w-4 h-4" /> [ PROMO CODE ]
        </button>
      </div>

      {/* SHOP VIEW */}
      {activeTab === 'shop' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {SHOP_ITEMS.map((item) => {
            const owned = item.type === 'frame'
              ? myInventory.frames.includes(item.value)
              : myInventory.titles.includes(item.value);

            return (
              <div 
                key={item.id} 
                className={`glass-box p-5 border flex flex-col justify-between gap-4 transition-all hover:scale-[1.02] ${
                  owned 
                    ? 'border-emerald-500/20 bg-emerald-950/5' 
                    : 'border-white/10 hover:border-[#ff003c]/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[9px] font-mono py-0.5 px-2 rounded-full border ${
                      item.type === 'frame' 
                        ? 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20' 
                        : 'border-yellow-500/30 text-yellow-400 bg-yellow-950/20'
                    }`}>
                      {item.type === 'frame' ? 'KHUNG AVATAR' : 'DANH HIỆU'}
                    </span>

                    {owned && (
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ĐÃ SỞ HỮU
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-sans font-black text-white">{item.name}</h4>
                  <p className="text-slate-400 text-xs mt-2 font-sans leading-relaxed">{item.desc}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="font-mono text-xs">
                    <span className="block text-[9px] text-slate-500 uppercase">Giá bán:</span>
                    <strong className="text-[#ffd700] text-glow-gold font-extrabold text-sm flex items-center gap-1">
                      <Coins className="w-4 h-4" /> {item.price.toLocaleString()} PP
                    </strong>
                  </div>

                  <button
                    onClick={() => handleBuyItem(item)}
                    disabled={owned || isProcessing}
                    className={`py-2 px-4 rounded-lg font-mono text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                      owned
                        ? 'bg-transparent border border-[#00ff80]/30 text-[#00ff80] cursor-not-allowed'
                        : 'bg-red-950/10 hover:bg-[#ff003c] border border-[#ff003c] text-[#ff003c] hover:text-white hover:shadow-[0_0_10px_rgba(255,0,60,0.3)]'
                    }`}
                  >
                    {owned ? '[ ĐÃ SỞ HỮU ]' : '[ MUA NGAY ]'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INVENTORY VIEW */}
      {activeTab === 'inventory' && (
        <div className="space-y-8 font-mono">
          {/* Avatar Frames List */}
          <div className="glass-box p-6 border-t-2 border-cyan-500/30">
            <h3 className="font-bold text-xs uppercase tracking-widest text-[#00f0ff] mb-4 flex items-center gap-2">
              🖼️ KHUNG AVATAR ĐÃ MUA ({myInventory.frames.length})
            </h3>

            {myInventory.frames.length === 0 ? (
              <p className="text-xs text-[#8b949e] italic">Bạn chưa mua bất kì khung avatar nào.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myInventory.frames.map((frame) => {
                  const isActive = (user as any)?.activeFrame === frame;
                  return (
                    <div key={frame} className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <strong className="block text-white text-xs uppercase">{frame === 'gold-ring' ? 'Hoàng Gia Gold' : frame === 'neon-ring' ? 'Cầu Vồng Neon' : 'Hologram Cyberpunk'}</strong>
                        <span className="text-[10px] text-slate-400">Thiết bị làm nổi bật Avatar của bạn</span>
                      </div>

                      <div className="flex gap-2">
                        {isActive ? (
                          <button
                            onClick={() => handleRemoveEquip('frame')}
                            className="py-1.5 px-3 bg-red-950/20 hover:bg-red-950/50 border border-red-500/40 text-red-400 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            [ GỠ BỎ ]
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEquipItem('frame', frame)}
                            className="py-1.5 px-3 bg-cyan-950/20 hover:bg-cyan-500 hover:text-black border border-cyan-500 text-cyan-400 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            [ SỬ DỤNG ]
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Titles List */}
          <div className="glass-box p-6 border-t-2 border-yellow-500/30">
            <h3 className="font-bold text-xs uppercase tracking-widest text-[#ffd700] mb-4 flex items-center gap-2">
              🏅 DANH HIỆU ĐÃ MUA ({myInventory.titles.length})
            </h3>

            {myInventory.titles.length === 0 ? (
              <p className="text-xs text-[#8b949e] italic">Bạn chưa sở hữu danh hiệu nào.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myInventory.titles.map((title) => {
                  const isActive = (user as any)?.title === title;
                  return (
                    <div key={title} className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <span className="inline-block py-0.5 px-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[9px] font-black rounded-full uppercase">
                          {title}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {isActive ? (
                          <button
                            onClick={() => handleRemoveEquip('title')}
                            className="py-1.5 px-3 bg-red-950/20 hover:bg-red-950/50 border border-red-500/40 text-red-400 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            [ GỠ BỎ ]
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEquipItem('title', title)}
                            className="py-1.5 px-3 bg-yellow-950/20 hover:bg-yellow-500 hover:text-black border border-yellow-500 text-yellow-400 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            [ SỬ DỤNG ]
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GIFT CENTER VIEW */}
      {activeTab === 'gift' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
          <div className="glass-box p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Gift className="w-5 h-5 text-[#ff003c]" />
              <h4 className="text-glow-red text-white uppercase font-black text-sm">GỬI QUÀ PP KHÁNH QUÝ</h4>
            </div>

            <p className="text-[#8b949e] text-[11px] leading-relaxed">
              Bạn có thể chuyển tặng PP từ số dư tài khoản của mình cho bạn bè hoặc các sinh viên khác ngay lập tức. Giao dịch an toàn, bảo mật tuyệt đối 100%.
            </p>

            <form onSubmit={handleSendGift} className="space-y-4">
              <div>
                <label className="block text-[#8b949e] mb-1.5 uppercase">MÃ SỐ UID SINH VIÊN NHẬN QUÀ:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: a2b3c4..."
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#ff003c] outline-none transition"
                  value={giftTarget}
                  onChange={(e) => setGiftTarget(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[#8b949e] mb-1.5 uppercase">SỐ LƯỢNG PP MUỐN GỬI TẶNG:</label>
                <input
                  type="number"
                  placeholder="Nhập số PP gửi..."
                  required
                  min={1}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#ff003c] outline-none transition"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[#8b949e] mb-1.5 uppercase">LỜI NHẮN THƯƠNG YÊU:</label>
                <textarea
                  placeholder="Chúc mừng sinh nhật, hoặc quà tặng may mắn từ mình nhé..."
                  rows={2}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#ff003c] outline-none transition resize-none"
                  value={giftMsg}
                  onChange={(e) => setGiftMsg(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3.5 bg-red-950/20 hover:bg-[#ff003c] border border-[#ff003c] text-[#ff003c] hover:text-white font-extrabold rounded-xl transition duration-200 cursor-pointer uppercase tracking-widest text-[10px]"
              >
                {isProcessing ? '[ ĐANG XỬ LÝ... ]' : '[ XÁC NHẬN GỬI QUÀ PP ]'}
              </button>
            </form>
          </div>

          <div className="glass-box p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <h4 className="text-white uppercase font-black text-sm">CHÍNH SÁCH CHUYỂN TẶNG</h4>
              </div>

              <ul className="space-y-3.5 text-slate-300 text-[11px] leading-relaxed list-disc pl-4">
                <li>PP được chuyển giao tức thì, không mất phí trung gian.</li>
                <li>Mọi giao dịch tặng quà đều được lưu trữ vĩnh viễn trên cơ sở dữ liệu để phòng ngừa gian lận.</li>
                <li>Không thực hiện các hành vi trao đổi ngoài đời thật (RMT). S-System 88 không chịu trách nhiệm trong trường hợp xảy ra tranh chấp.</li>
                <li>Vui lòng kiểm tra cực kỳ chính xác mã UID của người nhận trước khi nhấn xác nhận chuyển.</li>
              </ul>
            </div>

            <div className="bg-[#ff003c]/5 border border-[#ff003c]/20 p-4 rounded-xl mt-6">
              <span className="block text-[10px] text-[#ff003c] font-black uppercase tracking-wider mb-1">Ví PP của bạn:</span>
              <strong className="text-xl font-bold text-white">{(user?.pp || 0).toLocaleString()} PP</strong>
            </div>
          </div>
        </div>
      )}

      {/* PROMO CODE VIEW */}
      {activeTab === 'promo' && (
        <div className="max-w-md mx-auto glass-box p-6 space-y-5 font-mono text-xs text-center">
          <div className="mx-auto w-12 h-12 rounded-full border border-[#00f0ff]/30 bg-[#00f0ff]/5 flex items-center justify-center text-glow-blue text-[#00f0ff] animate-bounce">
            <Sparkles className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-black text-white uppercase tracking-widest">ĐỔI QUÀ PROMO CODE</h4>
            <p className="text-[#8b949e] text-[11px]">Nhập mã quà tặng từ trường học để lấy PP miễn phí!</p>
          </div>

          <form onSubmit={handleRedeemCode} className="space-y-3">
            <input
              type="text"
              placeholder="VÍ DỤ: VIPPRO88, TANTHU88..."
              required
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3.5 text-center text-sm font-black tracking-widest text-white uppercase focus:border-[#ff003c] outline-none transition"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 bg-red-950/20 hover:bg-[#ff003c] border border-[#ff003c] text-[#ff003c] hover:text-white font-extrabold rounded-xl transition duration-200 cursor-pointer uppercase tracking-widest"
            >
              {isProcessing ? '[ ĐANG KIỂM TRA... ]' : '[ KÍCH HOẠT NHẬN PP ]'}
            </button>
          </form>

          <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
            Mã quà tặng được ban phát ngẫu nhiên vào các dịp lễ hoặc thông qua sự kiện học tập, câu hỏi của Giáo viên quản trị trường.
          </p>
        </div>
      )}
    </div>
  );
}
