/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User } from '../types';
import LiveStreamPanel from './LiveStreamPanel';

interface LiveCasinoStreamProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function LiveCasinoStream({ uid, user, onShowResult }: LiveCasinoStreamProps) {
  return (
    <div className="space-y-6">
      {/* Overview header stats card */}
      <div className="glass-box p-5 border-[#ff003c]/30 bg-red-950/5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff003c] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff003c]"></span>
            </span>
            <h2 className="text-xl font-black font-sans text-white tracking-wide uppercase flex items-center gap-1.5">
              🔴 ĐẤU TRƯỜNG LAS VEGAS LIVE
            </h2>
          </div>
          <p className="text-[11px] text-[#8b949e] font-mono mt-1 uppercase">
            Bố cục Live Stream đồng bộ hoá tuyệt đối 100% thời gian thực
          </p>
        </div>
        <div className="bg-black/40 border border-white/5 py-2.5 px-4 rounded-xl flex items-center gap-3 shrink-0 font-mono text-xs">
          <div className="text-right">
            <span className="block text-[9px] text-[#8b949e] uppercase">Tài sản PP khả dụng:</span>
            <span className="text-glow-gold text-[#ffd700] font-black">
              {(user?.pp || 0).toLocaleString()} PP
            </span>
          </div>
        </div>
      </div>

      {/* RENDER THE HIGH-FIDELITY LIVE STREAM PANEL COMPONENT */}
      <LiveStreamPanel 
        uid={uid} 
        user={user} 
        onShowResult={onShowResult} 
      />
    </div>
  );
}
