/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, onValue, update, push, set } from 'firebase/database';
import { db } from '../firebase';
import { Award, BookOpen, AlertCircle, HelpCircle, Send, CheckCircle2, Clock, Trash2, ShieldAlert } from 'lucide-react';
import { User, Quest, ClassRank, Report } from '../types';
import confetti from 'canvas-confetti';
import AITutorSection from './AITutorSection';
import BattlePass from './BattlePass';

interface AcademicPortalProps {
  uid: string;
  user: User | null;
  onShowResult: (title: string, message: string, isWin: boolean) => void;
}

export default function AcademicPortal({ uid, user, onShowResult }: AcademicPortalProps) {
  // Class leaderboards state
  const [classRankings, setClassRankings] = useState<ClassRank[]>([]);
  // Missions/Quests state
  const [quests, setQuests] = useState<Quest[]>([]);
  // Reports sent state
  const [myReports, setMyReports] = useState<Report[]>([]);

  // Local Form state for complaints
  const [targetUid, setTargetUid] = useState('');
  const [complaintReason, setComplaintReason] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);

  // Active Quiz Modal state
  const [activeQuiz, setActiveQuiz] = useState<Quest | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Radar chart canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load class rankings
  useEffect(() => {
    const classesRef = ref(db, 'classes');
    const unsubscribe = onValue(classesRef, (snap) => {
      const data = snap.val() || {};
      const list: ClassRank[] = Object.keys(data).map((k) => ({
        id: k,
        ...data[k],
      }));
      // Sort desc by CP
      list.sort((a, b) => b.cp - a.cp);
      setClassRankings(list);
    });
    return () => unsubscribe();
  }, []);

  // Load quests / quizzes
  useEffect(() => {
    const questsRef = ref(db, 'quests');
    const unsubscribe = onValue(questsRef, (snap) => {
      const data = snap.val() || {};
      const list: Quest[] = Object.keys(data).map((k) => ({
        id: k,
        ...data[k],
      }));
      setQuests(list);
    });
    return () => unsubscribe();
  }, []);

  // Load my complaints / reports
  useEffect(() => {
    const reportsRef = ref(db, 'reports');
    const unsubscribe = onValue(reportsRef, (snap) => {
      const data = snap.val() || {};
      const list: Report[] = Object.keys(data)
        .map((k) => ({
          id: k,
          ...data[k],
        }))
        .filter((r) => r.senderId === uid);
      
      // Sort newest first
      list.sort((a, b) => b.timestamp - a.timestamp);
      setMyReports(list);
    });
    return () => unsubscribe();
  }, [uid]);

  // Handle stats radar drawing locally on canvas (ultra lightweight, no rendering lag!)
  useEffect(() => {
    if (!canvasRef.current || !user || !user.stats) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) / 2 - 25;

    // 5 labels representing different school abilities
    const labels = ['Cần Cù', 'Trí Tuệ', 'Tương Tác', 'Phúc Đức', 'Nhân Phẩm'];
    const statValues = user.stats.length === 5 ? user.stats : [50, 50, 50, 50, 50];

    // Draw background concentric pentagons
    const pentagonsCount = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    for (let p = 1; p <= pentagonsCount; p++) {
      const scale = p / pentagonsCount;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = center.x + radius * scale * Math.cos(angle);
        const y = center.y + radius * scale * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw axis lines from center to vertices
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
    }
    ctx.stroke();

    // Draw stats area
    ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const statValue = Math.min(100, Math.max(0, statValues[i]));
      const valScale = statValue / 100;
      const x = center.x + radius * valScale * Math.cos(angle);
      const y = center.y + radius * valScale * Math.sin(angle);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw labels & values
    ctx.fillStyle = '#8b949e';
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = center.x + (radius + 15) * Math.cos(angle);
      const y = center.y + (radius + 12) * Math.sin(angle);
      ctx.fillText(`${labels[i]} (${statValues[i]})`, x, y + 2);
    }
  }, [user]);

  // Quiz timer implementation
  useEffect(() => {
    if (!activeQuiz) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (activeQuiz.timeLimit > 0) {
      setTimeLeft(activeQuiz.timeLimit);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleQuizTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeQuiz]);

  const handleQuizTimeout = async () => {
    if (!activeQuiz) return;
    const qId = activeQuiz.id;
    setActiveQuiz(null);

    try {
      const qSnap = await get(ref(db, `quests/${qId}`));
      if (!qSnap.exists()) return;
      const qData = qSnap.val() as Quest;
      const currentAttempts = qData.attempts?.[uid] || 0;

      // Update attempt count
      await update(ref(db, `quests/${qId}/attempts`), {
        [uid]: currentAttempts + 1
      });

      // Deduct penalty
      const userPP = user?.pp || 0;
      const newPP = Math.max(0, userPP - qData.penaltyPP);
      await update(ref(db, `users/${uid}`), { pp: newPP });

      // Write logs
      await push(ref(db, 'game_logs'), {
        uid,
        name: user?.name || 'Sinh Viên',
        game: `Quiz: ${qData.title}`,
        bet: 0,
        pnl: -qData.penaltyPP,
        result: 'HẾT GIỜ (Trượt)',
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      onShowResult('QUÁ GIỜ!', `Hết thời gian làm bài!\nBạn bị phạt trừ -${qData.penaltyPP.toLocaleString()} PP.`, false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenQuiz = (quiz: Quest) => {
    setActiveQuiz(quiz);
  };

  const handleSubmitAnswer = async (selected: 'A' | 'B') => {
    if (!activeQuiz) return;
    const qId = activeQuiz.id;
    const isCorrect = selected === activeQuiz.correctOpt;
    setActiveQuiz(null);

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const qSnap = await get(ref(db, `quests/${qId}`));
      if (!qSnap.exists()) return;
      const qData = qSnap.val() as Quest;
      const currentAttempts = qData.attempts?.[uid] || 0;

      // Increment attempt count
      await update(ref(db, `quests/${qId}/attempts`), {
        [uid]: currentAttempts + 1
      });

      const userPP = user?.pp || 0;
      if (isCorrect) {
        const newPP = userPP + qData.rewardPP;
        await update(ref(db, `users/${uid}`), { pp: newPP });

        // Log transaction success
        await push(ref(db, 'game_logs'), {
          uid,
          name: user?.name || 'Sinh Viên',
          game: `Quiz: ${qData.title}`,
          bet: 0,
          pnl: qData.rewardPP,
          result: 'ĐÚNG (Chính xác)',
          time: new Date().toLocaleString('vi-VN'),
          timestamp: Date.now()
        });

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        onShowResult('CHÍNH XÁC!', `Tuyệt vời! Bạn chọn đúng đáp án.\nNhận ngay +${qData.rewardPP.toLocaleString()} PP!`, true);
      } else {
        const newPP = Math.max(0, userPP - qData.penaltyPP);
        await update(ref(db, `users/${uid}`), { pp: newPP });

        await push(ref(db, 'game_logs'), {
          uid,
          name: user?.name || 'Sinh Viên',
          game: `Quiz: ${qData.title}`,
          bet: 0,
          pnl: -qData.penaltyPP,
          result: 'SAI (Nhầm lẫn)',
          time: new Date().toLocaleString('vi-VN'),
          timestamp: Date.now()
        });

        onShowResult('SAI MẤT RỒI!', `Rất tiếc, câu trả lời chưa đúng.\nBị trừ phạt -${qData.penaltyPP.toLocaleString()} PP!`, false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = complaintReason.trim();
    if (!reason) {
      alert('Vui lòng nhập nội dung góp ý hoặc tố cáo!');
      return;
    }

    setIsSendingReport(true);
    try {
      const logTime = new Date().toLocaleString('vi-VN');
      const timestamp = Date.now();

      await push(ref(db, 'reports'), {
        senderId: uid,
        senderName: user?.name || 'Sinh Viên',
        target: targetUid.trim() || 'Hệ thống S-System',
        reason: reason,
        time: logTime,
        timestamp: timestamp
      });

      alert('Đã gửi Đơn góp ý/tố cáo thành công cho Giáo Viên phê duyệt!');
      setTargetUid('');
      setComplaintReason('');
    } catch (err) {
      alert('Lỗi gửi đơn tố cáo!');
    } finally {
      setIsSendingReport(false);
    }
  };

  const formatDateString = (dStr: string) => {
    if (!dStr || dStr === 'Không có') return 'Vô thời hạn';
    const parts = dStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
  };

  return (
    <div id="tab-academic" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Primary Left Columns */}
      <div className="lg:col-span-2 space-y-6">
        {/* BATTLE PASS SECTION */}
        <BattlePass uid={uid} user={user} onShowResult={onShowResult} />

        {/* AI GIA SU ADVANCED GEMINI SECTION */}
        <AITutorSection uid={uid} user={user} />
        
        {/* CP Class Rankings */}
        <div className="glass-box section-card p-6 border-t-2 border-[#ff9900]/30 relative overflow-hidden">
          <div className="card-header flex items-center justify-between pb-3.5 mb-5 border-b border-[#30363d]">
            <h3 className="font-mono text-sm tracking-widest uppercase flex items-center gap-2 text-glow-gold text-[#ffd700]">
              <Award className="w-5 h-5" /> BXH LỚP CP HÙNG MẠNH
            </h3>
            <span className="text-[10px] font-mono text-white/50">Xếp hạng thực lực</span>
          </div>

          <div className="overflow-x-auto max-h-[190px] pr-1">
            <table className="cyber-table w-full">
              <thead>
                <tr className="border-b border-[#30363d] text-[10px] uppercase font-mono text-[#8b949e]">
                  <th className="py-2.5 text-left">Hạng</th>
                  <th className="py-2.5 text-left">Lớp Niên khóa</th>
                  <th className="py-2.5 text-right">Lớp Công Lực (CP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-mono">
                {classRankings.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-black">
                      {idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 font-semibold text-white">LỚP {c.name}</td>
                    <td className="py-3 text-right text-[#ffd700] text-glow-gold font-extrabold">
                      {c.cp.toLocaleString()} CP
                    </td>
                  </tr>
                ))}
                {classRankings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-5 text-center text-xs text-[#8b949e]">
                      Đang đồng bộ thứ tự thứ hạng...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Academic Grade Profiles */}
        <div className="glass-box section-card p-6">
          <div className="card-header flex items-center justify-between pb-3.5 mb-5 border-b border-[#30363d]">
            <h3 className="font-mono text-sm tracking-widest uppercase flex items-center gap-2 text-[#e6edf3]">
              <BookOpen className="w-5 h-5 text-glow-blue text-[#00f0ff]" /> HỒ SƠ ĐIỂM SỐ CHÍNH QUY
            </h3>
            <span className="text-[10px] font-mono text-white/50">Bộ GD&ĐT S-System</span>
          </div>

          <div className="overflow-y-auto max-h-[380px] pr-1">
            <table className="cyber-table w-full border-collapse">
              <thead>
                <tr className="border-b border-[#30363d] text-[10px] uppercase font-mono text-[#8b949e]">
                  <th className="py-2.5 text-left">Học phần môn</th>
                  <th className="py-2.5 text-center">BTH</th>
                  <th className="py-2.5 text-center">GK</th>
                  <th className="py-2.5 text-center">CK</th>
                  <th className="py-2.5 text-center">Tổng kết</th>
                  <th className="py-2.5 text-right">Học Lực</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs font-mono">
                {user?.academic ? (
                  Object.keys(user.academic).sort().map((termKey) => (
                    <React.Fragment key={termKey}>
                      {/* Term header row */}
                      <tr className="bg-white/5">
                        <td colSpan={6} className="py-2 px-3 font-bold text-glow-blue text-[#00f0ff] uppercase tracking-wider text-[10px]">
                          {termKey}
                        </td>
                      </tr>
                      {/* Subject rows */}
                      {Object.keys(user.academic[termKey]).map((subjKey) => {
                        const subj = user.academic![termKey][subjKey];
                        return (
                          <tr key={subjKey} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3 font-semibold text-white">{subj.name}</td>
                            <td className="py-3 text-center">{subj.bth}</td>
                            <td className="py-3 text-center">{subj.gk}</td>
                            <td className="py-3 text-center">{subj.ck}</td>
                            <td className="py-3 text-center font-bold text-emerald-400">{subj.final}</td>
                            <td className="py-3 text-right text-[#ffd700] text-glow-gold font-black text-sm">
                              {subj.grade}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#8b949e] italic">
                      Hồ sơ điểm số học tập của sinh viên hiện đang trống!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quizzes from Teacher */}
        <div className="glass-box section-card p-6 border-t-2 border-[#00f0ff]/30">
          <div className="card-header flex items-center justify-between pb-3.5 mb-5 border-b border-[#30363d]">
            <h3 className="font-mono text-sm tracking-widest uppercase flex items-center gap-2 text-glow-blue text-[#00f0ff]">
              <Clock className="w-5 h-5 animate-pulse" /> ĐỊA BÀN NHIỆM VỤ QUIZ PP
            </h3>
            <span className="text-[10px] font-mono text-[#00f0ff] text-glow-blue">Mở rộng Công lực</span>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
            {quests.filter((q) => q.status === 'OPEN').map((q) => {
              const maxAttempts = q.maxAttempts || 1;
              const attemptsUsed = q.attempts?.[uid] || 0;
              const isExpired = q.deadline && q.deadline !== 'Không có' && new Date() > new Date(q.deadline + 'T23:59:59');
              const canPlay = !isExpired && attemptsUsed < maxAttempts;

              return (
                <div 
                  key={q.id}
                  className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    canPlay 
                      ? 'bg-cyan-950/10 border-cyan-800/40 hover:border-cyan-500/50 shadow-[0_4px_20px_rgba(0,240,255,0.05)]' 
                      : 'bg-black/40 border-[#30363d] opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <h4 className={`font-bold font-sans text-sm flex items-center gap-2 ${canPlay ? 'text-white' : 'text-[#8b949e]'}`}>
                      <HelpCircle className={`w-4.5 h-4.5 ${canPlay ? 'text-[#00f0ff]' : 'text-[#8b949e]'}`} /> {q.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-[#8b949e]">
                      <span>Thưởng: <b className="text-[#ffd700] font-bold">+{q.rewardPP} PP</b></span>
                      <span>Phạt: <b className="text-[#ff003c] font-bold">-{q.penaltyPP} PP</b></span>
                      <span>Thời gian: <b className="text-white">{q.timeLimit > 0 ? `${q.timeLimit}s` : 'Không hạn'}</b></span>
                      <span>Lượt sút: <b className="text-white">{attemptsUsed}/{maxAttempts}</b></span>
                      <span>Hạn: <b className="text-white">{formatDateString(q.deadline)}</b></span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isExpired ? (
                      <span className="py-2 px-4 rounded-lg bg-red-950/20 border border-red-900/40 text-[10px] font-mono font-bold tracking-widest uppercase text-red-500 block text-center cursor-not-allowed">
                        [ HẾT HẠN ]
                      </span>
                    ) : attemptsUsed >= maxAttempts ? (
                      <span className="py-2 px-4 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-400 block text-center cursor-not-allowed">
                        [ HOÀN THÀNH ]
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenQuiz(q)}
                        className="w-full md:w-auto py-2 px-5 rounded-lg border border-[#00f0ff] text-[#00f0ff] hover:bg-[#00f0ff] hover:text-black hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] text-xs font-mono font-extrabold tracking-widest uppercase cursor-pointer transition-all active:scale-95"
                      >
                        [ PHỤC HOẠT ]
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {quests.filter((q) => q.status === 'OPEN').length === 0 && (
              <p className="text-center text-xs text-[#8b949e] font-mono py-8 italic">
                Hôm nay giáo viên không đăng bài Quiz nào mới!
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Right Sidebar Columns */}
      <div className="space-y-6">
        
        {/* Radar Ability Chart */}
        <div className="glass-box section-card p-6 flex flex-col items-center justify-center">
          <div className="card-header w-full pb-3 border-b border-[#30363d] mb-4 text-center">
            <h4 className="font-mono text-xs tracking-widest text-glow-blue text-[#00f0ff] uppercase">
              BIỂU ĐỒ NĂNG LỰC NGŨ HÀNH
            </h4>
          </div>
          <canvas 
            ref={canvasRef} 
            width={240} 
            height={240}
            className="w-full max-w-[240px] aspect-square object-contain"
          />
          <p className="text-[10px] font-mono text-[#8b949e] mt-3 text-center max-w-[200px]">
            Luyện tập và làm Quiz để gia tăng chỉ số Cần Cù & Nhân Phẩm.
          </p>
        </div>

        {/* Complaints / Opinion Submission form */}
        <div className="glass-box section-card p-6 border-t-2 border-[#ff003c]/30">
          <div className="card-header flex items-center justify-between pb-3.5 mb-5 border-b border-[#30363d]">
            <h3 className="font-mono text-sm tracking-widest uppercase flex items-center gap-2 text-glow-red text-[#ff003c]">
              <ShieldAlert className="w-5 h-5 animate-pulse" /> ĐƠN THƯ TỐ CÁO & GÓP Ý
            </h3>
          </div>

          <form onSubmit={handleSendReport} className="space-y-3 font-mono text-xs">
            <div>
              <label className="block text-[#8b949e] mb-1">MỤC TIÊU UID (NẾU TỐ CÁO):</label>
              <input
                type="text"
                placeholder="Ví dụ: 1a2, 2a3..."
                className="w-full bg-black/60 border border-[#30363d] focus:border-[#ff003c] rounded-lg p-3 outline-none text-white transition-all text-xs"
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[#8b949e] mb-1">NỘI DUNG TỐ CÁO HOẶC GÓP Ý:</label>
              <textarea
                placeholder="Nhập chi tiết nội dung sự việc hoặc ý kiến đề xuất lên Nhà trường..."
                rows={3}
                className="w-full bg-black/60 border border-[#30363d] focus:border-[#ff003c] rounded-lg p-3 outline-none text-white transition-all text-xs resize-none"
                value={complaintReason}
                onChange={(e) => setComplaintReason(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSendingReport}
              className="w-full py-3 bg-red-950/20 hover:bg-[#ff003c] border border-[#ff003c] text-[#ff003c] hover:text-white font-extrabold rounded-lg uppercase transition-all tracking-wider cursor-pointer hover:shadow-[0_0_15px_rgba(255,0,60,0.4)] flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" /> [ GỬI LÊN HỆ THỐNG ]
            </button>
          </form>

          {/* User's sent reports inbox list */}
          <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
            <h4 className="text-[10px] font-bold text-glow-gold text-[#ffd700] uppercase tracking-wider">
              📥 ĐƠN THƯ ĐÃ GỬI ({myReports.length})
            </h4>
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {myReports.map((r) => (
                <div key={r.id} className="p-2.5 bg-white/5 rounded-lg border border-white/5 text-[10px] space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#8b949e]">
                    <span>Target: <b className="text-white">{r.target}</b></span>
                    <span>{r.time.split(' ')[0]}</span>
                  </div>
                  <p className="text-white/80 leading-relaxed font-sans line-clamp-3">{r.reason}</p>
                </div>
              ))}
              {myReports.length === 0 && (
                <p className="text-[10px] text-[#8b949e] italic text-center py-4">
                  Chưa gửi đơn thư nào lên văn phòng.
                </p>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* QUIZ INTERACTIVE MODAL */}
      {activeQuiz && (
        <div className="overlay z-[7000]">
          <div className="glass-box login-panel max-w-[500px] border-[#00f0ff]">
            <h2 className="text-[#00f0ff] text-glow-blue text-xl font-bold font-mono uppercase tracking-widest mb-1.5 flex items-center justify-center gap-2">
              <Clock className="w-5 h-5 animate-pulse" /> {activeQuiz.title}
            </h2>
            
            {activeQuiz.timeLimit > 0 && (
              <div className="text-[#ff003c] text-glow-red font-mono font-black text-2xl mb-4 animate-pulse">
                🕒 {timeLeft}S
              </div>
            )}

            <p className="text-white text-base font-sans font-medium text-center leading-relaxed py-4 px-2 bg-black/40 border border-[#30363d] rounded-xl mb-6">
              {activeQuiz.question}
            </p>

            <div className="grid grid-cols-1 gap-3.5 font-mono">
              <button
                onClick={() => handleSubmitAnswer('A')}
                className="w-full p-4 bg-black/50 border border-[#ffd700] hover:border-[#00ff80] rounded-xl text-left hover:bg-[#ffd700]/5 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer group flex items-start gap-2 text-sm"
              >
                <strong className="text-[#ffd700] text-glow-gold font-black shrink-0">A.</strong>
                <span className="text-white group-hover:text-glow-green">{activeQuiz.optA}</span>
              </button>

              <button
                onClick={() => handleSubmitAnswer('B')}
                className="w-full p-4 bg-black/50 border border-[#ffd700] hover:border-[#00ff80] rounded-xl text-left hover:bg-[#ffd700]/5 hover:shadow-[0_0_15px_rgba(255,215,0,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer group flex items-start gap-2 text-sm"
              >
                <strong className="text-[#ffd700] text-glow-gold font-black shrink-0">B.</strong>
                <span className="text-white group-hover:text-glow-green">{activeQuiz.optB}</span>
              </button>
            </div>

            <button
              onClick={() => setActiveQuiz(null)}
              className="mt-6 text-[#8b949e] hover:text-[#ff003c] text-xs font-mono tracking-widest uppercase cursor-pointer transition"
            >
              [ 🚪 ĐÓNG CỬA SỔ ]
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
