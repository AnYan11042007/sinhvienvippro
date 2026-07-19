/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, update, push, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import { User, Quest, Report } from '../types';
import { Shield, Users, Ticket, Plus, Check, Play, Square, Ban, Trash2, Award, Zap, AlertTriangle, Settings, Coins, LayoutGrid } from 'lucide-react';
import AdminUserManage from './AdminUserManage';

interface AdminPortalProps {
  uid: string;
  user: User | null;
  onShowResult?: (title: string, message: string, isWin: boolean) => void;
}

interface ManageUser {
  id: string;
  name: string;
  class: string;
  pp: number;
  role: 'STUDENT' | 'TEACHER';
  locked: boolean;
}

export default function AdminPortal({ uid, user, onShowResult }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'vouchers' | 'quests' | 'reports' | 'settings'>('users');
  const [usersList, setUsersList] = useState<ManageUser[]>([]);
  const [questsList, setQuestsList] = useState<Quest[]>([]);
  const [reportsList, setReportsList] = useState<Report[]>([]);

  // Promo Code creation state
  const [newPromo, setNewPromo] = useState('');
  const [newPromoReward, setNewPromoReward] = useState('2000');
  const [newPromoMaxClaims, setNewPromoMaxClaims] = useState('10');

  // Student creation state
  const [createUsername, setCreateUsername] = useState('');
  const [createName, setCreateName] = useState('');
  const [createClass, setCreateClass] = useState('S88-SE1');
  const [createPassword, setCreatePassword] = useState('123456');
  const [createInitialPP, setCreateInitialPP] = useState('10000');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Custom PP adjustment state
  const [customPPChange, setCustomPPChange] = useState('');

  // Quest creation state
  const [newQuestTitle, setNewQuestTitle] = useState('');
  const [newQuestQuestion, setNewQuestQuestion] = useState('');
  const [newQuestOptA, setNewQuestOptA] = useState('');
  const [newQuestOptB, setNewQuestOptB] = useState('');
  const [newQuestCorrect, setNewQuestCorrect] = useState<'A' | 'B'>('A');
  const [newQuestReward, setNewQuestReward] = useState('1000');
  const [newQuestDeadline, setNewQuestDeadline] = useState('2026-12-31');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // Battle Pass Settings State
  const [bpPrice, setBpPrice] = useState(5000);
  const [bpResetTime, setBpResetTime] = useState('2026-08-31T23:59:59');
  
  // Battle Pass Tiers State
  const [bpTier1Std, setBpTier1Std] = useState(200);
  const [bpTier1Prem, setBpTier1Prem] = useState(1500);
  const [bpTier2Std, setBpTier2Std] = useState(300);
  const [bpTier2Prem, setBpTier2Prem] = useState(3000);
  const [bpTier3Std, setBpTier3Std] = useState(500);
  const [bpTier3Prem, setBpTier3Prem] = useState(5000);
  const [bpTier4Std, setBpTier4Std] = useState(1000);
  const [bpTier4Prem, setBpTier4Prem] = useState(7500);
  const [bpTier5Std, setBpTier5Std] = useState(2000);
  const [bpTier5Prem, setBpTier5Prem] = useState(15000);

  // Shop Items Prices State
  const [priceGoldFrame, setPriceGoldFrame] = useState(15000);
  const [priceNeonFrame, setPriceNeonFrame] = useState(25000);
  const [priceCyberFrame, setPriceCyberFrame] = useState(50000);
  const [priceAcademicTitle, setPriceAcademicTitle] = useState(30000);
  const [priceInvestorTitle, setPriceInvestorTitle] = useState(40000);
  const [priceCasinoTitle, setPriceCasinoTitle] = useState(80000);
  const [priceVipTitle, setPriceVipTitle] = useState(100000);

  useEffect(() => {
    if (user?.role !== 'TEACHER') return;

    // Load configurations
    const bpRef = ref(db, 'settings/battlepass');
    get(bpRef).then((snap) => {
      if (snap.exists()) {
        const val = snap.val();
        if (val.price !== undefined) setBpPrice(val.price);
        if (val.reset_time) setBpResetTime(val.reset_time);
        if (val.tiers) {
          const t = val.tiers;
          if (t[0]) {
            setBpTier1Std(t[0].standardReward?.value || 200);
            setBpTier1Prem(t[0].premiumReward?.value || 1500);
          }
          if (t[1]) {
            setBpTier2Std(t[1].standardReward?.value || 300);
            setBpTier2Prem(t[1].premiumReward?.value || 3000);
          }
          if (t[2]) {
            setBpTier3Std(t[2].standardReward?.value || 500);
            setBpTier3Prem(t[2].premiumReward?.value || 5000);
          }
          if (t[3]) {
            setBpTier4Std(t[3].standardReward?.value || 1000);
            setBpTier4Prem(t[3].premiumReward?.value || 7500);
          }
          if (t[4]) {
            setBpTier5Std(t[4].standardReward?.value || 2000);
            setBpTier5Prem(t[4].premiumReward?.value || 15000);
          }
        }
      }
    });

    const shopRef = ref(db, 'settings/shop_items');
    get(shopRef).then((snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const arr = Array.isArray(val) ? val : Object.values(val);
        arr.forEach((item: any) => {
          if (item.id === 'frame_gold') setPriceGoldFrame(item.price);
          if (item.id === 'frame_neon') setPriceNeonFrame(item.price);
          if (item.id === 'frame_cyber') setPriceCyberFrame(item.price);
          if (item.id === 'title_academic') setPriceAcademicTitle(item.price);
          if (item.id === 'title_investor') setPriceInvestorTitle(item.price);
          if (item.id === 'title_casino') setPriceCasinoTitle(item.price);
          if (item.id === 'title_vip') setPriceVipTitle(item.price);
        });
      }
    });
  }, [user, activeTab]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // 1. Save Battle Pass settings
      const updatedTiers = [
        {
          id: 'tier_1',
          name: 'CẤP ĐỘ 1 - TÂN BINH',
          levelRequired: 1,
          standardReward: { label: `+${bpTier1Std.toLocaleString()} PP`, value: bpTier1Std },
          premiumReward: { label: `👑 +${bpTier1Prem.toLocaleString()} PP`, value: bpTier1Prem }
        },
        {
          id: 'tier_2',
          name: 'CẤP ĐỘ 2 - CHUYÊN CẦN',
          levelRequired: 2,
          standardReward: { label: `🖼️ Khung Vàng Lấp Lánh`, value: bpTier2Std, frame: 'gold-ring' },
          premiumReward: { label: `👑 +${bpTier2Prem.toLocaleString()} PP`, value: bpTier2Prem }
        },
        {
          id: 'tier_3',
          name: 'CẤP ĐỘ 3 - CHIẾN binh S88',
          levelRequired: 3,
          standardReward: { label: `+${bpTier3Std.toLocaleString()} PP`, value: bpTier3Std },
          premiumReward: { label: `👑 +${bpTier3Prem.toLocaleString()} PP`, value: bpTier3Prem }
        },
        {
          id: 'tier_4',
          name: 'CẤP ĐỘ 4 - SIÊU ĐẲNG',
          levelRequired: 4,
          standardReward: { label: `+${bpTier4Std.toLocaleString()} PP`, value: bpTier4Std },
          premiumReward: { label: `👑 +${bpTier4Prem.toLocaleString()} PP`, value: bpTier4Prem }
        },
        {
          id: 'tier_5',
          name: 'CẤP ĐỘ 5 - THẦN ĐỒNG S88',
          levelRequired: 5,
          standardReward: { label: `🎓 +${bpTier5Std.toLocaleString()} PP`, value: bpTier5Std },
          premiumReward: { label: `👑 🖼️ Siêu Khung Cyber Xanh`, value: bpTier5Prem, frame: 'cyber-ring' }
        }
      ];

      await set(ref(db, 'settings/battlepass'), {
        price: bpPrice,
        reset_time: bpResetTime,
        tiers: updatedTiers
      });

      // 2. Save Shop Item settings
      const updatedShopItems = [
        { id: 'frame_gold', name: 'Khung Hoàng Gia Gold', type: 'frame', price: priceGoldFrame, value: 'gold-ring', desc: 'Khung Avatar mạ vàng ròng 24K óng ánh sang trọng bậc nhất.' },
        { id: 'frame_neon', name: 'Khung Cầu Vồng Neon', type: 'frame', price: priceNeonFrame, value: 'neon-ring', desc: 'Khung Neon nhấp nháy đa sắc chuyển động chuẩn 120 FPS.' },
        { id: 'frame_cyber', name: 'Khung Hologram Cyberpunk', type: 'frame', price: priceCyberFrame, value: 'cyber-ring', desc: 'Khung ảnh ba chiều đậm chất khoa học viễn tưởng siêu tương lai.' },
        { id: 'title_academic', name: 'Danh Hiệu: Chúa Tể Học Thuật', type: 'title', price: priceAcademicTitle, value: 'Chúa Tể Học Thuật', desc: 'Danh hiệu tối thượng dành cho học bá có công lực phi phàm.' },
        { id: 'title_investor', name: 'Danh Hiệu: Ông Trùm Đầu Tư', type: 'title', price: priceInvestorTitle, value: 'Ông Trùm Đầu Tư', desc: 'Hiển thị danh hiệu quý tộc của tay chơi thao túng Sàn Vàng.' },
        { id: 'title_casino', name: 'Danh Hiệu: Thần Bài Las Vegas', type: 'title', price: priceCasinoTitle, value: 'Thần Bài Las Vegas', desc: 'Khẳng định vị thế ông hoàng đỏ đen thống trị sòng bài S88.' },
        { id: 'title_vip', name: 'Danh Hiệu: Đại Gia Học Đường', type: 'title', price: priceVipTitle, value: 'Đại Gia Học Đường', desc: 'Tôn vinh sinh viên sở hữu khối lượng tài sản PP vô địch thiên hạ.' }
      ];

      await set(ref(db, 'settings/shop_items'), updatedShopItems);

      if (onShowResult) {
        onShowResult('THÀNH CÔNG 🎉', 'Đã cập nhật cấu hình Giá Shop và Phần thưởng Battle Pass thành công!', true);
      } else {
        alert('Đã cập nhật cấu hình Giá Shop và Phần thưởng Battle Pass thành công!');
      }
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Có lỗi xảy ra khi lưu cấu hình settings!', false);
      } else {
        alert('Có lỗi xảy ra khi lưu cấu hình!');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'TEACHER') return;

    // Listen to users
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snap) => {
      const list: ManageUser[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          const val = child.val();
          list.push({
            id: child.key!,
            name: val.name || 'Sinh Viên',
            class: val.class || 'N/A',
            pp: val.pp || 0,
            role: val.role || 'STUDENT',
            locked: val.locked || false
          });
        });
      }
      setUsersList(list);
    });

    // Listen to quests
    const questsRef = ref(db, 'quests');
    const unsubQuests = onValue(questsRef, (snap) => {
      const list: Quest[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key!, ...child.val() });
        });
      }
      setQuestsList(list);
    });

    // Listen to reports
    const reportsRef = ref(db, 'reports');
    const unsubReports = onValue(reportsRef, (snap) => {
      const list: Report[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key!, ...child.val() });
        });
      }
      setReportsList(list);
    });

    return () => {
      unsubUsers();
      unsubQuests();
      unsubReports();
    };
  }, [user]);

  if (user?.role !== 'TEACHER') {
    return (
      <div className="glass-box p-8 border-red-500/20 bg-red-950/5 text-center font-mono space-y-4">
        <AlertTriangle className="w-12 h-12 text-[#ff003c] mx-auto animate-pulse" />
        <h3 className="text-white text-base font-black">CẢNH BÁO BẢO MẬT: TRUY CẬP BỊ TỪ CHỐI</h3>
        <p className="text-[#8b949e] text-xs max-w-md mx-auto">
          Mục điều hành này chỉ dành riêng cho Giáo viên (Role: TEACHER) quản trị hệ thống. Tài khoản sinh viên không có thẩm quyền truy cập!
        </p>
      </div>
    );
  }

  // Create Student Account
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = createUsername.trim().toLowerCase();
    const name = createName.trim();
    const className = createClass.trim();
    const pass = createPassword.trim();
    const pp = parseInt(createInitialPP);

    if (!username || !name || !className || !pass || isNaN(pp) || pp < 0) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Vui lòng điền đầy đủ và đúng định dạng thông tin!', false);
      } else {
        alert('Vui lòng điền đầy đủ và đúng định dạng thông tin!');
      }
      return;
    }

    if (username.includes(' ')) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Tên đăng nhập không được chứa khoảng trắng!', false);
      } else {
        alert('Tên đăng nhập không được chứa khoảng trắng!');
      }
      return;
    }

    setIsLoading(true);
    try {
      // Check if user already exists
      const uSnap = await get(ref(db, `users/${username}`));
      if (uSnap.exists()) {
        if (onShowResult) {
          onShowResult('THẤT BẠI ❌', `Tên đăng nhập "${username}" đã tồn tại trên hệ thống!`, false);
        } else {
          alert(`Tên đăng nhập "${username}" đã tồn tại trên hệ thống!`);
        }
        setIsLoading(false);
        return;
      }

      // Create student payload
      const payload = {
        avatar: 'stud_1',
        class: className,
        classKey: className.toLowerCase().replace('-', '_'),
        locked: false,
        name: name,
        pass: pass,
        pp: pp,
        role: 'STUDENT',
        sem: 1,
        stats: [50, 50, 50, 50, 50],
        year: 2026,
        xp: 0,
        level: 1,
        isPremiumBattlePass: false
      };

      await set(ref(db, `users/${username}`), payload);

      // System notice inside general chat
      await push(ref(db, 'global_chat'), {
        senderId: 'SYSTEM_ADMIN',
        senderName: 'Văn Phòng Khoa',
        message: `👤 CHÀO MỪNG TÂN SINH VIÊN: Chào đón tân binh [ ${name} ] lớp ${className} gia nhập mái trường S-System 88! 🎉`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });

      if (onShowResult) {
        onShowResult('THÀNH CÔNG 🎉', `Đã khởi tạo thành công tài khoản sinh viên: ${username}!`, true);
      } else {
        alert(`Đã khởi tạo thành công tài khoản sinh viên: ${username}!`);
      }
      setCreateUsername('');
      setCreateName('');
    } catch (err) {
      if (onShowResult) {
        onShowResult('LỖI HỆ THỐNG ❌', 'Lỗi tạo tài khoản sinh viên!', false);
      } else {
        alert('Lỗi tạo tài khoản sinh viên!');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Adjust PP Balance
  const handleAdjustPP = async (targetUid: string, currentPP: number, change: number) => {
    const nextPP = currentPP + change;
    if (nextPP < 0) return;

    try {
      await update(ref(db, `users/${targetUid}`), { pp: nextPP });
      if (onShowResult) {
        onShowResult('CẤP PHÁT QUỸ 💰', `Đã điều chỉnh tài sản cho UID ${targetUid}: ${change > 0 ? '+' : ''}${change.toLocaleString()} PP!`, true);
      }
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Không thể chỉnh sửa PP!', false);
      } else {
        alert('Không thể chỉnh sửa PP!');
      }
    }
  };

  // Toggle user account lock
  const handleToggleLock = async (targetUid: string, currentLock: boolean) => {
    try {
      await update(ref(db, `users/${targetUid}`), { locked: !currentLock });
      if (onShowResult) {
        onShowResult(
          currentLock ? 'MỞ KHÓA ACC 🎉' : 'KHÓA TÀI KHOẢN 🔒',
          currentLock ? 'Đã mở khóa tài khoản thành công!' : 'Đã khóa tài khoản sinh viên thành công!',
          !currentLock
        );
      }
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Không thể khoá/mở khoá tài khoản!', false);
      } else {
        alert('Không thể khoá/mở khoá tài khoản!');
      }
    }
  };

  // Create Promo Code
  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newPromo.trim().toUpperCase();
    const reward = parseInt(newPromoReward);
    const maxClaims = parseInt(newPromoMaxClaims);

    if (!code || isNaN(reward) || reward <= 0 || isNaN(maxClaims) || maxClaims <= 0) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Thông tin Voucher không hợp lệ!', false);
      } else {
        alert('Thông tin Voucher không hợp lệ!');
      }
      return;
    }

    setIsLoading(true);
    try {
      await set(ref(db, `promo_codes/${code}`), {
        rewardPP: reward,
        maxClaims: maxClaims,
        createdTime: new Date().toISOString(),
        claimedBy: {}
      });

      // Broadcast promo in chat as system
      await push(ref(db, 'global_chat'), {
        senderId: 'SYSTEM_ADMIN',
        senderName: 'Hiệu Trưởng',
        message: `🎁 QUÀ TẶNG TOÀN TRƯỜNG: Nhập mã PROMO CODE [ ${code} ] trong mục Chợ để nhận ngay +${reward.toLocaleString()} PP! Giới hạn: ${maxClaims} lượt claim nhanh nhất!`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });

      if (onShowResult) {
        onShowResult('TẠO VOUCHER THÀNH CÔNG 🎁', `Đã khởi tạo thành công mã Voucher: ${code}!`, true);
      } else {
        alert(`Đã khởi tạo thành công mã Voucher: ${code}!`);
      }
      setNewPromo('');
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Lỗi tạo mã quà tặng!', false);
      } else {
        alert('Lỗi tạo mã quà tặng!');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create Quest / Quizz
  const handleCreateQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const reward = parseInt(newQuestReward);

    if (!newQuestTitle.trim() || !newQuestQuestion.trim() || !newQuestOptA.trim() || !newQuestOptB.trim()) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Vui lòng điền đầy đủ câu hỏi bài tập!', false);
      } else {
        alert('Vui lòng điền đầy đủ câu hỏi bài tập!');
      }
      return;
    }

    setIsLoading(true);
    try {
      const newQuestRef = push(ref(db, 'quests'));
      const payload: Quest = {
        title: newQuestTitle.trim(),
        question: newQuestQuestion.trim(),
        optA: newQuestOptA.trim(),
        optB: newQuestOptB.trim(),
        correctOpt: newQuestCorrect,
        rewardPP: reward,
        penaltyPP: Math.floor(reward / 2),
        maxAttempts: 1,
        timeLimit: 0,
        deadline: newQuestDeadline,
        status: 'OPEN'
      };

      await set(newQuestRef, payload);

      // System notification
      await push(ref(db, 'global_chat'), {
        senderId: 'SYSTEM_ADMIN',
        senderName: 'Trưởng Khoa',
        message: `📚 BÀI TẬP VỀ NHÀ MỚI: Giáo viên vừa giao bài tập: "${newQuestTitle.trim()}". Hãy vào Cổng Học Tập làm bài ngay để tích lũy +${reward.toLocaleString()} PP!`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });

      if (onShowResult) {
        onShowResult('BAN HÀNH BÀI TẬP 🎉', 'Đã ban hành bài tập trắc nghiệm mới thành công!', true);
      } else {
        alert('Đã ban hành bài tập trắc nghiệm mới thành công!');
      }
      setNewQuestTitle('');
      setNewQuestQuestion('');
      setNewQuestOptA('');
      setNewQuestOptB('');
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Gặp lỗi khi tạo bài tập!', false);
      } else {
        alert('Gặp lỗi khi tạo bài tập!');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Quest status (OPEN / CLOSED)
  const handleToggleQuest = async (questId: string, currentStatus: 'OPEN' | 'CLOSED') => {
    try {
      await update(ref(db, `quests/${questId}`), {
        status: currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN'
      });
      if (onShowResult) {
        onShowResult(
          currentStatus === 'OPEN' ? 'ĐÓNG BÀI TẬP 🔒' : 'MỞ BÀI TẬP 🔓',
          currentStatus === 'OPEN' ? 'Đã đóng bài tập về nhà!' : 'Đã mở lại bài tập về nhà thành công!',
          currentStatus !== 'OPEN'
        );
      }
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Gặp lỗi khi thay đổi trạng thái bài tập!', false);
      } else {
        alert('Gặp lỗi khi thay đổi trạng thái bài tập!');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Category header tabs */}
      <div className="flex border-b border-white/5 pb-2 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.3)] font-black'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" /> [ SINH VIÊN ]
        </button>

        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'vouchers'
              ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.3)] font-black'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Ticket className="w-4 h-4" /> [ VOUCHER & QUÀ ]
        </button>

        <button
          onClick={() => setActiveTab('quests')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'quests'
              ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.3)] font-black'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Plus className="w-4 h-4" /> [ BAN HÀNH BÀI TẬP ]
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.3)] font-black'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Award className="w-4 h-4" /> [ BÁO CÁO PHẢN ÁNH ]
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 rounded-xl font-mono text-xs uppercase font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] font-black'
              : 'text-[#8b949e] hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings className="w-4 h-4 animate-spin-slow" /> [ CẤU HÌNH SHOP & PASS ]
        </button>
      </div>

      {/* MANAGING USERS LIST */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
          
          {/* LEFT: STUDENT CREATOR & CUSTOM PP PANEL */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Account Creator Form */}
            <div className="glass-box p-5 border-[#00f0ff]/30 bg-[#00f0ff]/5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="text-[#00f0ff] uppercase font-black text-xs flex items-center gap-1">
                  👤 TẠO TÀI KHOẢN SINH VIÊN MỚI
                </h4>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">Đăng ký thành viên mới vào mạng lưới S88</p>
              </div>

              <form onSubmit={handleCreateStudent} className="space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold">Tên Đăng Nhập (Username - liền nhau):</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: s88_an, nva_123"
                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-white focus:border-[#00f0ff] outline-none font-bold"
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold">Họ Và Tên (Full Name):</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: Nguyễn Văn An"
                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-white focus:border-[#00f0ff] outline-none"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold">Lớp Học (Class):</label>
                    <input
                      type="text"
                      required
                      placeholder="S88-SE1"
                      className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-white focus:border-[#00f0ff] outline-none font-bold text-center"
                      value={createClass}
                      onChange={(e) => setCreateClass(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold">Mật Khẩu (Password):</label>
                    <input
                      type="text"
                      required
                      placeholder="123456"
                      className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-white focus:border-[#00f0ff] outline-none font-bold text-center text-yellow-400"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 uppercase font-bold">PP Khởi Tạo Sẵn Có (Initial PP):</label>
                  <input
                    type="number"
                    required
                    placeholder="10000"
                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-[#00ff80] focus:border-[#00f0ff] outline-none font-bold text-sm"
                    value={createInitialPP}
                    onChange={(e) => setCreateInitialPP(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500/20 to-[#00f0ff]/30 hover:from-cyan-400 hover:to-[#00f0ff] hover:text-black border border-[#00f0ff] text-[#00f0ff] font-extrabold rounded-lg transition duration-200 cursor-pointer uppercase tracking-wider text-[9px]"
                >
                  {isLoading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN TẠO TÀI KHOẢN 🚀'}
                </button>
              </form>
            </div>

            {/* Fund Adjuster Console */}
            <div className="glass-box p-5 border-emerald-500/30 bg-emerald-950/5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="text-emerald-400 uppercase font-black text-xs flex items-center gap-1">
                  💰 TRUNG TÂM CẤP PHÁT QUỸ PHÁT TRIỂN (PP)
                </h4>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">Phân bổ quỹ PP cho bất kỳ sinh viên nào</p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                  Để cộng/trừ tiền học bổng, chọn trực tiếp các nút nhanh <b>+5K / +20K / +100K</b> hoặc bấm biểu tượng Edit để nhập con số tùy thích bên mục chi tiết bên phải.
                </p>
                <div className="p-3 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between text-[#00ff80] font-black text-[11px]">
                  <span>QUỸ S88 VÔ HẠN:</span>
                  <span className="text-glow-green">∞ PP (ONLINE)</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: ADVANCED STUDENT PORTAL MANAGER */}
          <div className="lg:col-span-8">
            <AdminUserManage onShowResult={onShowResult} />
          </div>

        </div>
      )}

      {/* CREATE VOUCHER / PROMO CODE */}
      {activeTab === 'vouchers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
          <div className="glass-box p-6 space-y-4">
            <h4 className="text-white font-black uppercase text-xs border-b border-white/5 pb-3">KHỞI TẠO PROMO CODE</h4>
            
            <form onSubmit={handleCreatePromoCode} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase">TÊN MÃ (VIẾT HOA, KHÔNG DẤU):</label>
                <input
                  type="text"
                  placeholder="VÍ DỤ: GIANGSINH88"
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none font-bold uppercase tracking-widest text-sm"
                  value={newPromo}
                  onChange={(e) => setNewPromo(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 uppercase">PHẦN THƯỞNG PP CHO MỖI LẦN NHẬP:</label>
                <input
                  type="number"
                  placeholder="2000"
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none"
                  value={newPromoReward}
                  onChange={(e) => setNewPromoReward(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 uppercase">GIỚI HẠN SỐ LƯỢT NHẬP CẢ HỆ THỐNG:</label>
                <input
                  type="number"
                  placeholder="10"
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none"
                  value={newPromoMaxClaims}
                  onChange={(e) => setNewPromoMaxClaims(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-cyan-950/20 hover:bg-[#00f0ff] border border-[#00f0ff] text-[#00f0ff] hover:text-black font-extrabold rounded-xl transition duration-200 cursor-pointer uppercase tracking-widest text-[10px]"
              >
                {isLoading ? '[ ĐANG XỬ LÝ... ]' : '[ TẠO & BAN BỐ TOÀN TRƯỜNG ]'}
              </button>
            </form>
          </div>

          <div className="glass-box p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h4 className="text-white font-black uppercase text-xs border-b border-white/5 pb-3">HƯỚNG DẪN HOẠT ĐỘNG</h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Mỗi mã Voucher được thiết lập gồm phần thưởng PP cụ thể và giới hạn claim tối đa.
              </p>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Sau khi tạo thành công, S-System 88 Core sẽ tự động gửi tin nhắn System thông báo kèm mã đổi quà vào dòng chat chính thức của hệ thống (Global Chat). Sinh viên có thể sao chép và nhập nhanh để tích lũy tài sản PP học đường!
              </p>
            </div>

            <div className="bg-[#00f0ff]/5 border border-[#00f0ff]/20 p-4 rounded-xl">
              <span className="text-[10px] text-[#00f0ff] font-black uppercase tracking-wider block mb-1">MẸO QUẢN TRỊ:</span>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Tạo mã với số lượt giới hạn nhỏ (ví dụ: 3 lượt) để kích thích tinh thần săn code nhanh tay lẹ mắt của các sinh viên trong giờ giải lao!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QUEST / QUIZ CREATION AND STATUS */}
      {activeTab === 'quests' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
          {/* New Quest Form */}
          <div className="glass-box p-6 space-y-4">
            <h4 className="text-white font-black uppercase text-xs border-b border-white/5 pb-3">BAN HÀNH BÀI TẬP VỀ NHÀ MỚI</h4>

            <form onSubmit={handleCreateQuest} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase">TIÊU ĐỀ BÀI TẬP / HỌC PHẦN:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đại số tuyến tính - Bài 1"
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none"
                  value={newQuestTitle}
                  onChange={(e) => setNewQuestTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 uppercase">CÂU HỎI TRẮC NGHIỆM CHI TIẾT:</label>
                <textarea
                  placeholder="Ví dụ: Tìm định thức của ma trận vuông cấp 2 sau..."
                  required
                  rows={2}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none resize-none"
                  value={newQuestQuestion}
                  onChange={(e) => setNewQuestQuestion(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 uppercase">LỰA CHỌN PHƯƠNG ÁN A:</label>
                  <input
                    type="text"
                    placeholder="Phương án A"
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none"
                    value={newQuestOptA}
                    onChange={(e) => setNewQuestOptA(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 uppercase">LỰA CHỌN PHƯƠNG ÁN B:</label>
                  <input
                    type="text"
                    placeholder="Phương án B"
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none"
                    value={newQuestOptB}
                    onChange={(e) => setNewQuestOptB(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 uppercase">PHƯƠNG ÁN ĐÚNG CHÍNH XÁC:</label>
                  <select
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none"
                    value={newQuestCorrect}
                    onChange={(e) => setNewQuestCorrect(e.target.value as 'A' | 'B')}
                  >
                    <option value="A">ĐÁP ÁN A</option>
                    <option value="B">ĐÁP ÁN B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 uppercase">THƯỞNG PP KHI TRẢ LỜI ĐÚNG:</label>
                  <input
                    type="number"
                    placeholder="1000"
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-[#00f0ff] outline-none"
                    value={newQuestReward}
                    onChange={(e) => setNewQuestReward(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-cyan-950/20 hover:bg-[#00f0ff] border border-[#00f0ff] text-[#00f0ff] hover:text-black font-extrabold rounded-xl transition duration-200 cursor-pointer uppercase tracking-widest text-[10px]"
              >
                {isLoading ? '[ ĐANG BAN HÀNH... ]' : '[ BAN HÀNH HỌC PHẦN BÀI TẬP ]'}
              </button>
            </form>
          </div>

          {/* Active Quests status list */}
          <div className="glass-box p-6 space-y-4">
            <h4 className="text-white font-black uppercase text-xs border-b border-white/5 pb-3">CÁC BÀI TẬP ĐANG HOẠT ĐỘNG</h4>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {questsList.map((q) => (
                <div key={q.id} className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-white text-xs">{q.title}</strong>
                    <span className={`text-[8px] font-black py-0.5 px-2 rounded-full uppercase border ${
                      q.status === 'OPEN'
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20'
                        : 'border-red-500/30 text-red-400 bg-red-950/20'
                    }`}>
                      {q.status === 'OPEN' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                    </span>
                  </div>

                  <p className="text-slate-400 text-[11px] leading-relaxed italic">"{q.question}"</p>
                  
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[#ffd700] text-glow-gold font-bold">Thưởng: +{q.rewardPP} PP</span>
                    
                    <button
                      onClick={() => handleToggleQuest(q.id!, q.status)}
                      className={`py-1 px-2.5 border rounded text-[9px] font-bold cursor-pointer transition uppercase ${
                        q.status === 'OPEN'
                          ? 'border-red-500/40 text-red-400 bg-red-950/10 hover:bg-red-500 hover:text-white'
                          : 'border-emerald-500/40 text-emerald-400 bg-emerald-950/10 hover:bg-emerald-500 hover:text-black'
                      }`}
                    >
                      {q.status === 'OPEN' ? '[ ĐÓNG LẠI ]' : '[ MỞ LẠI ]'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMITTED STUDENT REPORTS */}
      {activeTab === 'reports' && (
        <div className="glass-box p-6 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-white uppercase font-black text-xs">PHẢN ÁNH & BÁO CÁO GIAN LẬN ({reportsList.length})</h4>
            <span className="text-[10px] text-red-400 animate-pulse font-black uppercase">ĐƯỜNG DÂY NÓNG S88</span>
          </div>

          {reportsList.length === 0 ? (
            <p className="text-center italic text-slate-400 py-10">Chưa ghi nhận phản ánh nào từ sinh viên.</p>
          ) : (
            <div className="space-y-3">
              {reportsList.map((rep) => (
                <div key={rep.id} className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Người báo cáo: <strong className="text-white">{rep.senderName}</strong></span>
                    <span>{rep.time}</span>
                  </div>

                  <p className="text-white text-xs">
                    Đối tượng bị phản ánh: <strong className="text-yellow-400 uppercase">{rep.target}</strong>
                  </p>

                  <div className="p-2.5 bg-black/40 rounded border border-white/5 text-slate-300 leading-relaxed italic text-[11px]">
                    Nội dung lý do: "{rep.reason}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SYSTEM CONFIGURATION TAB (BATTLE PASS & SHOP PRICES) */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 font-mono text-xs">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT: BATTLE PASS PRICE & TIMING CONFIG */}
            <div className="glass-box p-6 border-amber-500/30 bg-amber-950/5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="text-amber-400 uppercase font-black text-xs flex items-center gap-1.5">
                  👑 CẤU HÌNH BATTLE PASS (S-PASS)
                </h4>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">Cấu hình giá mua Battle Pass và ngày tự động reset</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1.5 uppercase font-bold">Giá Đăng Ký Premium (PP):</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-[#ffd700] font-bold text-sm"
                    value={bpPrice}
                    onChange={(e) => setBpPrice(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1.5 uppercase font-bold">Thời Gian Reset (Hạn chót):</label>
                  <input
                    type="text"
                    required
                    placeholder="YYYY-MM-DDTHH:mm:ss"
                    className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-blue-400 font-bold font-mono text-xs"
                    value={bpResetTime}
                    onChange={(e) => setBpResetTime(e.target.value)}
                  />
                  <span className="text-[8px] text-slate-500 mt-1 block">Định dạng chuẩn: 2026-08-31T23:59:59</span>
                </div>
              </div>

              {/* Tiers & Rewards adjustment */}
              <div className="space-y-3 pt-2">
                <span className="text-[9px] text-slate-400 uppercase font-black border-b border-white/5 pb-1 block">ĐIỀU CHỈNH PHẦN THƯỞNG CHO TỪNG CẤP ĐỘ:</span>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  
                  {/* Tier 1 */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2">
                    <span className="text-[10px] text-white font-bold block">🏅 CẤP ĐỘ 1:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">Thường (Standard PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-white" value={bpTier1Std} onChange={(e) => setBpTier1Std(parseInt(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">VIP (Premium PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-amber-400" value={bpTier1Prem} onChange={(e) => setBpTier1Prem(parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Tier 2 */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2">
                    <span className="text-[10px] text-white font-bold block">🏅 CẤP ĐỘ 2 (Mặc định tặng Khung Vàng):</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">Thường (Standard PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-white" value={bpTier2Std} onChange={(e) => setBpTier2Std(parseInt(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">VIP (Premium PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-amber-400" value={bpTier2Prem} onChange={(e) => setBpTier2Prem(parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Tier 3 */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2">
                    <span className="text-[10px] text-white font-bold block">🏅 CẤP ĐỘ 3:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">Thường (Standard PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-white" value={bpTier3Std} onChange={(e) => setBpTier3Std(parseInt(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">VIP (Premium PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-amber-400" value={bpTier3Prem} onChange={(e) => setBpTier3Prem(parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Tier 4 */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2">
                    <span className="text-[10px] text-white font-bold block">🏅 CẤP ĐỘ 4:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">Thường (Standard PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-white" value={bpTier4Std} onChange={(e) => setBpTier4Std(parseInt(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">VIP (Premium PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-amber-400" value={bpTier4Prem} onChange={(e) => setBpTier4Prem(parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                  {/* Tier 5 */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2">
                    <span className="text-[10px] text-white font-bold block">🏅 CẤP ĐỘ 5 (VIP được tặng Khung Cyber):</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">Thường (Standard PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-white" value={bpTier5Std} onChange={(e) => setBpTier5Std(parseInt(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="block text-[8px] text-slate-500 uppercase font-bold">VIP (Premium PP):</label>
                        <input type="number" className="w-full bg-slate-900 border border-white/5 p-1 rounded text-amber-400" value={bpTier5Prem} onChange={(e) => setBpTier5Prem(parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* RIGHT: SHOP ITEM PRICES CONFIG */}
            <div className="glass-box p-6 border-[#00f0ff]/30 bg-[#00f0ff]/5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="text-[#00f0ff] uppercase font-black text-xs flex items-center gap-1.5">
                  🛒 CẤU HÌNH GIÁ VẬT PHẨM CHỢ ĐEN (BLACK MARKET)
                </h4>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5 uppercase">Tùy chỉnh giá bán các khung Avatar và danh hiệu đặc quyền</p>
              </div>

              {/* Avatar Frames price section */}
              <div className="space-y-3">
                <span className="text-[9px] text-slate-300 font-bold block border-b border-white/5 pb-1">🖼️ KHUNG AVATAR ĐỘC QUYỀN:</span>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Khung Vàng (Gold):</label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-yellow-500 font-bold"
                      value={priceGoldFrame}
                      onChange={(e) => setPriceGoldFrame(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Khung Neon:</label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-pink-500 font-bold"
                      value={priceNeonFrame}
                      onChange={(e) => setPriceNeonFrame(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Khung Cyber:</label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-cyan-400 font-bold"
                      value={priceCyberFrame}
                      onChange={(e) => setPriceCyberFrame(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Titles price section */}
              <div className="space-y-3 pt-2">
                <span className="text-[9px] text-slate-300 font-bold block border-b border-white/5 pb-1">🏅 DANH HIỆU THỜI THƯỢNG:</span>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Chúa Tể Học Thuật:</label>
                      <input
                        type="number"
                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-emerald-400 font-bold"
                        value={priceAcademicTitle}
                        onChange={(e) => setPriceAcademicTitle(parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Ông Trùm Đầu Tư:</label>
                      <input
                        type="number"
                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-amber-500 font-bold"
                        value={priceInvestorTitle}
                        onChange={(e) => setPriceInvestorTitle(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Thần Bài Las Vegas:</label>
                      <input
                        type="number"
                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-purple-400 font-bold"
                        value={priceCasinoTitle}
                        onChange={(e) => setPriceCasinoTitle(parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Đại Gia Học Đường (VIP):</label>
                      <input
                        type="number"
                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-red-400 font-bold"
                        value={priceVipTitle}
                        onChange={(e) => setPriceVipTitle(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclaimer / Warning */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-[10px] uppercase font-bold leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <span>Chú ý: Mọi điều chỉnh về giá cả sẽ được áp dụng trực tiếp lên hệ thống Marketplace và Battle Pass của sinh viên trong thời gian thực. Sinh viên sẽ cần tải lại trang hoặc mở giao diện tương ứng để cập nhật giá mới.</span>
              </div>
            </div>

          </div>

          {/* Submit Action Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="py-3 px-6 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-glow-amber rounded-xl text-xs tracking-wider cursor-pointer flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all"
            >
              <Check className="w-4 h-4" />
              {isLoading ? 'ĐANG LƯU THAY ĐỔI...' : 'CẬP NHẬT TOÀN BỘ CẤU HÌNH HỆ THỐNG'}
            </button>
          </div>

        </form>
      )}
    </div>
  );
}
