/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, update, push } from 'firebase/database';
import { db } from '../../firebase';
import { X, Award, HelpCircle } from 'lucide-react';
import { User } from '../../types';

interface HorseModalProps {
  uid: string;
  user: User | null;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function HorseModal({ uid, user, onClose, onShowResult }: HorseModalProps) {
  const [betAmount, setBetAmount] = useState('');
  const [isRacing, setIsRacing] = useState(false);
  const [commentary, setCommentary] = useState('Vui lòng chọn ngựa và đặt cược...');

  // Horse positions as percentages
  const [positions, setPositions] = useState<number[]>([0, 0, 0, 0]);
  const raceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (raceIntervalRef.current) clearInterval(raceIntervalRef.current);
    };
  }, []);

  const handleStartRace = async (choice: number) => {
    if (isRacing) return;

    const amt = parseInt(betAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Mức cược đua ngựa không hợp lệ!');
      return;
    }

    const currentPP = user?.pp || 0;
    if (currentPP < amt) {
      alert(`Bạn không có đủ PP để cược! Tài sản: ${currentPP.toLocaleString()} PP.`);
      return;
    }

    setIsRacing(true);
    setPositions([0, 0, 0, 0]);
    setCommentary(`Đang cược Ngựa số ${choice}... Cố lên!`);

    try {
      // Deduct PP initially
      await update(ref(db, `users/${uid}`), { pp: currentPP - amt });

      let currentPositions = [0, 0, 0, 0];

      // Run race animation interval
      raceIntervalRef.current = setInterval(async () => {
        let finished = false;
        let winningHorse = 0;

        const nextPositions = currentPositions.map((pos, idx) => {
          // Add random stride steps between 0.1% and 0.9%
          const step = Math.random() * 0.8 + 0.1;
          const nextPos = pos + step;

          if (nextPos >= 85 && !finished) {
            finished = true;
            winningHorse = idx + 1;
          }
          return nextPos;
        });

        currentPositions = nextPositions;
        setPositions(nextPositions);

        if (finished) {
          clearInterval(raceIntervalRef.current!);
          raceIntervalRef.current = null;
          handleRaceFinished(winningHorse, choice, amt);
        }
      }, 50);

    } catch (err) {
      alert('Lỗi đặt cược đua ngựa!');
      setIsRacing(false);
    }
  };

  const handleRaceFinished = async (winningHorse: number, choice: number, amt: number) => {
    setIsRacing(false);
    setCommentary(`NGỰA SỐ ${winningHorse} ĐÃ VỀ ĐÍCH ĐẦU TIÊN!`);

    const isWinner = choice === winningHorse;
    const winAmount = amt * 3;

    try {
      if (isWinner) {
        const uSnap = await get(ref(db, `users/${uid}`));
        const freshPP = uSnap.val()?.pp || 0;
        await update(ref(db, `users/${uid}`), { pp: freshPP + winAmount });

        // Log transaction success
        await push(ref(db, 'game_logs'), {
          uid,
          name: user?.name || 'Sinh Viên',
          game: 'Đua Ngựa',
          bet: amt,
          pnl: winAmount - amt,
          result: `Thắng (Chọn Ngựa ${choice} - Thắng ${winningHorse})`,
          time: new Date().toLocaleString('vi-VN'),
          timestamp: Date.now()
        });

        setTimeout(() => {
          onClose();
          onShowResult(
            'THẮNG CƯỢC ĐUA NGỰA !',
            `Ngựa số ${winningHorse} bạn chọn đã về nhất xuất sắc!\nBạn giành chiến thắng x3 tiền cược: +${winAmount.toLocaleString()} PP!`,
            true
          );
        }, 1200);
      } else {
        // Log transaction loss
        await push(ref(db, 'game_logs'), {
          uid,
          name: user?.name || 'Sinh Viên',
          game: 'Đua Ngựa',
          bet: amt,
          pnl: -amt,
          result: `Thua (Chọn Ngựa ${choice} - Thắng ${winningHorse})`,
          time: new Date().toLocaleString('vi-VN'),
          timestamp: Date.now()
        });

        setTimeout(() => {
          onClose();
          onShowResult(
            'THẤT BẠI CƯỢC !',
            `Ngựa số ${winningHorse} đã về nhất.\nLựa chọn của bạn là Ngựa số ${choice} và mất đi -${amt.toLocaleString()} PP cược.`,
            false
          );
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="overlay z-[5000]">
      <div className="glass-box login-panel max-w-[760px] p-6 border-[#d2a679]">
        <button 
          onClick={isRacing ? undefined : onClose} 
          disabled={isRacing}
          className={`absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition ${isRacing ? 'opacity-20 cursor-not-allowed' : ''}`}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#d2a679] text-glow-pink text-2xl font-black font-mono uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
          <Award className="w-5 h-5 text-[#d2a679]" /> TRƯỜNG ĐUA NGỰA HOÀNG GIA
        </h2>
        <p className="text-[10px] font-mono text-[#8b949e] uppercase mb-5">
          Đặt 1 ăn 3 - Lựa chọn chiến mã tài ba S-System
        </p>

        {/* Horse race track stadium */}
        <div className="relative w-full h-[250px] bg-[#2e1f11] border-4 border-white rounded-xl overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.9)] select-none mb-4">
          
          {/* Finish Line checker board */}
          <div className="absolute top-0 bottom-0 right-[15%] w-1.5 bg-[repeating-linear-gradient(to_bottom,#fff_0,#fff_10px,#ff003c_10px,#ff003c_20px)] z-0"></div>

          {/* Horse 1 lane */}
          <div
            style={{ left: `${positions[0]}%` }}
            className="absolute top-[8%] text-3xl transition-[left] duration-[0.05s] z-10 flex items-center font-bold"
          >
            🐎 <span className="text-[9px] bg-white text-black rounded-full w-4 h-4 text-center line-height-4 font-mono font-black border border-black shadow">1</span>
          </div>

          {/* Horse 2 lane */}
          <div
            style={{ left: `${positions[1]}%` }}
            className="absolute top-[32%] text-3xl transition-[left] duration-[0.05s] z-10 flex items-center font-bold"
          >
            🐎 <span className="text-[9px] bg-white text-black rounded-full w-4 h-4 text-center line-height-4 font-mono font-black border border-black shadow">2</span>
          </div>

          {/* Horse 3 lane */}
          <div
            style={{ left: `${positions[2]}%` }}
            className="absolute top-[56%] text-3xl transition-[left] duration-[0.05s] z-10 flex items-center font-bold"
          >
            🐎 <span className="text-[9px] bg-white text-black rounded-full w-4 h-4 text-center line-height-4 font-mono font-black border border-black shadow">3</span>
          </div>

          {/* Horse 4 lane */}
          <div
            style={{ left: `${positions[3]}%` }}
            className="absolute top-[80%] text-3xl transition-[left] duration-[0.05s] z-10 flex items-center font-bold"
          >
            🐎 <span className="text-[9px] bg-white text-black rounded-full w-4 h-4 text-center line-height-4 font-mono font-black border border-black shadow">4</span>
          </div>
        </div>

        {/* Live track commentary box */}
        <div className="bg-black/80 border border-[#d2a679]/40 rounded-lg p-3.5 min-h-[50px] flex items-center justify-center text-center font-mono text-sm leading-relaxed text-slate-100 mb-4 select-none">
          {commentary}
        </div>

        {/* Action Controls */}
        <div className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-[#8b949e] uppercase font-bold tracking-wider mb-1.5">Số lượng PP đặt cược đua ngựa:</label>
            <input
              type="number"
              placeholder="Nhập số PP cược..."
              className="w-full bg-black/60 border border-[#30363d] focus:border-[#d2a679] rounded-lg p-3 text-center text-sm font-black text-[#ffd700] text-glow-gold"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={isRacing}
            />
          </div>

          {!isRacing ? (
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleStartRace(1)}
                className="py-3 bg-zinc-950/20 hover:bg-[#d2a679]/15 border border-[#d2a679] text-[#d2a679] font-bold rounded-lg uppercase cursor-pointer"
              >
                Ngựa 1
              </button>
              <button
                onClick={() => handleStartRace(2)}
                className="py-3 bg-zinc-950/20 hover:bg-[#d2a679]/15 border border-[#d2a679] text-[#d2a679] font-bold rounded-lg uppercase cursor-pointer"
              >
                Ngựa 2
              </button>
              <button
                onClick={() => handleStartRace(3)}
                className="py-3 bg-zinc-950/20 hover:bg-[#d2a679]/15 border border-[#d2a679] text-[#d2a679] font-bold rounded-lg uppercase cursor-pointer"
              >
                Ngựa 3
              </button>
              <button
                onClick={() => handleStartRace(4)}
                className="py-3 bg-zinc-950/20 hover:bg-[#d2a679]/15 border border-[#d2a679] text-[#d2a679] font-bold rounded-lg uppercase cursor-pointer"
              >
                Ngựa 4
              </button>
            </div>
          ) : (
            <button
              disabled
              className="w-full py-3.5 bg-zinc-950/10 border border-[#444] text-[#8b949e] font-black uppercase text-xs tracking-widest cursor-not-allowed"
            >
              🐎 CÁC CHIẾN MÃ ĐANG VỨT TỐC TRÊN ĐƯỜNG ĐUA !
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
