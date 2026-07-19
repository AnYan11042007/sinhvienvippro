/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { Trophy, Shield, Award, Sparkles, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string;
  pp: number;
  class: string;
}

export default function GlobalTopWinners() {
  const [topWinners, setTopWinners] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsub = onValue(usersRef, (snap) => {
      setLoading(true);
      const list: LeaderboardUser[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          const val = child.val();
          list.push({
            id: child.key!,
            name: val.name || 'Sinh Viên',
            avatar: val.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
            pp: typeof val.pp === 'number' ? val.pp : 0,
            class: val.class || 'N/A',
            activeFrame: val.activeFrame || ''
          } as any);
        });
      }
      // Sort users by PP descending and get top 5
      const sorted = list.sort((a, b) => b.pp - a.pp).slice(0, 5);
      setTopWinners(sorted);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0: // 1st Place
        return {
          bg: 'bg-gradient-to-r from-yellow-500/10 to-amber-600/5 border-yellow-400/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
          text: 'text-yellow-400 font-black',
          medal: '👑',
          medalBg: 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/30'
        };
      case 1: // 2nd Place
        return {
          bg: 'bg-gradient-to-r from-slate-400/10 to-slate-500/5 border-slate-400/30 shadow-[0_0_15px_rgba(148,163,184,0.1)]',
          text: 'text-slate-300 font-black',
          medal: '🥈',
          medalBg: 'bg-slate-400/20 text-slate-300 border border-slate-400/30'
        };
      case 2: // 3rd Place
        return {
          bg: 'bg-gradient-to-r from-amber-700/10 to-amber-800/5 border-amber-700/30 shadow-[0_0_15px_rgba(180,83,9,0.08)]',
          text: 'text-amber-500 font-bold',
          medal: '🥉',
          medalBg: 'bg-amber-700/20 text-amber-500 border border-amber-700/30'
        };
      default:
        return {
          bg: 'bg-black/30 border-white/5 hover:bg-white/5',
          text: 'text-slate-400 font-medium',
          medal: `${index + 1}`,
          medalBg: 'bg-white/5 text-slate-400 border border-white/5'
        };
    }
  };

  return (
    <div className="glass-box p-5 border-white/5 relative overflow-hidden flex flex-col justify-between h-full min-h-[420px]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div>
        {/* Header Section */}
        <h4 className="text-white font-black text-base uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2 mb-4">
          <span className="flex items-center gap-1.5">
            <Trophy className="w-5 h-5 text-yellow-400 animate-pulse" /> ĐẠI GIA HỌC ĐƯỜNG (TOP 5)
          </span>
          <span className="text-[9px] font-mono bg-yellow-500/10 border border-yellow-400 text-yellow-400 py-0.5 px-1.5 rounded uppercase tracking-wider font-bold">
            LEADERBOARD
          </span>
        </h4>

        {/* List of winners */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 font-mono text-xs text-slate-400 uppercase tracking-widest gap-2">
            <div className="w-6 h-6 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin"></div>
            <span>Đang xếp hạng...</span>
          </div>
        ) : topWinners.length === 0 ? (
          <div className="text-white/20 italic text-center font-mono py-12 text-xs border border-dashed border-white/5 rounded-lg">
            Chưa có số liệu xếp hạng học đường.
          </div>
        ) : (
          <div className="space-y-2.5">
            {topWinners.map((winner, idx) => {
              const styles = getRankStyle(idx);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  key={winner.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${styles.bg}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank Indicator */}
                    <div className={`w-6 h-6 rounded-lg font-mono text-[11px] flex items-center justify-center font-black ${styles.medalBg}`}>
                      {styles.medal}
                    </div>

                    {/* User Profile */}
                    <div className="relative shrink-0">
                      <img
                        src={winner.avatar}
                        alt={winner.name}
                        className={`w-9 h-9 rounded-full object-cover border-2 ${
                          (winner as any).activeFrame === 'gold-ring'
                            ? 'border-[#ffd700] shadow-[0_0_8px_rgba(255,215,0,0.4)]'
                            : (winner as any).activeFrame === 'neon-ring'
                              ? 'border-[#ff003c] shadow-[0_0_8px_rgba(255,0,60,0.4)] animate-pulse'
                              : (winner as any).activeFrame === 'cyber-ring'
                                ? 'border-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                                : idx === 0 ? 'border-yellow-400' : idx === 1 ? 'border-slate-300' : idx === 2 ? 'border-amber-600' : 'border-white/10'
                        }`}
                      />
                      {idx === 0 && (
                        <div className="absolute -top-1.5 -right-1.5 text-xs animate-bounce">
                          👑
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="block text-xs font-bold text-white leading-tight">
                        {winner.name}
                      </span>
                      <span className="text-[9px] text-[#8b949e] font-mono uppercase">
                        Lớp: {winner.class}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`block text-xs font-black font-mono tracking-wide ${idx === 0 ? 'text-yellow-400 text-glow-gold' : 'text-white'}`}>
                      {winner.pp.toLocaleString()} PP
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest block leading-none mt-0.5">
                      TỔNG TÀI SẢN
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase">
        <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Bảng xếp hạng cập nhật tự động thời gian thực</span>
      </div>
    </div>
  );
}
