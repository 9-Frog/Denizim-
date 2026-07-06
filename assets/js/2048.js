(() => {
  const size = 4;
  const boardShell = document.getElementById('board-shell');
  const tileLayer = document.getElementById('tile-layer');
  const particleLayer = document.getElementById('particle-layer');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best-score');
  const moveCountEl = document.getElementById('move-count');
  const targetStatusEl = document.getElementById('target-status');
  const messageEl = document.getElementById('game-message');
  const inlineNoteEl = document.getElementById('inline-note');
  const lockChipEl = document.getElementById('lock-chip');
  const newGameBtn = document.getElementById('new-game-btn');
  const quizOverlay = document.getElementById('quiz-overlay');
  const userStage = document.getElementById('user-stage');
  const questionStage = document.getElementById('question-stage');
  const playerFeedbackEl = document.getElementById('player-feedback');
  const playerButtons = [...document.querySelectorAll('.player-option')];
  const quizPlayerEl = document.getElementById('quiz-player');
  const quizSubjectEl = document.getElementById('quiz-subject');
  const quizCounterEl = document.getElementById('quiz-counter');
  const quizQuestionEl = document.getElementById('quiz-question');
  const quizOptionsEl = document.getElementById('quiz-options');
  const quizFeedbackEl = document.getElementById('quiz-feedback');
  const jumpscareOverlay = document.getElementById('jumpscare-overlay');
  const jumpscareAudio = document.getElementById('jumpscare-audio');
  const closeJumpscareBtn = document.getElementById('close-jumpscare');
  const gameOverVideoOverlay = document.getElementById('game-over-video-overlay');
  const gameOverVideo = document.getElementById('game-over-video');
  const playerBestEls = {
    Hakan: document.querySelector('[data-player-best="Hakan"]'),
    Deniz: document.querySelector('[data-player-best="Deniz"]')
  };

  if (!boardShell || !tileLayer) return;

  const tileEls = new Map();
  let audioCtx = null;

  const game = {
    board: createEmptyBoard(),
    tileId: 1,
    score: 0,
    bestScores: loadBestScores(),
    selectedUser: '',
    moves: 0,
    unlocked: false,
    jumpscared: false,
    won2048: false,
    hasLost: false,
    processing: false,
    lastQuestionIndex: -1,
    question: null,
    questionBank: []
  };

  function createEmptyBoard() {
    return Array.from({ length: size }, () => Array(size).fill(null));
  }

  function storageBestKey(user) {
    return `denizim_2048_best_${user}`;
  }

  function loadBestScores() {
    return {
      Hakan: Number(localStorage.getItem(storageBestKey('Hakan')) || 0),
      Deniz: Number(localStorage.getItem(storageBestKey('Deniz')) || 0)
    };
  }

  function currentBest() {
    return game.selectedUser ? (game.bestScores[game.selectedUser] || 0) : 0;
  }

  function updatePlayerBestCards() {
    Object.entries(playerBestEls).forEach(([name, el]) => {
      if (el) el.textContent = String(game.bestScores[name] || 0);
    });
  }

  function setQuizStage(stage) {
    if (stage === 'selector') {
      if (userStage) userStage.classList.remove('hidden');
      if (questionStage) questionStage.classList.add('hidden');
      if (quizOverlay) {
        quizOverlay.classList.remove('hidden');
        quizOverlay.setAttribute('aria-hidden', 'false');
      }
      return;
    }
    if (userStage) userStage.classList.add('hidden');
    if (questionStage) questionStage.classList.remove('hidden');
    if (quizOverlay) {
      quizOverlay.classList.remove('hidden');
      quizOverlay.setAttribute('aria-hidden', 'false');
    }
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  }

  function playTone(type, value = 0) {
    ensureAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);
    gain.gain.value = 0.0001;

    const osc = audioCtx.createOscillator();
    osc.connect(gain);

    if (type === 'move') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(170, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.start(now); osc.stop(now + 0.1);
      return;
    }

    if (type === 'merge') {
      const freq = Math.min(880, 180 + Math.log2(value || 2) * 60);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now); osc.stop(now + 0.2);
      return;
    }

    if (type === 'success') {
      [0, 0.09, 0.18].forEach((offset, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime([330, 440, 554][i], now + offset);
        g.gain.setValueAtTime(0.0001, now + offset);
        g.gain.exponentialRampToValueAtTime(0.04, now + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
        o.start(now + offset); o.stop(now + offset + 0.2);
      });
      return;
    }

    if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.start(now); osc.stop(now + 0.21);
      return;
    }
  }

  function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function uniqueWrongs(values, correct) {
    const set = new Set();
    values.forEach((v) => {
      const txt = String(v);
      if (txt !== String(correct)) set.add(txt);
    });
    return [...set];
  }

  function makeQuestion(subject, prompt, correct, wrongCandidates) {
    const wrongs = shuffle(uniqueWrongs(wrongCandidates, correct)).slice(0, 3);
    const options = shuffle([String(correct), ...wrongs.map(String)]);
    return {
      subject,
      prompt,
      options,
      answer: options.indexOf(String(correct))
    };
  }

  function buildQuestionBank() {
    const questions = [];
    const add = (subject, prompt, correct, wrongs) => questions.push(makeQuestion(subject, prompt, correct, wrongs));

    // 1) Matematik – işlemler ve denklem (100)
    for (let i = 0; i < 50; i += 1) {
      const a = 12 + i;
      const b = 7 + (i * 3) % 23;
      add('Matematik', `${a} + ${b} işleminin sonucu kaçtır?`, a + b, [a + b + 1, a + b - 1, a + b + 2, a + b - 2]);
    }
    for (let i = 0; i < 50; i += 1) {
      const x = 4 + i;
      const addend = 3 + (i * 2) % 12;
      const total = x + addend;
      add('Matematik', `x + ${addend} = ${total} olduğuna göre x kaçtır?`, x, [x + 1, x - 1, x + 2, x + 3]);
    }

    // 2) Matematik – yüzde ve kesir (80)
    for (let i = 0; i < 40; i += 1) {
      const percent = [10, 20, 25, 30, 40, 50][i % 6];
      const base = 40 + i * 5;
      const correct = Math.round(base * percent / 100);
      add('Matematik', `${base} sayısının %${percent}'i kaçtır?`, correct, [correct + 5, Math.max(1, correct - 5), correct + 10, Math.max(1, correct - 10)]);
    }
    for (let i = 0; i < 40; i += 1) {
      const denom = [5, 6, 8, 10][i % 4];
      const numer1 = 1 + (i % (denom - 1));
      const numer2 = 1;
      const result = `${numer1 + numer2}/${denom}`;
      add('Matematik', `${numer1}/${denom} + ${numer2}/${denom} işleminin sonucu hangisidir?`, result, [`${numer1}/${denom}`, `${numer1 + 2}/${denom}`, `${Math.max(1, numer1 - 1)}/${denom}`, `${numer1 + numer2}/${Math.max(2, denom - 1)}`]);
    }

    // 3) Matematik – üs ve kök (50)
    for (let i = 0; i < 25; i += 1) {
      const base = 2 + (i % 5);
      const pow = 2 + (i % 3);
      const correct = base ** pow;
      add('Matematik', `${base}^${pow} kaçtır?`, correct, [correct + base, correct - base, correct + 2, Math.max(1, correct - 2)]);
    }
    const roots = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225, 256, 289, 324, 361, 400, 441, 484, 529, 576, 625, 676];
    roots.forEach((num, idx) => {
      const root = Math.sqrt(num);
      add('Matematik', `√${num} kaçtır?`, root, [root + 1, Math.max(1, root - 1), root + 2, Math.max(1, root - 2)]);
    });

    // 4) Geometri (50)
    for (let i = 0; i < 25; i += 1) {
      const shortSide = 3 + (i % 6);
      const longSide = 7 + (i % 8);
      add('Geometri', `Kısa kenarı ${shortSide} cm, uzun kenarı ${longSide} cm olan dikdörtgenin alanı kaç cm²'dir?`, shortSide * longSide, [shortSide + longSide, 2 * (shortSide + longSide), shortSide * longSide + longSide, shortSide * longSide - shortSide]);
    }
    for (let i = 0; i < 25; i += 1) {
      const a = 5 + (i % 7);
      const b = 6 + (i % 8);
      add('Geometri', `Kenarları ${a} cm ve ${b} cm olan dikdörtgenin çevresi kaç cm'dir?`, 2 * (a + b), [a + b, a * b, 2 * a + b, a + 2 * b]);
    }

    // 5) Sayısal mantık dizileri (40)
    for (let i = 0; i < 20; i += 1) {
      const start = 2 + i;
      const diff = 2 + (i % 4);
      const a = start;
      const b = start + diff;
      const c = start + diff * 2;
      const d = start + diff * 3;
      const correct = start + diff * 4;
      add('Mantık', `${a}, ${b}, ${c}, ${d}, ... dizisinde sıradaki sayı kaçtır?`, correct, [correct + diff, correct - diff, correct + 2, Math.max(1, correct - 2)]);
    }
    for (let i = 0; i < 20; i += 1) {
      const base = 1 + (i % 5);
      const a = base;
      const b = base * 2;
      const c = base * 4;
      const d = base * 8;
      const correct = base * 16;
      add('Mantık', `${a}, ${b}, ${c}, ${d}, ... dizisinde sıradaki sayı hangisidir?`, correct, [correct / 2, correct + base, correct * 2, correct - base]);
    }

    // 6) İngilizce (40)
    [
      ['book', 'kitap'], ['school', 'okul'], ['teacher', 'öğretmen'], ['window', 'pencere'], ['table', 'masa'],
      ['chair', 'sandalye'], ['pencil', 'kalem'], ['friend', 'arkadaş'], ['family', 'aile'], ['city', 'şehir'],
      ['country', 'ülke'], ['water', 'su'], ['food', 'yiyecek'], ['morning', 'sabah'], ['night', 'gece'],
      ['happy', 'mutlu'], ['sad', 'üzgün'], ['fast', 'hızlı'], ['slow', 'yavaş'], ['big', 'büyük'],
      ['small', 'küçük'], ['cold', 'soğuk'], ['hot', 'sıcak'], ['open', 'açık'], ['close', 'kapatmak'],
      ['write', 'yazmak'], ['read', 'okumak'], ['listen', 'dinlemek'], ['speak', 'konuşmak'], ['question', 'soru'],
      ['answer', 'cevap'], ['science', 'bilim'], ['history', 'tarih'], ['music', 'müzik'], ['garden', 'bahçe'],
      ['market', 'pazar'], ['hospital', 'hastane'], ['river', 'nehir'], ['mountain', 'dağ'], ['language', 'dil']
    ].forEach(([word, tr], idx, arr) => {
      const wrongs = shuffle(arr.filter(([, value]) => value !== tr).map(([, value]) => value)).slice(0, 4);
      add('İngilizce', `"${word}" kelimesinin Türkçe karşılığı hangisidir?`, tr, wrongs);
    });

    // 7) Biyoloji (20)
    [
      ['Hücrede enerji üretiminden sorumlu organel hangisidir?', 'Mitokondri', ['Ribozom', 'Golgi aygıtı', 'Lizozom']],
      ['Bitkiler fotosentezi hangi yapıda gerçekleştirir?', 'Kloroplast', ['Mitokondri', 'Koful', 'Çekirdek']],
      ['İnsan vücudunda kanı pompalayan organ hangisidir?', 'Kalp', ['Akciğer', 'Karaciğer', 'Mide']],
      ['Solunum sistemi organlarından biri hangisidir?', 'Akciğer', ['Böbrek', 'Dalak', 'Pankreas']],
      ['Sindirim ağızda hangi işlemle başlar?', 'Çiğneme', ['Süzülme', 'Dolaşım', 'Filtreleme']],
      ["DNA'nın açılımı aşağıdakilerden hangisidir?", 'Deoksiribonükleik asit', ['Ribonükleik asit', 'Amino asit', 'Folik asit']],
      ['Vücudumuzda oksijeni taşıyan yapı hangisidir?', 'Alyuvar', ['Akyuvar', 'Trombosit', 'Sinir']],
      ['Kemiklerin birleştiği yere ne ad verilir?', 'Eklem', ['Kas', 'Damar', 'Doku']],
      ['Bitkiler kökleriyle topraktan en çok ne alır?', 'Su ve mineral', ['Oksijen ve yağ', 'Protein ve vitamin', 'Karbonhidrat ve yağ']],
      ['Gözün renkli kısmına ne ad verilir?', 'İris', ['Retina', 'Kornea', 'Sinir tabakası']],
      ['Canlıların en küçük yapı birimi hangisidir?', 'Hücre', ['Doku', 'Organ', 'Sistem']],
      ['Vitamin eksikliğinde bağışıklık sistemi genelde nasıl etkilenir?', 'Zayıflar', ['Hızlanır', 'Kemikleşir', 'Büyür']],
      ['Bitkilerde su taşınmasında görevli yapı hangisidir?', 'Ksilem', ['Floem', 'Stoma', 'Tohum']],
      ['İnsanda görme olayı hangi duyu organı ile gerçekleşir?', 'Göz', ['Kulak', 'Burun', 'Deri']],
      ['Soluk verme sırasında vücuttan hangi gaz atılır?', 'Karbondioksit', ['Azot', 'Ozon', 'Helyum']],
      ['Kasların çalışması için temel enerji kaynağı hangisidir?', 'ATP', ['DNA', 'RNA', 'Kalsiyum']],
      ['Bitkilerde gaz alışverişi çoğunlukla nereden olur?', 'Stoma', ['Çiçek', 'Meyve', 'Tohum']],
      ['Sinir hücresine ne ad verilir?', 'Nöron', ['Kas lifi', 'Alyuvar', 'Lenf']],
      ['İnsan vücudunda idrarı süzen organ hangisidir?', 'Böbrek', ['Karaciğer', 'Mide', 'Pankreas']],
      ['Dolaşım sisteminde kanı vücuda taşıyan yapı hangisidir?', 'Damarlar', ['Kaslar', 'Kemikler', 'Sinirler']]
    ].forEach(([prompt, correct, wrongs]) => add('Biyoloji', prompt, correct, wrongs));

    // 8) Kimya (20)
    [
      ['Suyun kimyasal formülü hangisidir?', 'H2O', ['CO2', 'O2', 'NaCl']],
      ['Tuzun kimyasal adı aşağıdakilerden hangisidir?', 'Sodyum klorür', ['Kalsiyum karbonat', 'Magnezyum sülfat', 'Potasyum nitrat']],
      ['Oksijen elementinin sembolü nedir?', 'O', ['Ox', 'Og', 'Om']],
      ['Altının kimyasal sembolü hangisidir?', 'Au', ['Ag', 'Al', 'Gd']],
      ['Karbonun sembolü nedir?', 'C', ['Ca', 'Co', 'Cr']],
      ['Demirin sembolü hangisidir?', 'Fe', ['Fr', 'F', 'Fm']],
      ['Asitler turnusol kağıdını hangi renge çevirir?', 'Kırmızı', ['Mavi', 'Yeşil', 'Sarı']],
      ['Bazlar turnusol kağıdını hangi renge çevirir?', 'Mavi', ['Kırmızı', 'Mor', 'Turuncu']],
      ['Periyodik tabloda elementler neye göre sıralanır?', 'Atom numarasına göre', ['Kütlelerine göre rastgele', 'Renklerine göre', 'Yoğunluklarına göre']],
      ['Na sembolü hangi elemente aittir?', 'Sodyum', ['Azot', 'Nikel', 'Neon']],
      ['Oda sıcaklığında sıvı olan metal hangisidir?', 'Cıva', ['Demir', 'Bakır', 'Alüminyum']],
      ['CO2 hangi maddenin formülüdür?', 'Karbondioksit', ['Karbonmonoksit', 'Kalsiyum oksit', 'Klor']],
      ['Kimyada pH 7 neyi ifade eder?', 'Nötr ortamı', ['Kuvvetli asidi', 'Kuvvetli bazı', 'Katıyı']],
      ['Bileşik oluşturan tanecikler genellikle nelerdir?', 'Atomlar', ['Sadece elektronlar', 'Sadece protonlar', 'Işık tanecikleri']],
      ['Kirecin ana bileşeni hangisidir?', 'Kalsiyum karbonat', ['Sodyum klorür', 'Potasyum iyodür', 'Amonyak']],
      ['Saf suyun rengi nasıldır?', 'Renksiz', ['Kırmızı', 'Kahverengi', 'Mavi']],
      ['He sembolü hangi elemente aittir?', 'Helyum', ['Hidrojen', 'Hafniyum', 'Holmiyum']],
      ['N2 gazı temel olarak neyi ifade eder?', 'Azot gazını', ['Oksijen gazını', 'Klor gazını', 'Su buharını']],
      ['Kimyasal değişimde aşağıdakilerden hangisi oluşabilir?', 'Yeni madde', ['Sadece şekil değişimi', 'Sadece erime', 'Sadece kırılma']],
      ['Maddenin en küçük yapı taşlarından biri hangisidir?', 'Atom', ['Gezegen', 'Bulut', 'Işın']]
    ].forEach(([prompt, correct, wrongs]) => add('Kimya', prompt, correct, wrongs));

    // 9) Fizik (20)
    [
      ['Hızın SI birimi hangisidir?', 'm/s', ['kg', 'N', 'J']],
      ['Kuvvetin birimi nedir?', 'Newton', ['Pascal', 'Joule', 'Watt']],
      ['Elektrik akımının birimi hangisidir?', 'Amper', ['Volt', 'Ohm', 'Lümen']],
      ["Işığın boşluktaki hızı yaklaşık olarak kaç km/s'dir?", '300000', ['3000', '30000', '300']],
      ['Sesin yayılması için aşağıdakilerden hangisi gerekir?', 'Bir ortam', ['Sadece ışık', 'Yer çekimsiz alan', 'Mutlak boşluk']],
      ["Dünya'da bizi yere çeken etkiye ne denir?", 'Yer çekimi', ['İtme kuvveti', 'Manyetizma', 'Sürtünme']],
      ['Basınç birimi hangisidir?', 'Pascal', ['Newton', 'Watt', 'Amper']],
      ['Enerjinin birimi nedir?', 'Joule', ['Metre', 'Kelvin', 'Volt']],
      ['Elektrik devresinde ampulün parlaklığını ne etkiler?', 'Akım ve gerilim', ['Sadece kablonun rengi', 'Sadece pilin şekli', 'Anahtarın rengi']],
      ['Madde ısı aldığında genellikle ne olur?', 'Sıcaklığı artar', ['Kütlesi yok olur', 'Rengi kaybolur', 'Boşlukta asılı kalır']],
      ['Aynada oluşan görüntü hangi olayla ilgilidir?', 'Yansıma', ['Kırılma', 'Genleşme', 'Yoğunlaşma']],
      ['Mıknatıs en güçlü çekimi nerede gösterir?', 'Kutuplarında', ['Ortasında', 'Renginde', 'Gölgesinde']],
      ['Bir cisim hareket etmiyorsa hızı kaçtır?', '0', ['1', '10', '-10']],
      ['Watt hangi büyüklüğün birimidir?', 'Güç', ['Basınç', 'Hacim', 'Uzunluk']],
      ['Yukarı atılan cisim en üst noktada ne olur?', 'Hızı kısa süreliğine 0 olur', ['Kütlesi kaybolur', 'Rengi değişir', 'Işığa dönüşür']],
      ['Elektrik yükleri arasında aynı cins yükler nasıl etkileşir?', 'Birbirini iter', ['Birbirini çeker', 'Etkileşmez', 'Birleşir']],
      ['Isı iletiminde metaller genelde nasıldır?', 'İyi iletkendir', ['Yalıtkandır', 'Sıvıdır', 'Görünmezdir']],
      ['Termometre neyi ölçer?', 'Sıcaklığı', ['Kütleyi', 'Basıncı', 'Sürati']],
      ['Bir cismin ağırlığı neye bağlıdır?', 'Yer çekimi kuvvetine', ['Sadece rengine', 'Sadece şekline', 'Sadece hacmine']],
      ['Voltajın birimi hangisidir?', 'Volt', ['Watt', 'Ohm', 'Tesla']]
    ].forEach(([prompt, correct, wrongs]) => add('Fizik', prompt, correct, wrongs));

    // 10) Tarih (20)
    [
      ['Türkiye Cumhuriyeti hangi yıl kuruldu?', '1923', ['1919', '1920', '1938']],
      ['TBMM hangi şehirde açılmıştır?', 'Ankara', ['İstanbul', 'İzmir', 'Bursa']],
      ['Mustafa Kemal Atatürk hangi savaşta Anafartalar kahramanı olarak tanınmıştır?', 'Çanakkale Savaşı', ['Sakarya Savaşı', 'Dumlupınar Savaşı', 'Kurtuluş Savaşı']],
      ['Kurtuluş Savaşı sonrası imzalanan barış antlaşması hangisidir?', 'Lozan Antlaşması', ['Mondros Ateşkesi', 'Sevr Antlaşması', 'Mudanya Ateşkesi']],
      ["Osmanlı Devleti'nin ilk başkenti neresidir?", 'Bursa', ['Edirne', 'İstanbul', 'Ankara']],
      ['İstanbul hangi padişah döneminde fethedildi?', 'Fatih Sultan Mehmet', ['Yavuz Sultan Selim', 'Kanuni Sultan Süleyman', 'II. Abdülhamid']],
      ['İlk Türk alfabesi reformu hangi lider döneminde yapıldı?', 'Atatürk', ['İnönü', 'Menderes', 'Bayar']],
      ['Saltanat hangi yıl kaldırıldı?', '1922', ['1923', '1924', '1930']],
      ['Cumhuriyet ilan edilmeden önce uygulanan yönetim biçimi ağırlıklı olarak neydi?', 'Monarşi', ['Cumhuriyet', 'Federasyon', 'Demokrasi']],
      ['Misak-ı Milli kararları hangi mecliste kabul edildi?', 'Son Osmanlı Mebusan Meclisi', ['TBMM', 'Ayan Meclisi', 'Danıştay']],
      ['İlk düzenli ordu hangi dönemde kurulmuştur?', 'Kurtuluş Savaşı', ['Lale Devri', 'Tanzimat', 'Servetifünun']],
      ['Anadolu Ajansı hangi dönemde kurulmuştur?', 'Milli Mücadele Dönemi', ['Lale Devri', 'Islahat Dönemi', 'II. Meşrutiyet sonrası değil']],
      ["Osmanlı Devleti'nde Kanuni olarak bilinen padişah kimdir?", 'Kanuni Sultan Süleyman', ['Fatih Sultan Mehmet', 'Yıldırım Bayezid', 'II. Mahmud']],
      ['Cumhuriyet döneminde kadınlara seçme hakkı hangi dönemde verilmiştir?', 'Atatürk dönemi', ['Osmanlı dönemi', 'II. Abdülhamid dönemi', 'Klasik dönem']],
      ["Ankara'nın başkent oluş yılı hangisidir?", '1923', ['1920', '1921', '1933']],
      ["Atatürk'ün doğduğu şehir hangisidir?", 'Selanik', ['İstanbul', 'Ankara', 'Bursa']],
      ['Mondros Ateşkes Antlaşması hangi savaş sonrası imzalanmıştır?', 'I. Dünya Savaşı', ['II. Dünya Savaşı', 'Balkan Savaşı', 'Kırım Savaşı']],
      ["Türkiye'de çok partili hayata geçiş denemelerinden biri hangisidir?", 'Serbest Cumhuriyet Fırkası', ['İttihat ve Terakki', 'Ayan Meclisi', 'Halk Evleri']],
      ["Osmanlı'da ilk anayasa hangi isimle bilinir?", 'Kanun-i Esasi', ['Teşkilat-ı Esasiye', 'Islahat Fermanı', 'Sened-i İttifak']],
      ['Cumhuriyetin ilk yıllarında yapılan büyük ekonomik toplantı hangisidir?', 'İzmir İktisat Kongresi', ['Lozan Konferansı', 'Erzurum Kongresi', 'Sivas Kongresi']]
    ].forEach(([prompt, correct, wrongs]) => add('Tarih', prompt, correct, wrongs));

    // 11) Coğrafya (20)
    [
      ["Türkiye'nin başkenti neresidir?", 'Ankara', ['İstanbul', 'İzmir', 'Bursa']],
      ["Ege Denizi Türkiye'nin hangi yönündedir?", 'Batısında', ['Doğusunda', 'Kuzeyinde', 'Güneyinde']],
      ['Karadeniz Bölgesi hangi denize kıyısı olduğu için bu adı alır?', 'Karadeniz', ['Ege Denizi', 'Akdeniz', 'Marmara Denizi']],
      ["Türkiye'nin en kalabalık şehri hangisidir?", 'İstanbul', ['Ankara', 'İzmir', 'Bursa']],
      ['Dünyanın en büyük okyanusu hangisidir?', 'Büyük Okyanus', ['Atlas Okyanusu', 'Hint Okyanusu', 'Arktik Okyanusu']],
      ['Ekvator hangi iki yarım küreyi ayırır?', 'Kuzey ve Güney', ['Doğu ve Batı', 'Yaz ve Kış', 'Dağ ve ova']],
      ['Yağışın fazla olduğu bölgelerde hangi bitki örtüsü yaygın olabilir?', 'Orman', ['Çöl', 'Step', 'Tundra']],
      ["Türkiye'de çayın en fazla yetiştirildiği il hangisidir?", 'Rize', ['Konya', 'Adana', 'Edirne']],
      ['Akdeniz ikliminde yazlar genellikle nasıldır?', 'Sıcak ve kurak', ['Soğuk ve karlı', 'Ilık ve yağışlı', 'Sisli ve fırtınalı']],
      ['Bir yerin haritadaki sembollerle gösterimine ne denir?', 'Lejant', ['Meridyen', 'Paralel', 'Ölçek']],
      ["Türkiye'nin en büyük gölü hangisidir?", 'Van Gölü', ['Tuz Gölü', 'Beyşehir Gölü', 'Sapanca Gölü']],
      ['Dağların denize paralel uzandığı yerlerde kıyı ile iç kesim ulaşımı nasıl olur?', 'Zor olur', ['Çok kolay olur', 'Her zaman düzdür', 'Sıfır olur']],
      ['Dünyanın uydusu hangisidir?', 'Ay', ['Mars', 'Venüs', 'Güneş']],
      ["İç Anadolu Bölgesi'nde yaygın bitki örtüsü hangisidir?", 'Bozkır', ['Orman', 'Maki', 'Tundra']],
      ["Marmara Bölgesi'nin iki kıtayı birleştiren şehri hangisidir?", 'İstanbul', ['Kocaeli', 'Balıkesir', 'Çanakkale']],
      ['Nüfusun en seyrek olduğu yerler genelde nasıldır?', 'İklimi sert ve ulaşımı zor', ['Su kaynakları çok fazla', 'Sanayisi çok yoğun', 'Ovaları çok geniş']],
      ['Çöl ikliminde yağış miktarı genelde nasıldır?', 'Çok azdır', ['Çok fazladır', 'Her gün aynıdır', 'Sadece kışın olur']],
      ['Türkiye hangi kıtalar arasında köprü konumundadır?', 'Avrupa ve Asya', ['Asya ve Afrika', 'Avrupa ve Amerika', 'Afrika ve Amerika']],
      ['Hava olaylarını kısa süreli inceleyen bilim dalı hangisidir?', 'Meteoroloji', ['Jeoloji', 'Biyoloji', 'Sosyoloji']],
      ['Haritada küçültme oranını gösteren kavram hangisidir?', 'Ölçek', ['Yükselti', 'Lejant', 'Renk tonu']]
    ].forEach(([prompt, correct, wrongs]) => add('Coğrafya', prompt, correct, wrongs));

    // 12) Türkçe (40)
    [
      ['Aşağıdakilerden hangisi bir isimdir?', 'masa', ['koşmak', 'güzelce', 'çünkü']],
      ['Aşağıdakilerden hangisi bir fiildir?', 'yazmak', ['defter', 'mavi', 'ama']],
      ['"ve" kelimesi hangi görevde kullanılır?', 'Bağlaç', ['Sıfat', 'Zamir', 'Fiil']],
      ['"Ben" kelimesi hangi türdendir?', 'Zamir', ['Edat', 'Sıfat', 'Zarf']],
      ['"Hızlı koştu" cümlesinde "hızlı" sözcüğü hangi görevde kullanılmıştır?', 'Zarf', ['İsim', 'Bağlaç', 'Zamir']],
      ['Cümle sonunda kullanılan temel noktalama işareti hangisidir?', 'Nokta', ['Virgül', 'İki nokta', 'Kesme işareti']],
      ['Özel isimlere gelen ekler çoğunlukla hangi işaretle ayrılır?', 'Kesme işareti', ['Virgül', 'Parantez', 'Tırnak']],
      ['"kitaplar" sözcüğündeki çokluk eki hangisidir?', '-lar', ['-ım', '-de', '-ki']],
      ['"Ne var ki" ifadesinde öne çıkan anlam ilişkisi hangisidir?', 'Karşıtlık', ['Sebep', 'Amaç', 'Koşul']],
      ['"Çünkü" kelimesi cümleler arasında genelde ne bildirir?', 'Neden-sonuç', ['Karşılaştırma', 'Benzetme', 'Abartı']],
      ['Aşağıdakilerden hangisi bir sıfattır?', 'mavi', ['koştu', 'çok', 'hey']],
      ['"Bugün okula erken gittim." cümlesinde zaman bildiren sözcük hangisidir?', 'Bugün', ['okula', 'erken', 'gittim']],
      ["\"Ali'nin kalemi\" ifadesinde kesme işareti neden kullanılmıştır?", 'Özel isme gelen eki ayırmak için', ['Ses uzatmak için', 'Soru sormak için', 'Alıntı yapmak için']],
      ['Aşağıdakilerden hangisi ünlem cümlesi örneğidir?', 'Ne güzel bir gün!', ['Bugün hava açık.', 'Yarın gelirim.', 'Kitabı masaya koy.']],
      ['"mi" soru edatı cümlede ne işe yarar?', 'Soru anlamı katar', ['Zaman bildirir', 'Çoğul yapar', 'Yer bildirir']],
      ['"Akıllı çocuk" söz grubunda "akıllı" hangi görevde kullanılmıştır?', 'Sıfat', ['Zarf', 'Bağlaç', 'Edat']],
      ['Aşağıdakilerden hangisi eş anlamlı sözcük örneğidir?', 'cevap-yanıt', ['uzun-kısa', 'sıcak-soğuk', 'gülmek-ağlamak']],
      ['Aşağıdakilerden hangisi zıt anlamlıdır?', 'büyük-küçük', ['ev-konut', 'cevap-yanıt', 'mutlu-neşeli']],
      ['"Fakat" kelimesi çoğunlukla ne bildirir?', 'Karşıtlık', ['Yer', 'Zaman', 'Miktar']],
      ['Bir metnin ana düşüncesi neyi ifade eder?', 'Yazarın vermek istediği temel mesajı', ['Sadece ilk cümleyi', 'Metindeki tüm özel isimleri', 'Yalnızca sonucu']],
      ['"O" kelimesi hangi sözcük türüne örnektir?', 'Zamir', ['Sıfat-fiil', 'Bağlaç', 'Ünlem']],
      ['Aşağıdakilerden hangisi soru cümlesidir?', 'Bugün gelecek misin?', ['Bugün hava çok güzel.', 'Ders çalışıyorum.', 'Kitabı kapat.']],
      ['"hem ... hem ..." yapısı hangi türdendir?', 'Bağlaç', ['Zamir', 'Fiil', 'Sıfat']],
      ['"Koşarak geldi" cümlesinde eylemin nasıl yapıldığını bildiren sözcük hangisidir?', 'Koşarak', ['geldi', 'cümlesinde', 'eylemin']],
      ['Paragrafta yardımcı düşünce neyi destekler?', 'Ana düşünceyi', ['Başlığı', 'Yazım kuralını', 'Noktalama işaretini']],
      ['"Kalem, defter, silgi aldım." cümlesinde virgülün görevi nedir?', 'Sıralı öğeleri ayırmak', ['Soru sormak', 'Özel ismi ayırmak', 'Ünlem vermek']],
      ['"İçin" kelimesi çoğu kullanımda hangi görevde görülür?', 'Edat', ['Fiil', 'Zamir', 'Bağlaç']],
      ['"Çok güzel konuştu." cümlesinde "çok" hangi görevdedir?', 'Zarf', ['İsim', 'Bağlaç', 'Ünlem']],
      ['"Bu kitap" ifadesinde "bu" hangi görevde kullanılmıştır?', 'İşaret sıfatı', ['Zamir', 'Bağlaç', 'Fiil']],
      ['Aşağıdakilerden hangisi mecaz anlam örneğine daha yakındır?', 'Sert sözleri kalbimi kırdı.', ['Cam bardak kırıldı.', 'Kapı hızla açıldı.', 'Defteri masaya koydu.']],
      ['Aşağıdakilerden hangisi gerçek anlamlı kullanımdır?', 'Taş ağırdı.', ['Taş kalpli insandı.', 'Yolum karardı.', 'Kalbim eridi.']],
      ['Yazım kurallarında cümle başları nasıl yazılır?', 'Büyük harfle', ['Küçük harfle', 'Rakamla', 'Tırnak içinde']],
      ['Özel isimler nasıl başlar?', 'Büyük harfle', ['Küçük harfle', 'Her zaman rakamla', 'Nokta ile']],
      ['"de/da" bağlaç olduğunda nasıl yazılır?', 'Ayrı yazılır', ['Bitişik yazılır', 'Asla kullanılmaz', 'Yalnızca büyük harfle']],
      ['"ki" bağlaç olduğunda çoğunlukla nasıl yazılır?', 'Ayrı yazılır', ['Bitişik yazılır', 'Sadece kesmeyle yazılır', 'Hiç yazılmaz']],
      ['Aşağıdakilerden hangisi yönerge cümlesidir?', 'Sayfayı dikkatlice çevir.', ['Bugün dışarı çıkmadım.', 'Hava biraz serin.', 'Keşke sen de gelsen.']],
      ['"Keşke" kelimesi cümleye çoğunlukla ne katar?', 'Dilek', ['Emir', 'Sebep', 'Karşılaştırma']],
      ['Anlatımda giriş bölümü ne yapar?', 'Konuya giriş sağlar', ['Yalnızca sonucu söyler', 'Noktalama kurallarını listeler', 'Metni bitirir']],
      ['Aşağıdakilerden hangisi bir bağlaçtır?', 'ama', ['ev', 'güzel', 'çabuk']],
      ['"Kim" sözcüğü uygun kullanıldığında hangi tür olabilir?', 'Soru zamiri', ['Bağlaç', 'Fiilimsı', 'Ünlem']]
    ].forEach(([prompt, correct, wrongs]) => add('Türkçe', prompt, correct, wrongs));

    if (questions.length !== 500) {
      console.warn('Soru bankası 500 değil:', questions.length);
    }
    return questions.slice(0, 500);
  }

  function updateHUD() {
    scoreEl.textContent = game.score;
    bestEl.textContent = currentBest();
    moveCountEl.textContent = game.moves;
    targetStatusEl.textContent = game.jumpscared ? 'Büyük Ödül' : '8192';
    updatePlayerBestCards();
    if (quizPlayerEl) quizPlayerEl.textContent = `Oyuncu: ${game.selectedUser || '-'}`;
  }

  function setBoardMessage(text, kind = '') {
    messageEl.textContent = text;
    messageEl.className = `game-message ${kind}`.trim();
  }

  function updateLockUI() {
    if (game.unlocked) {
      boardShell.classList.remove('locked');
      boardShell.classList.add('unlocked');
      inlineNoteEl.textContent = 'Oyun aktif. Birleştir ve Büyük Ödül’e ulaş.';
      lockChipEl.textContent = game.selectedUser ? `${game.selectedUser} hazır` : 'Hazır';
      lockChipEl.classList.add('unlocked');
    } else {
      boardShell.classList.add('locked');
      boardShell.classList.remove('unlocked');
      inlineNoteEl.textContent = game.selectedUser ? 'Soruyu çöz, alan açılsın.' : 'Önce oyuncu seç.';
      lockChipEl.textContent = game.selectedUser ? `${game.selectedUser} • Soru bekleniyor` : 'Oyuncu seç';
      lockChipEl.classList.remove('unlocked');
    }
  }

  function getTileColors(value) {
    const palette = [
      { bg: '#fff7f8', bg2: '#ffe3e8', color: '#523629' },
      { bg: '#ffe3e8', bg2: '#ffced8', color: '#523629' },
      { bg: '#ffb6c1', bg2: '#ee9fac', color: '#523629' },
      { bg: '#28a2a2', bg2: '#008080', color: '#fff7f8' },
      { bg: '#008080', bg2: '#006c6c', color: '#fff7f8' },
      { bg: '#6a4a3d', bg2: '#523629', color: '#fff7f8' },
      { bg: '#523629', bg2: '#3f281f', color: '#fff7f8' },
    ];
    const level = Math.max(1, Math.floor(Math.log2(value)));
    return palette[Math.min(palette.length - 1, level - 1)];
  }

  function clearTileFlags() {
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const tile = game.board[r][c];
        if (tile) {
          tile.new = false;
          tile.merged = false;
        }
      }
    }
  }

  function renderBoard() {
    const activeIds = new Set();

    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const tile = game.board[r][c];
        if (!tile) continue;
        activeIds.add(tile.id);
        let el = tileEls.get(tile.id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'tile';
          el.innerHTML = '<span></span>';
          tileLayer.appendChild(el);
          tileEls.set(tile.id, el);
        }
        const { bg, bg2, color } = getTileColors(tile.value);
        el.style.setProperty('--x', c);
        el.style.setProperty('--y', r);
        el.style.background = `linear-gradient(180deg, ${bg}, ${bg2})`;
        el.style.color = color;
        el.querySelector('span').textContent = tile.value;
        el.className = `tile value-${tile.value}${tile.new ? ' new' : ''}${tile.merged ? ' merged' : ''}`;
      }
    }

    tileEls.forEach((el, id) => {
      if (!activeIds.has(id)) {
        el.remove();
        tileEls.delete(id);
      }
    });
  }

  function addRandomTile() {
    const empty = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (!game.board[r][c]) empty.push({ r, c });
      }
    }
    if (!empty.length) return false;
    const { r, c } = randomChoice(empty);
    game.board[r][c] = {
      id: game.tileId += 1,
      value: Math.random() < 0.9 ? 2 : 4,
      new: true,
      merged: false
    };
    return true;
  }

  function resetGameState() {
    game.board = createEmptyBoard();
    game.score = 0;
    game.moves = 0;
    game.hasLost = false;
    game.won2048 = false;
    game.jumpscared = false;
    setBoardMessage('');
    clearTileLayer();
    addRandomTile();
    addRandomTile();
    updateHUD();
    renderBoard();
  }

  function clearTileLayer() {
    tileLayer.innerHTML = '';
    tileEls.clear();
  }

  function lineToCoords(index, direction) {
    const coords = [];
    for (let i = 0; i < size; i += 1) {
      if (direction === 'left') coords.push([index, i]);
      if (direction === 'right') coords.push([index, size - 1 - i]);
      if (direction === 'up') coords.push([i, index]);
      if (direction === 'down') coords.push([size - 1 - i, index]);
    }
    return coords;
  }

  function spawnParticles(row, col, value) {
    const boardRect = boardShell.getBoundingClientRect();
    const inner = boardRect.width - 28;
    const cell = (inner - (size - 1) * 14) / size;
    const left = 14 + col * (cell + 14) + cell / 2;
    const top = 14 + row * (cell + 14) + cell / 2;
    const count = Math.min(16, 8 + Math.log2(value));

    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('span');
      p.className = 'particle';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
      const radius = 18 + Math.random() * 28;
      p.style.setProperty('--left', `${left}px`);
      p.style.setProperty('--top', `${top}px`);
      p.style.setProperty('--dx', `${Math.cos(angle) * radius}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * radius}px`);
      p.style.setProperty('--size', `${4 + Math.random() * 7}px`);
      particleLayer.appendChild(p);
      p.addEventListener('animationend', () => p.remove(), { once: true });
    }
  }

  function canMove() {
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const tile = game.board[r][c];
        if (!tile) return true;
        if (r < size - 1 && game.board[r + 1][c] && game.board[r + 1][c].value === tile.value) return true;
        if (c < size - 1 && game.board[r][c + 1] && game.board[r][c + 1].value === tile.value) return true;
      }
    }
    return false;
  }

  function isGameOverVideoOpen() {
    return !!gameOverVideoOverlay && !gameOverVideoOverlay.classList.contains('hidden');
  }

  function hideGameOverVideo() {
    if (!gameOverVideoOverlay || !gameOverVideo) return;
    gameOverVideo.pause();
    try {
      gameOverVideo.currentTime = 0;
    } catch (error) {
      // Video henuz metadata yuklemediyse currentTime ayari atlanir.
    }
    gameOverVideoOverlay.classList.add('hidden');
    gameOverVideoOverlay.setAttribute('aria-hidden', 'true');
  }

  function restartAfterGameOverVideo() {
    hideGameOverVideo();
    game.processing = false;
    resetGameState();
    updateHUD();
    updateLockUI();
    setBoardMessage(game.unlocked ? `${game.selectedUser} için yeni oyun hazır.` : 'Yeni oyun hazır.');
  }

  function playGameOverVideo() {
    if (!gameOverVideoOverlay || !gameOverVideo) {
      restartAfterGameOverVideo();
      return;
    }
    gameOverVideoOverlay.classList.remove('hidden');
    gameOverVideoOverlay.setAttribute('aria-hidden', 'false');
    gameOverVideo.muted = false;
    gameOverVideo.volume = 1;
    gameOverVideo.removeAttribute('muted');
    gameOverVideo.pause();
    try {
      gameOverVideo.currentTime = 0;
    } catch (error) {
      // Video henuz metadata yuklemediyse bastan oynatma tarayiciya birakilir.
    }
    const playback = gameOverVideo.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {});
    }
  }

  function handleGameOver() {
    if (game.hasLost) return;
    game.hasLost = true;
    maybeUpdateBest();
    updateHUD();
    setBoardMessage('Hamle kalmadı. Video bitince yeni oyun başlayacak.', 'over');
    playGameOverVideo();
  }

  function maybeUpdateBest() {
    if (!game.selectedUser) return;
    if (game.score > currentBest()) {
      game.bestScores[game.selectedUser] = game.score;
      localStorage.setItem(storageBestKey(game.selectedUser), String(game.score));
      updateHUD();
    }
  }

  function handleMilestones(value) {
    if (value >= 2048 && !game.won2048) {
      game.won2048 = true;
      setBoardMessage('2048 oldu. İstersen devam edip Büyük Ödül’e gidebilirsin.', 'win');
    }
    if (value >= 8192 && !game.jumpscared) {
      triggerJumpscare();
    }
  }

  function processLine(tiles) {
    const result = [];
    for (let i = 0; i < tiles.length; i += 1) {
      const current = tiles[i];
      const next = tiles[i + 1];
      if (next && current.value === next.value) {
        current.value *= 2;
        current.merged = true;
        result.push(current);
        game.score += current.value;
        handleMilestones(current.value);
        playTone('merge', current.value);
        i += 1;
      } else {
        result.push(current);
      }
    }
    return result;
  }

  function move(direction) {
    if (!game.unlocked || game.processing || !jumpscareOverlay.classList.contains('hidden') || isGameOverVideoOpen() || game.hasLost) return;

    game.processing = true;
    clearTileFlags();
    let moved = false;

    for (let line = 0; line < size; line += 1) {
      const coords = lineToCoords(line, direction);
      const lineTiles = coords.map(([r, c]) => game.board[r][c]);
      const existing = lineTiles.filter(Boolean);
      const processed = processLine(existing);

      coords.forEach(([r, c], idx) => {
        const nextTile = processed[idx] || null;
        if (game.board[r][c] !== nextTile) moved = true;
        game.board[r][c] = nextTile;
        if (nextTile && nextTile.merged) spawnParticles(r, c, nextTile.value);
      });
    }

    if (moved) {
      game.moves += 1;
      addRandomTile();
      maybeUpdateBest();
      updateHUD();
      renderBoard();
      playTone('move');
      if (!canMove()) {
        handleGameOver();
      }
    } else if (!canMove()) {
      handleGameOver();
    }

    setTimeout(() => {
      if (!isGameOverVideoOpen()) game.processing = false;
    }, 120);
  }

  function prepareQuestionGate() {
    game.questionBank = buildQuestionBank();
    quizCounterEl.textContent = `${game.questionBank.length} soru havuzu`;
    showPlayerSelection();
  }

  function showPlayerSelection() {
    game.unlocked = false;
    updateHUD();
    updateLockUI();
    if (playerFeedbackEl) playerFeedbackEl.textContent = 'Bir oyuncu seç ve soruya geç.';
    setQuizStage('selector');
  }

  function selectPlayer(user) {
    game.selectedUser = user;
    localStorage.setItem('denizim_2048_last_user', user);
    updateHUD();
    updateLockUI();
    showRandomQuestion();
  }

  function showRandomQuestion() {
    if (!game.selectedUser) {
      showPlayerSelection();
      return;
    }
    let index = Math.floor(Math.random() * game.questionBank.length);
    if (game.questionBank.length > 1) {
      while (index === game.lastQuestionIndex) index = Math.floor(Math.random() * game.questionBank.length);
    }
    game.lastQuestionIndex = index;
    game.question = game.questionBank[index];

    setQuizStage('question');
    quizSubjectEl.textContent = game.question.subject;
    quizCounterEl.textContent = `${index + 1} / ${game.questionBank.length}`;
    quizQuestionEl.textContent = game.question.prompt;
    quizOptionsEl.innerHTML = '';
    quizFeedbackEl.textContent = 'Doğru cevabı bulmadan oyun açılmaz.';
    quizFeedbackEl.className = 'quiz-feedback';
    if (quizPlayerEl) quizPlayerEl.textContent = `Oyuncu: ${game.selectedUser}`;

    game.question.options.forEach((option, optionIndex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      btn.textContent = option;
      btn.addEventListener('click', () => answerQuestion(optionIndex, btn));
      quizOptionsEl.appendChild(btn);
    });
  }

  function answerQuestion(index, btn) {
    const buttons = [...quizOptionsEl.querySelectorAll('.quiz-option')];
    buttons.forEach((b) => { b.disabled = true; });

    if (index === game.question.answer) {
      btn.classList.add('correct');
      quizFeedbackEl.textContent = 'Doğru cevap. 2048 açılıyor...';
      quizFeedbackEl.className = 'quiz-feedback ok';
      playTone('success');
      game.unlocked = true;
      updateLockUI();
      setTimeout(() => {
        quizOverlay.classList.add('hidden');
        quizOverlay.setAttribute('aria-hidden', 'true');
        setBoardMessage(`${game.selectedUser} için oyun aktif. Birleştirmeye başla.`);
      }, 620);
    } else {
      btn.classList.add('wrong');
      const correctBtn = buttons[game.question.answer];
      if (correctBtn) correctBtn.classList.add('correct');
      quizFeedbackEl.textContent = 'Yanlış cevap. Yeni rastgele soru geliyor...';
      quizFeedbackEl.className = 'quiz-feedback no';
      playTone('error');
      setTimeout(() => {
        buttons.forEach((b) => { b.disabled = false; });
        showRandomQuestion();
      }, 900);
    }
  }

  function triggerJumpscare() {
    game.jumpscared = true;
    updateHUD();
    jumpscareOverlay.classList.remove('hidden');
    jumpscareOverlay.setAttribute('aria-hidden', 'false');
    ensureAudio();
    jumpscareAudio.currentTime = 0;
    jumpscareAudio.play().catch(() => {});
    setBoardMessage('8192 geldi. Büyük Ödül açıldı.', 'win');
  }

  function closeJumpscare() {
    jumpscareOverlay.classList.add('hidden');
    jumpscareOverlay.setAttribute('aria-hidden', 'true');
    jumpscareAudio.pause();
    jumpscareAudio.currentTime = 0;
  }

  function handleKeydown(event) {
    const keyMap = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      a: 'left',
      A: 'left',
      d: 'right',
      D: 'right',
      w: 'up',
      W: 'up',
      s: 'down',
      S: 'down'
    };
    const direction = keyMap[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  }

  function handleTouch() {
    const swipeSurface = boardShell.closest('.board-card') || boardShell;
    let startX = 0;
    let startY = 0;
    let trackingTouch = false;

    const lockPageScroll = () => {
      document.documentElement.classList.add('touch-lock-page');
      document.body.classList.add('touch-lock-page');
    };

    const unlockPageScroll = () => {
      document.documentElement.classList.remove('touch-lock-page');
      document.body.classList.remove('touch-lock-page');
    };

    const stopTrackedScroll = (event) => {
      if (!trackingTouch || !event.cancelable) return;
      event.preventDefault();
    };

    swipeSurface.addEventListener('touchstart', (event) => {
      if (!event.touches[0]) return;
      trackingTouch = true;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      lockPageScroll();
      if (event.cancelable) event.preventDefault();
    }, { passive: false });

    swipeSurface.addEventListener('touchmove', (event) => {
      if (!trackingTouch) return;
      if (event.cancelable) event.preventDefault();
    }, { passive: false });

    swipeSurface.addEventListener('touchend', (event) => {
      if (!event.changedTouches[0]) {
        trackingTouch = false;
        unlockPageScroll();
        return;
      }
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      trackingTouch = false;
      unlockPageScroll();
      if (event.cancelable) event.preventDefault();
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    }, { passive: false });

    swipeSurface.addEventListener('touchcancel', (event) => {
      trackingTouch = false;
      unlockPageScroll();
      if (event.cancelable) event.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', stopTrackedScroll, { passive: false });
    window.addEventListener('touchend', () => {
      if (!trackingTouch) return;
      trackingTouch = false;
      unlockPageScroll();
    }, { passive: true });
    window.addEventListener('touchcancel', () => {
      if (!trackingTouch) return;
      trackingTouch = false;
      unlockPageScroll();
    }, { passive: true });
  }

  function init() {
    updateHUD();
    updateLockUI();
    resetGameState();
    prepareQuestionGate();

    document.addEventListener('keydown', handleKeydown);
    handleTouch();

    playerButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        ensureAudio();
        selectPlayer(btn.dataset.player);
      });
    });

    newGameBtn.addEventListener('click', () => {
      ensureAudio();
      resetGameState();
      updateHUD();
      updateLockUI();
      setBoardMessage(game.unlocked ? `${game.selectedUser} için yeni oyun hazır.` : 'Önce soruyu doğru cevapla.');
    });

    closeJumpscareBtn.addEventListener('click', closeJumpscare);
    jumpscareOverlay.addEventListener('click', (event) => {
      if (event.target === jumpscareOverlay) closeJumpscare();
    });
    if (gameOverVideo) {
      gameOverVideo.addEventListener('ended', restartAfterGameOverVideo);
    }
  }

  init();
})();
