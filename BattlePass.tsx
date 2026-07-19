/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ref, get, update, onValue } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { Trophy, Shield, Sparkles, CheckCircle, Lock, Crown, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface BattlePassProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface Tier {
  id: string;
  name: string;
  levelRequired: number;
  standardReward: {
    label: string;
    value: number; // PP reward amount
    frame?: string; // Unlock avatar frame if any
  };
  premiumReward: {
    label: string;
    value: number; // PP reward amount
    frame?: string; // Unlock avatar frame if any
  };
}

const BATTLE_PASS_TIERS: Tier[] = [
  {
    id: 'tier_1',
    name: 'CẤP ĐỘ 1 - TÂN BINH',
    levelRequired: 1,
    standardReward: { label: '+200 PP', value: 200 },
    premiumReward: { label: '👑 +1,500 PP', value: 1500 }
  },
  {
    id: 'tier_2',
    name: 'CẤP ĐỘ 2 - CHUYÊN CẦN',
    levelRequired: 2,
    standardReward: { label: '🖼️ Khung Vàng Lấp Lánh', value: 300, frame: 'gold-ring' },
    premiumReward: { label: '👑 +3,000 PP', value: 3000 }
  },
  {
    id: 'tier_3',
    name: 'CẤP ĐỘ 3 - TRI THỨC',
    levelRequired: 3,
    standardReward: { label: '+500 PP', value: 500 },
    premiumReward: { label: '👑 🖼️ Khung Neon Đỏ Rực', value: 5000, frame: 'neon-ring' }
  },
  {
    id: 'tier_4',
    name: 'CẤP ĐỘ 4 - ĐỘT PHÁ',
    levelRequired: 4,
    standardReward: { label: '+1,000 PP', value: 1000 },
    premiumReward: { label: '👑 +7,500 PP', value: 7500 }
  },
  {
    id: 'tier_5',
    name: 'CẤP ĐỘ 5 - THẦN ĐỒNG S88',
    levelRequired: 5,
    standardReward: { label: '🎓 +2,000 PP', value: 2000 },
    premiumReward: { label: '👑 🖼️ Siêu Khung Cyber Xanh', value: 15000, frame: 'cyber-ring' }
  }
];

export default function BattlePass({ uid, user, onShowResult }: BattlePassProps) {
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);

  // Dynamic configurations state
  const [tiers, setTiers] = useState<Tier[]>(BATTLE_PASS_TIERS);
  const [premiumCost, setPremiumCost] = useState(5000);
  const [resetTime, setResetTime] = useState('2026-08-31T23:59:59');
  const [timeLeft, setTimeLeft] = useState('0 ngày 00:00:00');

  // Load configuration from database
  useEffect(() => {
    const bpConfigRef = ref(db, 'settings/battlepass');
    get(bpConfigRef).then((snap) => {
      if (snap.exists()) {
        const val = snap.val();
        if (val.price !== undefined) setPremiumCost(val.price);
        if (val.reset_time) setResetTime(val.reset_time);
        if (val.tiers) setTiers(val.tiers);
      }
    });
  }, []);

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(resetTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('ĐĂNG KÝ ĐÃ HẾT HẠN');
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${days}N ${hours < 10 ? '0' + hours : hours}:${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [resetTime]);

  // Sync real-time Battle Pass status
  useEffect(() => {
    if (!uid) return;
    const userRef = ref(db, `users/${uid}`);
    const unsub = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setLevel(val.level || 1);
        setXp(val.xp || 0);
        setIsPremium(val.isPremiumBattlePass || false);
        setClaimedRewards(val.battlePassRewardsClaimed || {});
      }
    });
    return () => unsub();
  }, [uid]);

  const nextLevelXP = level * 100;
  const progressPercent = Math.min(100, Math.round((xp / nextLevelXP) * 100));

  const handleBuyPremium = async () => {
    if (isPremium) return;
    if (loading) return;

    setLoading(true);
    try {
      // Fetch ultra-fresh PP balance directly from Database to avoid stale client-side props
      const uSnap = await get(ref(db, `users/${uid}`));
      if (!uSnap.exists()) {
        onShowResult('THẤT BẠI ❌', 'Tài khoản không khả dụng!', false);
        setLoading(false);
        return;
      }
      const freshUser = uSnap.val();
      const currentPP = freshUser.pp || 0;

      if (currentPP < premiumCost) {
        onShowResult(
          'SỐ DƯ KHÔNG ĐỦ ❌',
          `Kích hoạt S-Pass Premium cần ${premiumCost.toLocaleString()} PP. Hiện tại bạn chỉ có ${currentPP.toLocaleString()} PP. Hãy tích lũy thêm!`,
          false
        );
        setLoading(false);
        return;
      }

      await update(ref(db, `users/${uid}`), {
        pp: currentPP - premiumCost,
        isPremiumBattlePass: true
      });

      onShowResult(
        'KÍCH HOẠT S-PASS THÀNH CÔNG 🎉',
        'Chúc mừng chiến thần! Bạn đã chính thức nâng cấp lên PREMIUM BATTLE PASS. Hãy nhận ngay các phần quà VIP!',
        true
      );
    } catch (err) {
      onShowResult('THẤT BẠI ❌', 'Gặp lỗi khi giao dịch S-Pass. Vui lòng thử lại!', false);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimReward = async (tierId: string, type: 'standard' | 'premium') => {
    if (loading) return;
    const tier = tiers.find(t => t.id === tierId);
    if (!tier) return;

    if (level < tier.levelRequired) {
      onShowResult(
        'CHƯA ĐỦ ĐIỀU KIỆN 🔒',
        `Bạn cần đạt Cấp độ ${tier.levelRequired} để mở khóa phần thưởng này!`,
        false
      );
      return;
    }

    if (type === 'premium' && !isPremium) {
      onShowResult(
        'YÊU CẦU PREMIUM 👑',
        'Vui lòng kích hoạt S-Pass Premium để nhận phần thưởng VIP này!',
        false
      );
      return;
    }

    const claimKey = `${tierId}_${type}`;
    if (claimedRewards[claimKey]) {
      onShowResult(
        'ĐÃ HOÀN THÀNH ✓',
        'Bạn đã nhận phần thưởng này rồi!',
        false
      );
      return;
    }

    setLoading(true);
    try {
      const rewardDetail = type === 'standard' ? tier.standardReward : tier.premiumReward;
      const uSnap = await get(ref(db, `users/${uid}`));
      const freshPP = uSnap.val()?.pp || 0;

      const updates: any = {};
      updates[`users/${uid}/pp`] = freshPP + rewardDetail.value;
      updates[`users/${uid}/battlePassRewardsClaimed/${claimKey}`] = true;

      if (rewardDetail.frame) {
        updates[`users/${uid}/activeFrame`] = rewardDetail.frame;
      }

      await update(ref(db), updates);

      onShowResult(
        'NHẬN QUÀ BATTLE PASS 🎁',
        `Nhận thành công phần thưởng ${rewardDetail.label}! ${rewardDetail.frame ? '\nĐã tự động trang bị khung ảnh đại diện mới!' : ''}`,
        true
      );
    } catch (err) {
      onShowResult('THẤT BẠI ❌', 'Gặp lỗi khi nhận phần quà. Vui lòng thử lại!', false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="battle-pass-section" className="glass-box p-6 border-amber-500/30 bg-amber-950/5 relative overflow-hidden font-mono text-xs">
      {/* Glow Backdrops */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-6 border-b border-[#30363d] gap-4">
        <div>
          <h3 className="text-sm tracking-widest uppercase flex items-center gap-2 text-glow-gold text-[#ffd700] font-black">
            <Trophy className="w-5 h-5 text-[#ffd700] animate-bounce" /> S88 BATTLE PASS // S-SEASON 1
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <p className="text-[10px] text-slate-400 uppercase">Tích lũy XP từ điểm danh, làm nhiệm vụ và chiến đấu đỉnh cao</p>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 border border-white/5 text-[9px] text-slate-300 font-bold">
              <span>Hạn reset:</span>
              <span className="text-amber-400 font-black animate-pulse">{timeLeft}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isPremium ? (
            <span className="text-[10px] bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-[0_0_15px_rgba(255,215,0,0.4)] uppercase">
              <Crown className="w-3.5 h-3.5 animate-pulse" /> PREMIUM PASS ACTIVE
            </span>
          ) : (
            <button
              onClick={handleBuyPremium}
              disabled={loading}
              className="py-1.5 px-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black uppercase text-[10px] tracking-wider rounded-lg cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,191,0,0.3)] shrink-0"
            >
              <Crown className="w-3.5 h-3.5" /> [ MỞ RỘNG PREMIUM - {premiumCost.toLocaleString()} PP ]
            </button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="bg-black/40 border border-white/5 p-4 rounded-xl mb-6 flex flex-col md:flex-row items-center gap-5 justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 bg-[#ffd700]/10 border-2 border-[#ffd700] text-[#ffd700] rounded-xl flex flex-col items-center justify-center font-black text-center shrink-0">
            <span className="text-[9px] uppercase tracking-tighter text-white/50 leading-none">LV</span>
            <span className="text-base leading-none text-glow-gold">{level}</span>
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Tiến độ mùa giải</span>
              <span className="text-[#ffd700] font-bold">{xp} / {nextLevelXP} XP</span>
            </div>
            {/* Real Progress Bar */}
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/5">
              <div 
                className="bg-gradient-to-r from-[#ffd700] to-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="text-right md:border-l border-[#30363d] md:pl-5 w-full md:w-auto text-[10px] text-slate-400 leading-relaxed font-sans">
          Mỗi ván chơi game bất kỳ tăng <span className="text-emerald-400 font-bold font-mono">+25 XP</span>.<br />
          Hoàn thành nhiệm vụ tăng thêm <span className="text-emerald-400 font-bold font-mono">+50 XP</span>.
        </div>
      </div>

      {/* Tier Row Cards */}
      <h4 className="text-[10px] tracking-widest text-[#ffd700] font-black uppercase mb-3">
        🎁 DANH SÁCH KHÓA THƯỞNG TIER PASS:
      </h4>

      <div className="space-y-3">
        {tiers.map((tier) => {
          const isUnlocked = level >= tier.levelRequired;
          const stdClaimKey = `${tier.id}_standard`;
          const premClaimKey = `${tier.id}_premium`;

          const isStdClaimed = claimedRewards[stdClaimKey] || false;
          const isPremClaimed = claimedRewards[premClaimKey] || false;

          return (
            <div 
              key={tier.id}
              className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row justify-between items-center gap-4 ${
                isUnlocked 
                  ? 'bg-black/40 border-[#ffd700]/30 shadow-[0_2px_8px_rgba(255,215,0,0.05)]' 
                  : 'bg-black/80 border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 w-full md:w-1/3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black ${
                  isUnlocked ? 'bg-[#ffd700]/20 text-[#ffd700]' : 'bg-slate-800 text-slate-500'
                }`}>
                  {isUnlocked ? <Sparkles className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <div className={`font-black tracking-wide ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                    {tier.name}
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase font-sans">
                    Yêu cầu: Level {tier.levelRequired}
                  </div>
                </div>
              </div>

              {/* Standard Reward Column */}
              <div className="w-full md:w-1/3 flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase text-slate-400">Standard Reward</span>
                  <span className="text-[11px] font-bold text-slate-200">{tier.standardReward?.label || `+${tier.standardReward?.value} PP`}</span>
                </div>
                {isUnlocked ? (
                  isStdClaimed ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-bold text-[10px] uppercase">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Đã Nhận
                    </span>
                  ) : (
                    <button
                      onClick={() => handleClaimReward(tier.id, 'standard')}
                      className="py-1 px-2.5 bg-emerald-950/40 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/50 rounded text-[9px] font-bold uppercase transition cursor-pointer"
                    >
                      Nhận Quà
                    </button>
                  )
                ) : (
                  <span className="text-slate-500 flex items-center gap-1 text-[9px] uppercase font-sans">
                    <Lock className="w-3 h-3" /> Khóa
                  </span>
                )}
              </div>

              {/* Premium Reward Column */}
              <div className={`w-full md:w-1/3 flex items-center justify-between p-2 rounded-lg border ${
                isPremium ? 'bg-amber-950/20 border-amber-500/20' : 'bg-zinc-950/40 border-dashed border-white/5'
              }`}>
                <div className="flex flex-col">
                  <span className="text-[8px] uppercase text-amber-400 flex items-center gap-0.5">
                    <Crown className="w-2.5 h-2.5 text-yellow-500" /> S-Pass Premium
                  </span>
                  <span className="text-[11px] font-black text-glow-gold text-[#ffd700]">{tier.premiumReward?.label || `+${tier.premiumReward?.value} PP`}</span>
                </div>
                {isUnlocked ? (
                  !isPremium ? (
                    <span className="text-amber-500/60 font-medium text-[9px] uppercase font-sans flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Cần VIP
                    </span>
                  ) : isPremClaimed ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-bold text-[10px] uppercase">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Đã Nhận
                    </span>
                  ) : (
                    <button
                      onClick={() => handleClaimReward(tier.id, 'premium')}
                      className="py-1 px-2.5 bg-amber-950/40 hover:bg-[#ffd700] text-[#ffd700] hover:text-black border border-[#ffd700]/50 rounded text-[9px] font-bold uppercase transition cursor-pointer shadow-[0_0_8px_rgba(255,215,0,0.2)]"
                    >
                      Nhận Quà
                    </button>
                  )
                ) : (
                  <span className="text-slate-500 flex items-center gap-1 text-[9px] uppercase font-sans">
                    <Lock className="w-3 h-3" /> Khóa
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
