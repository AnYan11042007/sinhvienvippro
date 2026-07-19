/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ref, update, get } from 'firebase/database';
import { db } from '../firebase';
import { User } from '../types';
import { Shield, Edit2, Check, X, ArrowUp, ArrowDown, UserMinus, UserCheck, Key, Award, Flame } from 'lucide-react';

interface AdminUserManageProps {
  onShowResult?: (title: string, message: string, isWin: boolean) => void;
}

interface DetailedStudent extends User {
  id: string;
}

export default function AdminUserManage({ onShowResult }: AdminUserManageProps) {
  const [students, setStudents] = useState<DetailedStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // Edit states
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editPass, setEditPass] = useState('');
  const [editPP, setEditPP] = useState(0);
  const [editLevel, setEditLevel] = useState(1);
  const [editXP, setEditXP] = useState(0);
  const [editIsPremiumBP, setEditIsPremiumBP] = useState(false);

  useEffect(() => {
    // Read user list directly from Firebase
    const usersRef = ref(db, 'users');
    const loadUsers = async () => {
      setLoading(true);
      try {
        const snap = await get(usersRef);
        if (snap.exists()) {
          const list: DetailedStudent[] = [];
          snap.forEach((child) => {
            const val = child.val();
            if (val.role === 'STUDENT') {
              list.push({
                id: child.key!,
                ...val
              });
            }
          });
          setStudents(list);
        }
      } catch (err) {
        console.error('Error loading students:', err);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [editingStudentId]);

  const startEdit = (student: DetailedStudent) => {
    setEditingStudentId(student.id);
    setEditName(student.name || '');
    setEditClass(student.class || 'S88-SE1');
    setEditPass(student.pass || '123456');
    setEditPP(student.pp || 0);
    setEditLevel(student.level || 1);
    setEditXP(student.xp || 0);
    setEditIsPremiumBP(student.isPremiumBattlePass || false);
  };

  const cancelEdit = () => {
    setEditingStudentId(null);
  };

  const saveEdit = async (studentId: string) => {
    if (!editName.trim() || !editClass.trim() || !editPass.trim()) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Vui lòng nhập đầy đủ thông tin hợp lệ!', false);
      } else {
        alert('Vui lòng nhập đầy đủ thông tin hợp lệ!');
      }
      return;
    }

    try {
      await update(ref(db, `users/${studentId}`), {
        name: editName.trim(),
        class: editClass.trim(),
        classKey: editClass.trim().toLowerCase().replace('-', '_'),
        pass: editPass.trim(),
        pp: editPP,
        level: editLevel,
        xp: editXP,
        isPremiumBattlePass: editIsPremiumBP
      });

      if (onShowResult) {
        onShowResult('THÀNH CÔNG 🎉', 'Đã cập nhật hồ sơ sinh viên thành công!', true);
      } else {
        alert('Đã cập nhật hồ sơ sinh viên thành công!');
      }
      setEditingStudentId(null);
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Không thể lưu thông tin sinh viên!', false);
      } else {
        alert('Không thể lưu thông tin sinh viên!');
      }
    }
  };

  const handleAdjustPP = async (studentId: string, currentPP: number, amount: number) => {
    const nextPP = currentPP + amount;
    if (nextPP < 0) return;
    try {
      await update(ref(db, `users/${studentId}`), { pp: nextPP });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, pp: nextPP } : s));
      if (onShowResult) {
        onShowResult('CỘNG PP 💰', `Đã điều chỉnh tài sản: ${amount > 0 ? '+' : ''}${amount.toLocaleString()} PP cho sinh viên!`, true);
      }
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Không thể cập nhật PP!', false);
      } else {
        alert('Không thể cập nhật PP!');
      }
    }
  };

  const handleToggleLock = async (studentId: string, currentLock: boolean) => {
    try {
      await update(ref(db, `users/${studentId}`), { locked: !currentLock });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, locked: !currentLock } : s));
      if (onShowResult) {
        onShowResult(
          currentLock ? 'MỞ KHÓA ACC 🎉' : 'KHÓA TÀI KHOẢN 🔒',
          currentLock ? 'Đã mở khóa tài khoản thành công!' : 'Đã khóa tài khoản sinh viên thành công!',
          !currentLock
        );
      }
    } catch (err) {
      if (onShowResult) {
        onShowResult('THẤT BẠI ❌', 'Không thể khóa/mở khóa tài khoản!', false);
      } else {
        alert('Không thể khóa/mở khóa tài khoản!');
      }
    }
  };

  const uniqueClasses = Array.from(new Set(students.map(s => s.class || 'N/A')));

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = selectedClass === 'ALL' || s.class === selectedClass;
    return matchSearch && matchClass;
  });

  return (
    <div id="admin-user-manage" className="glass-box p-6 border-white/10 bg-black/40 font-mono text-xs text-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 mb-5 gap-3">
        <div>
          <h3 className="text-sm font-black uppercase text-glow-blue text-[#00f0ff] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#00f0ff]" /> CỔNG QUẢN LÝ THÔNG TIN SINH VIÊN (STUDENT PORTAL)
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 uppercase">Tìm kiếm, chỉnh sửa hồ sơ, cập nhật số dư PP và Level trực tiếp</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Class Filter */}
          <select
            className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white outline-none focus:border-[#00f0ff]"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="ALL">TẤT CẢ LỚP HỌC</option>
            {uniqueClasses.map(c => (
              <option key={c} value={c}>LỚP {c}</option>
            ))}
          </select>

          {/* Search Field */}
          <input
            type="text"
            placeholder="🔍 Tìm theo Tên hoặc UID..."
            className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] outline-none text-white focus:border-[#00f0ff] w-48 font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && students.length === 0 ? (
        <div className="text-center py-6 text-[#00f0ff] animate-pulse">ĐANG TẢI THÔNG TIN SINH VIÊN...</div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-6 text-slate-500 italic">Không tìm thấy sinh viên nào phù hợp.</div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {filteredStudents.map((s) => {
            const isEditing = editingStudentId === s.id;
            return (
              <div 
                key={s.id} 
                className={`p-4 border rounded-xl transition-all duration-200 ${
                  isEditing 
                    ? 'border-[#00f0ff] bg-[#00f0ff]/5 shadow-[0_0_15px_rgba(0,240,255,0.15)]' 
                    : s.locked 
                      ? 'border-red-500/20 bg-red-950/5 opacity-80' 
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                }`}
              >
                {isEditing ? (
                  /* EDITING FORM PANEL */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#00f0ff]/20 pb-2">
                      <span className="text-glow-blue text-[#00f0ff] font-black uppercase text-[10px]">
                        📝 CHỈNH SỬA HỒ SƠ SINH VIÊN: {s.id.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">UID: {s.id}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Họ Và Tên:</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-white font-bold"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Lớp Học:</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-white font-bold"
                          value={editClass}
                          onChange={(e) => setEditClass(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Mật Khẩu Đăng Nhập:</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 pl-7 text-yellow-400 font-bold"
                            value={editPass}
                            onChange={(e) => setEditPass(e.target.value)}
                          />
                          <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2.5" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Số Dư PP:</label>
                        <input
                          type="number"
                          className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-emerald-400 font-bold text-xs"
                          value={editPP}
                          onChange={(e) => setEditPP(parseInt(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">Level S88:</label>
                        <input
                          type="number"
                          className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-yellow-500 font-bold text-xs"
                          value={editLevel}
                          onChange={(e) => setEditLevel(parseInt(e.target.value) || 1)}
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-slate-400 mb-1 uppercase font-bold">XP Hiện Tại:</label>
                        <input
                          type="number"
                          className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-blue-400 font-bold text-xs"
                          value={editXP}
                          onChange={(e) => setEditXP(parseInt(e.target.value) || 0)}
                        />
                      </div>

                      <div className="flex items-center pt-5 pl-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-amber-500 rounded"
                            checked={editIsPremiumBP}
                            onChange={(e) => setEditIsPremiumBP(e.target.checked)}
                          />
                          <span className="text-[10px] text-amber-400 font-black uppercase flex items-center gap-1">
                            👑 PREMIUM S-PASS
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-[#30363d]">
                      <button
                        onClick={cancelEdit}
                        className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg uppercase flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <X className="w-3.5 h-3.5" /> HỦY BỎ
                      </button>
                      <button
                        onClick={() => saveEdit(s.id)}
                        className="py-1.5 px-3 bg-[#00f0ff] hover:bg-cyan-400 text-black font-black rounded-lg uppercase flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Check className="w-3.5 h-3.5" /> LƯU THAY ĐỔI
                      </button>
                    </div>
                  </div>
                ) : (
                  /* DEFAULT DETAILED READ VIEW WITH ADJUST ACTIONS */
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {/* Avatar miniature frame */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center relative p-0.5 ${
                          s.activeFrame === 'gold-ring'
                            ? 'border border-[#ffd700] bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_8px_rgba(255,215,0,0.5)]'
                            : s.activeFrame === 'neon-ring'
                              ? 'border border-[#ff003c] bg-gradient-to-r from-[#ff003c] to-[#00f0ff] shadow-[0_0_8px_rgba(255,0,60,0.5)] animate-pulse'
                              : s.activeFrame === 'cyber-ring'
                                ? 'border border-[#00f0ff] bg-gradient-to-r from-[#00f0ff] to-[#ff00ff] shadow-[0_0_8px_rgba(0,240,255,0.5)]'
                                : 'border border-white/10'
                        }`}>
                          <div className="w-full h-full rounded-full overflow-hidden bg-black/40 flex items-center justify-center">
                            {s.avatar ? (
                              <img src={s.avatar.startsWith('http') ? s.avatar : `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs">👤</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-white text-xs">{s.name}</strong>
                            <span className="text-[8px] py-0.5 px-1.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">LỚP {s.class}</span>
                            <span className="text-[8px] text-slate-500 font-mono">ID: {s.id}</span>
                            {s.isPremiumBattlePass && (
                              <span className="text-[8px] py-0.5 px-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black uppercase">👑 VIP PASS</span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-1 text-[10px] text-slate-400">
                            <span className="text-emerald-400 font-bold">Số dư: {s.pp.toLocaleString()} PP</span>
                            <span className="text-yellow-500 font-bold flex items-center gap-0.5">
                              <Award className="w-3 h-3 text-yellow-500" /> CẤP ĐỘ {s.level || 1}
                            </span>
                            <span className="text-blue-400">XP: {s.xp || 0} / {(s.level || 1) * 100}</span>
                            <span className="text-slate-500">Mật khẩu: {s.pass}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Lock Status indicator */}
                        <span className={`text-[8px] py-0.5 px-1.5 rounded uppercase font-bold border ${s.locked ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                          {s.locked ? 'TÀI KHOẢN BỊ KHÓA' : 'HOẠT ĐỘNG'}
                        </span>

                        <button
                          onClick={() => startEdit(s)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer transition-all"
                          title="Sửa thông tin hồ sơ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Credit Allocation Controls */}
                    <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-500 uppercase font-black">Phát PP nhanh:</span>
                        <button
                          onClick={() => handleAdjustPP(s.id, s.pp, 5000)}
                          className="py-1 px-2 bg-emerald-950/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-400 rounded text-[9px] font-black cursor-pointer transition-all"
                        >
                          +5K
                        </button>
                        <button
                          onClick={() => handleAdjustPP(s.id, s.pp, 20000)}
                          className="py-1 px-2 bg-emerald-950/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-400 rounded text-[9px] font-black cursor-pointer transition-all"
                        >
                          +20K
                        </button>
                        <button
                          onClick={() => handleAdjustPP(s.id, s.pp, 100000)}
                          className="py-1 px-2 bg-emerald-950/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-400 rounded text-[9px] font-black cursor-pointer transition-all"
                        >
                          +100K
                        </button>
                        <button
                          onClick={() => handleAdjustPP(s.id, s.pp, -10000)}
                          className="py-1 px-2 bg-red-950/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 rounded text-[9px] font-black cursor-pointer transition-all"
                        >
                          -10K
                        </button>
                      </div>

                      <button
                        onClick={() => handleToggleLock(s.id, s.locked || false)}
                        className={`py-1 px-2.5 border rounded text-[9px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                          s.locked
                            ? 'bg-emerald-500/10 hover:bg-emerald-500 border-emerald-500 text-emerald-400 hover:text-black'
                            : 'bg-red-500/10 hover:bg-red-500 border-red-500 text-red-400 hover:text-white'
                        }`}
                      >
                        {s.locked ? <UserCheck className="w-3 h-3" /> : <UserMinus className="w-3 h-3" />}
                        {s.locked ? 'MỞ KHÓA ACC' : 'KHÓA ACC'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
