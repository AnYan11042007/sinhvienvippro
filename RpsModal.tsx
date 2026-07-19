/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, onValue, update, remove, push } from 'firebase/database';
import { db } from '../../firebase';
import { X, Trophy, Swords, Zap } from 'lucide-react';
import { User, RpsRoom } from '../../types';

interface RpsModalProps {
  uid: string;
  user: User | null;
  roomId: string;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function RpsModal({ uid, user, roomId, onClose, onShowResult }: RpsModalProps) {
  const [room, setRoom] = useState<RpsRoom | null>(null);

  useEffect(() => {
    const roomRef = ref(db, `rps_rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snap) => {
      if (snap.exists()) {
        setRoom(snap.val() as RpsRoom);
      } else {
        // If room is deleted by owner/system, force close modal
        setRoom(null);
        onClose();
      }
    });

    return () => unsubscribe();
  }, [roomId, onClose]);

  const getRpsEmoji = (c: string | undefined) => {
    if (c === 'KEO') return '✌️';
    if (c === 'BUA') return '✊';
    if (c === 'BAO') return '✋';
    return '❓';
  };

  const checkRpsWin = (p1: string, p2: string) => {
    if (p1 === p2) return 0; // Draw
    if (
      (p1 === 'KEO' && p2 === 'BAO') ||
      (p1 === 'BUA' && p2 === 'KEO') ||
      (p1 === 'BAO' && p2 === 'BUA')
    ) {
      return 1; // P1 wins
    }
    return -1; // P2 wins
  };

  const handleMakeChoice = async (choice: 'KEO' | 'BUA' | 'BAO') => {
    if (!room || room.status !== 'PLAYING') return;

    const isP1 = uid === room.p1;
    const isP2 = uid === room.p2;

    const updatePayload: any = {};
    if (isP1) {
      updatePayload.p1Choice = choice;
    } else if (isP2) {
      updatePayload.p2Choice = choice;
    }

    try {
      // Send choice to Firebase
      await update(ref(db, `rps_rooms/${roomId}`), updatePayload);

      // Reload fresh snapshot to check if both made selections
      const rSnap = await get(ref(db, `rps_rooms/${roomId}`));
      if (!rSnap.exists()) return;
      const freshRoom = rSnap.val() as RpsRoom;

      if (freshRoom.p1Choice && freshRoom.p2Choice) {
        // Evaluate outcomes
        const res = checkRpsWin(freshRoom.p1Choice, freshRoom.p2Choice);
        let finalMsg = '';

        const u1Snap = await get(ref(db, `users/${freshRoom.p1}`));
        const u2Snap = await get(ref(db, `users/${freshRoom.p2}`));

        const u1Data = u1Snap.val() as User;
        const u2Data = u2Snap.val() as User;

        if (res === 1) {
          // P1 wins whole pot (bet * 2)
          await update(ref(db, `users/${freshRoom.p1}`), { pp: (u1Data.pp || 0) + (freshRoom.bet * 2) });
          finalMsg = `<span class="text-emerald-400 font-bold">${freshRoom.p1Name} ĐÃ CHIẾN THẮNG ! Húp trọn toàn bộ tiền cược.<br>🔥 ${freshRoom.p2Name} bị trừ -${freshRoom.bet.toLocaleString()} PP!</span>`;
          
          await push(ref(db, 'game_logs'), {
            uid: freshRoom.p1, name: freshRoom.p1Name, game: "Oẳn Tù Tì", bet: freshRoom.bet, pnl: freshRoom.bet, result: "Thắng", time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
          });
          await push(ref(db, 'game_logs'), {
            uid: freshRoom.p2, name: freshRoom.p2Name, game: "Oẳn Tù Tì", bet: freshRoom.bet, pnl: -freshRoom.bet, result: "Thua", time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
          });
        } else if (res === -1) {
          // P2 wins
          await update(ref(db, `users/${freshRoom.p2}`), { pp: (u2Data.pp || 0) + (freshRoom.bet * 2) });
          finalMsg = `<span class="text-[#ff003c] font-bold">${freshRoom.p2Name} ĐÃ CHIẾN THẮNG ! Húp trọn toàn bộ tiền cược.<br>🔥 ${freshRoom.p1Name} bị trừ -${freshRoom.bet.toLocaleString()} PP!</span>`;

          await push(ref(db, 'game_logs'), {
            uid: freshRoom.p2, name: freshRoom.p2Name, game: "Oẳn Tù Tì", bet: freshRoom.bet, pnl: freshRoom.bet, result: "Thắng", time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
          });
          await push(ref(db, 'game_logs'), {
            uid: freshRoom.p1, name: freshRoom.p1Name, game: "Oẳn Tù Tì", bet: freshRoom.bet, pnl: -freshRoom.bet, result: "Thua", time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
          });
        } else {
          // Draw -> refund both
          await update(ref(db, `users/${freshRoom.p1}`), { pp: (u1Data.pp || 0) + freshRoom.bet });
          await update(ref(db, `users/${freshRoom.p2}`), { pp: (u2Data.pp || 0) + freshRoom.bet });
          finalMsg = `<span class="text-glow-gold text-[#ffd700] font-bold">HÒA NHAU ! HOÀN LẠI TIỀN CƯỢC CHO CẢ HAI BÊN.</span>`;
        }

        // Close round
        await update(ref(db, `rps_rooms/${roomId}`), {
          status: 'ENDED',
          finalMsg: finalMsg
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartGame = async () => {
    if (!room || !room.p2) return;

    try {
      const u1Snap = await get(ref(db, `users/${room.p1}`));
      const u2Snap = await get(ref(db, `users/${room.p2}`));

      const u1Data = u1Snap.val() as User;
      const u2Data = u2Snap.val() as User;

      if ((u1Data.pp || 0) < room.bet || (u2Data.pp || 0) < room.bet) {
        await remove(ref(db, `rps_rooms/${roomId}`));
        alert('Có người không đủ số PP để theo kèo, giải tán bàn!');
        return;
      }

      // Deduct PP from both on start
      await update(ref(db, `users/${room.p1}`), { pp: (u1Data.pp || 0) - room.bet });
      await update(ref(db, `users/${room.p2}`), { pp: (u2Data.pp || 0) - room.bet });

      await update(ref(db, `rps_rooms/${roomId}`), {
        status: 'PLAYING',
        p1Choice: '',
        p2Choice: '',
        finalMsg: '',
        p1Rematch: false,
        p2Rematch: false
      });
    } catch (err) {
      alert('Lỗi khởi động kèo đấu!');
    }
  };

  const handleRematch = async () => {
    if (!room) return;
    const isP1 = uid === room.p1;
    const updatePayload: any = {};
    if (isP1) {
      updatePayload.p1Rematch = true;
    } else {
      updatePayload.p2Rematch = true;
    }

    try {
      await update(ref(db, `rps_rooms/${roomId}`), updatePayload);

      // Check if both agreed to play again
      const rSnap = await get(ref(db, `rps_rooms/${roomId}`));
      if (!rSnap.exists()) return;
      const freshRoom = rSnap.val() as RpsRoom;

      if (freshRoom.p1Rematch && freshRoom.p2Rematch) {
        const u1Snap = await get(ref(db, `users/${freshRoom.p1}`));
        const u2Snap = await get(ref(db, `users/${freshRoom.p2}`));

        const u1Data = u1Snap.val() as User;
        const u2Data = u2Snap.val() as User;

        if ((u1Data.pp || 0) < freshRoom.bet || (u2Data.pp || 0) < freshRoom.bet) {
          await remove(ref(db, `rps_rooms/${roomId}`));
          alert('Có đối thủ cạn kiệt PP, sập sòng!');
          return;
        }

        // Deduct stakes and relaunch
        await update(ref(db, `users/${freshRoom.p1}`), { pp: (u1Data.pp || 0) - freshRoom.bet });
        await update(ref(db, `users/${freshRoom.p2}`), { pp: (u2Data.pp || 0) - freshRoom.bet });

        await update(ref(db, `rps_rooms/${roomId}`), {
          status: 'PLAYING',
          p1Choice: '',
          p2Choice: '',
          finalMsg: '',
          p1Rematch: false,
          p2Rematch: false
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) {
      onClose();
      return;
    }

    if (room.status === 'PLAYING') {
      alert('Đang trong trận đấu không thể bỏ chạy giữa chừng!');
      return;
    }

    try {
      if (room.p1 === uid) {
        // Owner leaves -> delete room, refund guests if waiting
        if (room.status === 'WAITING' && room.p2) {
          const u2Snap = await get(ref(db, `users/${room.p2}`));
          // Wait, if it is WAITING, they haven't started playing, so they still have their PP! 
          // (Only start deducts PP from users).
        }
        await remove(ref(db, `rps_rooms/${roomId}`));
      } else {
        // Guest leaves -> vacate slot
        await update(ref(db, `rps_rooms/${roomId}`), {
          p2: null,
          p2Name: null,
          p2Avatar: null
        });
      }
      onClose();
      alert('Đã thoát kèo đấu!');
    } catch (err) {
      console.error(err);
    }
  };

  if (!room) return null;

  const isP1 = uid === room.p1;
  const isP2 = uid === room.p2;
  const myChoice = isP1 ? room.p1Choice : isP2 ? room.p2Choice : '';
  const opponentChoice = isP1 ? room.p2Choice : isP2 ? room.p1Choice : '';

  const hasMadeSelection = myChoice !== '';
  const opponentSelected = opponentChoice !== '';

  return (
    <div className="overlay z-[4500]">
      <div className="glass-box login-panel max-w-[850px] p-6 border-[#00ff80] relative">
        <button 
          onClick={handleLeaveRoom}
          className="absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#00ff80] text-glow-green text-2xl font-black font-mono uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
          <Swords className="w-5 h-5 animate-pulse text-[#00ff80]" /> KÈO OẲN TÙ TÌ 1VS1 LIVE
        </h2>
        <p className="text-[10px] font-mono text-[#8b949e] uppercase mb-6">
          Kéo búa bao thực chiến đa người chơi S-System
        </p>

        {/* Playboard card arena */}
        <div className="relative w-full h-[380px] bg-gradient-to-b from-[#1a1a2e] to-[#0d0d1a] border-4 border-[#00ff80] rounded-3xl overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,0.9)] select-none mb-4">
          
          {/* Stake pot */}
          <div className="absolute top-[12%] left-1/2 -translate-x-1/2 bg-black/60 py-1.5 px-6 border border-[#00ff80] text-[#00ff80] rounded-full text-xs font-bold font-mono tracking-widest uppercase">
            TỔNG TIỀN CƯỢC: {(room.bet * 2).toLocaleString()} PP
          </div>

          {/* Duel area */}
          <div className="absolute top-[28%] left-0 w-full flex justify-around items-center px-6">
            
            {/* Player 1 Card */}
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-14 h-14 rounded-full border-2 border-emerald-400 overflow-hidden bg-black/40 shadow-lg">
                {room.p1Avatar ? <img src={room.p1Avatar} alt="" className="w-full h-full object-cover" /> : '🤔'}
              </div>
              <strong className="text-emerald-400 text-xs truncate max-w-[110px]">{room.p1Name}</strong>
              
              {/* Choice display */}
              {room.status === 'PLAYING' && (
                <div className="text-4xl animate-bounce mt-2 select-none">
                  {room.p1Choice ? '✔️' : '🤔'}
                </div>
              )}
              {room.status === 'ENDED' && (
                <div className="rps-hand drop text-5xl select-none">
                  {getRpsEmoji(room.p1Choice)}
                </div>
              )}
            </div>

            <div className="text-4xl font-extrabold italic text-[#ff003c] tracking-wider animate-pulse">VS</div>

            {/* Player 2 Card */}
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-14 h-14 rounded-full border-2 border-[#ff003c] overflow-hidden bg-black/40 shadow-lg">
                {room.p2 ? (
                  room.p2Avatar ? <img src={room.p2Avatar} alt="" className="w-full h-full object-cover" /> : '🤔'
                ) : '❓'}
              </div>
              <strong className={room.p2 ? 'text-[#ff003c] text-xs truncate max-w-[110px]' : 'text-white/40 text-xs'}>
                {room.p2 ? room.p2Name : 'Đang chờ đối thủ...'}
              </strong>

              {/* Choice display */}
              {room.p2 && room.status === 'PLAYING' && (
                <div className="text-4xl animate-bounce mt-2 select-none">
                  {room.p2Choice ? '✔️' : '🤔'}
                </div>
              )}
              {room.status === 'ENDED' && (
                <div className="rps-hand drop text-5xl select-none">
                  {getRpsEmoji(room.p2Choice)}
                </div>
              )}
            </div>

          </div>

          {/* Commentary result text */}
          <div 
            className="absolute bottom-[20%] left-1/2 -translate-x-1/2 text-center text-sm font-bold w-[90%] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: room.status === 'WAITING' ? (room.p2 ? 'SẴN SÀNG KHAI CHIẾN!' : 'Vui lòng chờ đợi đối thủ ghép cặp đấu...') : room.status === 'PLAYING' ? 'CHỌN NHANH QUÂN BÀI ĐỂ KHOÁ BÚA BAO!' : (room.finalMsg || '') }}
          />

          {/* Action selection row */}
          {room.status === 'PLAYING' && !hasMadeSelection && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-4 z-30 font-mono">
              <button
                onClick={() => handleMakeChoice('KEO')}
                className="py-2.5 px-5 bg-zinc-950/20 hover:bg-[#00ff80]/10 border border-[#00ff80] text-white hover:text-[#00ff80] font-black rounded-lg cursor-pointer transition"
              >
                ✌️ KÉO
              </button>
              <button
                onClick={() => handleMakeChoice('BUA')}
                className="py-2.5 px-5 bg-zinc-950/20 hover:bg-[#00ff80]/10 border border-[#00ff80] text-white hover:text-[#00ff80] font-black rounded-lg cursor-pointer transition"
              >
                ✊ BÚA
              </button>
              <button
                onClick={() => handleMakeChoice('BAO')}
                className="py-2.5 px-5 bg-zinc-950/20 hover:bg-[#00ff80]/10 border border-[#00ff80] text-white hover:text-[#00ff80] font-black rounded-lg cursor-pointer transition"
              >
                ✋ BAO
              </button>
            </div>
          )}

          {/* Waiting banner */}
          {room.status === 'PLAYING' && hasMadeSelection && !opponentSelected && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-glow-gold text-[#ffd700] text-xs font-bold uppercase tracking-wider animate-pulse text-center">
              ĐÃ CHỌN XONG! Đang đợi đối thủ ra đòn...
            </div>
          )}

          {/* End Rematch row */}
          {room.status === 'ENDED' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-30 font-mono text-xs">
              <button
                onClick={handleRematch}
                className="py-2.5 px-6 bg-yellow-950/20 border border-[#ffd700] text-[#ffd700] text-glow-gold hover:bg-[#ffd700]/10 font-bold rounded-lg uppercase tracking-wider cursor-pointer"
              >
                {room.p1Rematch && isP1 ? 'ĐÃ ĐỒNG Ý RE-MATCH' : room.p2Rematch && isP2 ? 'ĐÃ ĐỒNG Ý RE-MATCH' : '[ TÁI ĐẤU ]'}
              </button>
              <button
                onClick={handleLeaveRoom}
                className="py-2.5 px-6 bg-red-950/20 border border-[#ff003c] text-[#ff003c] hover:bg-[#ff003c] hover:text-white font-bold rounded-lg uppercase tracking-wider cursor-pointer"
              >
                [ RỜI SÒNG ]
              </button>
            </div>
          )}

          {/* Owner Start action */}
          {room.status === 'WAITING' && room.creator === uid && room.p2 && (
            <button
              onClick={handleStartGame}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 py-3 px-8 bg-emerald-950/20 border border-[#00ff80] text-[#00ff80] hover:bg-[#00ff80] hover:text-black font-extrabold rounded-xl text-base uppercase tracking-widest transition-all cursor-pointer text-glow-green"
            >
              [ KHAI CHIẾN ]
            </button>
          )}

        </div>

        <button
          onClick={handleLeaveRoom}
          className="w-full py-2.5 border border-dashed border-[#ff003c]/50 text-red-500 hover:bg-red-500/10 font-bold font-mono text-xs tracking-wider rounded-lg uppercase cursor-pointer"
        >
          <X className="w-3.5 h-3.5 inline mr-1" /> RỜI BÀN ĐẤU
        </button>
      </div>
    </div>
  );
}
