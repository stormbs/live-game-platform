// Meme faces — nhân vật người chơi cho các game LIVE.
// Bộ 12 mặt meme GỐC (Chủ tịch chốt dùng ảnh gốc, chấp nhận rủi ro bản quyền).
// Mỗi người chơi được gán 1 mặt CỐ ĐỊNH theo hash tên/uid — người khác nhau
// thì mặt khác nhau, không phải ai cũng chung 1 mặt (yêu cầu Chủ tịch 00:23).
// Gán theo danh sách (assignFaces) để tránh trùng mặt trong cùng 1 game.
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
    'poker', // Poker Face (mặt đơ)
    'crying', // mặt khóc (nước mắt đỏ)
    'okay', // Okay Guy (mặt cam chịu)
    'angry', // mặt giận mắt đỏ, tay với
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

  // Gán mặt cho cả danh sách người chơi: mỗi người 1 mặt khác nhau cho tới
  // khi hết mặt trong bộ (sau đó mới lặp lại). Sắp xếp theo key rồi gán tham
  // lam — mặt ưa thích = hash(key), nếu bị lấy thì lấy mặt kế tiếp còn trống.
  // Trả về object key -> faceId. Dùng cho cả 2 đội để mặt khác nhau toàn game.
  function assignFaces(players) {
    function keyOf(p) {
      if (typeof p === 'string') return p;
      return (p && (p.uid || p.userId || p.id || p.name)) || '';
    }
    var list = (players || []).slice();
    list.sort(function (a, b) {
      var ka = keyOf(a), kb = keyOf(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    var used = {};
    var result = {};
    for (var i = 0; i < list.length; i++) {
      var key = keyOf(list[i]);
      var start = hashStr(key) % FACES.length;
      var idx = start;
      for (var k = 0; k < FACES.length; k++) {
        var cand = (start + k) % FACES.length;
        if (!used[cand]) { idx = cand; break; }
      }
      used[idx] = true;
      result[key] = FACES[idx];
    }
    return result;
  }

  // Mặt của 1 người trong 1 danh sách (tránh trùng với người khác trong list).
  function faceForIn(p, players) {
    var map = assignFaces(players);
    var key = typeof p === 'string' ? p : ((p && (p.uid || p.userId || p.id || p.name)) || '');
    return map[key] || faceFor(p);
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

  // Thẻ <img> mặt meme cho 1 người trong 1 danh sách (tránh trùng mặt).
  function faceImgIn(p, players, cls) {
    var id = faceForIn(p, players);
    var c = cls ? ' class="' + cls + '"' : '';
    return '<img' + c + ' src="' + faceUrl(id) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
  }

  window.MemeFaces = {
    FACES: FACES,
    faceFor: faceFor,
    faceUrl: faceUrl,
    faceImg: faceImg,
    assignFaces: assignFaces,
    faceForIn: faceForIn,
    faceImgIn: faceImgIn,
    hashStr: hashStr,
  };
})();
