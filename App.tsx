/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, onValue, set, onDisconnect } from 'firebase/database';
import { db } from './firebase';
import { User } from './types';

// Core layout components
import SecureLogin from './components/SecureLogin';
import Sidebar from './components/Sidebar';
import AcademicPortal from './components/AcademicPortal';
import BankPortal from './components/BankPortal';
import GoldPortal from './components/GoldPortal';
import GamesPortal from './components/GamesPortal';
import ChatPortal from './components/ChatPortal';
import MarketplacePortal from './components/MarketplacePortal';
import RankingsPortal from './components/RankingsPortal';
import AdminPortal from './components/AdminPortal';
import LuckyWheel from './components/LuckyWheel';

// Game Modals list
import TaiXiuModal from './components/modals/TaiXiuModal';
import PenaltyModal from './components/modals/PenaltyModal';
import AirplaneModal from './components/modals/AirplaneModal';
import CryptoModal from './components/modals/CryptoModal';
import HorseModal from './components/modals/HorseModal';
import ClawModal from './components/modals/ClawModal';
import FcMobileModal from './components/modals/FcMobileModal';
import RpsModal from './components/modals/RpsModal';
import BlackjackModal from './components/modals/BlackjackModal';
import TienLenModal from './components/modals/TienLenModal';

// Winnings Confetti trigger import
import confetti from 'canvas-confetti';

// Import motion for fluid dragging animations and icons for PIP
import { motion, AnimatePresence } from 'motion/react';
import { Tv, Maximize2, X, Flame, Sparkles, Menu } from 'lucide-react';

export default function App() {
  const [uid, setUid] = useState<string>(() => localStorage.getItem('s88_uid') || '');
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Tab routing
  const [currentTab, setCurrentTab] = useState<string>('academic');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Picture-in-Picture global live stream state
  const [isPipActive, setIsPipActive] = useState<boolean>(() => {
    return localStorage.getItem('s88_live_pip_active') === 'true';
  });
  const [pipGame, setPipGame] = useState<string>(() => {
    return localStorage.getItem('s88_live_pip_game') || 'taixiu';
  });

  // Track dynamic time for synchronized PIP rendering
  const [pipTime, setPipTime] = useState<number>(Date.now());

  // Check if current device is a desktop (min-width: 768px)
  const [isDesktop, setIsDesktop] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  // Listen to PIP changes across components instantly via custom events
  useEffect(() => {
    const handlePipUpdate = () => {
      setIsPipActive(localStorage.getItem('s88_live_pip_active') === 'true');
      setPipGame(localStorage.getItem('s88_live_pip_game') || 'taixiu');
    };
    window.addEventListener('s88_pip_update', handlePipUpdate);

    // Track screen resizing for responsive PIP dragging and layout
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);

    // Keep clock updating for PIP virtual rendering
    const timer = setInterval(() => {
      setPipTime(Date.now());
    }, 200);

    return () => {
      window.removeEventListener('s88_pip_update', handlePipUpdate);
      window.removeEventListener('resize', handleResize);
      clearInterval(timer);
    };
  }, []);

  // Function to close PIP
  const handleClosePip = () => {
    localStorage.removeItem('s88_live_pip_active');
    localStorage.removeItem('s88_live_pip_game');
    setIsPipActive(false);
    // Notify other windows/elements
    window.dispatchEvent(new Event('s88_pip_update'));
  };

  // Interactive Game Overlay states
  const [activeGameKey, setActiveGameKey] = useState<string>('');
  const [activeRpsRoomId, setActiveRpsRoomId] = useState<string>('');
  const [activeBjRoomId, setActiveBjRoomId] = useState<string>('');
  const [activeTlRoomId, setActiveTlRoomId] = useState<string>('');

  // Global Toast Notification overlays
  interface Toast {
    id: string;
    title: string;
    message: string;
    isWin: boolean;
  }
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 1. Session verification & Profile synchronization
  useEffect(() => {
    if (!uid) {
      setUser(null);
      setLoadingUser(false);
      return;
    }

    setLoadingUser(true);
    const uRef = ref(db, `users/${uid}`);

    const unsubscribe = onValue(uRef, (snap) => {
      if (snap.exists()) {
        const uData = snap.val() as User;
        
        // Anti-spoofing session token validation
        const localToken = localStorage.getItem('s88_sessionToken');
        if (uData.sessionToken && uData.sessionToken !== localToken) {
          handleForceLogout('Phát hiện đăng nhập ở nơi khác! Phiên kết thúc.');
          return;
        }

        setUser(uData);
      } else {
        // uid does not exist in db
        handleForceLogout();
      }
      setLoadingUser(false);
    }, (err) => {
      console.error('Firebase read error:', err);
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // 2. Real-time active online indicators ping
  useEffect(() => {
    if (!uid || !user) return;

    const pingRef = ref(db, `online/${uid}`);

    // Set online timestamp instantly
    set(pingRef, {
      name: user.name,
      time: Date.now()
    });

    // Remove status automatically on network disconnect
    onDisconnect(pingRef).remove();

    // Ping reference every 10 seconds to keep fresh
    const interval = setInterval(() => {
      set(pingRef, {
        name: user.name,
        time: Date.now()
      });
    }, 10000);

    return () => {
      clearInterval(interval);
      set(pingRef, null); // clear online indicator when unmounting
    };
  }, [uid, user]);

  const handleForceLogout = (msg?: string) => {
    localStorage.removeItem('s88_uid');
    localStorage.removeItem('s88_sessionToken');
    setUid('');
    setUser(null);
    if (msg) alert(msg);
  };

  const handleLoginSuccess = (authenticatedUid: string, token: string) => {
    localStorage.setItem('s88_uid', authenticatedUid);
    localStorage.setItem('s88_sessionToken', token);
    setUid(authenticatedUid);
    setCurrentTab('academic');
  };

  const handleShowGameResult = (title: string, message: string, isWin: boolean) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, isWin }]);

    if (isWin) {
      // Throw confetti explosion
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    // Auto-remove after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  if (!uid) {
    return <SecureLogin onLoginSuccess={handleLoginSuccess} />;
  }

  if (loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white font-mono">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-[#00ff80]/10 border-t-[#00ff80] rounded-full animate-spin"></div>
        </div>
        <p className="mt-6 text-xs uppercase tracking-widest text-[#00ff80] text-glow-green animate-pulse">
          S-System 88 // Đang tải hồ sơ...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#050505] text-slate-200 antialiased selection:bg-[#00ff80]/20 selection:text-[#00ff80]">
      
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden fixed top-0 inset-x-0 h-16 bg-[#0a0a0c]/90 backdrop-blur-md border-b border-white/5 px-4 flex items-center justify-between z-40 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg active:scale-95 transition cursor-pointer flex items-center justify-center shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="brand-glitch small tracking-widest text-[#ff003c] font-black text-sm">
            S88 SYSTEM
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono">
          <div className="text-right">
            <div className="text-[10px] text-yellow-400 font-bold">{(user?.pp || 0).toLocaleString()} PP</div>
            <div className="text-[9px] text-white/50 truncate max-w-[80px]">{user?.name || 'Sinh Viên'}</div>
          </div>
        </div>
      </div>

      {/* Real-time reactive status sidebar */}
      <Sidebar 
        uid={uid} 
        uname={user?.name || 'Sinh Viên'}
        activeTab={currentTab} 
        setActiveTab={(tab) => setCurrentTab(tab as any)} 
        userRole={user?.role || 'STUDENT'}
        userClass={user?.class || 'N/A'}
        onLogout={() => handleForceLogout()} 
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main viewport panels */}
      <main className="flex-1 min-h-screen pl-0 md:pl-72 transition-all duration-300">
        <div className={`max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 transition-all duration-300 ${
          isPipActive && currentTab !== 'casino'
            ? 'mt-[290px] md:mt-0'
            : 'mt-16 md:mt-0'
        }`}>
          
          {currentTab === 'academic' && (
            <AcademicPortal uid={uid} user={user} onShowResult={handleShowGameResult} />
          )}

          {currentTab === 'luckywheel' && (
            <LuckyWheel uid={uid} user={user} onShowResult={handleShowGameResult} />
          )}

          {currentTab === 'bank' && (
            <BankPortal uid={uid} user={user} onShowResult={handleShowGameResult} />
          )}

          {currentTab === 'gold' && (
            <GoldPortal uid={uid} user={user} onShowResult={handleShowGameResult} />
          )}

          {(currentTab === 'games' || currentTab === 'casino') && (
            <GamesPortal 
              uid={uid} 
              user={user} 
              onOpenGame={(gKey) => setActiveGameKey(gKey)}
              onJoinRps={(id) => setActiveRpsRoomId(id)}
              onJoinBj={(id) => setActiveBjRoomId(id)}
              onJoinTl={(id) => setActiveTlRoomId(id)}
              onShowResult={handleShowGameResult}
            />
          )}

          {currentTab === 'chat' && (
            <ChatPortal uid={uid} user={user} />
          )}

          {currentTab === 'marketplace' && (
            <MarketplacePortal uid={uid} user={user} onShowResult={handleShowGameResult} />
          )}

          {currentTab === 'rankings' && (
            <RankingsPortal uid={uid} user={user} />
          )}

          {currentTab === 'admin' && (
            <AdminPortal uid={uid} user={user} onShowResult={handleShowGameResult} />
          )}

        </div>
      </main>

      {/* ========================================================= */}
      {/*                     GAME OVERLAYS                         */}
      {/* ========================================================= */}

      {/* Tai Xiu */}
      {activeGameKey === 'taixiu' && (
        <TaiXiuModal 
          uid={uid} 
          user={user} 
          onClose={() => setActiveGameKey('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* Penalty */}
      {activeGameKey === 'penalty' && (
        <PenaltyModal 
          uid={uid} 
          user={user} 
          onClose={() => setActiveGameKey('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* Airplane Crash */}
      {activeGameKey === 'airplane' && (
        <AirplaneModal 
          uid={uid} 
          user={user} 
          onClose={() => setActiveGameKey('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* Crypto live trading */}
      {activeGameKey === 'crypto' && (
        <CryptoModal 
          uid={uid} 
          user={user} 
          onClose={() => setActiveGameKey('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* Horse racing */}
      {activeGameKey === 'horse' && (
        <HorseModal 
          uid={uid} 
          user={user} 
          onClose={() => setActiveGameKey('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* Claw machine */}
      {activeGameKey === 'claw' && (
        <ClawModal 
          uid={uid} 
          user={user} 
          onClose={() => setActiveGameKey('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* FC Mobile match */}
      {activeGameKey === 'fcmobile' && (
        <FcMobileModal 
          uid={uid} 
          user={user} 
          onClose={() => setActiveGameKey('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* 1v1 Rock Paper Scissors multiplayer room */}
      {activeRpsRoomId && (
        <RpsModal 
          uid={uid} 
          user={user} 
          roomId={activeRpsRoomId} 
          onClose={() => setActiveRpsRoomId('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* 1v5 Blackjack multiplayer room */}
      {activeBjRoomId && (
        <BlackjackModal 
          uid={uid} 
          user={user} 
          roomId={activeBjRoomId} 
          onClose={() => setActiveBjRoomId('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* 1v4 Tien Len multiplayer room */}
      {activeTlRoomId && (
        <TienLenModal 
          uid={uid} 
          user={user} 
          roomId={activeTlRoomId} 
          onClose={() => setActiveTlRoomId('')} 
          onShowResult={handleShowGameResult}
        />
      )}

      {/* ========================================================= */}
      {/*                 GLOBAL TOAST NOTIFICATIONS                */}
      {/* ========================================================= */}
      <div className="fixed top-20 md:top-6 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-[calc(100vw-32px)] md:w-80 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`pointer-events-auto glass-box p-3.5 border-l-4 rounded-xl flex items-start gap-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${
                t.isWin 
                  ? 'border-emerald-500 bg-[#061510]/95 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'border-[#ff003c] bg-[#1a080c]/95 shadow-[0_0_15px_rgba(255,0,60,0.15)]'
              }`}
            >
              <div className="text-base shrink-0 select-none pt-0.5">
                {t.isWin ? '🏆' : '💀'}
              </div>
              <div className="flex-1 min-w-0 font-sans">
                <div className={`font-mono text-[9px] font-black uppercase tracking-wider ${
                  t.isWin ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {t.isWin ? 'Thành công !' : 'Thất bại'}
                </div>
                <div className="text-white font-bold text-xs mt-0.5 leading-snug">
                  {t.title}
                </div>
                {t.message && (
                  <p className="text-[#8b949e] text-[10px] mt-1 leading-normal whitespace-pre-line border-t border-white/5 pt-1">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="shrink-0 text-slate-500 hover:text-white transition p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ========================================================= */}
      {/*            PICTURE-IN-PICTURE (PIP) LIVE STREAM            */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isPipActive && currentTab !== 'casino' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            drag={isDesktop}
            dragMomentum={false}
            className="fixed z-[9999] bg-black/95 border-[#ff003c]/40 border-b-2 md:border-2 select-none overflow-hidden flex flex-col gap-1.5 md:gap-2 font-mono
              /* Mobile View: Locked at the top right below mobile navigation */
              top-16 left-0 right-0 w-full rounded-none p-2.5 shadow-2xl
              /* Desktop View: Floating bottom-right draggable card */
              md:top-auto md:left-auto md:bottom-6 md:right-6 md:w-72 md:rounded-2xl md:p-3 md:shadow-[0_0_30px_rgba(255,0,60,0.25)] md:cursor-grab md:active:cursor-grabbing"
          >
            {/* PIP Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                  <Tv className="w-3 h-3 text-red-500" /> LIVE: {pipGame === 'taixiu' ? 'Tài Xỉu' : pipGame === 'crash' ? 'Phi Thuyền' : 'Sút Phạt'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setCurrentTab('casino');
                  }}
                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition cursor-pointer"
                  title="Phóng to rộng sòng bài"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                <button
                  onClick={handleClosePip}
                  className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-red-500 transition cursor-pointer"
                  title="Đóng PIP"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Simulated mini video stage */}
            <div className="relative aspect-video w-full rounded-lg bg-black overflow-hidden flex items-center justify-center text-center">
              
              {/* TAI XIU PIP */}
              {pipGame === 'taixiu' && (() => {
                const txCycleDuration = 35000;
                const txBettingSecs = 20;
                const txShakingSecs = 4;
                const txRevealSecs = 6;
                const txCycleId = Math.floor(pipTime / txCycleDuration);
                const txSecondsElapsed = (pipTime % txCycleDuration) / 1000;
                
                let txPhase = 'BETTING';
                let countdown = 0;
                if (txSecondsElapsed < txBettingSecs) {
                  txPhase = 'BETTING';
                  countdown = Math.ceil(txBettingSecs - txSecondsElapsed);
                } else if (txSecondsElapsed < txBettingSecs + txShakingSecs) {
                  txPhase = 'SHAKING';
                } else if (txSecondsElapsed < txBettingSecs + txShakingSecs + txRevealSecs) {
                  txPhase = 'REVEAL';
                } else {
                  txPhase = 'COOLDOWN';
                  countdown = Math.ceil(txCycleDuration / 1000 - txSecondsElapsed);
                }

                const seed = txCycleId * 12345.678;
                const rand = (s: number) => {
                  const x = Math.sin(s) * 10000;
                  return x - Math.floor(x);
                };
                const r1 = rand(seed + Math.cos(seed * 2.3));
                const r2 = rand(seed + Math.sin(seed * 1.5));
                const r3 = rand(seed + r1 * 3.1);
                const d1 = Math.floor(r1 * 6) + 1;
                const d2 = Math.floor(r2 * 2.1) + Math.floor(r3 * 3) + 1;
                const d3 = Math.floor((r1 + r2) * 3) % 6 + 1;
                const dices = [d1 < 1 ? 1 : d1 > 6 ? 6 : d1, d2 < 1 ? 1 : d2 > 6 ? 6 : d2, d3 < 1 ? 1 : d3 > 6 ? 6 : d3];
                const sum = dices[0] + dices[1] + dices[2];

                return (
                  <div className="absolute inset-0 bg-[#120808] flex flex-col items-center justify-center p-2 text-[10px]">
                    {txPhase === 'BETTING' && (
                      <div className="space-y-1">
                        <span className="text-red-400 font-bold uppercase tracking-wider block">NHẬN CƯỢC LIVE</span>
                        <span className="text-xl font-black text-white">{countdown}s</span>
                      </div>
                    )}
                    {txPhase === 'SHAKING' && (
                      <span className="text-yellow-500 font-black animate-bounce text-xs">🎲 ĐANG LẮC HŨ... 🎲</span>
                    )}
                    {(txPhase === 'REVEAL' || txPhase === 'COOLDOWN') && (
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5 justify-center">
                          {dices.map((v, i) => (
                            <span key={i} className="w-6 h-6 bg-white text-slate-900 rounded font-bold text-xs flex items-center justify-center shadow">
                              {v}
                            </span>
                          ))}
                        </div>
                        <span className="block font-bold text-white text-[11px] mt-1 bg-red-950/40 border border-red-500/20 px-2 py-0.5 rounded-full">
                          KẾT QUẢ: {sum} NÚT ({sum >= 11 ? 'TÀI' : 'XỈU'})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* CRASH PIP */}
              {pipGame === 'crash' && (() => {
                const crashCycleDuration = 30000;
                const crashBettingSecs = 10;
                const crashFlightSecs = 15;
                const crashCycleId = Math.floor(pipTime / crashCycleDuration);
                const crashSecondsElapsed = (pipTime % crashCycleDuration) / 1000;

                let crashPhase = 'BETTING';
                let countdown = 0;
                if (crashSecondsElapsed < crashBettingSecs) {
                  crashPhase = 'BETTING';
                  countdown = Math.ceil(crashBettingSecs - crashSecondsElapsed);
                } else if (crashSecondsElapsed < crashBettingSecs + crashFlightSecs) {
                  crashPhase = 'FLIGHT';
                } else {
                  crashPhase = 'COOLDOWN';
                  countdown = Math.ceil(crashCycleDuration / 1000 - crashSecondsElapsed);
                }

                // Crash point calculation
                const seed = crashCycleId * 12345.678;
                const r1 = (() => {
                  const x = Math.sin(seed + Math.cos(seed * 2.3)) * 10000;
                  return x - Math.floor(x);
                })();
                let crashPoint = 1.0;
                if (r1 < 0.1) crashPoint = 1.0 + r1 * 2;
                else if (r1 < 0.8) crashPoint = 1.2 + (r1 - 0.1) * 3;
                else crashPoint = 3.3 + Math.pow((r1 - 0.8) * 10, 2.5);
                crashPoint = parseFloat(Math.min(crashPoint, 88.8).toFixed(2));

                let mult = 1.0;
                if (crashPhase === 'FLIGHT') {
                  const flightElapsed = crashSecondsElapsed - crashBettingSecs;
                  mult = parseFloat((1.0 + Math.pow(flightElapsed / 3.5, 2.2)).toFixed(2));
                  if (mult >= crashPoint) mult = crashPoint;
                } else if (crashPhase === 'COOLDOWN') {
                  mult = crashPoint;
                }

                return (
                  <div className="absolute inset-0 bg-[#040e1a] flex flex-col items-center justify-center p-2 text-[10px]">
                    {crashPhase === 'BETTING' && (
                      <div className="space-y-1">
                        <span className="text-cyan-400 font-bold uppercase block tracking-wider">MỞ ĐẶT CƯỢC</span>
                        <span className="text-xl font-black text-white">{countdown}s</span>
                      </div>
                    )}
                    {crashPhase === 'FLIGHT' && (
                      <div className="space-y-1 text-center">
                        <span className="text-glow-cyan text-cyan-400 text-2xl font-black animate-pulse block">
                          {mult}x
                        </span>
                        <span className="text-white/60 text-[8px] uppercase tracking-widest">🚀 PHI THUYỀN BAY...</span>
                      </div>
                    )}
                    {crashPhase === 'COOLDOWN' && (
                      <div className="space-y-1 text-center">
                        <span className="text-red-500 font-black text-lg block animate-pulse">💥 CRASHED!</span>
                        <span className="text-white/70 text-[9px] bg-red-950/40 border border-red-500/20 py-0.5 px-2 rounded-full">
                          ĐÃ NỔ @ {crashPoint}x
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* PENALTY PIP */}
              {pipGame === 'penalty' && (() => {
                const penCycleDuration = 40000;
                const penBettingSecs = 25;
                const penShootingSecs = 5;
                const penCycleId = Math.floor(pipTime / penCycleDuration);
                const penSecondsElapsed = (pipTime % penCycleDuration) / 1000;

                let penPhase = 'BETTING';
                let countdown = 0;
                if (penSecondsElapsed < penBettingSecs) {
                  penPhase = 'BETTING';
                  countdown = Math.ceil(penBettingSecs - penSecondsElapsed);
                } else if (penSecondsElapsed < penBettingSecs + penShootingSecs) {
                  penPhase = 'SHOOTING';
                } else {
                  penPhase = 'COOLDOWN';
                  countdown = Math.ceil(penCycleDuration / 1000 - penSecondsElapsed);
                }

                // Shoot outcome
                const seed = penCycleId * 12345.678;
                const rand = (s: number) => {
                  const x = Math.sin(s) * 10000;
                  return x - Math.floor(x);
                };
                const r3 = rand(seed + 3.14);
                const isGoal = r3 > 0.45;

                return (
                  <div className="absolute inset-0 bg-[#021408] flex flex-col items-center justify-center p-2 text-[10px]">
                    {penPhase === 'BETTING' && (
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-bold uppercase block tracking-wider">NHẬN CƯỢC SÚT ĐỀN</span>
                        <span className="text-xl font-black text-white">{countdown}s</span>
                      </div>
                    )}
                    {penPhase === 'SHOOTING' && (
                      <span className="text-yellow-400 font-black text-xs animate-bounce">🏃‍♂️ CẦU THỦ ĐANG LẤY ĐÀ...</span>
                    )}
                    {penPhase === 'COOLDOWN' && (
                      <div className="space-y-1 text-center">
                        <span className={`text-glow font-black text-base uppercase block ${
                          isGoal ? 'text-emerald-400 text-glow-emerald animate-bounce' : 'text-red-500 text-glow-red animate-pulse'
                        }`}>
                          {isGoal ? '⚽ VÀO VÀO VÀO!!!' : '🧤 THỦ MÔN ĐỠ!'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Mini visual background border highlight */}
              <div className="absolute inset-0 border border-white/5 pointer-events-none rounded-lg" />
            </div>

            {/* PIP Fast Link to Return */}
            <button
              onClick={() => {
                setCurrentTab('casino');
              }}
              className="py-1.5 px-3 bg-[#ff003c] hover:bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest text-center cursor-pointer transition-all flex items-center justify-center gap-1 shadow-md"
            >
              <Maximize2 className="w-3 h-3" /> [ QUAY LẠI KHÁN ĐÀI LIVE ]
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

