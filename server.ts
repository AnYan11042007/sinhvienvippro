/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, push, update } from 'firebase/database';

dotenv.config();

// Create Express Server
const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('GEMINI_API_KEY is not defined in environment variables.');
    }
    ai = new GoogleGenAI({
      apiKey: key || 'MOCK_KEY_FOR_DEV',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// ----------------- API ROUTES -----------------

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// AI Tutor / Gia sư endpoint
app.post('/api/gemini/tutor', async (req, res) => {
  const { question, subject, studentStats, history } = req.body;
  
  try {
    const client = getGeminiClient();
    const systemPrompt = `Bạn là một AI Gia sư (AI Teacher) cao cấp, vui vẻ, hài hước và rất giỏi chuyên môn của trường S-System 88. 
Nhiệm vụ của bạn là giải thích bài tập, lý thuyết môn học: "${subject || 'Toàn diện'}" cho sinh viên.
Chỉ số năng lực hiện tại của sinh viên: Cần Cù (${studentStats?.[0] || 50}), Trí Tuệ (${studentStats?.[1] || 50}), Nhân Phẩm (${studentStats?.[4] || 50}).
Hãy đưa ra câu trả lời chi tiết, dễ hiểu, định dạng Markdown đẹp mắt, có code ví dụ rõ ràng nếu cần thiết. 
Sử dụng giọng văn khích lệ, cổ vũ tinh thần học tập của sinh viên, thỉnh thoảng dùng thuật ngữ vui nhộn liên quan đến trường học S-System 88.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: question,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error?.message || 'Có lỗi xảy ra khi gọi Gemini API' });
  }
});

// General AI Chat Endpoint
app.post('/api/gemini/chat', async (req, res) => {
  const { message, history } = req.body;

  try {
    const client = getGeminiClient();
    const systemPrompt = `Bạn là S-System 88 Core AI - Bộ óc điều hành toàn bộ hệ thống Học tập, Ngân hàng, Sàn vàng, Đấu trường Las Vegas của Học viện S-System 88.
Hãy giao tiếp bằng giọng văn Cyberpunk, thông minh, mang tính khoa học viễn tưởng cao, thỉnh thoảng khuyên bảo người dùng kiếm tiền PP lương thiện hoặc chơi game điều độ.
Trả lời bằng tiếng Việt, súc tích, ngầu lòi, có định dạng Markdown đẹp mắt.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: error?.message || 'Có lỗi xảy ra khi gọi Gemini API' });
  }
});

// Vite Dev Server / Static files handler
const setupVite = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
};

// Firebase Configuration for Server-side gold simulation
const firebaseConfig = {
  apiKey: "AIzaSyCfrD1iS1yjfjuaPIKvGb-iWcirBg1lXJE",
  authDomain: "appsinhvien-24482.firebaseapp.com",
  databaseURL: "https://appsinhvien-24482-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "appsinhvien-24482"
};

const fApp = initializeApp(firebaseConfig);
const db = getDatabase(fApp);

// Live Gold Market Simulator
async function runGoldSimulationTick() {
  try {
    const goldRef = ref(db, 'market/gold');
    const snap = await get(goldRef);
    
    let currentPrice = 50000000;
    let oldPrice = 50000000;
    let history: number[] = [];
    let high24h = 55000000;
    let low24h = 45000000;

    if (snap.exists()) {
      const val = snap.val();
      currentPrice = val.price || 50000000;
      oldPrice = currentPrice;
      history = val.history || [];
      high24h = val.high24h || 55000000;
      low24h = val.low24h || 45000000;
    } else {
      // Seed initial history
      for (let i = 0; i < 60; i++) {
        history.push(50000000 + Math.floor((Math.random() - 0.5) * 5000000));
      }
    }

    // Volatility calculation (between -3.0% and +3.2%)
    const changePercent = (Math.random() * 6.2 - 3.0) / 100;
    const nextPrice = Math.floor(currentPrice * (1 + changePercent));
    const finalizedPrice = Math.max(10000000, Math.min(150000000, nextPrice));

    history.push(finalizedPrice);
    if (history.length > 60) {
      history.shift();
    }

    high24h = Math.max(high24h, finalizedPrice);
    low24h = Math.min(low24h, finalizedPrice);

    const statuses = [
      { text: 'BIẾN ĐỘNG CỰC ĐỘ 🔥', color: '#ff0055' },
      { text: 'TĂNG TRƯỞNG NÓNG 📈', color: '#00ff80' },
      { text: 'SUY THOÁI KỸ THUẬT 📉', color: '#ff003c' },
      { text: 'ỔN ĐỊNH BỀN VỮNG 💎', color: '#00f0ff' },
      { text: 'TÍCH LŨY ĐI NGANG ⚡', color: '#ffd700' }
    ];
    
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const updateTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await set(goldRef, {
      price: finalizedPrice,
      oldPrice: oldPrice,
      high24h: high24h,
      low24h: low24h,
      history: history,
      lastUpdate: Date.now(),
      statusText: randomStatus.text,
      statusColor: randomStatus.color,
      updateTimeString: updateTime,
      volumeBuy: Math.floor(Math.random() * 500000) + 100000,
      volumeSell: Math.floor(Math.random() * 500000) + 100000
    });

    console.log(`[Gold Sim] Updated price to ${finalizedPrice.toLocaleString()} PP at ${updateTime}`);
  } catch (err) {
    console.error('[Gold Sim Error]:', err);
  }
}

function startGoldSimulator() {
  // Run once immediately on start
  runGoldSimulationTick();
  // Set interval for every 1 minute (60,000 ms)
  setInterval(runGoldSimulationTick, 60000);
}

// ----------------- 20 ACTIVE AI BOTS SIMULATOR -----------------

const BOTS = [
  { id: 'bot_1', name: 'Nguyễn Minh Đức', class: 'S88-SE1', avatar: 'stud_1', basePP: 87500, level: 4, frame: 'gold-ring' },
  { id: 'bot_2', name: 'Lê Hoàng Nam', class: 'S88-SE2', avatar: 'stud_2', basePP: 54000, level: 3, frame: '' },
  { id: 'bot_3', name: 'Trần Thu Thảo', class: 'S88-SE1', avatar: 'stud_3', basePP: 124500, level: 5, frame: 'neon-ring', title: 'Chúa Tể Học Thuật' },
  { id: 'bot_4', name: 'Phạm Hải Đăng', class: 'S88-SA1', avatar: 'stud_4', basePP: 32000, level: 2, frame: '' },
  { id: 'bot_5', name: 'Đỗ Gia Bảo', class: 'S88-GD1', avatar: 'stud_5', basePP: 95000, level: 4, frame: 'gold-ring' },
  { id: 'bot_6', name: 'Vũ Khánh Linh', class: 'S88-SA2', avatar: 'stud_6', basePP: 142000, level: 5, frame: 'cyber-ring', title: 'Đại Gia Học Đường' },
  { id: 'bot_7', name: 'Ngô Quốc Anh', class: 'S88-SE2', avatar: 'stud_1', basePP: 18000, level: 1, frame: '' },
  { id: 'bot_8', name: 'Bùi Tuyết Mai', class: 'S88-GD2', avatar: 'stud_2', basePP: 71500, level: 3, frame: '' },
  { id: 'bot_9', name: 'Dương Minh Khang', class: 'S88-SE1', avatar: 'stud_3', basePP: 110000, level: 5, frame: 'neon-ring', title: 'Thần Bài Las Vegas' },
  { id: 'bot_10', name: 'Phan Thanh Trúc', class: 'S88-SA1', avatar: 'stud_4', basePP: 43500, level: 2, frame: '' },
  { id: 'bot_11', name: 'Nguyễn Việt Anh', class: 'S88-SE3', avatar: 'stud_5', basePP: 65000, level: 3, frame: '' },
  { id: 'bot_12', name: 'Đặng Hồng Nhung', class: 'S88-GD1', avatar: 'stud_6', basePP: 135000, level: 5, frame: 'cyber-ring', title: 'Ông Trùm Đầu Tư' },
  { id: 'bot_13', name: 'Lý Gia Hưng', class: 'S88-SA2', avatar: 'stud_1', basePP: 22000, level: 2, frame: '' },
  { id: 'bot_14', name: 'Trịnh Bảo Ngọc', class: 'S88-SE1', avatar: 'stud_2', basePP: 89000, level: 4, frame: 'gold-ring' },
  { id: 'bot_15', name: 'Hoàng Văn Tiến', class: 'S88-GD2', avatar: 'stud_3', basePP: 51200, level: 3, frame: '' },
  { id: 'bot_16', name: 'Mai Thùy Chi', class: 'S88-SE2', avatar: 'stud_4', basePP: 156000, level: 5, frame: 'cyber-ring', title: 'Đại Gia Học Đường' },
  { id: 'bot_17', name: 'Phạm Minh Quân', class: 'S88-SA1', avatar: 'stud_5', basePP: 29500, level: 2, frame: '' },
  { id: 'bot_18', name: 'Vũ Phương Thảo', class: 'S88-SE1', avatar: 'stud_6', basePP: 104000, level: 4, frame: 'neon-ring' },
  { id: 'bot_19', name: 'Lê Hữu Đạt', class: 'S88-GD1', avatar: 'stud_1', basePP: 38000, level: 2, frame: '' },
  { id: 'bot_20', name: 'Đỗ Thùy Linh', class: 'S88-SA2', avatar: 'stud_2', basePP: 77000, level: 3, frame: 'gold-ring' }
];

const BOT_CHATS = [
  "Má ơi, sút phạt hỏng quả cuối tiếc đứt ruột... 😤",
  "Đã bảo Tài là Tài mà ae không tin, ăn hũ x2 ấm cật",
  "Phi thuyền nổ ở x12 luôn, đỉnh chóp thực sự!",
  "Mới gom đủ PP xúc quả Khung Gold, đeo vào chất chơi hẳn",
  "Có ai rảnh gạ kèo Oẳn Tù Tì không? Đang thừa PP nè",
  "Điểm danh hàng ngày được cộng XP sướng quá ae ơi",
  "Bộ câu hỏi trắc nghiệm của Trưởng Khoa khó thế, ai làm được chưa cứu tui với",
  "Đang đua top căng đét, ae né ra cho tôi lên hạng 1 coi",
  "Sàn vàng biến động kinh hoàng quá, mới lướt sóng kiếm được mớ PP",
  "Xì dách phát bài đen thui, nhà cái húp hết trơn",
  "Tiến lên solo kịch tính vđ, suýt chút nữa là ăn trắng rồi",
  "Gia sư AI giải thích dễ hiểu vãi, đỡ phải tự mò",
  "Ủy ban phòng chống gian lận gắt quá, ko dám lơ tơ mơ",
  "Vừa được đại gia phương xa tặng 10k PP mừng sinh nhật, yêu thế",
  "Reset Battle Pass còn bao nhiêu ngày nữa thế mọi người?",
  "Mở hộp quà may mắn ra danh hiệu ngầu đét, lêu lêu ae",
  "Hôm nay quyết tâm cày lên Cấp độ 5 để lấy Khung Cyber!"
];

async function seedAIBots() {
  console.log('[AI Bots] Checking bot accounts...');
  try {
    for (const bot of BOTS) {
      const botRef = ref(db, `users/${bot.id}`);
      const snap = await get(botRef);
      if (!snap.exists()) {
        console.log(`[AI Bots] Seeding account for ${bot.name} (${bot.id})`);
        await set(botRef, {
          name: bot.name,
          class: bot.class,
          classKey: bot.class.toLowerCase().replace('-', '_'),
          pp: bot.basePP,
          role: 'STUDENT',
          level: bot.level,
          xp: Math.floor(Math.random() * 80),
          avatar: bot.avatar,
          activeFrame: bot.frame || null,
          title: bot.title || null,
          locked: false,
          isPremiumBattlePass: Math.random() < 0.4,
          inventory: {
            frames: bot.frame ? [bot.frame] : [],
            titles: bot.title ? [bot.title] : []
          }
        });
      }
    }
    console.log('[AI Bots] All 20 bot accounts verified!');
  } catch (err) {
    console.error('[AI Bots Seeding Error]:', err);
  }
}

async function runAIBotSimulationTick() {
  try {
    // Pick a random bot
    const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
    const botRef = ref(db, `users/${bot.id}`);
    const snap = await get(botRef);
    if (!snap.exists()) return;

    const botData = snap.val();
    let currentPP = botData.pp || 10000;
    let level = botData.level || 1;
    let xp = botData.xp || 0;

    const rand = Math.random();

    if (rand < 0.6) {
      // Simulate Game Bet (60% chance)
      const games = ['Tài Xỉu', 'Phi Thuyền', 'Sút Phạt', 'Ngựa Đua'];
      const chosenGame = games[Math.floor(Math.random() * games.length)];
      
      const bet = Math.floor(Math.random() * 9000) + 1000;
      if (currentPP < bet) {
        currentPP += 20000;
        await set(ref(db, `users/${bot.id}/pp`), currentPP);
        return;
      }

      const isWin = Math.random() < 0.48;
      let pnl = -bet;
      let resultText = '';

      if (isWin) {
        const multiplier = chosenGame === 'Phi Thuyền' ? (Math.random() * 2.5 + 1.2) : 2.0;
        pnl = Math.floor(bet * (multiplier - 1));
        resultText = chosenGame === 'Phi Thuyền' 
          ? `Nhảy dù chốt x${multiplier.toFixed(2)} (Thắng)` 
          : `Thắng cược nhân đôi tài sản`;
      } else {
        resultText = chosenGame === 'Phi Thuyền' 
          ? `Nổ phi thuyền ở x${(Math.random() * 1.5 + 1.0).toFixed(2)} (Thua)` 
          : `Thua cược trắng tay`;
      }

      const nextPP = currentPP + pnl;
      const gainedXP = Math.floor(Math.random() * 15) + 10;
      let nextXP = xp + gainedXP;
      let nextLevel = level;
      if (nextXP >= nextLevel * 100) {
        nextXP -= nextLevel * 100;
        nextLevel += 1;
      }

      await update(botRef, {
        pp: nextPP,
        level: nextLevel,
        xp: nextXP
      });

      const logRef = ref(db, 'game_logs');
      await set(push(logRef), {
        uid: bot.id,
        name: bot.name,
        game: chosenGame,
        bet: bet,
        pnl: pnl,
        result: resultText,
        time: new Date().toLocaleString('vi-VN'),
        timestamp: Date.now()
      });

      if (Math.random() < 0.35) {
        const chatRef = ref(db, 'global_chat');
        let msg = '';
        if (isWin) {
          msg = chosenGame === 'Phi Thuyền' 
            ? `Ngon lành cành đào! Chốt lời phi thuyền ăn x${(pnl/bet + 1).toFixed(2)} được +${pnl.toLocaleString()} PP ae ơi! 🔥`
            : `Đã bảo mà, vừa húp trọn ván ${chosenGame} ngọt xớt +${pnl.toLocaleString()} PP! 🎉`;
        } else {
          msg = chosenGame === 'Phi Thuyền'
            ? `Đen vãi chưởng, tham lam quá định chờ x5 ai dè phi thuyền nổ tung ở x${(Math.random()*1.5+1).toFixed(2)} 😭`
            : `Đi đứt ${bet.toLocaleString()} PP bên ${chosenGame} rồi, hôm nay đen như chấy! 💀`;
        }
        await set(push(chatRef), {
          senderId: bot.id,
          senderName: bot.name,
          senderAvatar: bot.avatar,
          senderTitle: botData.title || '',
          senderFrame: botData.activeFrame || '',
          message: msg,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now()
        });
      }

    } else if (rand < 0.90) {
      // Simulate General Chit-Chat (30% chance)
      const chatRef = ref(db, 'global_chat');
      const msg = BOT_CHATS[Math.floor(Math.random() * BOT_CHATS.length)];
      await set(push(chatRef), {
        senderId: bot.id,
        senderName: bot.name,
        senderAvatar: bot.avatar,
        senderTitle: botData.title || '',
        senderFrame: botData.activeFrame || '',
        message: msg,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });
    } else {
      // Simulate Marketplace Purchase & Equip (10% chance)
      const frames = ['gold-ring', 'neon-ring', 'cyber-ring'];
      const titles = ['Chúa Tể Học Thuật', 'Ông Trùm Đầu Tư', 'Thần Bài Las Vegas', 'Đại Gia Học Đường'];
      
      const isFrame = Math.random() < 0.5;
      const purchaseValue = isFrame 
        ? frames[Math.floor(Math.random() * frames.length)]
        : titles[Math.floor(Math.random() * titles.length)];

      const currentInventory = botData.inventory || { frames: [], titles: [] };
      const ownedFrames = currentInventory.frames || [];
      const ownedTitles = currentInventory.titles || [];

      const alreadyOwned = isFrame ? ownedFrames.includes(purchaseValue) : ownedTitles.includes(purchaseValue);
      if (!alreadyOwned) {
        const cost = isFrame ? 25000 : 40000;
        if (currentPP > cost) {
          if (isFrame) {
            ownedFrames.push(purchaseValue);
          } else {
            ownedTitles.push(purchaseValue);
          }
          await update(botRef, {
            pp: currentPP - cost,
            activeFrame: isFrame ? purchaseValue : (botData.activeFrame || null),
            title: isFrame ? (botData.title || null) : purchaseValue,
            inventory: {
              frames: ownedFrames,
              titles: ownedTitles
            }
          });

          const chatRef = ref(db, 'global_chat');
          const msg = isFrame 
            ? `Tôi vừa tậu thành công Khung đại diện mới xịn xò chưa ae! Đeo vào nhìn uy tín hẳn 😎`
            : `Chính thức lên chức "${purchaseValue}" rồi nhé, từ nay xin kiếu kiếp sinh viên nghèo! 💎`;
          
          await set(push(chatRef), {
            senderId: bot.id,
            senderName: bot.name,
            senderAvatar: bot.avatar,
            senderTitle: isFrame ? (botData.title || '') : purchaseValue,
            senderFrame: isFrame ? purchaseValue : (botData.activeFrame || ''),
            message: msg,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now()
          });
        }
      }
    }
  } catch (err) {
    console.error('[AI Bots Sim Error]:', err);
  }
}

function startAIBotSimulator() {
  seedAIBots().then(() => {
    // Run bot simulation tick every 20 seconds
    setInterval(runAIBotSimulationTick, 20000);
  });
}

setupVite().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    // Start the background gold simulator
    startGoldSimulator();
    // Start the background AI bot activity simulator
    startAIBotSimulator();
  });
});
