// GENERATED — đừng sửa tay. Sinh từ code gốc bằng: npm run build
// Nguồn: /home/hatch/workspace/game-thap-sang-ban-do/server.js
// Thay đổi so với bản gốc (giữ nguyên luật chơi):
//  - Toàn bộ code gốc nằm trong createEngine(ctx): mỗi lần gọi là 1 room
//    mới, state (game/config/timer/SSE) không chia sẻ.
//  - http.createServer riêng được thay bằng handleRequest do platform gọi.
//  - CONFIG_PATH + VOICE_CACHE_DIR trỏ về thư mục data riêng của room.
//  - URL voice cache trả về mang prefix của room.
//  - Timer được theo dõi để hủy room dọn sạch.
// ============================================================================
// THẮP SÁNG BẢN ĐỒ VIỆT NAM — TikTok LIVE game.
// Chạy bằng Node thuần, KHÔNG cần npm install:  node server.js
//   Overlay (OBS Browser Source):  http://localhost:3009/
//   Dashboard (điều khiển):         http://localhost:3009/dashboard
//   Webhook TikFinity:               POST http://localhost:3009/api/webhook
// Bản đồ: 34 tỉnh/thành sau sáp nhập 1/7/2025 (28 tỉnh + 6 TP), ranh giới thật
// từ GeoJSON nguồn Free-GIS-Data (Nguyễn Duy Liêm, public use), đã đơn giản hóa.
// Số thứ tự 1-34 chỉ là mã nội bộ của tỉnh (không hiện lên bản đồ, không
// nhận qua comment). Tên tỉnh CŨ (63 tỉnh) vẫn nhận — tự map về tỉnh mới
// đã sáp nhập (vd. Bình Dương -> TP.HCM).
// Luật chơi — BẢNG XẾP HẠNG TÍNH THEO TỈNH (mặc định, chỉnh trong dashboard
// hoặc config.json):
//   - Comment tên tỉnh / viết tắt / tên thành phố -> thắp tỉnh đó
//     (tối đa 3 tỉnh/comment, chống spam 1 comment tính điểm/5s/người).
//     Mỗi tỉnh được nêu trong comment = +1 điểm (cả khi tỉnh đã sáng),
//     tất cả cộng cho tỉnh quê hiện tại = tỉnh vừa comment xong (v7.3:
//     quê di chuyển theo comment gần nhất, thay luật v6.2 khóa quê).
//     Avatar người xem RƠI vào vị trí tỉnh vừa comment (quê hiện tại);
//     comment tỉnh khác thì avatar bay sang tỉnh đó.
//   - Sau khi chọn quê, mọi tương tác đều + điểm cho TỈNH QUÊ của mình:
//     20 tap = +1 điểm; 1 xu quà = +5 điểm.
//   - Quà còn thắp ngẫu nhiên tỉnh chưa sáng: <10 xu = 1, 10-99 xu = 2,
//     >=100 xu = 3 tỉnh. Follow mới: thắp ngẫu nhiên 1 tỉnh chưa sáng.
//   - Ván chơi theo THỜI GIAN (v8, mặc định 60 phút, chỉnh trong
//     dashboard): hết giờ thì tỉnh điểm cao nhất thắng (hòa -> nhiều lượt
//     thắp hơn, rồi thắp sớm hơn) + vinh danh người đóng góp nhiều nhất,
//     tự chơi lại sau 60s. Sáng đủ 34/34 chỉ là 1 MỐC (pháo hoa + thông
//     báo), ván vẫn chơi tiếp tới hết giờ.
//   - Hoàng Sa / Trường Sa: VẼ TRONG BẢN ĐỒ, đúng vị trí gốc ở Biển Đông
//     (Hoàng Sa phía trên, Trường Sa phía dưới — như ảnh mẫu của Chủ tịch),
//     hình đảo THẬT từ GeoJSON, gộp vào tỉnh chủ quản: Hoàng Sa sáng cùng
//     Đà Nẵng, Trường Sa sáng cùng Khánh Hòa (cùng màu/cùng trạng thái) +
//     voice thông báo. Đảo nằm trong SVG bản đồ nên không bị khung nào che.
//   - Voice kiểu Buồng giam: file TTS tạo SẴN (public/voice/*.mp3, giọng nam
//     trẻ) — overlay chỉ phát file, KHÔNG dùng giọng trình duyệt, KHÔNG tạo
//     TTS trong lúc live. Ai thắp tỉnh nào (clip tỉnh + câu giới thiệu),
//     cảm ơn quà/follow, GIẢI THÍCH khi gõ tên tỉnh cũ (2 clip nối nhau),
//     mốc điểm, tỉnh may mắn, sáng đủ cả nước. Tên người xem KHÔNG đọc
//     thành tiếng (chỉ hiện chữ). Bộ lọc từ: tên chứa link/spam/chửi thì
//     hiện/đọc là "Bạn". Nhạc nền tự nhỏ 10% khi voice đọc (auto-duck).
//   - Zoom: camera bay tới (phóng to) tỉnh vừa thắp, giữ ~2s rồi thu nhỏ
//     về toàn cảnh. Không zoom lúc đang ăn mừng sáng đủ 34/34.
//   - Nhạc nền: playlist trong public/music/ (6 track nhẹ tự tạo, không
//     bản quyền; thả thêm file mp3 vào thư mục là tự vào playlist).
//     Overlay phát vòng lặp, chỉnh play/pause/bài/âm lượng trong dashboard.
//   - V4: 🍀 Tỉnh may mắn (chưa sáng, viền tím nhấp nháy — thắp được
//     +thưởng điểm); 🏆 mốc điểm tỉnh 50/100/200 (vượt mốc: thông báo +
//     voice + hiệu ứng); 🎁 bảng Top tặng quà; 👑 vương miện cho tỉnh
//     đang dẫn đầu; thẻ Spotlight "ai vừa thắp tỉnh nào" + câu giới
//     thiệu tỉnh; 🔊 hiệu ứng âm thanh tổng hợp (pop/chuông/kèn, không
//     cần file nhạc); tỉnh càng nhiều điểm càng sáng rực (heat).
// ============================================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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


const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(ctx.dataDir, 'config.json');
const PROVINCES_PATH = path.join(PUBLIC, 'provinces.json');

// ---------------------------------------------------------------------------
// Dữ liệu tỉnh (đường biên thật, đã chiếu sẵn sang tọa độ SVG 1080x1920)
// ---------------------------------------------------------------------------
const PROVINCES = JSON.parse(fs.readFileSync(PROVINCES_PATH, 'utf8'));
const byNum = new Map(PROVINCES.map((p) => [p.num, p]));
const byId = new Map(PROVINCES.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// Chuẩn hóa tiếng Việt + alias (tên cũ, viết tắt, thành phố) -> số tỉnh
// ---------------------------------------------------------------------------
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// [alias đã chuẩn hóa, số tỉnh] — số theo thứ tự A-Z ở provinces.json
const ALIAS_LIST = [
  ['an giang', 1], ['kien giang', 1], ['phu quoc', 1], ['ha tien', 1], ['chau doc', 1], ['rach gia', 1],
  ['bac ninh', 2], ['bac giang', 2],
  ['ca mau', 3], ['bac lieu', 3],
  ['can tho', 4], ['hau giang', 4], ['soc trang', 4],
  ['cao bang', 5],
  ['da nang', 6], ['quang nam', 6], ['hoi an', 6], ['tam ky', 6],
  ['dak lak', 7], ['phu yen', 7], ['buon ma thuot', 7], ['bmt', 7], ['tuy hoa', 7],
  ['dien bien', 8],
  ['dong nai', 9], ['binh phuoc', 9],
  ['dong thap', 10], ['tien giang', 10], ['my tho', 10], ['sa dec', 10], ['cao lanh', 10],
  ['gia lai', 11], ['binh dinh', 11], ['quy nhon', 11], ['pleiku', 11],
  ['ha noi', 12], ['hn', 12], ['thu do', 12],
  ['ha tinh', 13],
  ['hai phong', 14], ['hai duong', 14],
  ['ho chi minh', 15], ['tp ho chi minh', 15], ['hcm', 15], ['tphcm', 15], ['sai gon', 15], ['sg', 15],
  ['ba ria vung tau', 15], ['binh duong', 15], ['vung tau', 15], ['thu dau mot', 15],
  ['hue', 16], ['thua thien hue', 16],
  ['hung yen', 17], ['thai binh', 17],
  ['khanh hoa', 18], ['ninh thuan', 18], ['nha trang', 18], ['cam ranh', 18], ['phan rang', 18],
  ['lai chau', 19],
  ['lam dong', 20], ['binh thuan', 20], ['dak nong', 20], ['da lat', 20], ['phan thiet', 20], ['gia nghia', 20],
  ['lang son', 21],
  ['lao cai', 22], ['yen bai', 22], ['sapa', 22], ['sa pa', 22],
  ['nghe an', 23], ['vinh', 23],
  ['ninh binh', 24], ['ha nam', 24], ['nam dinh', 24],
  ['phu tho', 25], ['vinh phuc', 25], ['hoa binh', 25], ['viet tri', 25],
  ['quang ngai', 26], ['kon tum', 26],
  ['quang ninh', 27], ['ha long', 27],
  ['quang tri', 28], ['quang binh', 28], ['dong hoi', 28],
  ['son la', 29],
  ['tay ninh', 30], ['long an', 30],
  ['thai nguyen', 31], ['bac kan', 31],
  ['thanh hoa', 32], ['sam son', 32],
  ['tuyen quang', 33], ['ha giang', 33],
  ['vinh long', 34], ['ben tre', 34], ['tra vinh', 34],
];
// Dài trước để "ba ria vung tau" khớp trước "vung tau", "ho chi minh" trước "hue"...
const ALIASES = [...ALIAS_LIST].sort((a, b) => b[0].length - a[0].length);

// Tên tỉnh CŨ (63 tỉnh trước 1/7/2025) -> tên hiển thị, để voice giải thích
// khi người xem gõ tên cũ (vd. "Bình Dương nay đã sáp nhập vào TP.HCM").
const OLD_DISPLAY = {
  'kien giang': 'Kiên Giang', 'bac lieu': 'Bạc Liêu', 'bac giang': 'Bắc Giang',
  'hau giang': 'Hậu Giang', 'soc trang': 'Sóc Trăng', 'quang nam': 'Quảng Nam',
  'phu yen': 'Phú Yên', 'binh phuoc': 'Bình Phước', 'tien giang': 'Tiền Giang',
  'binh dinh': 'Bình Định', 'hai duong': 'Hải Dương', 'ba ria vung tau': 'Bà Rịa – Vũng Tàu',
  'binh duong': 'Bình Dương', 'thai binh': 'Thái Bình', 'ninh thuan': 'Ninh Thuận',
  'binh thuan': 'Bình Thuận', 'dak nong': 'Đắk Nông', 'yen bai': 'Yên Bái',
  'ha nam': 'Hà Nam', 'nam dinh': 'Nam Định', 'vinh phuc': 'Vĩnh Phúc',
  'hoa binh': 'Hòa Bình', 'kon tum': 'Kon Tum', 'quang binh': 'Quảng Bình',
  'long an': 'Long An', 'bac kan': 'Bắc Kạn', 'ha giang': 'Hà Giang',
  'ben tre': 'Bến Tre', 'tra vinh': 'Trà Vinh', 'thua thien hue': 'Thừa Thiên Huế',
};
// 1 câu giới thiệu ngắn cho mỗi tỉnh (số 1-34) — voice đọc sau khi thắp sáng.
const PROVINCE_FACTS = {
  1: 'vựa lúa miền Tây, có núi Cấm và rừng tràm Trà Sư',
  2: 'quê hương quan họ và chùa Dâu',
  3: 'đất mũi cực Nam của Tổ quốc',
  4: 'thủ phủ miền Tây, có chợ nổi Cái Răng',
  5: 'có thác Bản Giốc và hang Pác Bó',
  6: 'thành phố đáng sống, có cầu Rồng và quần đảo Hoàng Sa',
  7: 'thủ phủ cà phê, có hồ Lắk và Buôn Ma Thuột',
  8: 'chiến thắng Điện Biên Phủ lừng lẫy',
  9: 'có khu du lịch Bửu Long và hồ Trị An',
  10: 'xứ sở sen hồng',
  11: 'có Biển Hồ và cồng chiêng Tây Nguyên',
  12: 'thủ đô ngàn năm văn hiến',
  13: 'quê hương đại thi hào Nguyễn Du',
  14: 'thành phố cảng, có đảo Cát Bà',
  15: 'thành phố đông dân nhất cả nước',
  16: 'cố đô, có Đại Nội và nhã nhạc cung đình',
  17: 'có phố Hiến và nhãn lồng',
  18: 'có vịnh Nha Trang và quần đảo Trường Sa',
  19: 'có đèo Ô Quy Hồ và đỉnh Pu Ta Leng',
  20: 'có Đà Lạt, thành phố ngàn hoa',
  21: 'có ải Chi Lăng và chợ Kỳ Lừa',
  22: 'có Sa Pa và đỉnh Fansipan',
  23: 'quê hương Chủ tịch Hồ Chí Minh',
  24: 'có Tràng An và cố đô Hoa Lư',
  25: 'đất Tổ Hùng Vương, giỗ Tổ mùng 10 tháng 3',
  26: 'có đảo Lý Sơn và biển Mỹ Khê',
  27: 'có vịnh Hạ Long, di sản thế giới',
  28: 'có thành cổ Quảng Trị và vĩ tuyến 17',
  29: 'có cao nguyên Mộc Châu và nhà tù Sơn La',
  30: 'có núi Bà Đen và tòa thánh Cao Đài',
  31: 'xứ sở chè Tân Cương',
  32: 'có thành nhà Hồ và bãi biển Sầm Sơn',
  33: 'có Tân Trào, thủ đô kháng chiến',
  34: 'miền sông nước, có chợ nổi Trà Ôn',
};

// Tên "xứ" để đọc câu chào người mới vào tỉnh đã sáng (2026-11-13,
// Chủ tịch: "Thêm một người con xứ Thanh nữa đã cùng chung tay thắp
// sáng quê hương..."). Chỉ những tỉnh có tên xứ quen thuộc mới dùng
// "xứ X"; tỉnh còn lại dùng "của {tên tỉnh}".
const PROVINCE_XU = {
  13: 'xứ Nghệ', 16: 'xứ Huế', 18: 'xứ Trầm', 21: 'xứ Lạng',
  23: 'xứ Nghệ', 26: 'xứ Quảng', 32: 'xứ Thanh',
};
function xuName(num, name) { return PROVINCE_XU[num] || ('của ' + name); }

// Tìm tối đa maxN tỉnh trong 1 comment. Trả về [{num, alias, isOld, idx}...]
// theo thứ tự xuất hiện. alias = cụm đã khớp (đã chuẩn hóa), isOld = tên tỉnh cũ.
function parseProvinces(text, maxN = 3) {
  const raw = norm(text).replace(/\b(thanh pho|tinh|tp)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const found = []; // {num, alias, isOld, idx}
  const seen = new Set();
  const padded = ' ' + raw + ' ';
  // (2026-11-12) BỎ cơ chế comment số: chỉ comment TÊN tỉnh mới tính.
  // Trước đây bước này nhận số 1-34 trong comment (vd. "12", "#6") rồi
  // thắp tỉnh đó — nay số trong comment không thắp gì cả.
  // 1) Tên / alias — khớp cụm từ nguyên vẹn. Alias dài ăn trước ("vinh long"
  // chỉ ra Vĩnh Long, không ra thêm Nghệ An nhờ "vinh"). Vùng đã khớp tính
  // theo đúng chữ của alias (không tính khoảng trắng 2 đầu, vì khoảng trắng
  // sau alias này cũng là khoảng trắng trước alias kia).
  const usedSpaced = []; // [start, end) đã khớp trong chuỗi có cách
  for (const [alias, num] of ALIASES) {
    if (seen.has(num)) continue;
    const idx = padded.indexOf(' ' + alias + ' ');
    if (idx < 0) continue;
    if (usedSpaced.some(([s, e]) => idx + 1 < e && idx + 1 + alias.length > s)) continue;
    usedSpaced.push([idx + 1, idx + 1 + alias.length]);
    seen.add(num);
    found.push({ num, alias, isOld: OLD_DISPLAY[alias] !== undefined, idx });
  }
  // 2) Dạng viết liền không dấu, không cách: "hanoi", "saigon", "dalat",
  // "nhatrang" — người xem gõ nhanh hay viết liền. Chỉ khớp alias dài
  // (>= 4 ký tự khi bỏ cách) để không nhận nhầm alias ngắn ("hn", "sg"),
  // và alias dài hơn ăn trước ("vinhlong" chỉ ra Vĩnh Long, không ra thêm
  // Nghệ An nhờ "vinh").
  const nospace = raw.replace(/ /g, '');
  // Vùng đã khớp ở bước 1 cũng tính vào đây (đổi sang tọa độ không cách),
  // để "vinh" không chui vào trong "vinhlong" đã khớp ở bước 1.
  const used = []; // [start, end) đã khớp trong chuỗi không cách
  for (const f of found) {
    if (!f.alias) continue;
    const fa = f.alias.replace(/ /g, '');
    const fi = nospace.indexOf(fa);
    if (fi >= 0) used.push([fi, fi + fa.length]);
  }
  for (const [alias, num] of ALIASES) {
    if (seen.has(num)) continue;
    const a = alias.replace(/ /g, '');
    if (a.length < 4) continue;
    const idx = nospace.indexOf(a);
    if (idx < 0) continue;
    if (used.some(([s, e]) => idx < e && idx + a.length > s)) continue;
    used.push([idx, idx + a.length]);
    seen.add(num);
    found.push({ num, alias, isOld: OLD_DISPLAY[alias] !== undefined, idx: 1000 + idx });
  }
  found.sort((a, b) => a.idx - b.idx);
  return found.slice(0, maxN);
}

// ---------------------------------------------------------------------------
// Cấu hình
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = {
  port: 3009,
  // Luật điểm THEO TỈNH (bảng xếp hạng tính theo tỉnh):
  pointsPerComment: 1,   // comment tên tỉnh -> +1 điểm cho tỉnh đó (+1 cá nhân)
  pointsPerCoin: 5,      // mỗi xu quà -> +5 điểm cho tỉnh quê người tặng
  tapsPerPoint: 20,      // 20 tap -> +1 điểm cho tỉnh quê người tặng
  commentCooldownSec: 5,
  maxProvincesPerComment: 3,
  maxHomeChangesPerRound: 1, // chống spam (v7.4): mỗi người chơi chỉ được
  // đổi quê tối đa 1 lần trong 1 ván (0 = khóa hẳn sau lần chọn quê đầu).
  giftLightTiers: [      // [xu tối thiểu, số tỉnh thắp ngẫu nhiên]
    [1, 1], [10, 2], [100, 3],
  ],
  autoResetSeconds: 60,  // sau khi hết giờ ván (vinh danh xong)
  gameDurationMin: 60,   // (v8) thời lượng 1 ván (phút) — hết giờ thì tỉnh
  // điểm cao nhất thắng + vinh danh người đóng góp nhiều nhất; sáng đủ
  // 34/34 chỉ là 1 mốc (không kết thúc ván nữa).
  voiceEnabled: true,    // voice đọc trong overlay (file TTS sẵn, kiểu Buồng giam)
  voiceVolume: 0.9,      // âm lượng voice 0-1
  musicVolume: 0.35,     // âm lượng nhạc nền 0-1
  musicPlaying: true,    // nhạc nền bật mặc định
  // Mốc điểm / hiệu ứng âm thanh:
  milestonePoints: [50, 100, 200], // mốc điểm tỉnh: vượt mốc -> thông báo + voice + hiệu ứng
  sfxEnabled: true,      // hiệu ứng âm thanh tổng hợp trong overlay (pop/chuông/kèn)
  simulator: false,
};
function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch { return { ...DEFAULT_CONFIG }; }
}
let config = loadConfig();
if (process.argv.includes('--simulator')) config.simulator = true;
if (process.env.SIMULATOR === 'true') config.simulator = true;
function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}
const log = (scope, ...args) => {
  console.log(`[${new Date().toLocaleTimeString('vi-VN')}] [${scope}]`, ...args);
};

// ---------------------------------------------------------------------------
// Bộ lọc từ — kiểu Buồng giam / Teddy: chặn link, spam, chửi thề trong TÊN
// người xem trước khi đọc thành tiếng / hiện lên overlay. Chạy trên văn bản
// đã bỏ dấu; cẩn thận với từ lành trùng dạng sau khi bỏ dấu:
//   "các" vs "cặc" -> chỉ chặn "con cặc"; "đeo"/"buổi" bỏ hẳn, không chặn;
//   "ngủ" vs "ngu" -> chỉ chặn "ngu ngốc"; "lon" -> chỉ chặn "cái lồn" v.v.
// Tên bị chặn -> đọc/hiện là "Bạn", không đọc tên gốc.
// ---------------------------------------------------------------------------
const URL_RE = /(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|br|vn|ly|xyz|shop|link|me|tv|app|gg|site|online|store)\b)/i;
const SPAM_RE = new RegExp([
  '\\bmua\\w*\\s+(follow|like|view|sub|fl|nguoi\\s+theo\\s+doi|tim)',
  '\\btang\\w*\\s+(follow|like|view|sub|tim)',
  '\\blink\\s+(o\\s+)?bio\\b',
  '\\bbio\\s+co\\s+link\\b',
  '\\btelegram\\b', '\\bzalo\\b', '\\bwhatsapp\\b',
  '\\bkhuyen\\s*mai\\b', '\\bgiam\\s*gia\\b', '\\bma\\s*giam\\b',
  '\\bcoupon\\b', '\\bkiem\\s*tien\\b', '\\bca\\s*cuoc\\b', '\\bcasino\\b',
  '\\bsub\\s*cheo\\b', '\\bfollow\\s*cheo\\b', '\\btrao\\s*doi\\s*follow\\b',
  '\\bban\\s*(acc|nick|tk)\\b', '\\bmua\\s*(acc|nick)\\b',
  '\\bdang\\s*ky\\s*kenh\\b', '\\b(follow|fl)\\s+@',
].join('|'), 'i');
const PROFANITY_RE = new RegExp([
  '\\bdit\\w*', '\\bdcm\\b', '\\bdmm\\b', '\\bdkm\\b', '\\bclmm\\b',
  '\\bvkl\\b', '\\bvcl\\b', '\\bvl\\b', '\\bcc\\b',
  '\\bdu\\s*ma\\b', '\\bdi\\s*me\\b', '\\bcon\\s*cac\\b',
  '\\bcai\\s*lon\\b', '\\bdo\\s*lon\\b', '\\blon\\s*me\\b',
  '\\bthang\\s*cho\\b', '\\bdo\\s*cho\\b', '\\boc\\s*cho\\b', '\\bcho\\s*de\\b',
  '\\bngu\\s*ngoc\\b', '\\bfuck\\w*', '\\bshit\\b', '\\bbitch\\b',
].join('|'), 'i');
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
function stripDiacritics(s) {
  return String(s || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/đ/g, 'd');
}
function unmask(s) {
  return stripDiacritics(s)
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/(\p{L})[._*-]+(?=\p{L})/gu, '$1');
}
/** true nếu văn bản có link, spam hoặc chửi thề và không nên lên giọng nói hay overlay. */
function textBlocked(s) {
  const raw = String(s || '');
  if (!raw.trim()) return false;
  if (URL_RE.test(raw)) return true;
  return [stripDiacritics(raw), unmask(raw)].some((f) => SPAM_RE.test(f) || PROFANITY_RE.test(f));
}
function cleanName(name) { return textBlocked(name) ? 'Bạn' : name; }

// ---------------------------------------------------------------------------
// Voice đọc TÊN người xem: tổng hợp bằng Google TTS tiếng Việt (giọng thuần
// Việt, giống giọng các clip sẵn) + cache trên đĩa theo nội dung câu.
// File TTS sẵn KHÔNG đọc được tên bất kỳ, nên câu nào có tên người xem thì
// server tổng hợp riêng 1 lần rồi cache lại (câu giống nhau không tổng hợp
// lại). Overlay phát file cache nếu đã sẵn, chưa sẵn thì phát clip sẵn dự
// phòng (không đọc tên) để không kẹt hàng đợi. Cần mạng; lỗi mạng -> dùng
// clip sẵn. Không cần ffmpeg trên máy live (file dùng thẳng như Google trả).
// ---------------------------------------------------------------------------
const VOICE_CACHE_DIR = path.join(ctx.dataDir, 'voice-cache');
try { fs.mkdirSync(VOICE_CACHE_DIR, { recursive: true }); } catch {}
const voiceSynth = new Map(); // text -> { status: 'pending'|'ready'|'failed', url }
// Tổng hợp voice song song tối đa 3 (v7.9): trước đây xếp hàng NỐI TIẾP
// (1 câu xong mới tới câu sau) nên lúc live đông, câu thứ 5 phải chờ 4
// câu trước (mỗi câu 0.5–1.5s mạng) — overlay chỉ chờ tối đa 1.5s rồi
// đọc clip chung (mất tên). 3 luồng song song thì hầu hết tên kịp về.
let synthActive = 0;
const synthWaiters = [];
function synthSlot() {
  if (synthActive < 3) { synthActive++; return Promise.resolve(); }
  return new Promise((res) => synthWaiters.push(res));
}
function synthRelease() {
  synthActive--;
  const w = synthWaiters.shift();
  if (w) { synthActive++; w(); }
}
function voiceCacheName(text) {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 16) + '.mp3';
}
function synthChunks(text) {
  if (text.length <= 200) return [text];
  const parts = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + ' ' + p).trim().length > 200 && cur) { chunks.push(cur.trim()); cur = p; }
    else cur = (cur + ' ' + p).trim();
  }
  if (cur) chunks.push(cur.trim());
  return chunks.length ? chunks : [text];
}
async function fetchGtts(chunk) {
  if (typeof fetch === 'undefined') throw new Error('Node quá cũ, không có fetch');
  const r = await fetch('https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=' + encodeURIComponent(chunk), {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  });
  if (!r.ok) throw new Error('Google TTS HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1000) throw new Error('Google TTS trả về quá ngắn');
  return buf;
}
function synthesizeVoice(text) {
  const key = text.trim();
  if (!key) return Promise.resolve(null);
  const hit = voiceSynth.get(key);
  if (hit && hit.status === 'ready') {
    // Câu đã tổng hợp rồi (vd. cảm ơn cùng 1 món quà lặp lại): gắn url
    // vào entry đang chờ — trước đây nhánh này chỉ trả url về mà không
    // gắn, nên câu lặp lại không bao giờ có ttsUrl, overlay chờ đủ 1.5s
    // rồi đọc clip chung (mất tên).
    for (const a of game.announce) if (a.ttsText === key) a.ttsUrl = hit.url;
    return Promise.resolve(hit.url);
  }
  if (hit && hit.status === 'pending') return hit.promise;
  const file = voiceCacheName(key);
  const diskPath = path.join(VOICE_CACHE_DIR, file);
  if (fs.existsSync(diskPath) && fs.statSync(diskPath).size > 1000) {
    const url = ctx.roomPrefix + '/voice/cache/' + file;
    voiceSynth.set(key, { status: 'ready', url });
    // BUG v6: nhánh này từng chỉ trả url về mà KHÔNG gắn vào entry announce
    // đang chờ (chỉ nhánh fetch mới gắn) -> sau khi khởi động lại server,
    // câu đã có trong cache đĩa thì ttsUrl mãi null, overlay đọc clip dự
    // phòng chung (không tên tỉnh) thay vì câu đã tổng hợp. Gắn luôn ở đây.
    for (const a of game.announce) if (a.ttsText === key) a.ttsUrl = url;
    return Promise.resolve(url);
  }
  const promise = (async () => {
    await synthSlot();
    try {
      const bufs = [];
      for (const c of synthChunks(key)) bufs.push(await fetchGtts(c));
      fs.writeFileSync(diskPath, Buffer.concat(bufs));
      // (v8) Chuẩn hóa âm lượng về -16 LUFS như clip cố định — file thô
      // của Google TTS to/nhỏ thất thường nên voice lúc to lúc nhỏ (nghe
      // không trơn). Best-effort: máy live không có ffmpeg thì giữ file
      // thô (vẫn đọc được, chỉ không đều âm lượng).
      await new Promise((res) => {
        execFile('ffmpeg', ['-y', '-v', 'error', '-i', diskPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', diskPath + '.norm.mp3'], { timeout: 15000 }, (err) => {
          if (!err) { try { fs.renameSync(diskPath + '.norm.mp3', diskPath); } catch {} }
          else { try { fs.unlinkSync(diskPath + '.norm.mp3'); } catch {} }
          res();
        });
      });
      pruneVoiceCache();
      const url = ctx.roomPrefix + '/voice/cache/' + file;
      voiceSynth.set(key, { status: 'ready', url });
      // Gắn url vào câu announce đang chờ (nếu còn trong hàng đợi).
      for (const a of game.announce) if (a.ttsText === key) a.ttsUrl = url;
      return url;
    } catch (e) {
      voiceSynth.set(key, { status: 'failed' });
      setTimeout(() => { if (voiceSynth.get(key)?.status === 'failed') voiceSynth.delete(key); }, 60000);
      log('voice', 'tổng hợp tên thất bại, dùng clip sẵn: ' + e.message);
      return null;
    } finally {
      synthRelease();
    }
  })();
  voiceSynth.set(key, { status: 'pending', promise });
  return promise;
}
function pruneVoiceCache() {
  try {
    const files = fs.readdirSync(VOICE_CACHE_DIR).filter((f) => /\.mp3$/i.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(VOICE_CACHE_DIR, f)).mtimeMs }))
      .sort((a, b) => a.t - b.t);
    while (files.length > 300) {
      const old = files.shift();
      try { fs.unlinkSync(path.join(VOICE_CACHE_DIR, old.f)); } catch {}
    }
  } catch {}
}
// 2 track mặc định là nhạc hộp nhẹ tự tạo (không bản quyền), phát vòng lặp.
// ---------------------------------------------------------------------------
const MUSIC_NAMES = {
  '01-que-huong-xanh.mp3': 'Quê Hương Xanh',
  '02-dat-nuoc-men-yeu.mp3': 'Đất Nước Mến Yêu',
  '03-song-que-em-dem.mp3': 'Sông Quê Êm Đềm',
  '04-dat-nuoc-vuon-xa.mp3': 'Đất Nước Vươn Xa',
  '05-le-hoi-que-huong.mp3': 'Lễ Hội Quê Hương',
  '06-dem-trang-lang-que.mp3': 'Đêm Trăng Làng Quê',
};
function musicTracks() {
  try {
    return fs.readdirSync(path.join(PUBLIC, 'music'))
      .filter((f) => /\.mp3$/i.test(f))
      .sort()
      .map((f) => ({
        file: f,
        url: '/music/' + encodeURIComponent(f),
        name: MUSIC_NAMES[f] || f.replace(/^\d+[-_ ]*/, '').replace(/\.mp3$/i, '').replace(/[-_]/g, ' '),
      }));
  } catch { return []; }
}
const MUSIC_TRACKS = musicTracks();
const game_music = {
  playing: config.musicPlaying !== false,
  trackIndex: 0,
  volume: config.musicVolume ?? 0.35,
};
let roundNo = 1;
const provinces = new Map(); // num -> {lit, litBy, litAt, points, lights}
function freshProvinces() {
  provinces.clear();
  for (const p of PROVINCES) {
    provinces.set(p.num, { lit: false, litBy: null, litAt: 0, points: 0, lights: 0, milestoneIdx: 0, lastWelcomeAt: 0 });
  }
}
freshProvinces();
const game = {
  phase: 'playing', // 'playing' | 'complete'
  completeEndsAt: 0,
  roundEndsAt: Date.now() + (config.gameDurationMin ?? 60) * 60000, // ván đầu bắt đầu lúc mở server
  allLitAt: null,   // (v8) mốc sáng đủ 34/34 trong ván (chỉ là mốc, không hết ván)
  winner: null,     // (v8) {province:{num,name,points}, contributor:{name,points}} khi hết giờ
  viewers: new Map(), // id -> {id, name, home, points, lights, taps, lastCommentAt, followed, lastSeenAt}
  feed: [], // {t, text}
  announce: [], // hàng đợi voice: {id, text} — overlay đọc tuần tự, tối đa giữ 10
  recent: [], // {t, viewer, provinceNum, via} — 3 lần thắp gần nhất
  stats: { totalJoins: 0, totalGifts: 0, totalCoins: 0, totalTaps: 0, totalLights: 0 },
  spotlight: null, // lần thắp mới nhất {t, viewer, avatar, provinceNum, provinceName, fact, via}
  milestoneFlash: null, // mốc vừa vượt {num, threshold, t} — overlay nổ hiệu ứng
  // Đèn báo kết nối TikFinity (v7.1): chỉ đếm sự kiện webhook THẬT từ
  // TikFinity — sự kiện giả lập / gửi tay qua dashboard KHÔNG tính vào đây,
  // để đèn báo phản ánh đúng đường link live có đang chạy hay không.
  // lastRaw (v7.2): body thô của webhook gần nhất (cắt ngắn) — để soi được
  // TikFinity thực sự gửi gì sang, vì có lần nó gửi body rỗng {}.
  webhook: { count: 0, lastAt: 0, lastType: null, lastRaw: '', lastContentType: '' },
};
function pushFeed(text) {
  game.feed.unshift({ t: Date.now(), text });
  if (game.feed.length > 40) game.feed.length = 40;
}
// Voice kiểu Buồng giam: file TTS tạo SẴN trước khi live (public/voice/*.mp3),
// overlay chỉ phát file, KHÔNG dùng giọng trình duyệt, KHÔNG tạo TTS trong
// lúc live (gây trễ tiếng). Mỗi câu announce có text để hiện lên màn hình +
// danh sách clip để phát theo thứ tự (vd. thắp tỉnh cũ: clip giải thích tên
// cũ rồi tới clip tỉnh mới) + mức ưu tiên + câu đọc tên (ttsText).
// ƯU TIÊN VOICE (đọc chọn lọc, không vấp): 1 = tỉnh lần đầu được thắp sáng
// (đọc cả tên người thắp — tổng hợp riêng, cache lại), 2 = mốc điểm / vinh
// danh, 3 = ván mới, 4 = cảm ơn quà/follow / tỉnh đã sáng. Thông báo trên
// MÀN HÌNH vẫn đầy đủ mọi sự kiện, chỉ VOICE là đọc chọn lọc.
// BUG v7.5 (gốc của vụ "live nghe được nhạc mà không nghe voice"): id
// announce từng bắt đầu từ 0, mỗi lần khởi động lại server là đếm lại
// từ 1 — trong khi overlay trong LIVE Studio chạy liên tục, biến
// lastAnnounceId của nó vẫn giữ số id cũ (vd. 47). Câu mới sau restart
// có id 1..10 đều <= 47 nên overlay bỏ qua hết -> voice chết hẳn, nhạc
// vẫn phát (nhạc không dùng id). Khởi đầu bằng Date.now() thì id luôn
// tăng đơn điệu qua mọi lần restart (lần sau luôn lớn hơn lần trước).
let announceSeq = Date.now();
function pushAnnounce(text, clips, opts) {
  if (!text) return;
  const last = game.announce[game.announce.length - 1];
  if (last && last.text === text) return;
  const o = opts || {};
  const entry = { id: ++announceSeq, text, clips: clips || [], priority: o.priority || 4, ttsText: o.ttsText || null, ttsUrl: null };
  game.announce.push(entry);
  if (game.announce.length > 10) game.announce.shift();
  // Câu có tên người xem -> tổng hợp ngay (nền), xong thì gắn url vào entry.
  if (entry.ttsText) synthesizeVoice(entry.ttsText).catch(() => {});
}
function litCount() {
  let n = 0;
  for (const s of provinces.values()) if (s.lit) n++;
  return n;
}
function unlitNums() {
  return PROVINCES.filter((p) => !provinces.get(p.num).lit).map((p) => p.num);
}
function randomUnlit() {
  const u = unlitNums();
  return u.length ? u[Math.floor(Math.random() * u.length)] : null;
}
function viewerIdOf(name) {
  // Tên chuẩn hóa — chỉ dùng làm key DỰ PHÒNG cho sự kiện gửi tay
  // (dashboard/simulator) vốn không có uniqueId. Webhook TikFinity dùng
  // viewerKeyOf bên dưới, không dùng hàm này.
  const n = norm(name || 'khach').replace(/\s+/g, '_');
  return 'u_' + (n || 'khach');
}
// ID người chơi làm cơ sở (v7.9 — FIX CỨNG, thay v7.8): key là uniqueId
// (tên tài khoản @..., vd. "dai_tu_si") — id ổn định, duy nhất mỗi tài
// khoản, có ở mọi loại event (chat/quà/tim/follow). Nickname CHỈ là tên
// hiển thị — nhiều người trùng nhau được, KHÔNG được làm key (v7.8 từng
// gộp mọi cách viết tên về 1 id nên 2 người cùng tên hiển thị sẽ va
// chạm). userId số chỉ dùng khi không có uniqueId, vì không chắc
// TikFinity gửi nó ở mọi loại event nên không được ưu tiên trước.
function viewerKeyOf(data, userObj, ev) {
  const uniqueId = pick(data, ['uniqueId']) || pick(userObj, ['uniqueId']) || pick(ev, ['uniqueId'])
    || pick(data, ['value1']) || pick(ev, ['value1']);
  if (uniqueId) {
    const n = norm(String(uniqueId)).replace(/\s+/g, '_');
    if (n) return 'u_' + n;
  }
  const userId = pick(data, ['userId', 'user_id', 'userID'])
    || pick(userObj, ['userId', 'user_id', 'userID'])
    || pick(ev, ['userId', 'user_id', 'userID']);
  if (userId !== undefined && userId !== null && String(userId) !== '') return 'id_' + String(userId);
  return null; // để getViewer tự rơi về tên chuẩn hóa
}
// Tên hiển thị (có dấu/có khoảng trắng, vd. "Đại Tư Sĩ") khác username
// (vd. "dai_tu_si") — chỉ dùng để hiện/đọc, không phải id.
function isDisplayName(n) { return /[\s\u00C0-\u024F\u1E00-\u1EFF]/.test(n || ''); }
function getViewer(name, avatar, key) {
  const id = key || viewerIdOf(name);
  let v = game.viewers.get(id);
  if (!v && !key) {
    // Sự kiện gửi tay (dashboard/simulator) chỉ có tên hiển thị — không
    // có uniqueId: tìm người có tên hiển thị trùng (chuẩn hóa) để khỏi
    // tạo nhầm người mới (vd. gõ "Lan" phải trúng viewer uniqueId
    // "lan_01" đã vào live bằng webhook). Nhánh này CHỈ chạy khi không
    // có key — webhook luôn có key nên không bao giờ khớp nhầm bằng tên.
    const nn = norm(name || '');
    if (nn) for (const cand of game.viewers.values()) {
      if (norm(cand.name) === nn) { v = cand; break; }
    }
  }
  if (!v) {
    // Tên qua bộ lọc từ: tên chứa link/spam/chửi -> hiện/đọc là "Bạn".
    v = { id, name: cleanName(name || 'Khách'), avatar: null, home: null, points: 0, lights: 0, taps: 0, coins: 0, gifts: 0, lastCommentAt: 0, followed: false, lastSeenAt: Date.now(), lastLikeTotal: 0, homeChanges: 0, homeChangeWarned: false, bankedPoints: 0, left: false, leftAt: 0 };
    game.viewers.set(id, v);
  }
  // Cập nhật tên hiển thị: lần đầu chỉ gặp username (quà đến trước
  // chat) thì đổi lại thành nickname khi có — nhưng không bao giờ để
  // username đè nickname đã có.
  const incoming = cleanName(name || '');
  if (incoming && incoming !== v.name && isDisplayName(incoming) && !isDisplayName(v.name)) v.name = incoming;
  if (avatar) v.avatar = avatar; // avatar thật từ TikTok (nếu webhook có gửi)
  v.lastSeenAt = Date.now();
  return v;
}

// 6 thành phố trực thuộc trung ương — voice đọc "Thành phố ...", còn lại
// đọc "Tỉnh ...". Tên "TP. Hồ Chí Minh" bỏ tiền tố "TP." để không đọc lặp.
const CITY_NUMS = new Set([4, 6, 12, 14, 15, 16]);
function provLabel(num) {
  const p = byNum.get(num);
  if (!p) return '';
  const name = p.name.replace(/^TP\.\s*/, '');
  return (CITY_NUMS.has(num) ? 'Thành phố ' : 'Tỉnh ') + name;
}

// Cộng điểm cho tỉnh (đi qua đây để bắt mốc điểm 50/100/200).
function addProvincePoints(num, n, viewer) {
  if (!n) return;
  const st = provinces.get(num);
  if (!st) return;
  st.points += n;
  if (viewer) viewer.points += n;
  const ms = config.milestonePoints || [];
  while (st.milestoneIdx < ms.length && st.points >= ms[st.milestoneIdx]) {
    const th = ms[st.milestoneIdx];
    st.milestoneIdx += 1;
    const p = byNum.get(num);
    const label = provLabel(num);
    game.milestoneFlash = { num, threshold: th, t: Date.now() };
    pushFeed(`🏆 ${label} đã đạt mốc ${th} điểm!`);
    pushAnnounce(`${label}, đã đạt mốc điểm ${th}! Cả phòng cùng cổ vũ cho ${p.name} nào!`, ['milestone'], { priority: 2, ttsText: `${label}, đã đạt mốc điểm ${th}!` });
    log('milestone', `${label} đạt ${th} điểm`);
  }
}

// Thắp 1 tỉnh. Trả về 'lit' (mới sáng) / 'repeat' (đã sáng) / null (không thắp được).
// Điểm KHÔNG cộng ở đây — điểm theo tỉnh do từng handler cộng (comment/tap/quà).
function lightProvince(num, viewer, via) {
  if (game.phase !== 'playing') return null;
  const st = provinces.get(num);
  const p = byNum.get(num);
  if (!st || !p) return null;
  if (st.lit) return 'repeat';
  st.lit = true;
  st.litBy = viewer ? viewer.name : 'Hệ thống';
  st.litAt = Date.now();
  st.lights += 1;
  game.stats.totalLights += 1;
  if (viewer) {
    viewer.lights += 1;
    // v7.7: KHÔNG tự gán quê ở đây nữa. Trước đây quà/follow thắp ngẫu
    // nhiên 1 tỉnh thì lấy luôn tỉnh đó làm quê của người tặng — nên ai
    // tặng quà khi chưa comment quê thì quà cộng điểm vào tỉnh ngẫu nhiên
    // (vd. Gia Lai) thay vì quê thật của họ (vd. Thanh Hóa). Quê chỉ do
    // chính người chơi comment chọn (onChat), quà/follow không bao giờ
    // tự gán quê.
  }
  game.recent.unshift({ t: Date.now(), viewer: viewer ? viewer.name : 'Hệ thống', provinceNum: num, via });
  if (game.recent.length > 3) game.recent.length = 3;
  // Spotlight: thẻ "ai vừa thắp tỉnh nào" cho overlay hiện to giữa màn hình.
  game.spotlight = {
    t: Date.now(), viewer: viewer ? viewer.name : 'Hệ thống',
    avatar: viewer ? viewer.avatar : null,
    provinceNum: num, provinceName: p.name,
    fact: PROVINCE_FACTS[num] || '', via,
  };
  pushFeed(`✨ ${viewer ? viewer.name : 'Hệ thống'} đã thắp sáng ${p.name}! (${via})`);
  // (v8.1) Quần đảo sáng cùng tỉnh chủ quản + voice thông báo (tỉnh nào
  // thắp lần đầu thì đảo của tỉnh đó sáng theo, đọc thành tiếng). Câu cố
  // định (không tên người) nên tổng hợp 1 lần rồi cache lại dùng tiếp.
  if (num === 6) pushAnnounce('Quần đảo Hoàng Sa cũng sáng cùng Đà Nẵng!', [], { priority: 2, ttsText: 'Quần đảo Hoàng Sa cũng sáng cùng Đà Nẵng!' });
  if (num === 18) pushAnnounce('Quần đảo Trường Sa cũng sáng cùng Khánh Hòa!', [], { priority: 2, ttsText: 'Quần đảo Trường Sa cũng sáng cùng Khánh Hòa!' });
  log('light', `${viewer ? viewer.name : 'system'} -> ${p.name} (${via}) — ${litCount()}/34`);
  checkAllLitMilestone();
  return 'lit';
}
function lightRandom(viewer, via, count = 1, points = 0) {
  const litNums = [];
  for (let i = 0; i < count; i++) {
    const num = randomUnlit();
    if (num === null) break;
    if (lightProvince(num, viewer, via) === 'lit') {
      litNums.push(num);
      if (points > 0) addProvincePoints(num, points, viewer);
    }
  }
  return litNums;
}
function topLighter() {
  return [...game.viewers.values()].filter((v) => v.points > 0).sort((a, b) => b.points - a.points)[0] || null;
}
// (v8) Sáng đủ 34/34 chỉ là 1 MỐC trong ván — ăn mừng 1 lần rồi chơi
// tiếp, KHÔNG kết thúc ván (khác v7 trở về trước: sáng đủ là hết ván).
function checkAllLitMilestone() {
  if (game.phase === 'playing' && litCount() >= 34 && !game.allLitAt) {
    game.allLitAt = Date.now();
    pushFeed('🎉 CẢ NƯỚC ĐÃ SÁNG 34/34! Mốc lớn đã đạt — cuộc đua điểm vẫn tiếp tục tới hết giờ!');
    pushAnnounce('Cả nước đã sáng rồi! Mốc lớn đã đạt, cuộc đua điểm vẫn tiếp tục tới hết giờ!', ['complete'], { priority: 2, ttsText: 'Cả nước đã sáng rồi! Mốc lớn đã đạt, cuộc đua điểm vẫn tiếp tục tới hết giờ!' });
    log('game', 'MỐC 34/34 đã đạt (ván tiếp tục)');
  }
}
// (v8) Hết giờ ván: tỉnh điểm cao nhất thắng (hòa -> nhiều lượt thắp hơn,
// rồi tới thắp sớm hơn); người đóng góp nhiều nhất (điểm cá nhân cao nhất)
// cũng được vinh danh. Sau đó phase 'complete', tự chơi lại sau autoResetSeconds.
function topProvince() {
  const arr = PROVINCES.map((p) => ({ ...provinces.get(p.num), num: p.num, name: p.name }));
  arr.sort((a, b) => (b.points - a.points) || (b.lights - a.lights) || ((a.litAt || 0) - (b.litAt || 0)));
  return arr[0] && arr[0].points > 0 ? arr[0] : null;
}
function endRound() {
  if (game.phase !== 'playing') return;
  game.phase = 'complete';
  game.completeEndsAt = Date.now() + config.autoResetSeconds * 1000;
  const wp = topProvince();
  const top = topLighter();
  game.winner = {
    province: wp ? { num: wp.num, name: wp.name, points: wp.points, lights: wp.lights } : null,
    contributor: top ? { name: top.name, points: top.points, lights: top.lights } : null,
  };
  pushFeed(`⏰ HẾT GIỜ! ${wp ? `🏆 Tỉnh chiến thắng: ${wp.name} (${wp.points} điểm)!` : 'Chưa tỉnh nào có điểm.'} ${top ? `🌟 Người đóng góp nhiều nhất: ${top.name} (${top.points} điểm)!` : ''} Ván mới sau ${config.autoResetSeconds}s!`);
  pushAnnounce(wp ? `Hết giờ! Tỉnh chiến thắng là ${wp.name}, với ${wp.points} điểm! ${top ? `Vinh danh ${top.name}, người đóng góp nhiều nhất, với ${top.points} điểm!` : ''}` : 'Hết giờ! Ván mới sắp bắt đầu!', ['complete'], { priority: 2, ttsText: wp ? `Hết giờ! Tỉnh chiến thắng là ${wp.name}, với ${wp.points} điểm! ${top ? `Vinh danh ${top.name}, người đóng góp nhiều nhất, với ${top.points} điểm!` : ''}` : 'Hết giờ! Ván mới sắp bắt đầu!' });
  log('game', `HẾT GIỜ — tỉnh thắng: ${wp ? wp.name + ' ' + wp.points + 'đ' : 'không có'}; top đóng góp: ${top ? top.name : 'không có'}`);
}
function resetRound() {
  freshProvinces();
  game.phase = 'playing';
  game.completeEndsAt = 0;
  game.roundEndsAt = Date.now() + (config.gameDurationMin ?? 60) * 60000;
  game.allLitAt = null;
  game.winner = null;
  game.recent = [];
  game.spotlight = null;
  game.milestoneFlash = null;
  for (const v of game.viewers.values()) { v.points = 0; v.lights = 0; v.home = null; v.taps = 0; v.coins = 0; v.gifts = 0; v.homeChanges = 0; v.homeChangeWarned = false; v.bankedPoints = 0; v.left = false; v.leftAt = 0; }
  roundNo += 1;
  pushFeed(`🗺️ Ván ${roundNo} bắt đầu! Comment tên quê để thắp sáng!`);
  pushAnnounce('Ván mới bắt đầu! Comment tên quê để thắp sáng bản đồ Việt Nam!', ['new-round'], { priority: 3 });
  log('game', `ván ${roundNo} bắt đầu`);
}

// ---------------------------------------------------------------------------
// Xử lý sự kiện (dùng chung cho webhook TikFinity, dashboard, simulator)
// ---------------------------------------------------------------------------
function onJoin(name, key) {
  const v = getViewer(name, null, key);
  // Vào lại live: bỏ cờ "đã rời" (avatar vẫn neo ở quê từ trước).
  v.left = false; v.leftAt = 0;
  game.stats.totalJoins += 1;
  pushFeed(`👋 ${v.name} vào xem live! Gõ tên quê để thắp sáng bản đồ!`);
}
// (2026-11-12) Rời live: avatar VẪN NEO ở tỉnh quê tới hết ván — chỉ ghi
// cờ "đã rời", KHÔNG xóa viewer, KHÔNG xóa quê/điểm/avatar. Chỉ resetRound
// (hết ván) mới dọn. Vào lại live (onJoin) thì bỏ cờ.
function onLeave(name, key) {
  const v = getViewer(name, null, key);
  v.left = true; v.leftAt = Date.now();
  log('leave', `${v.name} rời live — avatar vẫn neo ở ${v.home ? byNum.get(v.home).name : 'chưa chọn quê'} tới hết ván`);
}
function onChat(name, text, avatar, key) {
  if (game.phase !== 'playing') return;
  const v = getViewer(name, avatar, key);
  const matches = parseProvinces(text, config.maxProvincesPerComment);
  if (!matches.length) return;
  const now = Date.now();
  if (now - v.lastCommentAt < config.commentCooldownSec * 1000) return; // chống spam
  v.lastCommentAt = now;
  // QUÊ — CHỐNG SPAM CỨNG (v7.4, thay luật v7.3 "quê = comment gần nhất"
  // không giới hạn): mỗi người chơi trong 1 ván chỉ được đổi quê tối đa
  // `maxHomeChangesPerRound` lần (mặc định 1). Comment đầu tiên chọn quê
  // (không tính lượt đổi); comment tỉnh khác dùng 1 lượt đổi; hết lượt
  // thì comment tỉnh khác KHÔNG thắp sáng cũng KHÔNG cộng điểm — chỉ
  // comment đúng tỉnh quê hiện tại mới tính (vẫn +1đ, vẫn farm mốc).
  // Chỉ giới hạn đổi quê thôi thì chưa đủ, vì code cũ comment tỉnh nào
  // là thắp luôn tỉnh đó — 1 người gõ tên hết các tỉnh là sáng nhanh
  // cả bản đồ. Với luật này mỗi người tối đa thắp 2 tỉnh/ván (quê đầu
  // + 1 lần đổi), bản đồ chỉ đầy khi nhiều người cùng chơi. Điểm tỉnh
  // đã tích ở tỉnh cũ vẫn giữ nguyên (điểm thuộc về tỉnh).
  const target = matches[0].num;
  let justJoined = false; // vừa mới chọn tỉnh này làm quê trong comment này
  if (!v.home) {
    v.home = target; justJoined = true; // chọn quê lần đầu
    // Điểm quà đã tặng trước khi chọn quê (v7.7): trả về quê vừa chọn.
    if (v.bankedPoints > 0) {
      const b = v.bankedPoints; v.bankedPoints = 0;
      addProvincePoints(v.home, b, v);
      pushFeed(`💰 ${v.name} chọn quê ${byNum.get(v.home).name} — nhận ${b} điểm quà đã tặng trước đó!`);
    }
  } else if (target !== v.home) {
    if (v.homeChanges < (config.maxHomeChangesPerRound ?? 1)) {
      v.homeChanges += 1;
      v.home = target; justJoined = true; // dùng 1 lượt đổi quê (avatar bay sang tỉnh mới)
    } else if (!v.homeChangeWarned) {
      v.homeChangeWarned = true; // báo 1 lần/ván/người để khỏi spam feed
      pushFeed(`🔒 ${v.name} đã hết lượt đổi quê trong ván này (đã đổi ${config.maxHomeChangesPerRound ?? 1} lần), ở lại ${byNum.get(v.home).name}!`);
    }
  }
  for (const mt of matches) {
    if (mt.num !== v.home) continue; // chỉ tỉnh quê hiện tại mới được thắp
    const res = lightProvince(mt.num, v, 'comment');
    const p = byNum.get(mt.num);
    addProvincePoints(v.home, config.pointsPerComment, v);
    const fact = PROVINCE_FACTS[mt.num] ? `, ${PROVINCE_FACTS[mt.num]}` : '';
    if (res === 'lit') {
      const provClip = 'prov-' + String(mt.num).padStart(2, '0');
      const sentence = mt.isOld
        ? `${OLD_DISPLAY[mt.alias]} nay đã sáp nhập vào ${p.name}. ${v.name}, đã thắp sáng ${p.name}${fact}!`
        : `${v.name}, đã thắp sáng ${p.name}${fact}!`;
      if (mt.isOld) {
        // Voice giải thích tên cũ -> tỉnh mới đã sáp nhập: 2 clip nối nhau.
        const oldClip = 'old-' + mt.alias.replace(/ /g, '-');
        pushAnnounce(sentence, [oldClip, provClip], { priority: 1, ttsText: sentence });
      } else {
        pushAnnounce(sentence, [provClip], { priority: 1, ttsText: sentence });
      }
    } else if (res === 'repeat' && mt.isOld) {
      pushAnnounce(`${OLD_DISPLAY[mt.alias]} nay thuộc ${p.name}, tỉnh này đã sáng rồi!`, ['old-' + mt.alias.replace(/ /g, '-'), 'already-lit'], { priority: 4 });
    } else if (res === 'repeat' && justJoined) {
      // Người mới vào tỉnh đã sáng: chào mừng kiểu "Thêm một người con
      // xứ Thanh nữa đã cùng chung tay thắp sáng quê hương..." (Chủ tịch
      // 2026-11-13). Chống spam voice: mỗi tỉnh tối đa 1 câu chào / 15
      // giây — comment vẫn +1đ bình thường dù không đọc.
      const pst = provinces.get(mt.num);
      if (Date.now() - (pst.lastWelcomeAt || 0) >= 15000) {
        pst.lastWelcomeAt = Date.now();
        const sentence = `Thêm một người con ${xuName(mt.num, p.name)} nữa đã cùng chung tay thắp sáng quê hương, cảm ơn ${v.name}!`;
        pushAnnounce(sentence, [], { priority: 4, ttsText: sentence });
      }
    }
  }
}
function onLike(name, totalCount, avatar, key) {
  // TikFinity gửi likeCount là TỔNG TÍCH LŨY của người đó từ đầu live,
  // KHÔNG phải số tap mới — cộng trực tiếp sẽ phồng điểm theo cấp số cộng
  // (vd. tap 1000 lần thật -> cộng dồn 1+2+...+1000 = 500.500 tap, ra hàng
  // chục nghìn điểm cho 1 tỉnh). Đổi sang delta: chỉ cộng phần tăng thêm
  // so với lần trước của chính người đó.
  const v = getViewer(name, avatar, key);
  const total = Number(totalCount) || 0;
  const delta = total > v.lastLikeTotal ? Math.min(total - v.lastLikeTotal, 5000) : 0;
  v.lastLikeTotal = Math.max(v.lastLikeTotal, total);
  if (delta >= 100) log('like', `${v.name} like tổng ${total}, +${delta} tap mới`);
  if (delta > 0) addTaps(name, delta, avatar, key);
}
// Tap mới (delta) — dùng cho giả lập + /api/event (đã là số tap mới).
function addTaps(name, delta, avatar, key) {
  if (game.phase !== 'playing') return;
  const v = getViewer(name, avatar, key);
  game.stats.totalTaps += delta;
  if (!v.home) return; // chưa chọn quê thì tim chưa tính điểm (không cộng dồn)
  v.taps += delta;
  const n = Math.floor(v.taps / config.tapsPerPoint);
  if (n > 0) {
    v.taps -= n * config.tapsPerPoint;
    addProvincePoints(v.home, n, v);
    if (n >= 5) pushFeed(`❤️ ${v.name} +${n} điểm cho ${byNum.get(v.home).name}!`);
  }
}
function onFollow(name, avatar, key) {
  if (game.phase !== 'playing') return;
  const v = getViewer(name, avatar, key);
  if (v.followed) return;
  v.followed = true;
  const num = randomUnlit();
  if (num !== null) {
    lightProvince(num, v, 'follow');
    pushFeed(`➕ ${v.name} follow kênh — thắp sáng ${byNum.get(num).name}!`);
    pushAnnounce(`Cảm ơn ${v.name} đã follow, thắp sáng ${byNum.get(num).name}!`, ['thanks-follow'], { priority: 4, ttsText: `Cảm ơn ${v.name} đã follow, thắp sáng ${byNum.get(num).name}!` });
  }
}
function onGift(name, giftName, coins, avatar, key) {
  if (game.phase !== 'playing') return;
  const v = getViewer(name, avatar, key);
  game.stats.totalGifts += 1;
  game.stats.totalCoins += coins;
  v.coins += coins;
  v.gifts += 1;
  // Điểm xu cộng cho tỉnh quê của người tặng. Quê là quê HIỆN TẠI, do
  // chính người chơi comment chọn — quà KHÔNG tự gán quê (v7.7: trước
  // đây thắp ngẫu nhiên trước rồi lấy tỉnh vừa thắp làm quê, nên điểm
  // rơi vào tỉnh ngẫu nhiên thay vì quê thật). Chưa có quê thì điểm
  // được GIỮ LẠI (bankedPoints), comment chọn quê sau sẽ nhận đủ.
  let tiers = 1;
  for (const [min, count] of config.giftLightTiers) if (coins >= min) tiers = count;
  const litNums = lightRandom(v, `quà ${giftName} ${coins} xu`, tiers);
  const lit = litNums.length;
  const home = v.home;
  const pts = coins * config.pointsPerCoin;
  if (home) addProvincePoints(home, pts, v);
  else v.bankedPoints = (v.bankedPoints || 0) + pts;
  if (coins >= 100 || lit > 0) {
    pushFeed(`🎁 ${v.name} tặng ${giftName} (${coins} xu) — thắp ${lit} tỉnh${home ? `, +${pts} điểm cho ${byNum.get(home).name}` : `, +${pts} điểm đang chờ quê (comment tên quê để nhận)`}!`);
  }
  if (home) {
    pushAnnounce(`Cảm ơn ${v.name} đã tặng ${giftName} ${coins} xu, cộng ${pts} điểm cho ${byNum.get(home).name}!`, ['thanks-gift'], { priority: 2, ttsText: `Cảm ơn ${v.name} đã tặng ${giftName} ${coins} xu, cộng ${pts} điểm cho ${byNum.get(home).name}!` });
  } else if (lit > 0) {
    pushAnnounce(`Cảm ơn ${v.name} đã tặng ${giftName} ${coins} xu, thắp sáng ${litNums.map((n) => byNum.get(n).name).join(', ')}! Bạn chưa chọn quê — comment tên quê để nhận ${pts} điểm nhé!`, ['thanks-gift'], { priority: 2, ttsText: `Cảm ơn ${v.name} đã tặng ${giftName} ${coins} xu! Bạn chưa chọn quê, comment tên quê để nhận ${pts} điểm nhé!` });
  }
  log('gift', `${v.name} ${giftName} ${coins}xu -> thắp ${lit} tỉnh, quê ${home ? byNum.get(home).name : 'chưa có'} +${pts}đ`);
}

// ---------------------------------------------------------------------------
// Public state
// ---------------------------------------------------------------------------
function topProvinces(n = 5) {
  // Bảng xếp hạng LUÔN hiện đủ 5 tỉnh điểm cao nhất (kể cả tỉnh chưa sáng, 0đ, mờ đi).
  return PROVINCES
    .map((p) => ({ num: p.num, name: p.name, short: p.short, lit: provinces.get(p.num).lit, points: provinces.get(p.num).points, lights: provinces.get(p.num).lights, litBy: provinces.get(p.num).litBy }))
    .sort((a, b) => b.points - a.points || b.lights - a.lights || a.num - b.num)
    .slice(0, n);
}
function topLighters(n = 5) {
  return [...game.viewers.values()].filter((v) => v.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, n)
    .map((v) => ({ name: v.name, avatar: v.avatar, points: v.points, lights: v.lights, home: v.home ? byNum.get(v.home).name : null }));
}
function topGifters(n = 5) {
  return [...game.viewers.values()].filter((v) => v.coins > 0)
    .sort((a, b) => b.coins - a.coins)
    .slice(0, n)
    .map((v) => ({ name: v.name, avatar: v.avatar, coins: v.coins, gifts: v.gifts, home: v.home ? byNum.get(v.home).name : null }));
}
function publicState() {
  const now = Date.now();
  const lit = litCount();
  const suggestions = unlitNums().sort(() => Math.random() - 0.5).slice(0, 3).map((n) => byNum.get(n).name);
  return {
    phase: game.phase,
    roundNo,
    lit, total: 34,
    msLeft: game.phase === 'complete' ? Math.max(0, game.completeEndsAt - now) : 0,
    msRoundLeft: game.phase === 'playing' ? Math.max(0, (game.roundEndsAt || now) - now) : 0,
    roundEndsAt: game.roundEndsAt || 0,
    durationMin: config.gameDurationMin ?? 60,
    allLitAt: game.allLitAt,
    winner: game.winner,
    provinces: PROVINCES.map((p) => {
      const s = provinces.get(p.num);
      return { num: p.num, name: p.name, short: p.short, lit: s.lit, litBy: s.litBy, points: s.points, lights: s.lights };
    }),
    topProvinces: topProvinces(),
    topLighters: topLighters(),
    topGifters: topGifters(),
    sfx: { enabled: !!config.sfxEnabled },
    spotlight: game.spotlight,
    milestoneFlash: game.milestoneFlash,
    recent: game.recent.map((r) => ({ ...r, provinceName: byNum.get(r.provinceNum)?.name || '' })),
    feed: game.feed.slice(0, 8),
    announce: [...game.announce],
    voice: { enabled: !!config.voiceEnabled, volume: config.voiceVolume ?? 0.9 },
    // Avatar người xem đang đứng ở tỉnh quê của họ (để overlay vẽ avatar rơi vào tỉnh).
    // (2026-11-12) Gửi HẾT người có quê (kể cả đã rời live — avatar neo
    // tới hết ván). Trước đây cắt top 60 theo điểm nên người rời live
    // (ngừng kiếm điểm) có thể rớt khỏi danh sách khi đông người, overlay
    // tưởng họ biến mất nên gỡ avatar. Overlay đã gom >12 người/tỉnh vào
    // badge "+N" nên gửi hết không làm nặng giao diện.
    avatars: [...game.viewers.values()].filter((v) => v.home)
      .sort((a, b) => b.points - a.points)
      .map((v) => ({ id: v.id, name: v.name, avatar: v.avatar, home: v.home, points: v.points })),
    music: { playing: game_music.playing, trackIndex: game_music.trackIndex, volume: game_music.volume, tracks: MUSIC_TRACKS },
    suggestions,
    viewers: game.viewers.size,
    stats: { ...game.stats },
    simulator: simOn,
    demoActive,
    // Trạng thái đường link TikFinity (v7.1): overlay + dashboard dùng để vẽ
    // đèn báo. secondsAgo = null khi chưa từng nhận sự kiện nào.
    webhook: {
      count: game.webhook.count,
      lastAt: game.webhook.lastAt,
      lastType: game.webhook.lastType,
      secondsAgo: game.webhook.lastAt ? Math.round((now - game.webhook.lastAt) / 1000) : null,
      lastRaw: game.webhook.lastRaw || '',
      lastContentType: game.webhook.lastContentType || '',
    },
  };
}

// ---------------------------------------------------------------------------
// SSE + simulator
// ---------------------------------------------------------------------------
const sseClients = new Set();
function broadcast() {
  const data = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}
setInterval(broadcast, 500);
setInterval(() => {
  if (game.phase === 'complete' && Date.now() >= game.completeEndsAt) resetRound();
  // (v8) Hết giờ ván -> tính tỉnh thắng + người đóng góp nhất.
  if (game.phase === 'playing' && game.roundEndsAt && Date.now() >= game.roundEndsAt) endRound();
}, 500);

let simOn = config.simulator;
let demoActive = false; // demo loop qua /api/test/demo (demo-mode-contract.md)
let simTimer = null;
const SIM_NAMES = ['AnNhien', 'BaoTran', 'MinhKhang', 'ThuHa', 'DucAnh', 'LinhChi', 'QuocBao', 'PhuongAnh', 'HoangNam', 'KhanhLinh', 'TuanKiet', 'MyDuyen', 'GiaHuy', 'NgocTram'];
const SIM_PROVINCES = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Nghệ An', 'Thanh Hóa', 'Hải Phòng', 'Cần Thơ', 'Đắk Lắk', 'Khánh Hòa', 'Quảng Ninh', 'thu do', 'tphcm', 'hoi an', 'nam dinh', 'phu quoc', 'da lat', 'sai gon', 'hue', 'vinh long', 'ca mau'];
const SIM_GIFTS = [{ name: 'Hoa hồng', coins: 1 }, { name: 'Trái tim', coins: 5 }, { name: 'Bánh kem', coins: 20 }, { name: 'Vương miện', coins: 199 }, { name: 'Sư tử', coins: 500 }];
function simStep(force) {
  if (!force && !simOn) return;
  const r = Math.random();
  const name = SIM_NAMES[Math.floor(Math.random() * SIM_NAMES.length)];
  if (r < 0.45) onChat(name, SIM_PROVINCES[Math.floor(Math.random() * SIM_PROVINCES.length)]);
  else if (r < 0.65) addTaps(name, 30 + Math.floor(Math.random() * 120));
  else if (r < 0.85) { const g = SIM_GIFTS[Math.floor(Math.random() * SIM_GIFTS.length)]; onGift(name, g.name, g.coins); }
  else if (r < 0.93) onFollow(name);
  else onJoin(name);
  broadcast();
}
function setSimulator(on) {
  simOn = on;
  config.simulator = on;
  if (on && !simTimer) simTimer = setInterval(simStep, 1200);
  if (!on && simTimer) { clearInterval(simTimer); simTimer = null; }
  log('sim', on ? 'bật giả lập' : 'tắt giả lập');
}
if (simOn) setSimulator(true);

// ---------------- Demo tu dong (demo-mode-contract.md) ----------------
// Tai dung vong lap gia lap co san (simStep moi 1.2s): start/stop chi bat/tat
// no + gan co demoActive. Tu choi khi phong da co event that; event that dau
// tien toi thi tu dung (xem handleTikFinityEvent).
function startDemo() {
  if (game.webhook.count > 0) return { success: false, message: 'Phòng đang có event thật — không bật được demo.' };
  if (demoActive) return { success: true, demoActive: true };
  setSimulator(true);
  demoActive = true;
  log('demo', 'Demo tự động BẬT — đang mô phỏng khán giả (tự dừng khi có event thật).');
  broadcast();
  return { success: true, demoActive: true };
}
function stopDemo(reason) {
  if (!demoActive) return { success: true, demoActive: false };
  setSimulator(false);
  demoActive = false;
  log('demo', 'Demo tự động TẮT' + (reason ? ` (${reason})` : '') + '.');
  broadcast();
  return { success: true, demoActive: false };
}

// ---------------------------------------------------------------------------
// Webhook TikFinity: parse linh hoạt (TikFinity đổi tên field theo bản).
// Không bao giờ crash vì 1 event lạ — log lại rồi bỏ qua.
// ---------------------------------------------------------------------------
function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}
// Avatar thật của viewer (nếu TikFinity gửi kèm). TikFinity gửi link ảnh đại
// diện trong mỗi event — field `profilePictureUrl` (xem tài liệu TikFinity /
// tiktok-live-connector: event chat/gift/like đều có profilePictureUrl dạng
// https://p16-sign-*.tiktokcdn.com/...). Nhiều dạng field khác nhau theo bản
// TikFinity nên đọc rộng: string URL, {url}, {urls:[...]}, mảng URL.
// Không có thì trả null (overlay vẽ vòng tròn chữ cái thay thế — chỉ là
// dự phòng khi event thiếu avatar, KHÔNG phải avatar mặc định).
function extractAvatar(data, userObj) {
  // TikFinity gửi avatar thật qua field `avatar_url` (snake_case) — từng
  // thiếu key này nên avatar toàn rơi về vòng tròn chữ cái (v7.3).
  const keys = ['profilePictureUrl', 'profilePicturUrl', 'profilePictureUrls',
    'avatar', 'profilePicture', 'avatarUrl', 'avatar_url', 'avatarURL',
    'profile_picture_url', 'profilePicUrl', 'avatarThumb', 'chatimg'];
  const holders = [data, userObj, data && data.user, userObj && userObj.user,
    data && data.userDetails, userObj && userObj.userDetails];
  for (const h of holders) {
    if (!h) continue;
    for (const k of keys) {
      const c = h[k];
      if (!c) continue;
      if (typeof c === 'string' && c.startsWith('http')) return c;
      if (Array.isArray(c) && c.length && typeof c[c.length - 1] === 'string') return c[c.length - 1];
      if (typeof c === 'object') {
        if (typeof c.url === 'string' && c.url.startsWith('http')) return c.url;
        if (Array.isArray(c.urls) && c.urls.length) return c.urls[c.urls.length - 1];
        if (Array.isArray(c.urlList) && c.urlList.length) return c.urlList[0];
      }
    }
  }
  return null;
}
// Đọc body thô (chuỗi) của webhook — KHÔNG JSON.parse ngay, vì TikFinity
// từng gửi body mà JSON.parse không ăn (log chỉ còn {}), cần soi được chuỗi
// gốc trước khi đoán định dạng.
function readRawBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => resolve(raw));
    req.on('error', () => resolve(raw));
  });
}
// Phân tích body webhook theo nhiều định dạng có thể gặp (v7.2):
// JSON object | JSON string (mã hóa 2 lớp) | form-urlencoded | chuỗi thô.
// Trả về { body, empty, note } — body là object đã phân tích (hoặc {}).
function parseWebhookBody(raw) {
  if (!raw || !raw.trim()) return { body: {}, empty: true, note: 'body rỗng' };
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === 'object') return { body: j, empty: false, note: 'json' };
    if (typeof j === 'string') {
      try { const j2 = JSON.parse(j); if (j2 && typeof j2 === 'object') return { body: j2, empty: false, note: 'json-string-2-lop' }; } catch {}
      return { body: {}, empty: false, note: 'json-string-khong-phai-object' };
    }
    return { body: {}, empty: false, note: 'json-khong-phai-object' };
  } catch {}
  try {
    const params = new URLSearchParams(raw);
    const obj = {};
    let any = false;
    for (const [k, v] of params) {
      any = true;
      try { const pv = JSON.parse(v); obj[k] = (pv && typeof pv === 'object') ? pv : v; }
      catch { obj[k] = v; }
    }
    if (any) return { body: obj, empty: false, note: 'form-urlencoded' };
  } catch {}
  return { body: {}, empty: false, note: 'chuoi-tho-khong-phan-tich-duoc' };
}

function handleTikFinityEvent(body, qEvent) {
  // Body có thể là chuỗi (JSON 2 lớp chưa parse hết) — parse nốt.
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  }
  const ev = body || {};
  // qEvent = ?event= tren URL webhook (co che TikFinity moi): loai su kien
  // khong nam trong form, phai lay tu query — uu tien truoc cac field trong body.
  const rawType = String(qEvent || pick(ev, ['event', 'type', 'eventType', 'eventName', 'event_name', 'msgType', 'action']) || '').toLowerCase();
  // Đèn báo (v7.1): ghi nhận NGAY khi webhook tới, kể cả event lạ chưa nhận
  // ra — chỉ cần TikFinity gửi được tới server là link đã sống.
  game.webhook.count++;
  if (demoActive) stopDemo('có event thật');
  game.webhook.lastAt = Date.now();
  const data = ev.data || ev.payload || ev.eventData || ev;
  const userObj = data.user || ev.user || {};
  // Tên: TikFinity gửi form value1=username (uniqueId) — dùng làm dự phòng
  // khi body không có nickname/displayName.
  const name =
    pick(data, ['nickname', 'uniqueId', 'displayName', 'username']) ||
    pick(userObj, ['nickname', 'uniqueId', 'displayName', 'username']) ||
    pick(ev, ['nickname', 'uniqueId', 'displayName', 'username']) ||
    pick(data, ['value1']) || 'Khách';
  const avatar = extractAvatar(data, userObj);
  // ID người chơi làm cơ sở (v7.9): uniqueId/value1 là tên tài khoản —
  // id ổn định, duy nhất mỗi người, có ở mọi loại event. Nickname chỉ
  // là tên hiển thị (đã lấy ở biến `name` trên) — KHÔNG làm key.
  const key = viewerKeyOf(data, userObj, ev);
  // Chuẩn hóa dạng form của TikFinity (v7.3, thấy từ log live thật):
  // value1=username, value2=nội dung chính (comment / tên quà),
  // value3=giá trị phụ (số xu quà), content=nội dung comment,
  // avatar_url=avatar thật.
  const value2 = typeof data.value2 === 'string' ? data.value2.replace(/^content=/, '') : undefined;
  const value3num = (typeof data.value3 === 'string' && data.value3.trim() !== '' && !isNaN(Number(data.value3)))
    ? Number(data.value3) : undefined;
  const commentText = pick(data, ['comment', 'text', 'content', 'message'])
    ?? (value2 && value2.length > 0 ? value2 : undefined);
  const giftNameNorm = pick(data, ['giftName', 'gift_name']) || pick(data.gift || {}, ['name', 'giftName'])
    || (value3num !== undefined && value2 ? value2 : undefined);
  const coinsNorm = pick(data, ['diamondCount', 'coins', 'diamond_count']) ?? value3num;
  const likeTotalNorm = pick(data, ['totalLikeCount', 'likeCount']);
  let isGift = rawType.includes('gift');
  let isChat = rawType.includes('chat') || rawType.includes('comment');
  let isLike = rawType.includes('like') || rawType.includes('tap');
  let isFollow = rawType.includes('follow');
  let isShare = rawType.includes('share');
  let isJoin = rawType.includes('join') || rawType.includes('member');
  // Rời live: "leave" / "member leave" / "member_left" — kiểm tra TRƯỚC
  // isJoin vì chuỗi "member leave" cũng chứa "member" (không thì bị nhận
  // nhầm thành vào phòng). Rời chỉ ghi cờ (xem onLeave), không xóa gì.
  let isLeave = rawType.includes('leave') || rawType.includes('left');
  // Suy luận loại sự kiện từ HÌNH DẠNG dữ liệu (v7.2–v7.3): TikFinity có thể
  // gửi dữ liệu thô không kèm tên loại. Thứ tự: quà → tim → chat (quà kiểm
  // tra trước để tên quà trong value2 không bị nhầm thành comment).
  if (!isGift && !isChat && !isLike && !isFollow && !isJoin) {
    if (giftNameNorm || coinsNorm !== undefined) isGift = true;
    else if (likeTotalNorm !== undefined) isLike = true;
    else if (typeof commentText === 'string' && commentText.length > 0) isChat = true;
  }
  // Loại cuối cùng sau khi suy luận — dashboard hiện loại này (không hiện
  // 'unknown' cho event đã nhận ra qua hình dạng dữ liệu).
  game.webhook.lastType = isGift ? 'gift' : isChat ? 'chat' : isLike ? 'like' : isFollow ? 'follow' : isShare ? 'share' : isLeave ? 'leave' : isJoin ? 'join' : (rawType || 'unknown');
  if (isGift) {
    const giftName = giftNameNorm || 'quà tặng';
    const coins = Number(coinsNorm ?? pick(data.gift || {}, ['diamondCount', 'coins']) ?? 1) || 1;
    const repeat = Number(pick(data, ['repeatCount', 'repeat_count']) || 1) || 1;
    const inStreak = data.giftType === 1 || data.gift?.combo === true;
    if (inStreak && !data.repeatEnd) return 'gift-streak-skip';
    onGift(name, giftName, coins * repeat, avatar, key);
    return 'gift';
  }
  if (isChat) {
    onChat(name, String(commentText ?? ''), avatar, key);
    return 'chat';
  }
  if (isLike) {
    onLike(name, Number(pick(data, ['totalLikeCount', 'likeCount', 'count', 'total']) || 1) || 1, avatar, key);
    return 'like';
  }
  if (isFollow) { onFollow(name, avatar, key); return 'follow'; }
  // Share: game bản đồ không cộng điểm cho chia sẻ — chỉ ghi nhận loại
  // sự kiện (đèn báo + lastType) để streamer biết TikFinity đã nối đúng.
  if (isShare) return 'share';
  if (isLeave) { onLeave(name, key); return 'leave'; }
  if (isJoin) { onJoin(name, key); return 'join'; }
  log('webhook', 'event lạ, bỏ qua. Raw: ' + ((game.webhook.lastRaw || '(rỗng)') + '').slice(0, 300));
  return 'unknown';
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp' };
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
function serveFile(res, file) {
  try {
    const data = fs.readFileSync(path.join(PUBLIC, file));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
}

const handleRequest = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write(`data: ${JSON.stringify(publicState())}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }
  if (p === '/api/state' && req.method === 'GET') { sendJson(res, 200, publicState()); return; }
  if (p === '/api/provinces' && req.method === 'GET') { sendJson(res, 200, PROVINCES); return; }
  if (p === '/api/config' && req.method === 'GET') { sendJson(res, 200, config); return; }
  if (p === '/api/music' && req.method === 'GET') { sendJson(res, 200, { tracks: MUSIC_TRACKS, playing: game_music.playing, trackIndex: game_music.trackIndex, volume: game_music.volume }); return; }
  if (p === '/api/voice' && req.method === 'GET') {
    let clips = [];
    try { clips = fs.readdirSync(path.join(PUBLIC, 'voice')).filter((f) => /\.mp3$/i.test(f)).sort(); } catch { clips = []; }
    let cached = 0;
    try { cached = fs.readdirSync(VOICE_CACHE_DIR).filter((f) => /\.mp3$/i.test(f)).length; } catch { cached = 0; }
    sendJson(res, 200, { clips, count: clips.length, cacheCount: cached });
    return;
  }
  if (p.startsWith('/voice/') && req.method === 'GET') {
    const f = decodeURIComponent(p.slice('/voice/'.length));
    // Cho phép cả file cache: /voice/cache/<sha1>.mp3
    const cacheMatch = f.match(/^cache\/([A-Za-z0-9._-]+\.mp3)$/i);
    if (cacheMatch) {
      try {
        const data = fs.readFileSync(path.join(VOICE_CACHE_DIR, cacheMatch[1]));
        res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
        res.end(data);
      } catch { res.writeHead(404); res.end('not found'); }
      return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(f) || !/\.mp3$/i.test(f)) { res.writeHead(400); res.end('bad file'); return; }
    try {
      const data = fs.readFileSync(path.join(PUBLIC, 'voice', f));
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
    return;
  }
  if (p.startsWith('/music/') && req.method === 'GET') {
    const f = decodeURIComponent(p.slice('/music/'.length));
    if (!/^[A-Za-z0-9._-]+$/.test(f) || !/\.mp3$/i.test(f)) { res.writeHead(400); res.end('bad file'); return; }
    try {
      const data = fs.readFileSync(path.join(PUBLIC, 'music', f));
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
    return;
  }

  if (p === '/api/webhook' && req.method === 'POST') {
    const raw = await readRawBody(req);
    // Ghi lại body thô + header để soi TikFinity thực sự gửi gì (v7.2):
    // từng có lần body parse ra {} dù TikFinity vẫn bắn event đều.
    game.webhook.lastRaw = raw.slice(0, 500);
    game.webhook.lastContentType = String(req.headers['content-type'] || '');
    const parsed = parseWebhookBody(raw);
    log('webhook', `nhận: url=${req.url} content-type=${game.webhook.lastContentType || '(không có)'} len=${raw.length} dạng=${parsed.note} raw=${raw.slice(0, 300) || '(rỗng)'}`);
    let result = 'ok';
    try { result = handleTikFinityEvent(parsed.body, url.searchParams.get('event') || ''); } catch (e) { log('webhook', 'lỗi xử lý event: ' + e.message); }
    broadcast();
    sendJson(res, 200, { ok: true, result });
    return;
  }
  // API event sạch (dashboard / test tay): {type, user, text, giftName, coins, count}
  if (p === '/api/event' && req.method === 'POST') {
    const b = await readBody(req);
    const name = b.user || 'Khách';
    const avatar = b.avatar || null;
    try {
      if (b.type === 'chat') onChat(name, b.text || '', avatar);
      else if (b.type === 'gift') onGift(name, b.giftName || 'quà tặng', Number(b.coins) || 1, avatar);
      else if (b.type === 'like') addTaps(name, Number(b.count) || 1, avatar);
      else if (b.type === 'follow') onFollow(name, avatar);
      else if (b.type === 'join') onJoin(name);
      else if (b.type === 'light') { const n = Number(b.province); if (byNum.get(n)) lightProvince(n, getViewer(name), 'dashboard'); }
    } catch (e) { log('event', 'lỗi: ' + e.message); }
    broadcast();
    sendJson(res, 200, { ok: true, state: publicState() });
    return;
  }
  // API action (dashboard): {action, ...}
  // Demo tu dong (demo-mode-contract.md): vong lap gia lap co san (simStep),
  // chuan hoa qua /api/test/demo start/stop/once nhu cac game khac.
  if (p === '/api/test/demo' && req.method === 'POST') {
    const b = await readBody(req);
    const action = (b && b.action) || 'once';
    if (action === 'start') { sendJson(res, 200, startDemo()); return; }
    if (action === 'stop') { sendJson(res, 200, stopDemo()); return; }
    simStep(true); simStep(true); simStep(true);
    sendJson(res, 200, { success: true, steps: ['3 lượt mô phỏng: comment/tim/quà/follow'], demoActive });
    return;
  }
  if (p === '/api/action' && req.method === 'POST') {
    const b = await readBody(req);
    try {
      if (b.action === 'reset') resetRound();
      else if (b.action === 'lightAll') { for (const pr of PROVINCES) lightProvince(pr.num, null, 'dashboard'); }
      else if (b.action === 'lightRandom') lightRandom(null, 'dashboard', 1);
      else if (b.action === 'simulator') { setSimulator(!!b.on); demoActive = !!b.on; }
      else if (b.action === 'speak') pushAnnounce(b.text || 'Đã thắp sáng Hà Nội, thủ đô ngàn năm văn hiến!', [b.clip || 'prov-12'], { priority: 2, ttsText: b.text || 'Đã thắp sáng Hà Nội, thủ đô ngàn năm văn hiến!' });
      else if (b.action === 'music') {
        if (b.cmd === 'play') game_music.playing = true;
        else if (b.cmd === 'pause') game_music.playing = false;
        else if (b.cmd === 'next' && MUSIC_TRACKS.length) game_music.trackIndex = (game_music.trackIndex + 1) % MUSIC_TRACKS.length;
        else if (b.cmd === 'prev' && MUSIC_TRACKS.length) game_music.trackIndex = (game_music.trackIndex - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
        else if (b.cmd === 'track' && Number.isInteger(b.index) && b.index >= 0 && b.index < MUSIC_TRACKS.length) game_music.trackIndex = b.index;
        if (typeof b.volume === 'number') { game_music.volume = Math.min(1, Math.max(0, b.volume)); config.musicVolume = game_music.volume; saveConfig(); }
        config.musicPlaying = game_music.playing; saveConfig();
      }
      else if (b.action === 'config') {
        for (const k of Object.keys(DEFAULT_CONFIG)) {
          if (b.config && b.config[k] !== undefined) config[k] = b.config[k];
        }
        // (v8) Đổi thời lượng ván thì đồng hồ ván hiện tại tính lại từ lúc
        // này (áp dụng ngay, không phải chờ ván sau).
        if (b.config && b.config.gameDurationMin !== undefined && game.phase === 'playing') {
          game.roundEndsAt = Date.now() + (config.gameDurationMin ?? 60) * 60000;
        }
        saveConfig();
      }
    } catch (e) { log('action', 'lỗi: ' + e.message); }
    broadcast();
    sendJson(res, 200, { ok: true, state: publicState(), config });
    return;
  }

  if (p === '/' || p === '/index.html' || p === '/overlay.html') { serveFile(res, 'overlay.html'); return; }
  if (p === '/dashboard') { serveFile(res, 'dashboard.html'); return; }
  if (p === '/provinces.json') { serveFile(res, 'provinces.json'); return; }
  if (p === '/islands.json') { serveFile(res, 'islands.json'); return; }
  if (p === '/trong-dong-bg.jpg') { serveFile(res, 'trong-dong-bg.jpg'); return; }
  res.writeHead(404); res.end('not found');
};

  return {
    type: 'raw',
    handleRequest,
    // Số client SSE đang mở — platform dùng để biết room còn người xem không.
    sseCount() { return sseClients.size; },

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

export default createEngine;
