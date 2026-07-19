/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, update, push } from 'firebase/database';
import { db } from '../../firebase';
import { X, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';
import { User } from '../../types';

interface CryptoModalProps {
  uid: string;
  user: User | null;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

interface Point {
  x: number;
  y: number;
}

export default function CryptoModal({ uid, user, onClose, onShowResult }: CryptoModalProps) {
  const [betAmount, setBetAmount] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [hasRugPulled, setHasRugPulled] = useState(false);

  // Multiplier state
  const [multiplier, setMultiplier] = useState(1.00);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tradingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rugPullPointRef = useRef<number>(1.00);
  const betRef = useRef<number>(0);

  // Chart line state variables inside ref to avoid interval closure traps
  const chartPointsRef = useRef<Point[]>([{ x: 0, y: 260 }]);
  const chartXRef = useRef<number>(0);
  const chartMultRef = useRef<number>(1.00);

  useEffect(() => {
    return () => {
      if (tradingIntervalRef.current) clearInterval(tradingIntervalRef.current);
    };
  }, []);

  const handleStartTrade = async () => {
    if (isTrading) return;

    const amt = parseInt(betAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Số vốn PP đầu tư không hợp lệ!');
      return;
    }

    const currentPP = user?.pp || 0;
    if (currentPP < amt) {
      alert(`Số dư PP không đủ để đầu tư! Ví: ${currentPP.toLocaleString()} PP.`);
      return;
    }

    setIsTrading(true);
    setHasRugPulled(false);
    setMultiplier(1.00);
    betRef.current = amt;

    // Reset chart points
    chartPointsRef.current = [{ x: 0, y: 260 }];
    chartXRef.current = 0;
    chartMultRef.current = 1.00;

    // Calculate random rug pull point (100 / (random * 100))
    const r = Math.random();
    let point = 100 / (r * 100);
    point = Math.max(1.00, Math.min(100.00, point));
    
    // 8% chance of instant rug pull
    if (Math.random() < 0.08) {
      point = 1.00;
    }
    
    rugPullPointRef.current = parseFloat(point.toFixed(2));

    try {
      // Deduct PP instantly
      await update(ref(db, `users/${uid}`), { pp: currentPP - amt });

      // Run live candlestick canvas drawing loops
      let speed = 0.003;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      tradingIntervalRef.current = setInterval(() => {
        chartMultRef.current += speed;
        speed += 0.0002; // accelerating growth curve

        const currentMult = chartMultRef.current;
        setMultiplier(currentMult);

        // Generate line path values
        chartXRef.current += 3.5;
        let cY = 260 - ((currentMult - 1.0) * 35);
        if (cY < 20) {
          // Cap drawing but add subtle random jittering for visual realism
          cY = 20 + Math.random() * 8;
        }

        chartPointsRef.current.push({ x: chartXRef.current, y: cY });

        // Keep last 180 points for buffer scrolling
        if (chartXRef.current >= 540) {
          chartPointsRef.current.shift();
        }

        // Draw line on Canvas
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.moveTo(chartPointsRef.current[0].x, chartPointsRef.current[0].y);
          ctx.strokeStyle = '#00ff80'; // Emerald Green trend line
          ctx.lineWidth = 3.5;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#00ff80';

          for (let i = 1; i < chartPointsRef.current.length; i++) {
            ctx.lineTo(chartPointsRef.current[i].x, chartPointsRef.current[i].y);
          }
          ctx.stroke();
        }

        // Check if rug pull point has been crossed
        if (currentMult >= rugPullPointRef.current) {
          clearInterval(tradingIntervalRef.current!);
          tradingIntervalRef.current = null;
          handleRugPull();
        }
      }, 40);

    } catch (err) {
      alert('Lỗi khởi động sàn giao dịch!');
      setIsTrading(false);
    }
  };

  const handleRugPull = async () => {
    setIsTrading(false);
    setHasRugPulled(true);

    const amt = betRef.current;
    const finalPoint = rugPullPointRef.current;

    // Draw final crash drop down line on Canvas
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.lineTo(chartXRef.current, 290);
      ctx.strokeStyle = '#ff003c'; // red candle drop
      ctx.shadowColor = '#ff003c';
      ctx.stroke();
    }

    try {
      // Log failure loss
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Crypto',
        bet: amt,
        pnl: -amt,
        result: `Rug Pull ở x${finalPoint.toFixed(2)} (Thua)`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      setTimeout(() => {
        onClose();
        onShowResult(
          '📉 RUG PULL !!! SẬP SÀN',
          `Nến xanh của bạn đã bị cá mập úp sọt xả hàng ở x${finalPoint.toFixed(2)}!\nTổn thất toàn bộ nguồn vốn đầu tư: -${amt.toLocaleString()} PP.`,
          false
        );
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCashOut = async () => {
    if (!isTrading || hasRugPulled) return;

    if (tradingIntervalRef.current) {
      clearInterval(tradingIntervalRef.current);
      tradingIntervalRef.current = null;
    }

    setIsTrading(false);
    const amt = betRef.current;
    const currentMult = multiplier;
    const winAmount = Math.floor(amt * currentMult);

    try {
      const uSnap = await get(ref(db, `users/${uid}`));
      const freshPP = uSnap.val()?.pp || 0;

      // Credit winnings
      await update(ref(db, `users/${uid}`), { pp: freshPP + winAmount });

      // Log success
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Crypto',
        bet: amt,
        pnl: winAmount - amt,
        result: `Chốt lời Coin x${currentMult.toFixed(2)} (Thắng)`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      setTimeout(() => {
        onClose();
        onShowResult(
          'CHỐT LỜI THÀNH CÔNG !',
          `Bạn đã bán xả hàng kịp thời ở mốc nến xanh x${currentMult.toFixed(2)}!\nNhận được dòng tiền: +${winAmount.toLocaleString()} PP!`,
          true
        );
      }, 1500);

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="overlay z-[5000]">
      <div className="glass-box login-panel max-w-[620px] p-6 border-[#ffd700] relative">
        <button 
          onClick={isTrading ? undefined : onClose} 
          disabled={isTrading}
          className={`absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition ${isTrading ? 'opacity-20 cursor-not-allowed' : ''}`}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#ffd700] text-glow-gold text-2xl font-black font-mono uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
          <TrendingUp className="w-5 h-5 text-[#ffd700]" /> TRADING CRYPTO LIVE
        </h2>
        <p className="text-[10px] font-mono text-[#8b949e] uppercase mb-5">
          Gồng lãi nến xanh và thoát hàng trước khi cá mập xả kho
        </p>

        {/* Live chart trading area */}
        <div className="relative w-full h-[280px] bg-[#050505] border-2 border-[#ffd700] rounded-xl overflow-hidden shadow-inner select-none mb-4">
          
          {/* Big multiplier backdrop */}
          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-black tracking-widest font-mono text-glow-gold text-[#ffd700]/10 z-0">
            X{multiplier.toFixed(2)}
          </div>

          <canvas ref={canvasRef} width={570} height={280} className="absolute bottom-0 left-0 w-full h-full z-10" />

          {/* Rug pull warning card overlay */}
          {hasRugPulled && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 animate-fade-in font-mono border border-[#ff003c]/50 rounded-lg">
              <h1 className="text-3xl font-black text-[#ff003c] text-glow-red tracking-widest uppercase mb-1.5 animate-bounce">
                📉 RUG PULL !!!
              </h1>
              <p className="text-xs text-[#8b949e] uppercase">SÀN ĐÃ CHÁY TÀI KHOẢN</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        {!isTrading && !hasRugPulled ? (
          <div className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-[#8b949e] uppercase font-bold tracking-wider mb-1.5">Số lượng PP đặt cược giao dịch:</label>
              <input
                type="number"
                placeholder="Nhập số PP đầu tư coin..."
                className="w-full bg-black/60 border border-[#30363d] focus:border-[#ffd700] rounded-lg p-3 text-center text-sm font-black text-[#ffd700] text-glow-gold"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
              />
            </div>

            <button
              onClick={handleStartTrade}
              className="w-full py-3.5 bg-yellow-950/20 hover:bg-[#ffd700] hover:text-black border border-[#ffd700] text-[#ffd700] font-black uppercase text-xs tracking-widest cursor-pointer rounded-xl transition-all"
            >
              [ 🚀 MUA VÀO & GỒNG LÃI ]
            </button>
          </div>
        ) : (
          <div className="font-mono">
            {isTrading ? (
              <button
                onClick={handleCashOut}
                className="w-full py-4 bg-emerald-950/20 border-2 border-dashed border-[#00ff80] text-[#00ff80] text-glow-green hover:bg-[#00ff80]/10 font-black uppercase tracking-widest text-sm rounded-xl cursor-pointer transition-all active:scale-95"
              >
                [ 💰 BÁN THOÁT HÀNG (CHỐT X{multiplier.toFixed(2)}) ]
              </button>
            ) : (
              <button
                disabled
                className="w-full py-4 bg-red-950/10 border border-[#ff003c] text-[#ff003c] text-glow-red font-black uppercase tracking-widest text-sm rounded-xl cursor-not-allowed"
              >
                📉 CHÁY TÀI KHOẢN ! RUG PULLED
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
