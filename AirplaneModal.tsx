/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, update, push, onValue } from 'firebase/database';
import { db } from '../../firebase';
import { X, Navigation, Flame, Trophy, Info, Compass } from 'lucide-react';
import { User } from '../../types';

interface AirplaneModalProps {
  uid: string;
  user: User | null;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface ActiveBet {
  roundId: number;
  amount: number;
  status: 'PLAYING' | 'CASHED_OUT' | 'CRASHED';
  multiplier?: number;
}

// 32-bit PRNG generator based on a seed number
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Multiplier growth formula based on flight time elapsed (seconds)
const getMultiplierAtTime = (timeS: number) => {
  if (timeS <= 0) return 1.00;
  // Dynamic climbing curve: 1.00 + 0.08x + 0.015x^2
  return 1.00 + 0.08 * timeS + 0.015 * Math.pow(timeS, 2);
};

// Deterministic crash point selector for roundId
const getCrashPointForRound = (rId: number) => {
  const randFunc = mulberry32(rId * 1234567);
  const r = randFunc();
  // Formula: most crash points are close to 1-2x, rare high multi limits
  let point = 100 / (r * 100 + 1);
  point = Math.max(1.00, Math.min(15.00, point)); // capped at 15x for the 30s cycle
  if (randFunc() < 0.05) {
    point = 1.00; // 5% chance of instant blowup at takeoff
  }
  return parseFloat(point.toFixed(2));
};

export default function AirplaneModal({ uid, user, onClose, onShowResult }: AirplaneModalProps) {
  const [betAmount, setBetAmount] = useState('');
  const [cycleTime, setCycleTime] = useState(0);
  const [currentRoundId, setCurrentRoundId] = useState(0);
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  // Sync server time offset
  useEffect(() => {
    const offsetRef = ref(db, '.info/serverTimeOffset');
    const unsub = onValue(offsetRef, (snap) => {
      if (snap.exists()) {
        setServerTimeOffset(snap.val());
      }
    });
    return () => unsub();
  }, []);

  // Synchronized Clock Ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() + serverTimeOffset;
      const cTime = now % 30000; // 30-second loop
      const rId = Math.floor(now / 30000); // Unique round index
      setCycleTime(cTime);
      setCurrentRoundId(rId);
    }, 50);
    return () => clearInterval(interval);
  }, [serverTimeOffset]);

  // Sync current user's active bet state
  useEffect(() => {
    if (!uid) return;
    const betRef = ref(db, `users/${uid}/crash_game`);
    const unsub = onValue(betRef, (snap) => {
      if (snap.exists()) {
        setActiveBet(snap.val());
      } else {
        setActiveBet(null);
      }
    });
    return () => unsub();
  }, [uid]);

  const isBettingPhase = cycleTime < 5000;
  const bettingTimeLeft = Math.ceil((5000 - cycleTime) / 1000);
  const flightTimeS = isBettingPhase ? 0 : (cycleTime - 5000) / 1000;

  const crashPoint = getCrashPointForRound(currentRoundId);
  const rawMultiplier = getMultiplierAtTime(flightTimeS);
  const hasCrashed = rawMultiplier >= crashPoint;
  const currentMultiplier = hasCrashed ? crashPoint : rawMultiplier;

  const hasBetThisRound = activeBet && activeBet.roundId === currentRoundId;

  // Auto-resolve pending previous round bets that were left in 'PLAYING' state
  useEffect(() => {
    if (activeBet && activeBet.roundId < currentRoundId && activeBet.status === 'PLAYING') {
      const oldRoundId = activeBet.roundId;
      const oldAmount = activeBet.amount;
      const oldCrashPoint = getCrashPointForRound(oldRoundId);
      
      // Update DB
      update(ref(db, `users/${uid}/crash_game`), { status: 'CRASHED' });
      
      // Log loss
      push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Crash',
        bet: oldAmount,
        pnl: -oldAmount,
        result: `Nổ ở x${oldCrashPoint.toFixed(2)} (Thua - Vòng cũ)`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });
    }
  }, [activeBet, currentRoundId, uid]);

  // Auto-resolve crash logic if player was still flying
  useEffect(() => {
    if (hasCrashed && hasBetThisRound && activeBet.status === 'PLAYING') {
      // Mark as CRASHED in database
      update(ref(db, `users/${uid}/crash_game`), { status: 'CRASHED' });

      // Log transaction/play loss
      push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Crash',
        bet: activeBet.amount,
        pnl: -activeBet.amount,
        result: `Nổ ở x${crashPoint.toFixed(2)} (Thua)`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      onShowResult(
        'MÁY BAY BỊ TIÊU DIỆT !',
        `Phi thuyền S88 đã phát nổ ở x${crashPoint.toFixed(2)}!\nBạn đã bị trễ nhịp nhảy dù và mất trắng -${activeBet.amount.toLocaleString()} PP cược.`,
        false
      );
    }
  }, [hasCrashed, hasBetThisRound, activeBet?.status]);

  // Handle Placing bet during Betting Phase
  const handlePlaceBet = async () => {
    if (isProcessing) return;
    if (!isBettingPhase) {
      alert('Đã hết thời gian đặt cược! Vui lòng chờ vòng sau.');
      return;
    }
    if (hasBetThisRound) {
      alert('Bạn đã đặt cược cho vòng này rồi!');
      return;
    }

    const amt = parseInt(betAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Số tiền đặt cược không hợp lệ!');
      return;
    }

    setIsProcessing(true);
    try {
      const uSnap = await get(ref(db, `users/${uid}`));
      if (!uSnap.exists()) {
        alert('Tài khoản không khả dụng!');
        setIsProcessing(false);
        return;
      }

      const currentPP = uSnap.val().pp || 0;
      if (currentPP < amt) {
        alert(`Số dư PP không đủ để cất cánh! Hiện có: ${currentPP.toLocaleString()} PP.`);
        setIsProcessing(false);
        return;
      }

      // Deduct PP & Record active bet structure
      await update(ref(db, `users/${uid}`), {
        pp: currentPP - amt,
        crash_game: {
          roundId: currentRoundId,
          amount: amt,
          status: 'PLAYING'
        }
      });

      // Award Daily Missions progress
      try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const mRef = ref(db, `users/${uid}/daily_missions/${todayStr}`);
        const mSnap = await get(mRef);
        let currentRides = 0;
        if (mSnap.exists() && typeof mSnap.val() === 'object' && mSnap.val() !== null) {
          currentRides = mSnap.val().crashRides || 0;
        }
        await update(mRef, { crashRides: currentRides + 1 });
      } catch (mErr) {
        console.warn('Daily mission update error in Crash, bypassed:', mErr);
      }

      // Increase Battle Pass XP
      try {
        const freshSnap = await get(ref(db, `users/${uid}`));
        if (freshSnap.exists()) {
          const uVal = freshSnap.val();
          const currentXP = uVal.xp || 0;
          const currentLevel = uVal.level || 1;
          const newXP = currentXP + 25; // Gain 25 XP
          const nextLevelXP = currentLevel * 100;
          if (newXP >= nextLevelXP) {
            await update(ref(db, `users/${uid}`), {
              xp: newXP - nextLevelXP,
              level: currentLevel + 1
            });
          } else {
            await update(ref(db, `users/${uid}`), { xp: newXP });
          }
        }
      } catch (xpErr) {
        console.warn('XP update error in Crash, bypassed:', xpErr);
      }

      setBetAmount('');
    } catch (err) {
      alert('Lỗi đặt cược!');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Jumping Out (Cash Out) during flight
  const handleCashOut = async () => {
    if (isProcessing) return;
    if (!hasBetThisRound || activeBet.status !== 'PLAYING' || hasCrashed) return;

    setIsProcessing(true);
    const winAmount = Math.floor(activeBet.amount * currentMultiplier);

    try {
      const uSnap = await get(ref(db, `users/${uid}`));
      const freshPP = uSnap.val()?.pp || 0;

      // Credit winnings and finalize bet state
      await update(ref(db, `users/${uid}`), {
        pp: freshPP + winAmount,
        'crash_game/status': 'CASHED_OUT',
        'crash_game/multiplier': currentMultiplier
      });

      // Write logs
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Crash',
        bet: activeBet.amount,
        pnl: winAmount - activeBet.amount,
        result: `Nhảy dù chốt x${currentMultiplier.toFixed(2)} (Thắng)`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      onShowResult(
        'NHẢY DÙ THÀNH CÔNG !',
        `Chúc mừng chiến hữu! Bạn đã nhảy dù thoát hiểm an toàn ở mốc x${currentMultiplier.toFixed(2)}!\nĐã chốt lợi nhuận khổng lồ: +${winAmount.toLocaleString()} PP!`,
        true
      );
    } catch (err) {
      alert('Giao dịch nhảy dù lỗi. Hãy thử lại!');
    } finally {
      setIsProcessing(false);
    }
  };

  // Deterministic plane visual positions
  let posL = 10;
  let posB = 15;
  if (!isBettingPhase && !hasCrashed) {
    posL = Math.min(80, 10 + flightTimeS * 3.5);
    posB = Math.min(80, 15 + flightTimeS * 2.8);
  } else if (hasCrashed) {
    // Lock animation at moment of explosion
    const crashTimeS = Math.max(0, (crashPoint - 1.00) / 0.12);
    posL = Math.min(80, 10 + crashTimeS * 3.5);
    posB = Math.min(80, 15 + crashTimeS * 2.8);
  }

  return (
    <div className="overlay z-[5000]">
      <div className="glass-box login-panel max-w-[620px] p-6 border-[#00f0ff] relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#00f0ff] text-glow-blue text-2xl font-black font-mono uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
          <Navigation className="w-5 h-5 animate-pulse" /> KHÔNG CHIẾN S88
        </h2>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-[10px] font-mono text-[#8b949e] uppercase">
            MÁY BAY ĐỒNG BỘ ROUND ID: #{currentRoundId}
          </span>
          <span className="text-[9px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 py-0.5 px-1.5 rounded uppercase font-bold font-mono">
            SYNC CHỐNG HACK
          </span>
        </div>

        {/* Dynamic sky arena canvas representation */}
        <div className="relative w-full h-[260px] bg-gradient-to-b from-[#000411] to-[#0a0a2a] border-2 border-[#00f0ff] rounded-xl overflow-hidden shadow-inner select-none mb-4">
          
          {/* Synchronized Multiplier display */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black tracking-widest font-mono z-0 transition-colors ${
            hasCrashed ? 'text-[#ff003c]/20' : isBettingPhase ? 'text-white/5' : 'text-cyan-400/20'
          }`}>
            {isBettingPhase ? `BETTING` : `X${currentMultiplier.toFixed(2)}`}
          </div>

          {/* Time/Status Overlay */}
          <div className="absolute top-3 left-3 z-30 font-mono text-[9px] text-slate-400 uppercase flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Trạng thái: {isBettingPhase ? 'Nhận Cược' : hasCrashed ? 'Đã Phát Nổ' : 'Đang Bay'}</span>
            </div>
            {!isBettingPhase && (
              <span className="text-red-400 font-bold">Điểm Nổ Bí Ẩn: ❓.❓❓X</span>
            )}
          </div>

          {/* Runway/Hangar visual decoration */}
          <div className="absolute bottom-0 left-0 w-24 h-10 bg-zinc-900 border-r-2 border-t-2 border-zinc-700 rounded-tr-lg z-10 shadow-lg flex items-center justify-center text-[8px] text-zinc-500 font-mono font-black">
            S88-HANGAR
          </div>

          {/* Flying Rocket representation */}
          {!isBettingPhase && !hasCrashed && (
            <div
              style={{
                left: `${posL}%`,
                bottom: `${posB}%`,
                transform: 'translate(-50%, 50%)',
              }}
              className="absolute z-20 text-[#00f0ff] text-glow-blue drop-shadow-[0_8px_12px_rgba(0,240,255,0.6)] flex items-center gap-1 select-none transition-all duration-100"
            >
              <Flame className="w-5 h-5 text-orange-500 animate-bounce shrink-0 rotate-90" />
              <div className="text-[28px] animate-pulse">🚀</div>
            </div>
          )}

          {/* Explosion display */}
          {!isBettingPhase && hasCrashed && (
            <div
              style={{
                left: `${posL}%`,
                bottom: `${posB}%`,
                transform: 'translate(-50%, 50%) scale(2.0)',
              }}
              className="absolute z-20 text-glow-red text-4xl animate-ping filter select-none"
            >
              💥
            </div>
          )}

          {/* Betting Phase Countdown overlay */}
          {isBettingPhase && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 font-mono text-center px-4">
              <Trophy className="w-8 h-8 text-[#ffd700] mb-2 animate-bounce" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest">THỜI GIAN NHẬN ĐẶT CƯỢC</span>
              <span className="text-glow-gold text-[#ffd700] text-3xl font-black mt-1">CÒN {bettingTimeLeft} GIÂY</span>
              <p className="text-[8px] text-slate-500 max-w-xs mt-1.5 uppercase leading-relaxed font-sans">
                Tất cả người chơi trong phòng sẽ bay cùng phi thuyền, nhận chung số nhân. Càng bay cao, tiền thưởng nhân lên càng khủng!
              </p>
            </div>
          )}
        </div>

        {/* Action controls logic */}
        {isBettingPhase ? (
          <div className="space-y-3 font-mono text-xs">
            <div>
              <label className="block text-[#8b949e] uppercase font-bold tracking-wider mb-1.5">Số lượng PP đặt cược cất cánh:</label>
              <input
                type="number"
                disabled={hasBetThisRound || isProcessing}
                placeholder={hasBetThisRound ? `ĐÃ ĐẶT CƯỢC ${activeBet.amount.toLocaleString()} PP` : "Nhập số PP cược..."}
                className="w-full bg-black/60 border border-[#30363d] focus:border-[#00f0ff] rounded-lg p-3 text-center text-sm font-black text-[#ffd700] text-glow-gold font-mono disabled:opacity-50"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
              />
            </div>

            <button
              onClick={handlePlaceBet}
              disabled={hasBetThisRound || isProcessing}
              className={`w-full py-3.5 border text-xs font-black uppercase tracking-widest cursor-pointer rounded-xl transition-all ${
                hasBetThisRound 
                  ? 'bg-emerald-950/20 border-emerald-500 text-emerald-400' 
                  : 'bg-cyan-950/20 hover:bg-[#00f0ff] border-[#00f0ff] text-[#00f0ff] hover:text-black'
              }`}
            >
              {hasBetThisRound ? '[ ĐÃ ĐỒNG BỘ CƯỢC THÀNH CÔNG ]' : '[ XÁC NHẬN CẤT CÁNH PHI THUYỀN ]'}
            </button>
          </div>
        ) : (
          <div className="font-mono">
            {hasBetThisRound && activeBet.status === 'PLAYING' && !hasCrashed ? (
              <button
                onClick={handleCashOut}
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-950/20 border-2 border-dashed border-[#00ff80] text-[#00ff80] text-glow-green hover:bg-[#00ff80]/10 font-black uppercase tracking-widest text-sm rounded-xl cursor-pointer transition-all active:scale-95 animate-pulse"
              >
                [ 🪂 NHẢY DÙ CHỐT LỜI (ĂN X{currentMultiplier.toFixed(2)}) ]
              </button>
            ) : hasBetThisRound && activeBet.status === 'CASHED_OUT' ? (
              <button
                disabled
                className="w-full py-4 bg-emerald-950/10 border border-[#00ff80] text-[#00ff80] text-glow-green font-black uppercase tracking-widest text-sm rounded-xl cursor-not-allowed"
              >
                🎉 ĐÃ NHẢY DÙ AN TOÀN! CHỐT X{activeBet.multiplier?.toFixed(2) || currentMultiplier.toFixed(2)}
              </button>
            ) : hasBetThisRound && activeBet.status === 'CRASHED' ? (
              <button
                disabled
                className="w-full py-4 bg-red-950/10 border border-[#ff003c] text-[#ff003c] text-glow-red font-black uppercase tracking-widest text-sm rounded-xl cursor-not-allowed"
              >
                💥 PHI THUYỀN ĐÃ NỔ! TỔN THẤT TOÀN BỘ
              </button>
            ) : (
              <div className="text-center p-4 bg-white/5 rounded-xl border border-white/5 font-sans text-xs text-slate-400 uppercase leading-relaxed flex items-center justify-center gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Phi thuyền đang bay! Hãy chờ vòng cược tiếp theo kết thúc để tham gia.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
