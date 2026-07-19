/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { Trophy, Award, TrendingUp, Calendar, Zap, Sparkles, User as UserIcon } from 'lucide-react';

interface RankingsPortalProps {
  uid: string;
  user: User | null;
}

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string;
  class: string;
  pp: number;
  stats?: number[];
  title?: string;
  goldAmount?: number;
}

export default function RankingsPortal({ uid, user }: RankingsPortalProps) {
  const [activeTab, setActiveTab] = useState<'pp' | 'academic' | 'gold'>('pp');
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snap) => {
      const list: LeaderboardUser[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          const val = child.val();
          // Exclude Admin/Teacher accounts from rankings
          if (val.role === 'TEACHER') return;
          
          list.push({
            id: child.key!,
            name: val.name || 'Sinh Viên',
            avatar: val.avatar || '',
            class: val.class || 'N/A',
            pp: val.pp || 0,
            stats: val.stats || [50, 50, 50, 50, 50],
            title: val.title || '',
            goldAmount: val.gold?.amount || 0
          });
        });
      }

      // Sort according to selected tab
      if (activeTab === 'pp') {
        list.sort((a, b) => b.pp - a.pp);
      } else if (activeTab === 'academic') {
        // Sort by Cần Cù (stats[0]) + Trí Tuệ (stats[1])
        list.sort((a, b) => {
          const scoreA = (a.stats?.[0] || 0) + (a.stats?.[1] || 0);
          const scoreB = (b.stats?.[0] || 0) + (b.stats?.[1] || 0);
          return scoreB - scoreA;
        });
      } else if (activeTab === 'gold') {
        list.sort((a, b) => (b.goldAmount || 0) - (a.goldAmount || 0));
      }

      setLeaderboard(list);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="glass-box p-6 border-amber-500/30 bg-amber-950/5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-glow-gold text-[#ffd700]" />
            <h2 className="text-xl font-black font-sans text-white tracking-wide uppercase">
              BẢNG VÀNG DANH DỰ S-SYSTEM 88
            </h2>
          </div>
          <p className="text-[11px] text-[#8b949e] font-mono mt-1 uppercase">
            Vinh danh những học bá kiêm triệu phú học đường ưu tú xuất sắc nhất
          </p>
        </div>

        {/* Categories selector */}
        <div className="flex bg-black/40 border border-white/5 rounded-xl p-1 shrink-0 font-mono text-xs">
          <button
            onClick={() => setActiveTab('pp')}
            className={`py-2 px-4 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'pp' ? 'bg-[#ffd700] text-black font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            ĐẠI GIA PP
          </button>
          <button
            onClick={() => setActiveTab('academic')}
            className={`py-2 px-4 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'academic' ? 'bg-[#ffd700] text-black font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            HỌC BÁ ACADEMIC
          </button>
          <button
            onClick={() => setActiveTab('gold')}
            className={`py-2 px-4 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'gold' ? 'bg-[#ffd700] text-black font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            TRÙM SÀN VÀNG
          </button>
        </div>
      </div>

      {/* Leaderboard rows viewport */}
      <div className="glass-box p-4 font-mono text-xs space-y-3.5 relative min-h-[300px]">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="text-glow-gold text-[#ffd700] uppercase animate-pulse">
              ĐANG ĐỒNG BỘ DỮ LIỆU...
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Headers row */}
            <div className="grid grid-cols-12 px-4 text-slate-500 font-bold uppercase text-[9px] border-b border-white/5 pb-2">
              <div className="col-span-1 text-center">HẠNG</div>
              <div className="col-span-6 pl-2">HỌ VÀ TÊN SINH VIÊN</div>
              <div className="col-span-2 text-center">LỚP</div>
              <div className="col-span-3 text-right">TÀI SẢN TRÍ TUỆ</div>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-center italic text-slate-400 py-10">Chưa có người dùng nào ghi nhận.</p>
            ) : (
              leaderboard.map((u, index) => {
                const rank = index + 1;
                const isMe = u.id === uid;
                
                // Set badge colors for top 3
                let rankColor = 'text-slate-400 border-white/10 bg-white/5';
                if (rank === 1) rankColor = 'text-black bg-[#ffd700] border-[#ffd700] text-glow-gold scale-105';
                if (rank === 2) rankColor = 'text-black bg-[#c0c0c0] border-[#c0c0c0] text-glow-white';
                if (rank === 3) rankColor = 'text-black bg-[#cd7f32] border-[#cd7f32]';

                return (
                  <div
                    key={u.id}
                    className={`grid grid-cols-12 items-center py-3.5 px-4 rounded-xl border transition-all ${
                      isMe 
                        ? 'bg-[#ff003c]/10 border-[#ff003c]/40 text-white' 
                        : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="col-span-1 flex justify-center">
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black border ${rankColor}`}>
                        {rank}
                      </span>
                    </div>

                    {/* Name & Title */}
                    <div className="col-span-6 pl-2 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-black/40 border-2 ${
                        u.activeFrame === 'gold-ring'
                          ? 'border-[#ffd700] shadow-[0_0_8px_rgba(255,215,0,0.4)]'
                          : u.activeFrame === 'neon-ring'
                            ? 'border-[#ff003c] shadow-[0_0_8px_rgba(255,0,60,0.4)] animate-pulse'
                            : u.activeFrame === 'cyber-ring'
                              ? 'border-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                              : 'border-white/10'
                      }`}>
                        {u.avatar ? (
                          <img src={u.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="min-w-0">
                        <strong className="block text-white text-xs truncate flex items-center gap-1.5">
                          {u.name}
                          {isMe && <span className="py-0.5 px-1.5 bg-[#ff003c]/20 text-[#ff003c] border border-[#ff003c]/30 text-[7px] rounded uppercase font-black font-mono">BẠN</span>}
                        </strong>
                        {u.title && (
                          <span className="inline-block border border-[#ffd700]/30 text-[#ffd700] bg-[#ffd700]/5 text-[8px] font-black uppercase px-1.5 rounded-full mt-1">
                            {u.title}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Class */}
                    <div className="col-span-2 text-center text-slate-300 font-bold uppercase">{u.class}</div>

                    {/* Performance Value */}
                    <div className="col-span-3 text-right">
                      {activeTab === 'pp' && (
                        <strong className="text-emerald-400 text-glow-green text-xs">
                          {u.pp.toLocaleString()} PP
                        </strong>
                      )}
                      {activeTab === 'academic' && (
                        <div className="space-y-0.5">
                          <strong className="text-cyan-400 text-glow-blue text-xs">
                            {((u.stats?.[0] || 0) + (u.stats?.[1] || 0)).toLocaleString()} XP
                          </strong>
                          <span className="block text-[8px] text-[#8b949e]">
                            Cần Cù: {u.stats?.[0]} | Trí Tuệ: {u.stats?.[1]}
                          </span>
                        </div>
                      )}
                      {activeTab === 'gold' && (
                        <strong className="text-[#ffd700] text-glow-gold text-xs">
                          {u.goldAmount?.toLocaleString()} LƯỢNG
                        </strong>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
