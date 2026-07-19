/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, onValue, update, remove, push } from 'firebase/database';
import { db } from '../../firebase';
import { X, Trophy, Swords, Zap } from 'lucide-react';
import { User, TienLenRoom } from '../../types';

interface TienLenModalProps {
  uid: string;
  user: User | null;
  roomId: string;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

const SUITS = ['♠', '♣', '♦', '♥'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

export default function TienLenModal({ uid, user, roomId, onClose, onShowResult }: TienLenModalProps) {
  const [room, setRoom] = useState<TienLenRoom | null>(null);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  useEffect(() => {
    const roomRef = ref(db, `tienlen_rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snap) => {
      if (snap.exists()) {
        setRoom(snap.val() as TienLenRoom);
      } else {
        setRoom(null);
        onClose();
      }
    });

    return () => unsubscribe();
  }, [roomId, onClose]);

  // Helpers to split card attributes
  const getCardRankAndSuit = (val: number) => {
    const r = RANKS[Math.floor(val / 4)];
    const s = SUITS[val % 4];
    const isRed = val % 4 === 2 || val % 4 === 3;
    return { r, s, isRed };
  };

  const getRankPower = (val: number) => Math.floor(val / 4);
  const getSuitPower = (val: number) => val % 4;

  const sortCards = (cards: number[]) => {
    return [...cards].sort((a, b) => {
      const pA = getRankPower(a);
      const pB = getRankPower(b);
      if (pA !== pB) return pA - pB;
      return getSuitPower(a) - getSuitPower(b);
    });
  };

  // Analyze combination type
  const analyzeCards = (cards: number[]) => {
    if (cards.length === 0) return { type: 'INVALID', power: 0 };

    const sorted = sortCards(cards);
    const ranks = sorted.map(getRankPower);
    const len = sorted.length;

    // Single
    if (len === 1) {
      return { type: 'SINGLE', power: sorted[0] };
    }

    // Pair
    if (len === 2) {
      if (ranks[0] === ranks[1]) {
        return { type: 'PAIR', power: sorted[1] }; // highest card determines suit breaker
      }
    }

    // Triple
    if (len === 3) {
      if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
        return { type: 'TRIPLE', power: sorted[2] };
      }
    }

    // Four of a kind (Tứ quý)
    if (len === 4) {
      if (ranks[0] === ranks[1] && ranks[1] === ranks[2] && ranks[2] === ranks[3]) {
        return { type: 'TUQUY', power: sorted[3] };
      }
    }

    // Straight (Sảnh) - No straights ending on 2 in Vietnam Tien Len Rules
    if (len >= 3) {
      let isStraight = true;
      const containsTwo = sorted.some(c => getRankPower(c) === 12); // Rank 12 is '2'

      if (!containsTwo) {
        for (let i = 0; i < len - 1; i++) {
          if (ranks[i + 1] - ranks[i] !== 1) {
            isStraight = false;
            break;
          }
        }
        if (isStraight) {
          return { type: 'STRAIGHT', power: sorted[len - 1], size: len };
        }
      }
    }

    // Double Straights (Thông/Đôi thông)
    if (len >= 6 && len % 2 === 0) {
      const pairsCount = len / 2;
      let isThong = true;

      for (let i = 0; i < pairsCount; i++) {
        const idx = i * 2;
        if (ranks[idx] !== ranks[idx + 1]) {
          isThong = false;
          break;
        }
      }

      if (isThong) {
        // Check consecutive ranks
        for (let i = 0; i < pairsCount - 1; i++) {
          const idxA = i * 2;
          const idxB = (i + 1) * 2;
          if (ranks[idxB] - ranks[idxA] !== 1) {
            isThong = false;
            break;
          }
        }
        if (isThong) {
          return { type: 'THONG', power: sorted[len - 1], size: pairsCount };
        }
      }
    }

    return { type: 'INVALID', power: 0 };
  };

  const canBeat = (played: number[], table: number[]) => {
    const pInfo = analyzeCards(played);
    const tInfo = analyzeCards(table);

    if (pInfo.type === 'INVALID') return false;

    // Free playing if table is empty
    if (table.length === 0) return true;

    if (tInfo.type === 'INVALID') return true;

    // Normal case: same combination types beating
    if (pInfo.type === tInfo.type) {
      if (pInfo.type === 'STRAIGHT' || pInfo.type === 'THONG') {
        if ((pInfo as any).size !== (tInfo as any).size) return false;
      }
      // Simple rank and suit breaker checks
      return played[played.length - 1] > table[table.length - 1];
    }

    // Special chops: Chopping 2s (Rác 2)
    const isTableTwo = table.length === 1 && getRankPower(table[0]) === 12;
    if (isTableTwo) {
      // 3 Pairs of Thông or Tứ Quý or 4 Pairs of Thông can chop standard single 2
      if (pInfo.type === 'TUQUY' || (pInfo.type === 'THONG' && (pInfo as any).size >= 3)) {
        return true;
      }
    }

    // Chopping Pairs of 2s
    const isTablePairOfTwos = table.length === 2 && getRankPower(table[0]) === 12 && getRankPower(table[1]) === 12;
    if (isTablePairOfTwos) {
      // Tứ quý or 4 Pairs of Thông can chop pair of 2s
      if (pInfo.type === 'TUQUY' || (pInfo.type === 'THONG' && (pInfo as any).size >= 4)) {
        return true;
      }
    }

    // Chopping Tứ quý
    if (tInfo.type === 'TUQUY') {
      if (pInfo.type === 'TUQUY' && played[played.length - 1] > table[table.length - 1]) return true;
      if (pInfo.type === 'THONG' && (pInfo as any).size >= 4) return true;
    }

    // Chopping 3 Pairs of Thông
    if (tInfo.type === 'THONG' && (tInfo as any).size === 3) {
      if (pInfo.type === 'TUQUY') return true;
      if (pInfo.type === 'THONG' && (pInfo as any).size >= 3 && played[played.length - 1] > table[table.length - 1]) return true;
    }

    return false;
  };

  const handleToggleCardSelection = (v: number) => {
    setSelectedCards((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  };

  const handleStartGame = async () => {
    if (!room || room.status !== 'WAITING') return;

    try {
      const playersList = Object.keys(room.players);
      const updatePayload: any = {};
      const activeUids: string[] = [];

      // Check balance profiles
      for (const pU of playersList) {
        const uSnap = await get(ref(db, `users/${pU}`));
        const balance = uSnap.val()?.pp || 0;

        if (balance >= room.bet) {
          activeUids.push(pU);
          updatePayload[`/users/${pU}/pp`] = balance - room.bet;
        } else {
          updatePayload[`/tienlen_rooms/${roomId}/players/${pU}`] = null;
        }
      }

      if (activeUids.length < 2) {
        alert('Tối thiểu cần 2 người chơi có đủ PP để cất bài!');
        return;
      }

      // Generate full deck
      const deck: number[] = Array.from({ length: 52 }, (_, i) => i);
      // Shuffle
      for (let i = 51; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      // Deal 13 cards to each player
      activeUids.forEach((pU) => {
        const hand: number[] = [];
        for (let i = 0; i < 13; i++) {
          hand.push(deck.pop()!);
        }
        updatePayload[`/tienlen_rooms/${roomId}/players/${pU}/hand`] = sortCards(hand);
        updatePayload[`/tienlen_rooms/${roomId}/players/${pU}/status`] = 'PLAYING';
      });

      // Find player with lowest card (Spade 3 is 0) to start first turn
      let lowestCard = 999;
      let startIdx = 0;

      activeUids.forEach((pU, i) => {
        const hand = updatePayload[`/tienlen_rooms/${roomId}/players/${pU}/hand`];
        if (hand[0] < lowestCard) {
          lowestCard = hand[0];
          startIdx = i;
        }
      });

      updatePayload[`/tienlen_rooms/${roomId}/status`] = 'PLAYING';
      updatePayload[`/tienlen_rooms/${roomId}/activePlayers`] = activeUids;
      updatePayload[`/tienlen_rooms/${roomId}/turnIdx`] = startIdx;
      updatePayload[`/tienlen_rooms/${roomId}/tableCards`] = [];
      updatePayload[`/tienlen_rooms/${roomId}/passedPlayers`] = [];
      updatePayload[`/tienlen_rooms/${roomId}/lastPlayUid`] = '';

      await update(ref(db, '/'), updatePayload);
    } catch (err) {
      alert('Lỗi chia bài Tiến Lên!');
    }
  };

  const handlePlayCards = async () => {
    if (!room || room.status !== 'PLAYING' || room.turnIdx === undefined || !room.activePlayers) return;

    const activeUids = room.activePlayers;
    const currentTurnUid = activeUids[room.turnIdx];

    if (currentTurnUid !== uid) {
      alert('Chưa tới lượt đi của bạn!');
      return;
    }

    if (selectedCards.length === 0) {
      alert('Vui lòng chọn bài để đánh!');
      return;
    }

    const table = room.tableCards ? [...room.tableCards] : [];

    // Play validation
    if (!canBeat(selectedCards, table)) {
      alert('Cặp bài bạn chọn không hợp lệ hoặc không đủ mạnh để đè bàn!');
      return;
    }

    try {
      const pHand = room.players[uid].hand ? [...room.players[uid].hand] : [];
      const nextHand = pHand.filter((v) => !selectedCards.includes(v));

      const updatePayload: any = {};
      updatePayload[`/tienlen_rooms/${roomId}/players/${uid}/hand`] = nextHand;
      updatePayload[`/tienlen_rooms/${roomId}/tableCards`] = selectedCards;
      updatePayload[`/tienlen_rooms/${roomId}/lastPlayUid`] = uid;

      setSelectedCards([]);

      if (nextHand.length === 0) {
        // User won the whole prize pool!
        const totalPot = room.bet * activeUids.length;
        const uSnap = await get(ref(db, `users/${uid}`));
        const balance = uSnap.val()?.pp || 0;

        updatePayload[`/users/${uid}/pp`] = balance + totalPot;
        updatePayload[`/tienlen_rooms/${roomId}/status`] = 'ENDED';

        let winSummary = `<span class="text-glow-green text-[#00ff80] font-black text-lg">${user?.name} ĐÃ TỚI NHẤT TRẬN ĐẤU !!!</span><br>`;
        winSummary += `Húp trọn sòng PP: +${totalPot.toLocaleString()} PP!<br><br><b>Các đối thủ còn lại:</b><br>`;

        for (const opUid of activeUids) {
          if (opUid !== uid) {
            const opData = room.players[opUid];
            const leftCount = opData.hand ? opData.hand.length : 0;
            winSummary += `• ${opData.name}: còn ${leftCount} lá bài trên tay (-${room.bet.toLocaleString()})<br>`;
            
            await push(ref(db, 'game_logs'), {
              uid: opUid, name: opData.name, game: "Tiến Lên", bet: room.bet, pnl: -room.bet, result: "Thua", time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
            });
          }
        }

        updatePayload[`/tienlen_rooms/${roomId}/finalMsg`] = winSummary;

        await push(ref(db, 'game_logs'), {
          uid, name: user?.name, game: "Tiến Lên", bet: room.bet, pnl: totalPot - room.bet, result: "Tới Nhất", time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
        });

        await update(ref(db, '/'), updatePayload);

        // Auto clean back to waiting lobby after 10s
        setTimeout(async () => {
          const freshS = await get(ref(db, `tienlen_rooms/${roomId}`));
          if (!freshS.exists()) return;
          const freshR = freshS.val() as TienLenRoom;

          const resetP: any = {
            status: 'WAITING',
            finalMsg: '',
            tableCards: null,
            lastPlayUid: '',
            passedPlayers: null,
            turnIdx: 0,
            activePlayers: []
          };

          for (const pU in freshR.players) {
            resetP[`players/${pU}/status`] = 'WAITING';
            resetP[`players/${pU}/hand`] = [];
          }

          await update(ref(db, `tienlen_rooms/${roomId}`), resetP);
        }, 10000);

      } else {
        // Normal next turn logic
        let nextTurnIdx = (room.turnIdx + 1) % activeUids.length;
        const passedList = room.passedPlayers ? [...room.passedPlayers] : [];

        // Skip players who passed
        while (passedList.includes(activeUids[nextTurnIdx])) {
          nextTurnIdx = (nextTurnIdx + 1) % activeUids.length;
        }

        updatePayload[`/tienlen_rooms/${roomId}/turnIdx`] = nextTurnIdx;
        await update(ref(db, '/'), updatePayload);
      }

    } catch (err) {
      console.error(err);
    }
  };

  const handlePass = async () => {
    if (!room || room.status !== 'PLAYING' || room.turnIdx === undefined || !room.activePlayers) return;

    const activeUids = room.activePlayers;
    const currentTurnUid = activeUids[room.turnIdx];

    if (currentTurnUid !== uid) return;

    if (!room.tableCards || room.tableCards.length === 0) {
      alert('Không thể bỏ lượt khi vòng đấu chưa khai bài!');
      return;
    }

    try {
      const passedList = room.passedPlayers ? [...room.passedPlayers] : [];
      if (!passedList.includes(uid)) {
        passedList.push(uid);
      }

      const updatePayload: any = {};
      setSelectedCards([]);

      // Check if all players passed except one (the last play owner)
      const nonPassedCount = activeUids.length - passedList.length;

      if (nonPassedCount <= 1) {
        // Start a fresh round of playing!
        const nextLeadUid = room.lastPlayUid || activeUids[0];
        let leadIdx = activeUids.indexOf(nextLeadUid);
        if (leadIdx === -1) leadIdx = 0;

        updatePayload[`/tienlen_rooms/${roomId}/tableCards`] = [];
        updatePayload[`/tienlen_rooms/${roomId}/passedPlayers`] = [];
        updatePayload[`/tienlen_rooms/${roomId}/turnIdx`] = leadIdx;
        updatePayload[`/tienlen_rooms/${roomId}/lastPlayUid`] = '';
      } else {
        // Next active turn
        let nextTurnIdx = (room.turnIdx + 1) % activeUids.length;
        while (passedList.includes(activeUids[nextTurnIdx])) {
          nextTurnIdx = (nextTurnIdx + 1) % activeUids.length;
        }
        updatePayload[`/tienlen_rooms/${roomId}/turnIdx`] = nextTurnIdx;
        updatePayload[`/tienlen_rooms/${roomId}/passedPlayers`] = passedList;
      }

      await update(ref(db, '/'), updatePayload);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) {
      onClose();
      return;
    }

    if (room.status === 'PLAYING' && room.activePlayers && room.activePlayers.includes(uid)) {
      alert('Đang trong trận đấu gay cấn không thể chạy trốn!');
      return;
    }

    try {
      if (room.creator === uid || !room.players || Object.keys(room.players).length <= 1) {
        await remove(ref(db, `tienlen_rooms/${roomId}`));
      } else {
        await remove(ref(db, `tienlen_rooms/${roomId}/players/${uid}`));
        if (room.activePlayers) {
          const nextActive = room.activePlayers.filter((x) => x !== uid);
          await update(ref(db, `tienlen_rooms/${roomId}`), {
            activePlayers: nextActive
          });
        }
      }
      onClose();
      alert('Đã rời phòng Tiến Lên!');
    } catch (err) {
      console.error(err);
    }
  };

  if (!room) return null;

  const isMyTurn = room.status === 'PLAYING' && room.activePlayers && room.activePlayers[room.turnIdx || 0] === uid;
  const myPassed = room.passedPlayers && room.passedPlayers.includes(uid);

  return (
    <div className="overlay z-[4500]">
      <div className="glass-box login-panel max-w-[1100px] p-6 border-[#32cd32] relative">
        <button 
          onClick={handleLeaveRoom}
          className="absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition z-50"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#32cd32] text-glow-green text-2xl font-black font-mono uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
          <Swords className="w-5 h-5 text-[#32cd32]" /> ĐẤU TRƯỜNG TIẾN LÊN MIỀN NAM
        </h2>
        <p className="text-[10px] font-mono text-[#8b949e] uppercase mb-4">
          Xếp bài đấu trí đa người chơi sống động S-System 88
        </p>

        {/* Playboard card arena */}
        <div className="relative w-full h-[600px] bg-gradient-to-b from-[#1b5e20] to-[#0d3c15] border-8 border-[#388e3c] rounded-[80px] shadow-[inset_0_0_60px_rgba(0,0,0,0.9)] select-none mb-4">
          
          {/* Stake bet banner */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/50 border border-[#32cd32] py-1.5 px-6 rounded-full text-xs font-bold text-[#32cd32] tracking-wider uppercase font-mono z-30 select-none">
            Mức cược: {room.bet.toLocaleString()} PP
          </div>

          {/* Table Cards Played (center spot) */}
          <div className="absolute top-[32%] bottom-[32%] left-[15%] right-[15%] border-2 border-dashed border-white/10 rounded-[50px] flex items-center justify-center bg-black/10 select-none">
            {room.status === 'ENDED' ? (
              <div 
                className="font-mono text-center text-xs text-white leading-relaxed p-4 bg-black/60 rounded-xl max-h-[140px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: room.finalMsg || '' }}
              />
            ) : room.tableCards ? (
              <div className="flex gap-2">
                {room.tableCards.map((v, i) => {
                  const { r, s, isRed } = getCardRankAndSuit(v);
                  return (
                    <div 
                      key={i} 
                      className={`tl-card w-[65px] h-[95px] border rounded-lg flex flex-col justify-between p-1 bg-white font-mono shadow-md ${
                        isRed ? 'text-red-600' : 'text-black'
                      }`}
                    >
                      <div className="text-lg font-black text-left pl-1 leading-none">{r}</div>
                      <div className="text-2xl text-center leading-none">{s}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-white/20 italic text-xs tracking-widest uppercase font-mono select-none">
                ĐANG CHỜ ĐỐI THỦ XUẤT CHIÊU...
              </div>
            )}
          </div>

          {/* Opponent players positions (rendered around boundaries) */}
          <div className="absolute top-18 left-8 flex items-center gap-2.5 z-20">
            {/* Player details on table */}
            {room.players && Object.keys(room.players).map((pUid, idx) => {
              if (pUid === uid) return null;
              const pData = room.players[pUid];
              const isTurn = room.status === 'PLAYING' && room.activePlayers && room.activePlayers[room.turnIdx || 0] === pUid;
              const passed = room.passedPlayers && room.passedPlayers.includes(pUid);

              return (
                <div 
                  key={pUid} 
                  className={`p-3 bg-black/80 rounded-xl border border-white/5 flex flex-col items-center w-[110px] text-center ${
                    isTurn ? 'border-yellow-400 shadow-[0_0_10px_rgba(255,215,0,0.5)] animate-pulse' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-black/30 border border-white/10 mb-1">
                    {pData.avatar ? <img src={pData.avatar} alt="" className="w-full h-full object-cover" /> : '🤔'}
                  </div>
                  <span className="text-white text-[10px] truncate max-w-[95px] font-bold">{pData.name}</span>
                  <span className="text-[9px] text-[#8b949e] mt-1 uppercase font-black bg-white/5 border border-white/5 py-0.5 px-1.5 rounded">
                    {passed ? 'ĐÃ BỎ LƯỢT' : pData.hand && pData.hand.length > 0 ? `${pData.hand.length} LÁ` : 'CHỜ CHIA'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Self Hand Card row (Bottom) */}
          <div className="absolute bottom-6 w-full flex flex-col items-center z-30">
            <div className="flex gap-1.5 px-4 max-w-full overflow-x-auto h-[130px] items-end pb-2">
              {room.players[uid]?.hand?.map((v, i) => {
                const isSel = selectedCards.includes(v);
                const { r, s, isRed } = getCardRankAndSuit(v);
                return (
                  <div
                    key={i}
                    onClick={() => handleToggleCardSelection(v)}
                    style={{
                      transform: isSel ? 'translateY(-24px)' : 'none',
                      transition: 'transform 0.2s ease-out'
                    }}
                    className={`tl-card cursor-pointer w-[60px] h-[90px] border-2 rounded-lg flex flex-col justify-between p-1 bg-white font-mono shadow-md shrink-0 select-none ${
                      isRed ? 'text-red-600' : 'text-black'
                    } ${isSel ? 'border-yellow-400' : 'border-slate-300'}`}
                  >
                    <div className="text-base font-black text-left pl-0.5 leading-none">{r}</div>
                    <div className="text-2xl text-center leading-none">{s}</div>
                  </div>
                );
              })}
            </div>

            {/* Turn action triggers overlay */}
            {isMyTurn && room.status === 'PLAYING' && (
              <div className="flex gap-4 font-mono text-xs mt-3.5 select-none">
                <button
                  onClick={handlePlayCards}
                  className="py-2 px-6 bg-emerald-950/20 border-2 border-dashed border-[#00ff80] text-[#00ff80] text-glow-green hover:bg-[#00ff80]/10 font-black uppercase rounded-lg cursor-pointer"
                >
                  [ 🎯 ĐÁNH BÀI ]
                </button>
                <button
                  onClick={handlePass}
                  className="py-2 px-6 bg-red-950/20 border border-[#ff003c] text-[#ff003c] text-glow-red hover:bg-[#ff003c]/10 font-black uppercase rounded-lg cursor-pointer"
                >
                  [ ✋ BỎ LƯỢT ]
                </button>
              </div>
            )}

            {myPassed && room.status === 'PLAYING' && (
              <div className="text-red-500 font-mono text-xs font-black uppercase tracking-widest text-glow-red mt-2 animate-pulse select-none">
                Bạn đã bỏ lượt vòng này
              </div>
            )}
          </div>

          {/* Lobby host launcher start button */}
          {room.status === 'WAITING' && room.creator === uid && (
            <button
              onClick={handleStartGame}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 py-3.5 px-8 bg-yellow-950/20 border border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700] hover:text-black font-black uppercase rounded-xl tracking-widest text-base transition-all cursor-pointer text-glow-gold z-40"
            >
              [ CHIA BÀI TIẾN LÊN ]
            </button>
          )}

        </div>

        <button
          onClick={handleLeaveRoom}
          className="w-full py-2.5 border border-dashed border-[#ff003c]/50 text-red-500 hover:bg-red-500/10 font-bold font-mono text-xs tracking-wider rounded-lg uppercase cursor-pointer"
        >
          <X className="w-3.5 h-3.5 inline mr-1" /> RỜI PHÒNG TIẾN LÊN
        </button>
      </div>
    </div>
  );
}
