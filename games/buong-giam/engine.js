// GENERATED — đừng sửa tay. Sinh từ code gốc bằng: npm run build
// Nguồn: /tmp/buong-giam/server.js
// Thay đổi so với bản gốc (giữ nguyên luật chơi):
//  - Toàn bộ code gốc nằm trong createEngine(ctx): mỗi lần gọi là 1 room
//    mới, state (gameState/session/settings/timer) không chia sẻ.
//  - app/io/server riêng được thay bằng ctx.router / ctx.io của platform.
//  - DATA_DIR trỏ về thư mục data riêng của room.
//  - Timer được theo dõi để hủy room dọn sạch.
'use strict';

function createEngine(ctx) {
  // ctx do platform cấp mỗi room: { router, io, dataDir, gameDir, roomPrefix }
  // __dirname: trỏ về thư mục code gốc của game (đọc asset tĩnh).
  const __dirname = ctx.gameDir;
  // Theo dõi timer để hủy room dọn sạch (game gốc dùng setInterval/setTimeout
  // khắp nơi: autosave, phát voice, dọn user idle...). Nếu room đã chết thì
  // không cho đặt timer mới nữa (chặn vòng lặp tự hẹn giờ như StreamerBot).
  const __timers = new Set();
  const setInterval = (fn, ms, ...a) => {
    if (ctx.dead) return 0;
    const id = global.setInterval(fn, ms, ...a);
    __timers.add(id);
    return id;
  };
  const setTimeout = (fn, ms, ...a) => {
    if (ctx.dead) return 0;
    const id = global.setTimeout(fn, ms, ...a);
    __timers.add(id);
    return id;
  };
  const clearInterval = (id) => { __timers.delete(id); return global.clearInterval(id); };
  const clearTimeout = (id) => { __timers.delete(id); return global.clearTimeout(id); };
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
let TikTokLiveConnection = null;
try {
  TikTokLiveConnection = require('tiktok-live-connector').TikTokLiveConnection;
} catch (e) {
  console.warn('tiktok-live-connector not available directly, running webhook/streamerbot mode');
}

const app = ctx.router;

const io = ctx.io;

const DEFAULT_PORT = process.env.PORT || 3003;
const DATA_DIR = ctx.dataDir;
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts_cache');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TTS_CACHE_DIR)) fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.text({ type: ['text/*', 'application/javascript', 'application/octet-stream'], limit: '15mb' }));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0
}));

// MỤC 9.3 & 10.2: BẢNG QUY ĐỔI ĐIỂM BUỒNG CHUẨN XÁC & CÁC CƠ CHẾ MỚI
const defaultSettings = {
  mam1Threshold: 100, // Có điểm dẫn đầu buồng (vừa là Top 1 VÀ nhiều hơn 100đ): Ngồi Mâm 1 ăn gà
  mam2Threshold: 50,  // Top 2..5 (nhiều hơn 50đ): Ngồi Mâm 2 ăn bún
  mam3Threshold: 5,   // Có điểm (>=5đ): Đứng Mâm 3
  tapRate: 50,        // 50 taps = 1 điểm buồng
  followPoints: 10,   // 1 follow = 10 điểm buồng (1 lần duy nhất)
  rosePoints: 5,      // Hoa hồng = 5 điểm buồng
  pointsPerCoin: 5,   // Tỉ lệ mặc định 1 coin = 5 điểm buồng
  idleMinutes: 1,     // Mặc định 1 phút không tương tác thì chuyển sang trạng thái đã rời / off
  awayMinutes: 1,     // Timeout chuyển sang trạng thái tạm rời / off (1 phút)
  commentBonusQuote: "Cố gắng cải tạo, sớm ngày hoà nhập xã hội",
  commentBonusPoints: 1,      // Mỗi lần comment đúng được cộng 1 điểm buồng
  commentQuotes: [
    { id: "cq_1", quote: "Cố gắng cải tạo, sớm ngày hoà nhập xã hội", points: 1 },
    { id: "cq_2", quote: "Quyết tâm cải tạo tốt", points: 2 }
  ],
  commentCooldownSeconds: 30, // Chống spam comment 30s
  idleDeductMinutes: 1,       // 1 phút liên tục không tương tác thì trừ 1 điểm buồng
  exitDeductMinutes: 5,       // 5 phút thoát LIVE thì trừ 1 điểm buồng
  chickenEatingMinutes: 10,   // MẶC ĐỊNH: 10 phút ăn hết gà (tốc độ nhanh gấp đôi)
  chickenEatingRatePerMinute: 10, // 10% mỗi phút (10 phút = 100% ăn hết gà)
  demoFastChicken: false,     // Tùy chọn tua nhanh tiến độ trong Demo
  announceJoinTts: false,     // MẶC ĐỊNH TẮT: Không đọc TTS khi có người mới vào xem để Voice 16 & BGM không bị nhảy loạn
  announceJoinSound: true,    // Chỉ phát tiếng mở cửa buồng giam nhẹ nhàng khi có người mới vào
  audio: {
    masterEnabled: true,
    masterVolume: 1.0,
    ambientEnabled: true,
    ambientVolume: 0.3,
    ambientTrack: 'track1',
    ttsEnabled: true,
    ttsVolume: 0.85,
    sfxEnabled: true,
    sfxVolume: 0.8,
    periodicVoiceEnabled: true,
    periodicVoiceInterval: 45
  },
  // Giá trị quà = ĐƠN GIÁ XU (coins), điểm buồng = xu × pointsPerCoin (tính động).
  // (Cờ giftsInCoins KHÔNG đặt ở defaults để còn nhận ra file cũ cần migrate.)
  gifts: {
    "Nốt nhạc": 1,
    "Mini Heart": 1,
    "Hoa hồng": 1,
    "Rose": 1,
    "Bắn tim": 5,
    "Finger Heart": 5,
    "Heo may mắn": 10,
    "Heo": 10,
    "Lucky Pig": 10,
    "Bánh vòng": 30,
    "Doughnut": 30,
    "Donut": 30,
    "Mũ": 99,
    "Cap": 99,
    "Kính mát": 199,
    "Sunglasses": 199
  },
  wallDecor: {
    mam1: { enabled: true, x: 430, y: 91, width: 144, height: 254, opacity: 0.95 },
    mam2: { enabled: true, x: 536, y: 496, width: 205, height: 205, opacity: 0.95 }
  }
};

// Nhận diện bảng quà CŨ (điểm cứng theo tỷ giá 5: Rose=5, Cap=495...)
// so với bảng MỚI (đơn giá xu: Rose=1, Cap=99...).
function giftsLookLikeOldPoints(g) {
  if (!g || typeof g !== 'object') return false;
  const anchors = [['Rose', 5, 1], ['Cap', 495, 99], ['Donut', 150, 30], ['Lucky Pig', 50, 10]];
  let oldHits = 0, newHits = 0;
  for (const [k, oldV, newV] of anchors) {
    if (g[k] === oldV) oldHits++;
    else if (g[k] === newV) newHits++;
  }
  return oldHits > 0 && newHits === 0;
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      // MIGRATE 1 LẦN trên dữ liệu thô: điểm-cứng-cũ -> đơn giá xu (chia 5).
      if (saved.giftsInCoins !== true && giftsLookLikeOldPoints(saved.gifts)) {
        for (const [gName, gVal] of Object.entries(saved.gifts)) {
          saved.gifts[gName] = Math.max(1, Math.round((parseInt(gVal) || 5) / 5));
        }
        console.log('[GIFT MIGRATE] Đã chuyển bảng quà sang đơn giá xu.');
      }
      saved.giftsInCoins = true;
      return {
        ...defaultSettings,
        ...saved,
        audio: { ...defaultSettings.audio, ...(saved.audio || {}) },
        gifts: { ...defaultSettings.gifts, ...(saved.gifts || {}) },
        commentQuotes: (Array.isArray(saved.commentQuotes) && saved.commentQuotes.length > 0) ? saved.commentQuotes : defaultSettings.commentQuotes
      };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  const fresh = { ...defaultSettings };
  fresh.giftsInCoins = true;
  return fresh;
}

function saveSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

let settings = loadSettings();
saveSettings(settings);

// BỘ LỌC TỪ NGỮ CHỬI BẬY & TỪ CẤM TIKTOK (THAY THẾ BẰNG TIẾNG PÍP 1000Hz TRÊN VOICE THÔNG BÁO)
const CENSOR_BEEP_PATH = path.join(__dirname, 'public', 'audio', 'censor_beep.mp3');
let censorBeepBuffer = null;
try {
  if (fs.existsSync(CENSOR_BEEP_PATH)) {
    censorBeepBuffer = fs.readFileSync(CENSOR_BEEP_PATH);
  }
} catch (e) {}

const BANNED_PATTERNS = [
  /đ[iị][t|ch](\s+m[ẹe](\s+ch[úu]ng\s+m[àa]y)?)?/gi,
  /đ[ụu](\s+m[áa]|m[ẹe](\s+m[àa]y)?)?/gi,
  /\b(đm|đcm|dcm|dkm|đkm|vcl|vkl|vcc|vch|cl|vl|vcll)\b/gi,
  /l[ồo0][n|l|z](\s+th[âa]m|\s+m[ẹe]|\s+b[àa])?/gi,
  /[iI]ồn(\s+th[âa]m)?/gi,
  /c[ặa]c|c[a|ặ]k|cax|bu[ồo0]i/gi,
  /\b(đ[éee]o|đ[ếe]ch|đ[áa]ch)\b/gi,
  /\b(đĩ|phò|cave|gái điếm|gái gọi|lăng loàn)\b/gi,
  /\b(chó đẻ|thằng chó|con chó|đồ chó|mả mẹ|chó chết)\b/gi,
  /\b(m[ẹe]\s+m[àa]y|b[ốo]\s+m[àa]y|cha\s+m[àa]y|cụ\s+m[àa]y|bố\s+m)\b/gi,
  /\b(giết|tự tử|tự sát|chém chết|đâm chết|bắn chết)\b/gi,
  /\b(ma t[úu]y|cần sa|hàng trắng|hàng đá|thuốc phiện|đập đá)\b/gi,
  /\b(bắn tinh|thủ dâm|tự sướng|hiếp dâm|dâm ô|loạn luân|ấu dâm)\b/gi,
  /đ[\s._*!@#-]*[iị][\s._*!@#-]*[t|ch]/gi,
  /l[\s._*!@#-]*[ồo0][\s._*!@#-]*[n|l|z]/gi,
  /c[\s._*!@#-]*[ặa][\s._*!@#-]*[c|k]/gi,
  /đ[\s._*!@#-]*[m|c]/gi,
  /d[\s._*!@#-]*k[\s._*!@#-]*m/gi
];

function sanitizeForSpeech(text) {
  if (!text || typeof text !== 'string') return '';
  let res = text;
  for (const pat of BANNED_PATTERNS) {
    res = res.replace(pat, ' __BEEP__ ');
  }
  return res.replace(/(\s*__BEEP__\s*)+/g, ' __BEEP__ ').trim();
}

function sanitizeForDisplay(text) {
  if (!text || typeof text !== 'string') return '';
  let res = text;
  for (const pat of BANNED_PATTERNS) {
    res = res.replace(pat, '***');
  }
  return res;
}

// DANH MỤC XU CHUẨN CÁC QUÀ TIKTOK CHÍNH THỨC (QUY ĐỔI CHUẨN XÁC THEO GIÁ XU TIKTOK)
const KNOWN_GIFT_COINS = {
  // 1 xu: Hoa hồng, nốt nhạc, trái tim nhỏ, kem, gg, tiktok
  'hoa hong': 1, 'hoa hồng': 1, 'rose': 1, 'bong hoa': 1,
  'mini heart': 1, 'not nhac': 1, 'nốt nhạc': 1, 'music note': 1, 'ice cream': 1, 'gg': 1, 'tiktok': 1, 'heart me': 1,
  // 5 xu: Bắn tim (Finger Heart), Gấu trúc (Panda), Hi, Mic, Okay
  'finger heart': 5, 'ban tim': 5, 'bắn tim': 5, 'panda': 5, 'gau truc': 5, 'gấu trúc': 5, 'hi': 5, 'mic': 5, 'okay': 5,
  // 10 xu: Heo may mắn (Lucky Pig), Rosa
  'heo may man': 10, 'heo may mắn': 10, 'lucky pig': 10, 'piggy': 10, 'rosa': 10,
  // 20 xu: Cờ Việt Nam, Little Kisses, Glow Stick
  'co viet nam': 20, 'cờ việt nam': 20, 'little kisses': 20, 'glow stick': 20,
  // 30 xu: Bánh vòng (Doughnut / Donut)
  'donut': 30, 'doughnut': 30, 'banh vong': 30, 'bánh vòng': 30,
  // 99 xu: Mũ lưỡi trai (Cap), Hạc giấy (Paper Crane)
  'mu luoi trai': 99, 'mũ lưỡi trai': 99, 'paper crane': 99, 'hac giay': 99, 'hạc giấy': 99,
  // 100 xu: Hand Heart (Trái tim trao tay), Confetti
  'hand heart': 100, 'trai tim trao tay': 100, 'trái tim trao tay': 100, 'confetti': 100,
  // 199 xu: Kính mát / Kính râm (Sunglasses)
  'kinh mat': 199, 'kính mát': 199, 'sunglasses': 199, 'glasses': 199, 'kinh ram': 199, 'kính râm': 199,
  // 500 xu: Súng tiền (Money Gun)
  'money gun': 500, 'sung tien': 500, 'súng tiền': 500,
  // 1000+ xu: Cá voi, Sư tử, Vũ trụ TikTok
  'whale': 2150, 'ca voi': 2150, 'cá voi': 2150,
  'lion': 29999, 'su tu': 29999, 'sư tử': 29999,
  'universe': 44999, 'vu tru': 44999, 'vũ trụ': 44999
};

function removeAccents(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * QUY ĐỔI QUÀ TẶNG THÀNH ĐIỂM BUỒNG THEO GIÁ TRỊ XU (1 XU = settings.pointsPerCoin ĐIỂM BUỒNG):
 * - Điểm buồng nhận được = Giá trị xu của quà x settings.pointsPerCoin.
 * - Ưu tiên giá trị xu chính thức (diamondCount / coins) do TikFinity/TikTok gửi.
 * - Danh mục quà chuẩn chỉ dùng làm fallback khi webhook không kèm trường xu,
 *   tuyệt đối không đè giá trị xu thật của TikTok.
 */
function resolveGiftPoints(rawName, rawCoins, rawCount = 1, rawGiftId = '') {
  const count = Math.max(1, parseInt(rawCount) || 1);
  const nameNorm = removeAccents(rawName);
  const passedCoins = Math.max(0, parseInt(rawCoins) || 0);
  const pointsPerCoin = Math.max(1, parseInt(settings.pointsPerCoin) || 5);

  let knownUnit = 0;
  // So khớp từ khóa dài nhất trước để tránh nhầm (ví dụ "hand heart" khớp 100 xu trước)
  const sortedKeys = Object.keys(KNOWN_GIFT_COINS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (nameNorm === key || nameNorm.includes(key)) {
      knownUnit = KNOWN_GIFT_COINS[key];
      break;
    }
  }

  let unitCoins = 0;
  let totalCoins = 0;

  // 1. ƯU TIÊN SỐ 1: GIÁ TRỊ XU CHÍNH THỨC TỪ TIKTOK / TIKFINITY
  if (passedCoins > 0) {
    // Nếu webhook gửi đơn giá quà trùng với knownUnit đã biết
    if (knownUnit > 0 && (passedCoins === knownUnit || passedCoins === knownUnit * count)) {
      unitCoins = knownUnit;
      totalCoins = unitCoins * count;
    } else if (count > 1 && passedCoins % count === 0 && passedCoins >= count) {
      // passedCoins là tổng xu combo chia hết cho số lượng
      unitCoins = Math.round(passedCoins / count);
      totalCoins = passedCoins;
    } else {
      // passedCoins là đơn giá 1 món quà (ví dụ Hand Heart = 100 xu, Confetti = 100 xu)
      unitCoins = passedCoins;
      totalCoins = unitCoins * count;
    }
  } else if (knownUnit > 0) {
    // 2. Không kèm trường xu trong webhook: tra cứu danh mục chuẩn
    unitCoins = knownUnit;
    totalCoins = unitCoins * count;
  } else {
    // 3. Tra cứu trong bảng settings.gifts của Dashboard (giá trị = ĐƠN GIÁ XU)
    if (settings.gifts) {
      for (const [gName, gCoins] of Object.entries(settings.gifts)) {
        if (removeAccents(gName) === nameNorm || nameNorm.includes(removeAccents(gName))) {
          unitCoins = Math.max(1, parseInt(gCoins) || 1);
          totalCoins = unitCoins * count;
          break;
        }
      }
    }
  }

  // Nếu quà hoàn toàn KHÔNG CÓ giá trị xu:
  if (totalCoins <= 0 || unitCoins <= 0) {
    console.warn(`[GIFT WARNING] Quà "${rawName}" (ID: ${rawGiftId || 'N/A'}) chưa rõ giá trị xu. Không thể quy đổi điểm buồng!`);
    addLog(`⚠️ Quà [${rawName}] (ID: ${rawGiftId || 'N/A'}) chưa rõ giá trị xu trong sự kiện LIVE. Chờ chủ phòng xác nhận!`, 'warning');
    return {
      pointsPerUnit: 0,
      totalPoints: 0,
      count,
      unitCoins: 0,
      totalCoins: 0,
      isUnknown: true
    };
  }

  // CÔNG THỨC CHỐT: điểm = xu × tỷ giá hiện hành
  const totalPoints = totalCoins * pointsPerCoin;
  const pointsPerUnit = unitCoins * pointsPerCoin;

  return {
    pointsPerUnit,
    totalPoints,
    count,
    unitCoins,
    totalCoins,
    isUnknown: false
  };
}

// In-Memory Live State
let webhookCount = 0; // Số event thật qua /api/webhook (adapter đẩy vào) — dashboard dùng làm "số sự kiện đã nhận".
let gameState = {
  users: {},          // id -> user object
  ranking: [],        // array of user ids sorted by points desc
  exemplaryInmates: [], // Danh sách "Tấm gương sáng" đã ăn hết gà và xuất trại
  chicken: {
    stage: 0,         // 0: 0%, 1: 20%, 2: 40%, 3: 60%, 4: 80%, 5: 100%
    progress: 0,      // 0 - 100%
    minutesHeld: 0,   // Số phút giữ mâm 1 liên tục
    currentTop1: null,
    startedAt: 0,
    lastTick: Date.now(),
    sessionMins: null, // Mốc phút của lượt ăn hiện tại (chụp lúc bắt đầu lượt; đổi setting giữa chừng áp dụng từ lượt sau)
    isExiting: false  // true trong 10-15s cảnh xuất trại
  },
  stairQueue: [],     // queue of user IDs transitioning
  activeClimbers: {}, // id -> climbing state
  logs: [],
  followedUserIds: [], // Lưu trữ danh sách ID đã nhận thưởng follow (chỉ tính lần đầu)
  isDemoMode: false,
  tiktokConnected: false,
  tiktokUsername: '',
  streamerbotConnected: false
};

// Session User Archive (Bảo lưu điểm khi out live quay lại - Ý 2)
const sessionUserArchive = {};
const userAliasMap = {}; // Map 2 chiều giữa userId và uniqueId để không bao giờ tạo trùng nhân vật
const exemplaryRankTracker = new Map(); // Đặt sớm: syncExemplaryList() chạy ngay khi khôi phục autosave
// Đặt sớm: khôi phục autosave có thể leo thang ngay -> cần trước khối restore
// MỤC 10.3 & 11.2: BỘ CÂU ĐỘNG VIÊN CẢI TẠO TÍCH CỰC & HÀI HƯỚC (CHUẨN TIÊU CHUẨN CỘNG ĐỒNG TIKTOK)
const TROLL_QUOTES = {
  giftNormal: [
    "Cố gắng cải tạo đều tay vào em ơi! Chăm chỉ nỗ lực thì sớm muộn cũng thăng hạng!",
    "Có công mài sắt có ngày nên kim! Cố gắng thêm chút nữa là lên mâm trên ngay!",
    "Cần cù bù thông minh, rèn luyện tích cực thì sẽ sớm được thưởng thức bún ngon gà béo em ơi!",
    "Rất tuyệt vời em ơi! Tinh thần tích cực thế này thì ai trong buồng cũng nể phục!",
    "Cố gắng hết mình em ơi! Nỗ lực thêm chút nữa là tiến thẳng lên mâm ăn bún ngay!"
  ],
  giftBig: [
    "Đấy, tinh thần cải tạo xuất sắc nó phải thế! Cả buồng cùng chúc mừng và học tập tấm gương sáng!",
    "Nhân vật tiêu biểu của buồng đã xuất hiện! Cả buồng nhiệt liệt vỗ tay chúc mừng nào!",
    "Quá uy tín luôn em ơi! Tinh thần cải tạo vượt trội, vị trí dẫn đầu xứng đáng thuộc về em!",
    "Pha bứt phá quá ngoạn mục! Tự tin bước thẳng lên vị trí mâm trên đầy vinh quang!"
  ],
  upMam1: [
    "Lên được mâm 1 là sự nỗ lực vượt bậc! Cả buồng cùng chúc mừng tấm gương sáng nhất hôm nay!",
    "Chúc mừng đại ca đã cán đích Mâm 1, nhận phần thưởng gà luộc nguyên con cực kỳ xứng đáng!",
    "Đẳng cấp dẫn đầu buồng giam! Thong thả thưởng thức gà luộc nguyên con chúc mừng thành tích xuất sắc!"
  ],
  upMam2: [
    "Chúc mừng lên Mâm 2 có ghế ngồi đàng hoàng, thưởng thức tô bún rau thơm ngon tiếp thêm năng lượng!",
    "Bún rau thanh đạm bổ dưỡng, có chỗ ngồi vững chắc rồi, tiếp tục cố gắng để vươn tới mâm gà nhé!",
    "Tuyệt vời đã lên mâm 2, ngồi ăn bún rau ấm bụng rồi cùng nhau nỗ lực tiến bước em ơi!"
  ],
  upMam3: [
    "Chúc mừng đã thăng hạng lên Mâm 3, vị trí quan sát rất đẹp, cố thêm chút nữa là có ghế ngồi ăn bún!",
    "Chào mừng lên Mâm 3, tinh thần tiến bộ rất rõ rệt, nỗ lực thêm chút nữa là bước vào bàn tiệc bún rau!",
    "Cố lên em ơi! Từng bước tiến vững chắc, kiên trì cải tạo ắt có ngày chạm tay vào mâm gà!"
  ],
  downMam4: [
    "Tạm thời lùi một bước lấy đà, tích cực rèn luyện lại là nhanh chóng thăng hạng ngay thôi em ơi!",
    "Đường đua cải tạo cạnh tranh rất sôi nổi, nghỉ ngơi lấy sức rồi tăng tốc trở lại nhé em ơi!",
    "Không sao cả, kiên trì và bền bỉ thì thành công sẽ tới, cùng nhau tích cực rèn luyện lại nào!"
  ],
  downMam3: [
    "Tạm dừng chân ở mâm 3 quan sát thế trận, chuẩn bị kế hoạch bứt phá trở lại mâm 2 nhé!",
    "Cạnh tranh rất gắt gao, tạm ở mâm 3 cổ vũ anh em và nạp năng lượng để sớm leo lại nhé!",
    "Giữ vững tinh thần, mâm 3 ngắm cảnh buồng rất thoáng, tích cực tương tác là lấy lại ghế ngay!"
  ],
  downMam2: [
    "Đổi vị sang tô bún rau thanh đạm mát lành, tiếp thêm năng lượng để chuẩn bị chinh phục lại mâm gà!",
    "Cuộc đua còn dài, thưởng thức bún rau nạp năng lượng rồi lấy đà vươn lên mâm 1 nhé đại ca!",
    "Tinh thần thượng võ rất đẹp, chia sẻ vị trí dẫn đầu và cùng nhau thi đua tích cực nào!"
  ],
  join: [
    "Cả buồng nhiệt liệt chào đón thành viên mới gia nhập! Chúc bạn cải tạo thật tốt và sớm thăng hạng!",
    "Chào đón bạn mới đến với buồng giam! Hãy tích cực tap màn hình và comment để nhanh chóng lên mâm nhé!",
    "Chào mừng bạn đã đến buồng cải tạo! Chăm chỉ tương tác là sẽ sớm có tên trên bảng vàng!"
  ],
  milestone10: [
    "Cán mốc 10 điểm buồng rồi! Cố lên em ơi, phong độ rất tốt chuẩn bị lên mâm ăn bún!",
    "Uy tín đấy em ơi! Đạt 10 điểm buồng rồi, sắp sửa thăng hạng lên mâm trên rồi!"
  ],
  milestone50: [
    "Đã cán mốc 50 điểm buồng! Đẳng cấp mâm bún rau đang mở cửa đón em!",
    "50 điểm buồng quá uy tín! Cả buồng giam cùng nhiệt liệt chúc mừng sự nỗ lực của em!"
  ],
  milestone100: [
    "Đã chạm mốc 100 điểm buồng! Cố một tí nữa là vinh quang chạm tay vào con gà luộc Mâm 1!",
    "100 điểm buồng chói lọi! Vị trí dẫn đầu mâm 1 đang gọi tên người xứng đáng nhất!"
  ]
};
let lastAnnouncementTime = Date.now();


// TỰ ĐỘNG KHÔI PHỤC TOÀN BỘ PHIÊN LIVE TỪ AUTOSAVE (BẢO TOÀN 100% ĐIỂM SỐ VÀ NGƯỜI CHƠI)
const AUTOSAVE_FILE = path.join(__dirname, 'data', 'session_state_autosave.json');
try {
  if (fs.existsSync(AUTOSAVE_FILE)) {
    const backup = JSON.parse(fs.readFileSync(AUTOSAVE_FILE, 'utf8'));
    if (backup.users) gameState.users = backup.users;
    if (backup.ranking) gameState.ranking = backup.ranking;
    if (backup.exemplaryInmates) gameState.exemplaryInmates = backup.exemplaryInmates;
    if (backup.chicken) gameState.chicken = backup.chicken;
    if (backup.logs) gameState.logs = backup.logs;
    if (backup.followedUserIds) gameState.followedUserIds = backup.followedUserIds;
    // Lượt ăn dở khôi phục từ autosave cũ (chưa có sessionMins): chụp mốc hiện tại để đổi setting vẫn áp dụng từ lượt sau
    if (gameState.chicken && gameState.chicken.currentTop1 && !gameState.chicken.sessionMins) {
      gameState.chicken.sessionMins = Math.max(1, parseFloat(settings.chickenEatingMinutes) || 10);
    }
    console.log(`[AUTOSAVE RESTORE] Đã khôi phục thành công ${Object.keys(gameState.users).length} người chơi từ autosave!`);
    syncExemplaryList();
  }
} catch (e) {
  console.error('[AUTOSAVE RESTORE ERROR]:', e);
}

// TỰ ĐỘNG LƯU TRẠNG THÁI PHIÊN LIVE ĐỊNH KỲ (MỖI 10 GIÂY)
function saveSessionAutosave() {
  try {
    const dataToSave = {
      users: gameState.users,
      ranking: gameState.ranking,
      exemplaryInmates: gameState.exemplaryInmates,
      chicken: gameState.chicken,
      logs: gameState.logs,
      followedUserIds: gameState.followedUserIds || []
    };
    fs.writeFileSync(AUTOSAVE_FILE, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (e) {
    console.error('[AUTOSAVE ERROR]:', e.message);
  }
}
setInterval(saveSessionAutosave, 10000);

function addLog(msg, type = 'info') {
  const cleanMsg = typeof msg === 'string' ? msg.replace(/<[^>]*>/g, '').trim() : msg;
  const item = { time: new Date().toLocaleTimeString('vi-VN'), msg: cleanMsg, type };
  gameState.logs.unshift(item);
  if (gameState.logs.length > 100) gameState.logs.pop();
  io.emit('log-added', item);
}


function getRandomQuote(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// HỆ THỐNG VOICE ĐỌC LUÂN PHIÊN ĐỊNH KỲ (KÈM AUTO-DUCKING NHẠC NỀN)
const PERIODIC_VOICE_TEMPLATES = [
  // 1. Cập nhật thực tế Mâm 1 (Dynamic context)
  (state) => {
    const top1Id = state.ranking && state.ranking[0];
    const top1 = top1Id ? state.users[top1Id] : null;
    if (top1 && top1.points > (settings.mam1Threshold || 100) && top1.currentFloor === 1) {
      return `Hiện tại Mâm 1 đang thuộc về đại ca ${top1.name} với ${top1.points} điểm buồng, đang thưởng thức gà luộc thơm ngon. Toàn thể buồng cùng chúc mừng và noi gương nhé!`;
    }
    return `Con gà luộc Mâm 1 hiện vẫn đang chờ đón người dẫn đầu! Chỉ cần vượt ${settings.mam1Threshold || 100} điểm buồng là lên ngôi đại ca nhận gà ngay, anh em cùng tích cực tương tác!`;
  },
  // 2. Lời khuyên động viên tích cực
  () => "Cần cù bù thông minh, kiên trì ắt thành công! Anh em tích cực tương tác, tap tay và chia sẻ để cùng nhau thăng hạng nhé!",
  // 3. Cập nhật tình hình Mâm 2 (Chỉ tính người ĐANG TRONG LIVE và tối đa 4 ghế)
  (state) => {
    const m2Active = Object.values(state.users).filter(u => u.isActiveInRoom && !u.isLeaving && !u.isExemplary && u.currentFloor === 2);
    const count = Math.min(4, m2Active.length);
    if (count > 0) {
      return `Mâm 2 đang có ${count} phạm nhân ngồi ghế thưởng thức bún rau ấm bụng. Ai muốn lên mâm 2 cùng anh em thì tích cực tap tay và comment nhé!`;
    }
    return `Bàn dài Mâm 2 đang có 4 ghế ăn bún rau rất thơm ngon. Đạt trên ${settings.mam2Threshold || 50} điểm buồng là có ghế ngồi đàng hoàng ngay!`;
  },
  // 4. Lời khuyên giữ phong độ
  () => "Đường dài mới biết ngựa hay! Hãy luôn giữ vững phong độ và tích cực rèn luyện để duy trì vị trí mâm trên nhé các bạn!",
  // 5. Hướng dẫn quy tắc tính điểm chuẩn (đọc ĐỘNG theo cài đặt dashboard)
  () => {
    const rate = settings.tapRate || 50;
    const ppc = Math.max(1, parseInt(settings.pointsPerCoin) || 5);
    const followPts = Math.max(1, parseInt(settings.followPoints) || 10);
    const mam2 = settings.mam2Threshold || 50;
    const quotes = Array.isArray(settings.commentQuotes) && settings.commentQuotes.length > 0
      ? settings.commentQuotes
      : [{ quote: settings.commentBonusQuote || 'Cố gắng cải tạo, sớm ngày hoà nhập xã hội', points: settings.commentBonusPoints || 1 }];
    const firstTwo = quotes.slice(0, 2).map(q => `câu "${q.quote}" nhận ${q.points} điểm`).join(', ');
    const rosePts = (KNOWN_GIFT_COINS['rose'] || 1) * ppc;
    const pigPts = (KNOWN_GIFT_COINS['lucky pig'] || 10) * ppc;
    const glassPts = (KNOWN_GIFT_COINS['sunglasses'] || 199) * ppc;
    const pigTail = pigPts > mam2 ? ' bay thẳng lên mâm 2' : '';
    return `Buồng giam thông báo quy tắc điểm: ${rate} lần tap tay nhận 1 điểm buồng. Comment ${firstTwo}! Follow nhận ngay ${followPts} điểm buồng. Hoa hồng ${rosePts} điểm, kính mát ${glassPts} điểm, heo may mắn ${pigPts} điểm${pigTail}!`;
  },
  // 6. Cổ vũ Tầng 4 (Chỉ tính người ĐANG TRONG LIVE)
  (state) => {
    const f4Count = Object.values(state.users).filter(u => u.isActiveInRoom && !u.isLeaving && !u.isExemplary && u.currentFloor === 4).length;
    const rate = settings.tapRate || 50;
    const followPts = Math.max(1, parseInt(settings.followPoints) || 10);
    if (f4Count > 0) {
      return `Anh em ở Tầng 4 xuất phát điểm đừng nản! Mỗi ${rate} tap tay là có 1 điểm buồng, bấm follow nhận ngay ${followPts} điểm để thẳng tiến lên mâm 3 nhé!`;
    }
    return `Cố gắng hết mình em ơi! Tích cực tương tác để sớm ngày lên mâm 1 nhận gà luộc, cả buồng cùng hoan hô chúc mừng!`;
  },
  // 7. Thơ buồng giam
  () => "Khi nào ăn cỗ bỏ xôi, ăn gà xé luộc thì tôi lại về! Các phạm nhân cố gắng cải tạo tốt, chăm chỉ rèn luyện để sớm ngày lên mâm gà!",
  // 8. Động viên Mâm 3
  () => "Anh em Mâm 3 đang có tinh thần rất tốt! Cố thêm một chút nữa là thẳng tiến lên ghế ngồi thưởng thức bún rau Mâm 2 rồi em ơi!",
  // 9. Cổ vũ danh sách câu comment cải tạo
  () => {
    const quotes = Array.isArray(settings.commentQuotes) && settings.commentQuotes.length > 0
      ? settings.commentQuotes
      : [{ quote: settings.commentBonusQuote || 'Cố gắng cải tạo, sớm ngày hoà nhập xã hội', points: 1 }];
    const cmtList = quotes.slice(0, 3).map(q => `comment "${q.quote}" được cộng ${q.points} điểm`).join(', ');
    return `Các phạm nhân chú ý danh sách câu cải tạo: ${cmtList}! Hãy tích cực comment để nhanh chóng nhận điểm và thăng hạng lên mâm nhé!`;
  }
];

let periodicVoiceIdx = 0;

// Hệ thống Voice 16 đoạn luân phiên (Đã chuyển sang chạy liên tục, ưu tiên sự kiện)
let voice16State = {
  enabled: true,
  showSubtitle: true,
  volume: 0.85,
  pauseSec: 3,
  disabledIds: [],
  currentIndex: 0,
  currentId: null,
  isPlaying: false,
  isPausedBetween: false,
  interrupted: false,
  playedIds: []
};

// HỆ THỐNG VOICE ĐỌC LUÂN PHIÊN ĐỊNH KỲ VỀ TẤT CẢ CÁC MÂM (MÂM 1, MÂM 2, MÂM 3, MÂM 4)
function triggerPeriodicVoice() {
  if (gameState.isReleasing || gameState.isReleaseCoolingDown || gameState.chicken.isExiting) return;
  if (gameState.stairQueue.length > 0 || Object.keys(gameState.activeClimbers).length > 0) return;
  const template = PERIODIC_VOICE_TEMPLATES[periodicVoiceIdx % PERIODIC_VOICE_TEMPLATES.length];
  periodicVoiceIdx++;
  const text = typeof template === 'function' ? template(gameState) : template;
  addLog(`🎙️ [Voice Buồng]: ${text}`, 'system');
  lastAnnouncementTime = Date.now();
  io.emit('periodic-voice', {
    text,
    speechText: text,
    timestamp: Date.now()
  });
}

// Chạy định kỳ thông báo buồng giam mỗi 50s nếu không có sự kiện leo thang
setInterval(() => {
  const intervalSec = (settings.audio && settings.audio.periodicVoiceInterval) || 50;
  const now = Date.now();
  if (now - lastAnnouncementTime >= intervalSec * 1000) {
    lastAnnouncementTime = now;
    triggerPeriodicVoice();
  }
}, 5000);

// Socket IO quản lý kết nối và đồng bộ Voice 16 đoạn
io.on('connection', (socket) => {
  socket.emit('voice16-status', voice16State);

  // GỬI NGAY LẬP TỨC STATE HIỆN TẠI KHI CÓ BẤT KỲ OBS / TRÌNH DUYỆT NÀO KẾT NỐI
  socket.emit('state-update', {
    users: gameState.users,
    ranking: gameState.ranking,
    exemplaryInmates: gameState.exemplaryInmates,
    chicken: gameState.chicken,
    activeClimbers: gameState.activeClimbers,
    isDemoMode: gameState.isDemoMode,
    isReleasing: Boolean(gameState.isReleasing || gameState.isReleaseCoolingDown || gameState.chicken?.isExiting),
    isReleaseCoolingDown: Boolean(gameState.isReleaseCoolingDown),
    settings: {
      mam1Threshold: settings.mam1Threshold,
      mam2Threshold: settings.mam2Threshold,
      mam3Threshold: settings.mam3Threshold,
      tapRate: settings.tapRate || 50,
      pointsPerCoin: settings.pointsPerCoin || 5,
      commentBonusQuote: settings.commentBonusQuote,
      commentBonusPoints: settings.commentBonusPoints || 1,
      commentQuotes: settings.commentQuotes || defaultSettings.commentQuotes,
      commentCooldownSeconds: settings.commentCooldownSeconds,
      announceJoinSound: settings.announceJoinSound,
      announceJoinTts: settings.announceJoinTts,
      idleDeductMinutes: settings.idleDeductMinutes,
      exitDeductMinutes: settings.exitDeductMinutes,
      wallDecor: settings.wallDecor,
      gifts: settings.gifts,
      audio: settings.audio
    }
  });

  socket.on('voice16-status', (data) => {
    voice16State = { ...voice16State, ...data };
    socket.broadcast.emit('voice16-status', voice16State);
  });

  socket.on('voice16-cmd', (cmd) => {
    if (cmd.action === 'toggleMaster') {
      voice16State.enabled = cmd.enabled;
    } else if (cmd.action === 'toggleSubtitle') {
      voice16State.showSubtitle = cmd.enabled !== false;
    } else if (cmd.action === 'setVolume') {
      voice16State.volume = cmd.volume;
    } else if (cmd.action === 'setPause') {
      voice16State.pauseSec = cmd.pauseSec;
    } else if (cmd.action === 'toggleSegment') {
      const idStr = String(cmd.segmentId).padStart(2, '0');
      if (cmd.enabled) {
        voice16State.disabledIds = voice16State.disabledIds.filter(id => id !== idStr);
      } else {
        if (!voice16State.disabledIds.includes(idStr)) voice16State.disabledIds.push(idStr);
      }
    }
    io.emit('voice16-cmd', cmd);
  });
});

// User object constructor & Session User Archive (Bảo lưu điểm khi out live quay lại - Ý 2)

function resolveCanonicalUserId(primaryId, alternateId) {
  const p = primaryId ? String(primaryId).trim() : '';
  const a = alternateId ? String(alternateId).trim() : '';

  if (p && userAliasMap[p]) return userAliasMap[p];
  if (a && userAliasMap[a]) return userAliasMap[a];

  const canonical = p || a || 'guest';
  if (p) userAliasMap[p] = canonical;
  if (a) userAliasMap[a] = canonical;
  return canonical;
}

function recordInteraction(user) {
  if (!user) return;
  user.lastActive = Date.now();
  user.lastInteractionTime = Date.now();
  user.lastDeductTime = Date.now(); // Reset ngay đồng hồ 1 phút trừ điểm (Cơ chế 2.1)
}

// CƠ CHẾ 3.4 & TẤM GƯƠNG SÁNG: XÁC ĐỊNH NGƯỜI TRONG TOP 5 TẤM GƯƠNG SÁNG
function getTopExemplaryInfo(userId, userName) {
  if (!gameState.exemplaryInmates || !Array.isArray(gameState.exemplaryInmates)) return null;
  const top5 = gameState.exemplaryInmates.slice(0, 5);
  const uIdStr = String(userId || '').trim();
  const aliasId = uIdStr && userAliasMap[uIdStr] ? String(userAliasMap[uIdStr]).trim() : '';
  const normName = userName ? removeAccents(userName).toLowerCase().trim() : '';

  for (let i = 0; i < top5.length; i++) {
    const ex = top5[i];
    const exId = String(ex.id || '').trim();
    const exNameNorm = ex.name ? removeAccents(ex.name).toLowerCase().trim() : '';

    if ((uIdStr && exId === uIdStr) || (aliasId && exId === aliasId)) {
      return { rank: i + 1, inmate: ex };
    }
    if (normName && exNameNorm && normName === exNameNorm) {
      if (uIdStr && exId) {
        userAliasMap[uIdStr] = exId;
        userAliasMap[exId] = exId;
      }
      return { rank: i + 1, inmate: ex };
    }
  }
  return null;
}

const exemplaryWelcomeCooldowns = {};

// CHÀO MỪNG TẤM GƯƠNG SÁNG CHECK IN:
// - Kiểm tra ngay lập tức khi check in.
// - Chống spam: Mỗi người trong top "tấm gương sáng" chỉ được hệ thống chào 1 lần mỗi 30 giây.
function triggerExemplaryWelcome(user, exInfo) {
  if (!user) return false;
  const info = exInfo || getTopExemplaryInfo(user.id, user.name);
  if (!info) return false;

  const now = Date.now();
  const key = String(info.inmate.id || user.id).trim();
  const lastTime = exemplaryWelcomeCooldowns[key] || 0;

  // GIÃN CÁCH CHỐNG SPAM: Mỗi người trong top "tấm gương sáng" chỉ được chào 1 lần mỗi 30 giây
  if (now - lastTime < 30000) {
    const remainS = (30 - (now - lastTime) / 1000).toFixed(1);
    console.log(`[EXEMPLARY THROTTLE] ⏳ Tấm gương sáng [${user.name}] đã được chào gần đây (còn ${remainS}s chờ).`);
    return false;
  }

  exemplaryWelcomeCooldowns[key] = now;
  user.isExemplary = true;
  user.isActiveInRoom = true;
  user.isLeaving = false;
  user.seatIndex = -1;

  const rank = info.rank;
  const bannerText = `🌟 Chào mừng đồng chí tấm gương sáng Top ${rank}: ${user.name}!`;
  const speechText = `Chào mừng đồng chí tấm gương sáng ${user.name}`;

  addLog(`🌟 [${user.name}] (Tấm gương sáng Top ${rank}) đã quay lại xem LIVE!`, 'join');
  console.log(`[EXEMPLARY WELCOME] 🌟 Kích hoạt chào mừng riêng cho Tấm gương sáng Top ${rank}: ${user.name} (ID: ${user.id})`);

  io.emit('exemplary-welcome', {
    userId: user.id,
    userName: user.name,
    rank: rank,
    text: `Chào mừng đồng chí tấm gương sáng ${user.name}`,
    bannerText: bannerText,
    speechText: speechText
  });

  broadcastState();
  return true;
}

function getOrCreateUser(id, name, avatar, isJoinEvent = false) {
  const uid = String(id).trim();
  const safeName = typeof name === 'string' ? sanitizeForDisplay(name.replace(/<[^>]*>/g, '').trim()) : '';
  let user = gameState.users[uid];
  const archived = sessionUserArchive[uid];

  const exInfo = getTopExemplaryInfo(uid, safeName);
  const isTopEx = Boolean(exInfo);

  // Tra cứu tự động Avatar TikTok chuẩn xác từ kho lưu trữ Local Storage / LevelDB
  const cleanId = uid ? uid.replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const cleanName = safeName ? safeName.replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const avatarsDir = path.join(__dirname, 'public/avatars');
  let realAvatar = avatar || '';
  if (!realAvatar || realAvatar.length === 0) {
    if (cleanId && fs.existsSync(path.join(avatarsDir, `${cleanId}.webp`))) {
      realAvatar = `${ctx.roomPrefix}/avatars/${cleanId}.webp`;
    } else if (cleanName && fs.existsSync(path.join(avatarsDir, `${cleanName}.webp`))) {
      realAvatar = `${ctx.roomPrefix}/avatars/${cleanName}.webp`;
    }
  }

  if (!user) {
    user = {
      id: uid,
      name: safeName || (exInfo ? exInfo.inmate.name : (archived ? archived.name : `Tù nhân #${uid.slice(-4)}`)),
      avatar: realAvatar || (exInfo ? exInfo.inmate.avatar : (archived ? archived.avatar : '')),
      points: exInfo ? exInfo.inmate.points : (archived ? archived.points : 0),
      taps: archived ? archived.taps : 0,
      tapRemainder: archived ? archived.tapRemainder : 0,
      followed: archived ? archived.followed : false,
      currentFloor: 4,  // Luôn bắt đầu ở Tầng 4 - Ngồi bó gối trước khi leo
      targetFloor: 4,
      seatIndex: -1,
      isClimbing: false,
      isLeaving: false,
      isActiveInRoom: true,
      lastActive: Date.now(),
      lastInteractionTime: Date.now(),
      lastCommentBonusTime: 0,
      lastDeductTime: Date.now(),
      leftAt: null,
      lastExitDeductTime: null,
      isExemplary: isTopEx || (archived ? Boolean(archived.isExemplary) : false),
      eatingStage: 0
    };
    gameState.users[uid] = user;

    // CƠ CHẾ 3.4: NẾU LÀ "TẤM GƯƠNG SÁNG" CHECK IN (GIỚI HẠN 30 GIÂY/LẦN CHO MỖI NGƯỜI)
    if (isTopEx) {
      triggerExemplaryWelcome(user, exInfo);
      return user;
    }

    if (archived && archived.points > 0) {
      addLog(`🔄 [${user.name}] quay lại buồng giam! Bảo lưu nguyên vẹn ${archived.points} điểm buồng.`, 'join');
      io.emit('user-joined', {
        userId: uid,
        userName: user.name,
        bannerText: `Phạm nhân ${user.name} đã quay lại (Bảo lưu ${archived.points}đ)`,
        speechText: (settings.announceJoinTts ? `Chào mừng phạm nhân ${user.name} quay lại buồng giam! Giữ nguyên ${archived.points} điểm buồng!` : null),
        playSound: Boolean(settings.announceJoinSound !== false)
      });
    } else {
      const joinQuote = getRandomQuote(TROLL_QUOTES.join);
      const joinMsg = `👤 [${user.name}] vừa vào buồng giam. ${joinQuote}`;
      addLog(joinMsg, 'join');
      io.emit('user-joined', {
        userId: uid,
        userName: user.name,
        bannerText: `Phạm nhân ${user.name} mới vào buồng giam`,
        speechText: (settings.announceJoinTts ? `Chào mừng phạm nhân ${user.name} mới vào buồng giam! ${joinQuote}` : null),
        playSound: Boolean(settings.announceJoinSound !== false)
      });
    }
    recalculateFloors();
  } else {
    // User đã có trong gameState - Cùng 1 ID join 2 lần liên tiếp: chỉ giữ 1 nhân vật, điểm không nhân đôi!
    const wasAway = !user.isActiveInRoom || user.isLeaving;
    user.isActiveInRoom = true;
    user.isLeaving = false;
    user.lastActive = Date.now();
    user.leftAt = null;
    user.lastExitDeductTime = null;
    recordInteraction(user);
    if (name) user.name = sanitizeForDisplay(name);
    if (realAvatar) {
      user.avatar = realAvatar;
    } else if (!user.avatar || user.avatar.length === 0) {
      if (cleanId && fs.existsSync(path.join(avatarsDir, `${cleanId}.webp`))) {
        user.avatar = `${ctx.roomPrefix}/avatars/${cleanId}.webp`;
      } else if (cleanName && fs.existsSync(path.join(avatarsDir, `${cleanName}.webp`))) {
        user.avatar = `${ctx.roomPrefix}/avatars/${cleanName}.webp`;
      }
    }

    // CƠ CHẾ 3.4: Chào mừng người trong top "Tấm gương sáng" check in (khi vừa quay lại hoặc có sự kiện join)
    if (isTopEx || user.isExemplary) {
      user.isExemplary = true;
      user.isActiveInRoom = true;
      user.isLeaving = false;
      user.seatIndex = -1;
      if (wasAway || isJoinEvent) {
        triggerExemplaryWelcome(user, exInfo);
      }
      return user;
    }

    if (wasAway) {
      // Khi quay lại: xuất hiện ở Tầng 4 (ngồi bó gối) trước, rồi đi cầu thang lên tầng đúng của mình
      user.currentFloor = 4;
      user.seatIndex = -1;
      addLog(`🔄 [${user.name}] quay lại buồng giam! Bảo lưu nguyên vẹn ${user.points} điểm buồng.`, 'join');
      io.emit('user-joined', {
        userId: uid,
        userName: user.name,
        bannerText: `Phạm nhân ${user.name} đã quay lại (Bảo lưu ${user.points}đ)`,
        speechText: (settings.announceJoinTts ? `Chào mừng phạm nhân ${user.name} quay lại buồng giam! Giữ nguyên ${user.points} điểm buồng!` : null),
        playSound: Boolean(settings.announceJoinSound !== false)
      });
      recalculateFloors();
    }
    // Nếu KHÔNG PHẢI wasAway: giữ nguyên 1 nhân vật, TUYỆT ĐỐI không nhân đôi điểm, không lặp lại sound
  }
  return user;
}

/*
  QUY TẮC PHÂN TẦNG:
  - MÂM 1: Top 1 VÀ points > 100. (Chỉ đúng 1 người. Nếu chưa đủ >100 thì để trống).
  - MÂM 2: Top 2 đến Top 5 VÀ points > 50. (Tối đa 4 người. Ai chưa >50 thì để trống ghế).
  - MÂM 3: Có điểm từ 10 đến 50 (10 - 50). Đứng sau song sắt.
  - TẦNG 4: < 10 điểm. Ngồi bó gối.
*/
function determineTargetFloor(user, rankIndex, hasMam1Leader = false) {
  // 1. MÂM 1: CHỈ KHI VỪA LÀ TOP 1 (rankIndex === 0) VÀ VỪA CÓ NHIỀU HƠN 100 ĐIỂM (> 100)
  if (rankIndex === 0 && user.points > (settings.mam1Threshold || 100)) {
    return 1;
  }

  // 2. MÂM 2: TOP 2 ĐẾN TOP 5 VÀ CÓ NHIỀU HƠN 50 ĐIỂM (> 50)
  // Nếu Mâm 1 đã có chủ (>100đ): các vị trí Top 2..5 (rank 1..4) ngồi Mâm 2 nếu có > 50 điểm.
  // Nếu Mâm 1 để trống (Top 1 <=100đ): các vị trí Top 1..4 (rank 0..3) ngồi Mâm 2 nếu có > 50 điểm.
  const minMam2Rank = hasMam1Leader ? 1 : 0;
  const maxMam2Rank = hasMam1Leader ? 4 : 3;
  if (user.points > (settings.mam2Threshold || 50) && rankIndex >= minMam2Rank && rankIndex <= maxMam2Rank) {
    return 2;
  }

  // 3. MÂM 3: Có điểm từ 5 điểm trở lên
  if (user.points >= (settings.mam3Threshold || 5)) {
    return 3;
  }

  // 4. TẦNG 4: < 5 điểm (ngồi bó gối)
  return 4;
}

function recalculateFloors() {
  // CHỈ tính thứ hạng trong số những người ĐANG CÒN Ở TRONG LIVE (isActiveInRoom && !isLeaving) VÀ KHÔNG PHẢI TẤM GƯƠNG SÁNG
  const activeUserList = Object.values(gameState.users).filter(u => u.isActiveInRoom && !u.isLeaving && !u.isExemplary);
  activeUserList.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.lastActive - a.lastActive;
  });

  // Ranking chỉ chứa các user đang ở trong phòng
  gameState.ranking = activeUserList.map(u => u.id);

  // MÂM 1: Chỉ dành cho Top 1 đang ở trong LIVE VÀ có > 100 điểm (trừ khi đang trong cảnh xuất trại)!
  const hasMam1Leader = !gameState.chicken.isExiting && activeUserList.length > 0 && activeUserList[0].points > (settings.mam1Threshold || 100);
  const moves = [];

  // Nếu không ai đủ điều kiện Mâm 1 (>100đ) mà Mâm 1 đang có gà: giải phóng đĩa gà Mâm 1
  if (!hasMam1Leader && gameState.chicken.currentTop1 && !gameState.chicken.isExiting) {
    gameState.chicken.currentTop1 = null;
    gameState.chicken.progress = 0;
    gameState.chicken.stage = 0;
    gameState.chicken.minutesHeld = 0;
    gameState.chicken.sessionMins = null;
    io.emit('chicken-progress', { stage: 0, progress: 0, minutesHeld: 0 });
  }

  activeUserList.forEach((user, index) => {
    const target = determineTargetFloor(user, index, hasMam1Leader);
    let targetSeat = -1;

    if (target === 1) {
      targetSeat = 0;
      if (gameState.chicken.currentTop1 !== user.id) {
        gameState.chicken.currentTop1 = user.id;
        gameState.chicken.progress = 0;
        gameState.chicken.minutesHeld = 0;
        gameState.chicken.startedAt = Date.now();
        gameState.chicken.stage = 0;
        gameState.chicken.sessionMins = Math.max(1, parseFloat(settings.chickenEatingMinutes) || 10);
        gameState.chicken.isExiting = false;
        addLog(`🍗 [${user.name}] lên ngôi MÂM 1! Dọn con gà luộc mới toanh!`, 'rank');
        io.emit('new-chicken', { owner: user.name, stage: 0 });
      }
    } else if (target === 2) {
      targetSeat = Math.max(0, Math.min(3, hasMam1Leader ? (index - 1) : index));
    }

    user.targetFloor = target;
    user.seatIndex = targetSeat;

    if (user.currentFloor !== target && !user.isClimbing) {
      moves.push({
        userId: user.id,
        userName: user.name,
        fromFloor: user.currentFloor,
        toFloor: target,
        seatIndex: targetSeat
      });
      enqueueStairMove(user.id, user.currentFloor, target, targetSeat);
    }
  });

  // Nếu không còn ai ở Mâm 1 (hoặc Top 1 <= 100đ, hoặc phòng trống) -> MÂM 1 ĐỂ TRỐNG
  if (!hasMam1Leader && !gameState.chicken.isExiting) {
    if (gameState.chicken.currentTop1) {
      gameState.chicken.currentTop1 = null;
      gameState.chicken.progress = 0;
      gameState.chicken.minutesHeld = 0;
      gameState.chicken.stage = 0;
      gameState.chicken.sessionMins = null;
    }
  }

  // CẬP NHẬT BẢNG TOP CẢI TẠO VÀ NHÃN TÊN TRÊN ĐẦU NGAY LẬP TỨC
  broadcastState();
}

// CƠ CHẾ 2.2: RỚT MÂM ĐIỀU CHỈNH HẠNG (CHUẨN LỜI VĂN TIÊU CHUẨN CỘNG ĐỒNG TIKTOK)
function getDemotionMessage(userName, toFloor) {
  let mainText = '';
  let speechText = '';
  if (toFloor === 2) {
    mainText = `Phạm nhân ${userName} chuyển về mâm 2`;
    speechText = `Phạm nhân ${userName} tạm chuyển về mâm 2, thưởng thức bún rau và tiếp tục rèn luyện nhé!`;
  } else if (toFloor === 3) {
    mainText = `Phạm nhân ${userName} chuyển về mâm 3`;
    speechText = `Phạm nhân ${userName} tạm chuyển về mâm 3 quan sát, tiếp tục cố gắng để sớm trở lại mâm trên nhé!`;
  } else {
    mainText = `Phạm nhân ${userName} chuyển về Tầng 4`;
    speechText = `Phạm nhân ${userName} tạm về Tầng 4 nạp năng lượng, tiếp tục nỗ lực cải tạo để thăng hạng nhé!`;
  }
  return {
    bannerText: mainText,
    fullSpeechText: speechText,
    isUp: false
  };
}

// MỤC 9.5 & 10.3: TẠO THÔNG BÁO LÊN / XUỐNG MÂM
function getFloorTransitionMessage(userName, fromFloor, toFloor) {
  let mainText = '';
  let trollQuote = '';
  if (toFloor < fromFloor) {
    // LÊN MÂM
    if (toFloor === 1) {
      mainText = `Phạm nhân ${userName} đã lên mâm 1, nhận gà luộc nguyên con.`;
      trollQuote = getRandomQuote(TROLL_QUOTES.upMam1);
    } else if (toFloor === 2) {
      mainText = `Phạm nhân ${userName} đã lên mâm 2, ăn bún rau.`;
      trollQuote = getRandomQuote(TROLL_QUOTES.upMam2);
    } else if (toFloor === 3) {
      mainText = `Phạm nhân ${userName} đã lên mâm 3, đứng quan sát.`;
      trollQuote = getRandomQuote(TROLL_QUOTES.upMam3);
    }
    return {
      bannerText: mainText,
      fullSpeechText: `${mainText} ${trollQuote}`.trim(),
      isUp: true
    };
  } else {
    // XUỐNG MÂM: Áp dụng chuẩn điều chỉnh hạng văn minh, tích cực
    return getDemotionMessage(userName, toFloor);
  }
}

// Stair Movement Queue: Xử lý leo lên và quy tắc XUỐNG BUỒNG CHỈ 1 BẬC 1 LẦN (Ý 2)
function enqueueStairMove(userId, fromFloor, finalTargetFloor, targetSeat) {
  const existing = gameState.stairQueue.find(q => q.userId === userId);
  if (existing) {
    existing.toFloor = finalTargetFloor;
    existing.seatIndex = targetSeat;
    return;
  }
  gameState.stairQueue.push({ userId, fromFloor, toFloor: finalTargetFloor, seatIndex: targetSeat });
  processStairQueue();
}

function processStairQueue() {
  if (gameState.stairQueue.length === 0) return;
  const activeCount = Object.keys(gameState.activeClimbers).length;
  if (activeCount >= 2) return; // Tối đa 2 người di chuyển cùng lúc để không bị chậm

  const move = gameState.stairQueue.shift();
  const user = gameState.users[move.userId];
  if (!user || user.isLeaving || !user.isActiveInRoom) {
    processStairQueue();
    return;
  }

  // QUY TẮC BẮT BUỘC: XUỐNG BUỒNG CHỈ XUỐNG 1 BẬC (move.fromFloor + 1)
  // CẤM nhảy 2 bậc trở lên trong 1 lần xuống!
  let nextFloor = move.toFloor;
  let isDownStep = false;
  if (move.toFloor > move.fromFloor) {
    nextFloor = move.fromFloor + 1; // CHỈ XUỐNG 1 BẬC!
    isDownStep = true;
  }

  user.isClimbing = true;
  gameState.activeClimbers[user.id] = {
    userId: user.id,
    fromFloor: move.fromFloor,
    toFloor: nextFloor,
    finalTargetFloor: move.toFloor,
    seatIndex: move.seatIndex,
    startTime: Date.now()
  };

  const isUp = nextFloor < move.fromFloor;
  const transition = getFloorTransitionMessage(user.name, move.fromFloor, nextFloor);
  addLog(`🚶 [${user.name}]: ${transition.bannerText}`, 'move');
  lastAnnouncementTime = Date.now();

  io.emit('floor-announcement', {
    userId: user.id,
    userName: user.name,
    text: transition.bannerText,
    speechText: transition.fullSpeechText,
    isUp,
    fromFloor: move.fromFloor,
    toFloor: nextFloor
  });

  // Tốc độ: mỗi bậc xuống từ 0.8 - 1.2s (chọn 1000ms = 1s; toàn bộ 1->4 mất đúng 3s <= 4s)
  const duration = isDownStep ? 1000 : Math.min(2500, Math.abs(move.fromFloor - nextFloor) * 900 + 700);

  io.emit('stair-traversal-start', {
    userId: user.id,
    userName: user.name,
    fromFloor: move.fromFloor,
    toFloor: nextFloor,
    seatIndex: (nextFloor === move.toFloor) ? move.seatIndex : -1,
    durationMs: duration
  });

  setTimeout(() => {
    if (gameState.users[move.userId]) {
      gameState.users[move.userId].currentFloor = nextFloor;
      if (nextFloor === move.toFloor) {
        gameState.users[move.userId].seatIndex = move.seatIndex;
      }
      gameState.users[move.userId].isClimbing = false;

      // Khi phạm nhân vừa hoàn thành leo thang và ngồi xuống Mâm 1: Bắt đầu tính giờ ăn gà (chụp mốc phút hiện tại)!
      if (nextFloor === 1 && gameState.chicken.currentTop1 === move.userId) {
        gameState.chicken.startedAt = Date.now();
        gameState.chicken.progress = 0;
        gameState.chicken.minutesHeld = 0;
        gameState.chicken.stage = 0;
        gameState.chicken.sessionMins = Math.max(1, parseFloat(settings.chickenEatingMinutes) || 10);
      }
    }
    delete gameState.activeClimbers[move.userId];

    io.emit('stair-traversal-complete', {
      userId: move.userId,
      finalFloor: nextFloor,
      seatIndex: gameState.users[move.userId] ? gameState.users[move.userId].seatIndex : -1
    });

    // Nếu vẫn chưa tới tầng đích theo thứ hạng mới (ví dụ từ Mâm 1 xuống Tầng 4, mới tới Mâm 2)
    // Hệ thống XUỐNG TIẾP 1 BẬC NỮA NGAY LẬP TỨC
    if (gameState.users[move.userId] && gameState.users[move.userId].currentFloor < gameState.users[move.userId].targetFloor) {
      enqueueStairMove(move.userId, nextFloor, gameState.users[move.userId].targetFloor, move.seatIndex);
    } else {
      recalculateFloors();
    }

    processStairQueue();
  }, duration);
}

// QUY TẮC TẤM GƯƠNG SÁNG (TOP 5 NGƯỜI CÓ ĐIỂM CẢI TẠO CAO NHẤT)
// 1. Chỉ lưu 5 người có điểm cao nhất vào danh sách.
// 2. Những người bị loại khỏi danh sách Tấm gương sáng được đi cải tạo lại, với điểm giữ nguyên.
// (exemplaryRankTracker đã khai báo ở đầu file để autosave restore dùng được)
function syncExemplaryList() {
  if (!gameState.exemplaryInmates || !Array.isArray(gameState.exemplaryInmates)) {
    gameState.exemplaryInmates = [];
    return;
  }

  // Cập nhật điểm & tên mới nhất cho các thành viên từ users/archive
  gameState.exemplaryInmates.forEach(item => {
    const u = gameState.users[item.id] || sessionUserArchive[item.id];
    if (u) {
      item.points = u.points;
      item.name = u.name;
    }
  });

  // Gộp các bản ghi cùng 1 người (giữ điểm cao nhất và bảo lưu releaseCount, firstReleasedAt)
  const map = new Map();
  gameState.exemplaryInmates.forEach(item => {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, {
        ...item,
        releaseCount: item.releaseCount || 1,
        firstReleasedAt: item.firstReleasedAt || item.completedAt || Date.now()
      });
    } else {
      const bestPoints = Math.max(existing.points, item.points);
      const relCount = Math.max(existing.releaseCount || 1, item.releaseCount || 1);
      const firstRel = Math.min(existing.firstReleasedAt || existing.completedAt || Date.now(), item.firstReleasedAt || item.completedAt || Date.now());
      map.set(item.id, {
        ...existing,
        name: item.name || existing.name,
        points: bestPoints,
        releaseCount: relCount,
        firstReleasedAt: firstRel,
        completedAt: item.completedAt || existing.completedAt
      });
    }
  });

  // TIÊU CHÍ XẾP HẠNG TOP 5 TẤM GƯƠNG SÁNG (MỤC 3):
  // 1. Điểm buồng hiện tại (cao hơn đứng trước).
  // 2. Nếu bằng điểm: số lần xuất trại trong phiên (nhiều hơn đứng trước).
  // 3. Nếu vẫn bằng: ai đạt danh hiệu Tấm gương sáng trước (firstReleasedAt sớm hơn đứng trước).
  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aRel = a.releaseCount || 1;
    const bRel = b.releaseCount || 1;
    if (bRel !== aRel) return bRel - aRel;
    const aFirst = a.firstReleasedAt || a.completedAt || 0;
    const bFirst = b.firstReleasedAt || b.completedAt || 0;
    return aFirst - bFirst;
  });

  // Giữ tối đa 5 người điểm cao nhất
  const top5 = sorted.slice(0, 5);
  const dropped = sorted.slice(5);

  gameState.exemplaryInmates = top5;

  // Giữ cờ isExemplary = true cho những người trong top 5 và theo dõi ghi log thay đổi hạng (Mục 5)
  top5.forEach((item, idx) => {
    const newRank = idx + 1;
    item.rank = newRank;
    if (gameState.users[item.id]) gameState.users[item.id].isExemplary = true;
    if (sessionUserArchive[item.id]) sessionUserArchive[item.id].isExemplary = true;

    const prev = exemplaryRankTracker.get(item.id);
    if (!prev) {
      exemplaryRankTracker.set(item.id, { rank: newRank, points: item.points, releaseCount: item.releaseCount || 1 });
      addLog(`🌟 [TẤM GƯƠNG SÁNG]: [${item.name}] đạt danh hiệu Tấm Gương Sáng - Top ${newRank}! (Điểm: ${item.points}đ, ${item.releaseCount || 1} lần xuất trại)`, 'rank');
    } else {
      if (prev.rank !== newRank) {
        addLog(`🌟 [ĐỔI HUY CHƯƠNG]: [${item.name}] thay đổi hạng từ Top ${prev.rank} ➔ Top ${newRank}! (Điểm mới: ${item.points}đ, ${item.releaseCount || 1} lần xuất trại)`, 'rank');
        prev.rank = newRank;
      }
      prev.points = item.points;
      prev.releaseCount = item.releaseCount || 1;
    }
  });

  // Những người bị loại khỏi danh sách Tấm gương sáng (Mục 0 & Mục 3):
  // + MẤT NGAY danh hiệu Tấm gương sáng (isExemplary = false)
  // + BIẾN MẤT dạng nhân vật huy chương trên tường mâm 1
  // + TRỞ VỀ LÀM NGƯỜI CHƠI BÌNH THƯỜNG
  // + ĐIỂM BUỒNG ĐƯỢC GIỮ NGUYÊN (không bị reset về 0)
  // + Vị trí xuất hiện lại: xuất hiện ở MÂM BÓ GỐI (mâm 4) trước, sau đó đi cầu thang từ từ lên mâm đúng
  // + MẤT ĐẶC QUYỀN MIỄN TRỪ: chịu lại idle deduction và exit deduction
  let hadDropped = false;
  dropped.forEach(item => {
    hadDropped = true;
    const u = gameState.users[item.id];
    const uName = u ? u.name : item.name;
    const uPoints = u ? u.points : item.points;
    const prev = exemplaryRankTracker.get(item.id);

    if (u) {
      const wasExemplary = u.isExemplary;
      u.isExemplary = false;
      u.lastDeductTime = Date.now();
      u.lastInteractionTime = Date.now();

      if (u.isActiveInRoom && !u.isLeaving) {
        // Xuất hiện ở Mâm bó gối (Tầng 4) trước, không dịch chuyển tức thời
        u.currentFloor = 4;
        u.seatIndex = -1;
        u.isClimbing = false;
      }

      if (wasExemplary) {
        const oldRankStr = (prev && prev.rank <= 5) ? `từ Top ${prev.rank}` : `khỏi Top 5`;
        console.log(`[TẤM GƯƠNG SÁNG] 🔄 [${uName}] (ID: ${u.id}) bị loại khỏi Top 5 Tấm gương sáng! Về làm người chơi bình thường với ${uPoints}đ buồng giữ nguyên.`);
        addLog(`⚠️ [RỚT TOP 5]: [${uName}] bị đẩy ${oldRankStr} xuống Hạng thường! Điểm giữ nguyên: ${uPoints}đ, ${item.releaseCount || 1} lần xuất trại. Quay trở lại buồng tiếp tục cải tạo!`, 'rank');

        const droppedSpeech = `${uName} đã rời khỏi danh sách Tấm gương sáng và quay trở lại buồng giam tiếp tục cải tạo!`;
        io.emit('exemplary-dropped', {
          userId: item.id,
          userName: uName,
          points: uPoints,
          speechText: droppedSpeech,
          bannerText: `⚠️ ${uName} rời khỏi Top 5 Tấm gương sáng!`
        });
      }
    }
    if (prev && prev.rank <= 5) {
      exemplaryRankTracker.set(item.id, { rank: 999, points: uPoints, releaseCount: item.releaseCount || 1 });
    }
    if (sessionUserArchive[item.id]) {
      sessionUserArchive[item.id].isExemplary = false;
    }
  });

  recalculateFloors();
  broadcastState();
}

function addExemplaryInmate(user) {
  if (!user) return;
  const existingRecord = gameState.exemplaryInmates.find(x => x.id === user.id) || (sessionUserArchive[user.id] && sessionUserArchive[user.id].exemplaryRecord);
  const releaseCount = (existingRecord && existingRecord.releaseCount ? existingRecord.releaseCount : 0) + 1;
  const firstReleasedAt = (existingRecord && existingRecord.firstReleasedAt) ? existingRecord.firstReleasedAt : (existingRecord ? existingRecord.completedAt : Date.now());

  const cleanId = user.id ? String(user.id).replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const cleanName = user.name ? String(user.name).replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const avatarsDir = path.join(__dirname, 'public/avatars');
  if (!user.avatar || user.avatar.length === 0) {
    if (cleanId && fs.existsSync(path.join(avatarsDir, `${cleanId}.webp`))) {
      user.avatar = `${ctx.roomPrefix}/avatars/${cleanId}.webp`;
    } else if (cleanName && fs.existsSync(path.join(avatarsDir, `${cleanName}.webp`))) {
      user.avatar = `${ctx.roomPrefix}/avatars/${cleanName}.webp`;
    }
  }

  const record = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    completedAt: Date.now(),
    points: user.points,
    releaseCount: releaseCount,
    firstReleasedAt: firstReleasedAt,
    lastReleasedAt: Date.now()
  };
  gameState.exemplaryInmates.push(record);
  user.isExemplary = true;
  user.seatIndex = -1;
  if (sessionUserArchive[user.id]) {
    sessionUserArchive[user.id].isExemplary = true;
    sessionUserArchive[user.id].exemplaryRecord = record;
  }
  syncExemplaryList();
}

// CƠ CHẾ: CỨ 3 PHÚT ĐỌC BIỂU DƯƠNG DANH SÁCH "TẤM GƯƠNG SÁNG" (NÊU TÊN VÀ THÀNH TÍCH)
const EXEMPLARY_PRAISE_INTERVAL_MS = 3 * 60 * 1000; // 3 phút

function checkAndBroadcastExemplaryPraise() {
  if (!gameState.exemplaryInmates || gameState.exemplaryInmates.length === 0) {
    return;
  }

  // Nếu đang xuất trại hoặc vừa xuất trại: dời lịch 15s để không chen ngang
  if (gameState.isReleasing || gameState.isReleaseCoolingDown || gameState.chicken?.isExiting) {
    console.log('[EXEMPLARY PRAISE] ⏳ Đang có cảnh xuất trại, dời lịch biểu dương lại 15 giây...');
    setTimeout(checkAndBroadcastExemplaryPraise, 15000);
    return;
  }

  syncExemplaryList();
  const top5 = gameState.exemplaryInmates.slice(0, 5);
  if (top5.length === 0) return;

  const bannerText = `🌟 BIỂU DƯƠNG TOP ${top5.length} TẤM GƯƠNG SÁNG: ` +
    top5.map((item, idx) => `${idx + 1}. ${item.name} (${item.points}đ - ${item.releaseCount || 1} lần)`).join(' | ');

  const intro = "Loa loa loa! Biểu dương danh sách Tấm gương sáng buồng giam. ";
  const parts = top5.map((item, idx) => {
    const relCount = item.releaseCount || 1;
    return `Hạng ${idx + 1}, đồng chí ${item.name}, ${item.points} điểm buồng, ${relCount} lần xuất trại. `;
  });
  const outro = "Toàn thể buồng giam noi gương học tập và tích cực cải tạo để sớm được xuất trại nhé!";
  const speechText = intro + parts.join('') + outro;

  addLog(`🌟 [Biểu dương]: Danh sách Top ${top5.length} Tấm Gương Sáng buồng giam!`, 'system');
  console.log(`[EXEMPLARY PRAISE] 📢 Đọc biểu dương danh sách Tấm gương sáng (${top5.length} người) lúc ${new Date().toLocaleTimeString('vi-VN')}`);

  io.emit('exemplary-praise', {
    inmates: top5,
    bannerText,
    speechText
  });
}

setInterval(checkAndBroadcastExemplaryPraise, EXEMPLARY_PRAISE_INTERVAL_MS);

// CƠ CHẾ 3.2: CẢNH XUẤT TRẠI KHI ĂN HẾT GÀ (100% TIẾN ĐỘ)
function triggerReleaseCeremony(user) {
  if (gameState.chicken.isExiting) return;
  gameState.chicken.isExiting = true;
  gameState.isReleasing = true;
  gameState.isReleaseCoolingDown = false;
  gameState.chicken.progress = 100;
  gameState.chicken.stage = 5; // Chỉ còn bộ xương gà trên đĩa

  const ceremonyMins = gameState.chicken.sessionMins || Math.max(1, parseFloat(settings.chickenEatingMinutes) || 10);
  const ceremonySpeech = `Giấy chứng nhận hoàn thành cải tạo: Chúc mừng phạm nhân ${user.name} đã giữ Mâm 1 suốt ${ceremonyMins} phút liên tục, ăn sạch đĩa gà luộc và chính thức xuất trại!`;
  console.log(`[RELEASE CEREMONY] 🎓 ${ceremonySpeech}`);
  addLog(`🎓 [${user.name}] đã ăn hết con gà sau ${ceremonyMins} phút giữ Mâm 1! Hoàn thành cải tạo xuất sắc, làm lễ xuất trại!`, 'rank');

  // Thông báo tới Dashboard trạng thái "Đang xuất trại - tạm dừng giọng đọc"
  broadcastState();

  // Đảm bảo lấy đúng avatar thật của phạm nhân từ TikTok
  const cleanId = user.id ? String(user.id).replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const cleanName = user.name ? String(user.name).replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const avatarsDir = path.join(__dirname, 'public/avatars');
  let finalAvatar = user.avatar || '';
  if (!finalAvatar || finalAvatar.length === 0) {
    if (cleanId && fs.existsSync(path.join(avatarsDir, `${cleanId}.webp`))) {
      finalAvatar = `${ctx.roomPrefix}/avatars/${cleanId}.webp`;
    } else if (cleanName && fs.existsSync(path.join(avatarsDir, `${cleanName}.webp`))) {
      finalAvatar = `${ctx.roomPrefix}/avatars/${cleanName}.webp`;
    }
  }
  user.avatar = finalAvatar;

  // Phát thông báo và hoạt ảnh cảnh xuất trại (12 giây)
  io.emit('release-ceremony-start', {
    userId: user.id,
    userName: user.name,
    avatar: finalAvatar,
    points: user.points,
    minutes: ceremonyMins,
    text: `Đồng chí ${user.name} giữ Mâm 1 suốt ${ceremonyMins} phút - Hoàn thành cải tạo Xuất Trại!`,
    speechText: ceremonySpeech,
    durationMs: 12000
  });

  // Sau 12 giây hoàn tất cảnh xuất trại điện ảnh -> Bước vào khoảng nghỉ 7 giây BGM nhẹ
  setTimeout(() => {
    // 1. Thêm vào danh sách "Tấm gương sáng" (Lưu tối đa 5 người điểm cao nhất)
    addExemplaryInmate(user);

    // 2. Dọn sạch đĩa gà Mâm 1, chuẩn bị con gà mới nguyên vẹn 0%
    gameState.chicken.currentTop1 = null;
    gameState.chicken.progress = 0;
    gameState.chicken.minutesHeld = 0;
    gameState.chicken.stage = 0;
    gameState.chicken.sessionMins = null;
    gameState.chicken.isExiting = false;

    // 3. Sắp xếp lại Mâm 1 cho người mới đủ điều kiện (>100đ)
    recalculateFloors();

    // Bước vào khoảng NGHỈ 7 GIÂY chỉ phát nhạc nền nhẹ trước khi chạy tiếp hàng đợi thông báo
    gameState.isReleaseCoolingDown = true;
    io.emit('release-ceremony-complete', {
      userId: user.id,
      userName: user.name,
      exemplaryInmates: gameState.exemplaryInmates
    });
    broadcastState();

    setTimeout(() => {
      gameState.isReleasing = false;
      gameState.isReleaseCoolingDown = false;
      broadcastState();

      if (gameState.releasePendingInteractionsCount > 0) {
        addLog(`📢 [Tóm tắt]: Trong lúc xuất trại vừa qua, buồng giam đã nhận thêm ${gameState.releasePendingInteractionsCount} lượt tương tác từ anh em!`, 'system');
        io.emit('chat-bubble', { text: `Trong lúc xuất trại, buồng giam nhận thêm ${gameState.releasePendingInteractionsCount} tương tác!` });
        gameState.releasePendingInteractionsCount = 0;
      }
    }, 7000);
  }, 12000);
}

// CƠ CHẾ 2 & CƠ CHẾ 3 & 4: ĐỒNG HỒ TRỪ ĐIỂM (1 PHÚT / 5 PHÚT) VÀ TIẾN ĐỘ ĂN GÀ
setInterval(() => {
  const now = Date.now();
  let pointsChanged = false;

  // 0. TỰ ĐỘNG CHUYỂN TRẠNG THÁI "TẠM CHO OFF / ĐÃ RỜI" NẾU KHÔNG CÒN HOẠT ĐỘNG (TIMEOUT 1 PHÚT)
  const awayTimeoutMs = (parseInt(settings.awayMinutes || settings.idleMinutes) || 1) * 60 * 1000;
  Object.values(gameState.users).forEach(u => {
    if (u.isActiveInRoom && !u.isClimbing && !u.isSimulated) {
      const lastAction = u.lastInteractionTime || u.lastActive || now;
      if (now - lastAction >= awayTimeoutMs) {
        handleLeave(u.id);
      }
    }
  });

  // 1. TRỪ ĐIỂM DO KHÔNG TƯƠNG TÁC (1 PHÚT = -1Đ) - CƠ CHẾ 2.1
  const idleThresholdMs = (parseInt(settings.idleDeductMinutes) || 1) * 60 * 1000;
  Object.values(gameState.users).forEach(u => {
    if (!u.isExemplary && !u.isSimulated && u.isActiveInRoom && !u.isLeaving && u.points > 0) {
      const idleTime = now - (u.lastInteractionTime || u.lastActive || now);
      const timeSinceLastDeduct = now - (u.lastDeductTime || u.lastInteractionTime || now);
      if (idleTime >= idleThresholdMs && timeSinceLastDeduct >= idleThresholdMs) {
        u.points = Math.max(0, u.points - 1);
        u.lastDeductTime = now;
        pointsChanged = true;
        console.log(`[IDLE DEDUCT] ⏱️ [${u.name}] không tương tác 1 phút -> Trừ 1 điểm buồng (Còn ${u.points}đ)`);
        addLog(`⏱️ [${u.name}] không tương tác 1 phút -> Trừ 1 điểm buồng (Còn ${u.points}đ)`, 'system');
      }
    }
  });

  // 2. TRỪ ĐIỂM KHI THOÁT LIVE (5 PHÚT = -1Đ) - CƠ CHẾ 2.3
  const exitThresholdMs = (parseInt(settings.exitDeductMinutes) || 5) * 60 * 1000;
  Object.values(gameState.users).forEach(u => {
    if (!u.isExemplary && !u.isActiveInRoom && u.leftAt && u.points > 0) {
      const timeSinceExitDeduct = now - (u.lastExitDeductTime || u.leftAt);
      if (timeSinceExitDeduct >= exitThresholdMs) {
        u.points = Math.max(0, u.points - 1);
        u.lastExitDeductTime = now;
        pointsChanged = true;
        if (sessionUserArchive[u.id]) sessionUserArchive[u.id].points = u.points;
        console.log(`[EXIT DEDUCT] 🚪 [${u.name}] đã thoát LIVE 5 phút chưa quay lại -> Trừ 1 điểm buồng (Còn ${u.points}đ)`);
        addLog(`🚪 [${u.name}] đã thoát LIVE 5 phút chưa quay lại -> Trừ 1 điểm buồng (Còn ${u.points}đ)`, 'system');
      }
    }
  });

  if (pointsChanged) {
    recalculateFloors();
  }

  // 3. TIẾN ĐỘ ĂN GÀ Ở MÂM 1 (CƠ CHẾ 3 & 4)
  if (gameState.chicken.currentTop1 && !gameState.chicken.isExiting) {
    const top1User = gameState.users[gameState.chicken.currentTop1];
    if (top1User && top1User.isActiveInRoom && top1User.currentFloor === 1 && !top1User.isClimbing) {
      const heldMs = now - (gameState.chicken.startedAt || now);
      // Tốc độ ăn gà: Mặc định 10 phút ăn hết gà (hoặc tùy chỉnh trong settings.chickenEatingMinutes)
      // 10 phút = 100% -> chia 20 bước (5% mỗi bước) -> mỗi bước 5% mất đúng 30 giây (nhanh gấp đôi)!
      const totalMins = gameState.chicken.sessionMins || Math.max(1, parseFloat(settings.chickenEatingMinutes) || 10);
      const msPer5Percent = settings.demoFastChicken ? 3000 : Math.round((totalMins * 60000) / 20);
      const stepCount = Math.floor(heldMs / msPer5Percent);
      const progress = Math.min(100, stepCount * 5);
      const minutesHeld = settings.demoFastChicken ? Math.round((progress / 100) * totalMins) : Math.floor(heldMs / 60000);

      const prevProgress = gameState.chicken.progress;
      const prevStage = gameState.chicken.stage;

      gameState.chicken.minutesHeld = minutesHeld;
      gameState.chicken.progress = progress;

      // 6 mốc con gà: 0% (0), 20% (1), 40% (2), 60% (3), 80% (4), 100% (5)
      const stage = Math.min(5, Math.floor(progress / 20));
      gameState.chicken.stage = stage;

      // Phát sự kiện cập nhật tiến độ mỗi phút (hoặc khi đổi stage/progress)
      if (progress !== prevProgress || stage !== prevStage) {
        io.emit('chicken-progress', {
          owner: top1User.name,
          stage,
          progress,
          minutesHeld
        });
      }

      // ĐẠT 100%: KÍCH HOẠT CẢNH XUẤT TRẠI!
      if (progress >= 100) {
        triggerReleaseCeremony(top1User);
      }
    }
  }

  // 4. BẢO HIỂM KẸT CẦU THANG: cờ leo dở mồ côi (mất entry, vd sau khởi động lại)
  // hoặc lượt leo quá hạn 15s -> gỡ cờ, trả về hàng đợi, đi lại đúng tầng theo điểm
  const stuckClimbers = Object.values(gameState.users).filter(u => {
    if (!u || !u.isClimbing) return false;
    const act = gameState.activeClimbers[u.id];
    return !act || (now - (act.startTime || 0) > 15000);
  });
  if (stuckClimbers.length > 0) {
    stuckClimbers.forEach(u => {
      u.isClimbing = false;
      delete gameState.activeClimbers[u.id];
      addLog(`🛟 [${u.name}] kẹt cầu thang quá lâu -> Trả về hàng đợi, đi lại đúng tầng ${u.targetFloor}.`, 'system');
    });
    recalculateFloors();
    processStairQueue();
  }
}, 1000);

// Broadcast State
function broadcastState() {
  io.emit('state-update', {
    users: gameState.users,
    ranking: gameState.ranking,
    exemplaryInmates: gameState.exemplaryInmates,
    chicken: gameState.chicken,
    activeClimbers: gameState.activeClimbers,
    isDemoMode: gameState.isDemoMode,
    isReleasing: Boolean(gameState.isReleasing || gameState.isReleaseCoolingDown || gameState.chicken?.isExiting),
    isReleaseCoolingDown: Boolean(gameState.isReleaseCoolingDown),
    settings: {
      mam1Threshold: settings.mam1Threshold,
      mam2Threshold: settings.mam2Threshold,
      mam3Threshold: settings.mam3Threshold,
      tapRate: settings.tapRate || 50,
      pointsPerCoin: settings.pointsPerCoin || 5,
      commentBonusQuote: settings.commentBonusQuote,
      commentBonusPoints: settings.commentBonusPoints || 1,
      commentQuotes: settings.commentQuotes || defaultSettings.commentQuotes,
      commentCooldownSeconds: settings.commentCooldownSeconds,
      announceJoinSound: settings.announceJoinSound,
      announceJoinTts: settings.announceJoinTts,
      idleDeductMinutes: settings.idleDeductMinutes,
      exitDeductMinutes: settings.exitDeductMinutes,
      wallDecor: settings.wallDecor,
      gifts: settings.gifts,
      audio: settings.audio
    }
  });
}

// MỤC Ý 1 & Ý 2: XỬ LÝ ĐÓNG HỌ (TẶNG QUÀ) THEO GIÁ TRỊ XU (1 XU = 5 ĐIỂM BUỒNG)
function addPoints(userId, userName, avatar, points, reason, isGift = false, giftName = '', giftCount = 1, giftId = '', unitCoins = 0, totalCoins = 0) {
  const user = getOrCreateUser(userId, userName, avatar);
  recordInteraction(user);
  const oldPoints = user.points;
  user.points += points;

  // BẮT BUỘC: GHI LOG ĐẦY ĐỦ THÔNG TIN VÀO TERMINAL VÀ DASHBOARD (Ý 1)
  if (isGift) {
    lastAnnouncementTime = Date.now();
    const finalUnit = unitCoins || Math.max(1, Math.round(points / (giftCount * 5)));
    const finalTotalCoins = totalCoins || (finalUnit * giftCount);

    console.log(`[GIFT LOG] Người tặng: ${user.name} | Quà: ${giftName} | ID: ${giftId || 'N/A'} | Giá trị xu: ${finalUnit} xu x ${giftCount} = ${finalTotalCoins} xu | Điểm quy đổi: +${points}đ buồng | Tổng điểm mới: ${user.points}đ buồng`);
    addLog(`🎁 [${user.name}] tặng [${giftName}] (ID: ${giftId || 'N/A'}, ${finalUnit} xu x ${giftCount} = ${finalTotalCoins} xu) => Quy đổi: +${points}đ buồng => Tổng điểm mới: ${user.points}đ`, 'gift');

    const qtyText = giftCount > 1 ? `${giftCount} ${giftName}` : (giftName.toLowerCase().includes('hoa hong') || giftName.toLowerCase().includes('hoa hồng') ? `1 bông hoa hồng` : `1 ${giftName}`);
    const bannerText = `Phạm nhân ${user.name} đã gửi tặng ${qtyText} (${finalTotalCoins} xu), nhận được ${points} điểm buồng`;
    const trollSuffix = points >= 50 ? getRandomQuote(TROLL_QUOTES.giftBig) : getRandomQuote(TROLL_QUOTES.giftNormal);
    const fullSpeechText = `${bannerText}. ${trollSuffix}`;

    io.emit('gift-alert', {
      userId: user.id,
      userName: user.name,
      avatar: user.avatar,
      giftName,
      giftCount: giftCount || 1,
      giftId: giftId || '',
      coins: finalTotalCoins,
      points,
      totalPoints: user.points,
      text: bannerText,
      speechText: fullSpeechText,
      isBig: points >= 50
    });
  } else {
    console.log(`[POINT LOG] [${user.name}] +${points}đ buồng (${reason}) => Tổng: ${user.points}đ`);
    addLog(`⭐ [${user.name}] +${points} điểm buồng (${reason}) => Tổng: ${user.points}đ`, 'point');
  }

  // KIỂM TRA MỐC ĐIỂM BUỒNG 10, 50, 100 ĐỂ TROLL KHÍCH LỆ
  [10, 50, 100].forEach(milestone => {
    if (oldPoints < milestone && user.points >= milestone) {
      const mQuote = getRandomQuote(TROLL_QUOTES[`milestone${milestone}`]);
      const milestoneSpeech = `Phạm nhân ${user.name} đã đạt mốc ${milestone} điểm buồng! ${mQuote}`;
      addLog(`🎖️ [${user.name}] đã cán mốc ${milestone} điểm buồng!`, 'rank');
      io.emit('milestone-alert', {
        userId: user.id,
        userName: user.name,
        milestone,
        points: user.points,
        text: `Phạm nhân ${user.name} đạt mốc ${milestone} điểm buồng`,
        speechText: milestoneSpeech
      });
    }
  });

  recalculateFloors();
  if (user.isExemplary) syncExemplaryList();
}

// Handle Likes / Taps (50 Tap = 1 điểm buồng, tách riêng khỏi quà)
function handleTaps(userId, userName, avatar, count = 1) {
  const user = getOrCreateUser(userId, userName, avatar);
  recordInteraction(user);
  user.taps += count;
  user.tapRemainder += count;

  const currentRate = Math.max(1, parseInt(settings.tapRate) || 50);
  const earnedPoints = Math.floor(user.tapRemainder / currentRate);
  if (earnedPoints > 0) {
    user.tapRemainder = user.tapRemainder % currentRate;
    user.points += earnedPoints;
    addLog(`💖 [${user.name}] táp màn hình (tích lũy đủ ${currentRate} táp: +${earnedPoints} điểm buồng) => Tổng: ${user.points}đ`, 'tap');
    io.emit('tap-points-earned', { userId: user.id, userName: user.name, earnedPoints, totalPoints: user.points, tapRate: currentRate });
    recalculateFloors();
    if (user.isExemplary) syncExemplaryList();
  } else {
    io.emit('user-tap', { userId: user.id, taps: user.taps });
  }
}

// Handle Follow (Chỉ tính lần follow đầu tiên: +10 điểm buồng & phát loa/banner thông báo Overlay ngay lập tức)
function handleFollow(userId, userName, avatar) {
  // Follow nickname-only (từ cầu bridge): gộp về người chơi ID số đã tồn tại cùng tên để không kẹt bonus trên nick ma
  if (userId && /[^0-9]/.test(String(userId)) && !gameState.users[userId] && userName) {
    const hit = Object.values(gameState.users).find(u => u.name === userName && /^\d+$/.test(String(u.id)));
    if (hit) {
      userAliasMap[String(userId)] = hit.id;
      userId = hit.id;
    }
  }
  const user = getOrCreateUser(userId, userName, avatar);
  recordInteraction(user);
  const pts = parseInt(settings.followPoints) || 10;
  if (!gameState.followedUserIds) gameState.followedUserIds = [];

  const alreadyFollowed = user.followed || gameState.followedUserIds.includes(user.id);

  if (!alreadyFollowed) {
    user.followed = true;
    if (!gameState.followedUserIds.includes(user.id)) gameState.followedUserIds.push(user.id);
    user.points += pts;
    if (sessionUserArchive[user.id]) {
      sessionUserArchive[user.id].points = user.points;
      sessionUserArchive[user.id].followed = true;
    }
    console.log(`[FOLLOW LOG] ➕ Người dùng: ${user.name} (ID: ${user.id}) vừa FOLLOW kênh lần đầu! (+${pts}đ buồng) => Tổng mới: ${user.points}đ buồng`);
    addLog(`➕ [${user.name}] đã Follow kênh! (+${pts} điểm buồng) => Tổng: ${user.points}đ`, 'follow');
    io.emit('follow-alert', { userId: user.id, userName: user.name, points: pts, totalPoints: user.points, isFirstTime: true });
    recalculateFloors();
    if (user.isExemplary) syncExemplaryList();
    broadcastState();
    return pts;
  } else {
    // Chỉ tính lần follow đầu tiên: bỏ qua nếu đã từng nhận thưởng follow trước đó
    console.log(`[FOLLOW LOG] ℹ️ Người dùng: ${user.name} (ID: ${user.id}) đã từng nhận thưởng Follow trước đó (bỏ qua không lặp lại).`);
    return 0;
  }
}

function removeVietnameseTones(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalizeQuoteText(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[,.!?:;~'"\-_–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesBonusQuote(commentText, targetQuote) {
  if (!commentText || !targetQuote) return false;
  const c = normalizeQuoteText(commentText);
  const q = normalizeQuoteText(targetQuote);
  if (!c || !q) return false;
  if (c.includes(q)) return true;
  const cNoTone = removeVietnameseTones(c);
  const qNoTone = removeVietnameseTones(q);
  return cNoTone.includes(qNoTone);
}

// Handle Chat & Cơ chế 1: Comment cải tạo được cộng điểm
function handleChat(userId, userName, avatar, text) {
  const user = getOrCreateUser(userId, userName, avatar);
  recordInteraction(user);
  addLog(`💬 [${user.name}]: ${text}`, 'chat');
  io.emit('chat-bubble', {
    userId: user.id,
    userName: user.name,
    text: text.slice(0, 80),
    floor: user.currentFloor
  });

  // CƠ CHẾ 1: DANH SÁCH CÁC CÂU COMMENT CẢI TẠO ĐƯỢC CỘNG ĐIỂM
  const quotesList = Array.isArray(settings.commentQuotes) && settings.commentQuotes.length > 0
    ? settings.commentQuotes
    : [{ quote: settings.commentBonusQuote || 'Cố gắng cải tạo, sớm ngày hoà nhập xã hội', points: settings.commentBonusPoints || 1 }];

  // Sắp xếp ưu tiên câu dài trước để khớp chính xác nhất
  const sortedQuotes = [...quotesList]
    .filter(q => q && q.quote && String(q.quote).trim())
    .sort((a, b) => String(b.quote).length - String(a.quote).length);

  let matchedQuote = null;
  for (const item of sortedQuotes) {
    if (matchesBonusQuote(text, item.quote)) {
      matchedQuote = item;
      break;
    }
  }

  if (matchedQuote) {
    const now = Date.now();
    const cooldownMs = Math.max(5, parseInt(settings.commentCooldownSeconds) || 30) * 1000;
    if (!user.lastCommentBonusTime || (now - user.lastCommentBonusTime >= cooldownMs)) {
      user.lastCommentBonusTime = now;
      const bonusPts = Math.max(1, parseInt(matchedQuote.points) || 1);
      addPoints(userId, userName, avatar, bonusPts, `Comment: ${matchedQuote.quote}`);
      console.log(`[COMMENT BONUS] 💬 ${user.name} comment đúng câu: "${matchedQuote.quote}" (+${bonusPts}đ buồng, Tổng: ${user.points}đ)`);
      addLog(`💬 [${user.name}] comment: "${matchedQuote.quote}" (+${bonusPts}đ buồng) => Tổng: ${user.points}đ`, 'chat');
      io.emit('comment-bonus', { userId: user.id, userName: user.name, text, matchedQuote: matchedQuote.quote, points: user.points, bonusPoints: bonusPts });
    } else {
      console.log(`[COMMENT COOLDOWN] ⏳ ${user.name} comment trong thời gian chờ ${settings.commentCooldownSeconds}s. Reset tương tác, không cộng thêm điểm.`);
    }
  }
}

// Handle Leave (Ý 2: Giải phóng vị trí trong vòng 1s, bảo lưu điểm nguyên vẹn)
function handleLeave(userId) {
  const user = gameState.users[userId];
  if (!user || (!user.isActiveInRoom && !user.isLeaving)) return;

  user.isActiveInRoom = false;
  user.isLeaving = true;
  user.seatIndex = -1; // GIẢI PHÓNG GHẾ NGAY LẬP TỨC TRONG VÒNG 1 GIÂY!
  user.isClimbing = false;
  user.leftAt = Date.now(); // BẮT ĐẦU TÍNH THỜI GIAN THOÁT LIVE (Cơ chế 2.3)
  user.lastExitDeductTime = Date.now();
  delete gameState.activeClimbers[userId];
  gameState.stairQueue = gameState.stairQueue.filter(q => q.userId !== userId);

  // Lưu trữ bảo lưu điểm trong phiên LIVE
  sessionUserArchive[userId] = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    points: user.points,
    taps: user.taps,
    tapRemainder: user.tapRemainder,
    followed: user.followed,
    isExemplary: user.isExemplary
  };

  if (user.isExemplary) {
    addLog(`🚪 [${user.name}] (Tấm gương sáng) tạm rời phiên live.`, 'leave');
  } else {
    addLog(`🚪 [${user.name}] đã tạm rời buồng giam (bảo lưu ${user.points}đ).`, 'leave');
  }
  io.emit('user-left', { userId, userName: user.name, floor: user.currentFloor });

  // TÍNH LẠI THỨ HẠNG VÀ VỊ TRÍ MÂM NGAY LẬP TỨC (CHỈ TRONG SỐ NGƯỜI ĐANG CÒN Ở TRONG LIVE)
  recalculateFloors();

  // YÊU CẦU: Phạm nhân ở mâm bó gối (Tầng 4) hoặc Mâm 3 mà 0 điểm đã thoát live thì xoá hẳn khỏi buồng, khi nào vào lại thì thêm sau
  // (Mở rộng sang Mâm 3 để dọn nick ma follow kẹt lại; không bao giờ xoá chủ Mâm 1 hay Tấm gương sáng)
  // Tên nát ký tự lạ cũng xoá ngay (nick giả chắc chắn, không cần chờ hết điểm)
  const corruptName = typeof user.name === 'string' && /[\x00-\x1f\x7f�]/.test(user.name);
  if (((user.currentFloor === 4 || user.currentFloor === 3) && user.points <= 0 || corruptName) && !user.isExemplary && gameState.chicken.currentTop1 !== userId) {
    delete gameState.users[userId];
    delete sessionUserArchive[userId];
    delete userAliasMap[userId];
    if (user.name) delete userAliasMap[user.name];
  } else {
    setTimeout(() => {
      user.isLeaving = false;
    }, 850);
  }
}

// DỌN DẸP PHẠM NHÂN MÂM BÓ GỐI (TẦNG 4) VÀ MÂM 3 0 ĐIỂM ĐÃ THOÁT PHIÊN LIVE (KHÔNG TƯƠNG TÁC QUÁ 2 PHÚT HOẶC ĐÃ RỜI)
function cleanFloor4IdleZeroPoints(idleMinutes = 2) {
  const timeoutMs = idleMinutes * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  Object.values(gameState.users).forEach(u => {
    // Chỉ áp dụng cho Tầng 4 bó gối và Mâm 3, điểm <= 0, không leo cầu thang, không phải tấm gương sáng, không phải chủ Mâm 1, không phải người mô phỏng
    if ((u.currentFloor === 4 || u.currentFloor === 3) && u.points <= 0 && !u.isExemplary && !u.isClimbing && !u.isSimulated && gameState.chicken.currentTop1 !== u.id) {
      const hasExited = !u.isActiveInRoom || (now - u.lastActive > timeoutMs);
      if (hasExited) {
        io.emit('user-left', { userId: u.id, userName: u.name, floor: 4 });
        delete gameState.users[u.id];
        delete sessionUserArchive[u.id];
        delete userAliasMap[u.id];
        if (u.name) delete userAliasMap[u.name];
        cleaned++;
      }
    }
  });

  if (cleaned > 0) {
    recalculateFloors();
    broadcastState();
    console.log(`[DỌN MÂM BÓ GỐI] 🧹 Đã xoá ${cleaned} phạm nhân 0 điểm ở mâm bó gối / mâm 3 đã thoát live để buồng gọn gàng.`);
  }
  return cleaned;
}
setInterval(() => cleanFloor4IdleZeroPoints(2), 20000);
setTimeout(() => cleanFloor4IdleZeroPoints(2), 1500);

// DỌN NICK MA TÊN NÁT (ký tự điều khiển/\ufffd do giải mã sai): tên TikTok thật
// không bao giờ chứa các ký tự này nên chắc chắn là nick giả. Không xét điểm,
// nhưng không bao giờ xoá Tấm gương sáng / chủ Mâm 1 / người đang leo cầu thang.
function cleanCorruptNameGhosts() {
  let cleaned = 0;
  Object.values(gameState.users).forEach(u => {
    if (typeof u.name === 'string' && /[\x00-\x1f\x7f�]/.test(u.name) &&
        !u.isExemplary && !u.isClimbing && gameState.chicken.currentTop1 !== u.id) {
      io.emit('user-left', { userId: u.id, userName: u.name, floor: u.currentFloor });
      delete gameState.users[u.id];
      delete sessionUserArchive[u.id];
      delete userAliasMap[u.id];
      if (u.name) delete userAliasMap[u.name];
      cleaned++;
    }
  });
  if (cleaned > 0) {
    recalculateFloors();
    broadcastState();
    console.log(`[DỌN NICK MA] 🧹 Đã xoá ${cleaned} nick tên nát (ký tự lạ) khỏi buồng.`);
  }
  return cleaned;
}
setInterval(() => cleanCorruptNameGhosts(), 20000);
setTimeout(() => cleanCorruptNameGhosts(), 1500);

// Clean Idle Devotees / Prisoners (Dọn dẹp dự phòng khi không có Leave event)
function cleanIdleUsers(minutes = (settings.awayMinutes || settings.idleMinutes || 1)) {
  const timeoutMs = (parseInt(minutes) || 1) * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;
  Object.values(gameState.users).forEach(u => {
    const lastAction = u.lastInteractionTime || u.lastActive || now;
    if (u.isActiveInRoom && now - lastAction > timeoutMs && !u.isClimbing && !u.isSimulated) {
      handleLeave(u.id);
      cleaned++;
    }
  });
  if (cleaned > 0) {
    addLog(`🧹 Đã chuyển trạng thái tạm rời cho ${cleaned} người xem không hoạt động trong ${minutes} phút.`, 'system');
  }
  return cleaned;
}
setInterval(() => cleanIdleUsers(), 60000);

// Reset Session
function resetSession() {
  gameState.users = {};
  gameState.ranking = [];
  gameState.exemplaryInmates = [];
  gameState.chicken = {
    stage: 0,
    progress: 0,
    minutesHeld: 0,
    currentTop1: null,
    startedAt: 0,
    lastTick: Date.now(),
    sessionMins: null,
    isExiting: false
  };
  gameState.stairQueue = [];
  gameState.activeClimbers = {};
  gameState.logs = []; // Xoá sạch toàn bộ nhật ký sự kiện cũ
  for (const k in sessionUserArchive) delete sessionUserArchive[k];
  exemplaryRankTracker.clear();

  // Reset trạng thái Voice 16 về ban đầu (Đoạn 01)
  voice16State.currentIndex = 0;
  voice16State.currentId = "01";
  voice16State.isPlaying = false;
  voice16State.isPausedBetween = false;
  voice16State.interrupted = false;
  voice16State.playedIds = [];

  addLog('⚠️ ĐÃ LÀM MỚI PHIÊN LIVE! Toàn bộ điểm và buồng giam đã được thiết lập lại từ đầu.', 'reset');
  broadcastState();

  // Phát tín hiệu yêu cầu Overlay và Dashboard dừng ngay mọi âm thanh cũ, xóa hàng đợi và bắt đầu lại Voice từ đoạn 01
  io.emit('session-reset', { timestamp: Date.now() });
  io.emit('voice16-cmd', { action: 'reset' });
  io.emit('voice16-status', voice16State);
}

/* ================= API ROUTES ================= */

// BACKUP & RESTORE DATA
app.get('/api/backup', (req, res) => {
  const data = {
    exportDate: new Date().toISOString(),
    version: '2.0.0',
    settings,
    users: gameState.users,
    ranking: gameState.ranking
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="buong_giam_backup_${Date.now()}.json"`);
  res.send(JSON.stringify(data, null, 2));
});

app.post('/api/restore', (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.settings) {
      return res.status(400).json({ success: false, error: 'File sao lưu không hợp lệ!' });
    }
    settings = { ...defaultSettings, ...backup.settings };
    saveSettings(settings);
    if (backup.users) gameState.users = backup.users;
    if (backup.ranking) gameState.ranking = backup.ranking;
    if (backup.exemplaryInmates) gameState.exemplaryInmates = backup.exemplaryInmates;
    syncExemplaryList();
    recalculateFloors();
    addLog('💾 Đã khôi phục dữ liệu từ bản sao lưu thành công.', 'system');
    res.json({ success: true, message: 'Đã khôi phục thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TOGGLE DEMO MODE
app.post('/api/demo-mode', (req, res) => {
  gameState.isDemoMode = Boolean(req.body.enabled);
  addLog(`🧪 Chế độ DEMO đã ${gameState.isDemoMode ? 'BẬT' : 'TẮT'}`, 'system');
  broadcastState();
  res.json({ success: true, isDemoMode: gameState.isDemoMode });
});

// WALL DECORATION CONFIGURATION
app.post('/api/decor/save', (req, res) => {
  const { mam1, mam2 } = req.body;
  if (!settings.wallDecor) settings.wallDecor = defaultSettings.wallDecor;
  if (mam1) settings.wallDecor.mam1 = { ...settings.wallDecor.mam1, ...mam1 };
  if (mam2) settings.wallDecor.mam2 = { ...settings.wallDecor.mam2, ...mam2 };
  saveSettings(settings);
  addLog('🖼️ Đã cập nhật cấu hình tranh tường Mâm 1 & Mâm 2.', 'system');
  broadcastState();
  res.json({ success: true, wallDecor: settings.wallDecor });
});

// GIFT CONFIGURATION MANAGEMENT
app.post('/api/gifts/save', (req, res) => {
  const { name, coins, points } = req.body;
  const rate = Math.max(1, parseInt(settings.pointsPerCoin) || 5);
  // Mới: nhận đơn giá xu. Cũ (dashboard chưa F5): nhận điểm -> đổi ra xu theo tỷ giá hiện hành.
  const unitCoins = (coins !== undefined && !isNaN(coins))
    ? Math.max(1, parseInt(coins))
    : ((points !== undefined && !isNaN(points)) ? Math.max(1, Math.round(parseInt(points) / rate)) : NaN);
  if (!name || isNaN(unitCoins)) return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  settings.gifts[name] = unitCoins;
  saveSettings(settings);
  addLog(`🎁 Đã cập nhật quà "${name}": ${unitCoins} xu (= ${unitCoins * rate} điểm buồng)`, 'system');
  broadcastState();
  res.json({ success: true, gifts: settings.gifts });
});

app.post('/api/gifts/delete', (req, res) => {
  const { name } = req.body;
  if (name && settings.gifts[name]) {
    delete settings.gifts[name];
    saveSettings(settings);
    addLog(`🗑️ Đã xóa quà "${name}"`, 'system');
    broadcastState();
    res.json({ success: true, gifts: settings.gifts });
  } else {
    res.status(400).json({ error: 'Quà không tồn tại' });
  }
});

app.get('/api/state', (req, res) => {
  res.json({
    users: gameState.users,
    ranking: gameState.ranking,
    exemplaryInmates: gameState.exemplaryInmates,
    chicken: gameState.chicken,
    activeClimbers: gameState.activeClimbers,
    isDemoMode: gameState.isDemoMode,
    isReleasing: Boolean(gameState.isReleasing || gameState.isReleaseCoolingDown || gameState.chicken?.isExiting),
    isReleaseCoolingDown: Boolean(gameState.isReleaseCoolingDown),
    settings,
    logs: gameState.logs,
    webhook: { count: webhookCount }
  });
});

// TEST & DEMO TIẾN ĐỘ ĂN GÀ & CẢNH XUẤT TRẠI (CƠ CHẾ 3 & 4)
app.post('/api/demo/set-chicken-progress', (req, res) => {
  const p = Math.max(0, Math.min(100, parseInt(req.body.progress) || 0));
  const stage = Math.min(5, Math.floor(p / 20));
  const minutesHeld = Math.round((p / 100) * 10);
  gameState.chicken.progress = p;
  gameState.chicken.stage = stage;
  gameState.chicken.minutesHeld = minutesHeld;
  const top1User = gameState.chicken.currentTop1 ? gameState.users[gameState.chicken.currentTop1] : null;
  io.emit('chicken-progress', {
    stage,
    progress: p,
    minutesHeld,
    owner: top1User ? top1User.name : 'Chưa có'
  });
  if (p >= 100 && top1User) {
    triggerReleaseCeremony(top1User);
  }
  broadcastState();
  res.json({ success: true, progress: p, stage });
});

app.post('/api/demo/trigger-release', (req, res) => {
  const top1User = gameState.chicken.currentTop1 ? gameState.users[gameState.chicken.currentTop1] : null;
  if (!top1User) return res.status(400).json({ error: 'Chưa có phạm nhân ở Mâm 1 để xuất trại' });
  triggerReleaseCeremony(top1User);
  res.json({ success: true, message: 'Đã kích hoạt cảnh xuất trại' });
});

app.post('/api/demo/add-exemplary', (req, res) => {
  const { userId, name, points } = req.body;
  const user = getOrCreateUser(userId, name || `Người ${userId}`);
  if (points !== undefined) user.points = parseInt(points) || 0;
  user.isActiveInRoom = true;
  user.isLeaving = false;
  addExemplaryInmate(user);
  broadcastState();
  res.json({ success: true, user, exemplaryInmates: gameState.exemplaryInmates });
});

app.post('/api/demo/user-leave', (req, res) => {
  const { userId } = req.body;
  handleLeave(userId);
  broadcastState();
  res.json({ success: true, userId });
});

app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  if (req.body.tapRate !== undefined) {
    req.body.tapRate = Math.max(1, parseInt(req.body.tapRate) || 50);
  }
  if (req.body.chickenEatingMinutes !== undefined) {
    req.body.chickenEatingMinutes = Math.min(120, Math.max(1, parseFloat(req.body.chickenEatingMinutes) || 10));
  }
  if (req.body.pointsPerCoin !== undefined) {
    req.body.pointsPerCoin = Math.min(100, Math.max(1, parseInt(req.body.pointsPerCoin) || 5));
  }
  if (req.body.commentBonusPoints !== undefined) {
    req.body.commentBonusPoints = Math.max(1, parseInt(req.body.commentBonusPoints) || 1);
  }
  if (req.body.commentCooldownSeconds !== undefined) {
    req.body.commentCooldownSeconds = Math.max(5, parseInt(req.body.commentCooldownSeconds) || 30);
  }
  if (req.body.commentBonusQuote !== undefined) {
    req.body.commentBonusQuote = String(req.body.commentBonusQuote).trim();
  }
  if (req.body.commentQuotes !== undefined && Array.isArray(req.body.commentQuotes)) {
    req.body.commentQuotes = req.body.commentQuotes
      .filter(q => q && q.quote && String(q.quote).trim())
      .map((q, idx) => ({
        id: q.id || `cq_${Date.now()}_${idx}`,
        quote: String(q.quote).trim(),
        points: Math.max(1, parseInt(q.points) || 1)
      }));
  }
  settings = { ...settings, ...req.body };
  saveSettings(settings);
  addLog(`⚙️ Cài đặt hệ thống đã được cập nhật (Tỷ lệ táp: ${settings.tapRate || 50} táp=1đ | ${settings.commentQuotes?.length || 0} câu comment cải tạo).`, 'system');
  broadcastState();
  res.json({ success: true, settings });
});

// QUẢN LÝ DANH SÁCH CÂU COMMENT CẢI TẠO (+ĐIỂM RIÊNG TỪNG CÂU)
app.post('/api/comment-quotes/save', (req, res) => {
  const { commentQuotes, commentCooldownSeconds } = req.body;
  if (commentCooldownSeconds !== undefined) {
    settings.commentCooldownSeconds = Math.max(5, parseInt(commentCooldownSeconds) || 30);
  }
  if (Array.isArray(commentQuotes)) {
    settings.commentQuotes = commentQuotes
      .filter(q => q && q.quote && String(q.quote).trim())
      .map((q, idx) => ({
        id: q.id || `cq_${Date.now()}_${idx}`,
        quote: String(q.quote).trim(),
        points: Math.max(1, parseInt(q.points) || 1)
      }));
    if (settings.commentQuotes.length > 0) {
      settings.commentBonusQuote = settings.commentQuotes[0].quote;
      settings.commentBonusPoints = settings.commentQuotes[0].points;
    }
  }
  saveSettings(settings);
  addLog(`💬 Đã lưu ${settings.commentQuotes?.length || 0} câu comment cải tạo với mốc điểm riêng.`, 'system');
  broadcastState();
  res.json({ success: true, commentQuotes: settings.commentQuotes, commentCooldownSeconds: settings.commentCooldownSeconds });
});

// VOICE 16 ĐOẠN LUÂN PHIÊN API
app.get('/api/voice16/state', (req, res) => {
  res.json({ success: true, state: voice16State });
});

app.post('/api/voice16/cmd', (req, res) => {
  const cmd = req.body;
  if (!cmd || !cmd.action) return res.status(400).json({ error: 'Missing action' });

  if (cmd.action === 'toggleMaster') {
    voice16State.enabled = Boolean(cmd.enabled);
  } else if (cmd.action === 'toggleSubtitle') {
    voice16State.showSubtitle = cmd.enabled !== false;
  } else if (cmd.action === 'setVolume') {
    voice16State.volume = parseFloat(cmd.volume);
  } else if (cmd.action === 'setPause') {
    voice16State.pauseSec = parseFloat(cmd.pauseSec);
  } else if (cmd.action === 'toggleSegment') {
    const idStr = String(cmd.segmentId).padStart(2, '0');
    if (cmd.enabled) {
      voice16State.disabledIds = voice16State.disabledIds.filter(id => id !== idStr);
    } else {
      if (!voice16State.disabledIds.includes(idStr)) voice16State.disabledIds.push(idStr);
    }
  }
  io.emit('voice16-cmd', cmd);
  addLog(`🎙️ [Voice 16]: Lệnh điều khiển ${cmd.action}`, 'info');
  res.json({ success: true, state: voice16State });
});

// KÍCH HOẠT PHÁT VOICE LUÂN PHIÊN THỦ CÔNG / BỎ QUA SANG ĐOẠN TIẾP THEO
app.post('/api/audio/periodic-voice/trigger', (req, res) => {
  triggerPeriodicVoice();
  res.json({ success: true, message: 'Đã bỏ qua sang đoạn voice tiếp theo!' });
});

app.post('/api/session/reset', (req, res) => {
  resetSession();
  res.json({ success: true, message: 'Đã làm mới phiên LIVE.' });
});

app.post('/api/users/remove', (req, res) => {
  const { userId } = req.body;
  if (userId) {
    handleLeave(userId);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Missing userId' });
  }
});

app.post('/api/users/clean-idle', (req, res) => {
  const count = cleanIdleUsers(req.body.minutes || settings.idleMinutes);
  res.json({ success: true, cleanedCount: count });
});

app.get('/api/avatar', (req, res) => {
  const { id, name } = req.query;
  const cleanId = id ? String(id).replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const cleanName = name ? String(name).replace(/[^a-zA-Z0-9_\-]/g, '_') : '';
  const avatarsDir = path.join(__dirname, 'public/avatars');

  if (cleanId && fs.existsSync(path.join(avatarsDir, `${cleanId}.webp`))) {
    return res.redirect(`${ctx.roomPrefix}/avatars/${cleanId}.webp`);
  }
  if (cleanName && fs.existsSync(path.join(avatarsDir, `${cleanName}.webp`))) {
    return res.redirect(`${ctx.roomPrefix}/avatars/${cleanName}.webp`);
  }
  const u = (id && gameState.users[id]) || null;
  if (u && u.avatar && (u.avatar.startsWith('http') || u.avatar.startsWith(ctx.roomPrefix + '/avatars/'))) {
    return res.redirect(u.avatar);
  }
  return res.redirect('${ctx.roomPrefix}/assets/default_avatar.png');
});

app.post('/api/reload-overlay', (req, res) => {
  io.emit('reload-overlay', { timestamp: Date.now() });
  res.json({ success: true, message: 'Emitted reload-overlay' });
});

app.post('/api/exemplary/praise', (req, res) => {
  checkAndBroadcastExemplaryPraise();
  res.json({ success: true, count: gameState.exemplaryInmates.length });
});

// Tên Việt thật cho 100 người mô phỏng (họ + đệm + tên, nam/nữ riêng, 100 tên duy nhất)
const SIM_HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Trương', 'Đinh', 'Trịnh', 'Mai'];
const SIM_MID_M = ['Văn', 'Hữu', 'Minh', 'Đức', 'Quang', 'Công', 'Đình', 'Xuân', 'Trọng', 'Bá'];
const SIM_MID_F = ['Thị', 'Ngọc', 'Thanh', 'Hồng', 'Kim', 'Thu', 'Mỹ', 'Bảo', 'Diễm', 'Tú'];
const SIM_TEN_M = ['Tuấn', 'Hùng', 'Dũng', 'Nam', 'Long', 'Hải', 'Sơn', 'Thắng', 'Bình', 'Đức'];
const SIM_TEN_F = ['Hương', 'Lan', 'Trang', 'Linh', 'Thảo', 'Mai', 'Phương', 'Ngọc', 'Hoa', 'Anh'];
function simDisplayName(i) {
  const female = (i % 2 === 0);
  const k = ((i - 1) >> 1);
  const slot = Math.floor(k / 20);
  const MID = female ? SIM_MID_F : SIM_MID_M;
  const TEN = female ? SIM_TEN_F : SIM_TEN_M;
  return `${SIM_HO[k % 20]} ${MID[(k * 3 + slot * 5) % 10]} ${TEN[(k * 7 + slot * 3) % 10]}`;
}

// SIMULATION & TEST ENDPOINTS
app.post('/api/simulate', (req, res) => {
  const { type, id, name, avatar, text, count, giftName, diamonds } = req.body;
  const uid = id || `test_${Math.floor(Math.random() * 8999 + 1000)}`;
  const uname = name || `Tù nhân #${uid.slice(-4)}`;

  switch (type) {
    case 'join':
      getOrCreateUser(uid, uname, avatar, true);
      break;

    case 'chat':
      handleChat(uid, uname, avatar, text || 'Chào buồng giam anh em ơi!');
      break;

    case 'tap':
      handleTaps(uid, uname, avatar, parseInt(count) || 50);
      break;

    case 'follow':
      handleFollow(uid, uname, avatar);
      break;

    case 'gift': {
      const gName = giftName || 'Hoa hồng';
      const gCount = parseInt(count) || 1;
      const gCoins = parseInt(diamonds !== undefined ? diamonds : (req.body.coins || 0));
      const gId = req.body.giftId || req.body.id || 'sim_gift';
      const resolved = resolveGiftPoints(gName, gCoins, gCount, gId);
      if (!resolved.isUnknown && resolved.totalPoints > 0) {
        addPoints(uid, uname, avatar, resolved.totalPoints, `Đóng họ ${gName}`, true, gName, resolved.count, gId, resolved.unitCoins, resolved.totalCoins);
      }
      break;
    }

    case 'leave':
      handleLeave(uid);
      break;

    case 'test_ladder_up': {
      const ladderId = 'vip_dai_ca';
      const u = getOrCreateUser(ladderId, 'Đại Ca Sơn Ca', '');
      u.points = 120;
      recalculateFloors();
      break;
    }

    case 'test_ladder_down': {
      const ladderId = 'vip_dai_ca';
      if (gameState.users[ladderId]) {
        gameState.users[ladderId].points = 0;
        recalculateFloors();
      }
      break;
    }

    case 'simulate_100': {
      for (let i = 1; i <= 100; i++) {
        const simId = `sim_${i}`;
        const simName = simDisplayName(i);
        const pts = i === 1 ? 150 : (i <= 5 ? 60 : (i <= 15 ? 20 : 0));
        const simUser = getOrCreateUser(simId, simName, '');
        simUser.name = simName; // Bấm lại vẫn đổi sang tên thật
        simUser.points = pts;
        simUser.isSimulated = true; // Ở lại buồng cho đông (miễn đá idle + trừ điểm)
        simUser.isActiveInRoom = true;
        simUser.isLeaving = false;
      }
      recalculateFloors();
      broadcastState();
      addLog('🚀 Đã kích hoạt 100 người tham gia buồng giam mô phỏng!', 'system');
      break;
    }

    default:
      return res.status(400).json({ error: 'Unknown event type' });
  }

  res.json({ success: true, message: `Executed simulation: ${type}` });
});

// BỘ PHÂN TÍCH VÀ XỬ LÝ SỰ KIỆN TIKFINITY / TIKTOK LIVE / STREAMER.BOT TOÀN DIỆN
function processWebhookData(rawReqBody, reqQuery, reqMethod, reqUrl) {
  let bodyObj = {};
  if (typeof rawReqBody === 'string') {
    try {
      bodyObj = JSON.parse(rawReqBody);
    } catch (e) {
      bodyObj = {};
    }
  } else if (typeof rawReqBody === 'object' && rawReqBody !== null) {
    bodyObj = rawReqBody;
  }

  const data = { ...reqQuery, ...bodyObj };
  const innerData = (typeof data.data === 'object' && data.data !== null) ? data.data :
                    ((typeof data.args === 'object' && data.args !== null) ? data.args :
                    ((typeof data.payload === 'object' && data.payload !== null) ? data.payload : {}));
  const args = (typeof data.args === 'object' && data.args !== null) ? data.args : {};

  // Gom toàn bộ chuỗi sự kiện để nhận diện không bao giờ bỏ sót
  const actionName = (data.action && typeof data.action === 'object' && data.action.name) ? String(data.action.name) :
                     (typeof data.action === 'string' ? data.action : '');
  const triggerTypeId = Number(data.triggerTypeId || innerData.triggerTypeId || args.triggerTypeId || 0);

  const evStrings = [
    data.event, data.type, actionName, data.actionName, data.name,
    innerData.event, innerData.type, innerData.action, innerData.name,
    data.displayType, innerData.displayType,
    data.socialType, innerData.socialType,
    data.subType, innerData.subType,
    data.label, innerData.label,
    data.value1, data.value2, data.value3,
    data.content, innerData.content,
    data.commandParams, innerData.commandParams,
    data.message, innerData.message,
    String(reqUrl || '')
  ].map(s => String(s || '').toLowerCase()).join(' ');

  // Trích xuất thông tin người dùng từ mọi tầng cấu trúc JSON
  const userObj = (typeof data.user === 'object' && data.user !== null) ? data.user :
                  (typeof innerData.user === 'object' && innerData.user !== null ? innerData.user : {});
  const userStr = typeof data.user === 'string' ? data.user :
                  (typeof innerData.user === 'string' ? innerData.user : '');

  const primaryId = userObj.userId || userObj.id || userObj.user_id ||
                    data.userId || data.id || data.user_id ||
                    innerData.userId || innerData.id || innerData.user_id ||
                    args.userId || args.user_id || '';

  const alternateId = userObj.uniqueId || userObj.username || userObj.user_name || userObj.secUid || userObj.sec_uid ||
                      data.uniqueId || data.username || data.user_name || data.secUid || data.sec_uid ||
                      innerData.uniqueId || innerData.username || innerData.user_name || innerData.secUid || innerData.sec_uid ||
                      args.username || args.user || args.uniqueId ||
                      userStr ||
                      (data.value1 && !data.value1.includes('http') && data.value1.length < 50 ? data.value1 : '') || '';

  const uid = resolveCanonicalUserId(primaryId, alternateId);

  const rawUname = userObj.nickname || userObj.name ||
                data.nickname || data.userName || data.user_name || data.name ||
                innerData.nickname || innerData.userName || innerData.user_name || innerData.name ||
                args.nickname || args.user_name || args.username ||
                alternateId || primaryId || `Phạm nhân #${uid.slice(-4)}`;
  const uname = sanitizeForDisplay(rawUname);

  const avatar = userObj.profilePictureUrl || userObj.avatarUrl || userObj.avatar || userObj.avatar_url || userObj.avatar_thumb || userObj.profile_picture_url ||
                 data.profilePictureUrl || data.avatarUrl || data.avatar || data.avatar_url || data.avatar_thumb || data.profile_picture_url || data.avatar_large || data.profilePic ||
                 innerData.profilePictureUrl || innerData.avatarUrl || innerData.avatar || innerData.avatar_url || innerData.avatar_thumb || innerData.profile_picture_url ||
                 args.profilePicturUrl || args.profilePictureUrl || args.avatar || args.avatar_url || args.avatar_thumb || '';

  // Phân loại sự kiện
  const isLeave = evStrings.includes('leave') || evStrings.includes('rời') || evStrings.includes('exit') ||
                  triggerTypeId === 8 || triggerTypeId === 9 || data.isLeave;

  // Phân loại Share
  const isShare = evStrings.includes('share') || evStrings.includes('chia sẻ') || triggerTypeId === 4 ||
                  data.action === 3 || innerData.action === 3 || args.action === 3;

  // Phân loại Follow (bắt trọn 100% các biến thể của TikFinity & TikTok Live)
  const isFollow = !isShare && (
    triggerTypeId === 1 || triggerTypeId === 2 ||
    data.action === 1 || innerData.action === 1 || args.action === 1 ||
    data.isFollow === true || data.follow === true ||
    evStrings.includes('follow') ||
    evStrings.includes('theo dõi') ||
    evStrings.includes('theo doi') ||
    evStrings.includes('social') ||          // TikFinity SocialMessage
    evStrings.includes('subscribe') ||       // TikTok Subscribe
    evStrings.includes('member_follow') ||   // TikFinity member follow
    evStrings.includes('pm_main_follow') ||
    evStrings.includes('follow_icon')
  );

  const isGift = triggerTypeId === 3 || evStrings.includes('gift') ||
                 Boolean(data.giftName || data.gift || innerData.giftName || innerData.gift || args.giftName ||
                         data.diamondCount || data.diamonds || data.coins || innerData.coins || args.coins);

  const isLike = triggerTypeId === 7 || evStrings.includes('like') || evStrings.includes('tap') ||
                 Boolean(data.likeCount || data.likes || innerData.likeCount || args.likeCount);

  const isJoin = triggerTypeId === 6 || (!isLeave && !isFollow && !isGift && !isLike && (
                 evStrings.includes('join') || evStrings.includes('member') ||
                 evStrings.includes('enter') || evStrings.includes('welcome') || evStrings.includes('room_enter')));

  const isChat = !isLeave && !isFollow && !isGift && !isLike && !isJoin && (
                 triggerTypeId === 11 || evStrings.includes('chat') || evStrings.includes('comment') ||
                 Boolean(data.comment || data.content || data.text || data.message || data.commandParams ||
                         innerData.comment || innerData.content || innerData.text || innerData.message || innerData.commandParams ||
                         args.comment || args.content || args.text || args.message || args.commandParams));

  return {
    uid, uname, avatar, data, innerData, args,
    isLeave, isFollow, isGift, isLike, isChat, isJoin,
    evStrings, triggerTypeId, actionName
  };
}

function handleWebhookRequest(req, res) {
  webhookCount++;
  const p = processWebhookData(req.body, req.query, req.method, req.originalUrl);
  const { uid, uname, avatar, data, innerData, args, isLeave, isFollow, isGift, isLike, isChat, isJoin, actionName } = p;

  if (!isGift) {
    console.log(`[INCOMING] triggerId: ${p.triggerTypeId} | keys: [${Object.keys(data).filter(k => k !== 'avatar_url').join(',')}] | user: ${uname} (${uid}) | isFollow: ${isFollow}`);
  }

  // 1. Xử lý sự kiện Leave ngay lập tức
  if (isLeave) {
    handleLeave(uid);
    return res.status(200).json({ received: true, action: 'leave', userId: uid });
  }

  // 2. Xử lý sự kiện Follow (+10đ buồng, bắt chuẩn xác mọi nguồn TikFinity/TikTok)
  if (isFollow) {
    console.log(`[WEBHOOK FOLLOW] 🔔 Nhận sự kiện Follow thành công! Tên: ${uname} | ID: ${uid} | Method: ${req.method} | Path: ${req.originalUrl}`);
    const added = handleFollow(uid, uname, avatar);
    return res.status(200).json({ received: true, action: 'follow', userId: uid, userName: uname, pointsAdded: added });
  }

  // 3. Xử lý sự kiện quà (theo giá trị xu × tỷ giá hiện hành)
  if (isGift) {
    const rawGiftName = data.giftName || innerData.giftName || args.giftName ||
                        data.gift?.name || data.gift?.gift_name || data.name || 'Hoa hồng';
    const rawCount = data.repeatCount || data.count || data.combo || data.comboCount ||
                     innerData.repeatCount || innerData.count || args.repeatCount || args.count || 1;
    const rawCoins = data.diamondCount || data.diamond_count || data.coins || data.diamonds ||
                     innerData.diamondCount || innerData.coins || args.coins ||
                     data.gift?.diamond_count || data.gift?.coins || data.coinCount || 0;
    const rawGiftId = data.giftId || innerData.giftId || args.giftId ||
                      data.gift?.gift_id || data.gift?.id || data.id || '';

    const resolved = resolveGiftPoints(rawGiftName, rawCoins, rawCount, rawGiftId);
    if (!resolved.isUnknown && resolved.totalPoints > 0) {
      addPoints(uid, uname, avatar, resolved.totalPoints, `LIVE: Đóng họ ${rawGiftName}`, true, rawGiftName, resolved.count, rawGiftId, resolved.unitCoins, resolved.totalCoins);
    }
    return res.status(200).json({ received: true, action: 'gift', userId: uid });
  } else if (isLike) {
    const count = parseInt(data.likeCount || data.likes || innerData.likeCount || args.likeCount || 1);
    handleTaps(uid, uname, avatar, count);
    return res.status(200).json({ received: true, action: 'tap', userId: uid, count });
  } else if (isChat) {
    const isActionName = (str) => {
      if (!str) return true;
      const s = String(str).trim().toLowerCase();
      return s === 'buồng giam - mọi sự kiện' || s === 'buong giam - moi su kien' || (actionName && s === actionName.toLowerCase());
    };

    let rawText = '';
    const candidates = [
      data.comment, data.text, data.message, data.commandParams,
      innerData.comment, innerData.text, innerData.message, innerData.commandParams,
      args.comment, args.text, args.message, args.commandParams,
      data.content, innerData.content, args.content,
      data.value1, data.value2, data.value3
    ];

    for (const c of candidates) {
      if (c && typeof c === 'string' && c.trim() && !isActionName(c) && c !== uid && c !== uname) {
        rawText = c.trim();
        break;
      }
    }

    const text = rawText || String(data.comment || data.content || '');
    console.log(`[CHAT WEBHOOK] 💬 User: ${uname} (${uid}) | Text: "${text}" | Raw:`, {
      content: data.content,
      commandParams: data.commandParams,
      value1: data.value1,
      value2: data.value2,
      value3: data.value3
    });
    handleChat(uid, uname, avatar, text);
    return res.status(200).json({ received: true, action: 'chat', userId: uid, text });
  } else if (isJoin) {
    getOrCreateUser(uid, uname, avatar, true);
    return res.status(200).json({ received: true, action: 'join', userId: uid });
  } else if (uid && uid !== 'guest' && !data.isLeave) {
    getOrCreateUser(uid, uname, avatar);
  }

  res.status(200).json({ received: true });
}

// Hỗ trợ mọi route Webhook TikFinity (POST, GET, OPTIONS)
app.all(['/api/webhook', '/webhook', '/api/follow', '/follow', '/api/tikfinity', '/tikfinity'], handleWebhookRequest);

// Hỗ trợ giao thức Streamer.bot HTTP (DoAction từ TikFinity)
app.all(['/GetActions', '/GetInfo', '/DoAction'], (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);

  if (req.path === '/DoAction' && (req.body || req.query)) {
    return handleWebhookRequest(req, res);
  }

  res.json({
    status: 'ok',
    name: 'Streamer.bot',
    version: '0.2.4',
    count: 6,
    actions: [
      { id: 'act_follow', name: 'TikTok - Follow', group: 'TikTok' },
      { id: 'act_gift', name: 'TikTok - Gift', group: 'TikTok' },
      { id: 'act_chat', name: 'TikTok - Chat', group: 'TikTok' },
      { id: 'act_like', name: 'TikTok - Like', group: 'TikTok' },
      { id: 'act_join', name: 'TikTok - Join', group: 'TikTok' },
      { id: 'act_leave', name: 'TikTok - Leave', group: 'TikTok' }
    ]
  });
});

// STREAMER.BOT OUTBOUND WEBSOCKET CLIENT (Dự phòng nếu dùng Streamer.bot Desktop)
let streamerBotWs = null;
function initStreamerBot(port = 8080) {
  try {
    streamerBotWs = new WebSocket(`ws://127.0.0.1:${port}/`);
    streamerBotWs.on('open', () => {
      gameState.streamerbotConnected = true;
      addLog(`🔌 Đã kết nối Streamer.bot WebSocket (cổng ${port}).`, 'system');
      streamerBotWs.send(JSON.stringify({
        request: "Subscribe",
        id: "buong-giam-bridge",
        events: {
          "Twitch": [],
          "General": ["Custom"]
        }
      }));
    });
    streamerBotWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event && msg.event.source === 'TikTok') {
          const d = msg.data || {};
          const uid = d.user_id || d.username || 'sb_user';
          const uname = d.nickname || d.user_name || uid;
          if (msg.event.type === 'Gift') {
            const rawGiftName = d.gift_name || 'Hoa hồng';
            const rawCoins = parseInt(d.coins || 0);
            const rawCount = parseInt(d.repeat_count || d.count || 1);
            const rawGiftId = d.gift_id || d.id || '';
            const resolved = resolveGiftPoints(rawGiftName, rawCoins, rawCount);
            addPoints(uid, uname, '', resolved.totalPoints, `Streamer.bot: ${rawGiftName}`, true, rawGiftName, resolved.count, rawGiftId, rawCoins);
          } else if (msg.event.type === 'Like') {
            handleTaps(uid, uname, '', parseInt(d.likes || 1));
          } else if (msg.event.type === 'Follow') {
            handleFollow(uid, uname, '');
          } else if (msg.event.type === 'ChatMessage') {
            handleChat(uid, uname, '', d.message || '');
          } else if (msg.event.type === 'Join' || msg.event.type === 'Member' || msg.event.type === 'UserJoin') {
            getOrCreateUser(uid, uname, '');
          }
        }
      } catch (e) {}
    });
    streamerBotWs.on('close', () => {
      gameState.streamerbotConnected = false;
      setTimeout(() => initStreamerBot(port), 10000);
    });
    streamerBotWs.on('error', () => {
      gameState.streamerbotConnected = false;
    });
  } catch (e) {}
}
initStreamerBot();

// GOOGLE TTS PROXY (ĐỌC HOÀN CHỈNH TỪNG CÂU, TỰ ĐỘNG LỌC TỪ CẤM/CHỬI BẬY THAY BẰNG TIẾNG PÍP)
app.get('/api/tts', async (req, res) => {
  const rawText = (req.query.text || '').trim();
  if (!rawText) return res.status(400).send('No text');

  // Lọc từ chửi bậy, tục tĩu và từ cấm TikTok -> Thay bằng đánh dấu tiếng píp __BEEP__
  const text = sanitizeForSpeech(rawText);

  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(text).digest('hex');
  const cachePath = path.join(TTS_CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cachePath)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    return fs.createReadStream(cachePath).pipe(res);
  }

  try {
    const fetchTtsChunk = (q) => {
      return new Promise((resolve, reject) => {
        const cleanQ = (q || '').trim();
        if (!cleanQ) return resolve(Buffer.alloc(0));
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanQ)}&tl=vi&client=tw-ob`;
        https.get(url, (ttsRes) => {
          if (ttsRes.statusCode === 200) {
            const chunks = [];
            ttsRes.on('data', c => chunks.push(c));
            ttsRes.on('end', () => resolve(Buffer.concat(chunks)));
          } else {
            reject(new Error(`TTS status ${ttsRes.statusCode}`));
          }
        }).on('error', reject);
      });
    };

    const fetchLongTts = async (str) => {
      if (!str || !str.trim()) return Buffer.alloc(0);
      const clean = str.trim();
      if (clean.length <= 180) return await fetchTtsChunk(clean);

      const parts = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
      const buffers = [];
      let currentChunk = '';
      for (const part of parts) {
        if ((currentChunk + ' ' + part).trim().length <= 180) {
          currentChunk = (currentChunk + ' ' + part).trim();
        } else {
          if (currentChunk) buffers.push(await fetchTtsChunk(currentChunk));
          currentChunk = part.trim();
        }
      }
      if (currentChunk) buffers.push(await fetchTtsChunk(currentChunk));
      return Buffer.concat(buffers);
    };

    let audioBuffer;

    if (text.includes('__BEEP__')) {
      // Có từ chửi bậy / từ cấm -> Tách thành từng đoạn và chèn tiếng píp vào giữa!
      const parts = text.split('__BEEP__');
      const buffers = [];
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i].trim();
        if (seg) {
          buffers.push(await fetchLongTts(seg));
        }
        // Nếu không phải phần cuối: Chèn tiếng 'píp' (1000Hz censor beep)!
        if (i < parts.length - 1 && censorBeepBuffer) {
          buffers.push(censorBeepBuffer);
        }
      }
      audioBuffer = Buffer.concat(buffers);
    } else {
      audioBuffer = await fetchLongTts(text);
    }

    if (audioBuffer && audioBuffer.length > 0) {
      fs.writeFileSync(cachePath, audioBuffer);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.warn('[TTS ERROR]', err.message);
    res.status(500).send('TTS error');
  }
});

  return {
    type: 'express',
    router: app,
    io,

    destroy() {
      // Dừng mọi timer của room để tiến trình platform không bị giữ sống.
      ctx.dead = true;
      for (const id of __timers) {
        try { global.clearTimeout(id); } catch {}
        try { global.clearInterval(id); } catch {}
      }
      __timers.clear();
    },
  };
}

module.exports = createEngine;
