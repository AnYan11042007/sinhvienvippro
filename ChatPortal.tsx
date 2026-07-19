/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { get, ref, push, onValue, set } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { Send, MessageSquare, ShieldAlert, Sparkles, User as UserIcon, Smile, Image, Compass, Trash2 } from 'lucide-react';

interface ChatPortalProps {
  uid: string;
  user: User | null;
}

interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderTitle?: string;
  senderFrame?: string;
  message: string;
  time: string;
  timestamp: number;
  sticker?: string;
}

const STICKERS = [
  '🔥', '🎉', '🌟', '💎', '🚀', '💀', '🤡', '🤣', '👍', '❤️', '😱', '💩', '🎰', '🎲'
];

export default function ChatPortal({ uid, user }: ChatPortalProps) {
  const [activeChannel, setActiveChannel] = useState<'global' | 'class' | 'ai'>('global');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [aiChat, setAiChat] = useState<Array<{ role: 'user' | 'model'; text: string; time: string }>>([
    { role: 'model', text: 'Xin chào! Tôi là **S-System 88 Core AI**. Tôi có thể hỗ trợ bạn học tập, giải đáp luật chơi, tư vấn tài chính sàn vàng hoặc chém gió cùng bạn! Hãy nhập câu hỏi phía dưới.', time: new Date().toLocaleTimeString('vi-VN') }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to Global or Class messages
  useEffect(() => {
    if (activeChannel === 'ai') return;

    const channelNode = activeChannel === 'global' ? 'global_chat' : `class_chat/${user?.class || 'N_A'}`;
    const chatRef = ref(db, channelNode);

    const unsubscribe = onValue(chatRef, (snap) => {
      const list: ChatMessage[] = [];
      if (snap.exists()) {
        snap.forEach((child) => {
          list.push({ id: child.key!, ...child.val() });
        });
      }
      // Sort and keep latest 50
      list.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(list.slice(-50));
    });

    return () => unsubscribe();
  }, [activeChannel, user?.class]);

  // Keep chat scrolled to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiChat]);

  const handleSendMessage = async (e?: React.FormEvent, stickerStr?: string) => {
    if (e) e.preventDefault();

    const msgText = stickerStr ? '' : chatInput.trim();
    if (!msgText && !stickerStr) return;

    if (activeChannel === 'ai') {
      const userText = msgText;
      setChatInput('');
      setAiChat(prev => [...prev, { role: 'user', text: userText, time: new Date().toLocaleTimeString('vi-VN') }]);
      setAiLoading(true);

      try {
        const response = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText })
        });
        const data = await response.json();
        setAiChat(prev => [...prev, { role: 'model', text: data.text || 'Tôi không nhận được phản hồi phù hợp.', time: new Date().toLocaleTimeString('vi-VN') }]);
      } catch (err) {
        console.error('AI chat error:', err);
        setAiChat(prev => [...prev, { role: 'model', text: 'Hệ thống AI bận, vui lòng thử lại sau giây lát!', time: new Date().toLocaleTimeString('vi-VN') }]);
      } finally {
        setAiLoading(false);
      }
      return;
    }

    setIsSending(true);
    try {
      const channelNode = activeChannel === 'global' ? 'global_chat' : `class_chat/${user?.class || 'N_A'}`;
      const payload: ChatMessage = {
        senderId: uid,
        senderName: user?.name || 'Sinh Viên',
        senderAvatar: user?.avatar || '',
        senderTitle: (user as any)?.title || '',
        senderFrame: (user as any)?.activeFrame || '',
        message: msgText,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        sticker: stickerStr || undefined
      };

      await push(ref(db, channelNode), payload);
      setChatInput('');
    } catch (err) {
      alert('Lỗi gửi tin nhắn!');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
      {/* Channels list sidebar */}
      <div className="lg:col-span-1 glass-box p-4 flex flex-col gap-3">
        <h3 className="font-mono text-xs uppercase tracking-widest text-[#00ff80] text-glow-green font-black pb-2 border-b border-white/5 mb-2">
          🌐 PHÒNG TRÒ CHUYỆN
        </h3>

        <button
          onClick={() => setActiveChannel('global')}
          className={`p-3.5 rounded-xl font-mono text-xs text-left uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
            activeChannel === 'global'
              ? 'bg-[#ff003c]/20 text-white border-l-4 border-[#ff003c] pl-4 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-glow-red" /> Global Chat
        </button>

        <button
          onClick={() => setActiveChannel('class')}
          className={`p-3.5 rounded-xl font-mono text-xs text-left uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
            activeChannel === 'class'
              ? 'bg-[#00f0ff]/20 text-white border-l-4 border-[#00f0ff] pl-4 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
          }`}
        >
          <Compass className="w-4 h-4 text-glow-blue" /> Lớp: {user?.class || 'N/A'}
        </button>

        <button
          onClick={() => setActiveChannel('ai')}
          className={`p-3.5 rounded-xl font-mono text-xs text-left uppercase tracking-wider flex items-center gap-2.5 transition-all cursor-pointer ${
            activeChannel === 'ai'
              ? 'bg-[#00ff80]/15 text-[#00ff80] border border-[#00ff80]/30 border-l-4 border-l-[#00ff80] pl-4 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
          }`}
        >
          <Sparkles className="w-4 h-4 text-glow-green" /> S-System AI Core
        </button>
      </div>

      {/* Main chat layout */}
      <div className="lg:col-span-3 glass-box flex flex-col h-full overflow-hidden relative">
        {/* Header bar */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00ff80] animate-pulse"></span>
            <span className="font-mono text-xs font-black uppercase text-white tracking-widest">
              {activeChannel === 'global' ? '🌍 Toàn hệ thống' : activeChannel === 'class' ? `🏫 Lớp ${user?.class}` : '🤖 Trợ lý AI Core'}
            </span>
          </div>
          <span className="text-[10px] text-[#8b949e] font-mono uppercase">
            HỘI NGHỊ THỜI GIAN THỰC 120FPS
          </span>
        </div>

        {/* Messages viewport */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeChannel !== 'ai' ? (
            messages.map((m) => {
              const isMe = m.senderId === uid;
              return (
                <div key={m.id} className={`flex gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-black/40 border-2 ${
                    m.senderFrame === 'gold-ring'
                      ? 'border-[#ffd700] shadow-[0_0_8px_rgba(255,215,0,0.4)]'
                      : m.senderFrame === 'neon-ring'
                        ? 'border-[#ff003c] shadow-[0_0_8px_rgba(255,0,60,0.4)] animate-pulse'
                        : m.senderFrame === 'cyber-ring'
                          ? 'border-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                          : 'border-white/10'
                  }`}>
                    {m.senderAvatar ? (
                      <img src={m.senderAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  {/* Message bubble */}
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 text-[10px] font-mono ${isMe ? 'justify-end' : ''}`}>
                      <span className="font-bold text-slate-300">{m.senderName}</span>
                      {m.senderTitle && (
                        <span className="py-0.5 px-2 rounded-full border border-[#ffd700]/30 text-[#ffd700] bg-[#ffd700]/5 text-[8px] font-black uppercase">
                          {m.senderTitle}
                        </span>
                      )}
                      <span className="text-[#8b949e]">{m.time}</span>
                    </div>

                    <div className={`rounded-2xl p-3 text-sm leading-relaxed ${
                      m.sticker
                        ? 'bg-transparent text-4xl py-1 px-2'
                        : isMe
                          ? 'bg-[#ff003c]/15 border border-[#ff003c]/30 text-white rounded-tr-none'
                          : 'bg-white/5 border border-white/5 text-slate-100 rounded-tl-none'
                    }`}>
                      {m.sticker ? m.sticker : m.message}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            aiChat.map((m, idx) => (
              <div key={idx} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className="w-9 h-9 rounded-full border border-white/10 shrink-0 overflow-hidden bg-black/40 flex items-center justify-center">
                  {m.role === 'user' ? (
                    user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-[#00ff80] animate-pulse" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className={`flex items-center gap-2 text-[10px] font-mono ${m.role === 'user' ? 'justify-end' : ''}`}>
                    <span className="font-bold text-slate-300">{m.role === 'user' ? 'Bạn' : 'S-System AI'}</span>
                    <span className="text-[#8b949e]">{m.time}</span>
                  </div>

                  <div className={`rounded-2xl p-3.5 text-xs leading-relaxed font-sans markdown-body ${
                    m.role === 'user'
                      ? 'bg-[#00f0ff]/15 border border-[#00f0ff]/30 text-white rounded-tr-none font-mono'
                      : 'bg-[#00ff80]/10 border border-[#00ff80]/20 text-slate-100 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))
          )}

          {aiLoading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-9 h-9 rounded-full border border-[#00ff80]/20 shrink-0 bg-[#00ff80]/5 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#00ff80] animate-spin" />
              </div>
              <div className="bg-[#00ff80]/5 border border-[#00ff80]/10 rounded-2xl rounded-tl-none p-3 text-xs font-mono text-[#00ff80] animate-pulse">
                S-System AI Core đang suy nghĩ...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Sticker strip */}
        {activeChannel !== 'ai' && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-t border-white/5 bg-black/10 overflow-x-auto">
            <span className="text-[9px] font-mono text-[#8b949e] uppercase shrink-0">Sticker nhanh:</span>
            {STICKERS.map((stk) => (
              <button
                key={stk}
                onClick={(e) => handleSendMessage(undefined, stk)}
                className="text-base hover:scale-125 transition-transform duration-100 px-1 py-0.5 cursor-pointer select-none"
              >
                {stk}
              </button>
            ))}
          </div>
        )}

        {/* Input panel */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-black/40 flex items-center gap-2">
          <input
            type="text"
            placeholder={activeChannel === 'ai' ? 'Hỏi AI Core về học tập, sàn vàng, game...' : 'Nhập nội dung tin nhắn của bạn...'}
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:border-[#ff003c] transition-all text-white"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={isSending || aiLoading}
          />

          <button
            type="submit"
            disabled={isSending || aiLoading}
            className="py-3 px-5 bg-red-950/20 hover:bg-[#ff003c] border border-[#ff003c] text-[#ff003c] hover:text-white rounded-xl transition duration-200 cursor-pointer text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" /> GỬI
          </button>
        </form>
      </div>
    </div>
  );
}
