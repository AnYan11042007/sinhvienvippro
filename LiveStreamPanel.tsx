/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, push, update } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { 
  Tv, Users, Send, Coins, Flame, Trophy, Play, Info, AlertCircle, 
  Sparkles, Volume2, Compass, Maximize2, Minimize2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LiveStreamPanelProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

type GameType = 'taixiu' | 'crash' | 'penalty';

const BOT_NAMES = [
  'ĐạiGiaQuận1', 'HọcThầnS88', 'LắcKinhKông', 'ThầnBàiĐấtCảng', 
  'HípPro99', 'BạchThủLô', 'KiềuNữBếnTre', 'MạnhThườngQuân',
  'CậuCảHảiPhòng', 'CòBayLả', 'TùngSơnBóngĐá', 'LuffyXìDách',
  'HeoConLonTon', 'DũngSĩGồngLãi', 'ThầyHuấnDạyVăn', 'GiaCátDự'
];

const BOT_COMMENTS: Record<GameType, string[]> = {
  taixiu: [
    'Cầu bệt Tài đẹp quá anh em ơi, tất tay thôi!',
    'Mới bẻ cầu Xỉu xong, ván này chắc chắn Xỉu nha ae.',
    'Lắc mạnh tay lên chị dealer xinh đẹp ơi 🎲',
    'Vừa ăn quả Tài húp ngọt xớt.',
    'U là trời, bão 3 hột 1 kìa, khóc thét 😭',
    'Nhà cái quả này húp trọn rồi.',
    'Gia đình đang yên ấm bỗng chuyển sang Xỉu',
    'Sếp Tùng vừa vào 50k Tài kìa, uy tín luôn',
    'Cầu 2-2 rõ như ban ngày.',
    'Lót dép ngồi xem các cao thủ xuống xác.'
  ],
  crash: [
    'Ván trước bay lên x18 mới nổ, đỉnh chóp!',
    'Tầm này gồng tới x3 là ấm rồi ae.',
    'Nhảy dù sớm cho an toàn, tham thì thâm.',
    'Ối giời ơi vừa bấm cược chưa kịp bay đã nổ x1.02, cay thế!',
    'Không chiến sinh tử gồng lãi đỉnh cao quá!',
    'Gồng x50 giàu sang luôn.',
    'Tên lửa này chạy bằng cơm hay sao bay khỏe thế!',
    'Rút sớm ăn chắc mặc bền ae ạ.',
    'Kỷ lục ván trước ai gồng x88 không?',
    'Mạnh mẽ lên phi thuyền ơi, vút bay nào 🚀'
  ],
  penalty: [
    'Thủ môn đội bạn hôm nay ngáo ngơ quá, cứ sút góc trái là vào.',
    'Thần sút phạt ván này nhắm góc cao bên phải nhé!',
    'Đặt vào TRƯỢT kiếm cơm cháo qua ngày thôi.',
    'Sút căng đét lủng lưới đối phương luôn!',
    'Ối giời ơi thủ môn bay người như chim bắt được bóng kìa 🦅',
    'Cổ vũ ván này vào lưới rinh Jackpot.',
    'Góc chết hiểm hóc thế ai mà đỡ nổi.',
    'Trọng tài bắt thiên vị quá nha haha.',
    'Bắn chim rồi tiền đạo ơi 🤣',
    'Khán đài đang cháy hết mình cổ vũ!'
  ]
};

export default function LiveStreamPanel({ uid, user, onShowResult }: LiveStreamPanelProps) {
  const [activeTab, setActiveTab] = useState<GameType>('taixiu');
  const [betChoice, setBetChoice] = useState<string>('');
  const [betAmount, setBetAmount] = useState<string>('');
  const [activeViewerCount, setActiveViewerCount] = useState<number>(195);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [chatInput, setChatInput] = useState<string>('');
  
  // Realtime messages restricted strictly to latest 10 messages for neatness
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; message: string; isUser?: boolean; isSystem?: boolean; time: string }>>([]);
  
  // Track Picture-in-Picture mode
  const [isPipActive, setIsPipActive] = useState<boolean>(() => {
    return localStorage.getItem('s88_live_pip_active') === 'true';
  });

  const [currentBetPlaced, setCurrentBetPlaced] = useState<{
    cycleId: number;
    amount: number;
    choice: string;
    evaluated: boolean;
    game: GameType;
  } | null>(null);

  const [hasCashedOut, setHasCashedOut] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Live real-time scrolling bets list
  interface LiveBet {
    sender: string;
    amount: number;
    choice: string;
    isUser?: boolean;
    isBot?: boolean;
  }
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);

  // Game Engine Duration Constants (Synced perfectly with LiveCasinoStream)
  const txCycleDuration = 35000;
  const txBettingSecs = 20;
  const txShakingSecs = 4;
  const txRevealSecs = 6;

  const txCycleId = Math.floor(currentTime / txCycleDuration);
  const txTimeElapsed = currentTime % txCycleDuration;
  const txSecondsElapsed = txTimeElapsed / 1000;

  let txPhase: 'BETTING' | 'SHAKING' | 'REVEAL' | 'COOLDOWN' = 'BETTING';
  let txTimerText = '';
  let txCountdown = 0;

  if (txSecondsElapsed < txBettingSecs) {
    txPhase = 'BETTING';
    txCountdown = Math.ceil(txBettingSecs - txSecondsElapsed);
    txTimerText = `Nhận cược: ${txCountdown}s`;
  } else if (txSecondsElapsed < txBettingSecs + txShakingSecs) {
    txPhase = 'SHAKING';
    txTimerText = 'Dealer đang lắc hũ...';
  } else if (txSecondsElapsed < txBettingSecs + txShakingSecs + txRevealSecs) {
    txPhase = 'REVEAL';
    txTimerText = 'Đang mở bát!';
  } else {
    txPhase = 'COOLDOWN';
    txCountdown = Math.ceil(txCycleDuration / 1000 - txSecondsElapsed);
    txTimerText = `Chuẩn bị ván mới: ${txCountdown}s`;
  }

  const crashCycleDuration = 30000;
  const crashBettingSecs = 10;
  const crashFlightSecs = 15;

  const crashCycleId = Math.floor(currentTime / crashCycleDuration);
  const crashTimeElapsed = currentTime % crashCycleDuration;
  const crashSecondsElapsed = crashTimeElapsed / 1000;

  let crashPhase: 'BETTING' | 'FLIGHT' | 'COOLDOWN' = 'BETTING';
  let crashTimerText = '';
  let crashCountdown = 0;

  if (crashSecondsElapsed < crashBettingSecs) {
    crashPhase = 'BETTING';
    crashCountdown = Math.ceil(crashBettingSecs - crashSecondsElapsed);
    crashTimerText = `Đặt cược: ${crashCountdown}s`;
  } else if (crashSecondsElapsed < crashBettingSecs + crashFlightSecs) {
    crashPhase = 'FLIGHT';
    crashTimerText = 'PHI THUYỀN ĐANG BAY!';
  } else {
    crashPhase = 'COOLDOWN';
    crashCountdown = Math.ceil(crashCycleDuration / 1000 - crashSecondsElapsed);
    crashTimerText = `Chuẩn bị phóng: ${crashCountdown}s`;
  }

  const penCycleDuration = 40000;
  const penBettingSecs = 25;
  const penShootingSecs = 5;

  const penCycleId = Math.floor(currentTime / penCycleDuration);
  const penTimeElapsed = currentTime % penCycleDuration;
  const penSecondsElapsed = penTimeElapsed / 1000;

  let penPhase: 'BETTING' | 'SHOOTING' | 'COOLDOWN' = 'BETTING';
  let penTimerText = '';
  let penCountdown = 0;

  if (penSecondsElapsed < penBettingSecs) {
    penPhase = 'BETTING';
    penCountdown = Math.ceil(penBettingSecs - penSecondsElapsed);
    penTimerText = `Nhận cược: ${penCountdown}s`;
  } else if (penSecondsElapsed < penBettingSecs + penShootingSecs) {
    penPhase = 'SHOOTING';
    penTimerText = 'Cầu thủ chuẩn bị sút...';
  } else {
    penPhase = 'COOLDOWN';
    penCountdown = Math.ceil(penCycleDuration / 1000 - penSecondsElapsed);
    penTimerText = `Lượt sút tiếp theo: ${penCountdown}s`;
  }

  // Admin/Teacher commission pay credit helper (5% of the bet amount goes to admin automatically)
  const payAdminCommission = async (betAmount: number) => {
    const commission = Math.floor(betAmount * 0.05); // 5% house commission
    if (commission <= 0) return;
    try {
      const usersRef = ref(db, 'users');
      const snap = await get(usersRef);
      if (snap.exists()) {
        const updates: Record<string, any> = {};
        snap.forEach((child) => {
          const val = child.val();
          if (val.role === 'TEACHER') {
            const currentTeacherPP = val.pp || 0;
            updates[`users/${child.key}/pp`] = currentTeacherPP + commission;
          }
        });
        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
          console.log(`Paid ${commission} PP admin commission to teacher(s)`);
        }
      }
    } catch (err) {
      console.error('Error paying admin commission:', err);
    }
  };

  // Time-synchronized clock ticks
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      setActiveViewerCount((prev) => {
        const diff = Math.floor(Math.random() * 5) - 2;
        const next = prev + diff;
        return next < 160 ? 160 : next > 280 ? 280 : next;
      });
    }, 100);

    // Initial warm greetings
    setChatMessages([
      { sender: 'HỆ THỐNG', message: 'Hệ thống Live Stream S-System 88 đã trực tuyến. Bố cục tối ưu, mượt mà tuyệt đối!', isSystem: true, time: 'Now' },
      { sender: 'Dealer Vy Vy 💖', message: 'Em chào anh chị ạ! Chúc cả nhà chơi live vui vẻ, đại thắng rực rỡ nhé!', isSystem: true, time: 'Now' }
    ]);

    return () => clearInterval(timer);
  }, []);

  // Bot simulation chats (Keep only latest 10 items)
  useEffect(() => {
    const chatBotInterval = setInterval(() => {
      const randomBot = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const gameComments = BOT_COMMENTS[activeTab];
      const randomComment = gameComments[Math.floor(Math.random() * gameComments.length)];
      
      setChatMessages((prev) => {
        const updated = [...prev, {
          sender: randomBot,
          message: randomComment,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }];
        // Strictly keep only the last 10 messages as requested
        return updated.slice(-10);
      });
    }, 4500);

    return () => clearInterval(chatBotInterval);
  }, [activeTab]);

  // Keep chat auto-scrolled
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Synchronized Live Betting Board Simulation
  useEffect(() => {
    // Reset live bets at the start of a round/cycle
    setLiveBets([]);

    // Populate initial randomized seed bets right away
    const initialBets: LiveBet[] = [];
    const seedCount = Math.floor(Math.random() * 4) + 4; // 4 to 7 starting bets
    const choices = activeTab === 'taixiu' ? ['TAI', 'XIU'] :
                    activeTab === 'crash' ? ['CRASH_RIDE'] :
                    ['GOAL', 'MISS', 'QUAD_0', 'QUAD_1', 'QUAD_2', 'QUAD_3', 'QUAD_4'];

    for (let i = 0; i < seedCount; i++) {
      const bot = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const amount = Math.floor(Math.random() * 9 + 1) * 2000 + 1000;
      const choice = choices[Math.floor(Math.random() * choices.length)];
      initialBets.push({ sender: bot, amount, choice, isBot: true });
    }
    setLiveBets(initialBets);

    // Periodically feed new bets when in the BETTING phase
    const betTickInterval = setInterval(() => {
      let isBettingPhase = false;
      if (activeTab === 'taixiu') isBettingPhase = txPhase === 'BETTING';
      else if (activeTab === 'crash') isBettingPhase = crashPhase === 'BETTING';
      else isBettingPhase = penPhase === 'BETTING';

      if (isBettingPhase && Math.random() < 0.75) {
        const bot = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        const amount = Math.floor(Math.random() * 12 + 1) * 1000 + 500;
        const choice = choices[Math.floor(Math.random() * choices.length)];
        setLiveBets((prev) => {
          const updated = [...prev, { sender: bot, amount, choice, isBot: true }];
          return updated.slice(-15); // limit length
        });
      }
    }, 1800);

    return () => clearInterval(betTickInterval);
  }, [activeTab, txCycleId, crashCycleId, penCycleId, txPhase, crashPhase, penPhase]);

  // Broadcast PIP state changes dynamically
  const togglePip = () => {
    const nextState = !isPipActive;
    setIsPipActive(nextState);
    if (nextState) {
      localStorage.setItem('s88_live_pip_active', 'true');
      localStorage.setItem('s88_live_pip_game', activeTab);
    } else {
      localStorage.removeItem('s88_live_pip_active');
      localStorage.removeItem('s88_live_pip_game');
    }
    // Fire event to notify App.tsx immediately
    window.dispatchEvent(new Event('s88_pip_update'));
  };

  // Sync active tab to PIP context
  useEffect(() => {
    if (isPipActive) {
      localStorage.setItem('s88_live_pip_game', activeTab);
      window.dispatchEvent(new Event('s88_pip_update'));
    }
  }, [activeTab, isPipActive]);

  // Get synchronized outcomes based on cycle index
  const getSyncResultForCycle = (cycleId: number, type: GameType) => {
    const seed = cycleId * 12345.678;
    const rand = () => {
      const x = Math.sin(seed + Math.cos(seed * 2.3)) * 10000;
      return x - Math.floor(x);
    };
    
    const r1 = rand();
    const r2 = rand();
    const r3 = rand();
    
    if (type === 'taixiu') {
      const d1 = Math.floor(r1 * 6) + 1;
      const d2 = Math.floor(r2 * 2.1) + Math.floor(r3 * 3) + 1;
      const d3 = Math.floor((r1 + r2) * 3) % 6 + 1;
      const d1f = d1 < 1 ? 1 : d1 > 6 ? 6 : d1;
      const d2f = d2 < 1 ? 1 : d2 > 6 ? 6 : d2;
      const d3f = d3 < 1 ? 1 : d3 > 6 ? 6 : d3;
      return { dices: [d1f, d2f, d3f] };
    } else if (type === 'crash') {
      const baseChance = r1;
      let mult = 1.0;
      if (baseChance < 0.1) {
        mult = 1.0 + baseChance * 2;
      } else if (baseChance < 0.8) {
        mult = 1.2 + (baseChance - 0.1) * 3;
      } else {
        mult = 3.3 + Math.pow((baseChance - 0.8) * 10, 2.5);
      }
      return parseFloat(Math.min(mult, 88.8).toFixed(2));
    } else {
      const strikerTarget = Math.floor(r1 * 5);
      const goalieDive = Math.floor(r2 * 5);
      const isGoal = strikerTarget !== goalieDive && r3 > 0.12;
      return { target: strikerTarget, dive: goalieDive, isGoal };
    }
  };

  const currentTxResult = getSyncResultForCycle(txCycleId, 'taixiu') as { dices: number[] };
  const currentCrashPoint = getSyncResultForCycle(crashCycleId, 'crash') as number;
  const currentPenResult = getSyncResultForCycle(penCycleId, 'penalty') as { target: number; dive: number; isGoal: boolean };

  let currentCrashMultiplier = 1.0;
  if (crashPhase === 'FLIGHT') {
    const flightElapsed = crashSecondsElapsed - crashBettingSecs;
    currentCrashMultiplier = parseFloat((1.0 + Math.pow(flightElapsed / 3.5, 2.2)).toFixed(2));
    if (currentCrashMultiplier >= currentCrashPoint) {
      currentCrashMultiplier = currentCrashPoint;
    }
  } else if (crashPhase === 'COOLDOWN') {
    currentCrashMultiplier = currentCrashPoint;
  }

  // Auto-evaluation logic on phase change
  useEffect(() => {
    if (!currentBetPlaced || currentBetPlaced.game !== 'taixiu') return;
    if (txPhase === 'BETTING') {
      if (currentBetPlaced && currentBetPlaced.cycleId !== txCycleId) {
        setCurrentBetPlaced(null);
      }
      return;
    }

    if (txPhase === 'REVEAL' && currentBetPlaced && currentBetPlaced.cycleId === txCycleId && !currentBetPlaced.evaluated) {
      const dices = currentTxResult.dices;
      const sum = dices[0] + dices[1] + dices[2];
      const isTriple = dices[0] === dices[1] && dices[1] === dices[2];
      const isTai = sum >= 11;
      
      const won = !isTriple && ((currentBetPlaced.choice === 'TAI' && isTai) || (currentBetPlaced.choice === 'XIU' && !isTai));
      const profit = won ? currentBetPlaced.amount * 2 : 0;
      
      const handleEvaluateTx = async () => {
        try {
          const uSnap = await get(ref(db, `users/${uid}`));
          const freshPP = uSnap.val()?.pp || 0;
          let netProfit = profit - currentBetPlaced.amount;
          
          if (profit > 0) {
            await update(ref(db, `users/${uid}`), { pp: freshPP + profit });

            // Increment daily missions Tai Xiu wins
            const todayStr = new Date().toLocaleDateString('sv-SE');
            const mRef = ref(db, `users/${uid}/daily_missions/${todayStr}`);
            const mSnap = await get(mRef);
            const currentWins = mSnap.val()?.taiXiuWins || 0;
            await update(mRef, { taiXiuWins: currentWins + 1 });
          }

          await push(ref(db, 'game_logs'), {
            uid,
            name: user?.name || 'Sinh Viên',
            game: 'Live Stream Tài Xỉu',
            bet: currentBetPlaced.amount,
            pnl: netProfit,
            result: isTriple ? 'Bão (Thua)' : won ? 'Thắng' : 'Thua',
            time: new Date().toLocaleString('vi-VN'),
            timestamp: Date.now()
          });

          const winMsg = won 
            ? `Chúc mừng sếp! Kết quả: ${dices.join('-')} (${sum} nút - ${isTai ? 'TÀI' : 'XỈU'}). Nhận về +${profit.toLocaleString()} PP!`
            : `Rất tiếc! Kết quả: ${dices.join('-')} (${sum} nút - ${isTai ? 'TÀI' : 'XỈU'}). Mất cọc cược.`;
          
          onShowResult(
            won ? 'LIVE TÀI XỈU - THẮNG LỚN' : 'LIVE TÀI XỈU - THUA TRẬN',
            winMsg,
            won
          );

          setCurrentBetPlaced((prev) => prev ? { ...prev, evaluated: true } : null);
        } catch (err) {
          console.error(err);
        }
      };

      handleEvaluateTx();
    }
  }, [txPhase, currentBetPlaced, txCycleId, uid, user]);

  useEffect(() => {
    if (!currentBetPlaced || currentBetPlaced.game !== 'crash') return;
    if (crashPhase === 'BETTING') {
      setHasCashedOut(false);
      if (currentBetPlaced && currentBetPlaced.cycleId !== crashCycleId) {
        setCurrentBetPlaced(null);
      }
    }

    if (crashPhase === 'COOLDOWN' && currentBetPlaced && currentBetPlaced.cycleId === crashCycleId && !currentBetPlaced.evaluated) {
      if (!hasCashedOut) {
        const handleLoseCrash = async () => {
          try {
            await push(ref(db, 'game_logs'), {
              uid,
              name: user?.name || 'Sinh Viên',
              game: 'Live Phi Thuyền Crash',
              bet: currentBetPlaced.amount,
              pnl: -currentBetPlaced.amount,
              result: 'Thua (Crash)',
              time: new Date().toLocaleString('vi-VN'),
              timestamp: Date.now()
            });

            onShowResult(
              'PHI THUYỀN BỊ BẮN HỎNG 💥',
              `Phi thuyền đã phát nổ tại ${currentCrashPoint}x trước khi bạn kịp chốt lời! Mất cọc ${currentBetPlaced.amount.toLocaleString()} PP.`,
              false
            );

            setCurrentBetPlaced((prev) => prev ? { ...prev, evaluated: true } : null);
          } catch (err) {
            console.error(err);
          }
        };
        handleLoseCrash();
      }
    }
  }, [crashPhase, currentBetPlaced, crashCycleId, hasCashedOut, uid, user]);

  useEffect(() => {
    if (!currentBetPlaced || currentBetPlaced.game !== 'penalty') return;
    if (penPhase === 'BETTING') {
      if (currentBetPlaced && currentBetPlaced.cycleId !== penCycleId) {
        setCurrentBetPlaced(null);
      }
      return;
    }

    if (penPhase === 'SHOOTING' && currentBetPlaced && currentBetPlaced.cycleId === penCycleId && !currentBetPlaced.evaluated) {
      const res = currentPenResult;
      
      const isCorrectChoice = (
        (currentBetPlaced.choice === 'GOAL' && res.isGoal) ||
        (currentBetPlaced.choice === 'MISS' && !res.isGoal) ||
        (currentBetPlaced.choice === `QUAD_${res.target}` && res.isGoal)
      );

      let mult = 1.0;
      if (isCorrectChoice) {
        if (currentBetPlaced.choice === 'GOAL') mult = 1.8;
        else if (currentBetPlaced.choice === 'MISS') mult = 2.0;
        else if (currentBetPlaced.choice.startsWith('QUAD_')) mult = 4.5;
      }

      const payout = isCorrectChoice ? Math.floor(currentBetPlaced.amount * mult) : 0;
      const won = payout > 0;

      const handleEvaluatePenalty = async () => {
        try {
          const uSnap = await get(ref(db, `users/${uid}`));
          const freshPP = uSnap.val()?.pp || 0;
          let netProfit = payout - currentBetPlaced.amount;
          
          if (payout > 0) {
            await update(ref(db, `users/${uid}`), { pp: freshPP + payout });
          }

          await push(ref(db, 'game_logs'), {
            uid,
            name: user?.name || 'Sinh Viên',
            game: 'Live Penalty Shootout',
            bet: currentBetPlaced.amount,
            pnl: netProfit,
            result: won ? 'Thắng' : 'Thua',
            time: new Date().toLocaleString('vi-VN'),
            timestamp: Date.now()
          });

          const quadrantLabels = ['Góc Cao Trái', 'Góc Cao Phải', 'Góc Dưới Trái', 'Góc Dưới Phải', 'Chính Giữa'];
          const targetName = quadrantLabels[res.target];
          
          let resultMsg = res.isGoal
            ? `Cầu thủ sút hiểm hóc vào [${targetName}]! VÀO!!!`
            : `Cầu thủ sút về hướng [${targetName}]. Thủ môn quá xuất sắc ôm gọn! TRƯỢT.`;

          onShowResult(
            won ? 'LIVE PENALTY - THẮNG LỚN ⚽' : 'LIVE PENALTY - HỤT KÈO 💀',
            `${resultMsg}\n\nĐặt cược: ${currentBetPlaced.choice}\nKết quả: ${won ? `+${payout.toLocaleString()}` : `-${currentBetPlaced.amount.toLocaleString()}`} PP.`,
            won
          );

          setCurrentBetPlaced((prev) => prev ? { ...prev, evaluated: true } : null);
        } catch (err) {
          console.error(err);
        }
      };

      handleEvaluatePenalty();
    }
  }, [penPhase, currentBetPlaced, penCycleId, uid, user]);

  const handlePlaceBet = async () => {
    const amt = parseInt(betAmount);
    if (!betChoice) {
      alert('Vui lòng chọn cửa cược!');
      return;
    }
    if (isNaN(amt) || amt <= 100) {
      alert('Mức cược tối thiểu là 100 PP!');
      return;
    }

    const currentPP = user?.pp || 0;
    if (currentPP < amt) {
      alert(`Bạn không có đủ ${amt.toLocaleString()} PP!`);
      return;
    }

    let currentCycle = 0;
    if (activeTab === 'taixiu') {
      if (txPhase !== 'BETTING') {
        alert('Hết thời gian cược ván này!');
        return;
      }
      currentCycle = txCycleId;
    } else if (activeTab === 'crash') {
      if (crashPhase !== 'BETTING') {
        alert('Phi thuyền đã cất cánh!');
        return;
      }
      currentCycle = crashCycleId;
    } else {
      if (penPhase !== 'BETTING') {
        alert('Lượt sút đền đã diễn ra!');
        return;
      }
      currentCycle = penCycleId;
    }

    try {
      await update(ref(db, `users/${uid}`), { pp: currentPP - amt });

      // Credit 5% commission of the bet amount directly to Admin/Teacher accounts
      await payAdminCommission(amt);

      // If playing Crash, increment daily mission rides count
      if (activeTab === 'crash') {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const mRef = ref(db, `users/${uid}/daily_missions/${todayStr}`);
        const mSnap = await get(mRef);
        const currentRides = mSnap.val()?.crashRides || 0;
        await update(mRef, { crashRides: currentRides + 1 });
      }

      setCurrentBetPlaced({
        cycleId: currentCycle,
        amount: amt,
        choice: betChoice,
        evaluated: false,
        game: activeTab
      });

      // Insert user bet into the list
      setLiveBets((prev) => [
        ...prev,
        {
          sender: user?.name || 'Sinh Viên',
          amount: amt,
          choice: betChoice,
          isUser: true
        }
      ]);

      setChatMessages((prev) => {
        const updated = [
          ...prev,
          {
            sender: 'Dealer Vy Vy 💖',
            message: `Sếp vừa đặt cược ${amt.toLocaleString()} PP vào cửa [${betChoice}]! May mắn nha sếp!`,
            isSystem: true,
            time: 'Now'
          }
        ];
        return updated.slice(-10);
      });
    } catch (err) {
      alert('Lỗi kết nối máy chủ sòng bài!');
    }
  };

  const handleCrashCashout = async () => {
    if (crashPhase !== 'FLIGHT' || !currentBetPlaced || currentBetPlaced.cycleId !== crashCycleId || currentBetPlaced.evaluated || hasCashedOut) return;

    if (currentCrashMultiplier >= currentCrashPoint) {
      alert('Tên lửa đã nổ!');
      return;
    }

    setHasCashedOut(true);
    const winMult = currentCrashMultiplier;
    const payout = Math.floor(currentBetPlaced.amount * winMult);

    try {
      const uSnap = await get(ref(db, `users/${uid}`));
      const freshPP = uSnap.val()?.pp || 0;
      await update(ref(db, `users/${uid}`), { pp: freshPP + payout });

      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Live Phi Thuyền Crash',
        bet: currentBetPlaced.amount,
        pnl: payout - currentBetPlaced.amount,
        result: `Thắng (Chốt x${winMult})`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      onShowResult(
        'RÚT QUÂN THÀNH CÔNG! 🚀',
        `Chúc mừng bạn chốt lời tại x${winMult}! Húp về +${payout.toLocaleString()} PP!`,
        true
      );

      setCurrentBetPlaced((prev) => prev ? { ...prev, evaluated: true } : null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput('');

    setChatMessages((prev) => {
      const updated = [
        ...prev,
        {
          sender: user?.name || 'Sinh Viên',
          message: userMsg,
          isUser: true,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ];
      return updated.slice(-10);
    });

    if (userMsg.toLowerCase().includes('lắc') || userMsg.toLowerCase().includes('tài') || userMsg.toLowerCase().includes('xỉu')) {
      setTimeout(() => {
        setChatMessages((prev) => {
          const updated = [
            ...prev,
            {
              sender: 'Dealer Vy Vy 💖',
              message: 'Cầu đang chạy đẹp lắm nè sếp, đặt cược đi ạ!',
              isSystem: true,
              time: 'Now'
            }
          ];
          return updated.slice(-10);
        });
      }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Standardized aspect-ratio-locked grid of uniformly sized stream thumbnails */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Tài Xỉu Stream Thumbnail */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setActiveTab('taixiu'); setBetChoice(''); }}
          className={`relative aspect-[16/9] w-full rounded-2xl overflow-hidden border font-mono text-xs transition-all cursor-pointer flex flex-col justify-between p-4 group ${
            activeTab === 'taixiu'
              ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
              : 'border-white/5 bg-black/60 hover:border-white/20'
          }`}
        >
          {/* Background image preview */}
          <div className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1596838132731-3301c3fd4317?auto=format&fit=crop&w=300&q=80')" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60 z-[1]" />

          {/* Top Info */}
          <div className="z-10 flex justify-between items-center w-full">
            <span className="py-0.5 px-2 bg-red-600 text-white font-black text-[8px] uppercase tracking-wider rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-ping" />
              LIVE
            </span>
            <span className="text-[9px] text-white/70 font-bold bg-black/40 py-0.5 px-2 rounded-md border border-white/5 backdrop-blur-sm">
              1,240 xem
            </span>
          </div>

          {/* Bottom Title */}
          <div className="z-10 text-left">
            <h4 className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-1">
              <span>🎲 TÀI XỈU S88</span>
            </h4>
            <p className="text-[9px] text-slate-300 mt-0.5">Dealer Vy Vy trực tiếp lắc bát</p>
          </div>
        </motion.button>

        {/* Gồng Lãi Stream Thumbnail */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setActiveTab('crash'); setBetChoice(''); }}
          className={`relative aspect-[16/9] w-full rounded-2xl overflow-hidden border font-mono text-xs transition-all cursor-pointer flex flex-col justify-between p-4 group ${
            activeTab === 'crash'
              ? 'border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.25)]'
              : 'border-white/5 bg-black/60 hover:border-white/20'
          }`}
        >
          {/* Background image preview */}
          <div className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=300&q=80')" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60 z-[1]" />

          {/* Top Info */}
          <div className="z-10 flex justify-between items-center w-full">
            <span className="py-0.5 px-2 bg-cyan-500 text-black font-black text-[8px] uppercase tracking-wider rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-black inline-block animate-ping" />
              FLYING
            </span>
            <span className="text-[9px] text-white/70 font-bold bg-black/40 py-0.5 px-2 rounded-md border border-white/5 backdrop-blur-sm">
              842 xem
            </span>
          </div>

          {/* Bottom Title */}
          <div className="z-10 text-left">
            <h4 className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-1">
              <span>🚀 KHÔNG CHIẾN S88</span>
            </h4>
            <p className="text-[9px] text-slate-300 mt-0.5">Phi thuyền bay cao nhân x100</p>
          </div>
        </motion.button>

        {/* Sút Phạt Stream Thumbnail */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setActiveTab('penalty'); setBetChoice(''); }}
          className={`relative aspect-[16/9] w-full rounded-2xl overflow-hidden border font-mono text-xs transition-all cursor-pointer flex flex-col justify-between p-4 group ${
            activeTab === 'penalty'
              ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
              : 'border-white/5 bg-black/60 hover:border-white/20'
          }`}
        >
          {/* Background image preview */}
          <div className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=300&q=80')" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60 z-[1]" />

          {/* Top Info */}
          <div className="z-10 flex justify-between items-center w-full">
            <span className="py-0.5 px-2 bg-emerald-500 text-black font-black text-[8px] uppercase tracking-wider rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-black inline-block animate-ping" />
              STADIUM
            </span>
            <span className="text-[9px] text-white/70 font-bold bg-black/40 py-0.5 px-2 rounded-md border border-white/5 backdrop-blur-sm">
              2,110 xem
            </span>
          </div>

          {/* Bottom Title */}
          <div className="z-10 text-left">
            <h4 className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-1">
              <span>⚽ SÚT PHẠT 3D S88</span>
            </h4>
            <p className="text-[9px] text-slate-300 mt-0.5">Sân vận động rực lửa kịch tính</p>
          </div>
        </motion.button>
      </div>

      {/* Grid container: balanced, sleek, bento layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Stream & Betting HUD container (Span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Main stream player screen */}
          <div className="relative aspect-video w-full rounded-2xl bg-black border border-white/5 overflow-hidden flex flex-col justify-between p-4 shadow-2xl group">
            
            {/* Stream HUD */}
            <div className="z-10 flex justify-between items-start w-full">
              <div className="flex items-center gap-2">
                <span className="py-1 px-2.5 bg-red-600 text-white font-black text-[9px] uppercase tracking-wider rounded-md flex items-center gap-1.5">
                  <motion.span 
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="w-1.5 h-1.5 rounded-full bg-white inline-block"
                  />
                  LIVE STREAMS88
                </span>
                <span className="py-1 px-2 bg-black/70 border border-white/10 text-white font-mono text-[9px] rounded-md flex items-center gap-1">
                  <Users className="w-3 h-3 text-red-500 animate-pulse" />
                  {activeViewerCount} người xem
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePip}
                  className={`py-1 px-2.5 rounded-md text-[9px] font-mono font-bold uppercase cursor-pointer flex items-center gap-1 transition-all ${
                    isPipActive 
                      ? 'bg-red-600/20 border border-red-500 text-red-400 text-glow-red' 
                      : 'bg-black/60 border border-white/10 text-white hover:bg-white/10'
                  }`}
                  title="Bật/Tắt chế độ xem thu nhỏ góc màn hình (PIP)"
                >
                  <Maximize2 className="w-3 h-3" />
                  {isPipActive ? 'PIP: BẬT' : 'CHẾ ĐỘ PIP'}
                </button>
                <span className="py-1 px-2 bg-black/60 border border-white/10 text-white font-mono text-[9px] rounded-md">
                  1080P HD
                </span>
              </div>
            </div>

            {/* Simulated Stream stage area */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
              
              {/* TAI XIU STAGE */}
              {activeTab === 'taixiu' && (
                <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-[#0e0707] to-[#1c0f0f]">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.02)_1px,transparent_1px)] bg-[size:16px_16px]" />
                  
                  {/* Dealer Bubble representation */}
                  <div className="absolute bottom-3 left-4 flex items-center gap-2">
                    <img 
                      src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=80&h=80" 
                      alt="Dealer" 
                      className="w-10 h-10 rounded-full border border-red-500/50 object-cover shadow-lg"
                    />
                    <div className="bg-black/70 border border-white/5 py-1 px-2.5 rounded-xl text-[9px] text-white">
                      {txPhase === 'BETTING' ? 'Hãy vào cược đi ạ!' : txPhase === 'SHAKING' ? 'Em lắc đĩa nha... 🎲' : 'Chuẩn bị mở bát!'}
                    </div>
                  </div>

                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <div className="absolute w-36 h-10 bg-amber-950/80 rounded-full border-2 border-amber-900 bottom-3"></div>
                    
                    {/* Shaker cup with Framer Motion bounce when shaking */}
                    <motion.div 
                      animate={txPhase === 'SHAKING' ? {
                        y: [0, -12, 0, -12, 0],
                        rotate: [0, 8, -8, 8, 0],
                      } : txPhase === 'REVEAL' ? {
                        y: -60,
                        opacity: 0.15,
                        scale: 0.85
                      } : txPhase === 'COOLDOWN' ? {
                        y: -80,
                        opacity: 0
                      } : {
                        y: 0,
                        opacity: 1,
                        scale: 1
                      }}
                      transition={{
                        duration: txPhase === 'SHAKING' ? 0.3 : 0.6,
                        repeat: txPhase === 'SHAKING' ? Infinity : 0
                      }}
                      className="absolute bottom-6 w-20 h-20 bg-gradient-to-b from-yellow-600 to-amber-700 border border-yellow-400 rounded-t-full shadow-2xl flex flex-col items-center justify-center"
                    >
                      <div className="w-full h-0.5 bg-yellow-400/50 my-1"></div>
                      <span className="text-white text-[8px] font-bold font-mono tracking-wider">LAS VEGAS</span>
                      <div className="w-full h-0.5 bg-yellow-400/50 my-1"></div>
                    </motion.div>

                    {/* Dices reveal */}
                    {(txPhase === 'REVEAL' || txPhase === 'COOLDOWN' || txPhase === 'BETTING') && (
                      <div className="absolute bottom-6 flex gap-2">
                        {currentTxResult.dices.map((dieVal, idx) => (
                          <motion.div 
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 12 }}
                            transition={{ type: "spring", delay: idx * 0.1 }}
                            key={idx} 
                            className="w-8 h-8 bg-white border border-slate-300 rounded-lg flex items-center justify-center shadow-lg font-black text-slate-900 text-sm"
                          >
                            {dieVal}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {txPhase === 'REVEAL' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-12 py-1 px-3 bg-black/90 border border-red-500/40 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white"
                    >
                      KẾT QUẢ: {currentTxResult.dices.reduce((a, b) => a + b, 0)} nút ({currentTxResult.dices.reduce((a, b) => a + b, 0) >= 11 ? 'TÀI' : 'XỈU'})
                    </motion.div>
                  )}
                </div>
              )}

              {/* ROCKET CRASH STAGE */}
              {activeTab === 'crash' && (
                <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-[#030910] to-[#061120]">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />
                  
                  {/* Floating Rocket */}
                  {crashPhase === 'FLIGHT' && (
                    <motion.div 
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                      className="absolute bottom-1/4 left-1/4"
                      style={{
                        transform: `translate(${Math.min(crashSecondsElapsed * 16, 140)}px, -${Math.min(crashSecondsElapsed * 9, 90)}px) rotate(45deg)`
                      }}
                    >
                      <div className="relative">
                        <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-6 h-3 bg-cyan-400 rounded-full blur-xs animate-ping" />
                        <span className="text-4xl">🚀</span>
                      </div>
                    </motion.div>
                  )}

                  {crashPhase === 'COOLDOWN' && (
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-5xl animate-bounce">💥</span>
                      <span className="text-white font-mono text-[10px] uppercase bg-black/80 py-1 px-3 border border-red-500/30 rounded-xl mt-2 font-bold">
                        BUMMM! CRASHED @ <span className="text-red-500">{currentCrashPoint}x</span>
                      </span>
                    </div>
                  )}

                  {crashPhase === 'FLIGHT' && (
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-glow-cyan text-cyan-400 text-4xl font-mono font-black">
                        {currentCrashMultiplier}x
                      </span>
                      <span className="text-[9px] text-white/40 font-mono tracking-widest mt-1">PHI THUYỀN ĐANG BAY CAO...</span>
                    </div>
                  )}

                  {crashPhase === 'BETTING' && (
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-glow-cyan text-cyan-400 text-2xl font-mono font-black animate-pulse">
                        CHUẨN BỊ BAY 🚀
                      </span>
                      <span className="text-[10px] text-white/70 font-mono tracking-widest mt-1.5 bg-black/60 py-1 px-3.5 border border-cyan-500/30 rounded-xl">
                        MỞ ĐẶT CƯỢC: {crashCountdown}s
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* PENALTY STAGE */}
              {activeTab === 'penalty' && (
                <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-[#02210a] to-[#011405]">
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-emerald-950/40 border-t border-emerald-500/20" />
                  
                  {/* Flashing Soccer Banner Ad Overlays - Unofficial Web Lậu Aesthetic */}
                  <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 pointer-events-none scale-[0.8] origin-top-left">
                    <span className="bg-red-600/90 border border-red-500 text-white font-black text-[9px] py-0.5 px-2.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-lg">
                      S88.BET - ĐẦU TRƯỜNG VIP ⭐️
                    </span>
                    <span className="bg-yellow-500 text-black font-black text-[8px] py-0.5 px-2 rounded uppercase tracking-wider shadow">
                      🎁 QUAY THẦN SẦU - LUCKWHEEL 24H
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 z-20 pointer-events-none scale-[0.8] origin-top-right">
                    <div className="bg-black/80 border border-emerald-500/40 py-1 px-3 rounded-lg flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                      <span className="text-white font-mono text-[9px] font-black uppercase">LIVE CHUNG KẾT S88</span>
                    </div>
                  </div>

                  {/* Soccer Stadium score panel */}
                  <div className="absolute top-12 z-10 flex items-center bg-black/80 border border-white/10 px-4 py-1.5 rounded-full font-mono text-[10px] shadow-2xl gap-3">
                    <span className="text-emerald-400 font-bold">SINH VIÊN</span>
                    <span className="text-white font-black bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">1</span>
                    <span className="text-white/40 font-bold">:</span>
                    <span className="text-white font-black bg-red-950 px-2 py-0.5 rounded border border-red-500/30">1</span>
                    <span className="text-red-400 font-bold">S-BOT</span>
                    <span className="text-yellow-400 font-black animate-pulse px-1.5 border border-yellow-500/20 rounded">90'</span>
                  </div>

                  {/* Goal and Net */}
                  <div className="relative w-80 h-36 border-4 border-white/60 border-b-0 rounded-t-xl flex justify-center items-end bottom-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_1.5px,transparent_1.5px)] bg-[size:8px_8px]" />
                    
                    {/* Goal corners targets visual indicators */}
                    <div className="absolute inset-x-4 top-2 bottom-2 grid grid-cols-2 grid-rows-2 gap-x-28 gap-y-12 opacity-30 pointer-events-none">
                      <div className="border border-dashed border-yellow-400/40 rounded flex items-center justify-center text-[7px] text-yellow-300">G1</div>
                      <div className="border border-dashed border-yellow-400/40 rounded flex items-center justify-center text-[7px] text-yellow-300">G2</div>
                      <div className="border border-dashed border-yellow-400/40 rounded flex items-center justify-center text-[7px] text-yellow-300">G3</div>
                      <div className="border border-dashed border-yellow-400/40 rounded flex items-center justify-center text-[7px] text-yellow-300">G4</div>
                    </div>

                    {/* Keeper */}
                    <div className="absolute bottom-0 w-14 h-20 bg-gradient-to-b from-orange-500 to-amber-700 rounded-t-full border-2 border-white flex flex-col items-center justify-center shadow-2xl transition-all duration-300"
                      style={
                        penPhase === 'SHOOTING'
                          ? {
                              transform: `translate(${
                                currentPenResult.dive === 0 ? '-85px' :
                                currentPenResult.dive === 1 ? '85px' :
                                currentPenResult.dive === 2 ? '-60px, 15px' :
                                currentPenResult.dive === 3 ? '60px, 15px' : '0'
                              })`
                            }
                          : {}
                      }
                    >
                      <span className="text-2xl">🧤</span>
                      <span className="text-[8px] font-mono font-black text-white bg-black/60 px-1 rounded-sm border border-white/10 uppercase tracking-widest">GK</span>
                    </div>

                    {/* Football ball path */}
                    {penPhase === 'SHOOTING' && (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.2, ease: "linear" }}
                        className="absolute bottom-[-32px] w-8 h-8 rounded-full bg-white border border-slate-900 flex items-center justify-center text-sm shadow-[0_0_15px_rgba(255,255,255,0.6)] transition-all duration-500"
                        style={{
                          transform: `translate(${
                            currentPenResult.target === 0 ? '-95px, -110px' :
                            currentPenResult.target === 1 ? '95px, -110px' :
                            currentPenResult.target === 2 ? '-75px, -40px' :
                            currentPenResult.target === 3 ? '75px, -40px' : '0px, -65px'
                          }) scale(0.6)`
                        }}
                      >
                        ⚽
                      </motion.div>
                    )}
                  </div>

                  {penPhase === 'COOLDOWN' && (
                    <div className="absolute bottom-16 text-center z-10 bg-black/75 px-5 py-2 rounded-2xl border border-white/10 shadow-2xl">
                      <span className={`font-black font-mono text-base text-glow tracking-widest block ${
                        currentPenResult.isGoal ? 'text-[#00ff80] text-glow-emerald animate-bounce' : 'text-red-500 text-glow-red'
                      }`}>
                        {currentPenResult.isGoal ? '⚽ GOOOAAALLL!!! VÀO!!!' : '🧤 CẢN PHÁ XUẤT THẦN!'}
                      </span>
                      <span className="text-[9px] text-[#8b949e] font-mono block mt-1 uppercase">
                        {currentPenResult.isGoal ? 'Ghim chặt bóng vào góc chết' : 'Thủ môn ôm gọn trái bóng tròn'}
                      </span>
                    </div>
                  )}

                  {penPhase === 'BETTING' && (
                    <div className="absolute bottom-16 text-center z-10">
                      <span className="text-glow-emerald text-emerald-400 text-[10px] font-mono font-black bg-black/80 py-1.5 px-4 rounded-full border border-emerald-500/20 tracking-wider animate-pulse uppercase">
                        ⚽ LƯỢT ĐÁ THỜI GIAN THỰC ĐANG MỞ ⚽
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Bottom HUD */}
            <div className="z-10 flex justify-between items-center w-full font-mono text-[10px]">
              <span className="flex items-center gap-1 font-bold text-white uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                {activeTab === 'taixiu' ? txTimerText : activeTab === 'crash' ? crashTimerText : penTimerText}
              </span>
              <span className="text-white/40">Phát trực tiếp #S88-LIV-0{activeTab === 'taixiu' ? txCycleId : activeTab === 'crash' ? crashCycleId : penCycleId}</span>
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
          </div>

          {/* Real-time Betting Board & Total Pools */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Total Pools Card */}
            <div className="md:col-span-5 glass-box p-4 border-[#ffd700]/20 bg-yellow-950/5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-1">📊 TỔNG TIỀN CƯỢC VÁN NÀY</span>
                <span className="text-glow-gold text-[#ffd700] text-2xl font-black font-mono">
                  {liveBets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} PP
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 font-mono text-[10px]">
                {activeTab === 'taixiu' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-red-400">🔴 TỔNG CỬA TÀI:</span>
                      <span className="font-bold text-white">
                        {liveBets.filter(b => b.choice === 'TAI').reduce((sum, b) => sum + b.amount, 0).toLocaleString()} PP
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-400">🔵 TỔNG CỬA XỈU:</span>
                      <span className="font-bold text-white">
                        {liveBets.filter(b => b.choice === 'XIU').reduce((sum, b) => sum + b.amount, 0).toLocaleString()} PP
                      </span>
                    </div>
                  </>
                )}
                {activeTab === 'crash' && (
                  <div className="flex justify-between">
                    <span className="text-cyan-400">🚀 TỔNG TIỀN GỒNG LÃI:</span>
                    <span className="font-bold text-white">
                      {liveBets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} PP
                    </span>
                  </div>
                )}
                {activeTab === 'penalty' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-emerald-400">⚽ TỔNG CỬA VÀO (GOAL):</span>
                      <span className="font-bold text-white">
                        {liveBets.filter(b => b.choice === 'GOAL').reduce((sum, b) => sum + b.amount, 0).toLocaleString()} PP
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-400">🧤 TỔNG THỦ MÔN CẢN (MISS):</span>
                      <span className="font-bold text-white">
                        {liveBets.filter(b => b.choice === 'MISS').reduce((sum, b) => sum + b.amount, 0).toLocaleString()} PP
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Live Scrolling Bets Board */}
            <div className="md:col-span-7 glass-box p-4 border-white/5 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
                ⚡ HOẠT ĐỘNG ĐẶT CƯỢC LIVE (MỚI NHẤT)
              </span>
              <div className="h-28 overflow-y-auto space-y-1.5 scrollbar-thin pr-1 font-mono text-[10px] text-slate-300">
                {liveBets.length === 0 ? (
                  <div className="text-white/20 italic text-center py-6">Đang đợi người chơi xuống tiền...</div>
                ) : (
                  [...liveBets].reverse().map((bet, idx) => (
                    <div key={idx} className={`flex justify-between items-center py-1 px-2 rounded ${
                      bet.isUser ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-black/20'
                    }`}>
                      <span className="font-bold truncate max-w-[120px]">{bet.isUser ? '⭐️ BẠN' : bet.sender}</span>
                      <div className="flex items-center gap-2">
                        <span className="bg-white/5 px-1.5 py-0.5 rounded text-white/70 text-[8px]">
                          {bet.choice === 'TAI' ? 'TÀI' : 
                           bet.choice === 'XIU' ? 'XỈU' : 
                           bet.choice === 'CRASH_RIDE' ? 'PHI THUYỀN' : 
                           bet.choice === 'GOAL' ? 'BẤT KỲ VÀO' : 
                           bet.choice === 'MISS' ? 'THỦ MÔN CẢN' : bet.choice.startsWith('QUAD_') ? `SÚT G.${parseInt(bet.choice.split('_')[1]) + 1}` : bet.choice}
                        </span>
                        <span className="text-[#ffd700] font-black">+{bet.amount.toLocaleString()} PP</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Place Bet Panel */}
          <div className="glass-box p-4 border-white/5 flex flex-col gap-3">
            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-mono mb-2">1. Chọn cửa cược hợp lệ:</span>
              
              {activeTab === 'taixiu' && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled={txPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === txCycleId)}
                    onClick={() => setBetChoice('TAI')}
                    className={`py-3 rounded-xl border font-mono text-xs font-black transition-all cursor-pointer ${
                      betChoice === 'TAI'
                        ? 'bg-red-500/20 border-red-500 text-red-500'
                        : 'bg-black/40 border-white/5 text-white/70 hover:bg-white/5'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    TÀI (11-17 NÚT) [ x2.0 ]
                  </button>
                  <button
                    disabled={txPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === txCycleId)}
                    onClick={() => setBetChoice('XIU')}
                    className={`py-3 rounded-xl border font-mono text-xs font-black transition-all cursor-pointer ${
                      betChoice === 'XIU'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-500'
                        : 'bg-black/40 border-white/5 text-white/70 hover:bg-white/5'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    XỈU (4-10 NÚT) [ x2.0 ]
                  </button>
                </div>
              )}

              {activeTab === 'crash' && (
                <div className="flex flex-col gap-2">
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-[11px] font-mono text-cyan-400 leading-relaxed text-center">
                    🌟 Đặt cược và chốt lời (CÁSHOUT) khi phi thuyền đang bay. Tên lửa phát nổ trước chốt lời, mất cược!
                  </div>
                  <button
                    disabled={crashPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === crashCycleId)}
                    onClick={() => setBetChoice('CRASH_RIDE')}
                    className={`w-full py-3 rounded-xl border font-mono text-xs font-black transition-all cursor-pointer ${
                      betChoice === 'CRASH_RIDE'
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-500'
                        : 'bg-black/40 border-white/5 text-white/70 hover:bg-white/5'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    [ CHỌN BAY PHI THUYỀN ]
                  </button>
                </div>
              )}

              {activeTab === 'penalty' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={penPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === penCycleId)}
                      onClick={() => setBetChoice('GOAL')}
                      className={`py-3 rounded-xl border font-mono text-xs font-black transition-all cursor-pointer ${
                        betChoice === 'GOAL'
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                          : 'bg-black/40 border-white/5 text-white/70 hover:bg-white/5'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      BẤT KỲ GÓC VÀO [ x1.8 ]
                    </button>
                    <button
                      disabled={penPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === penCycleId)}
                      onClick={() => setBetChoice('MISS')}
                      className={`py-3 rounded-xl border font-mono text-xs font-black transition-all cursor-pointer ${
                        betChoice === 'MISS'
                          ? 'bg-red-500/20 border-red-500 text-red-500'
                          : 'bg-black/40 border-white/5 text-white/70 hover:bg-white/5'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      THỦ MÔN CẢN PHÁ [ x2.0 ]
                    </button>
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-400 uppercase font-mono my-2 text-center">HOẶC CƯỢC GÓC SÚT HIỂM HÓC CHỈ ĐỊNH (X4.5):</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {['Góc Cao Trái', 'Góc Cao Phải', 'Góc Dưới Trái', 'Góc Dưới Phải', 'Chính Giữa'].map((lbl, idx) => (
                        <button
                          key={idx}
                          disabled={penPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === penCycleId)}
                          onClick={() => setBetChoice(`QUAD_${idx}`)}
                          className={`py-2 rounded-lg border font-mono text-[9px] font-black transition-all cursor-pointer text-center ${
                            betChoice === `QUAD_${idx}`
                              ? 'bg-amber-500/20 border-amber-500 text-amber-500'
                              : 'bg-black/40 border-white/5 text-white/60 hover:bg-white/5'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={lbl}
                        >
                          Sút G.{idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-stretch mt-1">
              <div className="flex-1 flex gap-2 font-mono text-xs">
                <input
                  type="number"
                  placeholder="Nhập mức PP cược..."
                  className="bg-black/40 border border-[#30363d] rounded-lg p-3 text-center text-[#ffd700] text-glow-gold font-bold w-2/3 focus:border-red-500 focus:outline-none"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  disabled={
                    activeTab === 'taixiu' ? txPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === txCycleId) :
                    activeTab === 'crash' ? crashPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === crashCycleId) :
                    penPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === penCycleId)
                  }
                />
                
                <div className="grid grid-cols-2 gap-1 w-1/3">
                  <button 
                    onClick={() => setBetAmount('1000')}
                    className="bg-black/40 border border-white/5 hover:bg-white/5 text-[9px] font-bold rounded cursor-pointer"
                  >
                    1K
                  </button>
                  <button 
                    onClick={() => setBetAmount('5000')}
                    className="bg-black/40 border border-white/5 hover:bg-white/5 text-[9px] font-bold rounded cursor-pointer"
                  >
                    5K
                  </button>
                </div>
              </div>

              {activeTab === 'crash' && crashPhase === 'FLIGHT' && currentBetPlaced && currentBetPlaced.cycleId === crashCycleId && !currentBetPlaced.evaluated ? (
                <button
                  onClick={handleCrashCashout}
                  className="py-3 px-6 bg-gradient-to-r from-cyan-600 to-cyan-500 text-black font-mono font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center gap-1 w-full sm:w-auto shrink-0"
                >
                  🚀 CHỐT X{currentCrashMultiplier} (ĂN {Math.floor(currentBetPlaced.amount * currentCrashMultiplier)} PP)
                </button>
              ) : (
                <button
                  disabled={
                    activeTab === 'taixiu' ? txPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === txCycleId) :
                    activeTab === 'crash' ? crashPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === crashCycleId) :
                    penPhase !== 'BETTING' || (currentBetPlaced !== null && currentBetPlaced.cycleId === penCycleId)
                  }
                  onClick={handlePlaceBet}
                  className="py-3 px-6 bg-red-600 hover:bg-red-500 text-white font-mono font-black text-xs uppercase tracking-widest rounded-xl disabled:bg-slate-800 disabled:text-white/30 disabled:border-transparent disabled:cursor-not-allowed hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-1 w-full sm:w-auto shrink-0"
                >
                  <Coins className="w-4 h-4" /> [ XÁC NHẬN CƯỢC LIVE ]
                </button>
              )}
            </div>

            {currentBetPlaced && (
              <div className="py-2.5 px-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex justify-between items-center text-[10px] font-mono mt-1 text-yellow-400">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  ĐÃ KHÓA CƯỢC: {currentBetPlaced.amount.toLocaleString()} PP cửa [{currentBetPlaced.choice}]
                </span>
                <span>
                  {currentBetPlaced.evaluated ? '✅ ĐÃ KẾT TOÁN' : '⏳ CHỜ KẾT QUẢ'}
                </span>
              </div>
            )}

          </div>

        </div>

        {/* RIGHT COLUMN: Chat Sidebar - STRICTLY strictly limited to last 10 messages (Span 4) */}
        <div className="lg:col-span-4 flex flex-col h-[380px] lg:h-auto min-h-[350px] glass-box border-white/5 overflow-hidden">
          
          <div className="bg-black/60 border-b border-white/5 py-3 px-4 flex justify-between items-center shrink-0">
            <span className="font-mono text-[11px] font-black text-white tracking-wider flex items-center gap-1">
              💬 PHÒNG CHÁT LIVE (MỚI NHẤT)
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Messages container - compact, vertical layout, exactly 10 latest messages shown */}
          <div 
            ref={chatContainerRef}
            className="flex-1 p-3 overflow-y-auto space-y-2 font-sans scrollbar-thin bg-black/20"
          >
            {chatMessages.map((msg, index) => {
              if (msg.isSystem) {
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={index} 
                    className="bg-white/5 border border-white/5 rounded-lg p-2 text-[#ff4500] font-mono text-[10px] leading-relaxed"
                  >
                    <strong className="font-bold mr-1">{msg.sender}:</strong>
                    {msg.message}
                  </motion.div>
                );
              }
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={index} 
                  className={`flex flex-col gap-0.5 max-w-[90%] ${
                    msg.isUser ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <span className="text-[9px] text-[#8b949e] font-mono font-bold">
                    {msg.sender}
                  </span>
                  <div className={`py-1.5 px-2.5 rounded-xl leading-relaxed text-[11px] font-medium whitespace-pre-line ${
                    msg.isUser 
                      ? 'bg-red-600 text-white rounded-tr-none' 
                      : 'bg-black/50 border border-[#30363d] text-white rounded-tl-none'
                  }`}>
                    {msg.message}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Compact Input */}
          <form 
            onSubmit={handleSendChat}
            className="p-2.5 bg-black/40 border-t border-white/5 flex gap-2 shrink-0 font-mono text-xs"
          >
            <input
              type="text"
              placeholder="Nhập nội dung chát..."
              className="flex-1 bg-black/50 border border-[#30363d] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-red-500"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button
              type="submit"
              className="px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all cursor-pointer flex items-center justify-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
