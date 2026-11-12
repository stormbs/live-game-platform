/**
 * audio-engine.js - Hệ thống âm thanh hoàn chỉnh Buồng Giam 2D Game (Mục 11)
 * 1. Nhạc nền (BGM) chạy liên tục không bản quyền, 3 bài tùy chọn, volume riêng.
 * 2. Auto-Ducking: Giảm BGM xuống 10% khi TTS đọc, đọc xong hồi phục 30% trong 1s.
 * 3. Hiệu ứng âm thanh (SFX) riêng: ting quà, quà lớn vỗ tay, bước chân leo cầu thang/tụt mâm, tap, follow, mở cửa.
 * 4. Cụm điều khiển âm thanh tổng: Bật/tắt tất cả, Master/BGM/TTS/SFX volume, Test 5s.
 */

class BuongGiamAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.speechQueue = [];
    this.isSpeaking = false;
    this.currentPriority = 0;
    this.isProcessingQueue = false;
    this.queueStepTimer = null;
    this.activeWatchdogTimer = null;

    // SFX Throttling Timers (Tránh ré/chồng chéo SFX khi bão sự kiện)
    this.lastChimeTime = 0;
    this.lastClimbTime = 0;
    this.lastDoorTime = 0;
    this.lastFollowTime = 0;
    this.lastTapTime = 0;

    // Master Controls
    this.masterEnabled = true;
    this.masterVolume = 1.0;
    this.masterGain = null;
    this.currentAudio = null;

    // Ambient / BGM Controls
    this.ambientEnabled = true;
    this.ambientVolume = 0.3; // Mặc định 30%
    this.currentTrack = 'track1';
    this.isAmbientPlaying = false;
    this.ambientGain = null;
    this.ambientNodes = [];
    this.ambientInterval = null;
    this.isDucked = false;

    // TTS Controls
    this.ttsEnabled = true;
    this.ttsVolume = 0.85;

    // SFX Controls
    this.sfxEnabled = true;
    this.sfxVolume = 0.8;
    this.sfxGain = null;

    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();

        // Master Gain
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);

        // SFX Gain
        this.sfxGain = this.audioCtx.createGain();
        this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.audioCtx.currentTime);
        this.sfxGain.connect(this.masterGain);

        // Ambient Gain
        this.ambientGain = this.audioCtx.createGain();
        this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.audioCtx.currentTime);
        this.ambientGain.connect(this.masterGain);
      }
    } catch (e) {
      console.warn('AudioContext not supported:', e);
    }
  }

  ensureAudioContext() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /* ================= 1. NHẠC NỀN KHÔNG BẢN QUYỀN (3 BÀI) ================= */

  startAmbient() {
    this.ensureAudioContext();
    if (!this.audioCtx || !this.ambientEnabled || !this.masterEnabled) return;
    if (this.isAmbientPlaying) this.stopAmbient();

    try {
      this.isAmbientPlaying = true;
      const now = this.audioCtx.currentTime;
      this.ambientGain.gain.setValueAtTime(this.ambientVolume, now);

      if (this.currentTrack === 'track1') {
        // BÀI 1: Lo-fi Buồng Giam Trầm Lắng (Warm Ambient Cell Drone + Bass)
        const osc1 = this.audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(65.41, now); // C2

        const osc2 = this.audioCtx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(98.0, now); // G2

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(240, now);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(this.ambientGain);

        osc1.start(now);
        osc2.start(now);
        this.ambientNodes = [osc1, osc2, filter];

      } else if (this.currentTrack === 'track2') {
        // BÀI 2: Hồi Hộp Thiền Ngục (Deep Resonant Tension Drone)
        const osc1 = this.audioCtx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(55.0, now); // A1

        const osc2 = this.audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(82.41, now); // E2

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(180, now);
        filter.Q.setValueAtTime(3.0, now);

        const lfo = this.audioCtx.createOscillator();
        lfo.frequency.setValueAtTime(0.2, now);
        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.setValueAtTime(60, now);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(this.ambientGain);

        osc1.start(now);
        osc2.start(now);
        lfo.start(now);
        this.ambientNodes = [osc1, osc2, lfo, lfoGain, filter];

      } else {
        // BÀI 3: Nhịp Phố Retro (Bouncy Chiptune / Lo-fi Arpeggiated Ambient)
        const oscRoot = this.audioCtx.createOscillator();
        oscRoot.type = 'triangle';
        oscRoot.frequency.setValueAtTime(110.0, now); // A2

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);

        oscRoot.connect(filter);
        filter.connect(this.ambientGain);
        oscRoot.start(now);

        // Arpeggiated gentle notes in loop
        const notes = [220, 261.63, 329.63, 392.0, 440];
        let noteIdx = 0;
        this.ambientInterval = setInterval(() => {
          if (!this.isAmbientPlaying || !this.audioCtx) return;
          try {
            const t = this.audioCtx.currentTime;
            const noteOsc = this.audioCtx.createOscillator();
            const noteGain = this.audioCtx.createGain();
            noteOsc.type = 'sine';
            noteOsc.frequency.setValueAtTime(notes[noteIdx % notes.length], t);
            noteGain.gain.setValueAtTime(0.08, t);
            noteGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            noteOsc.connect(noteGain);
            noteGain.connect(this.ambientGain);
            noteOsc.start(t);
            noteOsc.stop(t + 0.35);
            noteIdx++;
          } catch(e){}
        }, 350);

        this.ambientNodes = [oscRoot, filter];
      }
    } catch (e) {
      console.warn('Error starting ambient:', e);
    }
  }

  stopAmbient() {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
    if (this.ambientNodes && this.ambientNodes.length > 0) {
      this.ambientNodes.forEach(node => {
        try { if (node.stop) node.stop(); } catch(e){}
      });
      this.ambientNodes = [];
    }
    this.isAmbientPlaying = false;
  }

  setAmbientTrack(track) {
    this.currentTrack = track;
    if (this.isAmbientPlaying) {
      this.startAmbient();
    }
  }

  setAmbientVolume(vol) {
    this.ambientVolume = Math.max(0, Math.min(1, parseFloat(vol)));
    if (this.ambientGain && !this.isDucked && this.audioCtx) {
      this.ambientGain.gain.setTargetAtTime(this.ambientVolume, this.audioCtx.currentTime, 0.1);
    }
  }

  /* ================= 2. AUTO-DUCKING THÔNG MINH ================= */
  // Giảm xuống 10% khi TTS đọc, đọc xong tăng lại 30% trong vòng 1 giây
  duckAmbient() {
    if (this.ambientGain && !this.isDucked && this.audioCtx) {
      this.isDucked = true;
      const duckedVol = this.ambientVolume * 0.1; // Giảm xuống 10%
      this.ambientGain.gain.setTargetAtTime(duckedVol, this.audioCtx.currentTime, 0.2);
    }
  }

  unduckAmbient() {
    if (this.ambientGain && this.isDucked && this.audioCtx) {
      this.isDucked = false;
      // Tăng dần lại trong 1 giây mượt mà
      this.ambientGain.gain.setTargetAtTime(this.ambientVolume, this.audioCtx.currentTime, 1.0);
    }
  }

  /* ================= 3. TTS TIẾNG VIỆT TROLL & HÀNG ĐỢI PHÂN CẤP ƯU TIÊN ================= */

  // Dừng ngay lập tức âm thanh / TTS đang đọc hiện tại
  interruptCurrentSpeech(force = false) {
    if (!force && this.currentPriority >= 100 && this.isSpeaking) {
      // TUYỆT ĐỐI BẢO VỆ THÔNG BÁO XUẤT TRẠI (PRIORITY >= 100), KHÔNG CHO PHÉP BỊ NGẮT NGANG
      return;
    }

    if (this.queueStepTimer) {
      clearTimeout(this.queueStepTimer);
      this.queueStepTimer = null;
    }
    if (this.activeWatchdogTimer) {
      clearTimeout(this.activeWatchdogTimer);
      this.activeWatchdogTimer = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch(e){}
      this.currentAudio = null;
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch(e){}
    }
    this.isSpeaking = false;
    this.isProcessingQueue = false;
    this.currentPriority = 0;
  }

  // Chèn vào hàng đợi theo thứ tự ưu tiên giảm dần
  // QUY TẮC NGHẼN: Tấm gương sáng (>=90) & Mâm 1 (>=70) được BẢO VỆ TUYỆT ĐỐI không bao giờ bị huỷ.
  // Mọi sự kiện khác (< 70) thuộc danh sách nghẽn: quá 10s hoặc vượt quá 2 mục nghẽn sẽ tự động bỏ qua sang chu kỳ mới!
  insertByPriority(item) {
    const now = Date.now();

    // 1. Dọn dẹp các sự kiện nghẽn (< 70) đã quá chu kỳ 10 giây
    this.speechQueue = this.speechQueue.filter(q => {
      const prio = (typeof q === 'object' && q.priority !== undefined) ? Number(q.priority) : 10;
      if (prio >= 70) return true; // Tấm gương sáng & Mâm 1: BẢO VỆ TUYỆT ĐỐI
      const created = (typeof q === 'object' && q.createdAt) ? q.createdAt : now;
      return (now - created) < 10000; // Quá chu kỳ 10s bỏ qua
    });

    // 2. Chèn vào hàng đợi theo thứ tự ưu tiên giảm dần
    const itemPriority = Number(item.priority) || 10;
    const idx = this.speechQueue.findIndex(q => (Number(q.priority) || 10) < itemPriority);
    if (idx === -1) {
      this.speechQueue.push(item);
    } else {
      this.speechQueue.splice(idx, 0, item);
    }

    // 3. Quản lý danh sách nghẽn: Giữ tối đa 2 sự kiện nghẽn (< 70) có độ ưu tiên cao nhất
    // Các sự kiện bảo vệ (>= 70) luôn được giữ 100%
    let congestibleCount = 0;
    this.speechQueue = this.speechQueue.filter(q => {
      const prio = (typeof q === 'object' && q.priority !== undefined) ? Number(q.priority) : 10;
      if (prio >= 70) return true;
      congestibleCount++;
      return congestibleCount <= 2; // Giữ tối đa 2 mục nghẽn, mục nghẽn dư thừa có ưu tiên thấp hơn bị bỏ qua ngay!
    });
  }

  /**
   * speakThanks(text, priority):
   * 1. TẤM GƯƠNG SÁNG (>= 90): Xuất trại (100), Chào mừng TGS (95), Biểu dương/Rớt TGS (90) - BẢO VỆ 100%
   * 2. MÂM 1 (70 - 85): Lên Mâm 1 (85), Tân đại ca (80), Xuống Mâm 1 (75), Ăn gà (70) - BẢO VỆ 100%
   * 3. MÂM 2 (55 - 60): Lên Mâm 2 (60), Xuống Mâm 2 (55) - DANH SÁCH NGHẼN
   * 4. MÂM 3 (40 - 45): Lên Mâm 3 (45), Xuống Mâm 3 (40) - DANH SÁCH NGHẼN
   * 5. MÂM 4 (30): Xuống Mâm 4 (30) - DANH SÁCH NGHẼN
   * QUÀ TẶNG: Sắp xếp theo lượng xu (quà lớn đọc trước quà nhỏ, thuộc danh sách nghẽn 20-68)
   */
  speakThanks(text, priority = 10) {
    if (!this.ttsEnabled || !this.masterEnabled || !text) return;
    priority = Number(priority) || 10;

    // BỎ HOÀN TOÀN GIỌNG ĐỌC CHO QUÀ 1 XU ĐƠN LẺ ĐỂ TRÁNH NHIỄU ÂM THANH
    if (text.includes('(1 xu)') || text.includes('1 xu)') || text.includes('(1 xu,') || text.includes('1 bông hoa hồng (1 xu)')) {
      return;
    }

    // NẾU ĐANG CÓ CẢNH XUẤT TRẠI HOẶC KHOẢNG NGHỈ HẬU XUẤT TRẠI:
    // TUYỆT ĐỐI KHÔNG CHEN BẤT KỲ GIỌNG ĐỌC NÀO KHÁC (chỉ cho phép priority >= 100 của chính cảnh xuất trại)!
    if (window.isReleaseCeremonyActive && priority < 100) {
      return;
    }

    // DỪNG NGAY voice đọc luân phiên nếu đang đọc khi có bất kỳ sự kiện tương tác nào
    if (window.buongGiamVoice16) {
      window.buongGiamVoice16.interruptForEvent();
    }

    const newItem = { text, priority, createdAt: Date.now() };

    // --- ƯU TIÊN 1: XUẤT TRẠI (priority >= 100) ---
    // Bất kể đang có thông báo gì, NGAY LẬP TỨC dừng lại và đọc thông báo xuất trại!
    if (priority >= 100) {
      this.interruptCurrentSpeech(true);
      this.speechQueue = [newItem]; // Xoá sạch toàn bộ hàng đợi sự kiện cũ
      this.processQueue();
      return;
    }

    // Nếu đang phát cảnh xuất trại (priority >= 100), KHÔNG được chen ngang hay ngắt lời
    if (this.currentPriority >= 100 && this.isSpeaking) {
      this.insertByPriority(newItem);
      return;
    }

    // --- CẤP BẢO VỆ: TẤM GƯƠNG SÁNG & MÂM 1 (priority >= 70) ---
    // Nếu đang có thông báo thuộc danh sách nghẽn (< 70), NGAY LẬP TỨC ngắt lời để ưu tiên đọc sự kiện bảo vệ!
    if (priority >= 70 && (this.isSpeaking || this.isProcessingQueue) && this.currentPriority < 70) {
      this.interruptCurrentSpeech(true);
      this.speechQueue.unshift(newItem);
      this.processQueue();
      return;
    }

    // Chèn vào hàng đợi theo đúng độ ưu tiên và lọc nghẽn quá chu kỳ 10s
    this.insertByPriority(newItem);

    // Kích hoạt đọc nếu không bận và không có hẹn giờ chuyển câu
    if (!this.isSpeaking && !this.isProcessingQueue && !this.queueStepTimer) {
      this.processQueue();
    }
  }

  clearSpeechQueue(force = false) {
    this.speechQueue = [];
    if (this.queueStepTimer) {
      clearTimeout(this.queueStepTimer);
      this.queueStepTimer = null;
    }
    if (!force && this.currentPriority >= 100 && this.isSpeaking) {
      return;
    }
    this.interruptCurrentSpeech(force);
    this.unduckAmbient();
  }

  processQueue() {
    if (this.queueStepTimer) {
      clearTimeout(this.queueStepTimer);
      this.queueStepTimer = null;
    }

    // LỌC DANH SÁCH NGHẼN: Nếu tin thuộc danh sách nghẽn (< 70) đã quá chu kỳ 10 giây -> BỎ QUA NGAY
    // Tin thuộc nhóm bảo vệ (>= 70: Tấm gương sáng, Mâm 1) được giữ lại an toàn (tối đa 30s)
    const now = Date.now();
    this.speechQueue = this.speechQueue.filter(item => {
      const prio = (typeof item === 'object' && item.priority !== undefined) ? Number(item.priority) : 10;
      const created = (typeof item === 'object' && item.createdAt) ? item.createdAt : now;
      if (prio >= 70) {
        return (now - created) < 30000;
      }
      return (now - created) < 10000;
    });

    if (this.speechQueue.length === 0) {
      this.isSpeaking = false;
      this.isProcessingQueue = false;
      this.currentPriority = 0;
      if (this.currentAudio) {
        try {
          this.currentAudio.onended = null;
          this.currentAudio.onerror = null;
          this.currentAudio.pause();
          this.currentAudio.src = '';
        } catch(e){}
        this.currentAudio = null;
      }
      // Nếu đang trong cảnh xuất trại hoặc khoảng nghỉ sau xuất trại:
      // Tuyệt đối giữ yên lặng cho BGM, KHÔNG resume Voice 16 lúc này!
      if (window.isReleaseCeremonyActive) {
        return;
      }
      if (window.buongGiamVoice16) {
        window.buongGiamVoice16.resumeAfterEvent();
      } else {
        this.unduckAmbient();
      }
      return;
    }

    // Khoá đơn tiến trình: Tuyệt đối không cho 2 lượt processQueue chạy song song
    if (this.isProcessingQueue) {
      return;
    }
    this.isProcessingQueue = true;
    this.isSpeaking = true;
    this.duckAmbient();

    const item = this.speechQueue.shift();
    const text = typeof item === 'object' ? item.text : item;
    const priority = typeof item === 'object' ? (Number(item.priority) || 10) : 10;
    this.currentPriority = priority;

    // ĐẢM BẢO KHÔNG CHỒNG CHÉO: Dọn sạch mọi âm thanh trước khi bắt đầu audio mới
    if (this.currentAudio) {
      try {
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.pause();
        this.currentAudio.src = '';
      } catch(e){}
      this.currentAudio = null;
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch(e){}
    }

    const audio = new Audio();
    this.currentAudio = audio;
    audio.src = `/api/tts?text=${encodeURIComponent(text)}`;
    audio.volume = Math.max(0, Math.min(1, this.ttsVolume * this.masterVolume));

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (this.activeWatchdogTimer) {
        clearTimeout(this.activeWatchdogTimer);
        this.activeWatchdogTimer = null;
      }
      if (this.currentAudio === audio) {
        try {
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          audio.src = '';
        } catch(e){}
        this.currentAudio = null;
      }
      this.currentPriority = 0;
      this.isProcessingQueue = false;

      // Giữ isSpeaking = true trong khoảng nghỉ 250ms giữa 2 câu để Voice 16 không chen ngang!
      if (this.queueStepTimer) {
        clearTimeout(this.queueStepTimer);
        this.queueStepTimer = null;
      }
      this.queueStepTimer = setTimeout(() => {
        this.queueStepTimer = null;
        this.processQueue();
      }, 250);
    };

    // WATCHDOG AN TOÀN: Tính theo độ dài câu, tối thiểu 25 giây cho priority >= 100 để đọc hoàn chỉnh từng từ không bị đứt đoạn
    const safeWatchdogMs = priority >= 100 ? Math.max(25000, text.length * 200) : Math.max(16000, text.length * 160);
    this.activeWatchdogTimer = setTimeout(() => {
      if (!finished) {
        try {
          if (audio) {
            audio.pause();
            audio.src = '';
          }
          if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch(e){}
        finish();
      }
    }, safeWatchdogMs);

    const trySpeechSynthesis = () => {
      if (finished || !this.isSpeaking || this.currentAudio !== audio) return;
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'vi-VN';
          u.volume = Math.max(0, Math.min(1, this.ttsVolume * this.masterVolume));
          u.onend = () => {
            if (!finished && this.isSpeaking) finish();
          };
          u.onerror = () => {
            if (!finished && this.isSpeaking) finish();
          };
          window.speechSynthesis.speak(u);
          return;
        } catch(e){}
      }
      finish();
    };

    audio.onended = () => {
      if (finished || this.currentAudio !== audio) return;
      finish();
    };
    audio.onerror = () => {
      if (finished || !this.isSpeaking || this.currentAudio !== audio) return;
      trySpeechSynthesis();
    };

    audio.play().catch((err) => {
      if (finished || !this.isSpeaking || this.currentAudio !== audio) return;
      // Nếu lỗi do bị ngắt chủ động bằng pause(), TUYỆT ĐỐI không gọi SpeechSynthesis
      if (err && (err.name === 'AbortError' || err.code === 20)) return;
      trySpeechSynthesis();
    });
  }

  /* ================= 4. HIỆU ỨNG ÂM THANH (SFX) ================= */

  // 4.1 Tiếng Ting khi có quà (Quà lớn 50đ có tràng vỗ tay ăn mừng)
  playGiftChime(isBig = false) {
    if (!this.sfxEnabled || !this.masterEnabled || window.isReleaseCeremonyActive) return;
    const nowMs = Date.now();
    if (!isBig && (nowMs - this.lastChimeTime < 180)) return;
    this.lastChimeTime = nowMs;

    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // Tiếng chuông vàng 'ting ting'
      const freqs = isBig ? [587.33, 739.99, 880, 1174.66] : [659.25, 880];
      freqs.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        const startTime = now + idx * 0.08;
        const dur = isBig ? 0.6 : 0.35;
        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(startTime);
        osc.stop(startTime + dur);
      });

      // Nếu quà lớn >= 50đ: Thêm tiếng vỗ tay / pháo hoa hân hoan
      if (isBig) {
        this.playApplause(now + 0.2, 1.4);
      }
    } catch (e) {}
  }

  // Tiếng vỗ tay synthetically (White noise burst modulation)
  playApplause(startTime, duration) {
    try {
      const bufferSize = this.audioCtx.sampleRate * duration;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.5));
      }

      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, startTime);
      filter.Q.setValueAtTime(1.5, startTime);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(startTime);
      noise.stop(startTime + duration);
    } catch(e){}
  }

  // 4.1b Khúc kèn đồng chúc mừng xuất trại (kèn + trống định âm, ~7 giây, long trọng)
  playCeremonyFanfare() {
    if (!this.sfxEnabled || !this.masterEnabled) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime + 0.05;
      const brass = (freq, t, dur, vol = 0.2) => {
        const osc = this.audioCtx.createOscillator();
        const flt = this.audioCtx.createBiquadFilter();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(1800, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.06);
        gain.gain.setValueAtTime(vol, t + Math.max(0.06, dur - 0.12));
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(flt);
        flt.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      };

      // Hô kèn mở màn: C C E G C5
      const calls = [261.63, 261.63, 329.63, 392.0, 523.25];
      calls.forEach((f, i) => brass(f, now + i * 0.22, 0.24));
      // Leo thang: G C5 E5
      const t1 = now + calls.length * 0.22 + 0.1;
      [392.0, 523.25, 659.25].forEach((f, i) => brass(f, t1 + i * 0.22, 0.26));
      // Giữ hợp âm Đô trưởng rền vang
      const t2 = t1 + 3 * 0.22 + 0.12;
      [261.63, 329.63, 392.0, 523.25].forEach(f => brass(f, t2, 2.6, 0.14));
      // Trống định âm đệm 3 nhịp
      [0, 0.88, 1.98].forEach(dt => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now + dt);
        osc.frequency.exponentialRampToValueAtTime(45, now + dt + 0.35);
        gain.gain.setValueAtTime(0.5, now + dt);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.4);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + dt);
        osc.stop(now + dt + 0.45);
      });
    } catch (e) {}
  }

  // 4.2 Tiếng cầu thang leo lên + âm vang 'yeah'
  playClimbUp() {
    if (!this.sfxEnabled || !this.masterEnabled || window.isReleaseCeremonyActive) return;
    const nowMs = Date.now();
    if (nowMs - this.lastClimbTime < 200) return;
    this.lastClimbTime = nowMs;

    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        const t = now + idx * 0.1;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch(e){}
  }

  // 4.3 Tiếng 'tụt' cầu thang xuống + lò xo boing
  playClimbDown() {
    if (!this.sfxEnabled || !this.masterEnabled || window.isReleaseCeremonyActive) return;
    const nowMs = Date.now();
    if (nowMs - this.lastClimbTime < 200) return;
    this.lastClimbTime = nowMs;

    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.45); // Pitch drop

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch(e){}
  }

  // 4.4 Tiếng nhẹ khi đủ 50 tap (+1đ buồng)
  playTapPoint() {
    if (!this.sfxEnabled || !this.masterEnabled || window.isReleaseCeremonyActive) return;
    const nowMs = Date.now();
    if (nowMs - this.lastTapTime < 250) return;
    this.lastTapTime = nowMs;

    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch(e){}
  }

  // 4.5 Tiếng 'ding' follow (+10đ buồng)
  playFollow() {
    if (!this.sfxEnabled || !this.masterEnabled || window.isReleaseCeremonyActive) return;
    const nowMs = Date.now();
    if (nowMs - this.lastFollowTime < 300) return;
    this.lastFollowTime = nowMs;

    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        const t = now + idx * 0.07;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
      });
    } catch(e){}
  }

  // 4.6 Tiếng mở cửa buồng giam sắt khi join
  playDoorOpen() {
    if (!this.sfxEnabled || !this.masterEnabled) return;
    const nowMs = Date.now();
    if (nowMs - this.lastDoorTime < 350) return;
    this.lastDoorTime = nowMs;

    this.ensureAudioContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      // Metallic creak + clank
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(320, now + 0.2);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch(e){}
  }

  /* ================= 5. MASTER CONTROLS & TEST 5s ================= */

  setMasterEnabled(enabled) {
    this.masterEnabled = Boolean(enabled);
    if (!this.masterEnabled) {
      this.stopAmbient();
      if (this.masterGain && this.audioCtx) {
        this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      }
    } else {
      if (this.masterGain && this.audioCtx) {
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
      }
      if (this.ambientEnabled) this.startAmbient();
    }
  }

  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, parseFloat(vol)));
    if (this.masterGain && this.masterEnabled && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.audioCtx.currentTime, 0.1);
    }
  }

  setTtsVolume(vol) {
    this.ttsVolume = Math.max(0, Math.min(1, parseFloat(vol)));
  }

  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, parseFloat(vol)));
    if (this.sfxGain && this.audioCtx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.audioCtx.currentTime, 0.1);
    }
  }

  // Test 5s functions for Dashboard
  testAmbient5s() {
    this.startAmbient();
    setTimeout(() => {
      // Giữ nguyên nếu đang bật hoặc tắt sau 5s
    }, 5000);
  }
}

window.buongGiamAudio = new BuongGiamAudioEngine();
