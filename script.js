import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, onValue, update, remove, set, onDisconnect, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = { apiKey: "AIzaSyCfrD1iS1yjfjuaPIKvGb-iWcirBg1lXJE", authDomain: "appsinhvien-24482.firebaseapp.com", databaseURL: "https://appsinhvien-24482-default-rtdb.asia-southeast1.firebasedatabase.app", projectId: "appsinhvien-24482" };
const app = initializeApp(firebaseConfig); const db = getDatabase(app);

let activeQuizId = null; let quizTimerInterval = null; let myCurrentPvPRoomId = null; let isSystemLoaded = false; window.adminFilterClass = 'ALL';
let txBet = 0; let txChoice = ''; let txResult = []; let isTxRevealed = false;
let flightInterval; let isFlying = false; let currentMultiplier = 0.00; let crashPoint = 1.00; let flightBetAmount = 0; let pX = -10, pY = 80;
let fbBet = 0; let fbChoice = '';

// ==========================================
// 🔔 HỆ THỐNG CUSTOM ALERT
// ==========================================
window.showResult = (title, message, isWin) => {
    const modal = document.getElementById('result-modal'); const t = document.getElementById('result-title'); const msg = document.getElementById('result-msg'); const icon = document.getElementById('result-icon'); const btn = document.getElementById('result-close-btn');
    t.innerText = "ĐANG XỬ LÝ..."; t.className = "text-blue glow-pulse"; msg.innerHTML = ""; icon.className = "fas fa-spinner fa-spin fa-3x text-blue"; btn.style.display = 'none'; modal.style.display = 'flex';
    setTimeout(() => { t.innerText = title; t.className = isWin ? 'text-gold glow-pulse' : 'text-red glow-pulse'; msg.innerHTML = message.replace(/\n/g, '<br><br>'); icon.className = isWin ? "fas fa-trophy fa-3x text-gold" : "fas fa-skull fa-3x text-red"; btn.style.display = 'block'; }, 1500);
};

function formatDate(dStr) { if(!dStr || dStr === 'Không có') return ''; const parts = dStr.split('-'); if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`; return dStr; }
window.toggleMusic = () => { const audio = document.getElementById('bgMusic'), btn = document.getElementById('music-toggle'); if (audio.paused) { audio.play().catch(() => alert("Bấm vào màn hình trước khi bật nhạc!")); btn.innerHTML = '<i class="fas fa-volume-up"></i> [ TẮT NHẠC ]'; btn.style.color = 'var(--neon-gold)'; } else { audio.pause(); btn.innerHTML = '<i class="fas fa-music"></i> [ BẬT NHẠC ]'; btn.style.color = ''; } };

window.switchTab = (tab) => { 
    ['academic', 'casino', 'bank', 'gold'].forEach(t => { 
        if(document.getElementById(`nav-${t}`)) document.getElementById(`nav-${t}`).classList.remove('active'); 
        if(document.getElementById(`tab-${t}`)) document.getElementById(`tab-${t}`).style.display = 'none'; 
    }); 
    if(document.getElementById(`nav-${tab}`)) document.getElementById(`nav-${tab}`).classList.add('active'); 
    if(document.getElementById(`tab-${tab}`)) document.getElementById(`tab-${tab}`).style.display = 'grid'; 

    // FIX LỖI CHART TRẮNG KHI CHUYỂN TAB
    if(tab === 'gold' && goldChartObj) {
        setTimeout(() => { goldChartObj.resize(); goldChartObj.update(); }, 150);
    }
};

window.login = async () => { const u = document.getElementById('username').value.trim(), p = document.getElementById('password').value.trim(); const snap = await get(ref(db, `users/${u}`)); if (snap.exists() && snap.val().pass === p) { if(snap.val().locked) return alert("TÀI KHOẢN ĐÃ BỊ KHÓA!"); localStorage.setItem('uid', u); location.reload(); } else alert("SAI UID HOẶC MẬT KHẨU!"); };
window.logout = async () => { 
    if(uid) { 
        await remove(ref(db, `online/${uid}`)); 
        await push(ref(db, `online_logs/${uid}`), { action: 'LOGOUT', time: new Date().toLocaleString('vi-VN'), timestamp: Date.now(), name: localStorage.getItem('uname') || uid }); 
    }
    localStorage.removeItem('uid'); localStorage.removeItem('uname'); location.reload(); 
};
function genClassOptions(sel, all = false) { let o = all ? '<option value="ALL">TẤT CẢ LỚP</option>' : ''; for(let y=1; y<=4; y++) ['A','B','C','D'].forEach(b => { const v=`Y${y}_${b}`; o+=`<option value="${v}" ${v===sel?'selected':''}>Lớp ${y}-${b}</option>`; }); return o; }

const uid = localStorage.getItem('uid');
if (uid) {
    document.getElementById('login-screen').style.display = 'none'; document.getElementById('dashboard').style.display = 'flex';
    if(document.getElementById('add-class-select')) { document.getElementById('add-class-select').innerHTML = genClassOptions('Y1_A'); document.getElementById('filter-class-select').innerHTML = genClassOptions('ALL', true); }
    loadSystem();
}

function loadSystem() {
    if(isSystemLoaded) return; isSystemLoaded = true;
    
    const connectedRef = ref(db, '.info/connected');
    
    onValue(ref(db, `users/${uid}`), snap => {
        const u = snap.val(); if(!u) return;
        localStorage.setItem('uname', u.name);
        document.getElementById('avatar-container').innerHTML = u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : `<i class="fas fa-user-ninja"></i>`;
        document.getElementById('display-name').innerHTML = u.role === 'TEACHER' ? `${u.name} <i class="fas fa-pen" onclick="changeTeacherName()" style="font-size:10px;cursor:pointer;"></i>` : u.name;
        document.getElementById('role-badge').innerText = u.role === 'TEACHER' ? 'FACULTY' : `LỚP ${u.class}`;
        if(document.getElementById('pvp-p1-avatar')) { document.getElementById('pvp-p1-avatar').src = u.avatar || 'https://i.pravatar.cc/150?u=my'; document.getElementById('pvp-p1-name').innerText = u.name; }
        if(u.role === 'TEACHER') { document.getElementById('teacher-view').style.display = 'block'; document.getElementById('nav-academic').style.display = 'none'; document.getElementById('nav-bank').style.display = 'none'; document.getElementById('nav-casino').style.display = 'none'; document.getElementById('nav-gold').style.display = 'none'; } 
        else { document.getElementById('student-view').style.display = 'block'; document.getElementById('nav-academic').style.display = 'flex'; document.getElementById('nav-bank').style.display = 'flex'; document.getElementById('nav-casino').style.display = 'flex'; document.getElementById('nav-gold').style.display = 'flex'; document.getElementById('display-pp').innerText = (u.pp || 0).toLocaleString(); renderStudentGrades(u); updateMyGoldUI(u); }
    });

    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            const myOnlineRef = ref(db, `online/${uid}`);
            const uname = localStorage.getItem('uname') || 'Sinh Viên';
            set(myOnlineRef, { name: uname, time: Date.now() });
            onDisconnect(myOnlineRef).remove();
            
            if (!window.hasLoggedLogin) {
                window.hasLoggedLogin = true;
                push(ref(db, `online_logs/${uid}`), { action: 'LOGIN', time: new Date().toLocaleString('vi-VN'), timestamp: Date.now(), name: uname });
            }
            onDisconnect(push(ref(db, `online_logs/${uid}`))).set({ action: 'LOGOUT', time: 'Mất kết nối', timestamp: {'.sv': 'timestamp'}, name: uname });
        }
    });

    onValue(ref(db, 'classes'), snap => {
        const clss = snap.val() || {}; let data = Object.keys(clss).map(k => ({id:k, ...clss[k]})).sort((a,b) => b.cp - a.cp); let hS = "", hA = "";
        data.forEach((c, i) => { hS += `<tr><td>#${i+1}</td><td>Lớp ${c.name}</td><td class="text-gold">${c.cp}</td></tr>`; hA += `<tr><td class="text-blue">Lớp ${c.name}</td><td><input type="number" value="${c.cp}" onchange="window.upCP('${c.id}',this.value)" class="cyber-input" style="width:70px;padding:2px;text-align:center;"></td></tr>`; });
        if(document.getElementById('student-class-rank')) document.getElementById('student-class-rank').innerHTML = hS; if(document.getElementById('admin-class-control')) document.getElementById('admin-class-control').innerHTML = hA;
    });

    onValue(ref(db, 'users'), snap => {
        const us = snap.val() || {}; let arr = []; for(let id in us) if(us[id].role === 'STUDENT') arr.push({id, ...us[id]});
        arr.sort((a,b) => (Number(b.pp)||0) - (Number(a.pp)||0)); let hTop = ""; arr.slice(0, 50).forEach((s) => hTop += `<tr><td>${s.id}</td><td>${s.name}</td><td class="text-gold" style="font-weight:bold; font-size:15px;">${(Number(s.pp)||0).toLocaleString()}</td></tr>`);
        if(document.getElementById('top-50-students')) document.getElementById('top-50-students').innerHTML = hTop;

        const filter = window.adminFilterClass; let hAdmin = ""; let count = 0; let adminArr = arr.filter(u => filter === 'ALL' || u.classKey === filter);
        adminArr.sort((a, b) => { const cA = a.classKey || ""; const cB = b.classKey || ""; if (cA === cB) return (Number(b.pp) || 0) - (Number(a.pp) || 0); return cA.localeCompare(cB); });
        adminArr.forEach(u => { count++; hAdmin += `<tr><td>${u.id}</td><td><input type="text" value="${u.name}" onchange="window.upU('${u.id}','name',this.value)" class="cyber-input" style="width:70px;"></td><td><input type="text" value="${u.pass}" onchange="window.upU('${u.id}','pass',this.value)" class="cyber-input" style="width:40px;"></td><td>Y:${u.year} S:${u.sem}</td><td><select onchange="window.upC('${u.id}',this.value)" class="cyber-input">${genClassOptions(u.classKey)}</select></td><td>${(Number(u.pp)||0).toLocaleString()}</td><td><button onclick="window.addPP('${u.id}')" class="btn-mini add">+PP</button><button onclick="window.subPP('${u.id}')" class="btn-mini sub">-PP</button><button onclick="window.openGrades('${u.id}','${u.name}')" class="btn-mini add">ĐIỂM</button><button onclick="window.openSubModal('${u.id}')" class="btn-mini add">+MÔN</button><button onclick="window.lockU('${u.id}',${!u.locked})" class="btn-mini del">${u.locked?'MỞ':'KHÓA'}</button><button onclick="window.delU('${u.id}')" class="btn-mini del">X</button></td></tr>`; });
        if (document.getElementById('admin-users')) document.getElementById('admin-users').innerHTML = hAdmin; if (document.getElementById('student-count')) document.getElementById('student-count').innerText = count;
    });

    onValue(ref(db, 'quests'), snap => {
        let hStudent = ""; let hAdmin = ""; const qs = snap.val() || {};
        for(let id in qs) {
            const q = qs[id]; const dLine = q.deadline && q.deadline !== 'Không có' ? formatDate(q.deadline) : 'Vô thời hạn'; const isExpired = q.deadline && q.deadline !== 'Không có' && new Date() > new Date(q.deadline + "T23:59:59");
            hAdmin += `<div style="display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid #333; background: rgba(255,255,255,0.02); margin-bottom:5px; border-radius:8px;"><div><strong class="text-green">${q.title}</strong><br><small style="color:#aaa;">Thưởng: ${q.rewardPP} PP | Hạn: ${dLine}</small></div><button onclick="window.delQ('${id}')" class="btn-mini del" style="height:fit-content; padding:8px 12px;"><i class="fas fa-trash"></i></button></div>`;
            if(q.status === 'OPEN') {
                const maxAtt = parseInt(q.maxAttempts) || 1; const att = q.attempts?.[uid] || 0; const canPlay = !isExpired && att < maxAtt; let btnHtml = '';
                if (isExpired) btnHtml = `<button class="btn-cyber" style="background:#333; border-color:#555; color:#888; cursor:not-allowed;">[ HẾT HẠN ]</button>`; else if (att >= maxAtt) btnHtml = `<button class="btn-cyber" style="background:rgba(0,255,128,0.1); border-color:var(--neon-green); color:var(--neon-green); cursor:not-allowed;">[ ĐÃ HOÀN THÀNH ]</button>`; else btnHtml = `<button onclick="openQuiz('${id}')" class="btn-cyber glow-pulse" style="border-color:var(--neon-blue); color:var(--neon-blue);">[ GIẢI MÃ NHẬN THƯỞNG ]</button>`;
                hStudent += `<div class="mission-item" style="border-left: 4px solid ${canPlay ? 'var(--neon-blue)' : '#555'};"><div><h4 style="margin:0; color:${canPlay ? '#fff' : '#888'}"><i class="fas fa-question-circle"></i> ${q.title}</h4><small style="color:#aaa;">Thưởng: <b class="text-gold">+${q.rewardPP} PP</b> | Phạt: <b class="text-red">-${q.penaltyPP} PP</b></small><br><small style="color:#aaa;">Lượt: ${att}/${maxAtt} | Hạn: ${dLine}</small></div>${btnHtml}</div>`;
            }
        }
        if(document.getElementById('admin-quest-list')) document.getElementById('admin-quest-list').innerHTML = hAdmin || '<p style="color:#888; text-align:center;">Chưa có Quiz nào!</p>';
        if(document.getElementById('student-mission-list')) document.getElementById('student-mission-list').innerHTML = hStudent || '<p style="color:#888; text-align:center;">Hôm nay không có bài Quiz nào!</p>';
    });

    onValue(ref(db, 'pvp_rooms'), snap => {
        const rooms = snap.val() || {}; let liveHtml = ""; let modalHtml = ""; let amIPlaying = false;
        for(let k in rooms) {
            const r = rooms[k]; const isMe = (r.creator === uid || r.joiner === uid);
            if(r.status === 'WAITING') {
                liveHtml += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding: 8px 0;"><span style="font-size:12px;"><i class="fas fa-fire text-red"></i> <strong class="text-blue">${r.creatorName}</strong> gạ kèo <strong class="text-gold">${r.bet.toLocaleString()} PP</strong>!</span>${r.creator === uid ? `<span style="color:#888;font-size:11px;">[Phòng Bạn]</span>` : `<button onclick="pvpJoin('${k}')" class="btn-mini add" style="padding:6px 12px;">CHIẾN</button>`}</div>`;
                if(r.creator === uid) modalHtml += `<div class="room-item" style="border-color:var(--neon-green);"><div><strong class="text-green">PHÒNG CỦA BẠN</strong><br><small>Đang chờ đối thủ...</small></div><h3 class="text-gold" style="margin:0;">${r.bet.toLocaleString()} PP</h3><button onclick="pvpCancel('${k}', ${r.bet})" class="btn-mini del" style="padding:10px;">HỦY PHÒNG</button></div>`;
                else modalHtml += `<div class="room-item"><div style="display:flex; align-items:center; gap:10px;"><img src="${r.creatorAvatar || 'https://i.pravatar.cc/150?u=enemy'}" style="width:40px; height:40px; border-radius:50%; border:1px solid #fff;"><div><strong class="text-blue">${r.creatorName}</strong><br><small>Sẵn sàng chiến</small></div></div><h3 class="text-gold" style="margin:0;">${r.bet.toLocaleString()} PP</h3><button onclick="pvpJoin('${k}')" class="btn-cyber" style="padding:10px 20px; font-size:12px;">VÀO CHIẾN</button></div>`;
            } else if (r.status === 'PLAYING' && isMe) {
                amIPlaying = true; myCurrentPvPRoomId = k; const isCreator = (uid === r.creator);
                document.getElementById('pvp-action-area').style.display = 'none'; document.getElementById('pvp-battle-area').style.display = 'block';
                document.getElementById('pvp-pot').innerText = `TỔNG: ${(r.bet * 2).toLocaleString()} PP`; document.getElementById('pvp-log-box').innerHTML = r.log || "Trận đấu bắt đầu!"; document.getElementById('pvp-log-box').scrollTop = document.getElementById('pvp-log-box').scrollHeight;
                document.getElementById('pvp-p1-avatar').src = isCreator ? r.creatorAvatar : r.joinerAvatar; document.getElementById('pvp-p1-name').innerText = isCreator ? r.creatorName : r.joinerName; document.getElementById('pvp-p1-hp').style.width = (isCreator ? r.p1_hp : r.p2_hp) + '%';
                document.getElementById('pvp-p2-avatar').src = isCreator ? r.joinerAvatar : r.creatorAvatar; document.getElementById('pvp-p2-name').innerText = isCreator ? r.joinerName : r.creatorName; document.getElementById('pvp-p2-hp').style.width = (isCreator ? r.p2_hp : r.p1_hp) + '%';
                if(r.turn === uid) { document.getElementById('pvp-controls').style.display = 'flex'; document.getElementById('pvp-wait-msg').style.display = 'none'; } else { document.getElementById('pvp-controls').style.display = 'none'; document.getElementById('pvp-wait-msg').style.display = 'block'; }
            } else if (r.status === 'ENDED' && isMe) {
                amIPlaying = true; document.getElementById('pvp-log-box').innerHTML = r.log; document.getElementById('pvp-controls').style.display = 'none';
                if(r.winner === uid) { document.getElementById('pvp-wait-msg').style.display = 'block'; document.getElementById('pvp-wait-msg').innerHTML = `<button onclick="pvpClaimReward('${k}', ${r.bet*2})" class="btn-cyber w-100" style="padding:15px; border-color:var(--neon-gold); color:var(--neon-gold);">🏆 [ BẠN THẮNG! NHẬN ${(r.bet*2).toLocaleString()} PP & ĐÓNG ] 🏆</button>`; } 
                else { document.getElementById('pvp-wait-msg').style.display = 'block'; document.getElementById('pvp-wait-msg').innerHTML = `<h3 class="text-red">BẠN ĐÃ TỬ TRẬN! MẤT SẠCH TIỀN.</h3><button onclick="window.closePvPModal()" class="btn-cyber w-100" style="padding:10px;">[ RỜI ĐI TRONG CAY ĐẮNG ]</button>`; }
            }
        }
        if (document.getElementById('live-pvp-feed')) document.getElementById('live-pvp-feed').innerHTML = liveHtml || `<span style="color:#555; font-size:12px; font-style:italic;">Hiện chưa có đại gia nào lên sàn...</span>`;
        if (!amIPlaying) {
            if(document.getElementById('pvp-action-area')) document.getElementById('pvp-action-area').style.display = 'block'; if(document.getElementById('pvp-battle-area')) document.getElementById('pvp-battle-area').style.display = 'none';
            if(document.getElementById('pvp-list')) document.getElementById('pvp-list').innerHTML = modalHtml || `<p style="color:#888; text-align:center; margin-top:20px;">Võ đài đang trống. Hãy tạo phòng cược ngay!</p>`;
        }
    });

    onValue(ref(db, 'transactions'), snap => {
        const txs = snap.val() || {}; let arr = Object.keys(txs).map(k => ({id:k, ...txs[k]})).sort((a,b) => b.timestamp - a.timestamp);
        let hStudent = "", hAdmin = "";
        arr.forEach(tx => {
            const amtStr = `<strong class="text-gold">${tx.amount.toLocaleString()} PP</strong>`;
            hAdmin += `<tr><td>${tx.time}</td><td><span class="text-blue">${tx.senderName}</span> (${tx.sender})</td><td><span class="text-red">${tx.receiverName}</span> (${tx.receiver})</td><td>${amtStr}</td><td>${tx.message}</td></tr>`;
            if(tx.sender === uid || tx.receiver === uid) {
                const isSent = tx.sender === uid; const typeHtml = isSent ? `<span style="color:#ff4500;">Chuyển đi <i class="fas fa-arrow-right"></i></span>` : `<span style="color:#4ade80;">Nhận về <i class="fas fa-arrow-left"></i></span>`; const partner = isSent ? `${tx.receiverName} (${tx.receiver})` : `${tx.senderName} (${tx.sender})`;
                hStudent += `<tr><td>${tx.time}</td><td>${typeHtml}</td><td>${partner}</td><td>${amtStr}</td><td>${tx.message}</td></tr>`;
            }
        });
        if(document.getElementById('admin-transactions')) document.getElementById('admin-transactions').innerHTML = hAdmin || `<tr><td colspan="5" style="text-align:center; color:#888;">Chưa có giao dịch nào</td></tr>`;
        if(document.getElementById('student-transactions')) document.getElementById('student-transactions').innerHTML = hStudent || `<tr><td colspan="5" style="text-align:center; color:#888;">Chưa có giao dịch nào</td></tr>`;
    });

    onValue(ref(db, 'online_logs'), snap => {
        const logs = snap.val() || {}; let arr = [];
        for(let userId in logs) {
            for(let key in logs[userId]) {
                arr.push({ uid: userId, ...logs[userId][key] });
            }
        }
        arr.sort((a,b) => {
            let tA = a.timestamp; let tB = b.timestamp;
            if(typeof tA === 'object') tA = Date.now();
            if(typeof tB === 'object') tB = Date.now();
            return tB - tA;
        });
        let h = "";
        arr.slice(0, 100).forEach(log => {
            const clss = log.action === 'LOGIN' ? 'text-green' : 'text-red';
            h += `<tr><td>${log.uid}</td><td>${log.name || 'Sinh viên'}</td><td class="${clss}" style="font-weight:bold;">${log.action}</td><td>${log.time}</td></tr>`;
        });
        if(document.getElementById('admin-online-logs')) document.getElementById('admin-online-logs').innerHTML = h || `<tr><td colspan="4" style="text-align:center; color:#888;">Chưa có dữ liệu</td></tr>`;
    });

    startGoldMarketLoop();
    listenGoldMarket();
}
window.loadAdmin = () => { /* Auto */ };

window.transferPP = async () => {
    const tUid = document.getElementById('transfer-uid').value.trim(), amt = parseInt(document.getElementById('transfer-amount').value), msg = document.getElementById('transfer-msg').value.trim() || 'Không có lời nhắn';
    if(!tUid || isNaN(amt) || amt <= 0) return alert("Thông tin chuyển khoản không hợp lệ!");
    if(tUid === uid) return alert("Không thể tự chuyển tiền cho chính mình!");
    const mySnap = await get(ref(db, `users/${uid}`)); const myData = mySnap.val();
    if((Number(myData.pp)||0) < amt) return alert("Bạn không đủ PP để chuyển!");
    const targetSnap = await get(ref(db, `users/${tUid}`));
    if(!targetSnap.exists()) return alert("UID Người nhận không tồn tại!");
    const targetData = targetSnap.val();
    await update(ref(db, `users/${uid}`), { pp: (Number(myData.pp)||0) - amt }); await update(ref(db, `users/${tUid}`), { pp: (Number(targetData.pp)||0) + amt });
    await set(ref(db, `transactions/TX_${Date.now()}`), { sender: uid, senderName: myData.name, receiver: tUid, receiverName: targetData.name, amount: amt, message: msg, time: new Date().toLocaleString('vi-VN'), timestamp: Date.now() });
    alert(`Đã chuyển ${amt.toLocaleString()} PP cho ${targetData.name}!`);
    document.getElementById('transfer-amount').value = ''; document.getElementById('transfer-msg').value = '';
};

// ==========================================
// 🛠️ ADMIN TOOLS & QUIZ
// ==========================================
function renderStudentGrades(u) { const tb = document.getElementById('student-grades'); if(!tb) return; tb.innerHTML = ''; if(!u.academic) return; Object.keys(u.academic).sort().forEach(tk => { tb.innerHTML += `<tr class="term-group-header"><td colspan="6">${tk}</td></tr>`; for(let sk in u.academic[tk]) { const s = u.academic[tk][sk]; tb.innerHTML += `<tr><td>${s.name}</td><td>${s.bth}</td><td>${s.gk}</td><td>${s.ck}</td><td>${s.final}</td><td class="text-gold">${s.grade}</td></tr>`; } }); }
window.adminCreateUser = async () => { const id = document.getElementById('add-uid').value.trim(), n = document.getElementById('add-name').value.trim(), ck = document.getElementById('add-class-select').value, p = document.getElementById('add-pass').value.trim() || "123", pp = parseInt(document.getElementById('add-pp').value) || 1000; if(!id || !n) return alert("Nhập UID và Tên!"); const y = parseInt(ck[1]); await set(ref(db, `users/${id}`), { name:n, classKey:ck, class:`${y}-${ck.split('_')[1]}`, year:y, sem:1, role:"STUDENT", pass:p, pp:pp, avatar:"", stats:[50,50,50,50,50], locked:false }); alert(`Tạo tài khoản ${id} xong!`); document.getElementById('add-uid').value = ''; document.getElementById('add-name').value = ''; };
let curSID = null; window.openSubModal = id => { curSID = id; document.getElementById('subject-modal').style.display = 'flex'; }; window.closeSubjectModal = () => { document.getElementById('subject-modal').style.display = 'none'; curSID = null; };
window.adminSaveSubject = async () => { const y = document.getElementById('subj-year').value, s = document.getElementById('subj-sem').value, n = document.getElementById('subj-name').value.trim(), b = parseFloat(document.getElementById('subj-bth').value)||0, g = parseFloat(document.getElementById('subj-gk').value)||0, c = parseFloat(document.getElementById('subj-ck').value)||0; if(!n) return alert("Nhập Tên môn học!"); const f = Math.round(((b*1+g*2+c*3)/6)*10)/10, gr = f>=8.5?'A':f>=7?'B':f>=5.5?'C':f>=4?'D':'F'; await update(ref(db, `users/${curSID}/academic/Year${y}_Sem${s}/sub_${Date.now()}`), { name:n, bth:b, gk:g, ck:c, final:f, grade:gr }); alert("Đã thêm điểm!"); window.closeSubjectModal(); };
window.lockU = (id, st) => update(ref(db, `users/${id}`), { locked: st });
window.adminCreateQuest = async () => { const t = document.getElementById('q-title').value, q = document.getElementById('q-question').value, a = document.getElementById('q-optA').value, b = document.getElementById('q-optB').value, c = document.getElementById('q-correct').value, pp = parseInt(document.getElementById('q-pp').value) || 0, pn = parseInt(document.getElementById('q-penalty').value) || 0, l = parseInt(document.getElementById('q-limit').value) || 999, m = parseInt(document.getElementById('q-max-attempts').value) || 1, tm = parseInt(document.getElementById('q-time').value) || 0, dl = document.getElementById('q-deadline').value || 'Không có'; if(!t || !q || !a || !b) return alert("Điền ĐẦY ĐỦ Tên, Câu hỏi và Đáp án!"); await set(ref(db, `quests/Q_${Date.now()}`), { title:t, question:q, optA:a, optB:b, correctOpt:c, rewardPP:pp, penaltyPP:pn, limit:l, maxAttempts:m, timeLimit:tm, deadline:dl, joined:0, status:'OPEN' }); alert("ĐĂNG QUIZ THÀNH CÔNG!"); document.getElementById('q-title').value = ''; document.getElementById('q-question').value = ''; document.getElementById('q-optA').value = ''; document.getElementById('q-optB').value = ''; };
window.forceInitClasses = async () => { const ups = {}; for(let y=1;y<=4;y++) ['A','B','C','D'].forEach(b => { const id=`Y${y}_${b}`; ups[`classes/${id}`] = { year:y, name:`${y}-${b}`, cp:1000 }; }); await update(ref(db, '/'), ups); alert("ĐÃ RESET CHUẨN HÓA 16 LỚP!"); };
window.addPP = async (id) => { const amt = prompt("CỘNG PP:"); if(amt && !isNaN(amt)) { const s = await get(ref(db, `users/${id}`)); await update(ref(db, `users/${id}`), { pp: (Number(s.val().pp) || 0) + parseInt(amt) }); } };
window.subPP = async (id) => { const amt = prompt("TRỪ PP:"); if(amt && !isNaN(amt)) { const s = await get(ref(db, `users/${id}`)); await update(ref(db, `users/${id}`), { pp: Math.max(0, (Number(s.val().pp) || 0) - parseInt(amt)) }); } };
window.upU = (id, k, v) => update(ref(db, `users/${id}`), { [k]: v });
window.delU = id => { if(confirm("Xóa sinh viên này?")) remove(ref(db, `users/${id}`)); };
window.upCP = (id, v) => update(ref(db, `classes/${id}`), { cp: parseInt(v) });
window.delQ = id => { if(confirm("Xóa bài Quiz này?")) remove(ref(db, `quests/${id}`)); };
window.upC = async (id, ck) => { const y = parseInt(ck[1]), block = ck.split('_')[1], name = `${y}-${block}`; await update(ref(db, `users/${id}`), { classKey: ck, class: name, year: y }); };
window.changeAvatar = () => { const url = prompt("Nhập Link ảnh (URL):"); if(url) update(ref(db, `users/${uid}`), { avatar: url }); };
window.changeTeacherName = () => { const n = prompt("Tên giáo viên mới:"); if(n) update(ref(db, `users/${uid}`), { name: n }); };
window.closeQuizModal = () => { if(quizTimerInterval) clearInterval(quizTimerInterval); document.getElementById('quiz-modal').style.display = 'none'; };
window.closeViewGradesModal = () => document.getElementById('view-grades-modal').style.display = 'none';
window.sendExpelRequest = async () => { const t = document.getElementById('expel-uid').value, r = document.getElementById('expel-reason').value; if(!t||!r) return alert("Nhập UID và Lý do!"); await set(ref(db, `messages/msg_${Date.now()}`), { senderUid: uid, senderName: (await get(ref(db, `users/${uid}`))).val().name, targetUid: t, reason: r, status: 'PENDING', adminReply: '' }); alert("Gửi đơn tố cáo thành công! Chờ Admin duyệt."); };
window.replyM = async (id, st) => { const r = prompt("Nhập lý do duyệt/từ chối:"); if(r!==null) await update(ref(db, `messages/${id}`), { status: st, adminReply: r }); };

window.openQuiz = async id => {
    const s = await get(ref(db, `quests/${id}`)); const q = s.val(); if(!q) return;
    if(q.deadline && q.deadline !== 'Không có' && new Date() > new Date(q.deadline + "T23:59:59")) return alert("BÀI NÀY ĐÃ HẾT HẠN LÀM!");
    const maxAtt = parseInt(q.maxAttempts) || 1; const att = q.attempts?.[uid] || 0; 
    if(att >= maxAtt) return alert("BẠN KHÔNG CÒN LƯỢT LÀM BÀI NÀY!");
    activeQuizId = id; document.getElementById('quiz-title').innerText = q.title; document.getElementById('quiz-question').innerText = q.question; document.getElementById('quiz-optA').innerText = q.optA; document.getElementById('quiz-optB').innerText = q.optB; document.getElementById('quiz-info').innerText = `Phạt: ${q.penaltyPP} PP | Lượt: ${att}/${maxAtt}`;
    const tl = parseInt(q.timeLimit) || 0;
    if(tl > 0) { let timeLeft = tl; document.getElementById('quiz-timer').innerText = `🕒 ${timeLeft}s`; if(quizTimerInterval) clearInterval(quizTimerInterval); quizTimerInterval = setInterval(() => { timeLeft--; document.getElementById('quiz-timer').innerText = `🕒 ${timeLeft}s`; if(timeLeft <= 0) { clearInterval(quizTimerInterval); window.submitQuiz('TIMEOUT'); } }, 1000); } else { document.getElementById('quiz-timer').innerText = ''; }
    document.getElementById('quiz-modal').style.display = 'flex';
};
window.submitQuiz = async opt => {
    if(quizTimerInterval) clearInterval(quizTimerInterval);
    const qS = await get(ref(db, `quests/${activeQuizId}`)); const q = qS.val(); if(!q) return window.closeQuizModal();
    const att = q.attempts?.[uid] || 0; await update(ref(db, `quests/${activeQuizId}/attempts`), { [uid]: att + 1 }); 
    const uS = await get(ref(db, `users/${uid}`)); const u = uS.val(); const currentPP = Number(u.pp) || 0;
    if (opt === 'TIMEOUT') { await update(ref(db, `users/${uid}`), { pp: Math.max(0, currentPP - q.penaltyPP) }); window.showResult("HẾT GIỜ!", `Bạn đã bị phạt ${q.penaltyPP.toLocaleString()} PP!`, false); } 
    else if(opt === q.correctOpt) { await update(ref(db, `users/${uid}`), { pp: currentPP + q.rewardPP }); window.showResult("CHÍNH XÁC!", `Bạn được cộng ${q.rewardPP.toLocaleString()} PP!`, true); } 
    else { await update(ref(db, `users/${uid}`), { pp: Math.max(0, currentPP - q.penaltyPP) }); window.showResult("SAI RỒI!", `Đã chọn sai. Bạn bị phạt ${q.penaltyPP.toLocaleString()} PP!`, false); }
    window.closeQuizModal();
};

// ==========================================
// ⚔️ NEON ARENA (PvP)
// ==========================================
window.openPvPModal = () => { document.getElementById('pvp-modal').style.display = 'flex'; };
window.closePvPModal = () => { document.getElementById('pvp-modal').style.display = 'none'; myCurrentPvPRoomId = null; };
window.pvpCreate = async () => { let bet = prompt("Nhập số PP cược Võ Đài:"); if(!bet) return; bet = parseInt(bet); if(isNaN(bet) || bet <= 0) return alert("Số cược không hợp lệ!"); const snap = await get(ref(db, `users/${uid}`)); const u = snap.val(); if((Number(u.pp)||0) < bet) return alert("Không đủ PP!"); await update(ref(db, `users/${uid}`), { pp: (Number(u.pp)||0) - bet }); await set(ref(db, `pvp_rooms/PVP_${Date.now()}`), { creator: uid, creatorName: u.name, creatorAvatar: u.avatar || 'https://i.pravatar.cc/150', bet: bet, status: 'WAITING', timestamp: Date.now() }); };
window.pvpCancel = async (roomId, bet) => { const snap = await get(ref(db, `users/${uid}`)); await update(ref(db, `users/${uid}`), { pp: (Number(snap.val().pp)||0) + bet }); await remove(ref(db, `pvp_rooms/${roomId}`)); alert("Đã hoàn trả PP."); };
window.pvpJoin = async (roomId) => { const rSnap = await get(ref(db, `pvp_rooms/${roomId}`)); const room = rSnap.val(); if(!room || room.status !== 'WAITING') return alert("Phòng không khả dụng!"); const snap = await get(ref(db, `users/${uid}`)); const u = snap.val(); if((Number(u.pp)||0) < room.bet) return alert("Không đủ PP!"); await update(ref(db, `users/${uid}`), { pp: (Number(u.pp)||0) - room.bet }); await update(ref(db, `pvp_rooms/${roomId}`), { status: 'PLAYING', joiner: uid, joinerName: u.name, joinerAvatar: u.avatar || 'https://i.pravatar.cc/150?u=enemy', p1_hp: 100, p2_hp: 100, turn: room.creator, log: `<br>💥 Trận đấu sinh tử bắt đầu!\nLượt đầu tiên: ${room.creatorName}.` }); };
window.pvpAction = async (type) => { if(!myCurrentPvPRoomId) return; const rSnap = await get(ref(db, `pvp_rooms/${myCurrentPvPRoomId}`)); const room = rSnap.val(); if(!room || room.status !== 'PLAYING' || room.turn !== uid) return; const isCreator = (uid === room.creator); let myHp = isCreator ? room.p1_hp : room.p2_hp; let enemyHp = isCreator ? room.p2_hp : room.p1_hp; const enemyUid = isCreator ? room.joiner : room.creator; const myName = isCreator ? room.creatorName : room.joinerName; const enemyName = isCreator ? room.joinerName : room.creatorName; let logAdd = ""; if (type === 'ATTACK') { const dmg = Math.floor(Math.random()*11) + 15; enemyHp -= dmg; logAdd = `<br>🗡️ <b>${myName}</b> chém thường, gây <b style="color:#ff4500;">${dmg}</b> sát thương!`; } else if (type === 'HEAVY') { if(Math.random() < 0.5) { logAdd = `<br>💨 <b>${myName}</b> tung Chí Mạng nhưng TRƯỢT!`; } else { const dmg = Math.floor(Math.random()*16) + 30; enemyHp -= dmg; logAdd = `<br>⚡ <b>${myName}</b> tung CHÍ MẠNG, gây <b style="color:var(--neon-pink);">${dmg}</b> sát thương!`; } } else if (type === 'HEAL') { const heal = Math.floor(Math.random()*16) + 20; myHp = Math.min(100, myHp + heal); logAdd = `<br>🛡️ <b>${myName}</b> uống thuốc, hồi <b style="color:var(--neon-green);">${heal}</b> máu!`; } if (enemyHp <= 0) { enemyHp = 0; logAdd += `<br><br>☠️ <b>${enemyName}</b> ĐÃ GỤC NGÃ!\n🏆 <b>${myName}</b> CHIẾN THẮNG ÁP ĐẢO!`; await update(ref(db, `pvp_rooms/${myCurrentPvPRoomId}`), { p1_hp: isCreator ? myHp : enemyHp, p2_hp: isCreator ? enemyHp : myHp, log: room.log + logAdd, status: 'ENDED', winner: uid }); } else { await update(ref(db, `pvp_rooms/${myCurrentPvPRoomId}`), { p1_hp: isCreator ? myHp : enemyHp, p2_hp: isCreator ? enemyHp : myHp, log: room.log + logAdd, turn: enemyUid }); } };
window.pvpClaimReward = async (roomId, reward) => { const snap = await get(ref(db, `users/${uid}`)); await update(ref(db, `users/${uid}`), { pp: (Number(snap.val().pp)||0) + reward }); await remove(ref(db, `pvp_rooms/${roomId}`)); window.closePvPModal(); window.showResult("ĐẠI GIA", `Hốt trọn ${reward.toLocaleString()} PP!`, true); };

// ==========================================
// ⚽ CÁ CƯỢC BÓNG ĐÁ (SIÊU PHẨM 12 CẦU THỦ)
// ==========================================
window.openFootballGame = () => { 
    document.getElementById('football-modal').style.display = 'flex'; 
    document.getElementById('fb-score').innerHTML = `<span class="fb-team-xanh">XANH 0</span> - <span class="fb-team-do">0 ĐỎ</span>`; 
    document.getElementById('fb-time').innerText = `Phút: 0'`;
    document.getElementById('fb-commentary').innerText = "Hai đội đang khởi động. Vui lòng đặt cược!"; 
    document.getElementById('fb-ball').style.left = '50%'; 
    document.getElementById('fb-ball').style.top = '50%'; 
    document.getElementById('fb-bet').value = ''; 
    document.getElementById('fb-bet').disabled = false; 
    document.getElementById('fb-actions').style.display = 'flex'; 
    
    const resetPos = {
        'p-xanh-gk': [5, 50], 'p-xanh-1': [20, 25], 'p-xanh-2': [20, 75], 'p-xanh-3': [40, 30], 'p-xanh-4': [40, 70], 'p-xanh-5': [50, 50],
        'p-do-gk': [95, 50], 'p-do-1': [80, 25], 'p-do-2': [80, 75], 'p-do-3': [60, 30], 'p-do-4': [60, 70], 'p-do-5': [50, 50]
    };
    for(let id in resetPos) {
        const el = document.getElementById(id);
        if(el) { el.style.left = resetPos[id][0]+'%'; el.style.top = resetPos[id][1]+'%'; }
    }
};

window.closeFootballGame = () => { document.getElementById('football-modal').style.display = 'none'; };

window.startFootballMatch = async (choice) => {
    const bet = parseInt(document.getElementById('fb-bet').value); if(isNaN(bet) || bet <= 0) return window.showResult("LỖI", "Số cược không hợp lệ!", false);
    const snap = await get(ref(db, `users/${uid}`)); const currentPP = Number(snap.val().pp) || 0; if(currentPP < bet) return window.showResult("NGHÈO", "Bạn không đủ PP!", false);
    
    await update(ref(db, `users/${uid}`), { pp: currentPP - bet }); fbBet = bet; fbChoice = choice;
    document.getElementById('fb-bet').disabled = true; document.getElementById('fb-actions').style.display = 'none';
    
    let time = 0; let scoreXanh = 0; let scoreDo = 0; 
    const ball = document.getElementById('fb-ball'); const commentary = document.getElementById('fb-commentary');
    
    const players = [
        { id: 'p-xanh-gk', team: 'XANH', role: 'gk', base: [5, 50], name: 'Thủ môn Xanh' },
        { id: 'p-xanh-1', team: 'XANH', role: 'def', base: [20, 25], name: 'Hậu vệ trái Xanh' },
        { id: 'p-xanh-2', team: 'XANH', role: 'def', base: [20, 75], name: 'Hậu vệ phải Xanh' },
        { id: 'p-xanh-3', team: 'XANH', role: 'mid', base: [40, 30], name: 'Tiền vệ trái Xanh' },
        { id: 'p-xanh-4', team: 'XANH', role: 'mid', base: [40, 70], name: 'Tiền vệ phải Xanh' },
        { id: 'p-xanh-5', team: 'XANH', role: 'att', base: [50, 50], name: 'Tiền đạo Xanh' },

        { id: 'p-do-gk', team: 'DO', role: 'gk', base: [95, 50], name: 'Thủ môn Đỏ' },
        { id: 'p-do-1', team: 'DO', role: 'def', base: [80, 25], name: 'Hậu vệ trái Đỏ' },
        { id: 'p-do-2', team: 'DO', role: 'def', base: [80, 75], name: 'Hậu vệ phải Đỏ' },
        { id: 'p-do-3', team: 'DO', role: 'mid', base: [60, 30], name: 'Tiền vệ trái Đỏ' },
        { id: 'p-do-4', team: 'DO', role: 'mid', base: [60, 70], name: 'Tiền vệ phải Đỏ' },
        { id: 'p-do-5', team: 'DO', role: 'att', base: [50, 50], name: 'Tiền đạo Đỏ' }
    ];

    let ballCarrier = players.find(p => p.id === 'p-xanh-5');
    let isGoalAnim = false;

    const matchInterval = setInterval(() => {
        if(isGoalAnim) return; 
        time++; document.getElementById('fb-time').innerText = `Phút: ${time}'`;

        let bX = parseFloat(ball.style.left); let bY = parseFloat(ball.style.top);

        players.forEach(p => {
            const el = document.getElementById(p.id);
            if(p.role === 'gk') {
                el.style.top = (40 + Math.random()*20) + '%';
            } else {
                if(p === ballCarrier) {
                    let targetX = p.team === 'XANH' ? bX + 15 : bX - 15;
                    let targetY = bY + (Math.random()*20 - 10);
                    targetX = Math.max(10, Math.min(90, targetX)); targetY = Math.max(10, Math.min(90, targetY));
                    el.style.left = targetX + '%'; el.style.top = targetY + '%';
                } else {
                    let range = 15;
                    let targetX = p.base[0] + (Math.random()*range*2 - range);
                    let targetY = p.base[1] + (Math.random()*range*2 - range);
                    
                    if(p.team === ballCarrier.team && p.role === 'att') { targetX = p.team === 'XANH' ? targetX + 15 : targetX - 15; }
                    if(p.team !== ballCarrier.team && Math.random() < 0.6) { targetX = (targetX + bX) / 2; targetY = (targetY + bY) / 2; }

                    targetX = Math.max(5, Math.min(95, targetX)); targetY = Math.max(5, Math.min(95, targetY));
                    el.style.left = targetX + '%'; el.style.top = targetY + '%';
                }
            }
        });

        const action = Math.random();
        if (action < 0.2) { 
            const isGoal = Math.random() < 0.3; 
            isGoalAnim = true;
            if(isGoal) {
                if(ballCarrier.team === 'XANH') {
                    scoreXanh++; ball.style.left = '98%'; ball.style.top = '50%';
                    commentary.innerHTML = `<span class="text-blue">VÀOOOO!!! Siêu phẩm của ${ballCarrier.name}!</span>`;
                } else {
                    scoreDo++; ball.style.left = '2%'; ball.style.top = '50%';
                    commentary.innerHTML = `<span class="text-red">VÀOOOO!!! Đội ĐỎ mở tỉ số do công của ${ballCarrier.name}!</span>`;
                }
                document.getElementById('fb-score').innerHTML = `<span class="fb-team-xanh">XANH ${scoreXanh}</span> - <span class="fb-team-do">${scoreDo} ĐỎ</span>`;

                setTimeout(() => {
                    isGoalAnim = false;
                    ballCarrier = players.find(p => p.role === 'att' && p.team !== ballCarrier.team);
                    ball.style.left = '50%'; ball.style.top = '50%';
                }, 2000);
            } else {
                if(ballCarrier.team === 'XANH') { ball.style.left = '95%'; ball.style.top = (Math.random() < 0.5 ? '20%' : '80%'); }
                else { ball.style.left = '5%'; ball.style.top = (Math.random() < 0.5 ? '20%' : '80%'); }
                commentary.innerText = `Không vào! Thủ môn đã cản phá cú sút của ${ballCarrier.name}!`;
                setTimeout(() => { isGoalAnim = false; ballCarrier = players.find(p => p.role === 'gk' && p.team !== ballCarrier.team); }, 1000);
            }
        } else if (action < 0.5) { 
            const teammates = players.filter(p => p.team === ballCarrier.team && p.role !== 'gk' && p !== ballCarrier);
            ballCarrier = teammates[Math.floor(Math.random() * teammates.length)];
            commentary.innerText = `Đường chuyền dài vượt tuyến cực đẹp!`;
        } else if (action < 0.8) { 
            const enemies = players.filter(p => p.team !== ballCarrier.team && p.role !== 'gk');
            ballCarrier = enemies[Math.floor(Math.random() * enemies.length)];
            commentary.innerText = `Bóng đã bị ${ballCarrier.name} cướp được! Phản công nhanh!`;
        } else { 
            commentary.innerText = `${ballCarrier.name} đang dùng kỹ thuật rê bóng lắt léo!`;
        }

        if(!isGoalAnim) {
            ball.style.left = document.getElementById(ballCarrier.id).style.left;
            ball.style.top = document.getElementById(ballCarrier.id).style.top;
        }

        if(time >= 60) {
            clearInterval(matchInterval);
            ball.style.left = '50%'; ball.style.top = '50%';
            commentary.innerText = "HẾT GIỜ! Trọng tài đã thổi còi mãn cuộc.";
            
            setTimeout(async () => {
                window.closeFootballGame();
                const fSnap = await get(ref(db, `users/${uid}`)); const fPP = Number(fSnap.val().pp) || 0;
                let winTeam = 'DRAW'; if(scoreXanh > scoreDo) winTeam = 'XANH'; if(scoreDo > scoreXanh) winTeam = 'DO';

                if(winTeam === 'DRAW') {
                    await update(ref(db, `users/${uid}`), { pp: fPP + fbBet }); window.showResult("HÒA NHAU", `Tỉ số chung cuộc: Xanh ${scoreXanh} - ${scoreDo} Đỏ.\nBạn được hoàn lại tiền cược.`, true);
                } else if(fbChoice === winTeam) {
                    await update(ref(db, `users/${uid}`), { pp: fPP + (fbBet*2) }); window.showResult("THẮNG CƯỢC", `Tỉ số: Xanh ${scoreXanh} - ${scoreDo} Đỏ.\nĐội bạn chọn đã THẮNG! Ăn ${(fbBet*2).toLocaleString()} PP.`, true);
                } else {
                    window.showResult("THUA CƯỢC", `Tỉ số: Xanh ${scoreXanh} - ${scoreDo} Đỏ.\nĐội bạn chọn đã thua. Mất ${fbBet.toLocaleString()} PP.`, false);
                }
            }, 1500);
        }

    }, 1000); 
};

// ==========================================
// 💰 GOLD MARKET REALTIME (VIP PRO)
// ==========================================
let currentGoldPrice = 50000000;
let goldChartObj = null;
window.currentGoldSellPrice = 49900000;

function startGoldMarketLoop() {
    setInterval(async () => {
        const snap = await get(ref(db, 'market/gold'));
        let market = snap.val();
        if (!market || !market.price) {
            market = { price: 50000000, oldPrice: 50000000, high24h: 50000000, low24h: 50000000, volumeBuy: 0, volumeSell: 0, history: Array(20).fill(50000000), lastUpdate: 0 };
        }
        
        const now = Date.now();
        if (now - market.lastUpdate > 60000) {
            let oldPrice = market.price;
            let changePct = 0;
            const rand = Math.random();
            
            if(rand < 0.05) changePct = (Math.random() * 0.04) + 0.02; // PUMP
            else if(rand < 0.10) changePct = -((Math.random() * 0.04) + 0.02); // CRASH
            else if(rand < 0.30) changePct = (Math.random() * 0.016) - 0.008; // Dao động mạnh
            else changePct = (Math.random() * 0.004) - 0.002; // Sideway nhẹ
            
            let newPrice = Math.floor(oldPrice * (1 + changePct));
            if(newPrice < 1000000) newPrice = 1000000;
            
            let history = market.history || Array(20).fill(oldPrice);
            history.push(newPrice);
            if(history.length > 20) history.shift();
            
            let high24h = Math.max(market.high24h || newPrice, newPrice);
            let low24h = Math.min(market.low24h || newPrice, newPrice);
            
            await update(ref(db, 'market/gold'), { 
                price: newPrice, 
                oldPrice: oldPrice, 
                high24h: high24h,
                low24h: low24h,
                lastUpdate: now, 
                history: history,
                updateTimeString: new Date().toLocaleTimeString('vi-VN')
            });
        }
    }, 5000); 
}

function listenGoldMarket() {
    onValue(ref(db, 'market/gold'), async (snap) => {
        const market = snap.val();
        if (!market) return;
        
        currentGoldPrice = market.price;
        const sellPrice = Math.floor(market.price * 0.995); // Lệch 0.5%
        window.currentGoldSellPrice = sellPrice;
        
        const change = market.price - (market.oldPrice || market.price);
        const isUp = change >= 0;
        const changePct = ((change / (market.oldPrice || market.price)) * 100).toFixed(2);
        
        const priceEl = document.getElementById('gold-current-price');
        if(priceEl) {
            priceEl.innerHTML = `MUA: ${market.price.toLocaleString()} <span style="font-size:16px;color:#aaa">PP</span> <br><span style="font-size:24px;color:var(--neon-red)">BÁN: ${sellPrice.toLocaleString()} PP</span>`;
            
            const changeStr = (isUp ? '↑ +' : '↓ ') + change.toLocaleString() + ` (${isUp?'+':''}${Math.abs(changePct)}%)`;
            document.getElementById('gold-price-change').innerText = changeStr;
            document.getElementById('gold-price-change').style.color = isUp ? 'var(--neon-green)' : 'var(--neon-red)';
            
            document.getElementById('gold-time-update').innerText = `⏱ Cập nhật: ${market.updateTimeString || '--:--:--'} (Chu kỳ 60s)`;
            
            const statusEl = document.getElementById('gold-market-status');
            if(statusEl) {
                statusEl.innerHTML = isUp ? 'MARKET: BULLISH 🟢' : 'MARKET: BEARISH 🔴';
                statusEl.style.color = isUp ? 'var(--neon-green)' : 'var(--neon-red)';
            }
            
            document.getElementById('gold-high').innerText = (market.high24h || market.price).toLocaleString();
            document.getElementById('gold-low').innerText = (market.low24h || market.price).toLocaleString();
            document.getElementById('gold-vol-buy').innerText = (market.volumeBuy || 0).toLocaleString();
            document.getElementById('gold-vol-sell').innerText = (market.volumeSell || 0).toLocaleString();
            
            renderGoldChart(market.history || [], isUp ? '#00ff80' : '#ff003c');
        }

        const uSnap = await get(ref(db, `users/${uid}`));
        const u = uSnap.val();
        if(u) updateMyGoldUI(u);
    });

    onValue(ref(db, 'online'), snap => {
        const onlines = snap.val() || {};
        const count = Object.keys(onlines).length;
        if(document.getElementById('online-count-badge')) {
            document.getElementById('online-count-badge').innerHTML = `🟢 Online: ${count} người`;
        }
    });

    onValue(ref(db, 'users'), snap => {
        const users = snap.val() || {};
        let traders = [];
        for(let k in users) {
            if(users[k].gold_stats && users[k].gold_stats.totalProfit) {
                traders.push({ name: users[k].name, profit: users[k].gold_stats.totalProfit });
            }
        }
        traders.sort((a,b) => b.profit - a.profit);
        let html = '';
        traders.slice(0,10).forEach(t => {
            const clss = t.profit >= 0 ? 'text-green' : 'text-red';
            html += `<tr><td>${t.name}</td><td class="${clss}">${t.profit > 0 ? '+':''}${t.profit.toLocaleString()}</td></tr>`;
        });
        if(document.getElementById('top-gold-traders')) {
            document.getElementById('top-gold-traders').innerHTML = html || `<tr><td colspan="2" style="text-align:center; color:#888;">Chưa có dữ liệu</td></tr>`;
        }
    });
}

window.goldChangeTimeframe = (tf) => {
    ['1m','5m','15m','ALL'].forEach(t => {
        const b = document.getElementById(`gold-tf-${t}`);
        if(b) { b.style.color = (t===tf) ? '#fff' : '#555'; b.style.borderColor = (t===tf) ? 'var(--neon-gold)' : '#333'; }
    });
};

function renderGoldChart(history, color) {
    const canvas = document.getElementById('goldRealtimeChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(goldChartObj) {
        goldChartObj.data.labels = Array(history.length).fill('');
        goldChartObj.data.datasets[0].data = history;
        goldChartObj.data.datasets[0].borderColor = color;
        goldChartObj.update();
    } else {
        goldChartObj = new Chart(ctx, {
            type: 'line',
            data: { labels: Array(history.length).fill(''), datasets: [{ label: 'Gold Price', data: history, borderColor: color, borderWidth: 2, tension: 0.2, pointRadius: 0 }] },
            options: { animation: false, scales: { x: { display: false }, y: { position: 'right', grid: { color: '#222' } } }, plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });
    }
}

function updateMyGoldUI(u) {
    if(!document.getElementById('gold-my-amount')) return;
    if (u.gold && u.gold.amount > 0) {
        document.getElementById('gold-my-amount').innerText = u.gold.amount.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4}) + ' GOLD';
        document.getElementById('gold-my-avg').innerText = Math.floor(u.gold.avgPrice).toLocaleString() + ' PP';
        
        const currentVal = u.gold.amount * window.currentGoldSellPrice;
        const invested = u.gold.amount * u.gold.avgPrice;
        const pnl = Math.floor(currentVal - invested);
        const pnlPct = (pnl / invested) * 100;
        
        const pnlEl = document.getElementById('gold-my-pnL');
        pnlEl.innerText = (pnl >= 0 ? '+' : '') + pnl.toLocaleString() + ` PP (${pnlPct >= 0 ? '+' : ''}${Math.abs(pnlPct).toFixed(2)}%)`;
        pnlEl.style.color = pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
        pnlEl.style.textShadow = pnl >= 0 ? '0 0 10px var(--neon-green)' : '0 0 10px var(--neon-red)';
    } else {
        document.getElementById('gold-my-amount').innerText = '0.0000 GOLD';
        document.getElementById('gold-my-avg').innerText = '0 PP';
        document.getElementById('gold-my-pnL').innerText = '0 PP';
        document.getElementById('gold-my-pnL').style.color = '#fff';
        document.getElementById('gold-my-pnL').style.textShadow = 'none';
    }
}

window.buyGold = async () => {
    const goldAmtStr = document.getElementById('gold-buy-amount').value;
    const goldAmt = parseFloat(goldAmtStr);
    if (isNaN(goldAmt) || goldAmt <= 0) return window.showResult("LỖI", "Số lượng Vàng không hợp lệ!", false);
    
    const uSnap = await get(ref(db, `users/${uid}`));
    const u = uSnap.val();
    const currentPP = Number(u.pp) || 0;
    
    const ppRequired = Math.floor(goldAmt * currentGoldPrice);
    if (currentPP < ppRequired) return window.showResult("NGHÈO", `Bạn cần ${ppRequired.toLocaleString()} PP để mua ${goldAmt} GOLD!`, false);

    const mSnap = await get(ref(db, 'market/gold'));
    const market = mSnap.val();
    if(!market) return;

    const currentMyGold = u.gold || { amount: 0, avgPrice: 0 };
    const totalValueBefore = currentMyGold.amount * currentMyGold.avgPrice;
    const totalValueAfter = totalValueBefore + ppRequired;
    const newAmount = currentMyGold.amount + goldAmt;
    const newAvgPrice = totalValueAfter / newAmount;

    await update(ref(db, `users/${uid}`), { pp: currentPP - ppRequired, gold: { amount: newAmount, avgPrice: newAvgPrice } });
    
    await update(ref(db, 'market/gold'), { volumeBuy: (market.volumeBuy || 0) + ppRequired });

    document.getElementById('gold-buy-amount').value = '';
    window.showResult("MUA VÀNG", `Đã mua thành công ${goldAmt.toLocaleString(undefined, {maximumFractionDigits: 4})} GOLD\nTổng chi phí: ${ppRequired.toLocaleString()} PP\nGiá mua: ${currentGoldPrice.toLocaleString()} PP/GOLD`, true);
};

window.sellGold = async () => {
    const goldAmtStr = document.getElementById('gold-sell-amount').value;
    const goldAmt = parseFloat(goldAmtStr);
    if (isNaN(goldAmt) || goldAmt <= 0) return window.showResult("LỖI", "Số lượng Vàng không hợp lệ!", false);

    const uSnap = await get(ref(db, `users/${uid}`));
    const u = uSnap.val();
    
    if (!u.gold || u.gold.amount < goldAmt) {
        window.showResult("LỖI", `Bạn chỉ đang giữ ${u.gold ? u.gold.amount.toLocaleString(undefined, {maximumFractionDigits: 4}) : 0} GOLD!`, false);
        return;
    }

    const sellValue = Math.floor(goldAmt * window.currentGoldSellPrice);
    const profit = sellValue - Math.floor(goldAmt * u.gold.avgPrice);
    const currentPP = Number(u.pp) || 0;

    const newAmount = u.gold.amount - goldAmt;
    
    if (newAmount > 0.000001) {
        await update(ref(db, `users/${uid}`), { pp: currentPP + sellValue, gold: { amount: newAmount, avgPrice: u.gold.avgPrice } });
    } else {
        await update(ref(db, `users/${uid}`), { pp: currentPP + sellValue });
        await remove(ref(db, `users/${uid}/gold`));
    }

    const currentTotalProfit = (u.gold_stats && u.gold_stats.totalProfit) ? u.gold_stats.totalProfit : 0;
    await update(ref(db, `users/${uid}/gold_stats`), { totalProfit: currentTotalProfit + profit });

    const mSnap = await get(ref(db, 'market/gold'));
    await update(ref(db, 'market/gold'), { volumeSell: (mSnap.val().volumeSell || 0) + sellValue });

    document.getElementById('gold-sell-amount').value = '';
    const msg = `BÁN RA: ${goldAmt.toLocaleString(undefined, {maximumFractionDigits: 4})} GOLD\nThu về: ${sellValue.toLocaleString()} PP\nLãi/Lỗ: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()} PP!`;
    window.showResult("BÁN VÀNG", msg, profit >= 0);
};

window.fillAllGold = async () => {
    const uSnap = await get(ref(db, `users/${uid}`));
    const u = uSnap.val();
    if (u && u.gold && u.gold.amount > 0) {
        document.getElementById('gold-sell-amount').value = u.gold.amount;
    } else {
        alert("Bạn không có Vàng để bán!");
    }
};

// ==========================================
// 🚀 TRADING CRYPTO LIVE (GIỮ NGUYÊN)
// ==========================================
let cryptoInterval; let isCryptoTrading = false; let cMult = 1.00; let cCrash = 1.00; let cBet = 0;
let cryptoData = []; let chartX = 0;
window.openCryptoGame = () => { if(isCryptoTrading) return; document.getElementById('crypto-modal').style.display = 'flex'; resetCryptoUI(); };
window.closeCryptoGame = () => { if(isCryptoTrading) return alert("Đang gồng lãi, không thể thoát!"); document.getElementById('crypto-modal').style.display = 'none'; };
function resetCryptoUI() {
    document.getElementById('crypto-multiplier').innerText = 'x1.00'; document.getElementById('crypto-multiplier').style.color = 'var(--neon-gold)';
    document.getElementById('crypto-rugpull').style.display = 'none';
    const btn = document.getElementById('crypto-action-btn'); btn.innerText = '[ 🚀 MUA VÀO & GỒNG LÃI ]'; btn.onclick = window.startCryptoLive; btn.style.borderColor = 'var(--neon-gold)'; btn.style.color = 'var(--neon-gold)';
    document.getElementById('crypto-bet').disabled = false; document.getElementById('crypto-bet').value = '';
    const canvas = document.getElementById('cryptoCanvas'); const ctx = canvas.getContext('2d'); ctx.clearRect(0,0, canvas.width, canvas.height);
}
window.startCryptoLive = async () => {
    if(isCryptoTrading) return; const bet = parseInt(document.getElementById('crypto-bet').value); if(isNaN(bet) || bet <= 0) return window.showResult("LỖI", "Số cược không hợp lệ!", false);
    const snap = await get(ref(db, `users/${uid}`)); const currentPP = Number(snap.val().pp) || 0; if(currentPP < bet) return window.showResult("NGHÈO", "Bạn không đủ vốn!", false);
    await update(ref(db, `users/${uid}`), { pp: currentPP - bet }); cBet = bet; isCryptoTrading = true;
    
    const e = 100 / (Math.random() * 100); cCrash = parseFloat(Math.max(1.00, Math.min(100.00, e)).toFixed(2)); if(Math.random() < 0.08) cCrash = 1.00;
    
    document.getElementById('crypto-bet').disabled = true; const btn = document.getElementById('crypto-action-btn'); btn.innerText = '[ 💰 CHỐT LỜI NGAY! ]'; btn.style.borderColor = 'var(--neon-green)'; btn.style.color = 'var(--neon-green)'; btn.onclick = window.cashOutCrypto;
    cMult = 1.00; cryptoData = [{x: 0, y: 300}]; chartX = 0; let speed = 0.003;
    const canvas = document.getElementById('cryptoCanvas'); const ctx = canvas.getContext('2d');
    
    cryptoInterval = setInterval(() => {
        cMult += speed; speed += 0.0002;
        let visualMult = cMult + (Math.random() * 0.05 - 0.02);
        document.getElementById('crypto-multiplier').innerText = `x${Math.max(1.00, visualMult).toFixed(2)}`;
        
        chartX += 3; let chartY = 300 - ((cMult - 1) * 30); if(chartY < 20) chartY = 20 + Math.random()*10;
        cryptoData.push({x: chartX, y: chartY});
        
        ctx.clearRect(0,0, canvas.width, canvas.height);
        ctx.beginPath(); ctx.moveTo(cryptoData[0].x, cryptoData[0].y);
        ctx.strokeStyle = '#00ff80'; ctx.lineWidth = 3; ctx.shadowBlur = 10; ctx.shadowColor = '#00ff80';
        for(let i=1; i<cryptoData.length; i++) { ctx.lineTo(cryptoData[i].x, cryptoData[i].y); }
        ctx.stroke();
        
        if(chartX >= 660) cryptoData.shift();

        if(cMult >= cCrash) {
            clearInterval(cryptoInterval); isCryptoTrading = false;
            document.getElementById('crypto-multiplier').style.color = 'var(--neon-red)'; document.getElementById('crypto-rugpull').style.display = 'block';
            const btn = document.getElementById('crypto-action-btn'); btn.innerText = 'CHÁY TÀI KHOẢN!'; btn.onclick = null; btn.style.borderColor = 'var(--neon-red)'; btn.style.color = 'var(--neon-red)';
            ctx.lineTo(chartX, 300); ctx.strokeStyle = 'red'; ctx.shadowColor = 'red'; ctx.stroke();
            setTimeout(() => { window.showResult("RUG PULL!", `Sàn đã úp sọt ở x${cCrash.toFixed(2)}.\nMất trắng ${cBet.toLocaleString()} PP!`, false); resetCryptoUI(); }, 1500);
        }
    }, 40);
};
window.cashOutCrypto = async () => {
    if(!isCryptoTrading) return; clearInterval(cryptoInterval); isCryptoTrading = false;
    const winAmount = Math.floor(cBet * cMult); const snap = await get(ref(db, `users/${uid}`)); const currentPP = Number(snap.val().pp) || 0; await update(ref(db, `users/${uid}`), { pp: currentPP + winAmount });
    document.getElementById('crypto-multiplier').style.color = 'var(--neon-gold)'; const btn = document.getElementById('crypto-action-btn'); btn.innerText = 'ĐÃ CHỐT LỜI X' + cMult.toFixed(2); btn.onclick = null; btn.style.borderColor = '#555'; btn.style.color = '#555';
    setTimeout(() => { window.showResult("CHỐT LỜI", `Xả hàng an toàn tại x${cMult.toFixed(2)}.\nĂn ${(winAmount).toLocaleString()} PP!`, true); resetCryptoUI(); }, 1000);
};

// ==========================================
// 🎲 MINIGAMES CƠ BẢN
// ==========================================
async function executeBet(gameName, logicCallback) {
    let bet = prompt(`[ ${gameName} ]\nNhập số PP bạn muốn đặt cược:`); if(!bet) return; bet = parseInt(bet); if(isNaN(bet) || bet <= 0) return window.showResult("LỖI", "Số cược không hợp lệ!", false);
    const snap = await get(ref(db, `users/${uid}`)); const u = snap.val(); const currentPP = Number(u.pp) || 0;
    if(currentPP < bet) return window.showResult("NGHÈO", `Bạn chỉ có ${currentPP.toLocaleString()} PP. Không đủ cược!`, false);
    const res = await logicCallback(bet, currentPP); if(res === null) return; 
    const { payout, message, title, isWin } = res;
    const modal = document.getElementById('result-modal'); const t = document.getElementById('result-title'); const msg = document.getElementById('result-msg'); const icon = document.getElementById('result-icon'); const btn = document.getElementById('result-close-btn');
    t.innerText = "ĐANG XỬ LÝ..."; t.className = "text-blue glow-pulse"; msg.innerHTML = ""; icon.className = "fas fa-spinner fa-spin fa-3x text-blue"; btn.style.display = 'none'; modal.style.display = 'flex';
    setTimeout(async () => { const freshSnap = await get(ref(db, `users/${uid}`)); const freshPP = Number(freshSnap.val().pp) || 0; await update(ref(db, `users/${uid}`), { pp: freshPP + payout }); t.innerText = title; t.className = isWin ? 'text-gold glow-pulse' : 'text-red glow-pulse'; msg.innerHTML = `${message}<br><br>=> PP HIỆN TẠI: ${(freshPP + payout).toLocaleString()}`; icon.className = isWin ? "fas fa-trophy fa-3x text-gold" : "fas fa-skull fa-3x text-red"; btn.style.display = 'block'; }, 1500); 
}

window.rollGacha = async () => { const snap = await get(ref(db, `users/${uid}`)); const c = Number(snap.val().pp) || 0; if(c < 5000) return window.showResult("NGHÈO", "Bạn không đủ 5,000 PP!", false); const r = Math.random()*100; let n = c - 5000, m = "Trắng tay... Bạn mất 5,000 PP 💀", t = "BAY MÀU", win = false; if(r > 98) { n += 50000; m = "Trúng 50,000 PP 🎉"; t = "JACKPOT!!!"; win = true; } else if(r > 88) { n += 10000; m = "Lời 10,000 PP 💵"; t = "X2 TÀI SẢN"; win = true; } await update(ref(db, `users/${uid}`), { pp: n }); window.showResult(t, m, win); };
window.playClawMachine = () => executeBet("GẮP GẤU BÔNG", async (bet) => { const r = Math.random(); if(r < 0.05) return { payout: bet * 10, message: `Trời ơi!!! Bạn gắp được 🦄 KỲ LÂN NGÂN HÀ!\nThắng ${(bet*10).toLocaleString()} PP!`, title: "BÀN TAY VÀNG", isWin: true }; if(r < 0.35) return { payout: bet * 2, message: `Tuyệt vời! Gắp được 🐻 Gấu Teddy!\nThắng ${(bet*2).toLocaleString()} PP!`, title: "GẮP THÀNH CÔNG", isWin: true }; return { payout: -bet, message: `Tuột càng mất rồi!\nBạn mất ${bet.toLocaleString()} PP!`, title: "TUỘT CÀNG", isWin: false }; });
window.playTarot = () => executeBet("BÓI TAROT", async (bet) => { let choice = prompt("Có 3 lá bài đang úp (1, 2, 3).\nBạn chọn lật lá bài số mấy?"); if(!['1','2','3'].includes(choice)) return null; const cards = [ { name: "THE SUN ☀️", mult: 5, msg: "Tài lộc dồi dào!" }, { name: "THE LOVERS 💕", mult: 2, msg: "May mắn nhân đôi!" }, { name: "THE TOWER 🌩️", mult: 0, msg: "Tiền tài tiêu tán!" }, { name: "DEATH 💀", mult: 0, msg: "Mất sạch tiền cược!" }, { name: "WHEEL OF FORTUNE 🎡", mult: 1.5, msg: "Sinh lời vừa phải." } ]; const drawn = cards[Math.floor(Math.random() * cards.length)]; const profit = Math.floor(bet * drawn.mult) - bet; if (profit >= 0) return { payout: profit, message: `Lật trúng lá ${drawn.name}\nNhận được ${(profit + bet).toLocaleString()} PP!`, title: "THÔNG ĐIỆP", isWin: true }; return { payout: profit, message: `Lật trúng lá ${drawn.name}\nMất ${bet.toLocaleString()} PP!`, title: "VẬN ĐEN", isWin: false }; });
window.playSquidGame = () => executeBet("CẦU KÍNH SQUID GAME", async (bet) => { let step = 1; while(step <= 5) { let choice = prompt(`🌉 BƯỚC ${step}/5:\nChọn T (Trái) hoặc P (Phải):`); if(!choice) return { payout: -bet, message: `Bỏ cuộc giữa chừng. Mất ${bet.toLocaleString()} PP!`, title: "CHẾT NHÁT", isWin: false }; choice = choice.toUpperCase(); if(choice !== 'T' && choice !== 'P') { alert("Nhập T hoặc P."); continue; } if (Math.random() < 0.40) { alert(`Bước ${step} AN TOÀN!`); step++; } else return { payout: -bet, message: `RẮC... XOẢNG!!! 🩸\nRơi vực ở bước ${step}. Mất ${bet.toLocaleString()} PP!`, title: "RƠI VỰC", isWin: false }; } return { payout: bet * 20, message: `VƯỢT QUA THÀNH CÔNG!!!\nThắng ${(bet*20).toLocaleString()} PP!`, title: "SỐNG SÓT", isWin: true }; });
window.playBossRaid = () => executeBet("SĂN BOSS VỰC", async (bet) => { let playerHp = bet * 3, bossHp = bet * 5; alert(`🗡️ Bạn mua vũ khí giá ${bet.toLocaleString()} PP!`); while (playerHp > 0 && bossHp > 0) { const action = confirm(`🔥 MÁU BOSS: ${bossHp}\n🛡️ MÁU BẠN: ${playerHp}\n\n[OK] = CHÉM\n[CANCEL] = CHẠY (Giữ nửa tiền)`); if (!action) return { payout: -Math.floor(bet/2), message: `Bỏ chạy. Mất ${(Math.floor(bet/2)).toLocaleString()} PP.`, title: "BỎ CHẠY", isWin: false }; const pDmg = Math.floor(bet * (Math.random() + 0.4)), bDmg = Math.floor(bet * (Math.random() + 0.7)); bossHp -= pDmg; if(bossHp <= 0) break; playerHp -= bDmg; alert(`💥 Chém Boss: ${pDmg}\n🩸 Boss tát: ${bDmg}`); } if (playerHp <= 0) return { payout: -bet, message: `WAASTED... BẠN ĐÃ TỬ TRẬN!\nMất ${bet.toLocaleString()} PP.`, title: "TỬ TRẬN", isWin: false }; return { payout: bet * 3, message: `BOSS ĐÃ BỊ TIÊU DIỆT!!! 🏆\nNhận ${(bet*3).toLocaleString()} PP!`, title: "DIỆT MA VƯƠNG", isWin: true }; });
window.playMinesweeper = () => executeBet("MÁY DÒ MÌN", async (bet) => { let guess = prompt(`Nhập 3 ô (từ 1-10) AN TOÀN. VD: 2, 5, 9`); if(!guess) return null; let pCells = guess.split(',').map(s => parseInt(s.trim())); if(pCells.length !== 3 || pCells.some(n => isNaN(n) || n<1 || n>10)) { alert("Lỗi!"); return null; } let mines = []; while(mines.length < 4) { let m = Math.floor(Math.random()*10)+1; if(!mines.includes(m)) mines.push(m); } let hitMines = pCells.filter(c => mines.includes(c)); if (hitMines.length > 0) return { payout: -bet, message: `BÙMMM!!! 💥\nMìn: [ ${mines.join(', ')} ]\nBạn đạp trúng ô ${hitMines[0]}! Mất ${bet.toLocaleString()} PP!`, title: "ĐẠP MÌN", isWin: false }; return { payout: bet * 5, message: `AN TOÀN!!!\nMìn: [ ${mines.join(', ')} ]\nNhận ${(bet*5).toLocaleString()} PP!`, title: "CHUYÊN GIA", isWin: true }; });
window.playAuction = () => executeBet("ĐẤU GIÁ RƯƠNG", async (bet) => { const realValue = Math.floor(Math.random() * 99000) + 1000; const botThreshold = Math.floor(realValue * (Math.random() * 0.9 + 0.4)); let bid = prompt(`Nhập giá PP muốn mua (Rương 1k-100k):`); if(!bid) return null; bid = parseInt(bid); if(isNaN(bid) || bid <= 0) return null; if (bid < botThreshold) return { payout: 0, message: `Giá ${bid.toLocaleString()} quá rẻ. Hệ thống không bán!\n(Rương chứa ${realValue.toLocaleString()} PP).`, title: "KHÔNG KHỚP LỆNH", isWin: true }; const netProfit = realValue - bid; if (netProfit >= 0) return { payout: netProfit, message: `Mua giá ${bid.toLocaleString()} PP.\nMở ra: ${realValue.toLocaleString()} PP!\nLỜI ${netProfit.toLocaleString()} PP!`, title: "ĐỒ CỔ THẬT", isWin: true }; return { payout: netProfit, message: `Mua giá ${bid.toLocaleString()} PP.\nMở ra: ${realValue.toLocaleString()} PP!\nBỊ HỚ mất ${(netProfit * -1).toLocaleString()} PP!`, title: "BỊ LỪA", isWin: false }; });
window.playSlot = () => executeBet("SLOT", (b) => { const s=['🍒','🍋','🔔','💎','🍉','💀','💩','🎱']; const r1=s[Math.floor(Math.random()*8)], r2=s[Math.floor(Math.random()*8)], r3=s[Math.floor(Math.random()*8)], res=`[ ${r1} | ${r2} | ${r3} ]`; if(r1===r2&&r2===r3) return {payout:b*10, message:`${res}\nNỔ HŨ X10! Trúng ${(b*10).toLocaleString()} PP!`, title:"JACKPOT", isWin:true}; if(r1===r2||r2===r3||r1===r3) return {payout:b, message:`${res}\nTRÚNG CẶP! X2 Tài sản!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`${res}\nTRẬT LẤT! Mất ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playCocktail = () => executeBet("COCKTAIL ĐỘC", (b) => { const p = Math.floor(Math.random()*6); if(p===0 || p===1) return {payout:-b, message:`LY CÓ ĐỘC! (Tỉ lệ chết 33%)\nMất sạch ${b.toLocaleString()} PP!`, title:"TỬ VONG", isWin:false}; return {payout:Math.floor(b*0.2), message:`An toàn! Lời ${(Math.floor(b*0.2)).toLocaleString()} PP!`, title:"NGON MIỆNG", isWin:true}; });
window.playDarts = () => executeBet("PHI TIÊU", (b) => { const s = Math.floor(Math.random()*100)+1; if(s>96) return {payout:b*4, message:`Hồng tâm (${s}đ)! Trúng ${(b*4).toLocaleString()} PP!`, title:"XUẤT THẦN", isWin:true}; if(s>60) return {payout:b, message:`Trúng bảng (${s}đ)! X2 tiền!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Phóng trượt (${s}đ)! Mất ${b.toLocaleString()} PP!`, title:"TRƯỢT", isWin:false}; });
window.playBaccarat = (c) => executeBet("BACCARAT", (b) => { const p=Math.floor(Math.random()*10), k=Math.floor(Math.random()*10), win=p>k?'PLAYER':(k>p?'BANKER':'TIE'); if(win==='TIE') return {payout:-(Math.floor(b*0.1)), message:`Con: ${p} | Cái: ${k}\nHÒA NHAU! Nhà cái thu 10% phế.`, title:"HÒA", isWin:false}; if(c===win) return {payout:b, message:`Con: ${p} | Cái: ${k}\nĐOÁN ĐÚNG! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Con: ${p} | Cái: ${k}\nĐOÁN SAI! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playBlackjack = () => executeBet("BLACKJACK 21", (b) => { const gS=()=>Math.random()<0.35?22:Math.floor(Math.random()*6)+16, pS=gS(), dS=gS(); if(pS>21) return {payout:-b, message:`Bạn 22 điểm (Dễ Quắc)!\nMất ${b.toLocaleString()} PP.`, title:"QUẮC", isWin:false}; if(dS>21) return {payout:b, message:`Bạn: ${pS} | Nhà cái: Quắc!\nThắng ${b.toLocaleString()} PP.`, title:"NHÀ CÁI QUẮC", isWin:true}; if(pS===dS) return {payout:0, message:`Cùng ${pS} điểm. Hòa tiền.`, title:"HÒA", isWin:true}; if(pS>dS) return {payout:b, message:`Bạn: ${pS} | Nhà cái: ${dS}\nThắng ${b.toLocaleString()} PP!`, title:"THẮNG 21", isWin:true}; return {payout:-b, message:`Bạn: ${pS} | Nhà cái: ${dS}\nThua ${b.toLocaleString()} PP!`, title:"THUA RỒI", isWin:false}; });
window.playBilliards = () => executeBet("BIDA", (b) => { if(Math.random()<0.25) return {payout:Math.floor(b*1.5), message:`Bi vào lỗ (Chỉ 25% trúng)!\nThắng ${(Math.floor(b*1.5)).toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Bi văng ra ngoài.\nThua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playSafe = () => executeBet("MỞ KÉT SẮT", (b) => { let g=prompt("Mã két (000-999):"); if(!g||g.length!==3) return null; const s=Math.floor(Math.random()*1000).toString().padStart(3,'0'); if(g===s) return {payout:b*20, message:`Mã: ${s}\nMỞ THÀNH CÔNG! Trúng ${(b*20).toLocaleString()} PP!`, title:"TRỘM KÉT", isWin:true}; return {payout:-b, message:`Mã: ${s}\nCòi báo động! Mất ${b.toLocaleString()} PP!`, title:"BỊ BẮT", isWin:false}; });
window.playFish = async () => { const snap = await get(ref(db, `users/${uid}`)); const c = Number(snap.val().pp)||0; if(c<10000) return window.showResult("NGHÈO", "Bạn không đủ 10k PP đạn!", false); const r=Math.random(); let n=c-10000, m="Bắn trượt! Mất 10,000 PP 💀", t="TRƯỢT", win=false; if(r<0.005) {n+=500000; m="HẠ CÁ MẬP VÀNG (+500k PP) 🦈"; t="BÙM CHÍU"; win=true;} else if(r<0.05) {n+=100000; m="TRÚNG RÙA THẦN (+100k PP) 🐢"; t="TRÚNG LỚN"; win=true;} else if(r<0.2) {n+=30000; m="Đàn cá nhỏ (+30k PP) 🐟"; t="CÓ LÃI"; win=true;} await update(ref(db, `users/${uid}`), { pp: n }); window.showResult(t, m, win); };
window.playBomb = () => executeBet("BOM HẸN GIỜ", (b) => { const c=prompt("Cắt: ĐỎ, XANH, VÀNG?"); if(!c||!['ĐỎ','XANH','VÀNG'].includes(c.toUpperCase()))return null; const bm=['ĐỎ','XANH','VÀNG'][Math.floor(Math.random()*3)]; if(c.toUpperCase()===bm) return {payout:-b, message:`CẮT NHẦM DÂY!\nMất sạch ${b.toLocaleString()} PP!`, title:"BÙMMM!!!", isWin:false}; return {payout:Math.floor(b*0.5), message:`Bom đã tắt (Dây nổ là ${bm}).\nĐược thưởng ${(Math.floor(b*0.5)).toLocaleString()} PP!`, title:"SỐNG SÓT", isWin:true}; });
window.coinFlip = (c) => executeBet("ĐỒNG XU", (b) => { const isWin = Math.random() < 0.40; return isWin ? {payout:b, message:`Trời độ bạn! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true} : {payout:-b, message:`Đồng xu lật ngược phút cuối! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playChanLe = (c) => executeBet("CHẴN LẺ", (b) => { if(Math.random()<0.08) return {payout:-b, message:`Cái giở trò bịp. Thua ${b.toLocaleString()} PP!`, title:"BỊP", isWin:false}; const d = Math.floor(Math.random()*6)+1, r=d%2===0?'CHAN':'LE'; return c===r ? {payout:b, message:`Ra số ${d}! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true} : {payout:-b, message:`Ra số ${d}! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playRoulette = (c) => executeBet("ROULETTE", (b) => { const r = Math.random(); let rs='BLACK', m=2, n="ĐEN"; if(r<0.02){rs='GREEN';m=14;n="XANH LÁ";}else if(r<0.42){rs='RED';m=2;n="ĐỎ";} return c===rs ? {payout:b*(m-1), message:`Bóng rơi vào ô ${n}!\nThắng ${(b*(m-1)).toLocaleString()} PP!`, title:"THẮNG LỚN", isWin:true} : {payout:-b, message:`Bóng rơi vào ô ${n}! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playTerminal = () => executeBet("HACK TERMINAL", (b) => { let n=parseInt(prompt("Mã (1-10):")); if(isNaN(n))return null; const s=Math.floor(Math.random()*12)+1; return n===s ? {payout:b*8, message:`Mã là ${s}! Trúng ${(b*8).toLocaleString()} PP!`, title:"HACKER ĐỈNH", isWin:true} : {payout:-b, message:`Mã là ${s}! Bị phát hiện. Mất ${b.toLocaleString()} PP!`, title:"THẤT BẠI", isWin:false}; });
window.playWheel = () => executeBet("NÓN KỲ DIỆU", (b) => { const m=[0, 0, 0, 0.5, 1.5, 2][Math.floor(Math.random()*6)], df=Math.floor(b*m)-b; if(df>0) return {payout:df, message:`Vào ô x${m}! Lời ${df.toLocaleString()} PP!`, title:"LỜI RỒI", isWin:true}; if(df===0) return {payout:0, message:`Vào ô x1! Hòa vốn.`, title:"HÒA", isWin:true}; return {payout:df, message:`Vào ô x${m}! Lỗ ${(df*-1).toLocaleString()} PP!`, title:"LỖ", isWin:false}; });
window.playHighLow = (c) => executeBet("BÀI LỚN NHỎ", (b) => { const p=Math.floor(Math.random()*13)+1, s=Math.floor(Math.random()*13)+1; if(p===s) return {payout:Math.floor(-b*0.5), message:`Bạn: ${p} | Máy: ${s}. Hòa bài nhưng nhà cái thu phế nửa tiền!`, title:"HÒA LỖ", isWin:false}; if((c==='HIGH'&&p>s)||(c==='LOW'&&p<s)) return {payout:b, message:`Bạn: ${p} | Máy: ${s}. Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Bạn: ${p} | Máy: ${s}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playHorse = (c) => executeBet("ĐUA NGỰA", (b) => { let w=Math.floor(Math.random()*3)+1; if(Math.random()<0.15 && c===w) w=(w%3)+1; return c===w ? {payout:b*2, message:`Ngựa ${w} Về Nhất! Thắng ${(b*2).toLocaleString()} PP!`, title:"THẮNG", isWin:true} : {payout:-b, message:`Ngựa ${w} Về Nhất! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playBauCua = () => executeBet("BẦU CUA", (b) => { const c=document.getElementById('baucua-choice').value, r=['BAU','CUA','TOM','CA','GA','NAI'][Math.floor(Math.random()*7)===6?Math.floor(Math.random()*6):Math.floor(Math.random()*5)]; return c===r ? {payout:b*4, message:`Mở ra ${r}! Thắng ${(b*4).toLocaleString()} PP!`, title:"THẮNG x5", isWin:true} : {payout:-b, message:`Mở ra ${r}! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playSpaceBauCua = () => executeBet("BẦU CUA VŨ TRỤ", (b) => { const c=document.getElementById('baucua-choice').value, i=['BAU','CUA','TOM','CA','GA','NAI'], d1=i[Math.floor(Math.random()*6)], d2=i[Math.floor(Math.random()*6)], d3=i[Math.floor(Math.random()*6)]; let k=0; if(d1===c)k++; if(d2===c)k++; if(d3===c)k++; if(k>0) return {payout:b*(k*2), message:`Ra: ${d1}, ${d2}, ${d3}.\nTrúng ${k} con! Thắng ${(b*(k*2)).toLocaleString()} PP!`, title:"ĂN ĐẬM", isWin:true}; return {payout:-b, message:`Ra: ${d1}, ${d2}, ${d3}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playChest = (c) => executeBet("RƯƠNG TỬ THẦN", (b) => { const bm=Math.floor(Math.random()*3)+1; return c===bm ? {payout:-b, message:`Rương ${bm} là Bom! Mất sạch ${b.toLocaleString()} PP!`, title:"NỔ TUNG", isWin:false} : {payout:Math.floor(b*0.5), message:`An toàn! Rương ${bm} là bom. Nhận ${(Math.floor(b*0.5)).toLocaleString()} PP!`, title:"SỐNG SÓT", isWin:true}; });
window.playLottery = () => executeBet("XỔ SỐ", (b) => { const n=parseInt(prompt("Vé (00-99):")); if(isNaN(n))return null; const s=Math.floor(Math.random()*110); return n===s ? {payout:b*70, message:`Kết quả: ${s}!\nTRÚNG ${(b*70).toLocaleString()} PP!`, title:"ĐỘC ĐẮC", isWin:true} : {payout:-b, message:`Kết quả: ${s}. Trật lất! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playKeno = () => executeBet("KENO", (b) => { let g=parseInt(prompt("Bi (1-20):")); if(isNaN(g)||g<1||g>20) return null; const s=Math.floor(Math.random()*22)+1; if(g===s) return {payout:b*10, message:`Bi rớt vào ${s}! Thắng ${(b*10).toLocaleString()} PP!`, title:"TIÊN TRI", isWin:true}; return {payout:-b, message:`Bi rớt vào ${s}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playMine = () => executeBet("ĐÀO ĐÁ QUÝ", (b) => { if(Math.random()<0.40) return {payout:-b, message:`Cuốc trúng Bom! Mất ${b.toLocaleString()} PP!`, title:"NỔ BANH XÁC", isWin:false}; return {payout:Math.floor(b*0.2), message:`Đào được Thạch Anh. Lời ${(Math.floor(b*0.2)).toLocaleString()} PP!`, title:"THỢ MỎ", isWin:true}; });
window.rpsGame = (c) => executeBet("KÉO BÚA BAO", (b) => { if(Math.random()<0.25) return {payout:-b, message:`Máy nhìn trộm đòn! Thua ${b.toLocaleString()} PP!`, title:"BỊP BỢM", isWin:false}; const s=['KEO','BUA','BAO'][Math.floor(Math.random()*3)]; if(c===s) return {payout:0, message:`Máy ra ${s}. HÒA!`, title:"HÒA", isWin:true}; if((c==='KEO'&&s==='BAO')||(c==='BUA'&&s==='KEO')||(c==='BAO'&&s==='BUA')) return {payout:b, message:`Máy ra ${s}. Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Máy ra ${s}. Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playCockfight = (c) => executeBet("ĐÁ GÀ", (b) => { const w = Math.random()>0.6? (c==='RED'?'BLUE':'RED') : c; if(c===w) return {payout:b, message:`Gà tung đòn hiểm thắng!\nĂn ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Gà gãy giò. Mất ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playThreeCards = () => executeBet("BÀI CÀO", (b) => { const pScore=(Math.floor(Math.random()*10)+Math.floor(Math.random()*10)+Math.floor(Math.random()*10))%10, dScore=(Math.floor(Math.random()*10)+Math.floor(Math.random()*10)+Math.floor(Math.random()*10))%10; if(pScore>dScore && Math.random()>0.1) return {payout:b, message:`Bạn: ${pScore} Nút | Cái: ${dScore} Nút\nThắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; if(pScore===dScore) return {payout:-Math.floor(b*0.2), message:`Hòa, cái thu phế 20%.`, title:"HÒA LỖ", isWin:false}; return {payout:-b, message:`Bạn: ${pScore} Nút | Cái: ${dScore} Nút\nThua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playCupid = () => executeBet("MŨI TÊN TÌNH YÊU", (b) => { const m=(Math.random()*3).toFixed(1), df=Math.floor(b*m)-b; if(df>0) return {payout:df, message:`Trúng hệ số x${m}!\nLời ${df.toLocaleString()} PP.`, title:"TRÚNG", isWin:true}; if(df===0) return {payout:0, message:`Trúng x1.0! Hòa vốn.`, title:"HÒA", isWin:true}; return {payout:df, message:`Trúng x${m}!\nLỗ ${(df*-1).toLocaleString()} PP.`, title:"LỖ", isWin:false}; });
window.playShield = () => executeBet("ĐỠ ĐẠN", (b) => { if(Math.random()<0.4) return {payout:Math.floor(b*0.3), message:`Giương khiên thành công!\nLời ${(Math.floor(b*0.3)).toLocaleString()} PP!`, title:"AN TOÀN", isWin:true}; return {payout:-b, message:`Khiên vỡ! Trúng đạn.\nMất ${b.toLocaleString()} PP!`, title:"CHẾT", isWin:false}; });
window.playPirate = (c) => executeBet("KHO BÁU", (b) => { const w=Math.floor(Math.random()*4)+1; if(c===w) return {payout:b*2, message:`Đảo chứa kho báu!\nThắng ${(b*2).toLocaleString()} PP!`, title:"VÀNG", isWin:true}; return {payout:-b, message:`Gặp cướp biển!\nMất ${b.toLocaleString()} PP!`, title:"BỊ CƯỚP", isWin:false}; });
window.playEgg = () => executeBet("ĐẬP TRỨNG", (b) => { if(Math.random()<0.7) return {payout:Math.floor(b*0.1), message:`Trứng nở ra vàng!\nLời ${(Math.floor(b*0.1)).toLocaleString()} PP.`, title:"THU HOẠCH", isWin:true}; return {payout:-b, message:`Trứng ung! Thối hoắc.\nMất ${b.toLocaleString()} PP!`, title:"THÚI QUẮC", isWin:false}; });
window.playExactDice = () => executeBet("ĐOÁN XÚC XẮC", (b) => { let c=parseInt(prompt("Mặt (1-6):")); if(isNaN(c)||c<1||c>6) return null; const r=Math.floor(Math.random()*7)+1; if(c===r) return {payout:b*5, message:`Đổ ra mặt ${r}!\nĂn trọn ${(b*5).toLocaleString()} PP!`, title:"THẦN BÀI", isWin:true}; return {payout:-b, message:`Đổ ra mặt ${r}!\nTrượt rồi, mất ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });
window.playDragonTiger = (c) => executeBet("RỒNG HỔ", (b) => { const d=Math.floor(Math.random()*13)+1, t=Math.floor(Math.random()*13)+1; if(d===t) return {payout:-Math.floor(b*0.5), message:`Rồng ${d} - Hổ ${t}\nHòa nhau, nhà cái thu nửa tiền!`, title:"HÒA LỖ", isWin:false}; const w=d>t?'DRAGON':'TIGER'; if(c===w) return {payout:b, message:`Rồng ${d} - Hổ ${t}\nĐoán chuẩn! Thắng ${b.toLocaleString()} PP!`, title:"THẮNG", isWin:true}; return {payout:-b, message:`Rồng ${d} - Hổ ${t}\nĐoán sai! Thua ${b.toLocaleString()} PP!`, title:"THUA", isWin:false}; });

// ==========================================
// 🃏 TIẾN LÊN MIỀN NAM VIP (FULL LOGIC + ĐỒNG HỒ 30S)
// ==========================================
let myTlRoomId = null; let tlTimerInterval = null; let tlCurrentTurnStartTime = 0; let windowLastHandSig = "";
const SUITS = ['♠', '♣', '♦', '♥'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
let selectedCardsIndices = [];

window.openTienLenModal = () => { document.getElementById('tienlen-modal').style.display = 'flex'; listenTienLenRooms(); };
window.closeTienLenModal = () => { document.getElementById('tienlen-modal').style.display = 'none'; if(tlTimerInterval) clearInterval(tlTimerInterval); };

function listenTienLenRooms() {
    onValue(ref(db, 'tienlen_rooms'), snap => {
        const rooms = snap.val() || {}; let lobbyHtml = ""; let amIInRoom = false;
        
        for(let k in rooms) {
            const r = rooms[k]; const players = r.players || {}; const isMeHere = Object.keys(players).includes(uid);
            if(isMeHere) { amIInRoom = true; myTlRoomId = k; renderTlBoard(r); manageTlTimer(r); }
            if(r.status === 'WAITING' && !isMeHere) {
                lobbyHtml += `<div class="room-item">
                    <div><strong class="text-gold">PHÒNG BÀI CỦA ${r.creatorName}</strong><br><small>Tiền cược: ${r.bet.toLocaleString()} PP / Ván | Sĩ số: ${Object.keys(players).length}/4</small></div>
                    ${Object.keys(players).length < 4 ? `<button onclick="tlJoinRoom('${k}')" class="btn-cyber" style="padding: 10px 25px;">[ NGỒI VÀO BÀN ]</button>` : '<span class="text-red">ĐÃ ĐẦY CHỖ</span>'}
                </div>`;
            }
        }
        
        document.getElementById('tl-room-list').innerHTML = lobbyHtml || '<p style="color:#888; grid-column: span 2; text-align:center;">Chưa có đại gia nào mở sòng.</p>';
        if(amIInRoom) { document.getElementById('tl-lobby').style.display = 'none'; document.getElementById('tl-board').style.display = 'block'; } 
        else { document.getElementById('tl-lobby').style.display = 'block'; document.getElementById('tl-board').style.display = 'none'; myTlRoomId = null; if(tlTimerInterval) clearInterval(tlTimerInterval); }
    });
}

window.tlCreateRoom = async () => {
    let bet = parseInt(prompt("Nhập PP cược TỐI THIỂU cho 1 ván:")); if(isNaN(bet) || bet <= 0) return;
    const s = await get(ref(db, `users/${uid}`)); const u = s.val(); if((Number(u.pp)||0) < bet) return alert("Không đủ PP!");
    await update(ref(db, `users/${uid}`), { pp: (Number(u.pp)||0) - bet });
    const roomId = 'TL_' + Date.now();
    await set(ref(db, `tienlen_rooms/${roomId}`), { creator: uid, creatorName: u.name, bet: bet, status: 'WAITING', players: { [uid]: { name: u.name, avatar: u.avatar || 'https://i.pravatar.cc/150', isCreator: true } }, playerOrder: [uid], pot: bet });
};
window.tlJoinRoom = async (roomId) => {
    const s = await get(ref(db, `tienlen_rooms/${roomId}`)); const r = s.val(); if(!r || r.status !== 'WAITING') return alert("Bàn đang chơi hoặc không tồn tại!");
    if(Object.keys(r.players).length >= 4) return alert("Bàn đã đủ 4 tụ!");
    const uS = await get(ref(db, `users/${uid}`)); const u = uS.val(); if((Number(u.pp)||0) < r.bet) return alert("Bạn không đủ lúa vô sòng!");
    await update(ref(db, `users/${uid}`), { pp: (Number(u.pp)||0) - r.bet });
    const newOrder = [...(r.playerOrder || []), uid];
    await update(ref(db, `tienlen_rooms/${roomId}/players/${uid}`), { name: u.name, avatar: u.avatar || 'https://i.pravatar.cc/150' });
    await update(ref(db, `tienlen_rooms/${roomId}`), { playerOrder: newOrder, pot: r.pot + r.bet });
};
window.tlLeaveGame = async () => {
    if(!myTlRoomId) return window.closeTienLenModal();
    const rSnap = await get(ref(db, `tienlen_rooms/${myTlRoomId}`)); const r = rSnap.val();
    if(r.status === 'PLAYING') return alert("Đang trong ván. Chạy ngang mất sạch cược đó!");
    if(r.status === 'WAITING') {
        const uS = await get(ref(db, `users/${uid}`)); await update(ref(db, `users/${uid}`), { pp: (Number(uS.val().pp)||0) + r.bet });
        await remove(ref(db, `tienlen_rooms/${myTlRoomId}/players/${uid}`));
        const newOrder = r.playerOrder.filter(id => id !== uid);
        if(newOrder.length === 0) await remove(ref(db, `tienlen_rooms/${myTlRoomId}`));
        else await update(ref(db, `tienlen_rooms/${myTlRoomId}`), { playerOrder: newOrder, pot: r.pot - r.bet });
    }
};

window.tlStartGame = async () => {
    if(!myTlRoomId) return; const s = await get(ref(db, `tienlen_rooms/${myTlRoomId}`)); const r = s.val();
    if(Object.keys(r.players).length < 2) return alert("Phải đủ tay (Min 2 người) mới chia bài được!");
    let deck = Array.from({length: 52}, (_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    let hands = {}; let i = 0;
    r.playerOrder.forEach(pUid => { hands[pUid] = deck.slice(i, i + 13).sort((a,b) => a - b); i += 13; });
    const firstTurn = r.playerOrder[Math.floor(Math.random() * r.playerOrder.length)];
    await update(ref(db, `tienlen_rooms/${myTlRoomId}`), { status: 'PLAYING', hands: hands, turn: firstTurn, turnStartTime: Date.now(), currentPile: [], passList: [], lastPlayedBy: '' });
};

function analyzeCards(cards) {
    if(!cards || cards.length === 0) return null;
    cards.sort((a,b) => a - b);
    const ranks = cards.map(c => Math.floor(c/4));
    const isSameRank = ranks.every(r => r === ranks[0]);
    if(cards.length === 1) return { type: 'single', highCard: cards[0], count: 1 };
    if(isSameRank && cards.length === 2) return { type: 'pair', highCard: cards[1], count: 2 };
    if(isSameRank && cards.length === 3) return { type: 'triple', highCard: cards[2], count: 3 };
    if(isSameRank && cards.length === 4) return { type: 'quad', highCard: cards[3], count: 4 };

    let isStraight = true; for(let i = 1; i < ranks.length; i++) { if(ranks[i] !== ranks[i-1] + 1) isStraight = false; }
    if(isStraight && cards.length >= 3 && ranks[ranks.length-1] < 12) { return { type: 'straight', highCard: cards[cards.length-1], count: cards.length }; }
    
    if(cards.length >= 6 && cards.length % 2 === 0) {
        let isDoiThong = true; let pairRanks = [];
        for(let i=0; i<cards.length; i+=2) { if(Math.floor(cards[i]/4) !== Math.floor(cards[i+1]/4)) isDoiThong = false; pairRanks.push(Math.floor(cards[i]/4)); }
        if(isDoiThong) {
            for(let i=1; i<pairRanks.length; i++) { if(pairRanks[i] !== pairRanks[i-1] + 1) isDoiThong = false; }
            if(isDoiThong && pairRanks[pairRanks.length-1] < 12) return { type: 'doithong', pairs: cards.length/2, highCard: cards[cards.length-1], count: cards.length };
        }
    }
    return null;
}

function canBeat(playObj, pileObj) {
    if(!pileObj) return true; 
    const pileRank = Math.floor(pileObj.highCard/4);
    if(pileObj.type === 'single' && pileRank === 12) {
        if(playObj.type === 'doithong' && playObj.pairs === 3) return true;
        if(playObj.type === 'quad') return true;
        if(playObj.type === 'doithong' && playObj.pairs === 4) return true;
    }
    if(pileObj.type === 'pair' && pileRank === 12) {
        if(playObj.type === 'quad') return true;
        if(playObj.type === 'doithong' && playObj.pairs === 4) return true;
    }
    if(pileObj.type === 'doithong' && pileObj.pairs === 3) { if(playObj.type === 'quad' || (playObj.type === 'doithong' && playObj.pairs === 4)) return true; }
    if(pileObj.type === 'quad' && playObj.type === 'doithong' && playObj.pairs === 4) return true;

    if(playObj.type === pileObj.type && playObj.count === pileObj.count) { return playObj.highCard > pileObj.highCard; }
    return false;
}

function getCardHTML(val, isAnimated = false, index = -1) {
    const rank = RANKS[Math.floor(val / 4)]; const suit = SUITS[val % 4]; const isRed = (val % 4 === 2 || val % 4 === 3);
    const idAttr = index >= 0 ? `id="my-card-${index}" onclick="tlToggleCard(${index})"` : '';
    const styleAttr = isAnimated ? `style="--rot: ${(Math.random()*20 - 10)}deg; left: ${Math.random()*60 - 30}px; position:absolute;"` : '';
    return `<div ${idAttr} class="tl-card ${isRed ? 'red-suit' : 'black-suit'} ${isAnimated ? 'tl-played-card' : ''}" ${styleAttr}><div class="rank">${rank}</div><div class="suit">${suit}</div></div>`;
}

window.tlToggleCard = (index) => {
    const el = document.getElementById(`my-card-${index}`);
    if(selectedCardsIndices.includes(index)) { selectedCardsIndices = selectedCardsIndices.filter(i => i !== index); el.classList.remove('selected'); } 
    else { selectedCardsIndices.push(index); el.classList.add('selected'); }
};

function renderTlBoard(r) {
    const pOrder = r.playerOrder || []; const myIndex = pOrder.indexOf(uid); if(myIndex === -1) return;
    ['top', 'left', 'right'].forEach(pos => document.getElementById(`tl-seat-${pos}`).innerHTML = '');
    document.getElementById('tl-start-btn').style.display = (r.status === 'WAITING' && r.creator === uid) ? 'block' : 'none';
    document.getElementById('tl-pot-display').innerText = `TỔNG CƯỢC: ${r.pot.toLocaleString()} PP`;
    
    const isMyTurn = (r.status === 'PLAYING' && r.turn === uid);
    document.getElementById('tl-controls').style.display = isMyTurn ? 'flex' : 'none';
    document.getElementById('tl-timer-bar-container').style.display = (r.status === 'PLAYING') ? 'block' : 'none';

    const positions = pOrder.length === 2 ? ['bottom', 'top'] : pOrder.length === 3 ? ['bottom', 'right', 'left'] : ['bottom', 'right', 'top', 'left'];
    pOrder.forEach((pUid, idx) => {
        const relativeIdx = (idx - myIndex + pOrder.length) % pOrder.length; const pos = positions[relativeIdx];
        const pInfo = r.players[pUid]; const isTurn = r.turn === pUid; const hasPassed = (r.passList || []).includes(pUid);
        const cardCount = r.hands && r.hands[pUid] ? r.hands[pUid].length : 13;
        
        let html = `<div class="tl-player-badge ${isTurn ? 'active-turn' : ''} ${hasPassed ? 'passed' : ''}"><img src="${pInfo.avatar}" style="width:50px; height:50px; border-radius:50%; border:2px solid ${isTurn ? 'var(--neon-gold)' : '#fff'};"><div><span class="text-blue" style="font-size:14px; font-weight:bold;">${pInfo.name}</span><br><small style="color:#ffcc00; font-size:12px;">${cardCount} lá</small></div></div>`;
        
        if (pos !== 'bottom' && r.status === 'PLAYING') {
            html += `<div style="margin-top:15px; display:flex; justify-content:center;">${Array(cardCount).fill('<div class="tl-card-back"></div>').join('')}</div>`;
            document.getElementById(`tl-seat-${pos}`).innerHTML = html;
        } else if (pos === 'bottom') {
            document.getElementById('tl-my-info').innerHTML = html;
            if(r.status === 'PLAYING' && r.hands && r.hands[uid]) {
                const myHand = r.hands[uid]; const sig = myHand.join(',');
                if(windowLastHandSig !== sig) {
                    selectedCardsIndices = []; document.getElementById('tl-my-hand').innerHTML = myHand.map((val, i) => getCardHTML(val, false, i)).join(''); windowLastHandSig = sig;
                }
            } else { document.getElementById('tl-my-hand').innerHTML = ''; windowLastHandSig = ""; }
        }
    });

    if(r.status === 'PLAYING') {
        const centerPileHTML = (r.currentPile || []).map(val => getCardHTML(val, true)).join('');
        const pileContainer = document.getElementById('tl-center-pile');
        if(pileContainer.innerHTML !== centerPileHTML) pileContainer.innerHTML = centerPileHTML;
        
        if(isMyTurn) {
            const mustPlay = (!r.currentPile || r.currentPile.length === 0 || r.lastPlayedBy === uid);
            document.getElementById('tl-turn-msg').innerHTML = `<span style="color:var(--neon-green)">TỚI LƯỢT ĐÁNH BÀI!</span> ${mustPlay ? '<br><span style="font-size:12px; color:#ffcc00">(Đang cầm cái - Phải đánh!)</span>' : ''}`;
        } else { document.getElementById('tl-turn-msg').innerText = `Đang đợi ${r.players[r.turn].name}...`; }
    }

    if(r.status === 'ENDED') {
        document.getElementById('tl-turn-msg').innerHTML = `<h1 class="text-gold glow-pulse" style="font-size:40px; margin:0;">🎉 ${r.players[r.winner].name} TỚI TRƯỚC! 🎉</h1><p style="margin:5px 0;">Húp trọn ${r.pot.toLocaleString()} PP</p>`;
        document.getElementById('tl-controls').style.display = 'none'; document.getElementById('tl-timer-bar-container').style.display = 'none';
        if(r.winner === uid && !window.hasClaimedTl) {
            window.hasClaimedTl = true;
            setTimeout(async () => {
                const uS = await get(ref(db, `users/${uid}`)); await update(ref(db, `users/${uid}`), { pp: (Number(uS.val().pp)||0) + r.pot });
                window.showResult("BẠN ĐÃ TỚI!", `Bài quá đẹp! Quét sạch sòng ẵm ${r.pot.toLocaleString()} PP!`, true);
                await remove(ref(db, `tienlen_rooms/${myTlRoomId}`)); window.hasClaimedTl = false; windowLastHandSig = "";
            }, 3000);
        }
    }
}

function manageTlTimer(r) {
    if(r.status !== 'PLAYING') { if(tlTimerInterval) clearInterval(tlTimerInterval); return; }
    if(tlCurrentTurnStartTime !== r.turnStartTime) {
        tlCurrentTurnStartTime = r.turnStartTime;
        if(tlTimerInterval) clearInterval(tlTimerInterval);
        
        tlTimerInterval = setInterval(() => {
            const elapsed = (Date.now() - r.turnStartTime) / 1000;
            const timeLeft = Math.max(0, 30 - elapsed);
            const pct = (timeLeft / 30) * 100;
            const bar = document.getElementById('tl-timer-bar');
            bar.style.width = `${pct}%`; bar.style.background = pct > 50 ? 'var(--neon-green)' : (pct > 20 ? 'var(--neon-gold)' : 'var(--neon-red)');
            
            if(timeLeft <= 0 && r.turn === uid) {
                clearInterval(tlTimerInterval);
                const mustPlay = (!r.currentPile || r.currentPile.length === 0 || r.lastPlayedBy === uid);
                if(mustPlay && r.hands[uid] && r.hands[uid].length > 0) { selectedCardsIndices = [0]; window.tlPlayCards(true); } 
                else { window.tlPassTurn(true); }
            }
        }, 1000);
    }
}

window.tlPlayCards = async (isAuto = false) => {
    if(selectedCardsIndices.length === 0) return alert("Chọn bài đi chứ!");
    const rSnap = await get(ref(db, `tienlen_rooms/${myTlRoomId}`)); const r = rSnap.val();
    let myHand = r.hands[uid]; let cardsToPlay = selectedCardsIndices.map(i => myHand[i]).sort((a,b) => a - b);
    
    const playObj = analyzeCards(cardsToPlay);
    if(!playObj) { if(!isAuto) alert("Bài không hợp lệ (Không đúng sảnh/đôi/tứ quý)! Cấm đánh láo!"); return; }
    
    const mustPlay = (!r.currentPile || r.currentPile.length === 0 || r.lastPlayedBy === uid);
    if(!mustPlay) { const pileObj = analyzeCards(r.currentPile); if(!canBeat(playObj, pileObj)) { if(!isAuto) alert("Bài này không chặt được bài trên bàn!"); return; } }

    let newHand = myHand.filter((_, i) => !selectedCardsIndices.includes(i));
    selectedCardsIndices = []; windowLastHandSig = ""; 
    let nextIdx = (r.playerOrder.indexOf(uid) + 1) % r.playerOrder.length; let nextUid = r.playerOrder[nextIdx];
    let safeLoop = 0; while((r.passList || []).includes(nextUid) && safeLoop < 4) { nextIdx = (nextIdx + 1) % r.playerOrder.length; nextUid = r.playerOrder[nextIdx]; safeLoop++; }

    let updates = { [`hands/${uid}`]: newHand, currentPile: cardsToPlay, lastPlayedBy: uid, turn: nextUid, turnStartTime: Date.now() };
    if(newHand.length === 0) { updates.status = 'ENDED'; updates.winner = uid; }
    await update(ref(db, `tienlen_rooms/${myTlRoomId}`), updates);
};

window.tlPassTurn = async (isAuto = false) => {
    const rSnap = await get(ref(db, `tienlen_rooms/${myTlRoomId}`)); const r = rSnap.val();
    if(!r.currentPile || r.currentPile.length === 0 || r.lastPlayedBy === uid) { if(!isAuto) alert("Đang cầm cái, bắt buộc phải ra bài!"); return; }
    
    let passList = r.passList || []; passList.push(uid);
    let nextIdx = (r.playerOrder.indexOf(uid) + 1) % r.playerOrder.length; let nextUid = r.playerOrder[nextIdx];
    let safeLoop = 0; while(passList.includes(nextUid) && safeLoop < 4) { nextIdx = (nextIdx + 1) % r.playerOrder.length; nextUid = r.playerOrder[nextIdx]; safeLoop++; }

    let updates = { passList: passList, turn: nextUid, turnStartTime: Date.now() };
    if(passList.length >= r.playerOrder.length - 1) { updates.passList = []; updates.currentPile = []; }
    await update(ref(db, `tienlen_rooms/${myTlRoomId}`), updates);
};
