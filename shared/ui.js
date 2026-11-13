// StromUI — hiệu ứng sự kiện dùng chung cho 14 overlay TikTok LIVE.
// Dùng chung, không phụ thuộc engine game. Nối bằng:
//   <script src="/shared/ui.js"></script>  (trong <head>, sau /shared/music.js)
// Quy ước gọi trong từng game (thêm 1-3 dòng vào handler socket đã có):
//   quà lớn        -> StromUI.flash(); StromUI.sfx('gift'); StromUI.confetti(24);
//   thắng/về đích  -> StromUI.flash('#FFD700'); StromUI.sfx('win'); StromUI.confetti(48);
//   join/follow    -> StromUI.sfx('join');
//   điểm tăng      -> StromUI.floatText(x, y, '+10đ');
//   sự kiện nổi    -> StromUI.toast('🎁 Lan tặng 99 xu!');
(function (global) {
  'use strict';
  function el(id) { return document.getElementById(id); }
  function host() { return el('scaler') || el('stage') || document.body; }

  // 1. Flash sáng toàn màn hình khi quà lớn / thắng (màu theo game)
  function flash(color, ms) {
    var f = el('ui-flash');
    if (!f) {
      f = document.createElement('div');
      f.id = 'ui-flash';
      f.style.cssText = 'position:absolute;inset:0;z-index:45;pointer-events:none;opacity:0;transition:opacity .45s ease-out;';
      host().appendChild(f);
    }
    f.style.background = 'radial-gradient(circle at 50% 45%, ' + (color || 'rgba(255,215,0,.55)') + ' 0%, transparent 65%)';
    f.style.transition = 'none'; f.style.opacity = '1';
    requestAnimationFrame(function () { f.style.transition = 'opacity .45s ease-out'; f.style.opacity = '0'; });
  }

  // 2. Chữ bay lên (+10đ, -5 HP, +1 🌸...) tại toạ độ x,y trong khung
  function floatText(x, y, text, color) {
    var d = document.createElement('div');
    d.className = 'ui-float-text';
    d.textContent = text;
    d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;color:' + (color || '#FFD700') + ';';
    host().appendChild(d);
    setTimeout(function () { d.remove(); }, 1600);
  }

  // 3. Confetti rơi (canvas-free, div) — dùng khi thắng / quà lớn / mốc
  function confetti(n) {
    var h = host();
    var colors = ['#FFD700', '#FF2D95', '#22D3EE', '#FACC15', '#A855F7', '#4ADE80', '#FFF'];
    for (var i = 0; i < (n || 36); i++) {
      var c = document.createElement('div');
      c.className = 'ui-confetti';
      c.style.left = Math.floor(Math.random() * 1060) + 'px';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.5) + 's';
      h.appendChild(c);
      (function (node) { setTimeout(function () { node.remove(); }, 3400); })(c);
    }
  }

  // 4. Toast ngắn (cần có <div class="ui-toast" id="ui-toast"></div> trong overlay)
  var toastTimer = null;
  function toast(text, ms) {
    var t = el('ui-toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 4000);
  }

  // 5. Tiếng "ting" / "pop" / "win" bằng WebAudio (không cần file, không cần TTS)
  var actx = null;
  function sfx(kind) {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
      var t0 = actx.currentTime;
      function tone(freq, at, dur, vol, type) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.25, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + at + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
      }
      if (kind === 'gift') { tone(880, 0, 0.18, 0.3); tone(1318, 0.09, 0.25, 0.3); }
      else if (kind === 'win') { tone(523, 0, 0.2, 0.3); tone(659, 0.12, 0.2, 0.3); tone(784, 0.24, 0.35, 0.32); }
      else if (kind === 'pop') { tone(660, 0, 0.12, 0.25, 'triangle'); }
      else if (kind === 'join') { tone(587, 0, 0.15, 0.2); tone(880, 0.08, 0.2, 0.2); }
    } catch (e) { /* bỏ qua nếu trình duyệt chặn audio */ }
  }

  global.StromUI = { flash: flash, floatText: floatText, confetti: confetti, toast: toast, sfx: sfx };
})(typeof window !== 'undefined' ? window : this);
