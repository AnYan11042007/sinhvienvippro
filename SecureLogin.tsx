/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { get, ref, update, set } from 'firebase/database';
import { db } from '../firebase';
import { Shield, Eye, EyeOff, Key, Terminal, AlertTriangle, HelpCircle } from 'lucide-react';

interface SecureLoginProps {
  onLoginSuccess: (uid: string, token: string) => void;
}

export default function SecureLogin({ onLoginSuccess }: SecureLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Secure Brute force rate limiting
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  useEffect(() => {
    if (lockoutTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTimeLeft]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimeLeft > 0) return;

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setErrorMsg('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const snap = await get(ref(db, `users/${u}`));
      if (snap.exists()) {
        const uData = snap.val();
        if (uData.pass === p) {
          if (uData.locked) {
            setErrorMsg('TÀI KHOẢN CỦA BẠN ĐÃ BỊ KHÓA!');
            setIsLoading(false);
            return;
          }

          // Generate a cryptographically secure-like session token
          const randToken = Math.random().toString(36).substring(2, 15) + 
                            Date.now().toString(36) + 
                            Math.random().toString(36).substring(2, 15);

          // Update session token in database to prevent local storage spoofing
          await update(ref(db, `users/${u}`), {
            sessionToken: randToken
          });

          // Also log their secure connection timestamp
          const timestamp = Date.now();
          const logTime = new Date().toLocaleString('vi-VN');
          await set(ref(db, `online_logs/${u}/L_${timestamp}`), {
            action: 'LOGIN_SECURE',
            name: uData.name || 'Sinh Viên',
            time: logTime,
            timestamp: timestamp
          });

          // Store in LocalStorage
          localStorage.setItem('s88_uid', u);
          localStorage.setItem('s88_sessionToken', randToken);

          onLoginSuccess(u, randToken);
        } else {
          handleFailedAttempt();
        }
      } else {
        handleFailedAttempt();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Lỗi kết nối máy chủ dữ liệu!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFailedAttempt = () => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    if (nextAttempts >= 5) {
      setLockoutTimeLeft(30); // 30s cooldown after 5 failures
      setErrorMsg('SAI TÀI KHOẢN HOẶC MẬT KHẨU QUÁ 5 LẦN! Hệ thống tạm khóa 30 giây.');
      setFailedAttempts(0);
    } else {
      setErrorMsg(`SAI UID HOẶC MẬT MÃ! Lần thử thứ ${nextAttempts}/5.`);
    }
  };

  return (
    <div className="overlay">
      <div className="glass-box login-panel relative overflow-hidden">
        {/* Neon scanline accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-600 via-yellow-400 to-cyan-400 animate-pulse"></div>
        
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-500/30 flex items-center justify-center animate-pulse">
            <Shield className="w-8 h-8 text-[#ff003c] text-glow-red" />
          </div>
        </div>

        <h1 className="brand-glitch text-3xl font-black mb-1 text-white tracking-widest">
          S-SYSTEM 88
        </h1>
        <p className="text-[11px] font-mono tracking-wider text-[#8b949e] uppercase mb-6">
          Security Academic & Gamified Portal
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-400 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff003c]" />
            <span className="leading-relaxed font-mono">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username Input */}
          <div className="flex items-center gap-3 bg-black/60 border border-[#30363d] focus-within:border-[#00f0ff] rounded-lg p-3.5 transition-all">
            <Terminal className="w-5 h-5 text-[#8b949e]" />
            <input
              type="text"
              placeholder="Nhập mã UID (Vd: 1a1, teacher, ...)"
              className="bg-transparent border-none text-white w-full outline-none font-mono text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading || lockoutTimeLeft > 0}
              autoComplete="username"
            />
          </div>

          {/* Password Input */}
          <div className="flex items-center gap-3 bg-black/60 border border-[#30363d] focus-within:border-[#00f0ff] rounded-lg p-3.5 transition-all relative">
            <Key className="w-5 h-5 text-[#8b949e]" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập Mật mã bảo mật"
              className="bg-transparent border-none text-white w-full outline-none font-mono text-sm pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || lockoutTimeLeft > 0}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 text-[#8b949e] hover:text-white transition"
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Submit Button */}
          {lockoutTimeLeft > 0 ? (
            <button
              type="button"
              className="w-full py-3.5 bg-red-950/20 border border-[#ff003c] text-[#ff003c] font-bold rounded-lg font-mono tracking-widest uppercase cursor-not-allowed text-sm"
              disabled
            >
              LOCKED OUT ({lockoutTimeLeft}S)
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-red-950/20 to-black hover:from-[#ff003c] hover:to-red-600 border border-[#ff003c] text-[#ff003c] hover:text-white font-extrabold rounded-lg font-mono tracking-widest uppercase cursor-pointer hover:shadow-[0_0_15px_rgba(255,0,60,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i> ĐANG KHỞI ĐỘNG...
                </>
              ) : (
                <>
                  [ KHỞI ĐỘNG HỆ THỐNG ]
                </>
              )}
            </button>
          )}
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-[#8b949e]">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-[#00ff80]" /> Secured v3.5
          </span>
          <span className="hover:text-white cursor-help flex items-center gap-0.5" title="Mặc định: Sinh viên pass: 123 | teacher pass: admin23">
            <HelpCircle className="w-3 h-3" /> Gợi ý mật khẩu
          </span>
        </div>
      </div>
    </div>
  );
}
