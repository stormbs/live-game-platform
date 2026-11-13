// shared/music.js — Nhạc nền WebAudio dùng chung cho các overlay TikTok LIVE.
// Tự tổng hợp bằng WebAudio, không file nhạc ngoài, không nhạc có bản quyền.
// Cách dùng trong overlay:
//   <script src="/shared/music.js"></script>
//   StromMusic.start({ tempo: 128, mood: 'edm', volume: 50 });
//   StromMusic.sync({ enabled: true, volume: 50, tempo: 128 }); // gọi mỗi khi state đổi
//   StromMusic.setEnergy(0|1|2); // thêm lớp nhạc khi phòng sôi động
//   StromMusic.stop();
(function (global) {
  'use strict';

  var MOODS = {
    // EDM sôi động (mặc định): Am F C G, 128 BPM.
    edm:   { tempo: 128, roots: [55, 43.65, 65.41, 49], tones: [[220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [261.63, 329.63, 392, 523.25], [196, 246.94, 293.66, 392]], bassCut: 900, leadCut: 1400, wave: 'sawtooth' },
    // Dân gian nhẹ nhàng: C G Am F, 100 BPM, âm mềm.
    folk:  { tempo: 100, roots: [65.41, 49, 55, 43.65], tones: [[261.63, 329.63, 392, 523.25], [196, 246.94, 293.66, 392], [220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23]], bassCut: 500, leadCut: 900, wave: 'triangle' },
    // Chiến đấu: Am Am F G, 132 BPM, dồn dập.
    battle:{ tempo: 132, roots: [55, 55, 43.65, 49], tones: [[220, 261.63, 329.63, 440], [220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392]], bassCut: 1000, leadCut: 1600, wave: 'sawtooth' },
    // Nhẹ, thư giãn: C Am F G, 90 BPM, thưa.
    calm:  { tempo: 90, roots: [65.41, 55, 43.65, 49], tones: [[261.63, 329.63, 392, 523.25], [220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392]], bassCut: 400, leadCut: 800, wave: 'triangle' },
    // Trống chèo thuyền: nhịp trống là chính, 120 BPM.
    drum:  { tempo: 120, roots: [55, 55, 55, 49], tones: [[220, 261.63, 329.63, 440], [220, 261.63, 329.63, 440], [220, 261.63, 329.63, 440], [196, 246.94, 293.66, 392]], bassCut: 600, leadCut: 1000, wave: 'sawtooth' },
  };

  function sectionOf(barIdx) {
    if (barIdx < 4) return 'INTRO';
    if (barIdx < 8) return 'BUILD';
    if (barIdx < 12) return 'DROP';
    return 'BREAK';
  }

  var ctx = null, timer = null, step16 = 0, nextNoteTime = 0;
  var opts = { tempo: 128, mood: 'edm', volume: 50, enabled: true, energy: 0 };
  var section = 'INTRO';

  function mood() { return MOODS[opts.mood] || MOODS.edm; }

  function noiseBuffer(dur) {
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function kick(t, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.3);
  }
  function hat(t, v, open) {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(open ? 0.18 : 0.05);
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    var g = ctx.createGain(); g.gain.value = v;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  }
  function snare(t, v) {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(0.16);
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    var g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
    var o = ctx.createOscillator(), g2 = ctx.createGain();
    o.frequency.value = 180;
    g2.gain.setValueAtTime(v * 0.6, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g2); g2.connect(ctx.destination); o.start(t); o.stop(t + 0.12);
  }
  function bass(t, freq, dur, v, cutoff) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 400;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur);
  }
  function stabChord(t, tones, v, wave) {
    tones.slice(0, 3).forEach(function (fr) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave || 'square'; o.frequency.value = fr;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.2);
    });
  }
  function arp(t, freq, v, cutoff, wave) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave || 'sawtooth'; o.frequency.value = freq;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 1400;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.14);
  }
  function crash(t, v) {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(1.2);
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    var g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  }
  function riser(t, dur, v) {
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(4000, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(v, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t); src.stop(t + dur);
  }
  // Trống cái (tom) cho mood drum.
  function tom(t, freq, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.18);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.25);
  }

  function schedule() {
    if (!ctx || !opts.enabled) return;
    var m = mood();
    var bpm = opts.tempo || m.tempo;
    var spb = 60 / bpm / 4;
    var vol = (opts.volume == null ? 50 : opts.volume) / 100;
    var isDrum = opts.mood === 'drum';
    while (nextNoteTime < ctx.currentTime + 0.12) {
      var t = nextNoteTime;
      var barIdx = Math.floor(step16 / 16) % 16;
      var s16 = step16 % 16;
      var sec = sectionOf(barIdx);
      if (sec !== section) {
        section = sec;
        if (sec === 'DROP') crash(t, vol * 0.5);
        if (sec === 'INTRO') crash(t, vol * 0.25);
      }
      if (s16 === 0 && barIdx === 7) riser(t, spb * 16, vol * 0.5);
      var chord = { root: m.roots[barIdx % 4], tones: m.tones[barIdx % 4] };
      var isDrop = sec === 'DROP';
      var isBreak = sec === 'BREAK';
      var hype = opts.energy >= 2 || isDrop;
      if (isDrum) {
        // Nhịp trống chèo: kick dồn + tom xen kẽ, càng sôi càng dày.
        if (s16 % 4 === 0 || (hype && s16 % 2 === 0)) kick(t, vol);
        if (s16 === 4 || s16 === 12) tom(t, s16 === 4 ? 220 : 175, vol * 0.7);
        if (s16 % 4 === 2) hat(t, vol * 0.45, false);
        if (hype && s16 === 14) hat(t, vol * 0.4, true);
        if (s16 === 0 || s16 === 8) bass(t, chord.root, spb * 2, vol * 0.5, m.bassCut);
      } else {
        if (s16 % 4 === 0 || (isDrop && s16 === 14)) kick(t, vol);
        if (s16 % 4 === 2) hat(t, vol * 0.5, false);
        if ((isDrop || sec === 'BUILD') && s16 === 14) hat(t, vol * 0.4, true);
        if (sec !== 'INTRO' && (s16 === 4 || s16 === 12)) snare(t, vol * (isDrop ? 0.7 : 0.45));
        var bassSteps = isBreak ? [0, 8] : [0, 3, 6, 8, 11, 14];
        if (bassSteps.indexOf(s16) !== -1) {
          var f = (s16 === 6 || s16 === 14) ? chord.root * 1.5 : (s16 === 3 || s16 === 11) ? chord.root * 2 : chord.root;
          bass(t, f, spb * 2.2, vol * (isDrop ? 0.9 : 0.7), isDrop ? m.bassCut : 450);
        }
        if ((sec === 'BUILD' || isDrop) && (s16 === 4 || s16 === 12)) stabChord(t, chord.tones, vol * (isDrop ? 0.4 : 0.25), m.wave === 'triangle' ? 'triangle' : 'square');
        if (isDrop || (sec === 'BUILD' && s16 % 4 === 0)) {
          var arpIdx = [0, 1, 2, 3, 2, 1, 2, 3][step16 % 8];
          arp(t, chord.tones[arpIdx] * (isDrop ? 2 : 1), vol * 0.13, m.leadCut, m.wave);
        }
      }
      nextNoteTime += spb;
      step16++;
    }
  }

  function ensureCtx() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () {}); return true; }
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      nextNoteTime = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 25);
      return true;
    } catch (e) { return false; }
  }

  global.StromMusic = {
    start: function (o) {
      if (o) {
        if (o.tempo != null) opts.tempo = o.tempo;
        if (o.mood) opts.mood = o.mood;
        if (o.volume != null) opts.volume = o.volume;
        if (o.enabled != null) opts.enabled = !!o.enabled;
        if (o.energy != null) opts.energy = o.energy;
      }
      if (!opts.enabled) return false;
      return ensureCtx();
    },
    sync: function (o) {
      if (!o) return;
      if (o.enabled != null) opts.enabled = !!o.enabled;
      if (o.volume != null) opts.volume = o.volume;
      if (o.tempo != null) opts.tempo = o.tempo;
      if (o.mood) opts.mood = o.mood;
      if (o.energy != null) opts.energy = o.energy;
      if (opts.enabled) ensureCtx();
    },
    setEnergy: function (lvl) { opts.energy = lvl || 0; },
    setTempo: function (bpm) { if (bpm) opts.tempo = bpm; },
    setVolume: function (v) { if (v != null) opts.volume = v; },
    setEnabled: function (on) { opts.enabled = !!on; if (on) ensureCtx(); },
    stop: function () { opts.enabled = false; },
    section: function () { return section; },
    isPlaying: function () { return !!ctx && opts.enabled && ctx.state === 'running'; },
  };
})(typeof window !== 'undefined' ? window : this);
