/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ref, get, update, onValue } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { CheckCircle2, Calendar, Target, Award, Sparkles, Flame, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

interface DailyMissionsProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface MissionState {
  checkInClaimed: boolean;
  taiXiuWins: number;
  taiXiuWinsClaimed: boolean;
  crashRides: number;
  crashRidesClaimed: boolean;
}

export default function DailyMissions({ uid, user, onShowResult }: DailyMissionsProps) {
  const [missions, setMissions] = useState<MissionState>({
    checkInClaimed: false,
    taiXiuWins: 0,
    taiXiuWinsClaimed: false,
    crashRides: 0,
    crashRidesClaimed: false
  });

  const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

  useEffect(() => {
    if (!uid) return;
    const missionRef = ref(db, `users/${uid}/daily_missions/${todayStr}`);
    const unsub = onValue(missionRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setMissions({
          checkInClaimed: val.checkInClaimed || false,
          taiXiuWins: val.taiXiuWins || 0,
          taiXiuWinsClaimed: val.taiXiuWinsClaimed || false,
          crashRides: val.crashRides || 0,
          crashRidesClaimed: val.crashRidesClaimed || false
        });
      } else {
        // Initialize fresh missions for today
        update(missionRef, {
          checkInClaimed: false,
          taiXiuWins: 0,
          taiXiuWinsClaimed: false,
          crashRides: 0,
          crashRidesClaimed: false
        });
      }
    });

    return () => unsub();
  }, [uid, todayStr]);

  // Compute total progress
  const totalMissions = 3;
  let completedCount = 0;
  if (missions.checkInClaimed) completedCount++;
  if (missions.taiXiuWins >= 3) completedCount++;
  if (missions.crashRides >= 2) completedCount++;

  const progressPercentage = Math.round((completedCount / totalMissions) * 100);

  // SVG progress ring math
  const radius = 38;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  const handleClaimCheckIn = async () => {
    if (missions.checkInClaimed) return;
    try {
      const uSnap = await get(ref(db, `users/${uid}`));
      const currentPP = uSnap.val()?.pp || 0;

      await update(ref(db, `users/${uid}`), { pp: currentPP + 500 });
      await update(ref(db, `users/${uid}/daily_missions/${todayStr}`), { checkInClaimed: true });

      // Safe update of Battle Pass XP (+50 XP for daily mission!)
      try {
        const currentXP = uSnap.val()?.xp || 0;
        const currentLevel = uSnap.val()?.level || 1;
        const newXP = currentXP + 50;
        const nextLevelXP = currentLevel * 100;
        if (newXP >= nextLevelXP) {
          await update(ref(db, `users/${uid}`), {
            xp: newXP - nextLevelXP,
            level: currentLevel + 1
          });
        } else {
          await update(ref(db, `users/${uid}`), { xp: newXP });
        }
      } catch (xpErr) {
        console.warn('XP update error, bypassed:', xpErr);
      }

      onShowResult(
        'ĐIỂM DANH THÀNH CÔNG 🎁',
        'Chúc mừng sếp nhận được quà điểm danh hàng ngày trị giá +500 PP và nhận thêm +50 XP Battle Pass!',
        true
      );
    } catch (err) {
      alert('Không thể nhận quà điểm danh. Vui lòng thử lại!');
    }
  };

  const handleClaimTaiXiu = async () => {
    if (missions.taiXiuWins < 3 || missions.taiXiuWinsClaimed) return;
    try {
      const uSnap = await get(ref(db, `users/${uid}`));
      const currentPP = uSnap.val()?.pp || 0;

      await update(ref(db, `users/${uid}`), { pp: currentPP + 1000 });
      await update(ref(db, `users/${uid}/daily_missions/${todayStr}`), { taiXiuWinsClaimed: true });

      // Safe update of Battle Pass XP (+50 XP for daily mission!)
      try {
        const currentXP = uSnap.val()?.xp || 0;
        const currentLevel = uSnap.val()?.level || 1;
        const newXP = currentXP + 50;
        const nextLevelXP = currentLevel * 100;
        if (newXP >= nextLevelXP) {
          await update(ref(db, `users/${uid}`), {
            xp: newXP - nextLevelXP,
            level: currentLevel + 1
          });
        } else {
          await update(ref(db, `users/${uid}`), { xp: newXP });
        }
      } catch (xpErr) {
        console.warn('XP update error, bypassed:', xpErr);
      }

      onShowResult(
        'NHẬN THƯỞNG NHIỆM VỤ 🏆',
        'Sếp đã hoàn thành nhiệm vụ "Thắng 3 ván Tài Xỉu" và nhận được +1,000 PP & +50 XP Battle Pass!',
        true
      );
    } catch (err) {
      alert('Gặp lỗi khi nhận thưởng. Vui lòng thử lại!');
    }
  };

  const handleClaimCrash = async () => {
    if (missions.crashRides < 2 || missions.crashRidesClaimed) return;
    try {
      const uSnap = await get(ref(db, `users/${uid}`));
      const currentPP = uSnap.val()?.pp || 0;

      await update(ref(db, `users/${uid}`), { pp: currentPP + 800 });
      await update(ref(db, `users/${uid}/daily_missions/${todayStr}`), { crashRidesClaimed: true });

      // Safe update of Battle Pass XP (+50 XP for daily mission!)
      try {
        const currentXP = uSnap.val()?.xp || 0;
        const currentLevel = uSnap.val()?.level || 1;
        const newXP = currentXP + 50;
        const nextLevelXP = currentLevel * 100;
        if (newXP >= nextLevelXP) {
          await update(ref(db, `users/${uid}`), {
            xp: newXP - nextLevelXP,
            level: currentLevel + 1
          });
        } else {
          await update(ref(db, `users/${uid}`), { xp: newXP });
        }
      } catch (xpErr) {
        console.warn('XP update error, bypassed:', xpErr);
      }

      onShowResult(
        'NHẬN THƯỞNG NHIỆM VỤ 🚀',
        'Sếp đã hoàn thành nhiệm vụ "Cất cánh 2 lần Phi Thuyền" và nhận được +800 PP & +50 XP Battle Pass!',
        true
      );
    } catch (err) {
      alert('Gặp lỗi khi nhận thưởng. Vui lòng thử lại!');
    }
  };

  return (
    <div className="glass-box p-5 border-white/5 relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Circle Progress Ring */}
      <div className="relative flex-shrink-0 flex flex-col items-center justify-center">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90"
        >
          <circle
            stroke="rgba(255,255,255,0.04)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <motion.circle
            stroke="#00ff80"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-white font-mono text-sm font-black text-glow-green">
            {progressPercentage}%
          </span>
          <span className="text-[7px] text-[#8b949e] uppercase font-mono tracking-wider font-bold">
            TIẾN ĐỘ
          </span>
        </div>
      </div>

      {/* Content description & Missions list */}
      <div className="flex-1 w-full space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
          <div>
            <h4 className="text-white font-black text-xs font-mono tracking-wider uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#00ff80] animate-spin" /> NHIỆM VỤ HÀNG NGÀY
            </h4>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Hoàn thành các mốc chơi để tích lũy PP miễn phí cực đã!</p>
          </div>
          <span className="text-[9px] font-mono text-[#00ff80] bg-emerald-500/10 border border-[#00ff80]/30 py-0.5 px-2 rounded-full self-start sm:self-center font-bold">
            FREETOPLAY // {completedCount}/{totalMissions} XONG
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Mission 1 */}
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col justify-between gap-3 relative hover:border-[#00ff80]/20 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div>
                  <span className="block text-[10px] text-white font-bold leading-none">Báo danh học đường</span>
                  <span className="text-[8px] text-slate-500 font-mono">Điểm danh nhận ngay PP</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold text-yellow-400 flex-shrink-0">+500 PP</span>
            </div>
            
            {missions.checkInClaimed ? (
              <div className="py-1 px-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-mono text-[9px] font-bold text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ĐÃ NHẬN
              </div>
            ) : (
              <button
                onClick={handleClaimCheckIn}
                className="w-full py-1 bg-cyan-950/20 border border-cyan-500 hover:bg-cyan-500 hover:text-black text-cyan-400 font-mono text-[9px] font-bold rounded-lg uppercase cursor-pointer transition-all"
              >
                ĐIỂM DANH NGAY
              </button>
            )}
          </div>

          {/* Mission 2 */}
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col justify-between gap-3 relative hover:border-[#00ff80]/20 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0 animate-pulse" />
                <div>
                  <span className="block text-[10px] text-white font-bold leading-none">Thắng 3 Ván Tài Xỉu</span>
                  <span className="text-[8px] text-slate-500 font-mono">Chơi đơn máy hoặc sòng live</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold text-yellow-400 flex-shrink-0">+1K PP</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-yellow-400 h-full rounded-full" 
                  style={{ width: `${Math.min((missions.taiXiuWins / 3) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-slate-400">{Math.min(missions.taiXiuWins, 3)}/3</span>
            </div>
            
            {missions.taiXiuWinsClaimed ? (
              <div className="py-1 px-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-mono text-[9px] font-bold text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ĐÃ NHẬN
              </div>
            ) : missions.taiXiuWins >= 3 ? (
              <button
                onClick={handleClaimTaiXiu}
                className="w-full py-1 bg-yellow-950/20 border border-yellow-500 hover:bg-yellow-500 hover:text-black text-yellow-400 font-mono text-[9px] font-bold rounded-lg uppercase cursor-pointer transition-all"
              >
                NHẬN 1,000 PP
              </button>
            ) : (
              <div className="py-1 px-2.5 bg-white/5 border border-white/5 rounded-lg text-slate-500 font-mono text-[9px] font-bold text-center">
                CHƯA HOÀN THÀNH
              </div>
            )}
          </div>

          {/* Mission 3 */}
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col justify-between gap-3 relative hover:border-[#00ff80]/20 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div>
                  <span className="block text-[10px] text-white font-bold leading-none">Cất Cánh Phi Thuyền</span>
                  <span className="text-[8px] text-slate-500 font-mono">Đặt cược phi thuyền 2 lần</span>
                </div>
              </div>
              <span className="text-[9px] font-mono font-bold text-yellow-400 flex-shrink-0">+800 PP</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-red-400 h-full rounded-full" 
                  style={{ width: `${Math.min((missions.crashRides / 2) * 100, 100)}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-slate-400">{Math.min(missions.crashRides, 2)}/2</span>
            </div>
            
            {missions.crashRidesClaimed ? (
              <div className="py-1 px-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-mono text-[9px] font-bold text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ĐÃ NHẬN
              </div>
            ) : missions.crashRides >= 2 ? (
              <button
                onClick={handleClaimCrash}
                className="w-full py-1 bg-red-950/20 border border-red-500 hover:bg-red-500 hover:text-black text-red-400 font-mono text-[9px] font-bold rounded-lg uppercase cursor-pointer transition-all"
              >
                NHẬN 800 PP
              </button>
            ) : (
              <div className="py-1 px-2.5 bg-white/5 border border-white/5 rounded-lg text-slate-500 font-mono text-[9px] font-bold text-center">
                CHƯA HOÀN THÀNH
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
