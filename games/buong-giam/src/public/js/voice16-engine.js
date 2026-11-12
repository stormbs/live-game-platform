/**
 * voice16-engine.js - Hệ thống Voice Đọc Luân Phiên 16 Đoạn & Chào Theo Đợt
 * - Đọc liên tục từ 01 -> 16 rồi lặp lại, nghỉ ngắn 3s giữa 2 đoạn để nghe BGM.
 * - Auto-Ducking: BGM giảm xuống 10% khi đọc, đọc xong tăng lại 30% trong 1s.
 * - Ưu tiên tuyệt đối sự kiện: Tương tác đến -> Dừng ngay lập tức.
 * - Replay từ đầu đoạn dở dang (0:00) sau khi sự kiện kết thúc.
 * - CHÀO THEO ĐỢT (Batch Greeting): Gom người mới vào buồng trong khi đọc,
 *   hết đoạn chèn 1 lần duy nhất "Chào mừng các bạn mới vào buồng giam...",
 *   sau đó nghỉ 3s rồi tiếp tục đoạn tiếp theo.
 * - ĐẢM BẢO DUY NHẤT 1 BONG BÓNG VOICE TRÊN OVERLAY, KHÔNG CHỒNG ĐÈ, KHÔNG TRÀN KHUNG HÌNH.
 */

const VOICE_16_SEGMENTS = [
  {
    id: "01",
    displayText: "Mâm cơm nhỏ, hạnh phúc to.",
    speechText: "Mâm cơm nhỏ, hạnh phúc to.",
    fileName: "01.mp3",
    filePath: "/audio/voice_16/01.mp3",
    durationSec: 2.81
  },
  {
    id: "02",
    displayText: "Anh em đến với nhau bằng cái tình cảm. Ăn uống chỉ thêm bát thêm đũa, quan trọng là sống vui vẻ bên nhau.",
    speechText: "Anh em đến với nhau bằng cái tình cảm. Ăn uống chỉ thêm bát thêm đũa, quan trọng là sống vui vẻ bên nhau.",
    fileName: "02.mp3",
    filePath: "/audio/voice_16/02.mp3",
    durationSec: 8.57
  },
  {
    id: "03",
    displayText: "Đã gọi là anh em thì lúc có tiền cũng như lúc không có tiền, hoạn nạn có nhau chứ không phải lúc ăn chơi thì có mặt, lúc hoạn nạn thì mất hút.",
    speechText: "Đã gọi là anh em thì lúc có tiền cũng như lúc không có tiền, hoạn nạn có nhau chứ không phải lúc ăn chơi thì có mặt, lúc hoạn nạn thì mất hút.",
    fileName: "03.mp3",
    filePath: "/audio/voice_16/03.mp3",
    durationSec: 10.99
  },
  {
    id: "04",
    displayText: "Ngậm tăm không ai biết là mình đói.",
    speechText: "Ngậm tăm không ai biết là mình đói.",
    fileName: "04.mp3",
    filePath: "/audio/voice_16/04.mp3",
    durationSec: 2.76
  },
  {
    id: "05",
    displayText: "Nghèo thì cho sạch, rách thì cho thơm. Mình có thể nghèo tiền nghèo bạc chứ không được nghèo nhân cách.",
    speechText: "Nghèo thì cho sạch, rách thì cho thơm. Mình có thể nghèo tiền nghèo bạc chứ không được nghèo nhân cách.",
    fileName: "05.mp3",
    filePath: "/audio/voice_16/05.mp3",
    durationSec: 7.39
  },
  {
    id: "06",
    displayText: "Các em còn trẻ, lo mà học hành, làm ăn giúp đỡ bố mẹ. Đừng dính vào ba cái thứ chất kích thích rồi thân tàn ma dại.",
    speechText: "Các em còn trẻ, lo mà học hành, làm ăn giúp đỡ bố mẹ. Đừng dính vào ba cái thứ chất kích thích rồi thân tàn ma dại.",
    fileName: "06.mp3",
    filePath: "/audio/voice_16/06.mp3",
    durationSec: 10.44
  },
  {
    id: "07",
    displayText: "47 là nhà.",
    speechText: "Bốn bảy là nhà.",
    fileName: "07.mp3",
    filePath: "/audio/voice_16/07.mp3",
    durationSec: 1.63
  },
  {
    id: "08",
    displayText: "Hải Phòng thì anh cũng đã từng ra Hải Phòng, đi qua đường Thủ Dầu có một con sông và một cái cầu gọi nà cầu Nguyệt, dưới chân cầu có một quán chè rất nà ngon...",
    speechText: "Hải Phòng thì anh cũng đã từng ra Hải Phòng, đi qua đường Thủ Dầu có một con sông và một cái cầu gọi nà cầu Nguyệt, dưới chân cầu có một quán chè rất nà ngon...",
    fileName: "08.mp3",
    filePath: "/audio/voice_16/08.mp3",
    durationSec: 12.41
  },
  {
    id: "09",
    displayText: "6789 anh em mình thế thôi, sống bằng cái tình cảm",
    speechText: "Sáu bảy tám chín anh em mình thế thôi, sống bằng cái tình cảm",
    fileName: "09.mp3",
    filePath: "/audio/voice_16/09.mp3",
    durationSec: 4.97
  },
  {
    id: "10",
    displayText: "Các em cứ thử luộc đúng một con gà lên, không cần chặt. Các em để nó nguội xong các em ngồi xé, hai vợ chồng xé. Và những đứa con nhỏ mà các cháu nó không ăn được, thì các em xé nhỏ đút cho các cháu ăn. Xong hai vợ chồng em ăn bằng một con gà luộc lên, không chặt ra mà sẽ xé ở trên mâm. Các em ăn cảm thấy ngon và thú vị như thế nào...",
    speechText: "Các em cứ thử luộc đúng một con gà lên, không cần chặt. Các em để nó nguội xong các em ngồi xé, hai vợ chồng xé. Và những đứa con nhỏ mà các cháu nó không ăn được, thì các em xé nhỏ đút cho các cháu ăn. Xong hai vợ chồng em ăn bằng một con gà luộc lên, không chặt ra mà sẽ xé ở trên mâm. Các em ăn cảm thấy ngon và thú vị như thế nào...",
    fileName: "10.mp3",
    filePath: "/audio/voice_16/10.mp3",
    durationSec: 26.95
  },
  {
    id: "11",
    displayText: "Thà rằng ăn tí bún tí rau, còn hơn thịt cá nói nhau nặng lời... Khi ăn, bát cơm chan nước mắt nó khổ lắm em ạ. Mình ăn bát bún bát rau mà vợ chồng con cái ríu rít, rôm rả cười nói, nó sướng!",
    speechText: "Thà rằng ăn tí bún tí rau, còn hơn thịt cá nói nhau nặng lời... Khi ăn, bát cơm chan nước mắt nó khổ lắm em ạ. Mình ăn bát bún bát rau mà vợ chồng con cái ríu rít, rôm rả cười nói, nó sướng!",
    fileName: "11.mp3",
    filePath: "/audio/voice_16/11.mp3",
    durationSec: 16.97
  },
  {
    id: "12",
    displayText: "Nói ít thôi, đau đầu lắm!",
    speechText: "Nói ít thôi, đau đầu lắm!",
    fileName: "12.mp3",
    filePath: "/audio/voice_16/12.mp3",
    durationSec: 2.57
  },
  {
    id: "13",
    displayText: "Con người mình hay cái đầu của em trông không khác gì một quả trứng em ạ, nó vỡ lúc nào thì biết lúc đấy thôi, mình không nói trước được cái gì cả.",
    speechText: "Con người mình hay cái đầu của em trông không khác gì một quả trứng em ạ, nó vỡ lúc nào thì biết lúc đấy thôi, mình không nói trước được cái gì cả.",
    fileName: "13.mp3",
    filePath: "/audio/voice_16/13.mp3",
    durationSec: 10.22
  },
  {
    id: "14",
    displayText: "Những con người âm thầm đến làm cái rồi đi, anh rất sợ và rất nể.",
    speechText: "Những con người âm thầm đến làm cái rồi đi, anh rất sợ và rất nể.",
    fileName: "14.mp3",
    filePath: "/audio/voice_16/14.mp3",
    durationSec: 5.81
  },
  {
    id: "15",
    displayText: "Sống ở trên đời phải biết trước biết sau, tôn trọng lẫn nhau thì đi đâu cũng được quý mến.",
    speechText: "Sống ở trên đời phải biết trước biết sau, tôn trọng lẫn nhau thì đi đâu cũng được quý mến.",
    fileName: "15.mp3",
    filePath: "/audio/voice_16/15.mp3",
    durationSec: 6.29
  },
  {
    id: "16",
    displayText: "Ấn toa-lét trôi đi mất, chỉ còn lại tình cảm.",
    speechText: "Ấn toa-lét trôi đi mất, chỉ còn lại tình cảm.",
    fileName: "16.mp3",
    filePath: "/audio/voice_16/16.mp3",
    durationSec: 3.62
  }
];

class AlternatingVoicePlayer {
  constructor(socket = null) {
    this.segments = VOICE_16_SEGMENTS;
    this.socket = socket;
    this.audio = new Audio();
    this.audio.preload = 'auto';

    // Settings
    this.enabled = true;
    this.showSubtitle = true; // Hiện bong bóng phụ đề trên overlay (tắt vẫn đọc voice)
    this.volume = 0.85;
    this.pauseSec = 3; // Nghỉ ngắn 3 giây
    this.disabledIds = [];

    // Runtime state
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isPausedBetween = false;
    this.interrupted = false;
    this.interruptedIndex = null;
    this.playedIds = [];
    this.isEventActive = false;

    // Batch greeting state (Cơ chế chào theo đợt)
    this.batchInmatesCount = 0;
    this.isBatchGreetingPlaying = false;
    this.interruptedIsBatchGreeting = false;

    // Timers
    this.pauseTimeout = null;
    this.resumeTimeout = null;

    this.audio.onended = () => this.handleAudioEnded();
    this.audio.onerror = (e) => {
      console.warn('Voice16 audio error (non-fatal, thử lại sau 3s):', e);
      this.isPlaying = false;
      this.isBatchGreetingPlaying = false;
      this.clearAllTimers();
      this.pauseTimeout = setTimeout(() => {
        if (this.enabled && !this.isEventActive) {
          this.playCurrentSegment();
        }
      }, 3000);
    };

    if (this.socket) {
      this.bindSocketEvents();
    }
  }

  setSocket(socket) {
    this.socket = socket;
    this.bindSocketEvents();
  }

  bindSocketEvents() {
    if (!this.socket) return;
    this.socket.on('voice16-cmd', (data) => {
      this.handleCommand(data);
    });
  }

  clearAllTimers() {
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }
    if (this.resumeTimeout) {
      clearTimeout(this.resumeTimeout);
      this.resumeTimeout = null;
    }
  }

  recordNewInmate() {
    this.batchInmatesCount++;
  }

  handleCommand(cmd) {
    if (!cmd || !cmd.action) return;
    switch (cmd.action) {
      case 'reset':
        this.reset(true);
        if (window.buongGiamAudio) window.buongGiamAudio.clearSpeechQueue();
        break;
      case 'flushAudio':
        if (window.buongGiamAudio) window.buongGiamAudio.clearSpeechQueue();
        break;
      case 'toggleMaster':
        this.toggleMaster(cmd.enabled);
        break;
      case 'toggleSubtitle':
        this.setShowSubtitle(cmd.enabled);
        break;
      case 'skip':
        this.skip();
        break;
      case 'toggleSegment':
        this.toggleSegment(cmd.segmentId, cmd.enabled);
        break;
      case 'setVolume':
        this.setVolume(cmd.volume);
        break;
      case 'setPause':
        this.setPauseSec(cmd.pauseSec);
        break;
      case 'syncConfig':
        if (cmd.enabled !== undefined) this.enabled = Boolean(cmd.enabled);
        if (cmd.showSubtitle !== undefined) this.showSubtitle = cmd.showSubtitle !== false;
        if (cmd.volume !== undefined) this.volume = parseFloat(cmd.volume);
        if (cmd.pauseSec !== undefined) this.pauseSec = parseFloat(cmd.pauseSec);
        if (cmd.disabledIds) this.disabledIds = cmd.disabledIds;
        this.broadcastState();
        break;
    }
  }

  start() {
    if (!this.enabled || this.isEventActive || window.isReleaseCeremonyActive) return;
    if (window.buongGiamAudio && (window.buongGiamAudio.isSpeaking || window.buongGiamAudio.isProcessingQueue || window.buongGiamAudio.currentAudio || (window.buongGiamAudio.speechQueue && window.buongGiamAudio.speechQueue.length > 0) || window.buongGiamAudio.queueStepTimer)) return;
    // Chặn triệt để việc gọi start nhiều lần tạo timer song song!
    if (this.isPlaying || this.isPausedBetween || this.isBatchGreetingPlaying) return;
    this.playCurrentSegment();
  }

  playCurrentSegment() {
    if (!this.enabled || this.isEventActive || window.isReleaseCeremonyActive) return;

    // TUYỆT ĐỐI KHÔNG ĐỌC CHỒNG CHÉO: Nếu TTS đang đọc hoặc còn sự kiện trong hàng đợi, nhường chỗ ngay!
    if (window.buongGiamAudio && (window.buongGiamAudio.isSpeaking || window.buongGiamAudio.isProcessingQueue || window.buongGiamAudio.currentAudio || (window.buongGiamAudio.speechQueue && window.buongGiamAudio.speechQueue.length > 0) || window.buongGiamAudio.queueStepTimer)) {
      this.isPlaying = false;
      return;
    }

    this.clearAllTimers();

    // Tìm đoạn tiếp theo hợp lệ (chưa bị tắt)
    let tries = 0;
    while (this.disabledIds.includes(this.segments[this.currentIndex].id) && tries < 16) {
      this.currentIndex = (this.currentIndex + 1) % 16;
      tries++;
    }
    if (tries >= 16) {
      console.log('Tất cả 16 đoạn voice đều bị tắt.');
      this.isPlaying = false;
      this.broadcastState();
      return;
    }

    const seg = this.segments[this.currentIndex];
    this.audio.src = seg.filePath;
    const masterVol = (window.buongGiamAudio && window.buongGiamAudio.masterVolume !== undefined) ? window.buongGiamAudio.masterVolume : 1.0;
    this.audio.volume = Math.max(0, Math.min(1, this.volume * masterVol));

    this.isPlaying = true;
    this.isPausedBetween = false;
    this.isBatchGreetingPlaying = false;
    this.interrupted = false;
    this.interruptedIndex = null;

    // Auto-Ducking: Giảm BGM xuống 10%
    if (window.buongGiamAudio) {
      window.buongGiamAudio.duckAmbient();
    }

    // Hiển thị DUY NHẤT 1 BONG BÓNG VOICE tại vị trí cố định dưới HUD
    if (this.showSubtitle !== false && typeof window.showVoiceSubtitle === 'function') {
      window.showVoiceSubtitle(`"${seg.displayText}"`, 'buong');
    }

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        if (e.name === 'AbortError') return;
        console.warn('Playback deferred (awaiting user interaction):', e);
      });
    }

    this.broadcastState();
  }

  handleAudioEnded() {
    if (window.isReleaseCeremonyActive) {
      this.isPlaying = false;
      this.isBatchGreetingPlaying = false;
      return;
    }

    // Nếu vừa kết thúc câu chào theo đợt
    if (this.isBatchGreetingPlaying) {
      this.isBatchGreetingPlaying = false;
      this.interruptedIsBatchGreeting = false;

      // Hồi phục BGM
      if (window.buongGiamAudio && !this.isEventActive) {
        window.buongGiamAudio.unduckAmbient();
      }

      // Xoá hoặc ẩn phụ đề sau khi đọc xong
      if (typeof window.hideVoiceSubtitle === 'function') {
        window.hideVoiceSubtitle(1500);
      }

      // Nghỉ đúng 3 giây để người xem nghe nhạc nền, sau đó tiếp tục chu kỳ 16 đoạn
      this.isPausedBetween = true;
      this.broadcastState();
      this.clearAllTimers();
      this.pauseTimeout = setTimeout(() => {
        this.isPausedBetween = false;
        if (!this.isEventActive && this.enabled) {
          this.playCurrentSegment();
        }
      }, this.pauseSec * 1000);
      return;
    }

    // Kết thúc 1 đoạn bình thường trong 16 đoạn
    this.isPlaying = false;
    const currentId = this.segments[this.currentIndex].id;
    if (!this.playedIds.includes(currentId)) {
      this.playedIds.push(currentId);
    }

    const enabledSegments = this.segments.filter(s => !this.disabledIds.includes(s.id));
    if (this.playedIds.length >= enabledSegments.length) {
      this.playedIds = [];
    }

    // Chuẩn bị chuyển sang đoạn tiếp theo trong chu kỳ 16
    this.currentIndex = (this.currentIndex + 1) % 16;

    // KIỂM TRA CHÀO THEO ĐỢT (LỖI 2):
    // Nếu có người mới vào buồng trong khi đoạn vừa rồi đang đọc -> Chèn 1 lần voice chào theo đợt!
    // TUYỆT ĐỐI KHÔNG CHÈN NẾU ĐANG CÓ TTS HOẶC HÀNG ĐỢI SỰ KIỆN
    const hasAudioSpeaking = window.buongGiamAudio && (window.buongGiamAudio.isSpeaking || window.buongGiamAudio.isProcessingQueue || window.buongGiamAudio.currentAudio || (window.buongGiamAudio.speechQueue && window.buongGiamAudio.speechQueue.length > 0) || window.buongGiamAudio.queueStepTimer);
    if (this.batchInmatesCount > 0 && !hasAudioSpeaking) {
      this.batchInmatesCount = 0; // Reset số lượng
      this.isBatchGreetingPlaying = true;
      this.isPausedBetween = false;

      // Giữ Ducking BGM
      if (window.buongGiamAudio) {
        window.buongGiamAudio.duckAmbient();
      }

      // Hiển thị phụ đề nhắc nhở người mới
      if (this.showSubtitle !== false && typeof window.showVoiceSubtitle === 'function') {
        window.showVoiceSubtitle('"Chào mừng các bạn mới vào buồng giam, cùng tích cực cải tạo nhé!"', 'quan_giao');
      }

      this.audio.src = '/audio/vi/thank_general.mp3';
      const masterVol = (window.buongGiamAudio && window.buongGiamAudio.masterVolume !== undefined) ? window.buongGiamAudio.masterVolume : 1.0;
      this.audio.volume = Math.max(0, Math.min(1, this.volume * masterVol));

      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          if (e.name === 'AbortError') return;
          console.warn('Batch greeting play error:', e);
          this.handleAudioEnded(); // Bỏ qua nếu lỗi file
        });
      }
      this.broadcastState();
      return;
    }

    // Nếu KHÔNG CÓ người mới vào buồng:
    // Hồi phục BGM lên 30% trong vòng 1s
    if (window.buongGiamAudio && !this.isEventActive) {
      window.buongGiamAudio.unduckAmbient();
    }

    // Xoá hoặc ẩn phụ đề sau khi đọc xong
    if (typeof window.hideVoiceSubtitle === 'function') {
      window.hideVoiceSubtitle(2000);
    }

    this.isPausedBetween = true;
    this.broadcastState();

    // Nghỉ đúng 3 giây để người xem nghe nhạc nền
    this.clearAllTimers();
    this.pauseTimeout = setTimeout(() => {
      this.isPausedBetween = false;
      if (!this.isEventActive && this.enabled) {
        if (window.buongGiamAudio && (window.buongGiamAudio.isSpeaking || (window.buongGiamAudio.speechQueue && window.buongGiamAudio.speechQueue.length > 0))) {
          return;
        }
        this.playCurrentSegment();
      }
    }, this.pauseSec * 1000);
  }

  pauseForEvent(durationMs = 0) {
    this.interruptForEvent();
    if (durationMs > 0) {
      if (this.pauseEventTimeout) clearTimeout(this.pauseEventTimeout);
      this.pauseEventTimeout = setTimeout(() => {
        if (!window.isReleaseCeremonyActive) {
          this.resumeAfterEvent();
        }
      }, durationMs);
    }
  }

  // ================= ƯU TIÊN SỰ KIỆN: DỪNG NGAY & REPLAY TỪ ĐẦU =================
  interruptForEvent() {
    this.clearAllTimers();
    this.isPausedBetween = false;

    if (this.isPlaying || this.isBatchGreetingPlaying) {
      if (!this.interrupted) {
        this.interrupted = true;
        this.interruptedIndex = this.currentIndex;
        this.interruptedIsBatchGreeting = this.isBatchGreetingPlaying;
      }
      try {
        this.audio.pause();
        this.audio.currentTime = 0; // Replay từ 0:00 sau đó!
      } catch(e){}
      this.isPlaying = false;
      this.isBatchGreetingPlaying = false;
    }

    // Ẩn ngay lập tức phụ đề voice để nhường chỗ cho sự kiện
    if (typeof window.hideVoiceSubtitle === 'function') {
      window.hideVoiceSubtitle(0);
    }

    this.isEventActive = true;
    this.broadcastState();
  }

  resumeAfterEvent() {
    this.isEventActive = false;
    if (!this.enabled || window.isReleaseCeremonyActive) return;

    // TUYỆT ĐỐI KHÔNG RESUME NẾU AUDIO ENGINE VẪN ĐANG NÓI HOẶC CÒN HÀNG ĐỢI
    if (window.buongGiamAudio && (window.buongGiamAudio.isSpeaking || window.buongGiamAudio.isProcessingQueue || window.buongGiamAudio.currentAudio || (window.buongGiamAudio.speechQueue && window.buongGiamAudio.speechQueue.length > 0) || window.buongGiamAudio.queueStepTimer)) {
      return;
    }

    this.clearAllTimers();
    // Chờ 1200ms sau khi giọng đọc thông báo sự kiện dứt hẳn để đảm bảo yên lặng tuyệt đối
    this.resumeTimeout = setTimeout(() => {
      this.resumeTimeout = null;
      if (this.isEventActive || !this.enabled || window.isReleaseCeremonyActive) return;
      if (window.buongGiamAudio && (window.buongGiamAudio.isSpeaking || window.buongGiamAudio.isProcessingQueue || window.buongGiamAudio.currentAudio || (window.buongGiamAudio.speechQueue && window.buongGiamAudio.speechQueue.length > 0) || window.buongGiamAudio.queueStepTimer)) {
        return;
      }
      if (this.isPlaying || this.isBatchGreetingPlaying) return;

      if (this.interrupted) {
        if (this.interruptedIsBatchGreeting) {
          // Replay câu chào theo đợt từ đầu
          this.interrupted = false;
          this.interruptedIsBatchGreeting = false;
          this.batchInmatesCount = 1;
          this.handleAudioEnded();
        } else if (this.interruptedIndex !== null) {
          // ĐỌC LẠI TỪ ĐẦU ĐOẠN ĐANG ĐỌC DỞ
          this.currentIndex = this.interruptedIndex;
          this.interrupted = false;
          this.interruptedIndex = null;
          this.playCurrentSegment();
        }
      } else if (!this.isPlaying && !this.isPausedBetween && !this.isBatchGreetingPlaying) {
        this.playCurrentSegment();
      }
    }, 1200);
  }

  // ================= NÚT BỎ QUA ĐOẠN NÀY (NEXT) =================
  skip() {
    this.clearAllTimers();
    if (this.isPlaying || this.isBatchGreetingPlaying) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch(e){}
      this.isPlaying = false;
      this.isBatchGreetingPlaying = false;
    }
    this.interrupted = false;
    this.interruptedIndex = null;
    this.interruptedIsBatchGreeting = false;

    const currentId = this.segments[this.currentIndex].id;
    if (!this.playedIds.includes(currentId)) {
      this.playedIds.push(currentId);
    }
    this.currentIndex = (this.currentIndex + 1) % 16;
    this.playCurrentSegment();
  }

  // ================= RESET PHIÊN LIVE =================
  reset(autoStart = true) {
    this.clearAllTimers();
    this.isPausedBetween = false;
    this.isPlaying = false;
    this.isBatchGreetingPlaying = false;
    this.interrupted = false;
    this.interruptedIndex = null;
    this.interruptedIsBatchGreeting = false;
    this.isEventActive = false;
    this.batchInmatesCount = 0;
    this.currentIndex = 0;
    this.playedIds = [];
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch(e){}
    if (window.buongGiamAudio) {
      window.buongGiamAudio.unduckAmbient();
    }
    if (typeof window.hideVoiceSubtitle === 'function') {
      window.hideVoiceSubtitle(0);
    }
    this.broadcastState();

    if (autoStart && this.enabled) {
      // Đọc ngay đoạn 01 từ đầu khi phiên LIVE bắt đầu mới
      this.pauseTimeout = setTimeout(() => {
        if (!this.isPlaying && this.enabled && !this.isEventActive) {
          this.playCurrentSegment();
        }
      }, 400);
    }
  }

  // ================= BẬT / TẮT MASTER =================
  toggleMaster(forceState) {
    const newState = (forceState !== undefined) ? Boolean(forceState) : !this.enabled;
    this.enabled = newState;

    if (!this.enabled) {
      this.clearAllTimers();
      if (this.isPlaying || this.isBatchGreetingPlaying) {
        try {
          this.audio.pause();
          this.audio.currentTime = 0;
        } catch(e){}
        this.isPlaying = false;
        this.isBatchGreetingPlaying = false;
      }
      if (window.buongGiamAudio) {
        window.buongGiamAudio.unduckAmbient();
      }
      if (typeof window.hideVoiceSubtitle === 'function') {
        window.hideVoiceSubtitle(0);
      }
      // Khi tắt, chuyển sang đoạn tiếp theo để khi bật lại sẽ đọc đoạn tiếp theo
      this.currentIndex = (this.currentIndex + 1) % 16;
      this.broadcastState();
    } else {
      // Khi bật lại, đọc ngay đoạn tiếp theo
      this.broadcastState();
      this.playCurrentSegment();
    }
  }

  // ================= BẬT / TẮT BONG BÓNG PHỤ ĐỀ (voice vẫn đọc) =================
  setShowSubtitle(isEnabled) {
    this.showSubtitle = isEnabled !== false;
    if (!this.showSubtitle && typeof window.hideVoiceSubtitle === 'function') {
      window.hideVoiceSubtitle(0); // Ẩn ngay bong bóng đang hiện
    }
    this.broadcastState();
  }

  // ================= BẬT / TẮT TỪNG ĐOẠN =================
  toggleSegment(segmentId, isEnabled) {
    const idStr = String(segmentId).padStart(2, '0');
    if (isEnabled) {
      this.disabledIds = this.disabledIds.filter(id => id !== idStr);
    } else {
      if (!this.disabledIds.includes(idStr)) {
        this.disabledIds.push(idStr);
      }
      // Nếu đang đọc chính đoạn bị tắt này thì bỏ qua ngay lập tức
      if (this.isPlaying && this.segments[this.currentIndex].id === idStr) {
        this.skip();
        return;
      }
    }
    this.broadcastState();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, parseFloat(vol)));
    if (this.isPlaying || this.isBatchGreetingPlaying) {
      const masterVol = (window.buongGiamAudio && window.buongGiamAudio.masterVolume !== undefined) ? window.buongGiamAudio.masterVolume : 1.0;
      this.audio.volume = Math.max(0, Math.min(1, this.volume * masterVol));
    }
    this.broadcastState();
  }

  setPauseSec(sec) {
    this.pauseSec = Math.max(1, Math.min(10, parseFloat(sec)));
    this.broadcastState();
  }

  getState() {
    return {
      enabled: this.enabled,
      showSubtitle: this.showSubtitle,
      volume: this.volume,
      pauseSec: this.pauseSec,
      disabledIds: this.disabledIds,
      currentIndex: this.currentIndex,
      currentId: this.isPlaying ? this.segments[this.currentIndex].id : null,
      isPlaying: this.isPlaying,
      isPausedBetween: this.isPausedBetween,
      isBatchGreetingPlaying: this.isBatchGreetingPlaying,
      interrupted: this.interrupted,
      playedIds: this.playedIds
    };
  }

  broadcastState() {
    const state = this.getState();
    if (this.socket) {
      this.socket.emit('voice16-status', state);
    }
  }
}

// Khởi tạo đối tượng toàn cục
window.buongGiamVoice16 = new AlternatingVoicePlayer();
