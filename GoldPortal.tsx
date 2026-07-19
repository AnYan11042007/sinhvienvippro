/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, onValue, update, push, remove } from 'firebase/database';
import { db } from '../firebase';
import { Coins, TrendingUp, TrendingDown, MessageSquare, Send, Zap, Activity, Clock, ShieldAlert } from 'lucide-react';
import { User, GoldMarket, GoldChatMessage } from '../types';
import { Chart, registerables } from 'chart.js';
import { motion, AnimatePresence } from 'motion/react';

Chart.register(...registerables);

interface GoldPortalProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function GoldPortal({ uid, user, onShowResult }: GoldPortalProps) {
  const [market, setGoldMarket] = useState<GoldMarket | null>(null);
  const [chatMessages, setChatMessages] = useState<GoldChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  // Trade amounts
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [lastTradeTime, setLastTradeTime] = useState(0);

  // Countdown timer for 60s cycle
  const [secondsLeft, setSecondsLeft] = useState(60);

  // References for Chart and Chat scroll
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Load live Gold Market values
  useEffect(() => {
    const goldRef = ref(db, 'market/gold');
    const unsubscribe = onValue(goldRef, (snap) => {
      if (snap.exists()) {
        setGoldMarket(snap.val() as GoldMarket);
      }
    });
    return () => unsubscribe();
  }, []);

  // Update countdown timer based on market.lastUpdate
  useEffect(() => {
    const timer = setInterval(() => {
      if (market?.lastUpdate) {
        const elapsed = Math.floor((Date.now() - market.lastUpdate) / 1000);
        const left = Math.max(0, 60 - (elapsed % 60));
        setSecondsLeft(left);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [market?.lastUpdate]);

  // Load market group chat messages
  useEffect(() => {
    const chatRef = ref(db, 'market/chat');
    const unsubscribe = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list: GoldChatMessage[] = Object.keys(data).map((k) => ({
         id: k,
         ...data[k]
      }));
      // Sort asc by timestamp
      list.sort((a, b) => a.timestamp - b.timestamp);
      // Keep only last 50
      setChatMessages(list.slice(-50));
    });
    return () => unsubscribe();
  }, []);

  // Auto scroll chat to bottom when new messages land
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Initial and refresh cycle for Line Chart using Chart.js
  useEffect(() => {
    if (!canvasRef.current || !market || !market.history) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const historyData = market.history;
    const isUp = market.price >= market.oldPrice;
    const accentColor = isUp ? '#00ff80' : '#ff003c';

    // Labels for 60 iterations (simplified)
    const labels = historyData.map((_, idx) => {
      const date = new Date(Date.now() - (historyData.length - 1 - idx) * 60000);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    });

    if (chartInstanceRef.current) {
      // Update chart data directly for faster performance
      const chart = chartInstanceRef.current;
      chart.data.labels = labels;
      chart.data.datasets[0].data = historyData;
      chart.data.datasets[0].borderColor = accentColor;
      chart.update('none'); // Update without full animation for speed
    } else {
      // Create new chart
      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Gold Price',
            data: historyData,
            borderColor: accentColor,
            borderWidth: 2,
            tension: 0.15,
            pointRadius: 0,
            fill: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: {
              display: true,
              grid: { display: false },
              ticks: { color: '#555555', maxTicksLimit: 6, font: { size: 9 } }
            },
            y: {
              position: 'right',
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
              ticks: { color: '#888888', font: { size: 9 } }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    return () => {
      // Cleanup chart on unmount or recreation
    };
  }, [market]);

  // Handle fully clean destruction of Chart.js on component unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // Compute live local values
  const rawPrice = market?.price || 50000000;
  const buyPrice = Math.floor(rawPrice * 1.0035);
  const sellPrice = Math.floor(rawPrice * 0.9965);
  const priceChange = rawPrice - (market?.oldPrice || rawPrice);
  const priceChangePercent = ((priceChange / (market?.oldPrice || rawPrice)) * 100).toFixed(2);
  const isUp = priceChange >= 0;

  // Portfolio calculations
  const myGoldAmount = user?.gold?.amount || 0;
  const myGoldAvg = user?.gold?.avgPrice || 0;
  const currentVal = myGoldAmount * sellPrice;
  const initialInvestedVal = myGoldAmount * myGoldAvg;
  const myPnL = Math.floor(currentVal - initialInvestedVal);
  const myPnLPercent = initialInvestedVal > 0 ? ((myPnL / initialInvestedVal) * 100).toFixed(2) : '0.00';

  // Calculate dynamic market metrics from actual history data
  const calculateVolatilityMetrics = () => {
    if (!market || !market.history || market.history.length < 2) {
      return {
        volatility: 1.25,
        rsi: 50,
        support: rawPrice * 0.96,
        resistance: rawPrice * 1.04,
        status: 'ỔN ĐỊNH'
      };
    }

    const prices = market.history;
    const count = prices.length;

    // 1. Support & Resistance (Min/Max of history)
    const support = Math.min(...prices);
    const resistance = Math.max(...prices);

    // 2. Standard Deviation of Prices (Volatility)
    const mean = prices.reduce((a, b) => a + b, 0) / count;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    const volatilityPercent = (stdDev / mean) * 100;

    let status = 'BÌNH THƯỜNG 💎';
    if (volatilityPercent > 2.5) {
      status = 'BIẾN ĐỘNG CỰC ĐỘ 🔥';
    } else if (volatilityPercent > 1.5) {
      status = 'SÓNG LỚN ⚡';
    } else if (volatilityPercent < 0.6) {
      status = 'TÍCH LŨY THẤP 💤';
    }

    // 3. Simple 14-period RSI
    let avgGain = 0;
    let avgLoss = 0;
    const rsiPeriod = Math.min(14, count - 1);
    for (let i = count - rsiPeriod; i < count; i++) {
      const difference = prices[i] - prices[i - 1];
      if (difference > 0) {
        avgGain += difference;
      } else {
        avgLoss += Math.abs(difference);
      }
    }
    avgGain /= rsiPeriod;
    avgLoss /= rsiPeriod;

    let rsi = 50;
    if (avgLoss === 0) {
      rsi = 100;
    } else if (avgGain !== 0) {
      const rs = avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
    }

    return {
      volatility: volatilityPercent,
      rsi,
      support,
      resistance,
      status
    };
  };

  const metrics = calculateVolatilityMetrics();

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;

    setChatInput('');
    try {
      await push(ref(db, 'market/chat'), {
        uid: uid,
        name: user?.name || 'Sinh Viên',
        msg: text,
        time: new Date().toLocaleTimeString('vi-VN'),
        timestamp: Date.now()
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBuyGold = async () => {
    const now = Date.now();
    if (now - lastTradeTime < 3000) {
      onShowResult('GIAO DỊCH CHẬM', 'Vui lòng đợi 3 giây giữa các lần giao dịch vàng để bảo vệ hệ thống!', false);
      return;
    }

    const amt = parseFloat(buyAmount);
    if (isNaN(amt) || amt < 0.01) {
      onShowResult('MUA THẤT BẠI', 'Số lượng vàng mua tối thiểu là 0.01 GOLD!', false);
      return;
    }

    const totalCost = Math.floor(amt * buyPrice);
    const userPP = user?.pp || 0;

    if (userPP < totalCost) {
      onShowResult('KHÔNG ĐỦ PP', `Bạn không đủ PP để thực hiện giao dịch này!\nChi phí: ${totalCost.toLocaleString()} PP\nVí của bạn: ${userPP.toLocaleString()} PP`, false);
      return;
    }

    try {
      setLastTradeTime(now);
      const currentGold = user?.gold || { amount: 0, avgPrice: 0 };
      const newAmount = currentGold.amount + amt;
      const newAvg = ((currentGold.amount * currentGold.avgPrice) + totalCost) / newAmount;

      // Update state
      await update(ref(db, `users/${uid}`), {
        pp: userPP - totalCost,
        gold: {
          amount: newAmount,
          avgPrice: newAvg
        }
      });

      // Write logs
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Mua Vàng',
        bet: totalCost,
        pnl: 0,
        result: `Mua thành công +${amt.toFixed(2)} GOLD`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      setBuyAmount('');
      onShowResult('MUA VÀNG THÀNH CÔNG', `Đã mua thành công +${amt.toLocaleString()} GOLD!\nTrừ phí giao dịch: -${totalCost.toLocaleString()} PP.\nGiá mua trung bình: ${Math.floor(newAvg).toLocaleString()} PP/GOLD.`, true);
    } catch (err) {
      alert('Lỗi khi mua Vàng!');
    }
  };

  const handleSellGold = async () => {
    const now = Date.now();
    if (now - lastTradeTime < 3000) {
      onShowResult('GIAO DỊCH CHẬM', 'Vui lòng đợi 3 giây giữa các lần giao dịch vàng để bảo vệ hệ thống!', false);
      return;
    }

    const amt = parseFloat(sellAmount);
    if (isNaN(amt) || amt < 0.01) {
      onShowResult('BÁN THẤT BẠI', 'Số lượng bán tối thiểu là 0.01 GOLD!', false);
      return;
    }

    if (myGoldAmount < amt) {
      onShowResult('LỖI KHÔNG ĐỦ VÀNG', `Bạn không có đủ số lượng vàng cần bán!\nVí vàng: ${myGoldAmount.toFixed(2)} GOLD\nYêu cầu bán: ${amt.toFixed(2)} GOLD`, false);
      return;
    }

    const totalEarned = Math.floor(amt * sellPrice);
    const costOfAmt = Math.floor(amt * myGoldAvg);
    const profit = totalEarned - costOfAmt;
    const userPP = user?.pp || 0;

    try {
      setLastTradeTime(now);
      const nextAmount = myGoldAmount - amt;

      const userRef = ref(db, `users/${uid}`);
      if (nextAmount > 0.00001) {
        await update(userRef, {
          pp: userPP + totalEarned,
          gold: {
            amount: nextAmount,
            avgPrice: myGoldAvg
          }
        });
      } else {
        // Remove gold portfolio key if fully sold out
        await update(userRef, { pp: userPP + totalEarned });
        await remove(ref(db, `users/${uid}/gold`));
      }

      // Update total trade statistics profit/loss
      const currentStatsProfit = user?.gold_stats?.totalProfit || 0;
      await update(ref(db, `users/${uid}/gold_stats`), {
        totalProfit: currentStatsProfit + profit
      });

      // Write logs
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: 'Bán Vàng',
        bet: costOfAmt,
        pnl: profit,
        result: profit >= 0 ? `Chốt lời +${profit.toLocaleString()} PP` : `Cắt lỗ -${Math.abs(profit).toLocaleString()} PP`,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      setSellAmount('');
      onShowResult(
        profit >= 0 ? 'BÁN VÀNG CHỐT LỜI' : 'BÁN VÀNG CẮT LỖ',
        `Đã bán thành công -${amt.toLocaleString()} GOLD!\nThu hồi dòng tiền: +${totalEarned.toLocaleString()} PP.\nLợi nhuận thực tế: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()} PP!`,
        profit >= 0
      );
    } catch (err) {
      alert('Lỗi khi bán vàng!');
    }
  };

  const fillAllGold = () => {
    if (myGoldAmount > 0) {
      setSellAmount(myGoldAmount.toFixed(2));
    }
  };

  // SVG ring logic for 60s countdown
  const ringRadius = 16;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (secondsLeft / 60) * ringCircumference;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      id="tab-gold" 
      className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs"
    >
      <div className="md:col-span-3 glass-box p-6 border-b border-[#ffd700]/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-amber-950/20 via-black/40 to-cyan-950/20">
        <div className="flex items-center gap-3">
          <Coins className="w-8 h-8 text-[#ffd700] animate-bounce shrink-0" />
          <div>
            <h2 className="text-[#ffd700] text-glow-gold text-2xl font-black uppercase tracking-widest leading-none">
              SÀN GIAO DỊCH VÀNG CHỢ ĐEN
            </h2>
            <p className="text-[10px] text-[#8b949e] uppercase mt-1">Hệ thống khớp lệnh tức thời & Biến động sau mỗi 60 giây</p>
          </div>
        </div>

        {/* Live Timer badge */}
        <div className="flex items-center gap-3 bg-black/60 border border-white/5 py-2 px-4 rounded-xl shrink-0">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg className="absolute w-full h-full -rotate-90">
              <circle
                cx="18"
                cy="18"
                r={ringRadius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="2.5"
              />
              <circle
                cx="18"
                cy="18"
                r={ringRadius}
                fill="none"
                stroke={secondsLeft <= 10 ? '#ff003c' : '#00f0ff'}
                strokeWidth="2.5"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                className="transition-all duration-1000"
              />
            </svg>
            <span className={`text-[11px] font-black tracking-tighter ${secondsLeft <= 10 ? 'text-[#ff003c] text-glow-red animate-pulse' : 'text-[#00f0ff] text-glow-blue'}`}>
              {secondsLeft}s
            </span>
          </div>
          <div>
            <div className="text-[8px] uppercase text-[#8b949e]">Chu kỳ tiếp theo</div>
            <div className="text-[10px] font-black text-white font-mono">{market?.updateTimeString || 'ĐỒNG BỘ...'}</div>
          </div>
        </div>
      </div>

      {/* Pricing / Graph columns */}
      <div className="md:col-span-2 space-y-6">
        {/* Pricing Dashboard */}
        <div className="bg-black/60 border border-white/5 p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute top-2.5 right-4 text-[9px] font-black tracking-widest text-[#8b949e]">
            XU HƯỚNG: <span style={{ color: market?.statusColor || '#aaa' }} className="animate-pulse">{market?.statusText || 'ỔN ĐỊNH'}</span>
          </div>

          <div className="text-center md:text-left space-y-1">
            <h4 className="text-[#8b949e] font-bold text-[10px] uppercase tracking-wider">Giá vàng quy đổi thực</h4>
            <h1 className="text-[#ffd700] text-glow-gold text-3xl font-black tracking-widest">
              {buyPrice.toLocaleString()} <span className="text-xs text-white/50">PP / MUA</span>
            </h1>
            <h2 className="text-[#ff003c] text-glow-red text-xl font-bold font-mono">
              {sellPrice.toLocaleString()} <span className="text-[10px] text-white/50">PP / BÁN</span>
            </h2>
          </div>

          <div className="text-center md:text-right space-y-2">
            <div className={`text-base font-black flex items-center justify-center md:justify-end gap-1 ${isUp ? 'text-emerald-400 text-glow-green' : 'text-[#ff003c] text-glow-red'}`}>
              <span className="text-lg">{isUp ? '📈' : '📉'}</span>
              <span>{isUp ? '↑ +' : '↓ '}{Math.abs(priceChange).toLocaleString()} PP ({isUp ? '+' : ''}{priceChangePercent}%)</span>
            </div>
            <div className="text-[#8b949e] text-[9px] font-bold uppercase tracking-wider flex items-center justify-center md:justify-end gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Cập nhật: {market?.updateTimeString ? `${market.updateTimeString}` : 'Đồng bộ...'}</span>
            </div>
          </div>
        </div>

        {/* Realtime Line Chart Canvas */}
        <div className="bg-black/60 border border-white/5 p-4 rounded-2xl">
          <div className="flex justify-between items-center text-[10px] font-bold text-[#8b949e] mb-3 px-1 uppercase">
            <span>📈 BIỂU ĐỒ DAO ĐỘNG (60 CHU KỲ)</span>
            <span>GOLD / PP INDEX</span>
          </div>
          <div className="h-[250px] relative w-full overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
        </div>

        {/* Real-time Technical & Volatility Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Volatility Indicator card */}
          <div className="glass-box p-4 bg-black/40 border-white/5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="text-[10px] font-bold text-[#ffd700] uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-glow-gold text-[#ffd700] animate-pulse" /> ĐỘ BIẾN ĐỘNG THỊ TRƯỜNG
              </h4>
              <span className="text-[9px] font-extrabold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white font-mono">
                {metrics.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-[#8b949e] mb-1">
                  <span>Chỉ Số Biến Động (60m)</span>
                  <span className="text-white font-bold">{metrics.volatility.toFixed(2)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.min(100, metrics.volatility * 25)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1 text-[10px] font-mono">
                <div className="bg-black/50 p-2 rounded border border-white/5">
                  <span className="text-[#8b949e] block text-[8px] uppercase">Hỗ Trợ (Hạn Đáy)</span>
                  <span className="text-white font-extrabold">{metrics.support.toLocaleString()} PP</span>
                </div>
                <div className="bg-black/50 p-2 rounded border border-white/5">
                  <span className="text-[#8b949e] block text-[8px] uppercase">Kháng Cự (Hạn Đỉnh)</span>
                  <span className="text-white font-extrabold">{metrics.resistance.toLocaleString()} PP</span>
                </div>
              </div>
            </div>
          </div>

          {/* RSI / Market Pressure Indicator Card */}
          <div className="glass-box p-4 bg-black/40 border-white/5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h4 className="text-[10px] font-bold text-[#00f0ff] uppercase flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-glow-blue text-[#00f0ff] animate-pulse" /> SỨC MẠNH TƯƠNG ĐỐI (RSI)
              </h4>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                metrics.rsi >= 70 ? 'bg-red-950/20 border border-red-500/30 text-red-400' :
                metrics.rsi <= 30 ? 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-400' :
                'bg-cyan-950/20 border border-[#00f0ff]/30 text-[#00f0ff]'
              }`}>
                {metrics.rsi >= 70 ? 'QUÁ MUA ⚠️' : metrics.rsi <= 30 ? 'QUÁ BÁN 💎' : 'TRUNG LẬP ⚡'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-[#8b949e] mb-1">
                  <span>RSI Chỉ Số (14 Chu Kỳ)</span>
                  <span className="text-white font-bold">{metrics.rsi.toFixed(1)}</span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                  {/* Highlight the 30-70 safe zone */}
                  <div className="absolute left-[30%] right-[30%] h-full bg-[#00f0ff]/10 z-0 border-l border-r border-dashed border-[#00f0ff]/20"></div>
                  <div 
                    className={`h-full z-10 rounded-full transition-all duration-1000 ${
                      metrics.rsi >= 70 ? 'bg-[#ff003c]' : metrics.rsi <= 30 ? 'bg-emerald-400' : 'bg-[#00f0ff]'
                    }`}
                    style={{ width: `${metrics.rsi}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1 text-[10px] font-mono">
                <div className="bg-black/50 p-2 rounded border border-white/5">
                  <span className="text-[#8b949e] block text-[8px] uppercase">Lượng Mua (Volume)</span>
                  <span className="text-emerald-400 font-extrabold">{(market?.volumeBuy || 240000).toLocaleString()} PP</span>
                </div>
                <div className="bg-black/50 p-2 rounded border border-white/5">
                  <span className="text-[#8b949e] block text-[8px] uppercase">Lượng Bán (Volume)</span>
                  <span className="text-[#ff003c] font-extrabold">{(market?.volumeSell || 190000).toLocaleString()} PP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trade controls & Chat columns */}
      <div className="space-y-6">
        {/* My Wallet / Portfolio Card */}
        <div className="glass-box p-5 bg-gradient-to-br from-white/[0.03] to-transparent border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <h3 className="text-sm font-bold border-b border-white/5 pb-2 mb-4 text-[#e6edf3] uppercase">
            DANH MỤC ĐẦU TƯ
          </h3>
          <div className="space-y-3.5 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-[#8b949e]">Đang nắm giữ:</span>
              <strong className="text-[#ffd700] text-glow-gold text-sm font-black">{myGoldAmount.toFixed(2)} GOLD</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8b949e]">Giá mua trung bình:</span>
              <strong className="text-white font-bold">{Math.floor(myGoldAvg).toLocaleString()} PP</strong>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <span className="text-[#8b949e] font-bold">Lãi / Lỗ ròng:</span>
              <strong className={`text-sm font-black ${myPnL >= 0 ? 'text-emerald-400 text-glow-green' : 'text-[#ff003c] text-glow-red'}`}>
                {myPnL >= 0 ? '+' : ''}{myPnL.toLocaleString()} PP ({myPnL >= 0 ? '+' : ''}{myPnLPercent}%)
              </strong>
            </div>
          </div>
        </div>

        {/* Buying/Selling form card */}
        <div className="glass-box p-5 bg-gradient-to-b from-cyan-950/5 to-transparent border-[#00f0ff]/30 text-xs">
          <h3 className="text-sm font-bold text-[#00f0ff] uppercase border-b border-[#30363d] pb-2.5 mb-4">
            KHU VỰC GIAO DỊCH
          </h3>

          <div className="space-y-4">
            {/* BUY */}
            <div className="space-y-2">
              <label className="block text-[#8b949e] font-bold tracking-wider uppercase">SL Vàng mua vào:</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ví dụ: 0.1, 1.5, 10..."
                  className="w-full bg-black/60 border border-[#30363d] focus:border-emerald-400 rounded-lg p-2.5 outline-none text-[#00ff80] text-sm font-bold font-mono"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                />
                <button
                  onClick={handleBuyGold}
                  className="py-2.5 px-4 bg-emerald-950/20 hover:bg-emerald-500 border border-emerald-400 text-emerald-400 hover:text-black font-extrabold rounded-lg uppercase transition-all tracking-wider cursor-pointer text-glow-green shrink-0"
                >
                  [ MUA ]
                </button>
              </div>
            </div>

            {/* SELL */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <label className="block text-[#8b949e] font-bold tracking-wider uppercase">SL Vàng bán ra:</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ví dụ: 0.5, 2.0..."
                  className="w-full bg-black/60 border border-[#30363d] focus:border-[#ff003c] rounded-lg p-2.5 outline-none text-[#ff003c] text-sm font-bold font-mono"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                />
                <button
                  onClick={fillAllGold}
                  className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-bold text-[#ffd700] transition active:scale-95 text-[10px]"
                  title="Điền toàn bộ số vàng đang có"
                >
                  MAX
                </button>
                <button
                  onClick={handleSellGold}
                  className="py-2.5 px-4 bg-red-950/20 hover:bg-[#ff003c] border border-[#ff003c] text-[#ff003c] hover:text-white font-extrabold rounded-lg uppercase transition-all tracking-wider cursor-pointer text-glow-red shrink-0"
                >
                  [ BÁN ]
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Chat Board */}
        <div className="glass-box p-4 border-[#ff00ff]/30 flex flex-col h-[280px]">
          <h3 className="text-xs font-bold text-[#ff00ff] border-b border-white/5 pb-2 mb-3.5 uppercase flex items-center gap-1.5 shrink-0">
            <MessageSquare className="w-4 h-4 text-[#ff00ff]" /> DIỄN ĐÀN THẢO LUẬN VÀNG
          </h3>
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 text-[11px] font-sans scroll-smooth"
          >
            <AnimatePresence initial={false}>
              {chatMessages.map((c) => {
                const isMe = c.uid === uid;
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    key={c.id} 
                    className="leading-relaxed whitespace-normal break-words"
                  >
                    <span className="text-[#8b949e] font-mono text-[9px] mr-1">[{c.time}]</span>
                    <b className={`font-mono mr-1.5 ${isMe ? 'text-[#00ff80]' : 'text-[#00f0ff]'}`}>{c.name}:</b>
                    <span className="text-white/90">{c.msg}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {chatMessages.length === 0 && (
              <p className="text-center text-[#8b949e] italic py-12">
                Chưa có cuộc hội thoại nào phát sinh.
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <input
              type="text"
              placeholder="Nhập nội dung thảo luận..."
              className="w-full bg-black/60 border border-[#30363d] focus:border-[#ff00ff] rounded-lg px-3 py-2 outline-none text-white text-xs font-sans"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            />
            <button
              onClick={handleSendChat}
              className="py-2 px-4 bg-pink-950/20 hover:bg-[#ff00ff] border border-[#ff00ff] text-[#ff00ff] hover:text-black font-bold rounded-lg uppercase transition-all shrink-0 cursor-pointer"
            >
              GỬI
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

