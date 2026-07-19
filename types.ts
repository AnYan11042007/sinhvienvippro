/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SubjectGrade {
  name: string;
  bth: number | string; // Bai tap hang ngay
  gk: number | string;  // Giua ky
  ck: number | string;  // Cuoi ky
  final: number | string;
  grade: string;
}

export interface AcademicTerm {
  [subjectKey: string]: SubjectGrade;
}

export interface AcademicRecord {
  [termKey: string]: AcademicTerm;
}

export interface GoldAsset {
  amount: number;
  avgPrice: number;
}

export interface GoldStats {
  totalProfit: number;
}

export interface User {
  id?: string;
  avatar: string;
  class: string;
  classKey: string;
  gold?: GoldAsset;
  gold_stats?: GoldStats;
  locked: boolean;
  name: string;
  pass: string;
  pp: number;
  role: 'STUDENT' | 'TEACHER';
  sem: number;
  stats: number[];
  year: number;
  academic?: AcademicRecord;
  sessionToken?: string; // New Secure Login Session Token
  xp?: number;
  level?: number;
  isPremiumBattlePass?: boolean;
  battlePassRewardsClaimed?: { [tierId: string]: boolean };
}

export interface ClassRank {
  id?: string;
  cp: number;
  name: string;
  year: number;
}

export interface GameLog {
  id?: string;
  uid: string;
  name: string;
  game: string;
  bet: number;
  pnl: number;
  result: string;
  time: string;
  timestamp: number;
}

export interface GoldMarket {
  price: number;
  oldPrice: number;
  high24h: number;
  low24h: number;
  volumeBuy: number;
  volumeSell: number;
  history: number[];
  lastUpdate: number;
  statusText: string;
  statusColor: string;
  updateTimeString: string;
}

export interface GoldChatMessage {
  id?: string;
  uid: string;
  name: string;
  msg: string;
  time: string;
  timestamp: number;
}

export interface Report {
  id?: string;
  senderId: string;
  senderName: string;
  target: string;
  reason: string;
  time: string;
  timestamp: number;
}

export interface Quest {
  id?: string;
  title: string;
  question: string;
  optA: string;
  optB: string;
  correctOpt: 'A' | 'B';
  rewardPP: number;
  penaltyPP: number;
  maxAttempts: number;
  timeLimit: number; // in seconds, 0 is no limit
  deadline: string;
  status: 'OPEN' | 'CLOSED';
  attempts?: {
    [uid: string]: number;
  };
}

export interface Transaction {
  id?: string;
  sender: string;
  senderName: string;
  receiver: string;
  receiverName: string;
  amount: number;
  message: string;
  time: string;
  timestamp: number;
}

export interface OnlineUser {
  name: string;
  time: number;
}

// multiplayer game types
export interface TienLenPlayer {
  name: string;
  avatar: string;
  isCreator?: boolean;
  hand?: number[];
  status?: string;
}

export interface TienLenRoom {
  id?: string;
  creator: string;
  creatorName: string;
  bet: number;
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  players: {
    [uid: string]: TienLenPlayer;
  };
  playerOrder: string[];
  pot: number;
  hands?: {
    [uid: string]: number[]; // list of card numbers (0 - 51)
  };
  turn?: string;
  turnStartTime?: number;
  currentPile?: number[];
  passList?: string[];
  lastPlayedBy?: string;
  winner?: string;
}

export interface BlackjackPlayer {
  name: string;
  avatar: string;
  hand?: number[];
  status: 'WAITING' | 'PLAYING' | 'STOOD' | 'BUSTED' | 'BLACKJACK' | 'SPECTATOR';
}

export interface BlackjackRoom {
  id?: string;
  creator: string;
  creatorName: string;
  bet: number;
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  players: {
    [uid: string]: BlackjackPlayer;
  };
  activePlayers?: string[];
  turnIdx?: number;
  deck?: number[];
  dealer?: {
    hand: number[];
    isHidden: boolean;
  } | null;
  finalMsg?: string;
}

export interface RpsRoom {
  id?: string;
  p1: string;
  p1Name: string;
  p1Avatar: string;
  bet: number;
  status: 'WAITING' | 'PLAYING' | 'ENDED';
  p2?: string;
  p2Name?: string;
  p2Avatar?: string;
  p1Choice?: 'KEO' | 'BUA' | 'BAO' | '';
  p2Choice?: 'KEO' | 'BUA' | 'BAO' | '';
  p1Rematch?: boolean;
  p2Rematch?: boolean;
  finalMsg?: string;
}
