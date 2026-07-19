/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, onValue, push, set, update } from 'firebase/database';
import { db } from '../firebase';
import { Swords, Play, Trophy, Users, Shield, Plus, ArrowRight } from 'lucide-react';
import { User, RpsRoom, BlackjackRoom, TienLenRoom } from '../types';
import LiveCasinoStream from './LiveCasinoStream';
import DailyMissions from './DailyMissions';
import GlobalTopWinners from './GlobalTopWinners';

interface GamesPortalProps {
  uid: string;
  user: User | null;
  onOpenGame: (gameKey: string) => void;
  onJoinRps: (roomId: string) => void;
  onJoinBj: (roomId: string) => void;
  onJoinTl: (roomId: string) => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function GamesPortal({ uid, user, onOpenGame, onJoinRps, onJoinBj, onJoinTl, onShowResult }: GamesPortalProps) {
  // Creating multiplayer room values
  const [rpsStake, setRpsStake] = useState('1000');
  const [bjStake, setBjStake] = useState('2000');
  const [tlStake, setTlStake] = useState('5000');

  // Real-time active rooms state list
  const [rpsRooms, setRpsRooms] = useState<RpsRoom[]>([]);
  const [bjRooms, setBlackjackRooms] = useState<BlackjackRoom[]>([]);
  const [tlRooms, setTienLenRooms] = useState<TienLenRoom[]>([]);

  useEffect(() => {
    // 1. Subscribe to RPS rooms list
    const rpsRef = ref(db, 'rps_rooms');
    const unsubRps = onValue(rpsRef, (snap) => {
      const list: RpsRoom[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key!, ...child.val() });
        });
      }
      setRpsRooms(list);
    });

    // 2. Subscribe to Blackjack rooms list
    const bjRef = ref(db, 'blackjack_rooms');
    const unsubBj = onValue(bjRef, (snap) => {
      const list: BlackjackRoom[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key!, ...child.val() });
        });
      }
      setBlackjackRooms(list);
    });

    // 3. Subscribe to Tien Len rooms list
    const tlRef = ref(db, 'tienlen_rooms');
    const unsubTl = onValue(tlRef, (snap) => {
      const list: TienLenRoom[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key!, ...child.val() });
        });
      }
      setTienLenRooms(list);
    });

    return () => {
      unsubRps();
      unsubBj();
      unsubTl();
    };
  }, []);

  // Creation Triggers
  const handleCreateRpsRoom = async () => {
    const stake = parseInt(rpsStake);
    if (isNaN(stake) || stake <= 0) {
      alert('Mức cược Oẳn Tù Tì không hợp lệ!');
      return;
    }
    const myPP = user?.pp || 0;
    if (myPP < stake) {
      alert(`Bạn không đủ ${stake.toLocaleString()} PP để tạo bàn!`);
      return;
    }

    try {
      const roomRef = push(ref(db, 'rps_rooms'));
      const payload: RpsRoom = {
        p1: uid,
        p1Name: user?.name || 'Sinh Viên',
        p1Avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
        bet: stake,
        status: 'WAITING',
        p1Choice: '',
        p2Choice: '',
        p1Rematch: false,
        p2Rematch: false,
        finalMsg: ''
      };
      await set(roomRef, payload);
      onJoinRps(roomRef.key!);
    } catch (err) {
      alert('Lỗi tạo bàn Oẳn Tù Tì!');
    }
  };

  const handleCreateBlackjackRoom = async () => {
    const stake = parseInt(bjStake);
    if (isNaN(stake) || stake <= 0) {
      alert('Mức cược Xì Dách không hợp lệ!');
      return;
    }
    const myPP = user?.pp || 0;
    if (myPP < stake) {
      alert(`Bạn không đủ ${stake.toLocaleString()} PP để tạo bàn!`);
      return;
    }

    try {
      const roomRef = push(ref(db, 'blackjack_rooms'));
      const payload: BlackjackRoom = {
        creator: uid,
        creatorName: user?.name || 'Sinh Viên',
        bet: stake,
        status: 'WAITING',
        players: {
          [uid]: {
            name: user?.name || 'Sinh Viên',
            avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
            status: 'WAITING'
          }
        }
      };
      await set(roomRef, payload);
      onJoinBj(roomRef.key!);
    } catch (err) {
      alert('Lỗi tạo sòng Xì Dách!');
    }
  };

  const handleCreateTienLenRoom = async () => {
    const stake = parseInt(tlStake);
    if (isNaN(stake) || stake <= 0) {
      alert('Mức cược Tiến Lên không hợp lệ!');
      return;
    }
    const myPP = user?.pp || 0;
    if (myPP < stake) {
      alert(`Bạn không đủ ${stake.toLocaleString()} PP để tạo bàn!`);
      return;
    }

    try {
      const roomRef = push(ref(db, 'tienlen_rooms'));
      const payload: TienLenRoom = {
        creator: uid,
        creatorName: user?.name || 'Sinh Viên',
        bet: stake,
        status: 'WAITING',
        players: {
          [uid]: {
            name: user?.name || 'Sinh Viên',
            avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
            isCreator: true,
            status: 'WAITING'
          }
        },
        playerOrder: [uid],
        pot: 0
      };
      await set(roomRef, payload);
      onJoinTl(roomRef.key!);
    } catch (err) {
      alert('Lỗi tạo sòng Tiến Lên!');
    }
  };

  // Join actions
  const handleJoinRpsRoom = async (roomId: string) => {
    const r = rpsRooms.find(x => x.id === roomId);
    if (!r) return;

    if (r.p1 === uid) {
      onJoinRps(roomId);
      return;
    }

    if (r.p2 && r.p2 !== uid) {
      alert('Bàn đấu đã đủ người!');
      return;
    }

    const myPP = user?.pp || 0;
    if (myPP < r.bet) {
      alert(`Bạn không đủ ${r.bet.toLocaleString()} PP để tham gia ván đấu!`);
      return;
    }

    try {
      // Set player 2 details
      await update(ref(db, `rps_rooms/${roomId}`), {
        p2: uid,
        p2Name: user?.name || 'Khách',
        p2Avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150'
      });
      onJoinRps(roomId);
    } catch (err) {
      alert('Lỗi tham gia bàn Oẳn Tù Tì!');
    }
  };

  const handleJoinBlackjackRoom = async (roomId: string) => {
    const r = bjRooms.find(x => x.id === roomId);
    if (!r) return;

    if (r.players && r.players[uid]) {
      onJoinBj(roomId);
      return;
    }

    if (r.status !== 'WAITING') {
      alert('Sòng đang chơi giữa chừng, vui lòng đợi ván mới!');
      return;
    }

    const pCount = Object.keys(r.players || {}).length;
    if (pCount >= 5) {
      alert('Sòng bài đã đủ 5 người chơi!');
      return;
    }

    const myPP = user?.pp || 0;
    if (myPP < r.bet) {
      alert(`Bạn không đủ ${r.bet.toLocaleString()} PP để tham gia sòng!`);
      return;
    }

    try {
      await update(ref(db, `blackjack_rooms/${roomId}/players/${uid}`), {
        name: user?.name || 'Khách',
        avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
        status: 'WAITING'
      });
      onJoinBj(roomId);
    } catch (err) {
      alert('Lỗi vào sòng Xì Dách!');
    }
  };

  const handleJoinTienLenRoom = async (roomId: string) => {
    const r = tlRooms.find(x => x.id === roomId);
    if (!r) return;

    if (r.players && r.players[uid]) {
      onJoinTl(roomId);
      return;
    }

    if (r.status !== 'WAITING') {
      alert('Vòng đấu đang diễn ra!');
      return;
    }

    const pCount = Object.keys(r.players || {}).length;
    if (pCount >= 4) {
      alert('Phòng đấu Tiến Lên đã đủ tối đa 4 người!');
      return;
    }

    const myPP = user?.pp || 0;
    if (myPP < r.bet) {
      alert(`Bạn không đủ ${r.bet.toLocaleString()} PP để tham gia!`);
      return;
    }

    try {
      await update(ref(db, `tienlen_rooms/${roomId}/players/${uid}`), {
        name: user?.name || 'Khách',
        avatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
        isCreator: false,
        status: 'WAITING'
      });
      onJoinTl(roomId);
    } catch (err) {
      alert('Lỗi vào phòng Tiến Lên!');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Overview header stats card */}
      <div className="glass-box p-6 border-white/5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black font-sans text-white tracking-wide">🎮 ĐẤU TRƯỜNG GIẢI TRÍ</h2>
          <p className="text-xs text-[#8b949e] font-mono uppercase mt-1">Sân chơi cá cược PP tích lũy thực tế đỉnh cao</p>
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

      {/* LIVE CASINO BROADCASTING */}
      <LiveCasinoStream 
        uid={uid}
        user={user}
        onShowResult={onShowResult}
      />

      {/* DAILY MISSIONS WIDGET */}
      <DailyMissions 
        uid={uid}
        user={user}
        onShowResult={onShowResult}
      />

      {/* 1. SINGLE PLAYER GAMES GRID */}
      <div>
        <h3 className="text-glow-blue text-[#00f0ff] font-mono font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#00f0ff]" /> [ I. TRÒ CHƠI ĐƠN MÁY ]
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          
          {/* Card Tai Xiu */}
          <div className="glass-box p-4 border-[#ff4500]/40 flex flex-col justify-between h-[180px]">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-2xl">🎲</span>
                <span className="text-[9px] font-mono bg-orange-600/10 border border-orange-500/30 text-orange-400 py-0.5 px-2 rounded uppercase font-black">HOT LIVE</span>
              </div>
              <h4 className="text-white font-bold text-sm mt-3 uppercase tracking-wider">Tài Xỉu Thần Thú</h4>
              <p className="text-[11px] text-[#8b949e] leading-relaxed mt-1">Lắc xúc xắc 3 hột trúng bão nhân gấp 6 lần PP cược.</p>
            </div>
            <button 
              onClick={() => onOpenGame('taixiu')}
              className="w-full py-2 bg-orange-950/20 border border-orange-500 hover:bg-orange-500 hover:text-black text-orange-500 font-mono text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Chơi Ngay
            </button>
          </div>

          {/* Card Penalty */}
          <div className="glass-box p-4 border-emerald-500/40 flex flex-col justify-between h-[180px]">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-2xl">⚽</span>
                <span className="text-[9px] font-mono bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 py-0.5 px-2 rounded uppercase font-black">ARCADE</span>
              </div>
              <h4 className="text-white font-bold text-sm mt-3 uppercase tracking-wider">Sút Penalty 3D</h4>
              <p className="text-[11px] text-[#8b949e] leading-relaxed mt-1">Canh lực chuẩn ghim bóng vào góc chết để thắng nhân đôi PP.</p>
            </div>
            <button 
              onClick={() => onOpenGame('penalty')}
              className="w-full py-2 bg-emerald-950/20 border border-emerald-500 hover:bg-emerald-500 hover:text-black text-emerald-500 font-mono text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Chơi Ngay
            </button>
          </div>

          {/* Card Airplane Crash */}
          <div className="glass-box p-4 border-[#00f0ff]/40 flex flex-col justify-between h-[180px]">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-2xl">🚀</span>
                <span className="text-[9px] font-mono bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 py-0.5 px-2 rounded uppercase font-black">MULTIPLIER</span>
              </div>
              <h4 className="text-white font-bold text-sm mt-3 uppercase tracking-wider">Không Chiến Sinh Tử</h4>
              <p className="text-[11px] text-[#8b949e] leading-relaxed mt-1">Gồng lãi theo tốc độ cất cánh phi thuyền để ăn x100 cược.</p>
            </div>
            <button 
              onClick={() => onOpenGame('airplane')}
              className="w-full py-2 bg-cyan-950/20 border border-cyan-500 hover:bg-cyan-500 hover:text-black text-cyan-500 font-mono text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Chơi Ngay
            </button>
          </div>

          {/* Card Crypto Trading */}
          <div className="glass-box p-4 border-yellow-500/40 flex flex-col justify-between h-[180px]">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-2xl">📈</span>
                <span className="text-[9px] font-mono bg-yellow-600/10 border border-yellow-500/30 text-yellow-400 py-0.5 px-2 rounded uppercase font-black">TRADING</span>
              </div>
              <h4 className="text-white font-bold text-sm mt-3 uppercase tracking-wider">Giao Dịch Crypto Live</h4>
              <p className="text-[11px] text-[#8b949e] leading-relaxed mt-1">Bán coin chốt lời kịp lúc trước khi thị trường bị xả sập sàn.</p>
            </div>
            <button 
              onClick={() => onOpenGame('crypto')}
              className="w-full py-2 bg-yellow-950/20 border border-yellow-500 hover:bg-yellow-500 hover:text-black text-yellow-500 font-mono text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Chơi Ngay
            </button>
          </div>

          {/* Card Horse Race */}
          <div className="glass-box p-4 border-[#d2a679]/40 flex flex-col justify-between h-[180px]">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-2xl">🐎</span>
                <span className="text-[9px] font-mono bg-amber-600/10 border border-amber-500/30 text-amber-400 py-0.5 px-2 rounded uppercase font-black">RACING</span>
              </div>
              <h4 className="text-white font-bold text-sm mt-3 uppercase tracking-wider">Đua Ngựa Hoàng Gia</h4>
              <p className="text-[11px] text-[#8b949e] leading-relaxed mt-1">Đoán chiến mã bứt tốc vượt rào về nhất để thắng gấp 3 lần PP.</p>
            </div>
            <button 
              onClick={() => onOpenGame('horse')}
              className="w-full py-2 bg-amber-950/20 border border-amber-500 hover:bg-amber-500 hover:text-black text-amber-500 font-mono text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Chơi Ngay
            </button>
          </div>

          {/* Card Claw Machine */}
          <div className="glass-box p-4 border-pink-500/40 flex flex-col justify-between h-[180px]">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-2xl">🧸</span>
                <span className="text-[9px] font-mono bg-pink-600/10 border border-pink-500/30 text-pink-400 py-0.5 px-2 rounded uppercase font-black">ARCADE</span>
              </div>
              <h4 className="text-white font-bold text-sm mt-3 uppercase tracking-wider">Máy Gắp Thú VIP</h4>
              <p className="text-[11px] text-[#8b949e] leading-relaxed mt-1">Căn ngàm thả chuẩn xác gắp kỳ lân ăn Jackpot x10 PP cược.</p>
            </div>
            <button 
              onClick={() => onOpenGame('claw')}
              className="w-full py-2 bg-pink-950/20 border border-pink-500 hover:bg-pink-500 hover:text-black text-pink-500 font-mono text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Chơi Ngay
            </button>
          </div>

          {/* Card FC Mobile Match */}
          <div className="glass-box p-4 border-slate-500/40 flex flex-col justify-between h-[180px]">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-2xl">🏟️</span>
                <span className="text-[9px] font-mono bg-slate-600/10 border border-slate-500/30 text-slate-400 py-0.5 px-2 rounded uppercase font-black">SIMULATOR</span>
              </div>
              <h4 className="text-white font-bold text-sm mt-3 uppercase tracking-wider">FC Mobile Arena</h4>
              <p className="text-[11px] text-[#8b949e] leading-relaxed mt-1">Cổ vũ trận đấu 90s, cược cách biệt 2 bàn rinh Jackpot x2.5 cược.</p>
            </div>
            <button 
              onClick={() => onOpenGame('fcmobile')}
              className="w-full py-2 bg-slate-950/20 border border-slate-500 hover:bg-slate-500 hover:text-black text-slate-500 font-mono text-xs font-bold uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3.5 h-3.5" /> Chơi Ngay
            </button>
          </div>

        </div>
      </div>

      {/* 2. MULTIPLAYER REALTIME GAMES LOBBIES */}
      <div>
        <h3 className="text-glow-green text-[#00ff80] font-mono font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#00ff80]" /> [ II. ĐẤU TRƯỜNG ĐA NGƯỜI CHƠI (MULTI-PLAYER) ]
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* A. RPS Rock Paper Scissors Lobby */}
          <div className="glass-box p-5 border-[#00ff80]/30 flex flex-col justify-between min-h-[420px]">
            <div>
              <h4 className="text-white font-black text-base uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <span>✌️✊✋ OẲN TÙ TÌ</span>
                <span className="text-[9px] font-mono bg-emerald-500/10 border border-[#00ff80] text-[#00ff80] py-0.5 px-1.5 rounded">1VS1 LIVE</span>
              </h4>

              {/* Create rps room form */}
              <div className="flex gap-2 mb-4 font-mono text-xs">
                <input
                  type="number"
                  className="bg-black/40 border border-[#30363d] rounded-lg p-2 text-center text-[#ffd700] text-glow-gold font-bold w-1/2 focus:border-[#00ff80]"
                  value={rpsStake}
                  onChange={(e) => setRpsStake(e.target.value)}
                />
                <button
                  onClick={handleCreateRpsRoom}
                  className="py-2 px-3 bg-emerald-950/20 hover:bg-[#00ff80] hover:text-black border border-[#00ff80] text-[#00ff80] font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-1 transition w-1/2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tạo bàn
                </button>
              </div>

              {/* Rooms list */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {rpsRooms.length === 0 ? (
                  <div className="text-white/20 italic text-center font-mono py-8 text-xs border border-dashed border-white/5 rounded-lg">
                    Chưa có bàn đấu nào. Hãy tạo bàn đầu tiên!
                  </div>
                ) : (
                  rpsRooms.map((room) => (
                    <div key={room.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                      <div>
                        <div className="text-white font-bold truncate max-w-[120px]">{room.p1Name}</div>
                        <div className="text-[#ffd700] text-glow-gold font-black mt-0.5">{room.bet.toLocaleString()} PP</div>
                      </div>
                      <div>
                        {room.p2 ? (
                          <span className="py-1 px-2.5 bg-red-950/20 border border-red-500/30 text-red-400 font-bold rounded-lg uppercase text-[9px]">
                            Full ván
                          </span>
                        ) : (
                          <button
                            onClick={() => handleJoinRpsRoom(room.id!)}
                            className="py-1 px-3.5 bg-emerald-950/20 hover:bg-[#00ff80] hover:text-black border border-[#00ff80] text-[#00ff80] font-bold rounded-lg uppercase transition cursor-pointer text-[10px]"
                          >
                            Đấu ngay
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* B. Blackjack (Xì Dách) Lobby */}
          <div className="glass-box p-5 border-[#ff8c00]/30 flex flex-col justify-between min-h-[420px]">
            <div>
              <h4 className="text-white font-black text-base uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <span>🃏 SÒNG XÌ DÁCH</span>
                <span className="text-[9px] font-mono bg-yellow-500/10 border border-[#ff8c00] text-[#ff8c00] py-0.5 px-1.5 rounded">BOT DEALER</span>
              </h4>

              {/* Create blackjack room form */}
              <div className="flex gap-2 mb-4 font-mono text-xs">
                <input
                  type="number"
                  className="bg-black/40 border border-[#30363d] rounded-lg p-2 text-center text-[#ffd700] text-glow-gold font-bold w-1/2 focus:border-[#ff8c00]"
                  value={bjStake}
                  onChange={(e) => setBjStake(e.target.value)}
                />
                <button
                  onClick={handleCreateBlackjackRoom}
                  className="py-2 px-3 bg-amber-950/20 hover:bg-[#ff8c00] hover:text-black border border-[#ff8c00] text-[#ff8c00] font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-1 transition w-1/2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tạo sòng
                </button>
              </div>

              {/* Rooms list */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {bjRooms.length === 0 ? (
                  <div className="text-white/20 italic text-center font-mono py-8 text-xs border border-dashed border-white/5 rounded-lg">
                    Chưa có sòng bài nào được mở rộng!
                  </div>
                ) : (
                  bjRooms.map((room) => {
                    const playersCount = Object.keys(room.players || {}).length;
                    return (
                      <div key={room.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <div>
                          <div className="text-white font-bold truncate max-w-[120px]">Sòng {room.creatorName}</div>
                          <div className="text-[#ffd700] text-glow-gold font-black mt-0.5">{room.bet.toLocaleString()} PP</div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] text-[#8b949e]">{playersCount}/5 tụ</span>
                          {room.status !== 'WAITING' || playersCount >= 5 ? (
                            <span className="py-1 px-2.5 bg-red-950/20 border border-red-500/30 text-red-400 font-bold rounded-lg uppercase text-[9px]">
                              Full bài
                            </span>
                          ) : (
                            <button
                              onClick={() => handleJoinBlackjackRoom(room.id!)}
                              className="py-1 px-3.5 bg-amber-950/20 hover:bg-[#ff8c00] hover:text-black border border-[#ff8c00] text-[#ff8c00] font-bold rounded-lg uppercase transition cursor-pointer text-[10px]"
                            >
                              Vào sòng
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* C. Tien Len Mien Nam Lobby */}
          <div className="glass-box p-5 border-[#32cd32]/30 flex flex-col justify-between min-h-[420px]">
            <div>
              <h4 className="text-white font-black text-base uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <span>🎴 TIẾN LÊN MIỀN NAM</span>
                <span className="text-[9px] font-mono bg-green-500/10 border border-[#32cd32] text-[#32cd32] py-0.5 px-1.5 rounded">4 PLAYERS LIVE</span>
              </h4>

              {/* Create tien len room form */}
              <div className="flex gap-2 mb-4 font-mono text-xs">
                <input
                  type="number"
                  className="bg-black/40 border border-[#30363d] rounded-lg p-2 text-center text-[#ffd700] text-glow-gold font-bold w-1/2 focus:border-[#32cd32]"
                  value={tlStake}
                  onChange={(e) => setTlStake(e.target.value)}
                />
                <button
                  onClick={handleCreateTienLenRoom}
                  className="py-2 px-3 bg-emerald-950/20 hover:bg-[#32cd32] hover:text-black border border-[#32cd32] text-[#32cd32] font-bold rounded-lg uppercase tracking-wider flex items-center justify-center gap-1 transition w-1/2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tạo phòng
                </button>
              </div>

              {/* Rooms list */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {tlRooms.length === 0 ? (
                  <div className="text-white/20 italic text-center font-mono py-8 text-xs border border-dashed border-white/5 rounded-lg">
                    Chưa có phòng Tiến Lên nào hoạt động!
                  </div>
                ) : (
                  tlRooms.map((room) => {
                    const playersCount = Object.keys(room.players || {}).length;
                    return (
                      <div key={room.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-xs font-mono">
                        <div>
                          <div className="text-white font-bold truncate max-w-[120px]">Phòng {room.creatorName}</div>
                          <div className="text-[#ffd700] text-glow-gold font-black mt-0.5">{room.bet.toLocaleString()} PP</div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] text-[#8b949e]">{playersCount}/4 tụ</span>
                          {room.status !== 'WAITING' || playersCount >= 4 ? (
                            <span className="py-1 px-2.5 bg-red-950/20 border border-red-500/30 text-red-400 font-bold rounded-lg uppercase text-[9px]">
                              Full sảnh
                            </span>
                          ) : (
                            <button
                              onClick={() => handleJoinTienLenRoom(room.id!)}
                              className="py-1 px-3.5 bg-emerald-950/20 hover:bg-[#32cd32] hover:text-black border border-[#32cd32] text-[#32cd32] font-bold rounded-lg uppercase transition cursor-pointer text-[10px]"
                            >
                              Gia nhập
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* D. GLOBAL TOP WINNERS LEADERBOARD */}
          <GlobalTopWinners />

        </div>
      </div>
    </div>
  );
}
