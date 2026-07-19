/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, update, push } from 'firebase/database';
import { db } from '../../firebase';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Sparkles, X } from 'lucide-react';
import { User } from '../../types';

interface TaiXiuModalProps {
  uid: string;
  user: User | null;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function TaiXiuModal({ uid, user, onClose, onShowResult }: TaiXiuModalProps) {
  const [betChoice, setBetChoice] = useState<'TAI' | 'XIU' | ''>('');
  const [betAmount, setBetAmount] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [dices, setDices] = useState<number[]>([1, 1, 1]);
  
  // Custom drag offsets for cup opening
  const [cupOffset, setCupOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const diceIcons = [
    null,
    'fa-dice-one',
    'fa-dice-two',
    'fa-dice-three',
    'fa-dice-four',
    'fa-dice-five',
    'fa-dice-six'
  ];

  const handleStartGame = async () => {
    const amt = parseInt(betAmount);
    if (!betChoice) {
      alert('Vui lòng chọn TÀI hoặc XỈU trước khi lắc!');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Số lượng PP đặt cược không hợp lệ!');
      return;
    }

    const currentPP = user?.pp || 0;
    if (currentPP < amt) {
      alert(`Tài khoản không đủ PP! Số dư hiện tại: ${currentPP.toLocaleString()} PP.`);
      return;
    }

    setIsPlaying(true);
    setIsShaking(true);
    setIsRevealed(false);
    setCupOffset({ x: 0, y: 0 });

    try {
      // Deduct PP immediately on stake
      await update(ref(db, `users/${uid}`), { pp: currentPP - amt });

      // Pre-calculate final dice values
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      setDices([d1, d2, d3]);

      // 2 seconds shaking animation
      setTimeout(() => {
        setIsShaking(false);
      }, 2000);
    } catch (err) {
      alert('Lỗi đặt cược Tài Xỉu!');
      setIsPlaying(false);
      setIsShaking(false);
    }
  };

  const handleReveal = async () => {
    if (isRevealed || isShaking || !isPlaying) return;
    setIsRevealed(true);

    const sum = dices[0] + dices[1] + dices[2];
    const isTai = sum >= 11;
    const isWinh = (betChoice === 'TAI' && isTai) || (betChoice === 'XIU' && !isTai);
    const isTriple = dices[0] === dices[1] && dices[1] === dices[2];

    const amt = parseInt(betAmount);
    let payout = 0;
    let logMsg = '';
    let resultTitle = '';

    if (isTriple) {
      logMsg = `Cổ kết quả: ${dices.join('-')} (Tổng: ${sum}) => BÃO!!! Nhà cái húp trọn sạch sành sanh.`;
      resultTitle = 'BÃO !!! THUA SẠCH';
    } else if (isWinh) {
      payout = amt * 2;
      resultTitle = 'CHIẾN THẮNG !';
      logMsg = `Kết quả xúc xắc: ${dices.join('-')} (Tổng: ${sum} - ${isTai ? 'TÀI' : 'XỈU'})\nChúc mừng bạn đoán đúng! Nhận về +${payout.toLocaleString()} PP.`;
    } else {
      resultTitle = 'THẤT BẠI !';
      logMsg = `Kết quả xúc xắc: ${dices.join('-')} (Tổng: ${sum} - ${isTai ? 'TÀI' : 'XỈU'})\nRất tiếc, bạn đoán sai! Thâm hụt mất -${amt.toLocaleString()} PP.`;
    }

    try {
      // Payout award if won
      if (payout > 0) {
        const uSnap = await get(ref(db, `users/${uid}`));
        const freshPP = uSnap.val()?.pp || 0;
        await update(ref(db, `users/${uid}`), { pp: freshPP + payout });

        // Update daily missions Tai Xiu wins
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const mRef = ref(db, `users/${uid}/daily_missions/${todayStr}`);
        const mSnap = await get(mRef);
        const currentWins = mSnap.val()?.taiXiuWins || 0;
        await update(mRef, { taiXiuWins: currentWins + 1 });
      }

      // Record logs in game logger
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Tài Xỉu',
        bet: amt,
        pnl: payout - amt,
        result: isTriple ? 'Bão (Thua)' : isWinh ? 'Thắng' : 'Thua',
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      // Clear layout
      setTimeout(() => {
        onClose();
        onShowResult(resultTitle, logMsg, isWinh && !isTriple);
      }, 1000);
    } catch (err) {
      console.error(err);
    }
  };

  // Draggable cup logic
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isRevealed || isShaking || !isPlaying) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - cupOffset.x, y: clientY - cupOffset.y });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;
    setCupOffset({ x: newX, y: newY });

    // Open/Reveal if dragged away far enough
    if (Math.abs(newX) > 100 || Math.abs(newY) > 100) {
      setIsDragging(false);
      handleReveal();
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (!isRevealed) {
      // Snap back if not triggered
      setCupOffset({ x: 0, y: 0 });
    }
  };

  return (
    <div className="overlay z-[6000]" onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}>
      <div className="glass-box login-panel max-w-[480px] p-6 border-[#ff00ff] relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#ff00ff] text-glow-pink text-2xl font-black font-mono uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5">
          <Sparkles className="w-5 h-5 animate-pulse" /> TÀI XỈU NẶN BÁT
        </h2>
        <p className="text-[10px] font-mono text-[#8b949e] uppercase mb-5">
          Lắc đĩa & Vuốt nặn sảng khoái 3D
        </p>

        {isShaking && (
          <div className="text-[#ffd700] text-glow-gold font-mono font-black text-lg py-2 animate-pulse">
            ĐANG RUNG ĐĨA LẮC QUÂN...
          </div>
        )}

        {/* Plate arena */}
        <div className="relative w-64 h-64 mx-auto my-6 flex items-center justify-center select-none">
          {/* Plate background */}
          <div className="absolute w-[230px] h-[230px] bg-gradient-to-b from-[#e6e6e6] via-[#999] to-[#333] rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.8),_inset_0_-5px_15px_rgba(0,0,0,0.5)] border-4 border-[#eee] flex items-center justify-center">
            {/* Inner felt green circle */}
            <div className="w-[190px] h-[190px] bg-[#1a4314] rounded-full shadow-inner border border-black/20" />
          </div>

          {/* Dice display layer */}
          {isPlaying && !isShaking && (
            <div className="absolute z-10 flex gap-3 animate-fade-in">
              {dices.map((val, idx) => (
                <i
                  key={idx}
                  className={`fas ${diceIcons[val]} text-[48px] bg-white text-red-600 rounded-lg shadow-[inset_0_0_8px_rgba(0,0,0,0.2),_0_5px_10px_rgba(0,0,0,0.5)] flex items-center justify-center p-1.5 ${
                    idx === 1 ? 'text-black' : ''
                  }`}
                  style={{ transform: `rotate(${idx * 15 - 15}deg)` }}
                />
              ))}
            </div>
          )}

          {/* Draggable Shaker Cup Cover */}
          {isPlaying && !isRevealed && (
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              style={{
                transform: `translate(${cupOffset.x}px, ${cupOffset.y}px)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                display: 'block'
              }}
              className={`absolute w-[180px] h-[180px] bg-gradient-to-r from-red-500 via-red-600 to-red-800 rounded-full z-20 shadow-[0_15px_25px_rgba(0,0,0,0.85),_inset_0_-10px_20px_rgba(0,0,0,0.6)] border border-red-400 flex items-center justify-center ${
                isShaking ? 'shake-anim' : ''
              }`}
            >
              {/* Cup handle details */}
              <div className="w-12 h-12 bg-red-950/20 rounded-full border border-red-400 flex items-center justify-center text-white/50 font-bold">
                88
              </div>
            </div>
          )}
        </div>

        {/* Inputs & actions */}
        {!isPlaying ? (
          <div className="space-y-4 font-mono text-xs">
            {/* Bet Side Selection */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setBetChoice('TAI')}
                className={`py-3 rounded-xl border font-black text-sm tracking-widest transition-all cursor-pointer ${
                  betChoice === 'TAI'
                    ? 'border-[#00ff80] text-[#00ff80] bg-[#00ff80]/5 text-glow-green scale-105'
                    : 'border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                TÀI (11-17)
              </button>
              <button
                type="button"
                onClick={() => setBetChoice('XIU')}
                className={`py-3 rounded-xl border font-black text-sm tracking-widest transition-all cursor-pointer ${
                  betChoice === 'XIU'
                    ? 'border-[#ff003c] text-[#ff003c] bg-[#ff003c]/5 text-glow-red scale-105'
                    : 'border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                XỈU (4-10)
              </button>
            </div>

            {/* Stake Input */}
            <div>
              <label className="block text-[#8b949e] text-left mb-1.5 uppercase font-bold">CƯỢC PP LẮC BÁT:</label>
              <input
                type="number"
                placeholder="Nhập số PP cược..."
                className="w-full bg-black/60 border border-[#30363d] focus:border-[#ff00ff] rounded-xl p-3 outline-none text-[#ffd700] text-glow-gold font-black text-center text-sm"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
              />
            </div>

            <button
              onClick={handleStartGame}
              className="w-full py-3.5 bg-pink-950/20 border border-[#ff00ff] text-[#ff00ff] hover:bg-[#ff00ff] hover:text-black hover:shadow-[0_0_15px_rgba(255,0,255,0.4)] font-extrabold rounded-xl uppercase tracking-widest transition-all text-xs cursor-pointer"
            >
              [ LẮC ĐĨA QUÂN ]
            </button>
          </div>
        ) : (
          <div className="space-y-3.5 text-xs font-mono">
            <p className="text-[#8b949e] text-center">
              Đặt cược: <b className="text-white">{betChoice}</b> | Số tiền:{' '}
              <b className="text-[#ffd700]">{parseInt(betAmount).toLocaleString()} PP</b>
            </p>
            <p className="text-white text-[11px] uppercase tracking-wide leading-relaxed animate-pulse">
              {isShaking ? 'Đang nhào quân...' : 'Dùng Chuột/Tay DI CHUYỂN BÁT để NẶN kết quả!'}
            </p>
            {!isShaking && (
              <button
                onClick={handleReveal}
                className="w-full py-3 border border-dashed border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff]/10 font-bold rounded-lg uppercase tracking-wider transition-all"
              >
                [ MỞ BÁT NGAY ]
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
