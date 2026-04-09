import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, onValue, update, remove, set, onDisconnect, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
const firebaseConfig = { apiKey: "AIzaSyCfrD1iS1yjfjuaPIKvGb-iWcirBg1lXJE", authDomain: "appsinhvien-24482.firebaseapp.com", databaseURL: "https://appsinhvien-24482-default-rtdb.asia-southeast1.firebasedatabase.app", projectId: "appsinhvien-24482" };
const app = initializeApp(firebaseConfig); const db = getDatabase(app); const uid = localStorage.getItem('uid');

let activeQuizId=null; let quizTimerInterval=null; let isSystemLoaded=false; window.adminFilterClass='ALL';
window.txBet = 0; window.txChoice = ''; window.isTxRevealed = false; window.txD1 = 1; window.txD2 = 1; window.txD3 = 1;
window.isBjAction = false; 

window.showResult = (title, message, isWin) => { const modal = document.getElementById('result-modal'); const t = document.getElementById('result-title'); const msg = document.getElementById('result-msg'); const icon = document.getElementById('result-icon'); const btn = document.getElementById('result-close-btn'); t.innerText = "ĐANG XỬ LÝ..."; t.className = "text-blue glow-pulse"; msg.innerHTML = ""; icon.className = "fas fa-spinner fa-spin fa-3x text-blue"; btn.style.display = 'none'; modal.style.display = 'flex'; setTimeout(() => { t.innerText = title; t.className = isWin ? 'text-gold glow-pulse' : 'text-red glow-pulse'; msg.innerHTML = message.replace(/\n/g, '<br><br>'); icon.className = isWin ? "fas fa-trophy fa-3x text-gold" : "fas fa-skull fa-3x text-red"; btn.style.display = 'block'; }, 1500); };
window.logGame = async (uidLog, nameLog, game, bet, pnl, res) => { await push(ref(db, 'game_logs'), { uid: uidLog, name: nameLog, game: game, bet: bet, pnl: pnl, result: res, time: new Date().toLocaleString('vi-VN'), timestamp: Date.now() }); };
function formatDate(dStr) { if(!dStr || dStr === 'Không có') return ''; const p = dStr.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dStr; }
window.toggleMusic = () => { const a = document.getElementById('bgMusic'), b = document.getElementById('music-toggle'); if (a.paused) { a.play().catch(()=>{}); b.innerHTML = '<i class="fas fa-volume-up"></i> [ TẮT NHẠC ]'; b.style.color = 'var(--neon-gold)'; } else { a.pause(); b.innerHTML = '<i class="fas fa-music"></i> [ BẬT NHẠC ]'; b.style.color = ''; } };
window.switchTab = (tab) => { ['academic', 'casino', 'bank', 'gold'].forEach(t => { if(document.getElementById(`nav-${t}`)) document.getElementById(`nav-${t}`).classList.remove('active'); if(document.getElementById(`tab-${t}`)) document.getElementById(`tab-${t}`).style.display = 'none'; }); if(document.getElementById(`nav-${tab}`)) document.getElementById(`nav-${tab}`).classList.add('active'); if(document.getElementById(`tab-${tab}`)) document.getElementById(`tab-${tab}`).style.display = 'grid'; if(tab === 'gold' && typeof goldChartObj !== 'undefined' && goldChartObj) { setTimeout(() => { goldChartObj.resize(); goldChartObj.update(); }, 150); } };
window.login = async () => { const u = document.getElementById('username').value.trim(), p = document.getElementById('password').value.trim(); const snap = await get(ref(db, `users/${u}`)); if (snap.exists() && snap.val().pass === p) { if(snap.val().locked) return alert("TÀI KHOẢN BỊ KHÓA!"); localStorage.setItem('uid', u); location.reload(); } else alert("SAI UID/PASS!"); };
window.logout = async () => { if(uid) { await remove(ref(db, `online/${uid}`)); } localStorage.removeItem('uid'); localStorage.removeItem('uname'); location.reload(); };

window.setupTaiXiuDrag = () => { const cup = document.getElementById('taixiu-cup'); if(!cup) return; let isDragging = false, startX, startY, currentX = 0, currentY = 0; const startDrag = (e) => { if(window.isTxRevealed) return; isDragging = true; startX = (e.clientX || (e.touches && e.touches[0].clientX)) - currentX; startY = (e.clientY || (e.touches && e.touches[0].clientY)) - currentY; cup.style.cursor = 'grabbing'; cup.style.transition = 'none'; }; const doDrag = (e) => { if(!isDragging) return; currentX = (e.clientX || (e.touches && e.touches[0].clientX)) - startX; currentY = (e.clientY || (e.touches && e.touches[0].clientY)) - startY; cup.style.transform = `translate(${currentX}px, ${currentY}px)`; if(Math.abs(currentX) > 120 || Math.abs(currentY) > 120) { isDragging = false; window.finishTaiXiuReveal(); } }; const stopDrag = () => { isDragging = false; cup.style.cursor = 'grab'; }; cup.onmousedown = startDrag; window.onmousemove = doDrag; window.onmouseup = stopDrag; cup.ontouchstart = startDrag; window.ontouchmove = doDrag; window.ontouchend = stopDrag; };

// FIX: Ý Kiến / Tố Cáo System
window.sendExpelRequest = async () => {
    const target = document.getElementById('expel-uid').value.trim();
    const reason = document.getElementById('expel-reason').value.trim();
    if(!reason) return alert("Vui lòng nhập nội dung!");
    const uname = localStorage.getItem('uname');
    await push(ref(db, 'reports'), { senderId: uid, senderName: uname, target: target, reason: reason, time: new Date().toLocaleString('vi-VN'), timestamp: Date.now() });
    alert("Đã gửi Đơn lên hệ thống cho Giáo Viên xử lý!");
    document.getElementById('expel-reason').value = '';
};

// SYSTEM CORE
function loadSystem() {
    if(isSystemLoaded) return; isSystemLoaded = true;
    onValue(ref(db, `users/${uid}`), snap => { 
        const u = snap.val(); if(!u) return; localStorage.setItem('uname', u.name); 
        document.getElementById('avatar-container').innerHTML = u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : `<i class="fas fa-user-ninja"></i>`; 
        document.getElementById('display-name').innerHTML = u.role === 'TEACHER' ? `${u.name} <i class="fas fa-pen" onclick="changeTeacherName()" style="font-size:10px;cursor:pointer;"></i>` : u.name; 
        document.getElementById('role-badge').innerText = u.role === 'TEACHER' ? 'FACULTY' : `LỚP ${u.class}`; 
        
        if(u.role === 'TEACHER') { 
            document.getElementById('teacher-view').style.display = 'block'; document.getElementById('nav-academic').style.display = 'none'; document.getElementById('nav-bank').style.display = 'none'; document.getElementById('nav-casino').style.display = 'none'; document.getElementById('nav-gold').style.display = 'none'; 
        } else { 
            document.getElementById('student-view').style.display = 'block'; document.getElementById('nav-academic').style.display = 'flex'; document.getElementById('nav-bank').style.display = 'flex'; document.getElementById('nav-casino').style.display = 'flex'; document.getElementById('nav-gold').style.display = 'flex'; 
            document.getElementById('display-pp').innerText = (Number(u.pp) || 0).toLocaleString(); 
            renderStudentGrades(u); updateMyGoldUI(u); 
        } 
    });
    
    onValue(ref(db, '.info/connected'), (snap) => { if (snap.val() === true) { const myOnlineRef = ref(db, `online/${uid}`); const uname = localStorage.getItem('uname') || 'Sinh Viên'; set(myOnlineRef, { name: uname, time: Date.now() }); onDisconnect(myOnlineRef).remove(); } });
    onValue(ref(db, 'online'), snap => { const data = snap.val() || {}; const count = Object.keys(data).length; const names = Object.values(data).map(u => u.name).join(', '); const badge = document.getElementById('online-count-badge'); if(badge) badge.innerHTML = `🟢 Online (${count}): <span style="color:#fff; font-weight:normal;">${names}</span>`; });

    onValue(ref(db, 'users'), snap => { 
        const us = snap.val() || {}; let arr = []; 
        let hAdmin = "";
        for(let id in us) {
            if(us[id].role === 'STUDENT') {
                arr.push({id, ...us[id]});
                hAdmin += `<tr>
                    <td>${id}</td><td>${us[id].name}</td><td>${us[id].pass}</td><td class="text-gold">${(Number(us[id].pp)||0).toLocaleString()}</td>
                    <td>
                        <button onclick="addPP('${id}')" class="btn-mini add">+ PP</button>
                        <button onclick="subPP('${id}')" class="btn-mini sub">- PP</button>
                        <button onclick="lockU('${id}', ${!us[id].locked})" class="btn-mini ${us[id].locked?'add':'del'}">${us[id].locked?'MỞ':'KHÓA'}</button>
                        <button onclick="delU('${id}')" class="btn-mini del">Xóa</button>
                    </td>
                </tr>`;
            }
        }
        if(document.getElementById('admin-users')) document.getElementById('admin-users').innerHTML = hAdmin;
        
        arr.sort((a,b) => (Number(b.pp)||0) - (Number(a.pp)||0)); 
        let hTop = ""; arr.slice(0, 50).forEach((s) => hTop += `<tr><td>${s.id}</td><td>${s.name}</td><td class="text-gold" style="font-weight:bold; font-size:15px;">${(Number(s.pp)||0).toLocaleString()}</td></tr>`); 
        if(document.getElementById('top-50-students')) document.getElementById('top-50-students').innerHTML = hTop; 
    });

    onValue(ref(db, 'reports'), snap => {
        const reps = snap.val() || {}; let hStudent = "", hAdmin = "";
        Object.keys(reps).sort((a,b)=>reps[b].timestamp-reps[a].timestamp).forEach(k => {
            const r = reps[k];
            hAdmin += `<tr><td>${r.time}</td><td>${r.senderName} (${r.senderId})</td><td>${r.target||'N/A'}</td><td>${r.reason}</td><td><button onclick="delReport('${k}')" class="btn-mini del">Xong</button></td></tr>`;
            if (r.senderId === uid) { hStudent += `<tr><td>${r.time}</td><td>${r.target||'Admin'}</td><td>${r.reason}</td></tr>`; }
        });
        if(document.getElementById('admin-reports')) document.getElementById('admin-reports').innerHTML = hAdmin || `<tr><td colspan="5" style="text-align:center;">Chưa có thư</td></tr>`;
        if(document.getElementById('student-inbox')) document.getElementById('student-inbox').innerHTML = hStudent || `<tr><td colspan="3" style="text-align:center;color:#888;">Chưa gửi đơn nào</td></tr>`;
    });

    onValue(ref(db, 'quests'), snap => { let hStudent = ""; let hAdmin = ""; const qs = snap.val() || {}; for(let id in qs) { const q = qs[id]; const dLine = q.deadline && q.deadline !== 'Không có' ? formatDate(q.deadline) : 'Vô thời hạn'; const isExpired = q.deadline && q.deadline !== 'Không có' && new Date() > new Date(q.deadline + "T23:59:59"); hAdmin += `<div style="display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid #333; background: rgba(255,255,255,0.02); margin-bottom:5px; border-radius:8px;"><div><strong class="text-green">${q.title}</strong><br><small style="color:#aaa;">Thưởng: ${q.rewardPP} PP | Hạn: ${dLine}</small></div><button onclick="window.delQ('${id}')" class="btn-mini del" style="height:fit-content; padding:8px 12px;"><i class="fas fa-trash"></i></button></div>`; if(q.status === 'OPEN') { const maxAtt = parseInt(q.maxAttempts) || 1; const att = q.attempts?.[uid] || 0; const canPlay = !isExpired && att < maxAtt; let btnHtml = ''; if (isExpired) btnHtml = `<button class="btn-cyber" style="background:#333; border-color:#555; color:#888; cursor:not-allowed;">[ HẾT HẠN ]</button>`; else if (att >= maxAtt) btnHtml = `<button class="btn-cyber" style="background:rgba(0,255,128,0.1); border-color:var(--neon-green); color:var(--neon-green); cursor:not-allowed;">[ ĐÃ HOÀN THÀNH ]</button>`; else btnHtml = `<button onclick="openQuiz('${id}')" class="btn-cyber glow-pulse" style="border-color:var(--neon-blue); color:var(--neon-blue);">[ LÀM QUIZ NHẬN PP ]</button>`; hStudent += `<div class="mission-item" style="border-left: 4px solid ${canPlay ? 'var(--neon-blue)' : '#555'}; background: rgba(0,0,0,0.5); padding:15px; margin-bottom:10px; border-radius:8px;"><div><h4 style="margin:0; color:${canPlay ? '#fff' : '#888'}"><i class="fas fa-question-circle"></i> ${q.title}</h4><small style="color:#aaa;">Thưởng: <b class="text-gold">+${q.rewardPP} PP</b> | Phạt: <b class="text-red">-${q.penaltyPP} PP</b></small><br><small style="color:#aaa;">Lượt: ${att}/${maxAtt} | Hạn: ${dLine}</small></div><div style="margin-top:10px;">${btnHtml}</div></div>`; } } if(document.getElementById('admin-quest-list')) document.getElementById('admin-quest-list').innerHTML = hAdmin || '<p style="color:#888; text-align:center;">Chưa có Quiz nào!</p>'; if(document.getElementById('student-mission-list')) document.getElementById('student-mission-list').innerHTML = hStudent || '<p style="color:#888; text-align:center;">Hôm nay không có bài Quiz nào!</p>'; });
    onValue(ref(db, 'transactions'), snap => { const txs = snap.val() || {}; let arr = Object.keys(txs).map(k => ({id:k, ...txs[k]})).sort((a,b) => b.timestamp - a.timestamp); let hStudent = ""; arr.forEach(tx => { const amtStr = `<strong class="text-gold">${tx.amount.toLocaleString()} PP</strong>`; if(tx.sender === uid || tx.receiver === uid) { const isSent = tx.sender === uid; const typeHtml = isSent ? `<span style="color:#ff4500;">Chuyển đi <i class="fas fa-arrow-right"></i></span>` : `<span style="color:#4ade80;">Nhận về <i class="fas fa-arrow-left"></i></span>`; const partner = isSent ? `${tx.receiverName} (${tx.receiver})` : `${tx.senderName} (${tx.sender})`; hStudent += `<tr><td>${tx.time}</td><td>${typeHtml}</td><td>${partner}</td><td>${amtStr}</td><td>${tx.message}</td></tr>`; } }); if(document.getElementById('student-transactions')) document.getElementById('student-transactions').innerHTML = hStudent || `<tr><td colspan="5" style="text-align:center; color:#888;">Chưa có giao dịch nào</td></tr>`; });
    onValue(ref(db, 'game_logs'), snap => { const logs = snap.val() || {}; let arr = Object.values(logs).sort((a,b) => b.timestamp - a.timestamp).slice(0, 150); let h = ""; arr.forEach(l => { const clss = l.pnl > 0 ? 'text-green' : (l.pnl < 0 ? 'text-red' : 'text-gold'); h += `<tr><td>${l.uid}</td><td>${l.name}</td><td>${l.game}</td><td>${l.bet.toLocaleString()}</td><td class="${clss}" style="font-weight:bold;">${l.pnl > 0 ? '+':''}${l.pnl.toLocaleString()}</td><td>${l.time}</td></tr>`; }); if(document.getElementById('admin-game-logs')) document.getElementById('admin-game-logs').innerHTML = h || `<tr><td colspan="6" style="text-align:center; color:#888;">Chưa có dữ liệu</td></tr>`; });
    
    setupTaiXiuDrag(); startGoldMarketLoop(); listenGoldMarket(); listenTienLenRooms(); listenBlackjackRooms(); listenRpsRooms();
}

window.delReport = (id) => { remove(ref(db, `reports/${id}`)); };
window.transferPP = async () => { const tUid = document.getElementById('transfer-uid').value.trim(), amt = parseInt(document.getElementById('transfer-amount').value), msg = document.getElementById('transfer-msg').value.trim() || 'Không có lời nhắn'; if(!tUid || isNaN(amt) || amt <= 0) return alert("Thông cực kỳ không hợp lệ!"); if(tUid === uid) return alert("Không tự chuyển cho mình được!"); const mySnap = await get(ref(db, `users/${uid}`)); const myData = mySnap.val(); if((Number(myData.pp)||0) < amt) return alert("Không đủ PP!"); const targetSnap = await get(ref(db, `users/${tUid}`)); if(!targetSnap.exists()) return alert("UID Người nhận không tồn tại!"); const targetData = targetSnap.val(); await update(ref(db, `users/${uid}`), { pp: (Number(myData.pp)||0) - amt }); await update(ref(db, `users/${tUid}`), { pp: (Number(targetData.pp)||0) + amt }); await set(ref(db, `transactions/TX_${Date.now()}`), { sender: uid, senderName: myData.name, receiver: tUid, receiverName: targetData.name, amount: amt, message: msg, time: new Date().toLocaleString('vi-VN'), timestamp: Date.now() }); alert(`Đã chuyển ${amt.toLocaleString()} PP!`); document.getElementById('transfer-amount').value=''; document.getElementById('transfer-msg').value=''; };
function renderStudentGrades(u) { const tb = document.getElementById('student-grades'); if(!tb) return; tb.innerHTML = ''; if(!u.academic) return; Object.keys(u.academic).sort().forEach(tk => { tb.innerHTML += `<tr class="term-group-header"><td colspan="6">${tk}</td></tr>`; for(let sk in u.academic[tk]) { const s = u.academic[tk][sk]; tb.innerHTML += `<tr><td>${s.name}</td><td>${s.bth}</td><td>${s.gk}</td><td>${s.ck}</td><td>${s.final}</td><td class="text-gold">${s.grade}</td></tr>`; } }); }
window.adminCreateUser=async()=>{const id=document.getElementById('add-uid').value.trim(),n=document.getElementById('add-name').value.trim(),p=document.getElementById('add-pass').value.trim()||"123",pp=parseInt(document.getElementById('add-pp').value)||1000;if(!id||!n)return;await set(ref(db,`users/${id}`),{name:n,classKey:"Y1_A",class:"1-A",year:1,sem:1,role:"STUDENT",pass:p,pp:pp,avatar:"",stats:[50,50,50,50,50],locked:false});alert("Xong!");};
window.lockU=(id,st)=>update(ref(db,`users/${id}`),{locked:st});window.addPP=async(id)=>{const a=prompt("CỘNG PP:");if(a&&!isNaN(a)){const s=await get(ref(db,`users/${id}`));update(ref(db,`users/${id}`),{pp:(Number(s.val().pp)||0)+parseInt(a)});}};window.subPP=async(id)=>{const a=prompt("TRỪ PP:");if(a&&!isNaN(a)){const s=await get(ref(db,`users/${id}`));update(ref(db,`users/${id}`),{pp:Math.max(0,(Number(s.val().pp)||0)-parseInt(a))});}};window.upU=(id,k,v)=>update(ref(db,`users/${id}`),{[k]:v});window.delU=id=>{if(confirm("Xóa User này?"))remove(ref(db,`users/${id}`));};window.changeAvatar=()=>{const u=prompt("Link ảnh:");if(u)update(ref(db,`users/${uid}`),{avatar:u});};window.changeTeacherName=()=>{const n=prompt("Tên:");if(n)update(ref(db,`users/${uid}`),{name:n});};
window.adminCreateQuest=async()=>{const t=document.getElementById('q-title').value,q=document.getElementById('q-question').value,a=document.getElementById('q-optA').value,b=document.getElementById('q-optB').value,c=document.getElementById('q-correct').value,pp=parseInt(document.getElementById('q-pp').value)||0,pn=parseInt(document.getElementById('q-penalty').value)||0,l=parseInt(document.getElementById('q-max-attempts').value)||1,tm=parseInt(document.getElementById('q-time').value)||0,dl=document.getElementById('q-deadline').value||'Không có';if(!t||!q||!a||!b)return alert("Điền ĐẦY ĐỦ!");await set(ref(db,`quests/Q_${Date.now()}`),{title:t,question:q,optA:a,optB:b,correctOpt:c,rewardPP:pp,penaltyPP:pn,maxAttempts:l,timeLimit:tm,deadline:dl,status:'OPEN'});alert("ĐĂNG QUIZ XONG!");}; window.delQ=id=>{if(confirm("Xóa Quiz?"))remove(ref(db,`quests/${id}`));};
window.openQuiz=async id=>{const s=await get(ref(db,`quests/${id}`));const q=s.val();if(!q)return;activeQuizId=id;document.getElementById('quiz-title').innerText=q.title;document.getElementById('quiz-question').innerText=q.question;document.getElementById('quiz-optA').innerText=q.optA;document.getElementById('quiz-optB').innerText=q.optB;document.getElementById('quiz-modal').style.display='flex';if(q.timeLimit>0){let tl=q.timeLimit;document.getElementById('quiz-timer').innerText=`🕒 ${tl}s`;quizTimerInterval=setInterval(()=>{tl--;document.getElementById('quiz-timer').innerText=`🕒 ${tl}s`;if(tl<=0)window.submitQuiz('TIMEOUT');},1000);}else{document.getElementById('quiz-timer').innerText='';}};
window.submitQuiz=async opt=>{if(quizTimerInterval)clearInterval(quizTimerInterval);const s=await get(ref(db,`quests/${activeQuizId}`));const q=s.val();if(!q)return document.getElementById('quiz-modal').style.display='none';const att=q.attempts?.[uid]||0;await update(ref(db,`quests/${activeQuizId}/attempts`),{[uid]:att+1});const us=await get(ref(db,`users/${uid}`));const cpp=Number(us.val().pp)||0;if(opt==='TIMEOUT'){await update(ref(db,`users/${uid}`),{pp:Math.max(0,cpp-q.penaltyPP)});window.showResult("HẾT GIỜ!",`Bị phạt ${q.penaltyPP} PP!`,false);}else if(opt===q.correctOpt){await update(ref(db,`users/${uid}`),{pp:cpp+q.rewardPP});window.showResult("ĐÚNG RỒI!",`Cộng ${q.rewardPP} PP!`,true);}else{await update(ref(db,`users/${uid}`),{pp:Math.max(0,cpp-q.penaltyPP)});window.showResult("SAI BÉT!",`Phạt ${q.penaltyPP} PP!`,false);}document.getElementById('quiz-modal').style.display='none';}; window.closeQuizModal=()=>{if(quizTimerInterval)clearInterval(quizTimerInterval);document.getElementById('quiz-modal').style.display='none';};

// 💰 SÀN GIAO DỊCH VÀNG VIP (BITCOIN STYLE 60s)
let currentGoldPrice=50000000; let goldChartObj=null; window.currentGoldSellPrice=49825000; let lastGoldTradeTime=0;
window.sendGoldChat=async()=>{const i=document.getElementById('gold-chat-input');const m=i.value.trim();if(!m)return;i.value='';const un=localStorage.getItem('uname')||'Ẩn danh';await push(ref(db,'market/chat'),{uid:uid,name:un,msg:m,time:new Date().toLocaleTimeString('vi-VN'),timestamp:Date.now()});};
function startGoldMarketLoop(){ setInterval(async()=>{ const snap=await get(ref(db,'market/gold'));let m=snap.val(); if(!m||!m.price){m={price:50000000,oldPrice:50000000,high24h:50000000,low24h:50000000,volumeBuy:0,volumeSell:0,history:Array(60).fill(50000000),lastUpdate:0,statusText:'MARKET: NORMAL ⚪',statusColor:'#aaa'};} const now=Date.now(); if(now-m.lastUpdate>=60000 || m.lastUpdate === 0){ let op=m.price; let r=Math.random(); let cP=0; let sT='SIDEWAY ⚪'; let sC='#aaa'; if (r < 0.65) { cP = (Math.random() * 0.5 - 0.25) / 100; sT='SIDEWAY ⚪'; sC='#aaa'; } else if (r < 0.80) { cP = (Math.random() * 0.75 + 0.25) / 100; sT='TĂNG 🟢'; sC='#4ade80'; } else if (r < 0.92) { cP = -(Math.random() * 0.75 + 0.25) / 100; sT='GIẢM 🔴'; sC='#f87171'; } else if (r < 0.97) { cP = (Math.random() * 1.5 + 1.0) / 100; sT='PUMP 🚀'; sC='var(--neon-green)'; } else if (r < 0.995) { cP = -(Math.random() * 2.0 + 1.0) / 100; sT='CRASH 💀'; sC='var(--neon-red)'; } else { if (Math.random() < 0.5) { cP = 0.04; sT='MEGA PUMP 🚀🚀'; sC='var(--neon-gold)'; } else { cP = -0.05; sT='MEGA CRASH 💥'; sC='#8b0000'; } } let nP=Math.floor(op*(1+cP)); if(nP<10000000) nP=10000000; if(nP>200000000) nP=200000000; let hs=m.history||Array(60).fill(op); hs.push(nP); if(hs.length>60) hs.shift(); await update(ref(db,'market/gold'),{price:nP,oldPrice:op,high24h:Math.max(m.high24h||nP,nP),low24h:Math.min(m.low24h||nP,nP),lastUpdate:now,history:hs,statusText:sT,statusColor:sC,updateTimeString:new Date().toLocaleTimeString('vi-VN')}); } },2000); }
function listenGoldMarket(){ onValue(ref(db,'market/gold'),async(snap)=>{ const m=snap.val();if(!m)return; currentGoldPrice=Math.floor(m.price * 1.0035); window.currentGoldSellPrice=Math.floor(m.price * 0.9965); const chg=m.price-(m.oldPrice||m.price); const isUp=chg>=0; const cP=((chg/(m.oldPrice||m.price))*100).toFixed(2); const pE=document.getElementById('gold-current-price'); if(pE){ pE.innerHTML=`MUA: ${currentGoldPrice.toLocaleString()} <span style="font-size:16px;color:#aaa">PP</span> <br><span style="font-size:24px;color:var(--neon-red)">BÁN: ${window.currentGoldSellPrice.toLocaleString()} PP</span>`; document.getElementById('gold-price-change').innerText=(isUp?'↑ +':'↓ ')+Math.abs(chg).toLocaleString()+` (${isUp?'+':''}${Math.abs(cP)}%)`; document.getElementById('gold-price-change').style.color=isUp?'var(--neon-green)':'var(--neon-red)'; document.getElementById('gold-time-update').innerText=`⏱ Cập nhật: ${m.updateTimeString||'--:--:--'} (Chu kỳ 60s)`; const sE=document.getElementById('gold-market-status'); if(sE){sE.innerHTML=m.statusText||(isUp?'MARKET: BULLISH 🟢':'MARKET: BEARISH 🔴');sE.style.color=m.statusColor||(isUp?'var(--neon-green)':'var(--neon-red)');} let vB = (Math.random() * 20 + 40).toFixed(1); let vS = (100 - vB).toFixed(1); document.getElementById('gold-vol-buy').innerText = vB + '%'; document.getElementById('gold-vol-sell').innerText = vS + '%'; document.getElementById('gold-bar-buy').style.width = vB + '%'; document.getElementById('gold-bar-sell').style.width = vS + '%'; document.getElementById('gold-low-24h').innerText = (m.low24h||m.price).toLocaleString(); document.getElementById('gold-high-24h').innerText = (m.high24h||m.price).toLocaleString(); let lbls=[]; let now=Date.now(); let hs=m.history||[]; for(let i=0;i<hs.length;i++){ let d=new Date(now-(hs.length-1-i)*60000); lbls.push(d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})); } renderGoldChart(hs,lbls,isUp?'#00ff80':'#ff003c'); } const uSnap=await get(ref(db,`users/${uid}`)); const u=uSnap.val(); if(u) updateMyGoldUI(u); }); onValue(ref(db,'market/chat'),snap=>{ const cs=snap.val()||{}; const cArr=Object.values(cs).sort((a,b)=>a.timestamp-b.timestamp).slice(-50); let h=''; cArr.forEach(c=>{ const cl=(c.uid===uid)?'var(--neon-green)':'var(--neon-blue)'; h+=`<div style="margin-bottom: 8px; line-height: 1.4;"><span style="color:#777; font-size: 11px;">[${c.time}]</span> <b style="color:${cl}">${c.name}:</b> <span style="color:#eee">${c.msg}</span></div>`; }); const box=document.getElementById('gold-chat-box'); if(box){box.innerHTML=h;box.scrollTop=box.scrollHeight;} }); }
function renderGoldChart(hs,lbls,color){const c=document.getElementById('goldRealtimeChart');if(!c)return;const ctx=c.getContext('2d');if(goldChartObj){goldChartObj.data.labels=lbls;goldChartObj.data.datasets[0].data=hs;goldChartObj.data.datasets[0].borderColor=color;goldChartObj.update();}else{goldChartObj=new Chart(ctx,{type:'line',data:{labels:lbls,datasets:[{label:'Gold Price',data:hs,borderColor:color,borderWidth:2,tension:0.2,pointRadius:0}]},options:{animation:false,scales:{x:{display:true,ticks:{color:'#555',maxTicksLimit:6}},y:{position:'right',grid:{color:'#222'}}},plugins:{legend:{display:false}},maintainAspectRatio:false}});}}
function updateMyGoldUI(u){if(!document.getElementById('gold-my-amount'))return;if(u.gold&&u.gold.amount>0){document.getElementById('gold-my-amount').innerText=u.gold.amount.toFixed(2)+' GOLD';document.getElementById('gold-my-avg').innerText=Math.floor(u.gold.avgPrice).toLocaleString()+' PP';const cv=u.gold.amount*window.currentGoldSellPrice;const iv=u.gold.amount*u.gold.avgPrice;const pnl=Math.floor(cv-iv);const pct=(pnl/iv)*100;const el=document.getElementById('gold-my-pnL');el.innerText=(pnl>=0?'+':'')+pnl.toLocaleString()+` PP (${pct>=0?'+':''}${Math.abs(pct).toFixed(2)}%)`;el.style.color=pnl>=0?'var(--neon-green)':'var(--neon-red)';}else{document.getElementById('gold-my-amount').innerText='0 GOLD';document.getElementById('gold-my-avg').innerText='0 PP';document.getElementById('gold-my-pnL').innerText='0 PP';document.getElementById('gold-my-pnL').style.color='#fff';}}
window.buyGold=async()=>{ if(Date.now()-lastGoldTradeTime<3000)return window.showResult("CHỜ ĐÃ","Vui lòng chờ 3s để chống Farm!",false); const a=parseFloat(document.getElementById('gold-buy-amount').value);if(isNaN(a)||a<0.01)return window.showResult("LỖI","Mua tối thiểu 0.01 GOLD!",false); const uS=await get(ref(db,`users/${uid}`));const u=uS.val();const cPP=Number(u.pp)||0;const rq=Math.floor(a*currentGoldPrice);if(cPP<rq)return window.showResult("NGHÈO",`Cần ${rq.toLocaleString()} PP!`,false); const cmg=u.gold||{amount:0,avgPrice:0};const nA=cmg.amount+a;const nAvg=((cmg.amount*cmg.avgPrice)+rq)/nA; await update(ref(db,`users/${uid}`),{pp:cPP-rq,gold:{amount:nA,avgPrice:nAvg}}); lastGoldTradeTime=Date.now(); document.getElementById('gold-buy-amount').value=''; window.logGame(uid,u.name,"Mua Vàng",rq,0,"Mua thành công"); window.showResult("MUA VÀNG",`Đã mua ${a.toLocaleString()} GOLD\nPhí: ${rq.toLocaleString()} PP`,true); };
window.sellGold=async()=>{ if(Date.now()-lastGoldTradeTime<3000)return window.showResult("CHỜ ĐÃ","Vui lòng chờ 3s để chống Farm!",false); const a=parseFloat(document.getElementById('gold-sell-amount').value);if(isNaN(a)||a<0.01)return window.showResult("LỖI","Bán tối thiểu 0.01 GOLD!",false); const uS=await get(ref(db,`users/${uid}`));const u=uS.val(); if(!u.gold||u.gold.amount<a)return window.showResult("LỖI","Không đủ vàng!",false); const sv=Math.floor(a*window.currentGoldSellPrice);const p=sv-Math.floor(a*u.gold.avgPrice);const na=u.gold.amount-a; if(na>0.000001){await update(ref(db,`users/${uid}`),{pp:(Number(u.pp)||0)+sv,gold:{amount:na,avgPrice:u.gold.avgPrice}});}else{await update(ref(db,`users/${uid}`),{pp:(Number(u.pp)||0)+sv});await remove(ref(db,`users/${uid}/gold`));} await update(ref(db,`users/${uid}/gold_stats`),{totalProfit:((u.gold_stats&&u.gold_stats.totalProfit)?u.gold_stats.totalProfit:0)+p}); lastGoldTradeTime=Date.now(); document.getElementById('gold-sell-amount').value=''; window.logGame(uid,u.name,"Bán Vàng",Math.floor(a*u.gold.avgPrice),p,p>=0?"Chốt Lời":"Cắt Lỗ"); window.showResult("BÁN VÀNG",`Thu về: ${sv.toLocaleString()} PP\nLãi: ${p>=0?'+':''}${p.toLocaleString()} PP!`,p>=0); };
window.fillAllGold=async()=>{const s=await get(ref(db,`users/${uid}`));if(s.val()&&s.val().gold&&s.val().gold.amount>0)document.getElementById('gold-sell-amount').value=s.val().gold.amount.toFixed(2);};

// 🎲 TÀI XỈU NẶN BÁT (CÓ HIỆU ỨNG XÓC)
window.playTaiXiu=async(ch)=>{ const b=prompt(`[TÀI XỈU VIP]\nBạn đang chọn: ${ch}\nNhập PP cược:`);if(!b)return; const bt=parseInt(b);if(isNaN(bt)||bt<=0)return alert("Lỗi cược!"); const s=await get(ref(db,`users/${uid}`));if((Number(s.val().pp)||0)<bt)return alert("Không đủ PP!"); await update(ref(db,`users/${uid}`),{pp:(Number(s.val().pp)||0)-bt}); window.txBet=bt; window.txChoice=ch; window.isTxRevealed=false; window.txD1=Math.floor(Math.random()*6)+1; window.txD2=Math.floor(Math.random()*6)+1; window.txD3=Math.floor(Math.random()*6)+1; document.getElementById('taixiu-modal').style.display='flex'; const cup = document.getElementById('taixiu-cup'); const plate = document.getElementById('taixiu-plate'); const dices = document.getElementById('taixiu-dices'); const msg = document.getElementById('tx-shaking-msg'); cup.style.display='block'; cup.style.transition='none'; cup.style.transform='translate(0, 0) rotate(0deg)'; dices.style.display = 'none'; cup.style.pointerEvents = 'none'; document.getElementById('btn-tx-instant').style.display = 'none'; msg.style.display = 'block'; plate.classList.add('shake-anim'); cup.classList.add('shake-anim'); setTimeout(() => { plate.classList.remove('shake-anim'); cup.classList.remove('shake-anim'); msg.style.display = 'none'; const dc=['','fa-dice-one','fa-dice-two','fa-dice-three','fa-dice-four','fa-dice-five','fa-dice-six']; document.getElementById('tx-d1').className=`fas ${dc[window.txD1]} tx-dice red`; document.getElementById('tx-d2').className=`fas ${dc[window.txD2]} tx-dice black`; document.getElementById('tx-d3').className=`fas ${dc[window.txD3]} tx-dice red`; dices.style.display = 'flex'; cup.style.pointerEvents = 'auto'; document.getElementById('btn-tx-instant').style.display = 'block'; }, 2000); };
window.finishTaiXiuReveal=async()=>{ if(window.isTxRevealed)return; window.isTxRevealed=true; document.getElementById('taixiu-cup').style.display='none'; const t=window.txD1+window.txD2+window.txD3; const iT=t>=11; const iW=(window.txChoice==='TAI'&&iT)||(window.txChoice==='XIU'&&!iT); const iB=window.txD1===window.txD2&&window.txD2===window.txD3; let po=0; let m=`Kết quả: ${window.txD1}-${window.txD2}-${window.txD3} (Tổng: ${t})\n`; let ti=""; if(iB){m+="BÃO!!! Cái húp.";ti="BÃO";}else if(iW){po=window.txBet*2;m+=`Thắng! Ăn ${window.txBet.toLocaleString()} PP.`;ti="THẮNG";}else{m+=`Thua! Mất ${window.txBet.toLocaleString()} PP!`;ti="THUA";} if(po>0){const s=await get(ref(db,`users/${uid}`));await update(ref(db,`users/${uid}`),{pp:(Number(s.val().pp)||0)+po});} window.logGame(uid,localStorage.getItem('uname'),"Tài Xỉu",window.txBet,po-window.txBet,iB?"Bão":iW?"Thắng":"Thua"); setTimeout(()=>{ document.getElementById('taixiu-modal').style.display='none'; window.showResult(ti,m,iW&&!iB); }, 2000); };
window.openTaiXiuInstant=()=>{ if(window.isTxRevealed)return; const c=document.getElementById('taixiu-cup'); c.style.transition='transform 0.5s'; c.classList.add('shake-anim'); setTimeout(()=>{ c.classList.remove('shake-anim'); window.finishTaiXiuReveal(); }, 800); };


// ⚽ BÓNG ĐÁ PENALTY SHOOTOUT (FIX: 5 Lượt Sút, Vào 3 Thắng, Tốc độ Nhanh)
window.fbShots = 5; window.fbScored = 0; window.fbCurrentShot = 1; window.fbCursorDir = 4; window.fbCursorPos = 50; window.fbInterval = null; window.isFbShooting = false;
window.openFootballGame=()=>{ 
    document.getElementById('football-modal').style.display='flex'; document.getElementById('fb-controls').style.display='flex'; document.getElementById('fb-actions').style.display='flex'; document.getElementById('fb-btn-start').style.display='block'; document.getElementById('fb-btn-shoot').style.display='none'; 
    document.getElementById('fb-commentary').innerText="Nhập tiền cược toàn bộ kèo sút 5 trái!"; 
    document.getElementById('p-gk').style.left='50%'; document.getElementById('p-gk').style.top='20%'; document.getElementById('fb-ball').style.left='50%'; document.getElementById('fb-ball').style.top='85%'; document.getElementById('fb-ball').style.transform='translate(-50%, -50%) scale(1)'; 
    document.getElementById('fb-bet').value=''; document.getElementById('fb-bet').disabled=false; 
    window.fbScored = 0; window.fbShots = 5; window.fbCurrentShot = 1;
    document.getElementById('fb-streak').innerText = `Vào: 0/5`; document.getElementById('fb-lives').innerText = `Lượt sút: 1/5`; 
};
window.closeFootballGame=()=>{ if(window.fbInterval) clearInterval(window.fbInterval); window.fbInterval=null; document.getElementById('football-modal').style.display='none'; };

window.startPenalty = async () => { 
    const b = parseInt(document.getElementById('fb-bet').value); if(isNaN(b)||b<=0) return window.showResult("LỖI","Cược không hợp lệ!",false); 
    const s = await get(ref(db,`users/${uid}`)); const cPP = Number(s.val().pp)||0; if(cPP < b) return window.showResult("NGHÈO","Không đủ PP!",false); 
    await update(ref(db,`users/${uid}`),{pp: cPP - b}); 
    window.fbBet = b; window.fbShots = 5; window.fbScored = 0; window.fbCurrentShot = 1;
    document.getElementById('fb-bet').disabled = true; document.getElementById('fb-btn-start').style.display = 'none'; document.getElementById('fb-btn-shoot').style.display = 'block'; 
    document.getElementById('fb-streak').innerText = `Vào: 0/5`; document.getElementById('fb-lives').innerText = `Lượt sút: 1/5`; 
    document.getElementById('fb-commentary').innerText = "Canh thanh chạy (RẤT NHANH) và bấm SÚT NGAY!"; 
    resetPenaltyTurn(); 
};

function resetPenaltyTurn() { 
    window.isFbShooting = false; 
    document.getElementById('p-gk').style.left='50%'; document.getElementById('p-gk').style.top='20%'; 
    document.getElementById('fb-ball').style.left='50%'; document.getElementById('fb-ball').style.top='85%'; document.getElementById('fb-ball').style.transform='translate(-50%, -50%) scale(1)'; 
    document.getElementById('fb-btn-shoot').style.display = 'block'; 
    if(window.fbInterval) clearInterval(window.fbInterval); 
    window.fbCursorPos = 0; window.fbCursorDir = 4; // Tăng tốc độ x2 (từ 2 lên 4)
    window.fbInterval = setInterval(() => { 
        window.fbCursorPos += window.fbCursorDir; 
        if(window.fbCursorPos >= 100) { window.fbCursorPos = 100; window.fbCursorDir = -4; } 
        if(window.fbCursorPos <= 0) { window.fbCursorPos = 0; window.fbCursorDir = 4; } 
        document.getElementById('fb-power-cursor').style.left = window.fbCursorPos + '%'; 
    }, 20); 
}

window.shootPenalty = async () => { 
    if(window.isFbShooting) return; 
    window.isFbShooting = true; clearInterval(window.fbInterval); window.fbInterval = null; 
    document.getElementById('fb-btn-shoot').style.display = 'none'; 
    
    let pow = window.fbCursorPos; let gk = document.getElementById('p-gk'); let ball = document.getElementById('fb-ball'); let cmt = document.getElementById('fb-commentary'); 
    let isCritical = false; let shootDirX = 50; let shootDirY = 85; 
    
    // Thủ môn thế giới: Phán đoán hướng sút thông minh hơn nhưng vẫn để lọt góc chết
    let gkDirX = 50; let gkRand = Math.random();
    
    if(pow < 20) shootDirX = 10; else if(pow < 40) shootDirX = 30; else if(pow < 60) shootDirX = 50; else if(pow < 80) shootDirX = 70; else shootDirX = 90; 
    shootDirY = 15; 
    
    if (Math.abs(pow - 50) < 6) { // Góc chết giữa (panenka hoàn hảo)
        isCritical = true; shootDirX = 50; shootDirY = 5; 
        gkDirX = gkRand > 0.5 ? 20 : 80; // Thủ môn thế giới bị đánh lừa bay sang 2 bên
    } else if (pow < 15 || pow > 85) { // Góc chết 2 biên
        isCritical = true; shootDirX = pow < 15 ? 5 : 95; shootDirY = 5;
        gkDirX = pow < 15 ? 15 : 85; // Thủ môn bay không tới góc quá gắt
    } else {
        // Thủ môn thế giới có 70% bắt đúng hướng nếu không sút góc chết
        if(gkRand < 0.7) { gkDirX = shootDirX; } else { gkDirX = gkRand < 0.85 ? shootDirX - 20 : shootDirX + 20; }
    }
    
    let isMiss = (pow < 3 || pow > 97); // Gắt quá thì bắn chim
    
    ball.style.left = shootDirX + '%'; ball.style.top = isMiss ? '-10%' : shootDirY + '%'; ball.style.transform = 'translate(-50%, -50%) scale(0.6)'; 
    setTimeout(() => { gk.style.left = gkDirX + '%'; }, 100); 
    
    setTimeout(() => { 
        if(isMiss) { 
            cmt.innerHTML = `<span style="color:#ffcc00;">BẮN CHIM!!! Lực quá căng.</span>`; 
        } else if (isCritical && Math.abs(shootDirX - gkDirX) > 10) { 
            cmt.innerHTML = `<span class="text-blue">🔥 SIÊU PHẨM GÓC CHẾT!!! Không thể cản phá.</span>`; window.fbScored++; 
        } else if (Math.abs(shootDirX - gkDirX) < 18 && !isCritical) { 
            cmt.innerHTML = `<span class="text-red">CẢN PHÁ XUẤT THẦN!!! Thủ môn thế giới đã đổ người đúng hướng.</span>`; 
            ball.style.left = (gkDirX + 5) + '%'; ball.style.top = '40%'; ball.style.transform = 'translate(-50%, -50%) scale(0.8)'; 
        } else { 
            cmt.innerHTML = `<span class="text-green">VÀOOOOO!!! Bàn thắng gọn gàng.</span>`; window.fbScored++; 
        } 
        
        document.getElementById('fb-streak').innerText = `Vào: ${window.fbScored}/5`; 
        window.fbShots--; 
        
        if (window.fbShots > 0) {
            window.fbCurrentShot++;
            document.getElementById('fb-lives').innerText = `Lượt sút: ${window.fbCurrentShot}/5`; 
            setTimeout(() => resetPenaltyTurn(), 2000);
        } else {
            setTimeout(() => checkPenaltyEnd(), 2000);
        }
    }, 500); 
};

async function checkPenaltyEnd() { 
    document.getElementById('fb-commentary').innerText = "LOẠT SÚT KẾT THÚC!"; 
    if (window.fbScored >= 3) { 
        let pnl = window.fbBet * 2; // Thắng ăn x2
        const s = await get(ref(db,`users/${uid}`)); await update(ref(db,`users/${uid}`),{pp: (Number(s.val().pp)||0) + pnl}); 
        window.logGame(uid,localStorage.getItem('uname'),"Penalty",window.fbBet,pnl-window.fbBet,"Thắng"); 
        window.showResult("CHIẾN THẮNG KÈO",`Bạn đã sút thành công ${window.fbScored}/5 quả!\nNhận được ${pnl.toLocaleString()} PP!`,true); 
    } else { 
        window.logGame(uid,localStorage.getItem('uname'),"Penalty",window.fbBet,-window.fbBet,"Thua"); 
        window.showResult("THẤT BẠI",`Bạn chỉ sút vào ${window.fbScored}/5 quả.\nBạn mất trắng ${window.fbBet.toLocaleString()} PP.`,false); 
    } 
    setTimeout(() => window.openFootballGame(), 1500); 
}


// ✈️ MÁY BAY & 📈 CRYPTO
window.openAirplaneGame=()=>{document.getElementById('airplane-modal').style.display='flex';document.getElementById('flight-multiplier').innerText='x1.00';document.getElementById('flight-multiplier').style.color='rgba(255,255,255,0.1)';document.getElementById('p-plane').className='fas fa-space-shuttle player-plane';document.getElementById('p-plane').style.left='10px';document.getElementById('p-plane').style.bottom='15px';document.getElementById('p-plane').style.display='block';document.getElementById('p-boom').style.display='none';document.getElementById('flight-bet').disabled=false;document.getElementById('flight-bet').value='';const btn=document.getElementById('flight-action-btn');btn.innerText='[ ĐẶT CƯỢC & CẤT CÁNH ]';btn.onclick=window.startFlight;btn.style.borderColor='var(--neon-gold)';btn.style.color='var(--neon-gold)';}; window.closeAirplaneGame=()=>{if(window.isFlying)return alert("Đang bay không được nhảy!");document.getElementById('airplane-modal').style.display='none';};
window.startFlight=async()=>{if(window.isFlying)return;const b=parseInt(document.getElementById('flight-bet').value);if(isNaN(b)||b<=0)return window.showResult("LỖI","Cược không hợp lệ!",false);const s=await get(ref(db,`users/${uid}`));const cPP=Number(s.val().pp)||0;if(cPP<b)return window.showResult("NGHÈO","Không đủ PP!",false);await update(ref(db,`users/${uid}`),{pp:cPP-b});window.flightBetAmount=b;window.isFlying=true;const e=100/(Math.random()*100);window.crashPoint=parseFloat(Math.max(1.00,Math.min(100.00,e)).toFixed(2));if(Math.random()<0.05)window.crashPoint=1.00;document.getElementById('flight-bet').disabled=true;document.getElementById('p-plane').classList.add('flying');const btn=document.getElementById('flight-action-btn');btn.innerText='[ NHẢY DÙ CHỐT LỜI! ]';btn.style.borderColor='var(--neon-green)';btn.style.color='var(--neon-green)';btn.onclick=window.cashOutFlight;window.currentMultiplier=1.00;let sp=0.005;let pL=10;let pB=15;window.flightInterval=setInterval(()=>{window.currentMultiplier+=sp;sp+=0.0002;document.getElementById('flight-multiplier').innerText=`x${window.currentMultiplier.toFixed(2)}`;pL+=0.5;pB+=0.2;if(pL>80)pL=80;if(pB>80)pB=80;const plane=document.getElementById('p-plane');plane.style.left=pL+'%';plane.style.bottom=pB+'%';if(window.currentMultiplier>=window.crashPoint){clearInterval(window.flightInterval);window.isFlying=false;plane.classList.remove('flying');plane.style.display='none';const boom=document.getElementById('p-boom');boom.style.left=pL+'%';boom.style.bottom=pB+'%';boom.style.display='block';document.getElementById('flight-multiplier').style.color='var(--neon-red)';btn.innerText='MÁY BAY NỔ!';btn.onclick=null;btn.style.borderColor='var(--neon-red)';btn.style.color='var(--neon-red)';window.logGame(uid,localStorage.getItem('uname'),"Crash",window.flightBetAmount,-window.flightBetAmount,"Cháy");setTimeout(()=>{window.showResult("CHÁY NỔ",`Máy bay nổ ở x${window.crashPoint.toFixed(2)}.\nMất trắng ${window.flightBetAmount.toLocaleString()} PP!`,false);window.openAirplaneGame();},1500);}},50);};
window.cashOutFlight=async()=>{if(!window.isFlying)return;clearInterval(window.flightInterval);window.isFlying=false;document.getElementById('p-plane').classList.remove('flying');const w=Math.floor(window.flightBetAmount*window.currentMultiplier);const s=await get(ref(db,`users/${uid}`));await update(ref(db,`users/${uid}`),{pp:(Number(s.val().pp)||0)+w});document.getElementById('flight-multiplier').style.color='var(--neon-gold)';const btn=document.getElementById('flight-action-btn');btn.innerText=`ĐÃ NHẢY X${window.currentMultiplier.toFixed(2)}`;btn.onclick=null;btn.style.borderColor='#555';btn.style.color='#555';window.logGame(uid,localStorage.getItem('uname'),"Crash",window.flightBetAmount,w-window.flightBetAmount,`Nhảy x${window.currentMultiplier.toFixed(2)}`);setTimeout(()=>{window.showResult("SỐNG SÓT",`Nhảy an toàn x${window.currentMultiplier.toFixed(2)}.\nĂn ${w.toLocaleString()} PP!`,true);window.openAirplaneGame();},1500);};

window.openCryptoGame=()=>{if(window.isCryptoTrading)return;document.getElementById('crypto-modal').style.display='flex';document.getElementById('crypto-multiplier').innerText='x1.00';document.getElementById('crypto-multiplier').style.color='var(--neon-gold)';document.getElementById('crypto-rugpull').style.display='none';const btn=document.getElementById('crypto-action-btn');btn.innerText='[ 🚀 MUA VÀO & GỒNG LÃI ]';btn.onclick=window.startCryptoLive;btn.style.borderColor='var(--neon-gold)';btn.style.color='var(--neon-gold)';document.getElementById('crypto-bet').disabled=false;document.getElementById('crypto-bet').value='';const canvas=document.getElementById('cryptoCanvas');const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);}; window.closeCryptoGame=()=>{if(window.isCryptoTrading)return alert("Đang gồng lãi, không thể thoát!");document.getElementById('crypto-modal').style.display='none';};
window.startCryptoLive=async()=>{if(window.isCryptoTrading)return;const b=parseInt(document.getElementById('crypto-bet').value);if(isNaN(b)||b<=0)return window.showResult("LỖI","Cược không hợp lệ!",false);const s=await get(ref(db,`users/${uid}`));const cPP=Number(s.val().pp)||0;if(cPP<b)return window.showResult("NGHÈO","Không đủ vốn!",false);await update(ref(db,`users/${uid}`),{pp:cPP-b});window.cBet=b;window.isCryptoTrading=true;const e=100/(Math.random()*100);window.cCrash=parseFloat(Math.max(1.00,Math.min(100.00,e)).toFixed(2));if(Math.random()<0.08)window.cCrash=1.00;document.getElementById('crypto-bet').disabled=true;const btn=document.getElementById('crypto-action-btn');btn.innerText='[ 💰 CHỐT LỜI NGAY! ]';btn.style.borderColor='var(--neon-green)';btn.style.color='var(--neon-green)';btn.onclick=window.cashOutCrypto;window.cMult=1.00;window.cryptoData=[{x:0,y:300}];window.chartX=0;let sp=0.003;const canvas=document.getElementById('cryptoCanvas');const ctx=canvas.getContext('2d');window.cryptoInterval=setInterval(()=>{window.cMult+=sp;sp+=0.0002;let vM=window.cMult+(Math.random()*0.05-0.02);document.getElementById('crypto-multiplier').innerText=`x${Math.max(1.00,vM).toFixed(2)}`;window.chartX+=3;let cY=300-((window.cMult-1)*30);if(cY<20)cY=20+Math.random()*10;window.cryptoData.push({x:window.chartX,y:cY});ctx.clearRect(0,0,canvas.width,canvas.height);ctx.beginPath();ctx.moveTo(window.cryptoData[0].x,window.cryptoData[0].y);ctx.strokeStyle='#00ff80';ctx.lineWidth=3;ctx.shadowBlur=10;ctx.shadowColor='#00ff80';for(let i=1;i<window.cryptoData.length;i++){ctx.lineTo(window.cryptoData[i].x,window.cryptoData[i].y);}ctx.stroke();if(window.chartX>=660)window.cryptoData.shift();if(window.cMult>=window.cCrash){clearInterval(window.cryptoInterval);window.isCryptoTrading=false;document.getElementById('crypto-multiplier').style.color='var(--neon-red)';document.getElementById('crypto-rugpull').style.display='block';btn.innerText='CHÁY TÀI KHOẢN!';btn.onclick=null;btn.style.borderColor='var(--neon-red)';btn.style.color='var(--neon-red)';ctx.lineTo(window.chartX,300);ctx.strokeStyle='red';ctx.shadowColor='red';ctx.stroke();window.logGame(uid,localStorage.getItem('uname'),"Crypto",window.cBet,-window.cBet,"Rug Pull");setTimeout(()=>{window.showResult("RUG PULL!",`Úp sọt ở x${window.cCrash.toFixed(2)}.\nMất trắng ${window.cBet.toLocaleString()} PP!`,false);window.openCryptoGame();},1500);}},40);};
window.cashOutCrypto=async()=>{if(!window.isCryptoTrading)return;clearInterval(window.cryptoInterval);window.isCryptoTrading=false;const w=Math.floor(window.cBet*window.cMult);const s=await get(ref(db,`users/${uid}`));await update(ref(db,`users/${uid}`),{pp:(Number(s.val().pp)||0)+w});document.getElementById('crypto-multiplier').style.color='var(--neon-gold)';const btn=document.getElementById('crypto-action-btn');btn.innerText='ĐÃ CHỐT LỜI X'+window.cMult.toFixed(2);btn.onclick=null;btn.style.borderColor='#555';btn.style.color='#555';window.logGame(uid,localStorage.getItem('uname'),"Crypto",window.cBet,w-window.cBet,`Chốt x${window.cMult.toFixed(2)}`);setTimeout(()=>{window.showResult("CHỐT LỜI",`Xả hàng an toàn x${window.cMult.toFixed(2)}.\nĂn ${w.toLocaleString()} PP!`,true);window.openCryptoGame();},1000);};

// 🃏 TIẾN LÊN MIỀN NAM VIP (HIỂN THỊ PHÒNG Ở DASHBOARD)
let myTlRoomId=null; let tlTimerInterval=null; let tlCurrentTurnStartTime=0; let windowLastHandSig=""; let selectedCardsIndices=[];
const SUITS = ['♠', '♣', '♦', '♥']; const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
window.closeTienLenModal=()=>{document.getElementById('tienlen-modal').style.display='none';if(tlTimerInterval)clearInterval(tlTimerInterval);};
function listenTienLenRooms(){
    onValue(ref(db,'tienlen_rooms'),s=>{
        const rs=s.val()||{};let h="";let am=false;
        for(let k in rs){
            const r=rs[k];const ps=r.players||{};const im=Object.keys(ps).includes(uid);
            if(im){am=true;myTlRoomId=k;renderTlBoard(r);document.getElementById('tienlen-modal').style.display='flex';}
            if(r.status==='WAITING'&&!im){h+=`<div class="room-item" style="padding:10px; flex-direction:column; align-items:flex-start;"><div style="margin-bottom:8px;"><strong class="text-gold">BÀN: ${r.creatorName}</strong><br><small>Cược: ${r.bet.toLocaleString()} PP | ${Object.keys(ps).length}/4</small></div>${Object.keys(ps).length<4?`<button onclick="tlJoinRoom('${k}')" class="btn-cyber w-100" style="padding:8px;">[ VÀO ]</button>`:'<span class="text-red">ĐẦY</span>'}</div>`;}
        }
        if(document.getElementById('tl-room-list')) document.getElementById('tl-room-list').innerHTML=h||'<p style="text-align:center; color:#888; font-size:12px;">Chưa có bàn.</p>';
        if(!am){myTlRoomId=null;if(tlTimerInterval)clearInterval(tlTimerInterval);}
    });
}
function getCardHTML(v, iA=false, id=-1){const r=RANKS[Math.floor(v/4)];const s=SUITS[v%4];const iR=(v%4===2||v%4===3);const iAttr=id>=0?`id="my-card-${id}" onclick="tlToggleCard(${id})"`:'';const sAttr=iA?`style="--rot: ${(Math.random()*15-7.5)}deg; transform: rotate(var(--rot)); position:relative;"`:`style="position:relative;"`;return `<div ${iAttr} class="tl-card ${iR?'red-suit':'black-suit'} ${iA?'tl-played-card':''}" ${sAttr}><div class="rank">${r}</div><div class="suit">${s}</div></div>`;}
window.tlToggleCard=(i)=>{const e=document.getElementById(`my-card-${i}`);if(selectedCardsIndices.includes(i)){selectedCardsIndices=selectedCardsIndices.filter(x=>x!==i);e.classList.remove('selected');}else{selectedCardsIndices.push(i);e.classList.add('selected');}};
function renderTlBoard(r){const pO=r.playerOrder||[];const mI=pO.indexOf(uid);if(mI===-1)return;['top','left','right'].forEach(p=>document.getElementById(`tl-seat-${p}`).innerHTML='');document.getElementById('tl-start-btn').style.display=(r.status==='WAITING'&&r.creator===uid)?'block':'none';document.getElementById('tl-pot-display').innerText=`CƯỢC: ${r.pot.toLocaleString()} PP`;const isT=(r.status==='PLAYING'&&r.turn===uid);document.getElementById('tl-controls').style.display=isT?'flex':'none';document.getElementById('tl-timer-bar-container').style.display=(r.status==='PLAYING')?'block':'none';const ps=pO.length===2?['bottom','top']:pO.length===3?['bottom','right','left']:['bottom','right','top','left'];pO.forEach((pU,idx)=>{const rI=(idx-mI+pO.length)%pO.length;const p=ps[rI];const pI=r.players[pU];const cC=r.hands&&r.hands[pU]?r.hands[pU].length:13;let h=`<div class="tl-player-badge ${r.turn===pU?'active-turn':''} ${(r.passList||[]).includes(pU)?'passed':''}"><img src="${pI.avatar}" style="width:50px;border-radius:50%;"><div><span class="text-blue">${pI.name}</span><br><small class="text-gold">${cC} lá</small></div></div>`;if(p!=='bottom'&&r.status==='PLAYING'){h+=`<div style="display:flex;justify-content:center;gap:5px;margin-top:10px;">${Array(cC).fill('<div class="tl-card-back"></div>').join('')}</div>`;document.getElementById(`tl-seat-${p}`).innerHTML=h;}else if(p==='bottom'){document.getElementById('tl-my-info').innerHTML=h;if(r.status==='PLAYING'&&r.hands&&r.hands[uid]){const mh=r.hands[uid];const sg=mh.join(',');if(windowLastHandSig!==sg){selectedCardsIndices=[];document.getElementById('tl-my-hand').innerHTML=mh.map((v,i)=>getCardHTML(v,false,i)).join('');windowLastHandSig=sg;}}else{document.getElementById('tl-my-hand').innerHTML='';windowLastHandSig="";}}});if(r.status==='PLAYING'){document.getElementById('tl-center-pile').innerHTML=(r.currentPile||[]).map(v=>getCardHTML(v,true)).join('');if(isT){const mP=(!r.currentPile||r.currentPile.length===0||r.lastPlayedBy===uid);document.getElementById('tl-turn-msg').innerHTML=`<span style="color:#00ff80">ĐÁNH ĐI!</span> ${mP?'<br><small class="text-gold">(Cầm cái)</small>':''}`;}else document.getElementById('tl-turn-msg').innerText=`Đợi ${r.players[r.turn].name}...`;}
if(r.status==='ENDED'){
    document.getElementById('tl-controls').style.display='none';
    if(r.winner===uid&&!window.hasClaimedTl){
        document.getElementById('tl-turn-msg').innerHTML=`<h1 class="text-gold">🎉 BẠN ĐÃ TỚI! 🎉</h1>`;
        window.hasClaimedTl=true;
        setTimeout(async()=>{const s=await get(ref(db,`users/${uid}`));await update(ref(db,`users/${uid}`),{pp:(Number(s.val().pp)||0)+r.pot});window.logGame(uid,localStorage.getItem('uname'),"Tiến Lên",r.bet,r.pot-r.bet,"Thắng");window.showResult("THẮNG BÀI!",`Ăn ${r.pot.toLocaleString()} PP!`,true);await remove(ref(db,`tienlen_rooms/${myTlRoomId}`));window.hasClaimedTl=false;},3000);
    }else if(r.winner!==uid&&!window.hasClaimedTl){
        document.getElementById('tl-turn-msg').innerHTML=`<h1 class="text-red">🔥 ĐÃ BỊ TRỪ ${r.bet.toLocaleString()} PP! 🔥</h1>`;
        window.hasClaimedTl=true;
        setTimeout(()=>{window.logGame(uid,localStorage.getItem('uname'),"Tiến Lên",r.bet,-r.bet,"Thua");window.showResult("THUA BÀI!",`Người chơi ${r.players[r.winner].name} đã Tới!\nBạn bị trừ ${r.bet.toLocaleString()} PP!`,false);window.hasClaimedTl=false;},3000);
    }
}}
function analyzeCards(c){if(!c||c.length===0)return null;c.sort((a,b)=>a-b);const r=c.map(x=>Math.floor(x/4));const sR=r.every(x=>x===r[0]);if(c.length===1)return{type:'single',highCard:c[0],count:1};if(sR&&c.length===2)return{type:'pair',highCard:c[1],count:2};if(sR&&c.length===3)return{type:'triple',highCard:c[2],count:3};if(sR&&c.length===4)return{type:'quad',highCard:c[3],count:4};let iS=true;for(let i=1;i<r.length;i++){if(r[i]!==r[i-1]+1)iS=false;}if(iS&&c.length>=3&&r[r.length-1]<12)return{type:'straight',highCard:c[c.length-1],count:c.length};if(c.length>=6&&c.length%2===0){let iD=true;let pR=[];for(let i=0;i<c.length;i+=2){if(Math.floor(c[i]/4)!==Math.floor(c[i+1]/4))iD=false;pR.push(Math.floor(c[i]/4));}if(iD){for(let i=1;i<pR.length;i++){if(pR[i]!==pR[i-1]+1)iD=false;}if(iD&&pR[pR.length-1]<12)return{type:'doithong',pairs:c.length/2,highCard:c[c.length-1],count:c.length};}}return null;}
function canBeat(p,pl){if(!pl)return true;const pR=Math.floor(pl.highCard/4);if(pl.type==='single'&&pR===12){if(p.type==='doithong'&&p.pairs===3)return true;if(p.type==='quad')return true;if(p.type==='doithong'&&p.pairs===4)return true;}if(pl.type==='pair'&&pR===12){if(p.type==='quad')return true;if(p.type==='doithong'&&p.pairs===4)return true;}if(pl.type==='doithong'&&pl.pairs===3){if(p.type==='quad'||(p.type==='doithong'&&p.pairs===4))return true;}if(pl.type==='quad'&&p.type==='doithong'&&p.pairs===4)return true;if(p.type===pl.type&&p.count===pl.count)return p.highCard>pl.highCard;return false;}
function manageTlTimer(r){if(r.status!=='PLAYING'){if(tlTimerInterval)clearInterval(tlTimerInterval);return;}if(tlCurrentTurnStartTime!==r.turnStartTime){tlCurrentTurnStartTime=r.turnStartTime;if(tlTimerInterval)clearInterval(tlTimerInterval);tlTimerInterval=setInterval(()=>{const tL=Math.max(0,30-((Date.now()-r.turnStartTime)/1000));const p=(tL/30)*100;const b=document.getElementById('tl-timer-bar');b.style.width=`${p}%`;b.style.background=p>50?'#00ff80':p>20?'#ffd700':'#ff003c';if(tL<=0&&r.turn===uid){clearInterval(tlTimerInterval);if(!r.currentPile||r.currentPile.length===0){selectedCardsIndices=[0];window.tlPlayCards(true);}else window.tlPassTurn(true);}},1000);}}
window.tlCreateRoom=async()=>{let b=parseInt(prompt("Cược PP:"));if(isNaN(b)||b<=0)return;const s=await get(ref(db,`users/${uid}`));const u=s.val();if((Number(u.pp)||0)<b)return alert("Không đủ PP!");await update(ref(db,`users/${uid}`),{pp:(Number(u.pp)||0)-b});const id='TL_'+Date.now();await set(ref(db,`tienlen_rooms/${id}`),{creator:uid,creatorName:u.name,bet:b,status:'WAITING',players:{[uid]:{name:u.name,avatar:u.avatar||'',isCreator:true}},playerOrder:[uid],pot:b});};
window.tlJoinRoom=async(id)=>{const s=await get(ref(db,`tienlen_rooms/${id}`));const r=s.val();if(!r||r.status!=='WAITING'||Object.keys(r.players).length>=4)return alert("Bàn đang chơi hoặc đã đầy!");const us=await get(ref(db,`users/${uid}`));const u=us.val();if((Number(u.pp)||0)<r.bet)return alert("Bạn không đủ PP!");await update(ref(db,`users/${uid}`),{pp:(Number(u.pp)||0)-r.bet});await update(ref(db,`tienlen_rooms/${id}/players/${uid}`),{name:u.name,avatar:u.avatar||''});await update(ref(db,`tienlen_rooms/${id}`),{playerOrder:[...(r.playerOrder||[]),uid],pot:r.pot+r.bet});document.getElementById('tienlen-modal').style.display='flex';};
window.tlLeaveGame = async () => {
    if(!myTlRoomId) return window.closeTienLenModal();
    const s = await get(ref(db, `tienlen_rooms/${myTlRoomId}`)); const r = s.val();
    if(!r) { myTlRoomId = null; window.closeTienLenModal(); return; }
    if(r.status === 'PLAYING') return alert("Đang đánh không được chạy!");
    if (r.creator === uid || (r.playerOrder||[]).length <= 1) { await remove(ref(db, `tienlen_rooms/${myTlRoomId}`)); } else { await remove(ref(db, `tienlen_rooms/${myTlRoomId}/players/${uid}`)); const nO = (r.playerOrder||[]).filter(x => x !== uid); await update(ref(db, `tienlen_rooms/${myTlRoomId}`), { playerOrder: nO, pot: r.pot - r.bet }); }
    if (r.status === 'WAITING') { const us = await get(ref(db, `users/${uid}`)); await update(ref(db, `users/${uid}`), { pp: (Number(us.val().pp) || 0) + r.bet }); }
    myTlRoomId = null; window.closeTienLenModal(); alert("Đã rời phòng!");
};
window.tlStartGame=async()=>{if(!myTlRoomId)return;const s=await get(ref(db,`tienlen_rooms/${myTlRoomId}`));const r=s.val();if(Object.keys(r.players).length<2)return alert("Cần tối thiểu 2 người!");let d=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}let h={};let c=0;r.playerOrder.forEach(p=>{h[p]=d.slice(c,c+13).sort((a,b)=>a-b);c+=13;});await update(ref(db,`tienlen_rooms/${myTlRoomId}`),{status:'PLAYING',hands:h,turn:r.playerOrder[0],turnStartTime:Date.now(),currentPile:[],passList:[],lastPlayedBy:''});};
window.tlPlayCards=async(a=false)=>{if(selectedCardsIndices.length===0)return;const s=await get(ref(db,`tienlen_rooms/${myTlRoomId}`));const r=s.val();let mh=r.hands[uid];let cP=selectedCardsIndices.map(i=>mh[i]).sort((x,y)=>x-y);const pO=analyzeCards(cP);if(!pO)return;if(r.currentPile&&r.currentPile.length>0&&r.lastPlayedBy!==uid){if(!canBeat(pO,analyzeCards(r.currentPile)))return;}let nH=mh.filter((_,i)=>!selectedCardsIndices.includes(i));selectedCardsIndices=[];windowLastHandSig="";let nI=(r.playerOrder.indexOf(uid)+1)%r.playerOrder.length;let nU=r.playerOrder[nI];let l=0;while((r.passList||[]).includes(nU)&&l<4){nI=(nI+1)%r.playerOrder.length;nU=r.playerOrder[nI];l++;}let up={[`hands/${uid}`]:nH,currentPile:cP,lastPlayedBy:uid,turn:nU,turnStartTime:Date.now()};if(nH.length===0){up.status='ENDED';up.winner=uid;}await update(ref(db,`tienlen_rooms/${myTlRoomId}`),up);};
window.tlPassTurn=async(a=false)=>{const s=await get(ref(db,`tienlen_rooms/${myTlRoomId}`));const r=s.val();if(!r.currentPile||r.currentPile.length===0||r.lastPlayedBy===uid)return;let pL=r.passList||[];pL.push(uid);let nI=(r.playerOrder.indexOf(uid)+1)%r.playerOrder.length;let nU=r.playerOrder[nI];let l=0;while(pL.includes(nU)&&l<4){nI=(nI+1)%r.playerOrder.length;nU=r.playerOrder[nI];l++;}let up={passList:pL,turn:nU,turnStartTime:Date.now()};if(pL.length>=r.playerOrder.length-1){up.passList=[];up.currentPile=[];}await update(ref(db,`tienlen_rooms/${myTlRoomId}`),up);};

// ♠️ BLACKJACK 3D LIVE
let myBjRoomId = null;
window.closeBlackjackModal = () => { document.getElementById('bj-modal').style.display = 'none'; };

function getBjInfo(cards) { 
    if(cards.length === 2 && cards.every(v => Math.floor(v/4) === 11)) return { score: 22, type: 'XIBANG' };
    let score = 0, aces = 0; 
    cards.forEach(val => { let r = Math.floor(val/4); if(r <= 7) score += (r + 3); else if(r >= 8 && r <= 10) score += 10; else if(r === 12) score += 2; else if(r === 11) { aces++; } }); 
    if(cards.length >= 3) { score += aces; } else { for(let i=0; i<aces; i++) { if(score + 11 <= 21) score += 11; else if(score + 10 <= 21 && aces===1) score += 10; else score += 1; } }
    if(cards.length === 2 && score === 21 && aces > 0) return { score: 21, type: 'XIDACH' }; 
    if(score > 21) return { score, type: 'QUAC' }; 
    if(cards.length === 5 && score <= 21) return { score, type: 'NGULINH' }; 
    return { score, type: 'NORMAL' }; 
}

function compareBj(p, d) { if(p.type === 'QUAC') return -1; if(d.type === 'QUAC') return 1; const r = {'XIBANG':5, 'XIDACH':4, 'NGULINH':3, 'NORMAL':1}; if(r[p.type] > r[d.type]) return 1; if(r[p.type] < r[d.type]) return -1; if(p.score > d.score) return 1; if(p.score < d.score) return -1; return 0; }
function getBjCardHTML(val, isHidden = false, animDelay = 0) { if(isHidden) return `<div class="tl-card-back tl-played-card" style="position:relative; box-shadow:-2px 2px 5px rgba(0,0,0,0.5); animation-delay: ${animDelay}s;"></div>`; const r = RANKS[Math.floor(val / 4)]; const s = SUITS[val % 4]; const iR = (val % 4 === 2 || val % 4 === 3); return `<div class="tl-card ${iR ? 'red-suit' : 'black-suit'} tl-played-card" style="position:relative; animation-delay: ${animDelay}s;"><div class="rank">${r}</div><div class="suit">${s}</div></div>`; }
function listenBlackjackRooms() { 
    onValue(ref(db, 'blackjack_rooms'), snap => { 
        const rooms = snap.val() || {}; let h = ""; let amI = false; 
        for(let k in rooms) { 
            const r = rooms[k]; const isMe = r.players && Object.keys(r.players).includes(uid); 
            if(isMe) { amI = true; myBjRoomId = k; renderBjBoard(r, k); document.getElementById('bj-modal').style.display = 'flex';} 
            if((r.status === 'WAITING' || r.status === 'PLAYING') && !isMe) { 
                let stTxt = r.status === 'WAITING' ? `<span class="text-green">ĐANG CHỜ</span>` : `<span class="text-red">ĐANG CHƠI</span>`; 
                h += `<div class="room-item" style="padding:10px; flex-direction:column; align-items:flex-start;"><div style="margin-bottom:8px;"><strong class="text-gold">BÀN: ${r.creatorName}</strong><br><small>Cược: ${r.bet.toLocaleString()} PP | ${stTxt}</small></div>${(!r.players || Object.keys(r.players).length < 5) ? `<button onclick="bjJoinRoom('${k}')" class="btn-cyber w-100" style="padding:8px;">[ VÀO SÒNG ]</button>` : `<span class="text-red">FULL 5/5</span>`}</div>`; 
            } 
        } 
        if(document.getElementById('bj-room-list')) document.getElementById('bj-room-list').innerHTML = h || '<p style="text-align:center; color:#888; font-size:12px;">Chưa có sòng.</p>'; 
        if(!amI) myBjRoomId = null; 
    }); 
}
function renderBjBoard(r, rId) {
    if(!r.players || !r.players[uid]) return;
    document.getElementById('bj-start-btn').style.display = (r.status === 'WAITING' && r.creator === uid) ? 'block' : 'none';
    let dH = ''; if(r.dealer && r.dealer.hand) { dH = r.dealer.hand.map((v, i) => getBjCardHTML(v, r.dealer.isHidden && i === 1, i*0.2)).join(''); document.getElementById('bj-dealer-score').innerText = r.dealer.isHidden ? '?' : getBjInfo(r.dealer.hand).score + ' đ'; } else { document.getElementById('bj-dealer-score').innerText = '?'; } document.getElementById('bj-dealer-cards').innerHTML = dH;
    let pH = ''; Object.keys(r.players).forEach((pU) => { let pD = r.players[pU]; let isActivePlaying = (r.status === 'PLAYING' && r.activePlayers && r.activePlayers.includes(pU)); let isT = (isActivePlaying && r.activePlayers[r.turnIdx] === pU); let hA = pD.hand || []; let hH = hA.map((v, i) => getBjCardHTML(v, false, i*0.2)).join(''); let bC = isT ? 'active-turn' : ''; let inf = getBjInfo(hA); let sL = ''; if(pD.status === 'WAITING' || pD.status === 'SPECTATOR') sL = 'Đang đợi / Khán giả'; else sL = inf.type==='QUAC'?'QUẮC BÙ':inf.type==='XIBANG'?'XÌ BÀNG':inf.type==='XIDACH'?'XÌ DÁCH':inf.type==='NGULINH'?'NGŨ LINH':inf.score + ' đ'; if(['STOOD','BUSTED','BLACKJACK','SPECTATOR'].includes(pD.status)) bC += ' passed'; pH += `<div style="display:flex; flex-direction:column; align-items:center;"><div style="margin-bottom:15px; display:flex; justify-content:center; min-height:120px; gap: 15px;">${hH}</div><div class="tl-player-badge ${bC}" style="min-width:120px; flex-direction:column; gap:5px; text-align:center;"><img src="${pD.avatar}" style="width:45px; height:45px; border-radius:50%; border:2px solid ${isT?'#ffd700':'#fff'}; margin-bottom:5px;"><b class="text-blue" style="font-size:12px;">${pD.name}</b><span class="text-gold" style="font-size:10px;">${r.bet.toLocaleString()} PP</span><span class="badge" style="border-color:#ffd700; color:#ffd700; font-size:11px;">${sL}</span></div></div>`; }); document.getElementById('bj-players-area').innerHTML = pH;
    if (r.status === 'PLAYING' && r.activePlayers && r.activePlayers[r.turnIdx] === uid && r.players[uid].status === 'PLAYING') { document.getElementById('bj-controls').style.display = 'flex'; document.getElementById('btn-bj-hit').style.pointerEvents = 'auto'; document.getElementById('btn-bj-hit').style.opacity = '1'; document.getElementById('btn-bj-stand').style.pointerEvents = 'auto'; document.getElementById('btn-bj-stand').style.opacity = '1'; window.isBjAction = false; } else { document.getElementById('bj-controls').style.display = 'none'; }
    let cM = document.getElementById('bj-center-msg'); if(r.status === 'ENDED') cM.innerHTML = (r.finalMsg||'') + '<br><span style="font-size:16px; color:#ffcc00; display:inline-block; margin-top:15px; border:1px dashed #ffcc00; padding:10px;">⏳ Ván mới bắt đầu sau 10s... (Khán giả sẽ được tham gia)</span>'; else if(r.status === 'PLAYING' && r.activePlayers && r.turnIdx >= r.activePlayers.length) cM.innerHTML = '<span class="text-gold">NHÀ CÁI ĐANG RÚT BÀI...</span>'; else cM.innerHTML = '';
    if(r.status === 'PLAYING' && r.creator === uid && r.activePlayers && r.turnIdx >= r.activePlayers.length) { if(!window.isDealingBJ) { window.isDealingBJ = true; window.runDealerAI(rId, r); } }
}
window.bjCreateRoom = async () => { let b = parseInt(prompt("Nhập mức cược cố định PP cho phòng này:")); if(isNaN(b)||b<=0)return; const uS = await get(ref(db, `users/${uid}`)); if((Number(uS.val().pp)||0) < b) return alert("Không đủ tiền!"); const id = 'BJ_' + Date.now(); await set(ref(db, `blackjack_rooms/${id}`), { creator: uid, creatorName: uS.val().name, bet: b, status: 'WAITING', players: { [uid]: { name: uS.val().name, avatar: uS.val().avatar||'', status: 'WAITING' } }, activePlayers: [] }); };
window.bjJoinRoom = async (id) => { const s = await get(ref(db, `blackjack_rooms/${id}`)); const r = s.val(); if(!r)return; if(r.players && Object.keys(r.players).length >= 5) return alert("Đã max 5 người!"); const uS = await get(ref(db, `users/${uid}`)); if((Number(uS.val().pp)||0) < r.bet) return alert("Bạn không đủ PP cược theo phòng này!"); let st = r.status === 'WAITING' ? 'WAITING' : 'SPECTATOR'; await update(ref(db, `blackjack_rooms/${id}/players/${uid}`), { name: uS.val().name, avatar: uS.val().avatar||'', hand: [], status: st }); document.getElementById('bj-modal').style.display='flex'; };
window.bjLeaveRoom = async () => { if(!myBjRoomId) return window.closeBlackjackModal(); const s = await get(ref(db, `blackjack_rooms/${myBjRoomId}`)); const r = s.val(); if(!r) { myBjRoomId = null; window.closeBlackjackModal(); return; } if(r.status === 'PLAYING' && r.activePlayers && r.activePlayers.includes(uid)) return alert("Đang chơi ván này, không được thoát ngang!"); if(r.creator === uid || !r.players || Object.keys(r.players).length <= 1) { await remove(ref(db, `blackjack_rooms/${myBjRoomId}`)); } else { await remove(ref(db, `blackjack_rooms/${myBjRoomId}/players/${uid}`)); if(r.activePlayers) { const nA = r.activePlayers.filter(x => x !== uid); await update(ref(db, `blackjack_rooms/${myBjRoomId}`), { activePlayers: nA }); } } myBjRoomId = null; document.getElementById('bj-modal').style.display='none'; alert("Đã thoát khỏi sòng!"); };
window.bjStartGame = async (rIdParam) => { const rid = rIdParam || myBjRoomId; if(!rid) return; const s = await get(ref(db, `blackjack_rooms/${rid}`)); const r = s.val(); if(!r || !r.players) return; let vO = []; let up = {}; for(let pU in r.players) { const uS = await get(ref(db, `users/${pU}`)); let pp = Number(uS.val().pp)||0; if(pp >= r.bet) { vO.push(pU); up[`/users/${pU}/pp`] = pp - r.bet; } else { up[`/blackjack_rooms/${rid}/players/${pU}`] = null; } } if(vO.length === 0) { await remove(ref(db, `blackjack_rooms/${rid}`)); return alert("Sòng giải tán vì tất cả hết tiền!"); } if(!vO.includes(r.creator)) { up[`/blackjack_rooms/${rid}/creator`] = vO[0]; up[`/blackjack_rooms/${rid}/creatorName`] = r.players[vO[0]].name; } let d = Array.from({length:52}, (_,i)=>i); for(let i=51;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];} up[`/blackjack_rooms/${rid}/dealer`] = { hand: [d.pop(), d.pop()], isHidden: true }; up[`/blackjack_rooms/${rid}/activePlayers`] = vO; for(let pU of vO) { let h = [d.pop(), d.pop()]; let i = getBjInfo(h); up[`/blackjack_rooms/${rid}/players/${pU}/hand`] = h; up[`/blackjack_rooms/${rid}/players/${pU}/status`] = (i.type==='XIBANG'||i.type==='XIDACH') ? 'BLACKJACK' : 'PLAYING'; } let fT = 0; while(fT < vO.length && up[`/blackjack_rooms/${rid}/players/${vO[fT]}/status`] === 'BLACKJACK') fT++; up[`/blackjack_rooms/${rid}/status`] = 'PLAYING'; up[`/blackjack_rooms/${rid}/deck`] = d; up[`/blackjack_rooms/${rid}/turnIdx`] = fT; await update(ref(db, '/'), up); };
window.bjHit = async () => { if(window.isBjAction) return; window.isBjAction = true; document.getElementById('btn-bj-hit').style.pointerEvents = 'none'; document.getElementById('btn-bj-hit').style.opacity = '0.5'; document.getElementById('btn-bj-stand').style.pointerEvents = 'none'; document.getElementById('btn-bj-stand').style.opacity = '0.5'; const s = await get(ref(db, `blackjack_rooms/${myBjRoomId}`)); const r = s.val(); let ap = r.activePlayers; let pd = r.players[uid]; let dk = r.deck; pd.hand.push(dk.pop()); let inf = getBjInfo(pd.hand); let nI = r.turnIdx; let st = 'PLAYING'; if(inf.type === 'QUAC') { st = 'BUSTED'; nI++; } else if(inf.type === 'NGULINH' || pd.hand.length >= 5 || inf.score === 21) { st = 'STOOD'; nI++; } while(nI < ap.length && r.players[ap[nI]].status === 'BLACKJACK') nI++; await update(ref(db, `blackjack_rooms/${myBjRoomId}`), { [`players/${uid}/hand`]: pd.hand, [`players/${uid}/status`]: st, deck: dk, turnIdx: nI }); };
window.bjStand = async () => { if(window.isBjAction) return; window.isBjAction = true; document.getElementById('btn-bj-hit').style.pointerEvents = 'none'; document.getElementById('btn-bj-stand').style.pointerEvents = 'none'; const s = await get(ref(db, `blackjack_rooms/${myBjRoomId}`)); const r = s.val(); let ap = r.activePlayers; let nI = r.turnIdx + 1; while(nI < ap.length && r.players[ap[nI]].status === 'BLACKJACK') nI++; await update(ref(db, `blackjack_rooms/${myBjRoomId}`), { [`players/${uid}/status`]: 'STOOD', turnIdx: nI }); };
window.runDealerAI = async (rId, r) => { await new Promise(resolve => setTimeout(resolve, 1500)); let dk = r.deck || []; let dH = r.dealer.hand || []; await update(ref(db, `blackjack_rooms/${rId}/dealer`), { hand: dH, isHidden: false }); let dI = getBjInfo(dH); while(dI.score < 17 && dH.length < 5 && dI.type !== 'QUAC' && dI.type !== 'XIBANG' && dI.type !== 'XIDACH') { await new Promise(resolve => setTimeout(resolve, 1200)); dH.push(dk.pop()); dI = getBjInfo(dH); await update(ref(db, `blackjack_rooms/${rId}`), { 'dealer/hand': dH, deck: dk }); } await new Promise(resolve => setTimeout(resolve, 1500)); let up = {}; let fM = "KẾT QUẢ: " + (dI.type==='QUAC'?"NHÀ CÁI QUẮC BÙ":dI.type==='XIBANG'?"CÁI XÌ BÀNG":dI.type==='XIDACH'?"CÁI XÌ DÁCH":dI.type==='NGULINH'?"CÁI NGŨ LINH":dI.score+" ĐIỂM") + "<br><br>"; let ap = r.activePlayers || []; for (let pU of ap) { let pD = r.players[pU]; let pI = getBjInfo(pD.hand); let res = compareBj(pI, dI); const us = await get(ref(db, `users/${pU}`)); let pp = Number(us.val().pp) || 0; let b = r.bet; if(pI.type === 'QUAC') { fM += `<span class="text-red">${pD.name} QUẮC (-${b.toLocaleString()})</span><br>`; window.logGame(pU, pD.name, "Blackjack", b, -b, "Quắc"); } else if(pI.type === 'XIBANG' || pI.type === 'XIDACH') { up[`/users/${pU}/pp`] = pp + (b * 2.5); fM += `<span class="text-green">${pD.name} TỚI TRẮNG (+${(b*1.5).toLocaleString()})</span><br>`; window.logGame(pU, pD.name, "Blackjack", b, b*1.5, "Blackjack"); } else { if(res === 1) { let m = (pI.type==='NGULINH') ? 2.2 : (pI.type==='PERFECT_21'?2.1:2); up[`/users/${pU}/pp`] = pp + (b * m); fM += `<span class="text-green">${pD.name} THẮNG (+${(b*(m-1)).toLocaleString()})</span><br>`; window.logGame(pU, pD.name, "Blackjack", b, b*(m-1), "Thắng");} else if(res === 0) { up[`/users/${pU}/pp`] = pp + b; fM += `<span style="color:#ffcc00">${pD.name} HÒA (Hoàn cược)</span><br>`; window.logGame(pU, pD.name, "Blackjack", b, 0, "Hòa");} else { fM += `<span class="text-red">${pD.name} THUA (-${b.toLocaleString()})</span><br>`; window.logGame(pU, pD.name, "Blackjack", b, -b, "Thua");} } } up[`/blackjack_rooms/${rId}/status`] = 'ENDED'; up[`/blackjack_rooms/${rId}/finalMsg`] = fM; await update(ref(db, '/'), up); setTimeout(async () => { window.isDealingBJ = false; const cSnap = await get(ref(db, `blackjack_rooms/${rId}`)); const cR = cSnap.val(); if(!cR || !cR.players) return; let resetUp = { status: 'WAITING', finalMsg: '', dealer: null, deck: null, turnIdx: 0, activePlayers: [] }; for(let px in cR.players) { resetUp[`players/${px}/status`] = 'WAITING'; resetUp[`players/${px}/hand`] = []; } await update(ref(db, `blackjack_rooms/${rId}`), resetUp); }, 10000); };

// ✌️ KÉO BÚA BAO MULTIPLAYER
let myRpsRoomId = null;
window.closeRpsRoomModal = () => { document.getElementById('rps-modal').style.display='none'; };
function getRpsEmoji(c) { if(c==='KEO') return '✌️'; if(c==='BUA') return '✊'; if(c==='BAO') return '✋'; return '❓'; }
function checkRpsWin(p1, p2) { if(p1===p2) return 0; if((p1==='KEO'&&p2==='BAO')||(p1==='BUA'&&p2==='KEO')||(p1==='BAO'&&p2==='BUA')) return 1; return -1; }
function listenRpsRooms() {
    onValue(ref(db, 'rps_rooms'), async snap => {
        const rooms = snap.val() || {}; let h = ""; let amI = false;
        for(let k in rooms) {
            const r = rooms[k]; const isMe = r.p1 === uid || r.p2 === uid;
            if(isMe) { amI = true; myRpsRoomId = k; renderRpsBoard(r, k); document.getElementById('rps-modal').style.display='flex'; }
            if(r.status === 'WAITING' && !isMe) h += `<div class="room-item" style="padding:10px; flex-direction:column; align-items:flex-start;"><div style="margin-bottom:8px;"><strong class="text-green">KÈO: ${r.p1Name}</strong><br><small>Cược: ${r.bet.toLocaleString()} PP</small></div><button onclick="rpsJoinRoom('${k}')" class="btn-cyber w-100" style="padding:8px;">[ VÀO ĐẤU ]</button></div>`;
            
            if (isMe && r.status === 'ENDED' && r.p1Rematch && r.p2Rematch) {
                if (uid === r.p1 && !window.rpsDealingRematch) {
                    window.rpsDealingRematch = true; const u1 = await get(ref(db, `users/${r.p1}`)); const u2 = await get(ref(db, `users/${r.p2}`));
                    if((Number(u1.val().pp)||0) < r.bet || (Number(u2.val().pp)||0) < r.bet) { await remove(ref(db, `rps_rooms/${k}`)); alert("Có người hết tiền, giải tán phòng!"); window.rpsDealingRematch = false; } else { await update(ref(db, `users/${r.p1}`), {pp: (Number(u1.val().pp)||0) - r.bet}); await update(ref(db, `users/${r.p2}`), {pp: (Number(u2.val().pp)||0) - r.bet}); await update(ref(db, `rps_rooms/${k}`), { status: 'PLAYING', p1Choice: '', p2Choice: '', finalMsg: '', p1Rematch: false, p2Rematch: false }); window.rpsDealingRematch = false; }
                }
            }
        }
        if(document.getElementById('rps-room-list')) document.getElementById('rps-room-list').innerHTML = h || '<p style="text-align:center; color:#888; font-size:12px;">Chưa có kèo đấu.</p>';
        if(!amI) myRpsRoomId = null;
    });
}
function renderRpsBoard(r, rId) { document.getElementById('rps-pot-display').innerText = `TỔNG CƯỢC: ${(r.bet*2).toLocaleString()} PP`; document.getElementById('rps-start-btn').style.display = (r.status==='WAITING' && r.p1===uid && r.p2) ? 'block' : 'none'; let p1H = `<img src="${r.p1Avatar}" style="width:60px; border-radius:50%; border:2px solid var(--neon-green);"><br><b class="text-green">${r.p1Name}</b><br>`; let p2H = r.p2 ? `<img src="${r.p2Avatar}" style="width:60px; border-radius:50%; border:2px solid var(--neon-red);"><br><b class="text-red">${r.p2Name}</b><br>` : `<div style="width:60px; height:60px; border-radius:50%; border:2px dashed #888; display:inline-block; line-height:60px; color:#888;">?</div><br><b style="color:#888">Đang chờ...</b>`; if(r.status === 'PLAYING' || r.status === 'ENDED') { p1H += `<div class="rps-hand ${r.status==='ENDED'?'drop':''}">${r.status==='ENDED' ? getRpsEmoji(r.p1Choice) : (r.p1Choice ? '✔️' : '🤔')}</div>`; p2H += `<div class="rps-hand ${r.status==='ENDED'?'drop':''}">${r.status==='ENDED' ? getRpsEmoji(r.p2Choice) : (r.p2Choice ? '✔️' : '🤔')}</div>`; } document.getElementById('rps-p1-area').innerHTML = p1H; document.getElementById('rps-p2-area').innerHTML = p2H; let amP1 = (uid === r.p1); let amP2 = (uid === r.p2); let hasChosen = (amP1 && r.p1Choice) || (amP2 && r.p2Choice); document.getElementById('rps-controls').style.display = (r.status === 'PLAYING' && !hasChosen) ? 'flex' : 'none'; let hasRematched = (amP1 && r.p1Rematch) || (amP2 && r.p2Rematch); document.getElementById('rps-rematch-controls').style.display = (r.status === 'ENDED' && !hasRematched) ? 'flex' : 'none'; let cM = document.getElementById('rps-center-msg'); if(r.status === 'WAITING') cM.innerText = r.p2 ? "SẴN SÀNG!" : "ĐANG CHỜ ĐỐI THỦ..."; else if(r.status === 'PLAYING') cM.innerText = "CHỌN ĐI!"; else if(r.status === 'ENDED') { let txt = r.finalMsg; if(r.p1Rematch || r.p2Rematch) txt += `<br><span style="font-size:14px; color:#aaa;">Đang chờ người kia đồng ý chơi tiếp...</span>`; cM.innerHTML = txt; } }
window.rpsCreateRoom = async () => { let b = parseInt(prompt("Nhập PP cược 1vs1:")); if(isNaN(b)||b<=0)return; const uS = await get(ref(db, `users/${uid}`)); if((Number(uS.val().pp)||0) < b) return alert("Không đủ tiền!"); const id = 'RPS_' + Date.now(); await set(ref(db, `rps_rooms/${id}`), { p1: uid, p1Name: uS.val().name, p1Avatar: uS.val().avatar||'', bet: b, status: 'WAITING', p1Rematch: false, p2Rematch: false }); };
window.rpsJoinRoom = async (id) => { const s = await get(ref(db, `rps_rooms/${id}`)); const r = s.val(); if(!r||r.p2)return; const uS = await get(ref(db, `users/${uid}`)); if((Number(uS.val().pp)||0) < r.bet) return alert("Không đủ PP!"); await update(ref(db, `rps_rooms/${id}`), { p2: uid, p2Name: uS.val().name, p2Avatar: uS.val().avatar||'' }); document.getElementById('rps-modal').style.display='flex'; };
window.rpsLeaveRoom = async () => { if(!myRpsRoomId) return window.closeRpsRoomModal(); const s = await get(ref(db, `rps_rooms/${myRpsRoomId}`)); const r = s.val(); if(!r) { myRpsRoomId = null; return window.closeRpsRoomModal(); } if(r.status === 'PLAYING') return alert("Đang đấu không được chạy!"); if(r.p1 === uid) { await remove(ref(db, `rps_rooms/${myRpsRoomId}`)); } else { await update(ref(db, `rps_rooms/${myRpsRoomId}`), { p2: null, p2Name: null, p2Avatar: null }); } myRpsRoomId = null; window.closeRpsRoomModal(); };
window.rpsStartGame = async () => { if(!myRpsRoomId) return; const s = await get(ref(db, `rps_rooms/${myRpsRoomId}`)); const r = s.val(); const u1 = await get(ref(db, `users/${r.p1}`)); const u2 = await get(ref(db, `users/${r.p2}`)); if((Number(u1.val().pp)||0)<r.bet || (Number(u2.val().pp)||0)<r.bet) { await remove(ref(db, `rps_rooms/${myRpsRoomId}`)); return alert("Có người hết tiền, giải tán!"); } await update(ref(db, `users/${r.p1}`), {pp: (Number(u1.val().pp)||0)-r.bet}); await update(ref(db, `users/${r.p2}`), {pp: (Number(u2.val().pp)||0)-r.bet}); await update(ref(db, `rps_rooms/${myRpsRoomId}`), {status: 'PLAYING', p1Choice: '', p2Choice: '', finalMsg: '', p1Rematch: false, p2Rematch: false}); };
window.rpsMakeChoice = async (c) => { const s = await get(ref(db, `rps_rooms/${myRpsRoomId}`)); const r = s.val(); let up = {}; if(uid === r.p1) up.p1Choice = c; else if(uid === r.p2) up.p2Choice = c; await update(ref(db, `rps_rooms/${myRpsRoomId}`), up); const nrS = await get(ref(db, `rps_rooms/${myRpsRoomId}`)); const nr = nrS.val(); if(nr.p1Choice && nr.p2Choice) { let res = checkRpsWin(nr.p1Choice, nr.p2Choice); let fM = ""; const u1 = await get(ref(db, `users/${nr.p1}`)); const u2 = await get(ref(db, `users/${nr.p2}`)); if(res === 1) { await update(ref(db, `users/${nr.p1}`), {pp: (Number(u1.val().pp)||0) + (nr.bet*2)}); fM = `<span class="text-green">${nr.p1Name} ĐÃ ĂN SẠCH CỦA ${nr.p2Name}<br>🔥 TRỪ ${nr.bet.toLocaleString()} PP! 🔥</span>`; window.logGame(nr.p1, nr.p1Name, "Kéo Búa Bao", nr.bet, nr.bet, "Thắng"); window.logGame(nr.p2, nr.p2Name, "Kéo Búa Bao", nr.bet, -nr.bet, "Thua"); } else if(res === -1) { await update(ref(db, `users/${nr.p2}`), {pp: (Number(u2.val().pp)||0) + (nr.bet*2)}); fM = `<span class="text-red">${nr.p2Name} ĐÃ ĂN SẠCH CỦA ${nr.p1Name}<br>🔥 TRỪ ${nr.bet.toLocaleString()} PP! 🔥</span>`; window.logGame(nr.p2, nr.p2Name, "Kéo Búa Bao", nr.bet, nr.bet, "Thắng"); window.logGame(nr.p1, nr.p1Name, "Kéo Búa Bao", nr.bet, -nr.bet, "Thua"); } else { await update(ref(db, `users/${nr.p1}`), {pp: (Number(u1.val().pp)||0) + nr.bet}); await update(ref(db, `users/${nr.p2}`), {pp: (Number(u2.val().pp)||0) + nr.bet}); fM = `<span style="color:#ffcc00">HÒA NHAU! TRẢ LẠI TIỀN CƯỢC.</span>`; } await update(ref(db, `rps_rooms/${myRpsRoomId}`), {status: 'ENDED', finalMsg: fM}); } };
window.rpsRematch = async () => { if(!myRpsRoomId) return; if(uid === (await get(ref(db,`rps_rooms/${myRpsRoomId}/p1`))).val()) { await update(ref(db, `rps_rooms/${myRpsRoomId}`), {p1Rematch: true}); } else { await update(ref(db, `rps_rooms/${myRpsRoomId}`), {p2Rematch: true}); } };

// 🐎 ĐUA NGỰA 3D
let horseInterval; let isHorseRacing=false; let horseBetAmount=0; let horseChoice=0;
window.openHorseGame=()=>{document.getElementById('horse-modal').style.display='flex';resetHorseUI();}; window.closeHorseGame=()=>{if(isHorseRacing)return alert("Ngựa đang chạy không được rời sân!");document.getElementById('horse-modal').style.display='none';};
function resetHorseUI(){for(let i=1;i<=4;i++){document.getElementById('h'+i).style.left='0%';}document.getElementById('horse-commentary').innerText="Vui lòng chọn ngựa và đặt cược...";document.getElementById('horse-bet').disabled=false;document.getElementById('horse-bet').value='';document.getElementById('horse-actions').style.display='flex';}
window.startHorseRace=async(choice)=>{if(isHorseRacing)return;const b=parseInt(document.getElementById('horse-bet').value);if(isNaN(b)||b<=0)return window.showResult("LỖI","Cược không hợp lệ!",false);const s=await get(ref(db,`users/${uid}`));const cPP=Number(s.val().pp)||0;if(cPP<b)return window.showResult("NGHÈO","Không đủ PP!",false);await update(ref(db,`users/${uid}`),{pp:cPP-b});horseBetAmount=b;horseChoice=choice;isHorseRacing=true;document.getElementById('horse-bet').disabled=true;document.getElementById('horse-actions').style.display='none';let pos=[0,0,0,0];document.getElementById('horse-commentary').innerHTML=`Đang cược <b class="text-gold">Ngựa số ${choice}</b>... Cố lên!`;horseInterval=setInterval(()=>{let isFinished=false;let winner=0;for(let i=0;i<4;i++){pos[i]+=(Math.random()*0.8+0.1);document.getElementById('h'+(i+1)).style.left=pos[i]+'%';if(pos[i]>=85){isFinished=true;winner=i+1;}}if(isFinished){clearInterval(horseInterval);isHorseRacing=false;document.getElementById('horse-commentary').innerText=`NGỰA SỐ ${winner} VỀ ĐÍCH!`;setTimeout(async()=>{if(horseChoice===winner){const w=horseBetAmount*3;const ns=await get(ref(db,`users/${uid}`));await update(ref(db,`users/${uid}`),{pp:(Number(ns.val().pp)||0)+w});window.logGame(uid,localStorage.getItem('uname'),"Đua Ngựa",horseBetAmount,w-horseBetAmount,"Thắng");window.showResult("THẮNG CƯỢC",`Ngựa ${winner} về nhất!\nBạn ăn ${(w).toLocaleString()} PP (x3)!`,true);}else{window.logGame(uid,localStorage.getItem('uname'),"Đua Ngựa",horseBetAmount,-horseBetAmount,"Thua");window.showResult("THUA CƯỢC",`Ngựa ${winner} về nhất.\nBạn mất ${horseBetAmount.toLocaleString()} PP!`,false);}resetHorseUI();},1500);}},50);};

// 🧸 MÁY GẮP GẤU BÔNG
window.clawInterval = null; window.isClawActive = false; window.isClawDropping = false;
window.prizesData = [ { id: 'prize-1', type: '🦄', mult: 10, x: 10, dir: 1, speed: 4.5 }, { id: 'prize-2', type: '🧸', mult: 3, x: 30, dir: -1, speed: 3.5 }, { id: 'prize-3', type: '🐼', mult: 3, x: 50, dir: 1, speed: 3.8 }, { id: 'prize-4', type: '🐧', mult: 2, x: 70, dir: -1, speed: 4.2 }, { id: 'prize-5', type: '🦊', mult: 2, x: 90, dir: 1, speed: 2.8 } ];

window.openClawGame=()=>{
    document.getElementById('claw-modal').style.display='flex'; document.getElementById('claw-crane').style.top='-10px'; document.getElementById('claw-crane').innerText='🎣'; document.getElementById('claw-grabbed').style.display='none'; document.getElementById('claw-msg').innerText="Kỳ Lân(x10) | Gấu/Trúc(x3) | Cáo/Cụt(x2)";
    window.isClawActive = false; window.isClawDropping = false; document.getElementById('claw-bet-container').style.display = 'flex';
    const btn = document.getElementById('claw-btn'); btn.innerText = "[ CHƠI GẮP THÚ ]"; btn.style.borderColor = "#ff69b4"; btn.style.color = "#ff69b4"; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1';
    if(!window.clawInterval) { window.clawInterval = setInterval(() => { if (window.isClawDropping) return; window.prizesData.forEach(p => { p.x += p.dir * p.speed; if (p.x >= 90) { p.x = 90; p.dir = -1; } if (p.x <= 0) { p.x = 0; p.dir = 1; } document.getElementById(p.id).style.left = p.x + '%'; document.getElementById(p.id).style.display = 'inline-block'; }); }, 50); }
};
window.closeClawGame=()=>{ if(window.isClawDropping) return alert("Đang gắp không được tắt máy!"); clearInterval(window.clawInterval); window.clawInterval = null; document.getElementById('claw-modal').style.display='none'; };
window.startClawMachine = async () => {
    if(window.isClawDropping) return;
    const btn = document.getElementById('claw-btn'); const b = parseInt(document.getElementById('claw-bet').value); if(isNaN(b)||b<=0) return window.showResult("LỖI","Cược không hợp lệ!",false);
    if(!window.isClawActive) {
        const s = await get(ref(db,`users/${uid}`)); const cPP = Number(s.val().pp)||0; if(cPP < b) return window.showResult("NGHÈO","Không đủ PP!",false);
        await update(ref(db,`users/${uid}`),{pp: cPP - b});
        window.isClawActive = true; document.getElementById('claw-bet-container').style.display = 'none'; btn.innerText = "[ GẮP XUỐNG NGAY! ]"; btn.style.borderColor = "var(--neon-green)"; btn.style.color = "var(--neon-green)"; document.getElementById('claw-msg').innerText = "Canh chuẩn và bấm nút để gắp!";
    } else {
        window.isClawDropping = true; const crane = document.getElementById('claw-crane'); const grabbed = document.getElementById('claw-grabbed');
        document.getElementById('claw-msg').innerText = "Đang thả ngàm..."; crane.style.transition = 'top 0.8s ease-in'; crane.style.top = '220px'; btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none';
        setTimeout(() => {
            let hitPrize = null; let minDiff = 999; 
            window.prizesData.forEach(p => { let diff = Math.abs(p.x - 50); if (diff < 4 && diff < minDiff) { minDiff = diff; hitPrize = p; } });
            
            if (hitPrize) { crane.innerText = '🤏'; grabbed.innerText = hitPrize.type; grabbed.style.display = 'block'; document.getElementById(hitPrize.id).style.display = 'none'; document.getElementById('claw-msg').innerText = "Tuyệt vời! Đang kéo lên..."; } 
            else { crane.innerText = '🎣'; document.getElementById('claw-msg').innerText = "Hụt mất rồi! Đang thu ngàm..."; }
            crane.style.transition = 'top 0.8s ease-out'; grabbed.style.transition = 'top 0.8s ease-out'; crane.style.top = '-10px'; grabbed.style.top = '40px';
            setTimeout(async () => {
                if (hitPrize) {
                    let pWin = b * hitPrize.mult; const ns = await get(ref(db,`users/${uid}`)); await update(ref(db,`users/${uid}`),{pp: (Number(ns.val().pp)||0) + pWin});
                    window.logGame(uid,localStorage.getItem('uname'),"Gắp Thú",b,pWin-b,"Thắng"); window.showResult("GẮP TRÚNG", `Bắt được ${hitPrize.type}!\nĂn ${(pWin).toLocaleString()} PP (x${hitPrize.mult})!`, true); document.getElementById(hitPrize.id).style.display = 'inline-block'; 
                } else { window.logGame(uid,localStorage.getItem('uname'),"Gắp Thú",b,-b,"Thua"); window.showResult("GẮP HỤT", `Gắp nhầm không khí!\nMất ${b.toLocaleString()} PP!`, false); }
                window.isClawActive = false; window.isClawDropping = false; grabbed.style.display = 'none'; grabbed.style.top = '250px'; grabbed.style.transition = 'none'; crane.innerText = '🎣'; document.getElementById('claw-bet-container').style.display = 'flex'; btn.innerText = "[ CHƠI GẮP THÚ ]"; btn.style.borderColor = "#ff69b4"; btn.style.color = "#ff69b4"; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; document.getElementById('claw-msg').innerText = "Kỳ Lân(x10) | Gấu/Trúc(x3) | Cáo/Cụt(x2)";
            }, 800);
        }, 800);
    }
};

// ⚽ ĐÁ BÓNG FC MOBILE MỚI (FIX TẤN CÔNG + CAO TRÀO + BÙ GIỜ + TEAM STRENGTH)
window.fcmInterval = null; window.isFcmActive = false; window.fcmBet = 0; window.fcmChoice = ''; 
window.fcmScore = { blue: 0, red: 0 }; window.fcmTime = 0; window.fcmTotalTime = 90; window.fcmStrength = { blue: 1.0, red: 1.0 };
const fcmCmtNormal = [ "Tranh chấp ở giữa sân.", "Chuyền bóng qua lại.", "Đội hình đang lùi sâu thăm dò.", "Một pha phạm lỗi nhẹ." ];
const fcmCmtAttack = [ "🔥 Đang dốc bóng bên cánh...", "💥 PHẢN CÔNG NHANH!", "Sút xa!!! Không vào.", "🧱 CẢN PHÁ XUẤT THẦN từ thủ môn." ];

window.openFcMobileGame = () => {
    document.getElementById('fcmobile-modal').style.display = 'flex';
    document.getElementById('fcm-score-blue').innerText = '0'; document.getElementById('fcm-score-red').innerText = '0';
    document.getElementById('fcm-odds-blue').innerText = 'Sức mạnh: --'; document.getElementById('fcm-odds-red').innerText = 'Sức mạnh: --';
    document.getElementById('fcm-timer').innerText = "00:00";
    document.getElementById('fcm-bet').disabled = false; document.getElementById('fcm-bet').value = '';
    document.getElementById('btn-fcm-blue').style.display = 'block'; document.getElementById('btn-fcm-red').style.display = 'block';
    document.getElementById('fcm-commentary').innerText = "Vui lòng chọn đội để cược và bắt đầu trận đấu...";
    window.isFcmActive = false;
    document.getElementById('fcm-pitch').classList.remove('shake-screen');
    renderFcmPlayers();
};
window.closeFcMobileGame = () => { if(window.isFcmActive) return alert("Trận đấu đang diễn ra, không thể rời sân!"); document.getElementById('fcmobile-modal').style.display = 'none'; };

function renderFcmPlayers() {
    let html = '';
    for(let i=0; i<7; i++) {
        html += `<div id="fcm-b-${i}" class="fcm-player fcm-blue" style="left:${20+Math.random()*20}%; top:${10+Math.random()*80}%;"></div>`;
        html += `<div id="fcm-r-${i}" class="fcm-player fcm-red" style="left:${60+Math.random()*20}%; top:${10+Math.random()*80}%;"></div>`;
    }
    document.getElementById('fcm-players-container').innerHTML = html;
    document.getElementById('fcm-ball').style.left = '50%'; document.getElementById('fcm-ball').style.top = '50%';
}

window.startFcMobileMatch = async (choice) => {
    if(window.isFcmActive) return;
    const b = parseInt(document.getElementById('fcm-bet').value); if(isNaN(b)||b<=0) return window.showResult("LỖI","Cược không hợp lệ!",false);
    const s = await get(ref(db,`users/${uid}`)); const cPP = Number(s.val().pp)||0; if(cPP < b) return window.showResult("NGHÈO","Không đủ PP!",false);
    await update(ref(db,`users/${uid}`),{pp: cPP - b});
    
    window.fcmBet = b; window.fcmChoice = choice; window.isFcmActive = true; window.fcmScore = { blue: 0, red: 0 }; window.fcmTime = 0;
    
    // Khởi tạo sức mạnh random (Đội mạnh 1.2x, Đội yếu 0.8x)
    let bStr = Math.random() > 0.5 ? 1.2 : 0.8;
    window.fcmStrength = { blue: bStr, red: 2.0 - bStr };
    document.getElementById('fcm-odds-blue').innerHTML = `Sức mạnh: ${window.fcmStrength.blue===1.2?'<b class="text-gold">MẠNH (1.2x)</b>':'<b style="color:#aaa">YẾU (0.8x)</b>'}`;
    document.getElementById('fcm-odds-red').innerHTML = `Sức mạnh: ${window.fcmStrength.red===1.2?'<b class="text-gold">MẠNH (1.2x)</b>':'<b style="color:#aaa">YẾU (0.8x)</b>'}`;
    
    // Tính thời gian bù giờ (từ 1 đến 5 giây)
    let injury = Math.floor(Math.random() * 5) + 1;
    window.fcmTotalTime = 90 + injury;

    document.getElementById('fcm-bet').disabled = true; document.getElementById('btn-fcm-blue').style.display = 'none'; document.getElementById('btn-fcm-red').style.display = 'none';
    document.getElementById('fcm-score-blue').innerText = '0'; document.getElementById('fcm-score-red').innerText = '0';
    document.getElementById('fcm-commentary').innerText = `Trọng tài thổi còi! Trận đấu ${window.fcmTotalTime} phút bắt đầu!`;
    document.getElementById('fcm-pitch').classList.remove('shake-screen');

    window.fcmInterval = setInterval(() => {
        window.fcmTime++;
        let m = window.fcmTime < 10 ? '0'+window.fcmTime : window.fcmTime;
        document.getElementById('fcm-timer').innerText = window.fcmTime <= 90 ? `${m}:00` : `90+${window.fcmTime-90}`;
        document.getElementById('fcm-pitch').classList.remove('shake-screen'); // Xóa rung màn hình của nhịp trước (nếu có)
        
        let phase = 'EXPLORE';
        if (window.fcmTime > 30 && window.fcmTime <= 70) phase = 'ATTACK';
        else if (window.fcmTime > 70) phase = 'CLIMAX';

        // Quyết định ai đang cầm bóng / tấn công dựa trên sức mạnh
        let attackingTeam = (Math.random() * window.fcmStrength.blue > Math.random() * window.fcmStrength.red) ? 'BLUE' : 'RED';
        
        // Di chuyển bóng có logic hơn
        let ballX = 50; let ballY = 10 + Math.random() * 80;
        if (phase === 'EXPLORE') { ballX = 30 + Math.random() * 40; } // Giữa sân
        else {
            // Ép sân
            if (attackingTeam === 'BLUE') ballX = 60 + Math.random() * 35; // Gần gôn đỏ
            else ballX = 5 + Math.random() * 35; // Gần gôn xanh
        }

        document.getElementById('fcm-ball').style.left = ballX + '%'; document.getElementById('fcm-ball').style.top = ballY + '%';

        // Cầu thủ ùa theo bóng
        for(let i=0; i<7; i++) {
            document.getElementById(`fcm-b-${i}`).style.left = (ballX + (Math.random()*20 - 10)) + '%'; document.getElementById(`fcm-b-${i}`).style.top = (ballY + (Math.random()*30 - 15)) + '%';
            document.getElementById(`fcm-r-${i}`).style.left = (ballX + (Math.random()*20 - 10)) + '%'; document.getElementById(`fcm-r-${i}`).style.top = (ballY + (Math.random()*30 - 15)) + '%';
        }
        
        // Bình luận
        if(window.fcmTime % 3 === 0) {
            let cmtArr = phase === 'EXPLORE' ? fcmCmtNormal : fcmCmtAttack;
            document.getElementById('fcm-commentary').innerText = `[Phút ${window.fcmTime}] ` + cmtArr[Math.floor(Math.random() * cmtArr.length)];
        }

        // Logic check bàn thắng (mỗi 2s ở hiệp tấn công/cao trào)
        if (window.fcmTime % 2 === 0 && phase !== 'EXPLORE') {
            let baseGoalChance = phase === 'CLIMAX' ? 0.12 : 0.05; // 12% ở cao trào, 5% bình thường
            if (window.fcmTime === 89 || window.fcmTime === 90) baseGoalChance = 0.3; // Phút 89, 90 rất dễ nổ tài
            
            // Tỷ lệ thực tế phụ thuộc đội đang ép sân
            let realChance = baseGoalChance * (attackingTeam === 'BLUE' ? window.fcmStrength.blue : window.fcmStrength.red);
            
            if (Math.random() < realChance) {
                document.getElementById('fcm-pitch').classList.add('shake-screen');
                if (attackingTeam === 'BLUE') {
                    window.fcmScore.blue++; document.getElementById('fcm-score-blue').innerText = window.fcmScore.blue;
                    document.getElementById('fcm-ball').style.left = '95%'; document.getElementById('fcm-ball').style.top = '50%'; 
                    document.getElementById('fcm-commentary').innerHTML = `<span class="text-blue">⚽ GOAL BLUE!!! VÀOOOOO!!! Rất đẹp mắt.</span>`;
                } else {
                    window.fcmScore.red++; document.getElementById('fcm-score-red').innerText = window.fcmScore.red;
                    document.getElementById('fcm-ball').style.left = '5%'; document.getElementById('fcm-ball').style.top = '50%'; 
                    document.getElementById('fcm-commentary').innerHTML = `<span class="text-red">⚽ GOAL RED!!! Lưới đã rung lên!</span>`;
                }
            }
        }
        
        // Kết thúc trận
        if(window.fcmTime >= window.fcmTotalTime) {
            clearInterval(window.fcmInterval); finishFcMobileMatch();
        }
    }, 1000); // 1s = 1 phút trong game
};

async function finishFcMobileMatch() {
    document.getElementById('fcm-commentary').innerText = "HẾT GIỜ! Trận đấu đã kết thúc.";
    let sB = window.fcmScore.blue; let sR = window.fcmScore.red;
    let winningTeam = sB > sR ? 'BLUE' : (sR > sB ? 'RED' : 'DRAW');
    
    let payout = 0; let msg = `Tỉ số chung cuộc: Xanh ${sB} - ${sR} Đỏ.\n`; let isWin = false; let title = "";
    
    if (winningTeam === 'DRAW') {
        payout = window.fcmBet; // Hoàn tiền
        msg += "Kết quả HÒA. Trả lại tiền cược."; title = "HÒA NHAU"; isWin = true;
    } else if (winningTeam === window.fcmChoice) {
        let gap = Math.abs(sB - sR);
        if (gap >= 2) {
            payout = window.fcmBet * 2.5; // Thắng cách biệt ăn x2.5
            msg += "Đội của bạn đã thắng CÁCH BIỆT! Nhận x2.5 tiền cược."; title = "THẮNG LỚN";
        } else {
            payout = window.fcmBet * 2; // Thắng thường ăn x2
            msg += "Đội của bạn đã chiến thắng! Nhận x2 tiền cược."; title = "THẮNG CƯỢC";
        }
        isWin = true;
    } else {
        payout = 0; // Thua
        msg += "Đội của bạn đã thua trận."; title = "THUA CƯỢC"; isWin = false;
    }
    
    if (payout > 0) { const ns = await get(ref(db,`users/${uid}`)); await update(ref(db,`users/${uid}`),{pp: (Number(ns.val().pp)||0) + payout}); }
    
    window.logGame(uid, localStorage.getItem('uname'), "FC Mobile", window.fcmBet, payout - window.fcmBet, isWin && winningTeam !== 'DRAW' ? "Thắng" : (winningTeam === 'DRAW' ? "Hòa" : "Thua"));
    
    setTimeout(() => {
        window.isFcmActive = false; window.openFcMobileGame(); window.showResult(title, msg, isWin);
    }, 3000);
}

// CÁC MINIGAMES NHỎ
async function executeBet(gameName, logicCallback) { let bet = prompt(`[ ${gameName} ]\nNhập PP cược:`); if(!bet) return; bet = parseInt(bet); if(isNaN(bet) || bet <= 0) return window.showResult("LỖI", "Cược không hợp lệ!", false); const snap = await get(ref(db, `users/${uid}`)); const u = snap.val(); const currentPP = Number(u.pp) || 0; if(currentPP < bet) return window.showResult("NGHÈO", `Không đủ cược!`, false); const res = await logicCallback(bet, currentPP); if(res === null) return; const { payout, message, title, isWin } = res; const modal = document.getElementById('result-modal'); const t = document.getElementById('result-title'); const msg = document.getElementById('result-msg'); const icon = document.getElementById('result-icon'); const btn = document.getElementById('result-close-btn'); t.innerText = "ĐANG XỬ LÝ..."; t.className = "text-blue glow-pulse"; msg.innerHTML = ""; icon.className = "fas fa-spinner fa-spin fa-3x text-blue"; btn.style.display = 'none'; modal.style.display = 'flex'; setTimeout(async () => { const freshSnap = await get(ref(db, `users/${uid}`)); const freshPP = Number(freshSnap.val().pp) || 0; await update(ref(db, `users/${uid}`), { pp: freshPP + payout }); window.logGame(uid, u.name, gameName, bet, payout, isWin?"Thắng":"Thua"); t.innerText = title; t.className = isWin ? 'text-gold glow-pulse' : 'text-red glow-pulse'; msg.innerHTML = `${message}<br><br>=> TÀI SẢN: ${(freshPP + payout).toLocaleString()}`; icon.className = isWin ? "fas fa-trophy fa-3x text-gold" : "fas fa-skull fa-3x text-red"; btn.style.display = 'block'; }, 1500); }
window.playTarot=()=>executeBet("BÓI TAROT",b=>{let c=prompt("Có 3 bài úp (1,2,3). Chọn lá:");if(!['1','2','3'].includes(c))return null;const cd=[{n:"SUN☀️",m:5},{n:"LOVERS💕",m:2},{n:"TOWER🌩️",m:0},{n:"DEATH💀",m:0},{n:"WHEEL🎡",m:1.5}];const dr=cd[Math.floor(Math.random()*cd.length)];const p=Math.floor(b*dr.m)-b;if(p>=0)return{payout:p,message:`Lá ${dr.n}\nNhận ${(p+b).toLocaleString()}`,title:"THẮNG",isWin:true};return{payout:p,message:`Lá ${dr.n}\nMất ${b.toLocaleString()}`,title:"THUA",isWin:false};});
window.playSquidGame=()=>executeBet("CẦU KÍNH SQUID",b=>{let s=1;while(s<=5){let c=prompt(`BƯỚC ${s}/5: Chọn T (Trái) hay P (Phải)?`);if(!c)return{payout:-b,message:`Bỏ cuộc mất ${b.toLocaleString()}`,title:"CHẾT",isWin:false};if(Math.random()<0.40){alert(`Bước ${s} AN TOÀN!`);s++;}else return{payout:-b,message:`RƠI VỰC BƯỚC ${s}! Mất ${b.toLocaleString()}`,title:"RƠI VỰC",isWin:false};}return{payout:b*20,message:`QUA CẦU! Ăn ${(b*20).toLocaleString()}`,title:"SỐNG SÓT",isWin:true};});
window.playMinesweeper=()=>executeBet("MÁY DÒ MÌN",b=>{let g=prompt(`Nhập 3 ô (1-10) AN TOÀN. VD: 2, 5, 9`);if(!g)return null;let pc=g.split(',').map(s=>parseInt(s.trim()));if(pc.length!==3)return null;let ms=[];while(ms.length<4){let m=Math.floor(Math.random()*10)+1;if(!ms.includes(m))ms.push(m);}let hm=pc.filter(c=>ms.includes(c));if(hm.length>0)return{payout:-b,message:`Mìn ở [${ms.join(',')}]\nĐạp mìn ô ${hm[0]}! Mất ${b.toLocaleString()}`,title:"BÙM",isWin:false};return{payout:b*5,message:`Mìn ở [${ms.join(',')}]\nAn toàn! Ăn ${(b*5).toLocaleString()}`,title:"SỐNG",isWin:true};});
window.playAuction=()=>executeBet("ĐẤU GIÁ",b=>{const rv=Math.floor(Math.random()*99000)+1000;const bt=Math.floor(rv*(Math.random()*0.9+0.4));let bi=parseInt(prompt(`Giá mua (Rương 1k-100k):`));if(isNaN(bi))return null;if(bi<bt)return{payout:0,message:`Giá rẻ, ko bán! (Chứa ${rv.toLocaleString()})`,title:"HỦY",isWin:true};const np=rv-bi;if(np>=0)return{payout:np,message:`Mở: ${rv.toLocaleString()} PP! LỜI ${np.toLocaleString()}`,title:"THẮNG",isWin:true};return{payout:np,message:`Mở: ${rv.toLocaleString()} PP! LỖ ${(np*-1).toLocaleString()}`,title:"BỊ HỚ",isWin:false};});
window.playCockfight=(c)=>executeBet("ĐÁ GÀ",b=>{const w=Math.random()>0.6?(c==='RED'?'BLUE':'RED'):c;return c===w?{payout:b,message:`Gà thắng! Ăn ${b.toLocaleString()}`,title:"THẮNG",isWin:true}:{payout:-b,message:`Gà gãy giò!`,title:"THUA",isWin:false};});
window.playThreeCards=()=>executeBet("BÀI CÀO",b=>{const p=(Math.floor(Math.random()*10)*3)%10,d=(Math.floor(Math.random()*10)*3)%10;if(p>d&&Math.random()>0.1)return{payout:b,message:`Bạn ${p} - Cái ${d}. Thắng!`,title:"THẮNG",isWin:true};if(p===d)return{payout:-Math.floor(b*0.2),message:`Hòa. Thu 20% phế.`,title:"HÒA",isWin:false};return{payout:-b,message:`Bạn ${p} - Cái ${d}. Thua!`,title:"THUA",isWin:false};});
window.playCupid=()=>executeBet("MŨI TÊN T/Y",b=>{const m=(Math.random()*3).toFixed(1),df=Math.floor(b*m)-b;if(df>0)return{payout:df,message:`x${m}! Lời ${df.toLocaleString()}`,title:"THẮNG",isWin:true};return{payout:df,message:`x${m}! Lỗ ${(df*-1).toLocaleString()}`,title:df===0?"HÒA":"THUA",isWin:false};});
window.playShield=()=>executeBet("ĐỠ ĐẠN",b=>{if(Math.random()<0.4)return{payout:Math.floor(b*0.3),message:`Lời ${(Math.floor(b*0.3)).toLocaleString()}`,title:"SỐNG",isWin:true};return{payout:-b,message:`Vỡ khiên!`,title:"CHẾT",isWin:false};});
window.playPirate=(c)=>executeBet("KHO BÁU",b=>{const w=Math.floor(Math.random()*4)+1;return c===w?{payout:b*2,message:`Trúng vàng! Ăn ${(b*2).toLocaleString()}`,title:"THẮNG",isWin:true}:{payout:-b,message:`Bị cướp!`,title:"THUA",isWin:false};});

// KHỞI ĐỘNG HỆ THỐNG
if (uid) { document.getElementById('login-screen').style.display='none'; document.getElementById('dashboard').style.display='flex'; if(document.getElementById('add-class-select')) { document.getElementById('add-class-select').innerHTML=genClassOptions('Y1_A'); document.getElementById('filter-class-select').innerHTML=genClassOptions('ALL',true); } loadSystem(); }
