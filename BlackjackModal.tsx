/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, onValue, update, remove, push } from 'firebase/database';
import { db } from '../../firebase';
import { X, Trophy, AlertTriangle, Layers } from 'lucide-react';
import { User, BlackjackRoom, BlackjackPlayer } from '../../types';

interface BlackjackModalProps {
  uid: string;
  user: User | null;
  roomId: string;
  onClose: () => void;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

const SUITS = ['♠', '♣', '♦', '♥'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

export default function BlackjackModal({ uid, user, roomId, onClose, onShowResult }: BlackjackModalProps) {
  const [room, setRoom] = useState<BlackjackRoom | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const isDealerAIDealing = useRef(false);

  useEffect(() => {
    const roomRef = ref(db, `blackjack_rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snap) => {
      if (snap.exists()) {
        const rData = snap.val() as BlackjackRoom;
        setRoom(rData);
        setIsProcessingAction(false);

        // Run Dealer AI automatically if current turn index goes beyond active players list length
        if (
          rData.status === 'PLAYING' &&
          rData.creator === uid &&
          rData.activePlayers &&
          rData.turnIdx !== undefined &&
          rData.turnIdx >= rData.activePlayers.length
        ) {
          if (!isDealerAIDealing.current) {
            isDealerAIDealing.current = true;
            runDealerAI(rData);
          }
        }
      } else {
        setRoom(null);
        onClose();
      }
    });

    return () => unsubscribe();
  }, [roomId, onClose, uid]);

  const getBjInfo = (cards: number[] | undefined) => {
    if (!cards || cards.length === 0) return { score: 0, type: 'NORMAL' };
    
    // Check Xì Bàng (Two Aces)
    if (cards.length === 2 && cards.every(v => Math.floor(v / 4) === 11)) {
      return { score: 22, type: 'XIBANG' };
    }

    let score = 0;
    let aces = 0;

    cards.forEach((val) => {
      const r = Math.floor(val / 4);
      if (r <= 7) {
        score += (r + 3); // 3, 4, 5, 6, 7, 8, 9, 10
      } else if (r >= 8 && r <= 10) {
        score += 10; // J, Q, K are 10
      } else if (r === 12) {
        score += 2; // 2 is 2
      } else if (r === 11) {
        aces++; // Ace
      }
    });

    // Flexible Ace values based on total count
    if (cards.length >= 3) {
      score += aces; // Aces count as 1 when drawing 3 cards or more
    } else {
      // 2 cards Ace counting: tries to optimize closest to 21
      for (let i = 0; i < aces; i++) {
        if (score + 11 <= 21) score += 11;
        else if (score + 10 <= 21 && aces === 1) score += 10;
        else score += 1;
      }
    }

    // Check Xì Dách (Ace + 10-pointer on 2 cards)
    if (cards.length === 2 && score === 21 && aces > 0) {
      return { score: 21, type: 'XIDACH' };
    }

    if (score > 21) {
      return { score, type: 'QUAC' };
    }

    // Check Ngũ Linh (5 cards under 22)
    if (cards.length === 5 && score <= 21) {
      return { score, type: 'NGULINH' };
    }

    return { score, type: 'NORMAL' };
  };

  const compareBj = (pScore: number, pType: string, dScore: number, dType: string) => {
    if (pType === 'QUAC') return -1;
    if (dType === 'QUAC') return 1;

    const rankMap: Record<string, number> = {
      'XIBANG': 5,
      'XIDACH': 4,
      'NGULINH': 3,
      'NORMAL': 1
    };

    const pRank = rankMap[pType] || 1;
    const dRank = rankMap[dType] || 1;

    if (pRank > dRank) return 1;
    if (pRank < dRank) return -1;

    if (pScore > dScore) return 1;
    if (pScore < dScore) return -1;

    return 0; // Draw
  };

  const getCardRankAndSuit = (val: number) => {
    const r = RANKS[Math.floor(val / 4)];
    const s = SUITS[val % 4];
    const isRed = val % 4 === 2 || val % 4 === 3;
    return { r, s, isRed };
  };

  const handleStartGame = async () => {
    if (!room || room.status !== 'WAITING') return;

    try {
      const playersList = Object.keys(room.players);
      const updatePayload: any = {};
      const activeUids: string[] = [];

      for (const pU of playersList) {
        const uSnap = await get(ref(db, `users/${pU}`));
        const balance = uSnap.val()?.pp || 0;

        if (balance >= room.bet) {
          activeUids.push(pU);
          // Deduct bets at launch
          updatePayload[`/users/${pU}/pp`] = balance - room.bet;
        } else {
          // Kick broke players from room
          updatePayload[`/blackjack_rooms/${roomId}/players/${pU}`] = null;
        }
      }

      if (activeUids.length === 0) {
        await remove(ref(db, `blackjack_rooms/${roomId}`));
        alert('Không có ai đủ tiền cược, giải tán bàn!');
        return;
      }

      // Generate card deck (0 - 51)
      const deck: number[] = Array.from({ length: 52 }, (_, i) => i);
      // Shuffle deck
      for (let i = 51; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      // Deal 2 cards to Dealer (Bot)
      const dealerHand = [deck.pop()!, deck.pop()!];
      updatePayload[`/blackjack_rooms/${roomId}/dealer`] = {
        hand: dealerHand,
        isHidden: true
      };

      updatePayload[`/blackjack_rooms/${roomId}/activePlayers`] = activeUids;

      // Deal 2 cards to each player
      activeUids.forEach((pU) => {
        const hand = [deck.pop()!, deck.pop()!];
        const info = getBjInfo(hand);
        
        updatePayload[`/blackjack_rooms/${roomId}/players/${pU}/hand`] = hand;
        // If they get natural blackjack/Xì dách, set them to locked/blackjack state immediately
        updatePayload[`/blackjack_rooms/${roomId}/players/${pU}/status`] = 
          (info.type === 'XIBANG' || info.type === 'XIDACH') ? 'BLACKJACK' : 'PLAYING';
      });

      // Find first player whose turn it is
      let firstTurnIdx = 0;
      while (
        firstTurnIdx < activeUids.length && 
        updatePayload[`/blackjack_rooms/${roomId}/players/${activeUids[firstTurnIdx]}/status`] === 'BLACKJACK'
      ) {
        firstTurnIdx++;
      }

      updatePayload[`/blackjack_rooms/${roomId}/status`] = 'PLAYING';
      updatePayload[`/blackjack_rooms/${roomId}/deck`] = deck;
      updatePayload[`/blackjack_rooms/${roomId}/turnIdx`] = firstTurnIdx;

      isDealerAIDealing.current = false;
      await update(ref(db, '/'), updatePayload);
    } catch (err) {
      alert('Lỗi khi chia bài Blackjack!');
    }
  };

  const handleHit = async () => {
    if (isProcessingAction || !room || !room.activePlayers || room.turnIdx === undefined) return;
    setIsProcessingAction(true);

    const activeUids = room.activePlayers;
    const currentTurnUid = activeUids[room.turnIdx];

    if (currentTurnUid !== uid) return;

    try {
      const pData = room.players[uid];
      const hand = pData.hand ? [...pData.hand] : [];
      const deck = room.deck ? [...room.deck] : [];

      if (deck.length === 0) return;

      // Draw 1 card
      hand.push(deck.pop()!);
      const info = getBjInfo(hand);
      
      let nextStatus = 'PLAYING';
      let nextTurnIdx = room.turnIdx;

      if (info.type === 'QUAC') {
        nextStatus = 'BUSTED';
        nextTurnIdx++;
      } else if (info.type === 'NGULINH' || hand.length >= 5 || info.score === 21) {
        nextStatus = 'STOOD';
        nextTurnIdx++;
      }

      // Skip players with natural Blackjack
      while (nextTurnIdx < activeUids.length && room.players[activeUids[nextTurnIdx]].status === 'BLACKJACK') {
        nextTurnIdx++;
      }

      await update(ref(db, `blackjack_rooms/${roomId}`), {
        [`players/${uid}/hand`]: hand,
        [`players/${uid}/status`]: nextStatus,
        deck: deck,
        turnIdx: nextTurnIdx
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleStand = async () => {
    if (isProcessingAction || !room || !room.activePlayers || room.turnIdx === undefined) return;
    setIsProcessingAction(true);

    const activeUids = room.activePlayers;
    const currentTurnUid = activeUids[room.turnIdx];

    if (currentTurnUid !== uid) return;

    try {
      let nextTurnIdx = room.turnIdx + 1;
      
      // Skip players with natural Blackjack
      while (nextTurnIdx < activeUids.length && room.players[activeUids[nextTurnIdx]].status === 'BLACKJACK') {
        nextTurnIdx++;
      }

      await update(ref(db, `blackjack_rooms/${roomId}`), {
        [`players/${uid}/status`]: 'STOOD',
        turnIdx: nextTurnIdx
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const runDealerAI = async (currentRoom: BlackjackRoom) => {
    let deck = currentRoom.deck ? [...currentRoom.deck] : [];
    let dealerHand = currentRoom.dealer?.hand ? [...currentRoom.dealer.hand] : [];

    // Open dealer card
    await update(ref(db, `blackjack_rooms/${roomId}/dealer`), {
      hand: dealerHand,
      isHidden: false
    });

    let dInfo = getBjInfo(dealerHand);

    // AI logic: draw until score is 17 or higher
    while (
      dInfo.score < 17 && 
      dealerHand.length < 5 && 
      dInfo.type !== 'QUAC' && 
      dInfo.type !== 'XIBANG' && 
      dInfo.type !== 'XIDACH'
    ) {
      // 1.2s delay per draw for visual action suspense
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (deck.length === 0) break;
      dealerHand.push(deck.pop()!);
      dInfo = getBjInfo(dealerHand);

      await update(ref(db, `blackjack_rooms/${roomId}`), {
        'dealer/hand': dealerHand,
        deck: deck
      });
    }

    // Wait 1.5s then distribute payouts
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const finalDInfo = getBjInfo(dealerHand);
    let finalSummary = `NHÀ CÁI KẾT THÚC: ${
      finalDInfo.type === 'QUAC' 
        ? 'BỊ QUẮC BÙ !' 
        : finalDInfo.type === 'XIBANG' 
        ? 'XÌ BÀNG' 
        : finalDInfo.type === 'XIDACH' 
        ? 'XÌ DÁCH' 
        : finalDInfo.type === 'NGULINH' 
        ? 'NGŨ LINH' 
        : `${finalDInfo.score} ĐIỂM`
    }<br><br>`;

    const updatePayload: any = {};
    const activeUids = currentRoom.activePlayers || [];

    for (const pU of activeUids) {
      const pD = currentRoom.players[pU];
      const pInfo = getBjInfo(pD.hand);
      const res = compareBj(pInfo.score, pInfo.type, finalDInfo.score, finalDInfo.type);

      const uSnap = await get(ref(db, `users/${pU}`));
      const balance = uSnap.val()?.pp || 0;
      const bet = currentRoom.bet;

      if (pInfo.type === 'QUAC') {
        // Player quắc is instant loss (already deducted on start)
        finalSummary += `<span class="text-red-400 font-bold">${pD.name}: QUẮC BÙ (-${bet.toLocaleString()})</span><br>`;
        await push(ref(db, 'game_logs'), {
          uid: pU, name: pD.name, game: 'Blackjack', bet: bet, pnl: -bet, result: 'Quắc', time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
        });
      } else if (pInfo.type === 'XIBANG' || pInfo.type === 'XIDACH') {
        // Natural Blackjacks pay x2.5
        updatePayload[`/users/${pU}/pp`] = balance + Math.floor(bet * 2.5);
        finalSummary += `<span class="text-[#00ff80] font-black">${pD.name}: TỚI TRẮNG (+${Math.floor(bet * 1.5).toLocaleString()})</span><br>`;
        await push(ref(db, 'game_logs'), {
          uid: pU, name: pD.name, game: 'Blackjack', bet: bet, pnl: Math.floor(bet * 1.5), result: 'Blackjack', time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
        });
      } else {
        if (res === 1) {
          // Player wins -> payout multiplier (x2.2 for Ngũ Linh, x2 otherwise)
          const mult = pInfo.type === 'NGULINH' ? 2.2 : 2.0;
          const payoutVal = Math.floor(bet * mult);
          updatePayload[`/users/${pU}/pp`] = balance + payoutVal;

          finalSummary += `<span class="text-emerald-400 font-bold">${pD.name}: THẮNG (+${Math.floor(bet * (mult - 1)).toLocaleString()})</span><br>`;
          await push(ref(db, 'game_logs'), {
            uid: pU, name: pD.name, game: 'Blackjack', bet: bet, pnl: Math.floor(bet * (mult - 1)), result: 'Thắng', time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
          });
        } else if (res === 0) {
          // Draw -> refund cược
          updatePayload[`/users/${pU}/pp`] = balance + bet;
          finalSummary += `<span class="text-yellow-400 font-bold">${pD.name}: HÒA (Hoàn cược)</span><br>`;
          await push(ref(db, 'game_logs'), {
            uid: pU, name: pD.name, game: 'Blackjack', bet: bet, pnl: 0, result: 'Hòa', time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
          });
        } else {
          // Lose
          finalSummary += `<span class="text-red-400 font-bold">${pD.name}: THUA CÁI (-${bet.toLocaleString()})</span><br>`;
          await push(ref(db, 'game_logs'), {
            uid: pU, name: pD.name, game: 'Blackjack', bet: bet, pnl: -bet, result: 'Thua', time: new Date().toLocaleString('vi-VN'), timestamp: Date.now()
          });
        }
      }
    }

    updatePayload[`/blackjack_rooms/${roomId}/status`] = 'ENDED';
    updatePayload[`/blackjack_rooms/${roomId}/finalMsg`] = finalSummary;

    await update(ref(db, '/'), updatePayload);

    // Auto trigger next round cleanup after 10s
    setTimeout(async () => {
      isDealerAIDealing.current = false;
      const cleanSnap = await get(ref(db, `blackjack_rooms/${roomId}`));
      if (!cleanSnap.exists()) return;
      const cR = cleanSnap.val() as BlackjackRoom;

      const resetPayload: any = {
        status: 'WAITING',
        finalMsg: '',
        dealer: null,
        deck: null,
        turnIdx: 0,
        activePlayers: []
      };

      for (const pUid in cR.players) {
        resetPayload[`players/${pUid}/status`] = 'WAITING';
        resetPayload[`players/${pUid}/hand`] = [];
      }

      await update(ref(db, `blackjack_rooms/${roomId}`), resetPayload);
    }, 10000);
  };

  const handleLeaveRoom = async () => {
    if (!room) {
      onClose();
      return;
    }

    if (room.status === 'PLAYING' && room.activePlayers && room.activePlayers.includes(uid)) {
      alert('Đang trong ván đấu kịch tính không thể rời sòng!');
      return;
    }

    try {
      if (room.creator === uid || !room.players || Object.keys(room.players).length <= 1) {
        await remove(ref(db, `blackjack_rooms/${roomId}`));
      } else {
        await remove(ref(db, `blackjack_rooms/${roomId}/players/${uid}`));
        if (room.activePlayers) {
          const nextActive = room.activePlayers.filter((x) => x !== uid);
          await update(ref(db, `blackjack_rooms/${roomId}`), {
            activePlayers: nextActive
          });
        }
      }
      onClose();
      alert('Đã thoát khỏi sòng Xì dách!');
    } catch (err) {
      console.error(err);
    }
  };

  if (!room) return null;

  const isMyTurn = room.status === 'PLAYING' && room.activePlayers && room.activePlayers[room.turnIdx || 0] === uid;

  return (
    <div className="overlay z-[4500]">
      <div className="glass-box login-panel max-w-[1100px] p-6 border-[#ff8c00] relative">
        <button 
          onClick={handleLeaveRoom}
          className="absolute top-4 right-4 text-[#8b949e] hover:text-white cursor-pointer transition z-50"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-[#ff8c00] text-glow-gold text-2xl font-black font-mono uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5">
          <Layers className="w-5 h-5 text-[#ff8c00]" /> SÒNG XÌ DÁCH VEGAS LIVE
        </h2>
        <p className="text-[10px] font-mono text-[#8b949e] uppercase mb-4">
          Xì dách hoàng gia - Đấu tay đôi cùng BOT Nhà Cái
        </p>

        {/* Blackjack table board */}
        <div className="relative w-full h-[620px] bg-gradient-to-b from-[#0d47a1] to-[#001030] border-8 border-[#1a237e] rounded-[80px] shadow-[inset_0_0_60px_rgba(0,0,0,0.9)] select-none mb-4">
          
          {/* Dealer area */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center min-h-[140px] w-[350px]">
            <h3 className="text-white font-bold text-xs uppercase mb-2 flex items-center justify-center gap-2">
              NHÀ CÁI (BOT) 
              <span className="badge text-[10px] bg-white/10 border border-white text-white py-0.5 px-2 rounded">
                {room.dealer && !room.dealer.isHidden ? getBjInfo(room.dealer.hand).score + ' đ' : '?'}
              </span>
            </h3>

            <div className="flex justify-center gap-2.5 h-[110px]">
              {room.dealer?.hand ? (
                room.dealer.hand.map((v, i) => {
                  const hide = room.dealer?.isHidden && i === 1;
                  if (hide) {
                    return <div key={i} className="tl-card-back w-[70px] h-[100px] rounded-lg shadow-lg shrink-0" />;
                  }
                  const { r, s, isRed } = getCardRankAndSuit(v);
                  return (
                    <div 
                      key={i} 
                      className={`tl-card shrink-0 w-[70px] h-[100px] border rounded-lg flex flex-col justify-between p-1 bg-white font-mono shadow-md ${
                        isRed ? 'text-red-600' : 'text-black'
                      }`}
                    >
                      <div className="text-xl font-black text-left pl-1">{r}</div>
                      <div className="text-3xl text-center leading-none">{s}</div>
                    </div>
                  );
                })
              ) : (
                <div className="text-white/20 italic text-xs flex items-center justify-center border border-dashed border-white/10 rounded-lg w-[140px] h-[100px]">
                  Chờ chia bài...
                </div>
              )}
            </div>
          </div>

          {/* Central messages or announcements */}
          {room.status === 'ENDED' ? (
            <div 
              className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-center text-xs text-white max-w-[80%] leading-relaxed max-h-[140px] overflow-y-auto bg-black/60 p-4 border border-yellow-500/20 rounded-xl"
              dangerouslySetInnerHTML={{ __html: room.finalMsg || '' }}
            />
          ) : room.status === 'PLAYING' && room.activePlayers && room.turnIdx !== undefined && room.turnIdx >= room.activePlayers.length ? (
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-center text-lg text-glow-gold text-[#ffd700] font-black animate-pulse">
              NHÀ CÁI ĐANG RÚT BÀI...
            </div>
          ) : (
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-center text-xs text-white/30 tracking-widest uppercase">
              NHÀ CÁI BAO SÂN - S-SYSTEM 88
            </div>
          )}

          {/* Player areas */}
          <div className="absolute bottom-6 w-full flex justify-around items-end px-6 min-h-[220px]">
            {room.players && Object.keys(room.players).map((pUid) => {
              const pData = room.players[pUid];
              const isActive = room.status === 'PLAYING' && room.activePlayers && room.activePlayers.includes(pUid);
              const isTurn = isActive && room.activePlayers![room.turnIdx || 0] === pUid;
              const hasNatural = pData.status === 'BLACKJACK';

              const inf = getBjInfo(pData.hand);
              let statusLabel = '';
              if (pData.status === 'SPECTATOR') statusLabel = 'Khán giả';
              else if (hasNatural) statusLabel = 'XÌ DÁCH';
              else if (pData.status === 'BUSTED') statusLabel = 'QUẮC BÙ';
              else if (pData.status === 'STOOD') statusLabel = 'DẰN BÀI';
              else statusLabel = pData.hand && pData.hand.length > 0 ? `${inf.score} đ` : 'Chờ chia';

              return (
                <div key={pUid} className="flex flex-col items-center">
                  {/* Player Hand cards display */}
                  <div className="flex justify-center gap-1.5 min-h-[90px] mb-3">
                    {pData.hand?.map((v, i) => {
                      const { r, s, isRed } = getCardRankAndSuit(v);
                      return (
                        <div 
                          key={i} 
                          className={`tl-card w-[55px] h-[80px] border rounded-md flex flex-col justify-between p-1 bg-white font-mono shadow-sm shrink-0 ${
                            isRed ? 'text-red-600' : 'text-black'
                          }`}
                        >
                          <div className="text-sm font-black text-left pl-0.5 leading-none">{r}</div>
                          <div className="text-xl text-center leading-none">{s}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Player details */}
                  <div className={`p-3 bg-black/80 rounded-xl border border-white/5 flex flex-col items-center w-[120px] transition-all relative ${
                    isTurn ? 'border-yellow-400 shadow-[0_0_15px_rgba(255,215,0,0.3)] animate-pulse scale-105' : ''
                  }`}>
                    <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden mb-1.5 shadow">
                      {pData.avatar ? <img src={pData.avatar} alt="" className="w-full h-full object-cover" /> : '🤔'}
                    </div>
                    <b className="text-white text-[11px] truncate max-w-[100px]" title={pData.name}>{pData.name}</b>
                    <span className="text-[10px] text-[#ffd700] font-black mt-0.5">{room.bet.toLocaleString()} PP</span>
                    
                    {/* Status badge */}
                    <span className="mt-1.5 py-0.5 px-2 border border-white/10 text-[9px] font-black uppercase text-[#8b949e] rounded bg-white/5">
                      {statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Controllers */}
          {isMyTurn && room.status === 'PLAYING' && (
            <div className="absolute bottom-[230px] left-1/2 -translate-x-1/2 flex gap-4 z-30 font-mono text-sm">
              <button
                onClick={handleHit}
                disabled={isProcessingAction}
                className="py-3 px-8 bg-emerald-950/20 border-2 border-dashed border-[#00ff80] text-[#00ff80] text-glow-green hover:bg-[#00ff80]/15 font-black uppercase rounded-xl tracking-wider cursor-pointer"
              >
                [ 👆 RÚT BÀI ]
              </button>
              <button
                onClick={handleStand}
                disabled={isProcessingAction}
                className="py-3 px-8 bg-red-950/20 border border-[#ff003c] text-[#ff003c] text-glow-red hover:bg-[#ff003c]/15 font-black uppercase rounded-xl tracking-wider cursor-pointer"
              >
                [ ✋ DẰN BÀI ]
              </button>
            </div>
          )}

          {/* Room starter button */}
          {room.status === 'WAITING' && room.creator === uid && (
            <button
              onClick={handleStartGame}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 py-3.5 px-8 bg-yellow-950/20 border border-[#ff8c00] text-[#ff8c00] hover:bg-[#ff8c00] hover:text-black text-base font-black rounded-xl uppercase tracking-widest transition-all cursor-pointer text-glow-gold"
            >
              [ BẮT ĐẦU VÁN BÀI ]
            </button>
          )}

        </div>

        <button
          onClick={handleLeaveRoom}
          className="w-full py-2.5 border border-dashed border-[#ff003c]/50 text-red-500 hover:bg-red-500/10 font-bold font-mono text-xs tracking-wider rounded-lg uppercase cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 inline mr-1" /> RỜI SÒNG ĐẤU BÀI
        </button>
      </div>
    </div>
  );
}
