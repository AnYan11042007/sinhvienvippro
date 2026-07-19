/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { Sparkles, Send, BookOpen, GraduationCap, RefreshCw } from 'lucide-react';

interface AITutorSectionProps {
  uid: string;
  user: User | null;
}

const SUBJECTS = [
  { key: 'math', name: '🧮 Toán Cao Cấp / Đại Số' },
  { key: 'physics', name: '⚛️ Vật Lý Đại Cương' },
  { key: 'it', name: '💻 Lập Trình Web & React' },
  { key: 'marx', name: '📕 Triết Học Mác-Lênin' }
];

export default function AITutorSection({ uid, user }: AITutorSectionProps) {
  const [selectedSubject, setSelectedSubject] = useState('it');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setAnswer('');
    try {
      const response = await fetch('/api/gemini/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          subject: SUBJECTS.find(s => s.key === selectedSubject)?.name,
          studentStats: user?.stats || [50, 50, 50, 50, 50]
        })
      });

      const data = await response.json();
      setAnswer(data.text || 'Gia sư đang bận suy nghĩ, vui lòng hỏi lại sau!');
    } catch (err) {
      setAnswer('Gặp lỗi khi kết nối với máy chủ AI Gia Sư. Hãy thử lại!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-box p-6 border-cyan-500/30 bg-cyan-950/5 relative overflow-hidden font-mono text-xs">
      {/* Decorative Glow elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-[#30363d]">
        <h3 className="text-sm tracking-widest uppercase flex items-center gap-2 text-glow-blue text-[#00f0ff] font-black">
          <GraduationCap className="w-5 h-5 animate-bounce" /> 🤖 TRỢ LÝ AI GIA SƯ S88
        </h3>
        <span className="text-[10px] text-[#00f0ff] font-bold uppercase tracking-wider bg-cyan-950 border border-cyan-500/20 py-0.5 px-2 rounded-full">
          Gemini 3.5 Flash Powered
        </span>
      </div>

      <p className="text-slate-300 leading-relaxed mb-4">
        Chào học viên <strong className="text-white">{user?.name}</strong>! Học kỳ này bạn đang gặp khó khăn ở học phần nào? Chọn môn học và đặt câu hỏi để tôi giải đáp lý thuyết hay hướng dẫn bài tập tức thì!
      </p>

      {/* Subject selectors */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {SUBJECTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSelectedSubject(s.key)}
            className={`p-2.5 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
              selectedSubject === s.key
                ? 'bg-cyan-500/20 border-cyan-500 text-[#00f0ff] font-black shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'bg-black/20 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {s.name.split(' ')[1]} {s.name.split(' ').slice(2).join(' ')}
          </button>
        ))}
      </div>

      <form onSubmit={handleAskTutor} className="space-y-3.5">
        <div className="relative">
          <input
            type="text"
            placeholder="Ví dụ: Giải thích giải thuật đệ quy tuyến tính, hoặc hỏi bài tập..."
            required
            className="w-full bg-black/60 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-white focus:border-[#00f0ff] outline-none transition text-xs"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isLoading}
          />

          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-2 top-2 bottom-2 px-3 bg-cyan-950 hover:bg-[#00f0ff] border border-[#00f0ff] text-[#00f0ff] hover:text-black rounded-lg transition duration-150 cursor-pointer flex items-center justify-center shrink-0"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>

      {/* Answer Area */}
      {answer && (
        <div className="mt-5 p-4 bg-black/50 border border-cyan-500/20 rounded-xl space-y-2.5 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-[#00f0ff] font-bold uppercase tracking-wider text-[10px]">
            <Sparkles className="w-4 h-4 animate-pulse" /> ĐÁP ÁN TỪ GIA SƯ:
          </div>
          
          <div className="text-slate-200 leading-relaxed text-[11px] font-sans whitespace-pre-line select-text">
            {answer}
          </div>
        </div>
      )}
    </div>
  );
}
