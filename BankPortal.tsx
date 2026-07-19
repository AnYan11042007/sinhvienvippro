/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, onValue, update, set } from 'firebase/database';
import { db } from '../firebase';
import { Landmark, ArrowUpRight, ArrowDownLeft, Send, History } from 'lucide-react';
import { User, Transaction } from '../types';

interface BankPortalProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function BankPortal({ uid, user, onShowResult }: BankPortalProps) {
  const [recipientId, setRecipientId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Transfer history state
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load transaction history securely
  useEffect(() => {
    const txRef = ref(db, 'transactions');
    const unsubscribe = onValue(txRef, (snap) => {
      const data = snap.val() || {};
      const list: Transaction[] = Object.keys(data).map((k) => ({
        id: k,
        ...data[k]
      }));

      // Filter only transactions related to current user
      const filtered = list.filter((tx) => tx.sender === uid || tx.receiver === uid);

      // Sort desc newest first
      filtered.sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(filtered);
    });

    return () => unsubscribe();
  }, [uid]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    const targetUid = recipientId.trim();
    const amt = parseInt(transferAmount);
    const msg = transferMessage.trim() || 'Chuyển khoản PP an toàn';

    // Validations
    if (!targetUid) {
      alert('Vui lòng nhập UID người nhận!');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Số lượng PP chuyển khoản không hợp lệ!');
      return;
    }
    if (targetUid === uid) {
      alert('Không thể tự chuyển khoản PP cho chính mình!');
      return;
    }

    const currentPP = user?.pp || 0;
    if (currentPP < amt) {
      onShowResult('GIAO DỊCH LỖI', `Tài khoản của bạn không đủ PP!\nSố dư hiện tại: ${currentPP.toLocaleString()} PP.\nYêu cầu chuyển: ${amt.toLocaleString()} PP.`, false);
      return;
    }

    setIsProcessing(true);

    try {
      // Check if recipient exists
      const recSnap = await get(ref(db, `users/${targetUid}`));
      if (!recSnap.exists()) {
        onShowResult('GIAO DỊCH THẤT BẠI', `UID người nhận "${targetUid}" không tồn tại trên hệ thống S-System!`, false);
        setIsProcessing(false);
        return;
      }

      const recData = recSnap.val() as User;
      if (recData.role === 'TEACHER') {
        onShowResult('LỖI CHUYỂN KHOẢN', `Không thể chuyển khoản PP cho Giáo viên/Admin hệ thống!`, false);
        setIsProcessing(false);
        return;
      }

      const timestamp = Date.now();
      const txTime = new Date().toLocaleString('vi-VN');

      // Update balances securely
      const senderNewPP = currentPP - amt;
      const recNewPP = (recData.pp || 0) + amt;

      await update(ref(db, `users/${uid}`), { pp: senderNewPP });
      await update(ref(db, `users/${targetUid}`), { pp: recNewPP });

      // Save transaction ledger
      const txId = `TX_${timestamp}`;
      await set(ref(db, `transactions/${txId}`), {
        sender: uid,
        senderName: user?.name || 'Ẩn danh',
        receiver: targetUid,
        receiverName: recData.name || 'Người nhận',
        amount: amt,
        message: msg,
        time: txTime,
        timestamp: timestamp
      });

      // Clear input fields
      setRecipientId('');
      setTransferAmount('');
      setTransferMessage('');

      onShowResult('CHUYỂN KHOẢN THÀNH CÔNG', `Đã chuyển khoản ${amt.toLocaleString()} PP thành công tới sinh viên:\n${recData.name} (${targetUid})\n\nLời nhắn: "${msg}"`, true);
    } catch (err) {
      console.error(err);
      alert('Lỗi hệ thống khi thực hiện chuyển khoản!');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="tab-bank" className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
      {/* Transfer panel */}
      <div className="glass-box section-card p-6 border-t-2 border-[#00f0ff]/30 relative overflow-hidden">
        <div className="card-header flex items-center justify-between pb-3.5 mb-5 border-b border-[#30363d]">
          <h3 className="text-sm tracking-widest uppercase flex items-center gap-2 text-glow-blue text-[#00f0ff]">
            <Landmark className="w-5 h-5 animate-pulse" /> CHUYỂN KHOẢN PP TỐC HÀNH
          </h3>
          <span className="text-[10px] text-white/50">Mạng chuyển PP S-88</span>
        </div>

        <form onSubmit={handleTransfer} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#8b949e] mb-1.5 uppercase font-bold tracking-wider">Mã UID Người Nhận:</label>
            <input
              type="text"
              placeholder="Ví dụ: 1a2, 1a33..."
              className="w-full bg-black/60 border border-[#30363d] focus:border-[#00f0ff] rounded-lg p-3.5 outline-none text-white text-sm tracking-widest font-bold uppercase transition-all"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-[#8b949e] mb-1.5 uppercase font-bold tracking-wider">Số lượng PP chuyển khoản:</label>
            <input
              type="number"
              placeholder="Nhập số PP cược hoặc chuyển..."
              className="w-full bg-black/60 border border-[#30363d] focus:border-[#00f0ff] rounded-lg p-3.5 outline-none text-[#ffd700] text-glow-gold text-sm tracking-widest font-black transition-all"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-[#8b949e] mb-1.5 uppercase font-bold tracking-wider">Lời nhắn giao dịch:</label>
            <input
              type="text"
              placeholder="Nhập nội dung chuyển tiền (Không bắt buộc)..."
              className="w-full bg-black/60 border border-[#30363d] focus:border-[#00f0ff] rounded-lg p-3.5 outline-none text-white text-xs transition-all"
              value={transferMessage}
              onChange={(e) => setTransferMessage(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-3.5 bg-cyan-950/20 hover:bg-[#00f0ff] border border-[#00f0ff] text-[#00f0ff] hover:text-black font-extrabold rounded-lg uppercase tracking-widest cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] flex items-center justify-center gap-1.5 active:scale-95 text-xs"
          >
            {isProcessing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> ĐANG TRUYỀN DỮ LIỆU...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> [ XÁC NHẬN GIAO DỊCH ]
              </>
            )}
          </button>
        </form>
      </div>

      {/* History panel */}
      <div className="glass-box section-card p-6">
        <div className="card-header flex items-center justify-between pb-3.5 mb-5 border-b border-[#30363d]">
          <h3 className="text-sm tracking-widest uppercase flex items-center gap-2 text-glow-gold text-[#ffd700]">
            <History className="w-5 h-5 text-[#ffd700]" /> NHẬT KÝ LỊCH SỬ PP
          </h3>
          <span className="text-[10px] text-white/50">Thời gian thực</span>
        </div>

        <div className="overflow-y-auto max-h-[380px] pr-1">
          <div className="space-y-3">
            {transactions.map((tx) => {
              const isSent = tx.sender === uid;
              return (
                <div 
                  key={tx.id} 
                  className="p-3 bg-black/50 border border-white/5 hover:border-white/10 rounded-xl flex items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isSent ? 'bg-red-500/10 text-[#ff003c]' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {isSent ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-bold text-xs text-white">
                        {isSent ? (
                          <>
                            Chuyển đi <span className="text-red-400">-{tx.amount.toLocaleString()} PP</span>
                          </>
                        ) : (
                          <>
                            Nhận về <span className="text-emerald-400">+{tx.amount.toLocaleString()} PP</span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-white/50 truncate max-w-[200px]" title={tx.message}>
                        {tx.message}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[10px] font-mono shrink-0">
                    <div className="font-bold text-white">
                      {isSent ? `${tx.receiverName} (${tx.receiver})` : `${tx.senderName} (${tx.sender})`}
                    </div>
                    <div className="text-[#8b949e] mt-0.5">{tx.time.split(' ')[0]}</div>
                  </div>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <p className="text-center text-xs text-[#8b949e] italic py-16">
                Chưa phát sinh bất kỳ giao dịch PP nào.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
