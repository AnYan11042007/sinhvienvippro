/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, onValue, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { BookOpen, Landmark, Coins, Trophy, LogOut, Music, Music2, User as UserIcon, ShieldAlert, MessageSquare, ShoppingBag, Award, Shield, Sparkles, X } from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  uid: string;
  uname: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: 'STUDENT' | 'TEACHER';
  userClass: string;
  onLogout: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({
  uid,
  uname,
  activeTab,
  setActiveTab,
  userRole,
  userClass,
  onLogout,
  isMobileOpen = false,
  setIsMobileOpen,
}: SidebarProps) {
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [activeFrame, setActiveFrame] = useState('');

  // Audio object initialized lazily
  const [bgAudio] = useState(() => {
    const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
    audio.loop = true;
    return audio;
  });

  // Track Avatar and activeFrame changes in Realtime Database
  useEffect(() => {
    const userRef = ref(db, `users/${uid}`);
    const unsubscribe = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setAvatarUrl(val.avatar || '');
        setActiveFrame(val.activeFrame || '');
      }
    });
    return () => unsubscribe();
  }, [uid]);

  // Track Online Count in Realtime Database
  useEffect(() => {
    const onlineRef = ref(db, 'online');
    const unsubscribe = onValue(onlineRef, (snap) => {
      const data = snap.val() || {};
      const count = Object.keys(data).length;
      const names = Object.values(data).map((u: any) => u.name || 'Sinh Viên');
      setOnlineCount(count);
      setOnlineNames(names);
    });
    return () => unsubscribe();
  }, []);

  const toggleMusic = () => {
    if (isMusicPlaying) {
      bgAudio.pause();
      setIsMusicPlaying(false);
    } else {
      bgAudio.play().catch((err) => console.log('Audio error:', err));
      setIsMusicPlaying(true);
    }
  };

  const handleChangeAvatar = async () => {
    const current = avatarUrl;
    const link = prompt('Nhập đường dẫn URL ảnh Avatar mới của bạn:', current);
    if (link !== null) {
      try {
        await update(ref(db, `users/${uid}`), { avatar: link });
      } catch (err) {
        alert('Lỗi cập nhật Avatar!');
      }
    }
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[100] transition-opacity duration-300"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      <aside className={`
        glass-box flex flex-col justify-between select-none p-5
        /* Desktop Sticky Layout */
        md:sticky md:top-5 md:h-[calc(100vh-40px)] md:w-64 md:translate-x-0 md:opacity-100 md:pointer-events-auto md:z-30
        /* Mobile Slide-over Drawer Layout */
        fixed inset-y-4 left-4 z-[101] w-64 h-[calc(100vh-32px)] transition-all duration-300
        ${isMobileOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-[280px] md:translate-x-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto'}
      `}>
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-none flex flex-col">
          {/* Brand header with mobile close option */}
          <div className="flex items-center justify-between mb-6">
            <div className="brand-glitch small select-none tracking-widest text-[#ff003c] font-black text-center w-full text-sm md:text-base">
              School Main 88
            </div>
            {setIsMobileOpen && (
              <button 
                onClick={() => setIsMobileOpen(false)}
                className="md:hidden p-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg cursor-pointer flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Peer Network Connection Status */}
          <div 
            className="border border-[#00ff80]/30 bg-[#00ff80]/5 p-3 rounded-lg text-xs font-mono text-[#00ff80] mb-5 overflow-hidden shadow-[inset_0_0_10px_rgba(0,255,128,0.02)] transition-all"
            title={onlineNames.join(', ')}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00ff80] animate-ping shrink-0" />
              <span>ONLINE MẠNG ({onlineCount})</span>
            </div>
            <div className="text-[10px] text-white/70 overflow-hidden text-ellipsis whitespace-nowrap leading-relaxed">
              {onlineNames.length > 0 ? onlineNames.join(', ') : 'Không có ai'}
            </div>
          </div>

          {/* User Card */}
          <div className="user-card flex items-center gap-3.5 pb-5 border-b border-[#30363d] mb-6">
            <div 
              onClick={handleChangeAvatar}
              className={`w-12 h-12 rounded-full cursor-pointer flex items-center justify-center overflow-hidden bg-black/50 transition-all shrink-0 hover:scale-105 active:scale-95 border-2 ${
                activeFrame === 'gold-ring'
                  ? 'border-[#ffd700] shadow-[0_0_12px_rgba(255,215,0,0.4)]'
                  : activeFrame === 'neon-ring'
                    ? 'border-[#ff003c] shadow-[0_0_12px_rgba(255,0,60,0.4)] animate-pulse'
                    : activeFrame === 'cyber-ring'
                      ? 'border-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                      : 'border-white/20 hover:border-[#00f0ff]'
              }`}
              title="Nhấp để đổi ảnh đại diện"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-6 h-6 text-[#ffd700]" />
              )}
            </div>
            <div className="overflow-hidden">
              <span className={`badge inline-block py-0.5 px-2.5 border rounded-full text-[9px] font-black uppercase tracking-wider ${
                userRole === 'TEACHER' 
                  ? 'border-[#ff003c] text-[#ff003c] bg-[#ff003c]/10' 
                  : 'border-[#ffd700] text-[#ffd700] bg-[#ffd700]/10'
              }`}>
                {userRole === 'TEACHER' ? 'Faculty Admin' : `LỚP ${userClass}`}
              </span>
              <strong className="block text-white text-sm font-bold truncate mt-1" title={uname}>
                {uname}
              </strong>
            </div>
          </div>

          {/* Tabs Lists */}
          <nav className="space-y-1 font-mono">
            <button
              onClick={() => handleTabClick('academic')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'academic'
                  ? 'bg-[#ff003c]/15 text-white border-l-4 border-[#ff003c] pl-3.5'
                  : 'text-[#8b949e] hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> [ HỌC TẬP & AI ]
            </button>

            <button
              onClick={() => handleTabClick('luckywheel')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border border-[#ffd700]/10 ${
                activeTab === 'luckywheel'
                  ? 'bg-[#ffd700]/15 text-white border-l-4 border-[#ffd700] pl-3.5'
                  : 'text-amber-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse animate-duration-1000" /> [ VÒNG QUAY MAY MẮN ]
            </button>

            <button
              onClick={() => handleTabClick('chat')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-[#ff003c]/15 text-white border-l-4 border-[#ff003c] pl-3.5'
                  : 'text-[#8b949e] hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> [ CHAT TOÀN TRƯỜNG ]
            </button>

            <button
              onClick={() => handleTabClick('marketplace')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'marketplace'
                  ? 'bg-[#ff003c]/15 text-white border-l-4 border-[#ff003c] pl-3.5'
                  : 'text-[#8b949e] hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> [ CHỢ MUA BÁN ]
            </button>

            <button
              onClick={() => handleTabClick('bank')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'bank'
                  ? 'bg-[#ff003c]/15 text-white border-l-4 border-[#ff003c] pl-3.5'
                  : 'text-[#8b949e] hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" /> [ NGÂN HÀNG ]
            </button>

            <button
              onClick={() => handleTabClick('gold')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'gold'
                  ? 'bg-[#ff003c]/15 text-white border-l-4 border-[#ff003c] pl-3.5'
                  : 'text-[#8b949e] hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <Coins className="w-3.5 h-3.5" /> [ SÀN VÀNG ]
            </button>

            <button
              onClick={() => handleTabClick('casino')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'casino'
                  ? 'bg-[#ff003c]/15 text-white border-l-4 border-[#ff003c] pl-3.5'
                  : 'text-[#8b949e] hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> [ ĐẤU TRƯỜNG LIVE ]
            </button>

            <button
              onClick={() => handleTabClick('rankings')}
              className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'rankings'
                  ? 'bg-[#ff003c]/15 text-white border-l-4 border-[#ff003c] pl-3.5'
                  : 'text-[#8b949e] hover:text-white hover:bg-white/5 border-l-4 border-transparent'
              }`}
            >
              <Award className="w-3.5 h-3.5" /> [ BẢNG VÀNG ]
            </button>

            {userRole === 'TEACHER' && (
              <button
                onClick={() => handleTabClick('admin')}
                className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border border-[#00f0ff]/30 ${
                  activeTab === 'admin'
                    ? 'bg-[#00f0ff]/15 text-white border-l-4 border-l-[#00f0ff] pl-3.5'
                    : 'text-[#00f0ff] hover:text-white hover:bg-[#00f0ff]/5 border-l-4 border-transparent'
                }`}
              >
                <Shield className="w-3.5 h-3.5 animate-pulse" /> [ ĐIỀU HÀNH VIP ]
              </button>
            )}
          </nav>
        </div>

        {/* Music Toggle & Logout */}
        <div className="space-y-2 mt-auto pt-4 border-t border-[#30363d]/50 font-mono shrink-0">
          <button
            onClick={toggleMusic}
            className={`w-full py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-[11px] font-bold tracking-widest uppercase transition-all border cursor-pointer ${
              isMusicPlaying
                ? 'border-[#ffd700] text-[#ffd700] bg-[#ffd700]/5 text-glow-gold'
                : 'border-[#30363d] text-[#8b949e] hover:text-white'
            }`}
          >
            {isMusicPlaying ? (
              <>
                <Music2 className="w-3.5 h-3.5 animate-bounce" /> [ TẮT NHẠC ]
              </>
            ) : (
              <>
                <Music className="w-3.5 h-3.5" /> [ BẬT NHẠC ]
              </>
            )}
          </button>

          <button
            onClick={onLogout}
            className="w-full py-2.5 px-3 bg-red-950/10 border border-red-900/30 text-red-400 hover:bg-[#ff003c] hover:text-white hover:border-[#ff003c] rounded-lg flex items-center justify-center gap-2 text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all hover:shadow-[0_0_10px_rgba(255,0,60,0.3)]"
          >
            <LogOut className="w-3.5 h-3.5" /> [ ĐĂNG XUẤT ]
          </button>
        </div>
      </aside>
    </>
  );
}
