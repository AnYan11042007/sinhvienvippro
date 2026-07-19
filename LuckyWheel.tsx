/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, update, push } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { Sparkles, Compass, AlertCircle, Clock, Trophy, Award, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LuckyWheelProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface WheelSegment {
  label: string;
  type: 'pp' | 'xp' | 'frame';
  value: string | number;
  color: string;
  text: string;
}

const SEGMENTS: WheelSegment[] = [
  { label: '+5,000 PP', type: 'pp', value: 5000, color: '#1a1012', text: '#ef4444' },
  { label: '+200 XP', type: 'xp', value: 200, color: '#091a18', text: '#10b981' },
  { label: 'Khung Cầu Vồng Neon', type: 'frame', value: 'neon-ring', color: '#181024', text: '#a855f7' },
  { label: '+15,000 PP', type: 'pp', value: 15000, color: '#1a180c', text: '#eab308' },
  { label: '+500 XP', type: 'xp', value: 500, color: '#0b1624', text: '#06b6d4' },
  { label: 'Khung Cyberpunk', type: 'frame', value: 'cyber-ring', color: '#181024', text: '#ec4899' },
  { label: '+50,000 PP', type: 'pp', value: 50000, color: '#1a180c', text: '#ffd700' },
  { label: 'Khung Hoàng Gia Gold', type: 'frame', value: 'gold-ring', color: '#241a0b', text: '#f97316' },
];

export default function LuckyWheel({ uid, user, onShowResult }: LuckyWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState<number>(0);
  const [lastSpinTime, setLastSpinTime] = useState<number>(0);

  // Sync and monitor user's last lucky wheel spin timestamp in Realtime Database
  useEffect(() => {
    if (!uid) return;
    const lastSpinRef = ref(db, `users/${uid}/lastLuckyWheelSpin`);
    get(lastSpinRef).then((snap) => {
      if (snap.exists()) {
        setLastSpinTime(snap.val() as number);
      }
    });
  }, [uid]);

  // Handle the live cooldown clock ticking
  useEffect(() => {
    if (!lastSpinTime) {
      setCooldownTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const msSinceLast = Date.now() - lastSpinTime;
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      const remaining = twentyFourHoursMs - msSinceLast;

      if (remaining <= 0) {
        setCooldownTimeLeft(0);
        clearInterval(interval);
      } else {
        setCooldownTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastSpinTime]);

  // Render countdown text cleanly (HH:MM:SS format)
  const formatCooldown = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSpin = async () => {
    if (isSpinning) return;
    
    // Safety check on the 24-hour limit
    if (cooldownTimeLeft > 0) {
      onShowResult(
        'VÒNG QUAY ĐANG TRONG THỜI GIAN CHỜ',
        `Bạn đã quay hôm nay rồi! Vui lòng quay lại sau ${formatCooldown(cooldownTimeLeft)} nữa nhé.`,
        false
      );
      return;
    }

    setIsSpinning(true);

    // Randomize winning slice
    const winningIndex = Math.floor(Math.random() * SEGMENTS.length);
    const degreesPerSlice = 360 / SEGMENTS.length;
    
    // Target rotation to land on the chosen segment
    // Segment 0 is at top (0 degrees). Rotation is clockwise.
    // To land on winningIndex, the pointer is at 270 degrees relative to wheel starting point or we align via angle.
    // Let's use simple angle offsets: each slice occupies degreesPerSlice.
    // Center of winning slice = index * degreesPerSlice
    const sliceAngle = winningIndex * degreesPerSlice;
    const extraSpins = 360 * 5; // 5 full rounds for high velocity feel
    const finalRotation = extraSpins + (360 - sliceAngle) + (degreesPerSlice / 2); // Land in the middle of slice

    setRotation(finalRotation);

    // Wait for the spinning animation to complete (4000ms in CSS transition)
    setTimeout(async () => {
      setIsSpinning(false);
      const wonSegment = SEGMENTS[winningIndex];

      try {
        const userSnap = await get(ref(db, `users/${uid}`));
        const freshUser = userSnap.val() || {};
        const now = Date.now();

        const updates: Record<string, any> = {
          [`users/${uid}/lastLuckyWheelSpin`]: now
        };

        let resultMessage = '';

        if (wonSegment.type === 'pp') {
          const currentPP = freshUser.pp || 0;
          const addedAmount = wonSegment.value as number;
          updates[`users/${uid}/pp`] = currentPP + addedAmount;
          resultMessage = `Chúc mừng sếp đại gia! Sếp đã quay trúng và nhận được +${addedAmount.toLocaleString()} PP tích lũy cực lớn!`;
        } else if (wonSegment.type === 'xp') {
          const currentXP = freshUser.xp || 0;
          let currentLevel = freshUser.level || 1;
          const addedXP = wonSegment.value as number;
          let newXP = currentXP + addedXP;

          // Level up algorithm (neededXP = level * 100)
          let leveledUp = false;
          while (newXP >= currentLevel * 100) {
            newXP -= currentLevel * 100;
            currentLevel += 1;
            leveledUp = true;
          }

          updates[`users/${uid}/xp`] = newXP;
          updates[`users/${uid}/level`] = currentLevel;
          resultMessage = `Sếp đã nhận được +${addedXP} XP kinh nghiệm! ${
            leveledUp ? `Đột phá cảnh giới! Kính chúc sếp thăng cấp thành công lên Level ${currentLevel}! 🎉` : ''
          }`;
        } else if (wonSegment.type === 'frame') {
          const currentInventory = freshUser.inventory || { frames: [], titles: [] };
          const wonFrame = wonSegment.value as string;
          
          if (!currentInventory.frames) {
            currentInventory.frames = [];
          }

          if (!currentInventory.frames.includes(wonFrame)) {
            currentInventory.frames.push(wonFrame);
          }

          updates[`users/${uid}/inventory`] = currentInventory;
          updates[`users/${uid}/activeFrame`] = wonFrame; // Automatically equip
          resultMessage = `ĐỈNH CAO CHÓI LÒ! Sếp đã sở hữu ngay ${wonSegment.label} độc quyền thời hạn vĩnh viễn và tự động kích hoạt trang bị!`;
        }

        // Apply updates to Firebase
        await update(ref(db), updates);

        // Record a transaction log for accountability
        await push(ref(db, 'transactions'), {
          sender: 'SYSTEM_LUCKYWHEEL',
          senderName: 'Vòng Quay S-System 88',
          receiver: uid,
          receiverName: freshUser.name || 'Sinh Viên',
          amount: wonSegment.type === 'pp' ? wonSegment.value : 0,
          message: `Quay thưởng: Trúng ${wonSegment.label}`,
          time: new Date().toLocaleString('vi-VN'),
          timestamp: now
        });

        // Trigger confetti explosion
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });

        onShowResult(
          'VÒNG QUAY MAY MẮN - THÀNH CÔNG',
          resultMessage,
          true
        );

        // Sync local states
        setLastSpinTime(now);

      } catch (err) {
        console.error('Lucky wheel update failed:', err);
        onShowResult('VÒNG QUAY THẤT BẠI', 'Đã xảy ra sự cố kỹ thuật trong quá trình ghi nhận giải thưởng!', false);
      }
    }, 4500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Premium Header */}
      <div className="glass-box p-6 border-[#ffd700]/30 bg-yellow-950/5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3.5 w-3.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffd700] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#ffd700]"></span>
            </span>
            <h2 className="text-2xl font-black font-sans text-white tracking-wide uppercase flex items-center gap-2">
              🔮 VÒNG QUAY MAY MẮN S88
            </h2>
          </div>
          <p className="text-xs text-[#8b949e] font-mono mt-1.5 uppercase">
            MỖI 24 GIỜ QUAY MIỄN PHÍ MỘT LẦN NHẬN NGAY VÀNG PP, KINH NGHIỆM XP HOẶC KHUNG AVATAR VIP ĐỘC QUYỀN
          </p>
        </div>
        <div className="bg-black/50 border border-white/5 py-3 px-6 rounded-2xl flex items-center gap-4 shrink-0 font-mono">
          <div className="text-right">
            <span className="block text-[10px] text-[#8b949e] uppercase">Ví tài sản PP:</span>
            <span className="text-glow-gold text-[#ffd700] text-lg font-black">
              {(user?.pp || 0).toLocaleString()} PP
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Widget: The Interactive Wheel Stage (Span 7) */}
        <div className="lg:col-span-7 glass-box border-white/5 p-6 flex flex-col items-center justify-center relative min-h-[460px] overflow-hidden">
          
          {/* Neon decorative background glow circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-yellow-500/5 blur-2xl pointer-events-none" />

          {/* Pointer needle on top */}
          <div className="absolute top-[48px] z-20 flex flex-col items-center">
            <div className="w-6 h-6 bg-gradient-to-b from-[#ffd700] to-yellow-600 border border-yellow-300 rounded-full shadow-[0_0_15px_rgba(255,215,0,0.5)] flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-black rounded-full" />
            </div>
            {/* The actual pointing triangle down */}
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent border-t-[#ffd700] drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] -mt-1.5" />
          </div>

          {/* Outer Wheel container */}
          <div className="relative w-80 h-80 md:w-96 md:h-96 rounded-full p-2.5 bg-gradient-to-b from-[#302312] to-black border-4 border-yellow-500 shadow-[0_0_35px_rgba(255,215,0,0.25)] flex items-center justify-center">
            
            {/* Little golden dots around the wheel border */}
            {[...Array(24)].map((_, i) => {
              const angle = (i * 360) / 24;
              return (
                <div 
                  key={i}
                  className={`absolute w-1.5 h-1.5 rounded-full ${i % 2 === 0 ? 'bg-yellow-300 shadow-[0_0_8px_#f59e0b]' : 'bg-white'} transition-all`}
                  style={{
                    transform: `rotate(${angle}deg) translateY(-185px) md:translateY(-220px)`
                  }}
                />
              );
            })}

            {/* The rotating SVG Wheel itself */}
            <div 
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? 'transform 4.5s cubic-bezier(0.15, 0.88, 0.3, 1)' : 'none'
              }}
              className="w-full h-full rounded-full overflow-hidden relative shadow-inner"
            >
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <defs>
                  {SEGMENTS.map((seg, idx) => (
                    <radialGradient id={`grad-${idx}`} key={idx} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={seg.color} />
                      <stop offset="100%" stopColor="#080502" />
                    </radialGradient>
                  ))}
                  {/* Outer circle shadow filter */}
                  <filter id="shadow">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity="0.8"/>
                  </filter>
                </defs>

                {/* Draw the slices */}
                {SEGMENTS.map((seg, idx) => {
                  const angle = 360 / SEGMENTS.length;
                  const startAngle = idx * angle;
                  const endAngle = startAngle + angle;
                  
                  // Convert angles to Cartesian points
                  const radStart = ((startAngle - 90) * Math.PI) / 180;
                  const radEnd = ((endAngle - 90) * Math.PI) / 180;
                  
                  const x1 = 200 + 200 * Math.cos(radStart);
                  const y1 = 200 + 200 * Math.sin(radStart);
                  const x2 = 200 + 200 * Math.cos(radEnd);
                  const y2 = 200 + 200 * Math.sin(radEnd);

                  const pathData = `M 200 200 L ${x1} ${y1} A 200 200 0 0 1 ${x2} ${y2} Z`;

                  // Text rotation centered in the middle of each segment
                  const textAngle = startAngle + angle / 2;

                  return (
                    <g key={idx}>
                      {/* Segment wedge path */}
                      <path 
                        d={pathData} 
                        fill={`url(#grad-${idx})`} 
                        stroke="#2a1f0a" 
                        strokeWidth="1.5"
                      />
                      
                      {/* Segment texts */}
                      <g transform={`rotate(${textAngle}, 200, 200)`}>
                        <text
                          x="200"
                          y="65"
                          textAnchor="middle"
                          fill={seg.text}
                          fontWeight="900"
                          fontSize="10"
                          fontFamily="monospace"
                          letterSpacing="0.5"
                          className="font-mono select-none"
                          transform="rotate(0, 200, 65)"
                          style={{
                            textShadow: `0 0 12px ${seg.text}40, 1px 1px 1px #000`
                          }}
                        >
                          {seg.label}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Central shining decorative button */}
                <circle cx="200" cy="200" r="32" fill="url(#grad-central)" stroke="#ffd700" strokeWidth="2" filter="url(#shadow)" />
                <radialGradient id="grad-central" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffd700" />
                  <stop offset="100%" stopColor="#9a3412" />
                </radialGradient>
                <circle cx="200" cy="200" r="22" fill="#000000" />
                
                {/* Embedded lock icon */}
                <path 
                  d="M194 195 A6 6 0 1 1 206 195 A6 6 0 1 1 194 195 Z" 
                  fill="#ffd700"
                />
              </svg>
            </div>
            
            {/* Spinning center text indicator overlay */}
            <div className="absolute w-12 h-12 rounded-full pointer-events-none flex items-center justify-center text-white text-[10px] font-mono font-black select-none text-glow-gold text-[#ffd700]">
              S88
            </div>
          </div>

        </div>

        {/* Right Widget: Guidelines, Cooldown and Rewards Chest (Span 5) */}
        <div className="lg:col-span-5 flex flex-col gap-5 justify-between">
          
          <div className="glass-box p-5 border-white/5 space-y-4">
            <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-2.5">
              <Compass className="w-4 h-4 text-yellow-500" /> TRANG BỊ & PHẦN THƯỞNG
            </h3>
            
            <p className="text-[11px] text-[#8b949e] font-sans leading-relaxed">
              Vòng quay được lập trình dựa trên phân phối tài sản ngẫu nhiên, không thiên vị, không can thiệp. Kết quả quay trúng sẽ lập tức cập nhật lên hồ sơ của bạn trên đám mây Firebase Realtime Database.
            </p>

            <div className="space-y-2.5 font-mono text-[11px]">
              <div className="flex justify-between items-center py-2 px-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-[#ffd700] flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" /> Khung Hoàng Gia Gold
                </span>
                <span className="text-[9px] uppercase font-bold text-white/50 bg-white/5 py-0.5 px-2 border border-white/10 rounded">Vĩnh viễn</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-pink-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Khung Hologram Cyberpunk
                </span>
                <span className="text-[9px] uppercase font-bold text-white/50 bg-white/5 py-0.5 px-2 border border-white/10 rounded">Độc quyền</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 bg-black/40 border border-white/5 rounded-xl">
                <span className="text-purple-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> Khung Cầu Vồng Neon
                </span>
                <span className="text-[9px] uppercase font-bold text-white/50 bg-white/5 py-0.5 px-2 border border-white/10 rounded">Cực hiếm</span>
              </div>
            </div>
          </div>

          {/* Trigger State Display Panel */}
          <div className="glass-box p-5 border-white/5 bg-black/20 flex flex-col items-center justify-center text-center py-8">
            {cooldownTimeLeft > 0 ? (
              <div className="space-y-4 w-full">
                <div className="w-14 h-14 rounded-full bg-red-950/20 border border-red-500/30 flex items-center justify-center mx-auto text-red-500 animate-pulse">
                  <Clock className="w-7 h-7" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-widest">Thời gian chờ lượt quay tiếp theo:</span>
                  <span className="text-3xl font-black font-mono text-glow-red text-red-500 block mt-2">
                    {formatCooldown(cooldownTimeLeft)}
                  </span>
                </div>
                <button
                  disabled
                  className="w-full py-4.5 bg-slate-800/50 border border-white/5 text-slate-500 font-mono text-xs font-black uppercase tracking-widest rounded-2xl cursor-not-allowed"
                >
                  ⏳ KHÓA QUAY (COOLDOWN)
                </button>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                <div className="w-14 h-14 rounded-full bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-widest">LƯỢT QUAY MIỄN PHÍ ĐÃ SẴN SÀNG</span>
                  <span className="text-glow-green text-[#00ff80] text-sm font-black font-mono uppercase block mt-1.5">
                    HÃY THỬ VẬN MAY CỦA BẠN NGAY!
                  </span>
                </div>
                <button
                  disabled={isSpinning}
                  onClick={handleSpin}
                  className="w-full py-4.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-mono text-xs font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Compass className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                  {isSpinning ? 'Đang quay...' : '🔮 QUAY THƯỞNG LẬP TỨC'}
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
