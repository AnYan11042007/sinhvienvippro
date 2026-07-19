/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, update, push } from 'firebase/database';
import { db } from '../../firebase';
import { X, Trophy, Activity, MessageSquare, Play, HelpCircle, Users, Coins } from 'lucide-react';
import { User } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface FcMobileModalProps {
  uid: string;
  user: User | null;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface Player {
  id: string;
  name: string;
  number: number;
  role: 'GK' | 'DF' | 'MF' | 'FW';
  team: 'BLUE' | 'RED';
  // Standard tactical coordinates (in percentages)
  baseLeft: number;
  baseTop: number;
  // Current dynamic positions
  left: number;
  top: number;
}

export default function FcMobileModal({ uid, user, onClose, onShowResult }: FcMobileModalProps) {
  const [betAmount, setBetAmount] = useState('');
  const [isMatchActive, setIsMatchActive] = useState(false);
  const [betChoice, setBetChoice] = useState<'BLUE' | 'RED' | ''>('');

  // Scoreboard
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [matchMin, setMatchMin] = useState(0);
  const [commentary, setCommentary] = useState('Chào mừng sếp đến với Đấu trường FC Mobile! Hãy chọn đội và đặt cược để khai cuộc.');
  const [phaseText, setPhaseText] = useState('CHUẨN BỊ');

  // Players state (12 players: 1 GK + 5 field players per team)
  const [players, setPlayers] = useState<Player[]>([
    // Blue Team (Attacks left-to-right)
    { id: 'b_gk', name: 'Anh Đức', number: 1, role: 'GK', team: 'BLUE', baseLeft: 10, baseTop: 50, left: 10, top: 50 },
    { id: 'b_df1', name: 'Trọng Hải', number: 3, role: 'DF', team: 'BLUE', baseLeft: 28, baseTop: 25, left: 28, top: 25 },
    { id: 'b_df2', name: 'Quế Lâm', number: 4, role: 'DF', team: 'BLUE', baseLeft: 28, baseTop: 75, left: 28, top: 75 },
    { id: 'b_mf', name: 'Quang Hải', number: 19, role: 'MF', team: 'BLUE', baseLeft: 48, baseTop: 50, left: 48, top: 50 },
    { id: 'b_fw1', name: 'Tiến Linh', number: 22, role: 'FW', team: 'BLUE', baseLeft: 68, baseTop: 30, left: 68, top: 30 },
    { id: 'b_fw2', name: 'Văn Toàn', number: 9, role: 'FW', team: 'BLUE', baseLeft: 68, baseTop: 70, left: 68, top: 70 },

    // Red Team (Attacks right-to-left)
    { id: 'r_gk', name: 'Thanh Thắng', number: 1, role: 'GK', team: 'RED', baseLeft: 90, baseTop: 50, left: 90, top: 50 },
    { id: 'r_df1', name: 'Đình Trọng', number: 2, role: 'DF', team: 'RED', baseLeft: 72, baseTop: 25, left: 72, top: 25 },
    { id: 'r_df2', name: 'Duy Mạnh', number: 28, role: 'DF', team: 'RED', baseLeft: 72, baseTop: 75, left: 72, top: 75 },
    { id: 'r_mf', name: 'Tuấn Anh', number: 11, role: 'MF', team: 'RED', baseLeft: 52, baseTop: 50, left: 52, top: 50 },
    { id: 'r_fw1', name: 'Công Phượng', number: 10, role: 'FW', team: 'RED', baseLeft: 32, baseTop: 30, left: 32, top: 30 },
    { id: 'r_fw2', name: 'Văn Đức', number: 20, role: 'FW', team: 'RED', baseLeft: 32, baseTop: 70, left: 32, top: 70 },
  ]);

  // Ball possession & rendering coordinates
  const [possessingTeam, setPossessingTeam] = useState<'BLUE' | 'RED'>('BLUE');
  const [ballOwnerId, setBallOwnerId] = useState<string>('b_mf');
  const [ballPos, setBallPos] = useState({ left: 50, top: 50 });
  const [isBallFlying, setIsBallFlying] = useState(false);

  // FX state
  const [isGoalAnimate, setIsGoalAnimate] = useState(false);
  const [isScreenShake, setIsScreenShake] = useState(false);

  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentMinRef = useRef(0);
  const totalMinRef = useRef(90);

  // Reset player coordinates to their standard bases
  const resetPlayerPositions = () => {
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        left: p.baseLeft,
        top: p.baseTop,
      }))
    );
  };

  useEffect(() => {
    // Put ball in center of the pitch initially
    setBallPos({ left: 50, top: 50 });
    return () => {
      if (matchIntervalRef.current) clearInterval(matchIntervalRef.current);
    };
  }, []);

  const handleStartMatch = async (choice: 'BLUE' | 'RED') => {
    if (isMatchActive) return;

    const amt = parseInt(betAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Số PP cược không hợp lệ!');
      return;
    }

    const currentPP = user?.pp || 0;
    if (currentPP < amt) {
      alert(`Số dư PP không đủ! Bạn cần ít nhất ${amt.toLocaleString()} PP.`);
      return;
    }

    setIsMatchActive(true);
    setBetChoice(choice);
    setScore({ blue: 0, red: 0 });
    setMatchMin(0);
    currentMinRef.current = 0;
    totalMinRef.current = 90 + Math.floor(Math.random() * 5) + 1; // 91-95 mins with extra time

    resetPlayerPositions();

    // Start possessing at the center midfielder
    setPossessingTeam(choice);
    const initialOwner = choice === 'BLUE' ? 'b_mf' : 'r_mf';
    setBallOwnerId(initialOwner);
    const centerPlayer = players.find((p) => p.id === initialOwner);
    if (centerPlayer) {
      setBallPos({ left: centerPlayer.baseLeft, top: centerPlayer.baseTop });
    }

    try {
      // Deduct PP instantly
      await update(ref(db, `users/${uid}`), { pp: currentPP - amt });
      setCommentary('Trọng tài chính thổi còi khai cuộc! Trận đấu bóng đá siêu thực S-System bắt đầu!');
      setPhaseText('TRẬN ĐẤU BẮT ĐẦU');

      matchIntervalRef.current = setInterval(() => {
        executeMatchTick(choice, amt);
      }, 1000); // Dynamic step-by-step update every 1 second
    } catch (err) {
      console.error(err);
      alert('Gặp lỗi khi bắt đầu trận đấu!');
      setIsMatchActive(false);
    }
  };

  const executeMatchTick = (choice: 'BLUE' | 'RED', amt: number) => {
    currentMinRef.current += 3; // Fast forward: 3 mins per real-world tick (takes about 30 ticks for 90 mins)
    const currentMin = currentMinRef.current;
    setMatchMin(Math.min(currentMin, 90));

    // Finish match check
    if (currentMin >= totalMinRef.current) {
      if (matchIntervalRef.current) clearInterval(matchIntervalRef.current);
      matchIntervalRef.current = null;
      handleMatchFinished(choice, amt);
      return;
    }

    // Determine phase text
    if (currentMin < 30) {
      setPhaseText('HIỆP 1: THĂM DÒ');
    } else if (currentMin < 45) {
      setPhaseText('HIỆP 1: TĂNG TỐC');
    } else if (currentMin < 75) {
      setPhaseText('HIỆP 2: TRANH CHẤP');
    } else {
      setPhaseText('HIỆP 2: CHUNG CUỘC');
    }

    // Standard step action flow: Pass, Dribble, or Shoot
    setPlayers((prevPlayers) => {
      // Find current ball owner
      const currentOwner = prevPlayers.find((p) => p.id === ballOwnerId);
      if (!currentOwner) return prevPlayers;

      const teamPlayers = prevPlayers.filter((p) => p.team === currentOwner.team);
      const opponentPlayers = prevPlayers.filter((p) => p.team !== currentOwner.team);

      // Simple action probability
      const randAction = Math.random();
      let action: 'PASS' | 'DRIBBLE' | 'SHOOT' = 'DRIBBLE';

      if (currentOwner.role === 'GK') {
        action = randAction < 0.9 ? 'PASS' : 'DRIBBLE'; // Goalkeeper prefers passing
      } else if (currentOwner.role === 'DF') {
        action = randAction < 0.7 ? 'PASS' : 'DRIBBLE'; // defender passes
      } else if (currentOwner.role === 'MF') {
        if (randAction < 0.5) action = 'PASS';
        else if (randAction < 0.8) action = 'DRIBBLE';
        else action = 'SHOOT'; // Midfielders can shoot
      } else if (currentOwner.role === 'FW') {
        if (randAction < 0.55) action = 'SHOOT'; // Forward shoots!
        else if (randAction < 0.8) action = 'DRIBBLE';
        else action = 'PASS';
      }

      if (action === 'DRIBBLE') {
        // Dynamic slight movement of the possessing player
        const dx = (Math.random() - 0.5) * 8;
        const dy = (Math.random() - 0.5) * 12;

        const nextLeft = Math.max(15, Math.min(85, currentOwner.left + dx));
        const nextTop = Math.max(10, Math.min(90, currentOwner.top + dy));

        // Sync ball immediately
        setBallPos({ left: nextLeft, top: nextTop });
        
        // Dynamic Commentary
        const dribbleCmt = [
          `[Phút ${currentMin}] ${currentOwner.name} tả xung hữu đột đi bóng tốc độ bên hành lang cánh!`,
          `[Phút ${currentMin}] Pha đảo bóng điệu nghệ, ${currentOwner.name} tự tin đột phá vòng vây!`,
          `[Phút ${currentMin}] ${currentOwner.name} che chắn bóng khéo léo để tìm khoảng trống!`,
          `[Phút ${currentMin}] Động tác giả hoàn hảo! ${currentOwner.name} loại bỏ một chốt chặn phòng ngự.`
        ];
        setCommentary(dribbleCmt[Math.floor(Math.random() * dribbleCmt.length)]);

        return prevPlayers.map((p) =>
          p.id === currentOwner.id ? { ...p, left: nextLeft, top: nextTop } : p
        );
      } else if (action === 'PASS') {
        // Choose target teammate (different from current owner)
        const teammates = teamPlayers.filter((p) => p.id !== currentOwner.id);
        const target = teammates[Math.floor(Math.random() * teammates.length)];

        // Ball flying animation
        setIsBallFlying(true);
        setTimeout(() => setIsBallFlying(false), 500);

        setBallOwnerId(target.id);
        setBallPos({ left: target.left, top: target.top });

        const passCmt = [
          `[Phút ${currentMin}] ${currentOwner.name} kiến tạo đường chuyền sắc lẹm cho ${target.name}.`,
          `[Phút ${currentMin}] Bóng được trả ngược tinh tế từ chân ${currentOwner.name} đến vị trí của ${target.name}.`,
          `[Phút ${currentMin}] Đường rót bóng dài vượt tuyến của ${currentOwner.name} hướng thẳng đến ${target.name}!`,
          `[Phút ${currentMin}] Phối hợp ban bật cực nhanh, ${currentOwner.name} xẻ nách cực thoáng cho ${target.name}!`
        ];
        setCommentary(passCmt[Math.floor(Math.random() * passCmt.length)]);

        return prevPlayers;
      } else {
        // SHOOT ACTION!
        // Find opponent goalkeeper
        const oppGK = opponentPlayers.find((p) => p.role === 'GK');
        const goalTargetX = currentOwner.team === 'BLUE' ? 95 : 5;
        const goalTargetY = 45 + Math.random() * 10; // near center of goal line

        // GK attempts to leap to block
        const gkMoveY = 40 + Math.random() * 20;

        // Flying ball animation
        setIsBallFlying(true);
        setBallPos({ left: goalTargetX, top: goalTargetY });
        setTimeout(() => setIsBallFlying(false), 600);

        // Determine if Goal or Saved (roughly 30% chance of scoring on a shot)
        const isGoal = Math.random() < 0.35;

        setTimeout(() => {
          if (isGoal) {
            setIsGoalAnimate(true);
            setIsScreenShake(true);
            setTimeout(() => {
              setIsGoalAnimate(false);
              setIsScreenShake(false);
            }, 1200);

            // Increment score
            setScore((prev) => {
              const nextBlue = currentOwner.team === 'BLUE' ? prev.blue + 1 : prev.blue;
              const nextRed = currentOwner.team === 'RED' ? prev.red + 1 : prev.red;
              return { blue: nextBlue, red: nextRed };
            });

            setCommentary(`💥 [Phút ${currentMin}] SÚT!!! VÀOOOOOOOOOO!!! Siêu phẩm sấm sét của ${currentOwner.name} xé toang mành lưới đối phương!`);

            // Conceded team restarts possession with their midfielder
            const nextPossessorId = currentOwner.team === 'BLUE' ? 'r_mf' : 'b_mf';
            setBallOwnerId(nextPossessorId);
            setPossessingTeam(currentOwner.team === 'BLUE' ? 'RED' : 'BLUE');
            const restartPl = prevPlayers.find((p) => p.id === nextPossessorId);
            if (restartPl) {
              setBallPos({ left: restartPl.left, top: restartPl.top });
            }
          } else {
            // SAVED / MISSED!
            const isSave = Math.random() < 0.6;
            if (isSave && oppGK) {
              setCommentary(`🧤 [Phút ${currentMin}] KHÔNG VÀO! Thủ môn ${oppGK.name} bay người cản phá xuất thần cú sút góc hẹp của ${currentOwner.name}!`);
              // GK gets possession
              setBallOwnerId(oppGK.id);
              setPossessingTeam(oppGK.team);
              setBallPos({ left: oppGK.left, top: oppGK.top });
            } else {
              setCommentary(`[Phút ${currentMin}] Sút căng từ chân ${currentOwner.name}! Tiếc là bóng bay vọt xà ngang trong gang tấc!`);
              // Goal kick: opponent GK gets ball
              if (oppGK) {
                setBallOwnerId(oppGK.id);
                setPossessingTeam(oppGK.team);
                setBallPos({ left: oppGK.left, top: oppGK.top });
              }
            }
          }
        }, 300);

        // Update GK visual positions during dive
        return prevPlayers.map((p) => {
          if (p.id === oppGK?.id) {
            return { ...p, top: gkMoveY };
          }
          return p;
        });
      }
    });
  };

  const handleMatchFinished = async (choice: 'BLUE' | 'RED', amt: number) => {
    setIsMatchActive(false);
    setPhaseText('TRẬN ĐẤU KẾT THÚC');
    setCommentary('HẾT GIỜ! Trọng tài chính nổi còi mãn cuộc trận đấu kịch tính nghẹt thở!');

    const finalBlue = score.blue;
    const finalRed = score.red;
    const winner = finalBlue > finalRed ? 'BLUE' : finalRed > finalBlue ? 'RED' : 'DRAW';

    let payout = 0;
    let isWin = false;
    let titleText = '';
    let messageText = `Tỉ số chung cuộc: Xanh ${finalBlue} - ${finalRed} Đỏ.\n`;

    if (winner === 'DRAW') {
      payout = amt; // refund on draw
      isWin = true;
      titleText = 'HÒA ĐẤU SỨC';
      messageText += `Hai bên bất phân thắng bại! Sếp được hoàn trả toàn bộ ${amt.toLocaleString()} PP cược.`;
    } else if (winner === choice) {
      const gap = Math.abs(finalBlue - finalRed);
      if (gap >= 2) {
        payout = Math.floor(amt * 2.5);
        isWin = true;
        titleText = 'JACKPOT THẮNG ĐẬM';
        messageText += `Cực đỉnh! Đội sếp chọn thắng cách biệt ${gap} bàn giòn giã! Nhận Jackpot x2.5: +${payout.toLocaleString()} PP!`;
      } else {
        payout = amt * 2;
        isWin = true;
        titleText = 'CHIẾN THẮNG KÈO ĐẤU';
        messageText += `Tuyệt hảo! Đội sếp chọn bảo toàn thắng lợi sát nút! Nhận thưởng x2: +${payout.toLocaleString()} PP!`;
      }
    } else {
      payout = 0;
      isWin = false;
      titleText = 'BẠI TRẬN ĐÁNG TIẾC';
      messageText += `Trận thua sát nút! Sếp bị trừ mất trắng -${amt.toLocaleString()} PP cược. Chúc sếp may mắn lượt sau!`;
    }

    try {
      // Award PP to user
      if (payout > 0) {
        const uSnap = await get(ref(db, `users/${uid}`));
        const freshPP = (uSnap.val()?.pp || 0) + payout;
        await update(ref(db, `users/${uid}`), { pp: freshPP });
      }

      // Record logs
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'FC Mobile',
        bet: amt,
        pnl: payout - amt,
        result: isWin && winner !== 'DRAW' ? 'Thắng' : winner === 'DRAW' ? 'Hòa' : 'Thua',
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now(),
      });

      // Daily mission update
      try {
        const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
        const missionRef = ref(db, `users/${uid}/daily_missions/${todayStr}`);
        const mSnap = await get(missionRef);
        const currentCrash = mSnap.val()?.crashRides || 0;
        // Increment mission count (using crashRides field or similar to reward gaming activity)
        await update(missionRef, { crashRides: currentCrash + 1 });
      } catch (err) {
        console.warn('Daily mission update skipped:', err);
      }

      setTimeout(() => {
        onClose();
        onShowResult(titleText, messageText, isWin);
      }, 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="overlay z-[6000]">
      <div className="glass-box max-w-[850px] w-full p-4 md:p-6 border-white/20 relative overflow-hidden flex flex-col gap-4 shadow-3xl animate-scale-up">
        
        {/* Glow visual accents */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 via-emerald-500 to-red-500 z-10" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Close Button */}
        <button
          onClick={isMatchActive ? undefined : onClose}
          disabled={isMatchActive}
          className={`absolute top-4 right-4 text-[#8b949e] hover:text-white transition duration-200 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer z-20 ${
            isMatchActive ? 'opacity-20 cursor-not-allowed' : ''
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Block */}
        <div className="text-center md:text-left select-none">
          <h2 className="text-white text-glow-blue text-xl md:text-2xl font-black font-sans uppercase tracking-wider flex items-center justify-center md:justify-start gap-2">
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
            FC MOBILE ARENA 2D
          </h2>
          <p className="text-[10px] md:text-xs font-mono text-[#8b949e] uppercase mt-0.5">
            BÓNG ĐÁ SIÊU THỰC // 12 CẦU THỦ CHUYỂN ĐỘNG TỪNG BƯỚC // BÌNH LUẬN TIẾNG VIỆT ĐỒNG BỘ
          </p>
        </div>

        {/* Score Board Display */}
        <div className="grid grid-cols-3 items-center bg-black/60 border border-white/10 rounded-2xl p-4 text-center relative overflow-hidden select-none">
          {/* Blue Column */}
          <div className="flex flex-col items-center">
            <span className="text-glow-blue text-[#00f0ff] font-extrabold text-xs md:text-sm tracking-widest">
              XANH S-SYSTEM
            </span>
            <span className="text-[8px] md:text-[10px] text-slate-400 font-mono mt-0.5">
              Cược Thắng x2 // Jackpot x2.5
            </span>
          </div>

          {/* Clock & score */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-4">
              <span className="text-white font-black text-3xl md:text-4xl font-mono tracking-tight">{score.blue}</span>
              <span className="text-[#ffd700] text-glow-gold text-lg md:text-xl font-mono font-black border border-yellow-500/30 bg-yellow-500/10 py-0.5 px-2.5 rounded-md">
                {matchMin < 90 ? `${matchMin < 10 ? '0' + matchMin : matchMin}:00` : `90+${matchMin - 90}'`}
              </span>
              <span className="text-white font-black text-3xl md:text-4xl font-mono tracking-tight">{score.red}</span>
            </div>
            <span className="text-[9px] font-mono text-emerald-400 font-bold tracking-widest uppercase mt-0.5 animate-pulse bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              {phaseText}
            </span>
          </div>

          {/* Red Column */}
          <div className="flex flex-col items-center">
            <span className="text-glow-red text-[#ff003c] font-extrabold text-xs md:text-sm tracking-widest">
              ĐỎ HỌC VIỆN
            </span>
            <span className="text-[8px] md:text-[10px] text-slate-400 font-mono mt-0.5">
              Cược Thắng x2 // Jackpot x2.5
            </span>
          </div>
        </div>

        {/* 2D soccer field */}
        <div
          className={`relative w-full h-[260px] md:h-[340px] bg-gradient-to-b from-[#1b5e20] to-[#2e7d32] border-2 border-white/60 rounded-2xl overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.65),_0_20px_40px_rgba(0,0,0,0.8)] select-none ${
            isScreenShake ? 'shake-screen' : ''
          }`}
        >
          {/* Field Grid lines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
          
          {/* Halfway line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40 -translate-x-1/2" />
          
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-28 md:h-28 border-2 border-white/40 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/60 rounded-full" />

          {/* Goal post penalty areas */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[15%] h-[55%] border-2 border-white/40 border-l-0 rounded-r-lg" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[15%] h-[55%] border-2 border-white/40 border-r-0 rounded-l-lg" />

          {/* Render GOAL screen flash overlay */}
          <AnimatePresence>
            {isGoalAnimate && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/70 flex flex-col items-center justify-center text-center font-mono"
              >
                <motion.h1 
                  animate={{ y: [-15, 0, -15], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-glow-green text-[#00ff80] text-4xl md:text-6xl font-black tracking-widest uppercase"
                >
                  ⚽ VÀOOOOOOOOO!!!
                </motion.h1>
                <p className="text-white text-xs mt-2 uppercase tracking-widest font-bold">RÚNG ĐỘNG LƯỚI ĐỐI PHƯƠNG!</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PLAYERS RENDERING */}
          {players.map((p) => {
            const hasBall = ballOwnerId === p.id;
            return (
              <motion.div
                key={p.id}
                animate={{ left: `${p.left}%`, top: `${p.top}%` }}
                transition={{ type: 'spring', stiffness: 70, damping: 15 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center select-none"
              >
                {/* Player Name Tag */}
                <span className="text-[7px] md:text-[9px] font-mono font-black text-white bg-black/60 px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-wide mb-1 leading-none shadow-md">
                  {p.name}
                </span>

                {/* Player dot / Jersey */}
                <div
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center relative shadow-lg ${
                    p.team === 'BLUE'
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-500 border-blue-400 text-white'
                      : 'bg-gradient-to-br from-red-600 to-rose-500 border-rose-400 text-white'
                  } ${hasBall ? 'scale-110 border-[#ffd700] ring-4 ring-[#ffd700]/30' : ''}`}
                >
                  <span className="font-mono text-[9px] md:text-xs font-black select-none">
                    {p.number}
                  </span>

                  {/* Tiny role bubble */}
                  <span className="absolute -bottom-1 -right-1 text-[6px] font-mono px-0.5 bg-black text-[#ffd700] border border-white/10 rounded font-black scale-90">
                    {p.role}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {/* ACTIVE SOCCER BALL */}
          <motion.div
            animate={{ left: `${ballPos.left}%`, top: `${ballPos.top}%` }}
            transition={
              isBallFlying 
                ? { duration: 0.5, ease: 'easeOut' }
                : { type: 'spring', stiffness: 90, damping: 14 }
            }
            className="absolute z-20 text-xl md:text-2xl -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)] flex items-center justify-center select-none"
          >
            ⚽
          </motion.div>
        </div>

        {/* Live track commentary box */}
        <div className="bg-black/85 border border-white/15 rounded-2xl p-4 min-h-[60px] flex items-center justify-center text-center font-mono text-xs md:text-sm leading-relaxed text-slate-100 select-none shadow-inner">
          <MessageSquare className="w-4 h-4 text-emerald-400 mr-2 animate-pulse shrink-0" />
          <span className="font-medium">{commentary}</span>
        </div>

        {/* Action Controls */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
          {!isMatchActive ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
                <span className="text-[#8b949e] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-[#ffd700]" /> Số lượng PP đặt cược:
                </span>
                <input
                  type="number"
                  placeholder="Nhập số PP cược..."
                  className="bg-black/60 border border-[#30363d] focus:border-[#00f0ff] focus:outline-none rounded-xl py-2 px-4 text-center font-black text-[#ffd700] text-glow-gold w-full sm:w-48 text-sm"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 font-mono text-xs">
                <button
                  onClick={() => handleStartMatch('BLUE')}
                  className="py-3 bg-blue-950/30 border-2 border-dashed border-[#00f0ff] hover:bg-[#00f0ff] hover:text-black hover:border-solid hover:shadow-[0_0_15px_rgba(0,240,255,0.35)] text-[#00f0ff] text-glow-blue font-black rounded-xl uppercase tracking-widest transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" /> [ CƯỢC XANH S-SYSTEM ]
                </button>
                <button
                  onClick={() => handleStartMatch('RED')}
                  className="py-3 bg-red-950/30 border-2 border-dashed border-[#ff003c] hover:bg-[#ff003c] hover:text-white hover:border-solid hover:shadow-[0_0_15px_rgba(255,0,60,0.35)] text-[#ff003c] text-glow-red font-black rounded-xl uppercase tracking-widest transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Play className="w-3.5 h-3.5" /> [ CƯỢC ĐỎ HỌC VIỆN ]
                </button>
              </div>
            </div>
          ) : (
            <div className="py-3.5 bg-zinc-950/30 border border-zinc-800 text-[#ffd700] text-glow-gold font-mono font-black uppercase text-[10px] md:text-xs tracking-widest rounded-xl text-center flex items-center justify-center gap-2 select-none animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#ffd700] animate-ping" />
              Trận đấu đang truyền hình trực tiếp... Vui lòng đợi mãn cuộc đấu kịch tính!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
