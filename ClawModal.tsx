/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, update, push } from 'firebase/database';
import { db } from '../../firebase';
import { X, Sparkles, HelpCircle } from 'lucide-react';
import { User } from '../../types';

interface ClawModalProps {
  uid: string;
  user: User | null;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface Prize {
  id: string;
  type: string;
  mult: number;
  x: number;
  dir: number;
  speed: number;
}

export default function ClawModal({ uid, user, onClose, onShowResult }: ClawModalProps) {
  const [betAmount, setBetAmount] = useState('');
  const [isClawActive, setIsClawActive] = useState(false);
  const [isClawDropping, setIsClawDropping] = useState(false);
  const [clawMsg, setClawMsg] = useState('Kỳ Lân(x10) | Gấu/Trúc(x3) | Cáo/Cụt(x2)');

  // Crane & Caught positions
  const [craneTop, setCraneTop] = useState(-10);
  const [craneChar, setCraneChar] = useState('🎣');
  const [grabbedType, setGrabbedChar] = useState('');
  const [grabbedVisible, setGrabbedVisible] = useState(false);
  const [grabbedTop, setGrabbedTop] = useState(250);

  // Prizes positions state
  const [prizes, setPrizes] = useState<Prize[]>([
    { id: 'prize-1', type: '🦄', mult: 10, x: 10, dir: 1, speed: 4.5 },
    { id: 'prize-2', type: '🧸', mult: 3, x: 30, dir: -1, speed: 3.5 },
    { id: 'prize-3', type: '🐼', mult: 3, x: 50, dir: 1, speed: 3.8 },
    { id: 'prize-4', type: '🐧', mult: 2, x: 70, dir: -1, speed: 4.2 },
    { id: 'prize-5', type: '🦊', mult: 2, x: 90, dir: 1, speed: 2.8 }
  ]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Run continuous horizontal prizes floating loops (using state to re-draw)
    intervalRef.current = setInterval(() => {
      if (isClawDropping) return;

      setPrizes((prev) =>
        prev.map((p) => {
          let nextX = p.x + p.dir * p.speed;
          let nextDir = p.dir;
          if (nextX >= 90) {
            nextX = 90;
            nextDir = -1;
          } else if (nextX <= 0) {
            nextX = 0;
            nextDir = 1;
          }
          return { ...p, x: nextX, dir: nextDir };
        })
      );
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isClawDropping]);

  const handleClawAction = async () => {
    if (isClawDropping) return;

    const amt = parseInt(betAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Mức cược Gắp Thú không hợp lệ!');
      return;
    }

    if (!isClawActive) {
      const currentPP = user?.pp || 0;
      if (currentPP < amt) {
        alert(`Bạn không có đủ PP để gắp thú! Tài sản: ${currentPP.toLocaleString()} PP.`);
        return;
      }

      // Deduct PP initially
      try {
        await update(ref(db, `users/${uid}`), { pp: currentPP - amt });
        setIsClawActive(true);
        setClawMsg('Canh chuẩn và bấm nút để gắp thả ngàm xuống!');
      } catch (err) {
        alert('Lỗi đặt cược Gắp Thú!');
      }
    } else {
      // Release Claw Drop down !
      setIsClawDropping(true);
      setClawMsg('Đang thả ngàm...');
      setCraneTop(220); // Claw moves down to prize lane

      setTimeout(() => {
        // Evaluate catch diff (checking standard 4% offset near 50% dead center line)
        let hitPrize: Prize | null = null;
        let minDiff = 999;

        prizes.forEach((p) => {
          const diff = Math.abs(p.x - 50);
          if (diff < 4 && diff < minDiff) {
            minDiff = diff;
            hitPrize = p;
          }
        });

        if (hitPrize) {
          // Visual caught styling
          setCraneChar('🤏');
          setGrabbedChar(hitPrize.type);
          setGrabbedVisible(true);
          setGrabbedTop(220);
          setClawMsg('Tuyệt vời! Đã tóm được thú, đang kéo lên...');
          
          // Temporarily hide caught prize from lane list
          const caughtId = hitPrize.id;
          setPrizes((prev) => prev.map((p) => p.id === caughtId ? { ...p, visible: false } as any : p));
        } else {
          setCraneChar('🎣');
          setClawMsg('Hụt mất rồi! Đang thu hồi ngàm gắp...');
        }

        // Pull Crane claw back up to top
        setCraneTop(-10);
        setGrabbedTop(40);

        setTimeout(async () => {
          if (hitPrize) {
            const pWin = amt * hitPrize.mult;
            try {
              const uSnap = await get(ref(db, `users/${uid}`));
              const freshPP = uSnap.val()?.pp || 0;

              // Credit payout
              await update(ref(db, `users/${uid}`), { pp: freshPP + pWin });

              await push(ref(db, 'game_logs'), {
                uid,
                name: user?.name || 'Sinh Viên',
                game: 'Gắp Thú',
                bet: amt,
                pnl: pWin - amt,
                result: `Thắng (Gắp trúng ${hitPrize.type} x${hitPrize.mult})`,
                time: new Date().toLocaleString('vi-VN'),
                timestamp: Date.now()
              });

              // Show caught results
              onShowResult(
                'GẮP TRÚNG THÀNH CÔNG !',
                `Xin chúc mừng! Bạn đã tóm được: ${hitPrize.type}!\nNhận thưởng nhân x${hitPrize.mult} tiền cược: +${pWin.toLocaleString()} PP!`,
                true
              );
            } catch (err) {
              console.error(err);
            }
          } else {
            try {
              await push(ref(db, 'game_logs'), {
                uid,
                name: user?.name || 'Sinh Viên',
                game: 'Gắp Thú',
                bet: amt,
                pnl: -amt,
                result: `Thua (Hụt)`,
                time: new Date().toLocaleString('vi-VN'),
                timestamp: Date.now()
              });

              onShowResult(
                'GẮP HỤT MẤT RỒI !',
                `Mũi ngàm chỉ gắp được không khí...\nBạn bị trừ mất trắng -${amt.toLocaleString()} PP cược.`,
                false
              );
            } catch (err) {
              console.error(err);
            }
          }

          // Restore machine layout
          setIsClawActive(false);
          setIsClawDropping(false);
          setGrabbedVisible(false);
          setGrabbedTop(250);
          setCraneChar('🎣');
          setClawMsg('Kỳ Lân(x10) | Gấu/Trúc(x3) | Cáo/Cụt(x2)');
          
          // Re-enable visibility of all prizes in list
          setPrizes((prev) => prev.map((p) => ({ ...p, visible: true } as any)));
        }, 800);

      }, 800);
    }
  };

  return (
    <div className="overlay z-[5000]">
      <div className="glass-box login-panel max-w-[620px] p-6 border-[#ff69b4] relative">
        <button 
          onClick={isClawDropping ? undefined : onClose} 
          disabled={isClawDropping}
          className={`absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition ${isClawDropping ? 'opacity-20 cursor-not-allowed' : ''}`}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#ff69b4] text-glow-pink text-2xl font-black font-mono uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
          <Sparkles className="w-5 h-5 animate-pulse text-[#ff69b4]" /> MÁY GẮP THÚ VIP (S-88)
        </h2>
        <p className="text-[10px] font-mono text-[#8b949e] uppercase mb-5">
          Canh chuẩn ngàm gắp thả ngay giữa hồng tâm ăn x10
        </p>

        {/* Claw machine visual box */}
        <div className="relative w-full h-[320px] bg-gradient-to-b from-[#1a0b1a] to-[#2a0a2a] border-4 border-[#ff69b4] rounded-2xl overflow-hidden shadow-[inset_0_0_40px_rgba(255,105,180,0.5)] select-none mb-4">
          
          {/* Vertical claw rope thread */}
          <div 
            style={{ top: 0, height: `${Math.max(0, craneTop + 20)}px` }}
            className="absolute left-1/2 -translate-x-1/2 w-1.5 bg-gradient-to-b from-slate-400 to-slate-200 z-10 transition-[height] duration-[0.8s] ease-in-out"
          />

          {/* Crane Hook icon */}
          <div
            style={{ top: `${craneTop}px`, transition: 'top 0.8s' }}
            className="absolute left-1/2 -translate-x-1/2 text-5xl z-10 select-none flex items-center justify-center"
          >
            {craneChar}
          </div>

          {/* Floating Prizes list row */}
          <div className="absolute bottom-[20px] left-0 w-full h-12 text-[38px] z-10 select-none">
            {prizes.map((p) => (
              <span
                key={p.id}
                id={p.id}
                style={{
                  left: `${p.x}%`,
                  display: (p as any).visible !== false ? 'inline-block' : 'none'
                }}
                className="absolute transition-[left] duration-[0.05s] ease-linear leading-none"
              >
                {p.type}
              </span>
            ))}
          </div>

          {/* Visual Caught Prize pulling back up */}
          {grabbedVisible && (
            <div
              style={{ top: `${grabbedTop}px`, transition: 'top 0.8s' }}
              className="absolute left-1/2 -translate-x-1/2 text-[36px] z-20 select-none"
            >
              {grabbedType}
            </div>
          )}
        </div>

        {/* Claw instructions */}
        <div className="bg-black/80 border border-[#ff69b4]/40 rounded-lg p-3 min-h-[50px] flex items-center justify-center text-center font-mono text-xs leading-relaxed text-slate-100 mb-4 select-none">
          {clawMsg}
        </div>

        {/* Action Controls */}
        <div className="space-y-4 font-mono text-xs">
          {!isClawActive && (
            <div>
              <label className="block text-[#8b949e] uppercase font-bold tracking-wider mb-1.5">Số lượng PP đặt cược 1 gắp:</label>
              <input
                type="number"
                placeholder="Nhập số PP cược..."
                className="w-full bg-black/60 border border-[#30363d] focus:border-[#ff69b4] rounded-lg p-3 text-center text-sm font-black text-[#ffd700] text-glow-gold"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={isClawDropping}
              />
            </div>
          )}

          <button
            onClick={handleClawAction}
            disabled={isClawDropping}
            className={`w-full py-3.5 font-extrabold rounded-xl uppercase tracking-widest text-xs transition-all cursor-pointer border ${
              isClawDropping
                ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'
                : isClawActive
                ? 'bg-emerald-950/20 hover:bg-[#00ff80] hover:text-black border-[#00ff80] text-[#00ff80] text-glow-green hover:shadow-[0_0_15px_rgba(0,255,128,0.4)]'
                : 'bg-pink-950/20 hover:bg-[#ff69b4] hover:text-white border-[#ff69b4] text-[#ff69b4] hover:shadow-[0_0_15px_rgba(255,105,180,0.4)]'
            }`}
          >
            {isClawDropping ? (
              <>ĐANG GẮP...</>
            ) : isClawActive ? (
              <>[ 🎯 GẮP XUỐNG NGAY ! ]</>
            ) : (
              <>[ CHƠI GẮP THÚ ]</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
