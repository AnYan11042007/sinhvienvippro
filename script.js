import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, onValue, update, remove, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCfrD1iS1yjfjuaPIKvGb-iWcirBg1lXJE",
    authDomain: "appsinhvien-24482.firebaseapp.com",
    databaseURL: "https://appsinhvien-24482-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "appsinhvien-24482"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
let activeQuizId = null;
let quizTimerInterval = null;

function formatDate(dStr) {
    if(!dStr || dStr === 'Không có') return '';
    const parts = dStr.split('-');
    if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
}

window.toggleMusic = () => {
    const audio = document.getElementById('bgMusic'), btn = document.getElementById('music-toggle');
    if (audio.paused) { 
        audio.play().catch(() => alert("Bấm vào bất cứ đâu trên màn hình trước khi bật nhạc!")); 
        btn.innerHTML = '<i class="fas fa-volume-up"></i> [ TẮT NHẠC ]'; 
        btn.style.color = 'var(--neon-gold)'; 
    }
    else { audio.pause(); btn.innerHTML = '<i class="fas fa-music"></i> [ BẬT NHẠC ]'; btn.style.color = ''; }
};

window.switchTab = (tab) => {
    document.getElementById('nav-academic').classList.remove('active');
    document.getElementById('nav-casino').classList.remove('active');
    document.getElementById('tab-academic').style.display = 'none';
    document.getElementById('tab-casino').style.display = 'none';
    document.getElementById(`nav-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).style.display = 'grid';
};

window.login = async () => {
    const u = document.getElementById('username').value.trim(), p = document.getElementById('password').value.trim();
    const snap = await get(ref(db, `users/${u}`));
    if (snap.exists() && snap.val().pass === p) {
        if(snap.val().locked) return alert("ACCOUNT BỊ KHÓA!");
        localStorage.setItem('uid', u); location.reload();
    } else alert("SAI UID HOẶC PASS!");
};
window.logout = () => { localStorage.removeItem('uid'); location.reload(); };

function genClassOptions(sel, all = false) {
    let o = all ? '<option value="ALL">TẤT CẢ LỚP</option>' : '';
    for(let y=1; y<=4; y++) ['A','B','C','D'].forEach(b => { const v=`Y${y}_${b}`; o+=`<option value="${v}" ${v===sel?'selected':''}>Lớp ${y}-${b}</option>`; });
    return o;
}

const uid = localStorage.getItem('uid');
if (uid) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    if(document.getElementById('add-class-select')) {
        document.getElementById('add-class-select').innerHTML = genClassOptions('Y1_A');
        document.getElementById('filter-class-select').innerHTML = genClassOptions('ALL', true);
    }
    loadSystem();
}

function loadSystem() {
    onValue(ref(db, `users/${uid}`), snap => {
        const u = snap.val(); if(!u) return;
        document.getElementById('avatar-container').innerHTML = u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : `<i class="fas fa-user-ninja"></i>`;
        document.getElementById('display-name').innerHTML = u.role === 'TEACHER' ? `${u.name} <i class="fas fa-pen" onclick="changeTeacherName()" style="font-size:10px;cursor:pointer;"></i>` : u.name;
        document.getElementById('role-badge').innerText = u.role === 'TEACHER' ? 'FACULTY' : `LỚP ${u.class}`;
        
        if(u.role === 'TEACHER') { 
            document.getElementById('teacher-view').style.display = 'block'; 
            document.getElementById('nav-academic').style.display = 'none';
            document.getElementById('nav-casino').style.display = 'none';
            loadAdmin(); 
        }
        else { 
            document.getElementById('student-view').style.display = 'block'; 
            document.getElementById('nav-academic').style.display = 'flex';
            document.getElementById('nav-casino').style.display = 'flex';
            loadStudent(u); 
        }
    });

    onValue(ref(db, 'classes'), snap => {
        const clss = snap.val() || {}; let data = Object.keys(clss).map(k => ({id:k, ...clss[k]})).sort((a,b) => b.cp - a.cp);
        let hS = "", hA = "";
        data.forEach((c, i) => {
            hS += `<tr><td>#${i+1}</td><td>Lớp ${c.name}</td><td class="text-gold">${c.cp}</td></tr>`;
            hA += `<tr><td class="text-blue">Lớp ${c.name}</td><td><input type="number" value="${c.cp}" onchange="window.upCP('${c.id}',this.value)" class="cyber-input" style="width:70px;padding:2px;text-align:center;"></td></tr>`;
        });
        if(document.getElementById('student-class-rank')) document.getElementById('student-class-rank').innerHTML = hS;
        if(document.getElementById('admin-class-control')) document.getElementById('admin-class-control').innerHTML = hA;
    });

    onValue(ref(db, 'users'), snap => {
        const us = snap.val() || {}; let arr = [];
        for(let id in us) if(us[id].role === 'STUDENT') arr.push({id, ...us[id]});
        arr.sort((a,b) => (Number(b.pp)||0) - (Number(a.pp)||0));
        let h = ""; arr.slice(0, 50).forEach((s, i) => h += `<tr><td>${s.id}</td><td>${s.name}</td><td class="text-gold">${(Number(s.pp)||0).toLocaleString()}</td></tr>`);
        if(document.getElementById('top-50-students')) document.getElementById('top-50-students').innerHTML = h;
    });
}

function loadStudent(u) {
    document.getElementById('display-pp').innerText = (u.pp || 0).toLocaleString();
    const tb = document.getElementById('student-grades'); tb.innerHTML = '';
    if(u.academic) {
        Object.keys(u.academic).sort().forEach(tk => {
            tb.innerHTML += `<tr class="term-group-header"><td colspan="6">${tk}</td></tr>`;
            for(let sk in u.academic[tk]) {
                const s = u.academic[tk][sk];
                tb.innerHTML += `<tr><td>${s.name}</td><td>${s.bth}</td><td>${s.gk}</td><td>${s.ck}</td><td>${s.final}</td><td class="text-gold">${s.grade}</td></tr>`;
            }
        });
    }
    onValue(ref(db, 'quests'), s => {
        let h = ""; const qs = s.val() || {};
        for(let id in qs) if(qs[id].status === 'OPEN') {
            const att = qs[id].attempts?.[uid] || 0;
            const dLine = qs[id].deadline && qs[id].deadline !== 'Không có' ? ` | Hạn: ${formatDate(qs[id].deadline)}` : '';
            h += `<div class="mission-item"><div><h4 style="margin:0;">${qs[id].title}</h4><small>PP: ${qs[id].rewardPP} | Lượt: ${att}/${qs[id].maxAttempts}${dLine}</small></div><button onclick="openQuiz('${id}')" class="btn-cyber">GIẢI MÃ</button></div>`;
        }
        document.getElementById('student-mission-list').innerHTML = h;
    });
    onValue(ref(db, 'messages'), s => {
        let h = ""; const ms = s.val() || {};
        for(let id in ms) if(ms[id].senderUid === uid) {
            let col = ms[id].status === 'APPROVED' ? '#4ade80' : (ms[id].status === 'REJECTED' ? '#ff004c' : '#ffd700');
            h += `<tr><td>Tố cáo ${ms[id].targetUid}</td><td style="color:${col};font-weight:bold;">${ms[id].status}</td><td>${ms[id].adminReply||'...'}</td></tr>`;
        }
        document.getElementById('student-inbox').innerHTML = h;
    });
    const ctx = document.getElementById('radarChart'); if(ctx) {
        if(window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, { type: 'radar', data: { labels: ['Học','Thể','Tâm','Giao','Phán'], datasets: [{ data: u.stats || [50,50,50,50,50], backgroundColor: 'rgba(255,0,60,0.1)', borderColor: '#ff003c' }] }, options: { plugins: { legend: { display: false } }, scales: { r: { ticks: { display: false }, grid: { color: '#333' } } } } });
    }
}

function loadAdmin() {
    const filter = document.getElementById('filter-class-select').value;
    onValue(ref(db, 'users'), s => {
        let h = ""; const us = s.val() || {}; let count = 0; let arr = [];
        for(let id in us) {
            if(us[id].role === 'STUDENT') {
                if(filter !== 'ALL' && us[id].classKey !== filter) continue;
                arr.push({id, ...us[id]});
            }
        }
        arr.sort((a, b) => {
            const classA = a.classKey || ""; const classB = b.classKey || "";
            if (classA === classB) return (Number(b.pp) || 0) - (Number(a.pp) || 0);
            return classA.localeCompare(classB);
        });
        arr.forEach(u => {
            count++;
            h += `<tr><td>${u.id}</td><td><input type="text" value="${u.name}" onchange="window.upU('${u.id}','name',this.value)" class="cyber-input" style="width:70px;"></td><td><input type="text" value="${u.pass}" onchange="window.upU('${u.id}','pass',this.value)" class="cyber-input" style="width:40px;"></td><td>Y:${u.year} S:${u.sem}</td><td><select onchange="window.upC('${u.id}',this.value)" class="cyber-input">${genClassOptions(u.classKey)}</select></td><td>${(Number(u.pp)||0).toLocaleString()}</td><td><button onclick="window.addPP('${u.id}')" class="btn-mini add">+PP</button><button onclick="window.subPP('${u.id}')" class="btn-mini sub">-PP</button><button onclick="window.openGrades('${u.id}','${u.name}')" class="btn-mini add">XEM</button><button onclick="window.delU('${u.id}')" class="btn-mini del">X</button></td></tr>`;
        });
        document.getElementById('admin-users').innerHTML = h; document.getElementById('student-count').innerText = count;
    });
}

// CÁC HÀM ADMIN
window.addPP = async (id) => { const amt = prompt("CỘNG PP:"); if(amt && !isNaN(amt)) { const s = await get(ref(db, `users/${id}`)); await update(ref(db, `users/${id}`), { pp: (Number(s.val().pp) || 0) + parseInt(amt) }); } };
window.subPP = async (id) => { const amt = prompt("TRỪ PP:"); if(amt && !isNaN(amt)) { const s = await get(ref(db, `users/${id}`)); await update(ref(db, `users/${id}`), { pp: Math.max(0, (Number(s.val().pp) || 0) - parseInt(amt)) }); } };
window.upU = (id, k, v) => update(ref(db, `users/${id}`), { [k]: v });
window.delU = id => confirm("Xóa?") && remove(ref(db, `users/${id}`));
window.upCP = (id, v) => update(ref(db, `classes/${id}`), { cp: parseInt(v) });
window.delQ = id => remove(ref(db, `quests/${id}`));
window.upC = async (id, ck) => { const y = parseInt(ck[1]), block = ck.split('_')[1], name = `${y}-${block}`; await update(ref(db, `users/${id}`), { classKey: ck, class: name, year: y }); };
window.adminCreateQuest = async () => { /* Code giữ nguyên */ };
window.forceInitClasses = async () => { /* Code giữ nguyên */ };
window.changeAvatar = () => { const url = prompt("Link ảnh:"); if(url) update(ref(db, `users/${uid}`), { avatar: url }); };
window.changeTeacherName = () => { const n = prompt("Tên mới:"); if(n) update(ref(db, `users/${uid}`), { name: n }); };
window.closeQuizModal = () => { if(quizTimerInterval) clearInterval(quizTimerInterval); document.getElementById('quiz-modal').style.display = 'none'; };
window.closeViewGradesModal = () => document.getElementById('view-grades-modal').style.display = 'none';
window.sendExpelRequest = async () => { const t = document.getElementById('expel-uid').value, r = document.getElementById('expel-reason').value; await set(ref(db, `messages/msg_${Date.now()}`), { senderUid: uid, senderName: (await get(ref(db, `users/${uid}`))).val().name, targetUid: t, reason: r, status: 'PENDING', adminReply: '' }); alert("ĐÃ GỬI!"); };

// ==========================================
// 🎲 LAS VEGAS ZONE (13 MINIGAMES ENGINE)
// ==========================================

async function executeBet(gameName, logicCallback) {
    let bet = prompt(`[${gameName}]\nNhập số PP bạn muốn cược:`);
    if(!bet) return; bet = parseInt(bet);
    if(isNaN(bet) || bet <= 0) return alert("SỐ PP CƯỢC KHÔNG HỢP LỆ!");

    const snap = await get(ref(db, `users/${uid}`));
    const u = snap.val(); const currentPP = Number(u.pp) || 0;
    
    if(currentPP < bet) return alert(`BẠN CHỈ CÓ ${currentPP.toLocaleString()} PP. KHÔNG ĐỦ ĐỂ CƯỢC!`);
    const { payout, message } = logicCallback(bet);
    await update(ref(db, `users/${uid}`), { pp: currentPP + payout });
    alert(`[${gameName}] KẾT QUẢ:\n\n${message}\n\n=> PP Hiện Tại: ${(currentPP + payout).toLocaleString()}`);
}

window.rollGacha = async () => {
    const snap = await get(ref(db, `users/${uid}`)); const currentPP = Number(snap.val().pp) || 0;
    if(currentPP < 5000) return alert("BẠN KHÔNG ĐỦ 5,000 PP!");
    const r = Math.random()*100; let n = currentPP - 5000, m = "TRẮNG TAY! Bạn mất 5,000 PP 💀";
    if(r > 95) { n += 50000; m = "JACKPOT!!! Trúng 50,000 PP 🎉"; } 
    else if(r > 80) { n += 10000; m = "X2 TÀI SẢN! Lời 10,000 PP 💵"; }
    await update(ref(db, `users/${uid}`), { pp: n }); alert(m);
};

window.playSlot = () => executeBet("SLOT MACHINE", (bet) => {
    const symbols = ['🍒','🍋','🔔','💎','🍉'];
    const s1 = symbols[Math.floor(Math.random()*5)], s2 = symbols[Math.floor(Math.random()*5)], s3 = symbols[Math.floor(Math.random()*5)];
    const res = `[ ${s1} | ${s2} | ${s3} ]`;
    if(s1===s2 && s2===s3) return { payout: bet*9, message: `${res}\nNỔ HŨ X10! BẠN THẮNG TRỌN ${(bet*9).toLocaleString()} PP! 🎰`};
    if(s1===s2 || s2===s3 || s1===s3) return { payout: bet, message: `${res}\nTRÚNG CẶP! X2 TÀI SẢN! 🎉`};
    return { payout: -bet, message: `${res}\nTRẬT LẤT! BẠN THUA ${bet.toLocaleString()} PP! 💀`};
});

window.playCocktail = () => executeBet("COCKTAIL ĐỘC", (bet) => {
    const poison = Math.floor(Math.random()*6);
    if(poison === 0) return { payout: -bet, message: `BẠN ĐÃ UỐNG TRÚNG LY CÓ ĐỘC!\nMẤT SẠCH ${bet.toLocaleString()} PP! 🤢💀`};
    return { payout: Math.floor(bet * 0.2), message: `Rất an toàn! Ly Cocktail thật tuyệt!\nBẠN LỜI THÊM 20% (${Math.floor(bet*0.2).toLocaleString()} PP)! 🍸`};
});

window.playDarts = () => executeBet("PHI TIÊU BAR", (bet) => {
    const score = Math.floor(Math.random()*100)+1;
    if(score > 90) return { payout: bet*4, message: `Hồng tâm! Điểm: ${score}\nBẠN THẮNG X5! NHẬN ${(bet*4).toLocaleString()} PP! 🎯`};
    if(score > 50) return { payout: bet, message: `Trúng bảng! Điểm: ${score}\nBẠN THẮNG X2! 🎉`};
    return { payout: -bet, message: `Phóng trượt ra ngoài! Điểm: ${score}\nBẠN THUA ${bet.toLocaleString()} PP! 💀`};
});

window.playBaccarat = (choice) => executeBet("BACCARAT", (bet) => {
    const player = Math.floor(Math.random()*10), banker = Math.floor(Math.random()*10);
    const win = player > banker ? 'PLAYER' : (banker > player ? 'BANKER' : 'TIE');
    if(win === 'TIE') return { payout: 0, message: `Con: ${player} | Cái: ${banker}\nHÒA NHAU! Hoàn tiền cược.`};
    if(choice === win) return { payout: bet, message: `Con: ${player} | Cái: ${banker}\nBẠN ĐOÁN ĐÚNG! Thắng ${bet.toLocaleString()} PP! 🎉`};
    return { payout: -bet, message: `Con: ${player} | Cái: ${banker}\nBẠN ĐOÁN SAI! Thua ${bet.toLocaleString()} PP! 💀`};
});

window.playCraps = () => executeBet("CRAPS CAO CẤP", (bet) => {
    let guess = prompt("Nhập tổng điểm 2 xúc xắc bạn đoán (Từ 2 đến 12):"); guess = parseInt(guess);
    if(isNaN(guess) || guess < 2 || guess > 12) return { payout: 0, message: "Số không hợp lệ! Hoàn tiền." };
    const d1 = Math.floor(Math.random()*6)+1, d2 = Math.floor(Math.random()*6)+1, sum = d1+d2;
    if(guess === sum) return { payout: bet*5, message: `Xúc xắc: ${d1} và ${d2} (Tổng: ${sum}).\nCHÍNH XÁC!!! BẠN ĂN ĐẬM X6 TIỀN CƯỢC! 🎲🎉`};
    return { payout: -bet, message: `Xúc xắc: ${d1} và ${d2} (Tổng: ${sum}).\nSAI RỒI! BẠN THUA ${bet.toLocaleString()} PP! 💀`};
});

window.playBilliards = () => executeBet("BIDA LỖ", (bet) => {
    const hit = Math.random() < 0.40; // 40% win
    if(hit) return { payout: Math.floor(bet*1.5), message: `Đánh cực kỳ điệu nghệ, Bi đã vào lỗ!\nBẠN THẮNG X2.5 LẦN! 🎱🎉`};
    return { payout: -bet, message: `Trượt mất rồi! Bi đập băng văng ra ngoài.\nBẠN THUA ${bet.toLocaleString()} PP! 💀`};
});

window.playFish = async () => {
    const snap = await get(ref(db, `users/${uid}`)); const currentPP = Number(snap.val().pp) || 0;
    if(currentPP < 10000) return alert("BẠN KHÔNG ĐỦ 10,000 PP MUA ĐẠN!");
    const r = Math.random(); let n = currentPP - 10000, m = "Bắn trượt! Bạn mất 10,000 PP đạn 💀";
    if(r < 0.02) { n += 500000; m = "CHÍU CHÍU!!! HẠ GỤC CÁ MẬP VÀNG X50! (+500,000 PP) 🦈🎇"; } 
    else if(r < 0.1) { n += 100000; m = "BÙM!!! BẮN TRÚNG RÙA THẦN X10! (+100,000 PP) 🐢"; }
    else if(r < 0.3) { n += 30000; m = "Trúng một đàn cá nhỏ x3! (+30,000 PP) 🐟"; }
    await update(ref(db, `users/${uid}`), { pp: n }); alert(m);
};

window.playBomb = () => executeBet("BOM HẸN GIỜ", (bet) => {
    const wires = ['ĐỎ', 'XANH', 'VÀNG'];
    let choice = prompt("Có 3 dây: ĐỎ, XANH, VÀNG. Bạn cắt dây nào?");
    if(!choice) return {payout: 0, message:"Chưa cắt."}; choice = choice.toUpperCase();
    if(!wires.includes(choice)) return { payout: 0, message: "Nhập sai tên dây! Hoàn tiền." };
    const bomb = wires[Math.floor(Math.random()*3)];
    if(choice === bomb) return { payout: -bet, message: `BÙMMMMM!!!! BẠN CẮT NHẦM DÂY BOM!\nMẤT SẠCH ${bet.toLocaleString()} PP! 💥💀`};
    return { payout: Math.floor(bet*0.5), message: `TÍCH TẮC... Bom đã dừng lại! Dây ${bomb} mới là dây nổ.\nBẠN SỐNG SÓT VÀ ĐƯỢC THƯỞNG THÊM 50%! 🎁`};
});

window.playRace = () => executeBet("ĐUA XE ĐÊM", (bet) => {
    let choice = prompt("Chọn xe Vàng (1), Đỏ (2), Xanh (3):"); choice = parseInt(choice);
    if(isNaN(choice) || choice < 1 || choice > 3) return { payout: 0, message: "Không hợp lệ! Hoàn tiền." };
    const winner = Math.floor(Math.random()*3)+1;
    if(choice === winner) return { payout: bet*2, message: `Xe số ${winner} đã Drift về đích đầu tiên!\nBẠN THẮNG X3 TIỀN CƯỢC! 🏎️💨`};
    return { payout: -bet, message: `Xe số ${winner} về nhất! Xe bạn đụng trúng cột điện.\nBẠN THUA ${bet.toLocaleString()} PP! 💀`};
});

window.coinFlip = (c) => executeBet("ĐỒNG XU", (b) => { const r = Math.random()>0.5?'SAP':'NGUA'; return c===r ? {payout:b, message:`Ra ${r}! THẮNG 🎉`} : {payout:-b, message:`Ra ${r}! THUA 💀`}; });
window.playTaiXiu = (c) => executeBet("TÀI XỈU", (b) => { const s = Math.floor(Math.random()*6)+Math.floor(Math.random()*6)+Math.floor(Math.random()*6)+3; const r = (s>=11&&s<=17)?'TAI':'XIU'; return (s===3||s===18)?{payout:-b, message:`BÃO ${s}! THUA 💀`}:(c===r?{payout:b, message:`Tổng ${s}. THẮNG 🎉`}:{payout:-b, message:`Tổng ${s}. THUA 💀`}); });
window.playChanLe = (c) => executeBet("CHẴN LẺ", (b) => { const d = Math.floor(Math.random()*6)+1; const r = d%2===0?'CHAN':'LE'; return c===r ? {payout:b, message:`Ra ${d}! THẮNG 🎉`} : {payout:-b, message:`Ra ${d}! THUA 💀`}; });
window.playRoulette = (c) => executeBet("ROULETTE", (b) => { const r = Math.random(); let rs='BLACK', m=2; if(r<0.05){rs='GREEN';m=14;}else if(r<0.525){rs='RED';m=2;} return c===rs ? {payout:b*(m-1), message:`Ra ${rs}! THẮNG 🎉`} : {payout:-b, message:`Ra ${rs}! THUA 💀`}; });
window.playTerminal = () => executeBet("HACK TERMINAL", (b) => { let n = parseInt(prompt("Nhập mã (1-10):")); if(isNaN(n)) return {payout:0, message:"Lỗi"}; const s = Math.floor(Math.random()*10)+1; return n===s ? {payout:b*8, message:`Mã ${s}! THẮNG X8 💻`} : {payout:-b, message:`Mã ${s}! THUA 💀`}; });
window.playWheel = () => executeBet("NÓN KỲ DIỆU", (b) => { const m = [0, 0, 0.5, 1.5, 2, 3][Math.floor(Math.random()*6)]; const df = Math.floor(b*m)-b; return {payout:df, message:`Vào ô x${m}! Lợi nhuận: ${df.toLocaleString()}`}; });
window.playHighLow = (c) => executeBet("BÀI LỚN NHỎ", (b) => { const p = Math.floor(Math.random()*13)+1, s = Math.floor(Math.random()*13)+1; if(p===s) return {payout:0, message:`Hòa ${p}-${s}`}; return ((c==='HIGH'&&p>s)||(c==='LOW'&&p<s)) ? {payout:b, message:`Bạn ${p} vs Máy ${s}! THẮNG 🎉`} : {payout:-b, message:`Bạn ${p} vs Máy ${s}! THUA 💀`}; });
window.playHorse = (c) => executeBet("ĐUA NGỰA", (b) => { const w = Math.floor(Math.random()*3)+1; return c===w ? {payout:b*2, message:`Ngựa ${w} về nhất! THẮNG 🎉`} : {payout:-b, message:`Ngựa ${w} về nhất! THUA 💀`}; });
window.playBauCua = () => executeBet("BẦU CUA", (b) => { const c = document.getElementById('baucua-choice').value; const r = ['BAU','CUA','TOM','CA','GA','NAI'][Math.floor(Math.random()*6)]; return c===r ? {payout:b*4, message:`Ra ${r}! THẮNG x5 🎉`} : {payout:-b, message:`Ra ${r}! THUA 💀`}; });
window.playChest = (c) => executeBet("RƯƠNG TỬ THẦN", (b) => { const bm = Math.floor(Math.random()*3)+1; return c===bm ? {payout:-b, message:`Rương ${bm} là Bom! THUA 💀`} : {payout:Math.floor(b*0.5), message:`An toàn! Lời 50% 🎉`}; });
window.playLottery = () => executeBet("XỔ SỐ", (b) => { const n = parseInt(prompt("Nhập vé 00-99:")); if(isNaN(n)) return {payout:0, message:"Lỗi"}; const s = Math.floor(Math.random()*100); return n===s ? {payout:b*70, message:`Trúng ${s}! ĐỘC ĐẮC X70 🎉`} : {payout:-b, message:`Xổ ${s}! THUA 💀`}; });
window.rpsGame = (c) => executeBet("KÉO BÚA BAO", (b) => { const s = ['KEO','BUA','BAO'][Math.floor(Math.random()*3)]; if(c===s) return {payout:0, message:`Hòa (${s})`}; return ((c==='KEO'&&s==='BAO')||(c==='BUA'&&s==='KEO')||(c==='BAO'&&s==='BUA')) ? {payout:b, message:`Máy ra ${s}! THẮNG 🎉`} : {payout:-b, message:`Máy ra ${s}! THUA 💀`}; });

// ==========================================
// ⚔️ PvP NEON ARENA (REALTIME MULTIPLAYER)
// ==========================================
window.pvpArena = async () => {
    const action = prompt("⚔️ NEON ARENA (PvP ONLINE)\n\nNhập [ 1 ] - Để TẠO phòng cược mới chờ đối thủ\nNhập [ 2 ] - Để THAM GIA phòng có sẵn\nNhập [ 3 ] - Để GỠ BỎ phòng bạn đã tạo\n\nMời chọn số:");
    if(!action) return;

    if(action === '1') {
        const bet = parseInt(prompt("Nhập số PP bạn muốn đặt cược:"));
        if(isNaN(bet) || bet <= 0) return alert("SỐ CƯỢC KHÔNG HỢP LỆ!");
        
        const snap = await get(ref(db, `users/${uid}`));
        if((Number(snap.val().pp)||0) < bet) return alert("BẠN KHÔNG ĐỦ PP ĐỂ CƯỢC!");
        
        // Trừ tiền trước, giam vào phòng
        await update(ref(db, `users/${uid}`), { pp: snap.val().pp - bet });
        const roomId = `PVP_${Date.now()}`;
        await set(ref(db, `pvp_rooms/${roomId}`), { creator: uid, creatorName: snap.val().name, bet: bet, status: 'WAITING', timestamp: Date.now() });
        alert(`TẠO PHÒNG THÀNH CÔNG!\nBạn đã treo cược ${bet.toLocaleString()} PP.\nHãy chờ người khác vào khớp lệnh!`);
    
    } else if (action === '2') {
        const snap = await get(ref(db, `pvp_rooms`));
        const rooms = snap.val() || {};
        let available = [];
        
        for(let k in rooms) {
            // Lọc các phòng đang chờ và KHÔNG phải do mình tạo
            if(rooms[k].status === 'WAITING' && rooms[k].creator !== uid) {
                available.push({id: k, ...rooms[k]});
            }
        }
        
        if(available.length === 0) return alert("Hiện đang không có ai lập phòng cược!\nHãy là người đầu tiên tạo phòng.");
        
        let listStr = "DANH SÁCH ĐỐI THỦ ĐANG CHỜ:\n\n";
        available.forEach((r, i) => {
            listStr += `[ Phòng ${i} ] - Cược: ${r.bet.toLocaleString()} PP - Bởi: ${r.creatorName}\n`;
        });
        listStr += "\nNhập [ Số Phòng ] bạn muốn tham gia (hoặc bấm Hủy):";
        
        const pick = prompt(listStr);
        if(!pick) return;
        const rIdx = parseInt(pick);
        if(isNaN(rIdx) || !available[rIdx]) return alert("Lựa chọn không hợp lệ!");
        
        const room = available[rIdx];
        const uSnap = await get(ref(db, `users/${uid}`));
        
        if((Number(uSnap.val().pp)||0) < room.bet) return alert(`BẠN CẦN CÓ ÍT NHẤT ${room.bet.toLocaleString()} PP ĐỂ THEO CƯỢC NÀY!`);

        // Khớp lệnh thành công -> Trừ tiền mình
        await update(ref(db, `users/${uid}`), { pp: uSnap.val().pp - room.bet });
        
        // TUNG ĐỒNG XU ĐỊNH MỆNH (50/50)
        const isCreatorWin = Math.random() > 0.5;
        const pool = room.bet * 2; // Tổng tiền cược của 2 người

        if(isCreatorWin) {
            // Đối thủ (Creator) ăn hết
            const cSnap = await get(ref(db, `users/${room.creator}`));
            await update(ref(db, `users/${room.creator}`), { pp: (Number(cSnap.val().pp)||0) + pool });
            alert(`⚔️ KẾT QUẢ TRẬN ĐẤU:\n\nBẠN ĐÃ THUA!\nToàn bộ ${pool.toLocaleString()} PP đã thuộc về ${room.creatorName}. 💀`);
        } else {
            // Mình ăn hết
            const myNewSnap = await get(ref(db, `users/${uid}`));
            await update(ref(db, `users/${uid}`), { pp: (Number(myNewSnap.val().pp)||0) + pool });
            alert(`⚔️ KẾT QUẢ TRẬN ĐẤU:\n\nBẠN ĐÃ CHIẾN THẮNG ÁP ĐẢO!\nHốt trọn ${pool.toLocaleString()} PP từ tay ${room.creatorName}! 🎉`);
        }
        
        // Xóa phòng sau khi đấu xong
        await remove(ref(db, `pvp_rooms/${room.id}`));
        
    } else if (action === '3') {
        const snap = await get(ref(db, `pvp_rooms`));
        const rooms = snap.val() || {};
        let myRoom = null;
        for(let k in rooms) {
            if(rooms[k].status === 'WAITING' && rooms[k].creator === uid) { myRoom = {id: k, ...rooms[k]}; break; }
        }
        if(!myRoom) return alert("Bạn không có phòng nào đang chờ!");
        
        // Hoàn tiền
        const uSnap = await get(ref(db, `users/${uid}`));
        await update(ref(db, `users/${uid}`), { pp: (Number(uSnap.val().pp)||0) + myRoom.bet });
        await remove(ref(db, `pvp_rooms/${myRoom.id}`));
        alert(`Đã gỡ phòng thành công! Hoàn trả ${myRoom.bet.toLocaleString()} PP về tài khoản.`);
    } else {
        alert("Lựa chọn không hợp lệ!");
    }
};
