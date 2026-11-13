// Meme faces — nhân vật người chơi cho các game LIVE.
// Bộ 8 mặt meme GỐC (Chủ tịch chốt dùng ảnh gốc, chấp nhận rủi ro bản quyền).
// Mỗi người chơi được gán 1 mặt CỐ ĐỊNH theo hash tên/uid — người khác nhau
// thì mặt khác nhau, không phải ai cũng chung 1 mặt (yêu cầu Chủ tịch 00:23).
// File ảnh: /shared/assets/2d/meme/curated/<id>.png (512x512, nền trong suốt).
(function () {
  var FACES = [
    'trollface', // mặt troll gốc
    'panda', // đầu gấu trúc kiểu Hà Nhân
    'forever_alone', // Forever Alone
    'serious', // mặt nghiêm/khó chịu
    'rage', // mặt gào FFFFFUUUU
    'me_gusta', // Me Gusta
    'yuno', // Y U NO (mặt vàng)
    'cereal', // Cereal Guy
  ];
  var BASE = '/shared/assets/2d/meme/curated/';

  // Hash chuỗi đơn giản, ổn định -> số nguyên không âm.
  function hashStr(s) {
    s = String(s || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h < 0 ? -h : h;
  }

  // Mặt của 1 người chơi: hash theo uid (ưu tiên) rồi tên. Trả về id mặt.
  function faceFor(p) {
    var key = '';
    if (p) {
      if (typeof p === 'string') key = p;
      else key = p.uid || p.userId || p.id || p.name || '';
    }
    return FACES[hashStr(key) % FACES.length];
  }

  function faceUrl(id) {
    return BASE + id + '.png';
  }

  // Thẻ <img> mặt meme cho 1 người chơi. cls: class CSS thêm (vd 'meme-face').
  function faceImg(p, cls) {
    var id = faceFor(p);
    var c = cls ? ' class="' + cls + '"' : '';
    return '<img' + c + ' src="' + faceUrl(id) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
  }

  window.MemeFaces = {
    FACES: FACES,
    faceFor: faceFor,
    faceUrl: faceUrl,
    faceImg: faceImg,
    hashStr: hashStr,
  };
})();
