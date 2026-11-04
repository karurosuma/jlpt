let SQL = null;
let contentDB = null;
let userDB = null;
let currentLevel = 'N5';
let currentTab = 'words';

const LEVELS = ['N5','N4','N3','N2','N1'];

async function init() {
  try {
    SQL = await initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}` });
    userDB = new SQL.Database();
    userDB.run(`CREATE TABLE IF NOT EXISTS progress (
      level TEXT, type TEXT, item_id INTEGER,
      status TEXT DEFAULT 'new', last_reviewed TEXT,
      PRIMARY KEY(level, type, item_id)
    )`);
    userDB.run(`CREATE TABLE IF NOT EXISTS quiz_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT, quiz_type TEXT, score INTEGER, total INTEGER, date TEXT
    )`);
    userDB.run(`CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    // Load preferences from DB if present
    try {
      const pref = userDB.exec("SELECT value FROM preferences WHERE key='theme'");
      if (pref.length && pref[0].values.length) {
        localStorage.setItem('theme', pref[0].values[0][0]);
      }
    } catch(e) {}
  } catch(e) { console.error(e); }
  // Theme
  const theme = localStorage.getItem('theme');
  document.body.classList.remove('dark', 'light');
  if (theme === 'dark') document.body.classList.add('dark');
  else if (theme === 'light') document.body.classList.add('light');
  updateDarkButton();
  renderLevelNav();
  switchTab('words');
  // Auto-load N5 on startup
  loadLevel('N5');
}

function goToWord(word) {
  closeSearch();
  // Filter to show the word and scroll to it
  currentFilter = '';
  renderContent();
  setTimeout(() => {
    const cards = document.querySelectorAll('.card');
    for (const card of cards) {
      if (card.textContent.includes(word)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = '', 2000);
        break;
      }
    }
  }, 100);
}
function openSearch() {
  document.getElementById('searchOverlay').classList.add('show');
  document.getElementById('searchInput').focus();
}
function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('show');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}
function doSearch(query) {
  if (!contentDB || !query.trim()) {
    document.getElementById('searchResults').innerHTML = '';
    return;
  }
  try {
    let sql, params;
    if (currentTab === 'grammar') {
      sql = "SELECT title, explanation_tc FROM grammar WHERE title LIKE ? OR explanation_tc LIKE ? LIMIT 20";
      params = [`%${query}%`, `%${query}%`];
    } else if (currentTab === 'exercises') {
      sql = "SELECT correct FROM rearrange WHERE correct LIKE ? LIMIT 20";
      params = [`%${query}%`];
    } else {
      sql = "SELECT word, reading, meaning_tc, pos FROM vocab WHERE word LIKE ? OR reading LIKE ? OR meaning_tc LIKE ? LIMIT 20";
      params = [`%${query}%`, `%${query}%`, `%${query}%`];
    }
    const rows = contentDB.exec(sql, params);
    let html = '';
    if (rows.length && rows[0].values.length) {
      rows[0].values.forEach(r => {
        if (currentTab === 'grammar') {
          html += `<div class="card search-result" style="margin:8px 0;cursor:pointer;" onclick="goToItem('${r[0].replace(/'/g,"\\'")}')"><div class="word">${r[0]}</div><div class="meaning">${r[1]}</div></div>`;
        } else if (currentTab === 'exercises') {
          html += `<div class="card search-result" style="margin:8px 0;cursor:pointer;" onclick="goToItem('${r[0].replace(/'/g,"\\'")}')"><div class="word">${r[0]}</div></div>`;
        } else {
          html += `<div class="card search-result" style="margin:8px 0;cursor:pointer;" onclick="goToWord('${r[0].replace(/'/g,"\\'")}')"><div class="word">${toRuby(r[0], r[1])} <span class="badge">${r[3]}</span></div><div class="meaning">${r[2]}</div></div>`;
        }
      });
    } else {
      html = '<p style="text-align:center;padding:20px;color:var(--muted);">見つかりません</p>';
    }
    document.getElementById('searchResults').innerHTML = html;
  } catch(e) {
    document.getElementById('searchResults').innerHTML = '<p>検索エラー</p>';
  }
}

function goToItem(text) {
  closeSearch();
  setTimeout(() => {
    const cards = document.querySelectorAll('.card');
    for (const card of cards) {
      if (card.textContent.includes(text)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = '', 2000);
        break;
      }
    }
  }, 100);
}
function openSettings() {
  document.getElementById('settingsOverlay').classList.add('show');
}
function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('show');
}
function toggleDark() {
  const body = document.body;
  const current = localStorage.getItem('theme') || 'auto';
  let newTheme;
  if (current === 'auto' || current === 'light') {
    body.classList.remove('light');
    body.classList.add('dark');
    newTheme = 'dark';
  } else {
    body.classList.remove('dark');
    body.classList.add('light');
    newTheme = 'light';
  }
  localStorage.setItem('theme', newTheme);
  if (userDB) {
    try {
      userDB.run("INSERT OR REPLACE INTO preferences (key, value) VALUES ('theme', ?)", [newTheme]);
    } catch(e) {}
  }
  updateDarkButton();
}
function updateDarkButton() {
  const btn = document.getElementById('darkToggle');
  if (!btn) return;
  const theme = localStorage.getItem('theme') || 'auto';
  if (theme === 'dark') btn.textContent = 'ライトモードに切替';
  else if (theme === 'light') btn.textContent = 'ダークモードに切替';
  else btn.textContent = 'ダークモードに切替';
}

function renderLevelNav() {
  const nav = document.getElementById('levelNav');
  nav.innerHTML = '';
  LEVELS.forEach(lv => {
    const btn = document.createElement('button');
    btn.textContent = lv;
    btn.className = lv === currentLevel ? 'active' : '';
    btn.onclick = () => { currentLevel = lv; loadLevel(lv); closeSettings(); };
    nav.appendChild(btn);
  });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  const titles = { words: '単語', grammar: '文法', exercises: '練習' };
  document.getElementById('topTitle').textContent = titles[tab] || 'JLPT';
  renderContent();
}

async function loadLevel(level) {
  currentLevel = level;
  renderLevelNav();
  const fname = `data/data.db?v=${Date.now()}`;
  let loaded = false;
  let statusEl = document.getElementById('status');

  // Try relative path first (with cache bust)
  try {
    const resp = await fetch(fname, { cache: 'no-store' });
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      contentDB = new SQL.Database(new Uint8Array(buf));
      if (statusEl) statusEl.innerText = `${level} を読み込みました (v2026-11-04)`;
      loaded = true;
      try { await cacheDB(level, buf); } catch(e) {}
    }
  } catch(e) {
    console.log('Local fetch failed:', e);
  }

  // Fallback to cache
  if (!loaded) {
    try {
      const cached = await getCachedDB(level);
      if (cached) {
        contentDB = new SQL.Database(cached);
        if (statusEl) statusEl.innerText = `${level} をキャッシュから読み込みました`;
        loaded = true;
      }
    } catch(e) {}
  }

  if (!loaded) {
    if (statusEl) statusEl.innerText = `data.db が見つかりません。data/ フォルダを確認してください。`;
    contentDB = null;
    document.getElementById('content').innerHTML = '<p style="text-align:center;padding:40px;color:#8e8e93;">データが読み込めません。<br>data/data.db を確認してください。</p>';
  } else {
    renderContent();
  }
}

// Simple IndexedDB cache for DBs
const DB_CACHE_NAME = 'jlpt-db-cache';
function openCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_CACHE_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('dbs');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function cacheDB(level, arrayBuffer) {
  const db = await openCacheDB();
  const tx = db.transaction('dbs', 'readwrite');
  tx.objectStore('dbs').put(arrayBuffer, level);
  return new Promise(r => tx.oncomplete = r);
}
async function getCachedDB(level) {
  const db = await openCacheDB();
  const tx = db.transaction('dbs', 'readonly');
  const req = tx.objectStore('dbs').get(level);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
    req.onerror = () => reject(req.error);
  });
}

function renderContent() {
  const c = document.getElementById('content');
  if (!contentDB) {
    c.innerHTML = '<p style="text-align:center;padding:40px;color:#8e8e93;">データがありません。<br>設定からレベルを選択してください。</p>';
    return;
  }
  if (currentTab === 'words') showWords(c);
  else if (currentTab === 'grammar') showGrammar(c);
  else if (currentTab === 'exercises') showExercises(c);
}

function toRuby(word, reading) {
  if (!word) return '';
  // If already has ruby tags, return as-is
  if (word.includes('<ruby>')) return word;
  // If no kanji, return as-is
  if (!/[\u4e00-\u9faf]/.test(word)) return word;
  // If the whole word is kanji and we have a reading, use it
  if (reading && /^[\u4e00-\u9faf]+$/.test(word)) {
    return `<ruby>${word}<rt>${reading}</rt></ruby>`;
  }
  // For mixed content (kanji + hiragana) with reading
  if (reading) {
    // Extract kanji part and hiragana part
    const kanjiMatch = word.match(/^([\u4e00-\u9faf]+)(.*)$/);
    if (kanjiMatch) {
      const kanji = kanjiMatch[1];
      const rest = kanjiMatch[2];
      // Reading should match: kanji reading + rest
      // For ます形, reading ends with ます, rest is ます
      if (rest && reading.endsWith(rest)) {
        const kanjiReading = reading.slice(0, -rest.length);
        return `<ruby>${kanji}<rt>${kanjiReading}</rt></ruby>${rest}`;
      }
      // Fallback: use full reading for kanji
      return `<ruby>${kanji}<rt>${reading}</rt></ruby>${rest}`;
    }
  }
  // No reading available, wrap kanji with empty rt
  return word.replace(/([\u4e00-\u9faf]+)/g, (kanji) => {
    return `<ruby>${kanji}<rt></rt></ruby>`;
  });
}

let currentFilter = '';

function showWords(container) {
  try {
    let sql = "SELECT * FROM vocab WHERE level = ?";
    let params = [currentLevel];
    if (currentFilter) {
      if (currentFilter === '形容詞') {
        sql += " AND pos LIKE '%形容詞%'";
      } else if (currentFilter === 'い形容詞') {
        sql += " AND pos = 'い形容詞'";
      } else if (currentFilter === 'な形容詞') {
        sql += " AND pos = 'な形容詞'";
      } else if (currentFilter === '動詞') {
        sql += " AND (pos = '動詞' OR pos LIKE '%動詞%')";
      } else {
        sql += " AND pos = ?";
        params.push(currentFilter);
      }
    }
    sql += " LIMIT 200";
    const rows = contentDB.exec(sql, params);
    
    let filterHtml = `<div class="filter-bar">
      <button class="filter-btn ${currentFilter===''?'active':''}" onclick="setFilter('')">すべて</button>
      <button class="filter-btn ${currentFilter==='名詞'?'active':''}" onclick="setFilter('名詞')">名詞</button>
      <button class="filter-btn ${currentFilter==='動詞'?'active':''}" onclick="setFilter('動詞')">動詞</button>
      <button class="filter-btn ${currentFilter==='い形容詞'?'active':''}" onclick="setFilter('い形容詞')">い形容詞</button>
      <button class="filter-btn ${currentFilter==='な形容詞'?'active':''}" onclick="setFilter('な形容詞')">な形容詞</button>
      <button class="filter-btn ${currentFilter==='副詞'?'active':''}" onclick="setFilter('副詞')">副詞</button>
    </div>`;
    
    let html = filterHtml;
    if (!rows.length || !rows[0].values.length) {
      html += '<p style="text-align:center;padding:40px;">語彙データなし</p>';
    } else {
      rows[0].values.forEach(r => {
        const pos = r[7] || '';
        let displayWord = r[2];
        let displayReading = r[3];
        let conjHtml = '';
        let badgeClass = 'badge';
        
        // Verb conjugations - show for any verb type
        if ((pos === '動詞' || pos.includes('動詞') || pos === '自動詞' || pos === '他動詞') && r[9]) {
          const conjMap = {};
          r[9].split('|').forEach(c => {
            const parts = c.split(':');
            if (parts.length === 2) conjMap[parts[0]] = parts[1];
          });
          // Always show ます形 as main word for verbs (except 辞書形)
          if (conjMap['ます']) {
            displayWord = conjMap['ます'];
            // Generate reading for ます形
            if (displayReading) {
              const dictForm = conjMap['辞書'] || r[2];
              if (dictForm.endsWith('する')) {
                displayReading = displayReading.replace(/する$/, 'します');
              } else if (dictForm === '来る') {
                displayReading = 'きます';
              } else if (dictForm === '行く') {
                displayReading = 'いきます';
              } else if (dictForm.endsWith('る') && displayReading.endsWith('る')) {
                // ru-verb
                displayReading = displayReading.slice(0, -1) + 'ます';
              } else {
                // u-verb: convert last mora
                const lastChar = dictForm.slice(-1);
                const uVerbMap = {
                  'う':'い','く':'き','ぐ':'ぎ','す':'し','つ':'ち',
                  'ぬ':'に','ぶ':'び','む':'み','る':'り'
                };
                if (uVerbMap[lastChar] && displayReading.endsWith(lastChar)) {
                  displayReading = displayReading.slice(0, -1) + uVerbMap[lastChar] + 'ます';
                } else {
                  displayReading = displayReading.slice(0, -1) + 'ます';
                }
              }
            }
          }
          // Order: 辞書形 first, then others (exclude ます形 from list)
          const order = ['辞書','て','た','ない','可能','使役','受身','自然','相反'];
          const conjs = order.filter(k => conjMap[k]).map(k => {
            const label = {'辞書':'辞書形','て':'て形','た':'た形','ない':'ない形','可能':'可能形','使役':'使役形','受身':'受身形','自然':'自然形','相反':'相反'}[k] || k;
            let value = conjMap[k];
            // Apply ruby to conjugation values
            value = applyRubyToText(value);
            return `<div class="conj-row"><span class="conj-label">${label}</span><span>${value}</span></div>`;
          }).join('');
          conjHtml = `<div class="conj-block">${conjs}</div>`;
          badgeClass = 'badge badge-verb';
        }
        // Adjective conjugations
        else if ((pos === '形容詞' || pos.includes('形容詞')) && r[10]) {
          const conjMap = {};
          r[10].split('|').forEach(c => {
            const [k, v] = c.split(':');
            conjMap[k] = v;
          });
          const conjs = Object.entries(conjMap).map(([k, v]) => {
            const label = {'辞書':'辞書形','です':'です形','ない':'ない形','た':'た形','て':'て形'}[k] || k;
            return `<div class="conj-row"><span class="conj-label">${label}</span><span>${toRuby(v, '')}</span></div>`;
          }).join('');
          conjHtml = `<div class="conj-block">${conjs}</div>`;
          badgeClass = pos.includes('い') ? 'badge badge-iadj' : 'badge badge-nadj';
        }
        else if (pos === '名詞') badgeClass = 'badge badge-noun';
        else if (pos === '副詞') badgeClass = 'badge badge-adv';
        
        const wordRuby = toRuby(displayWord, displayReading);
        html += `<div class="card">
          <div class="word">${wordRuby} <span class="${badgeClass}">${pos}</span></div>
          <div class="meaning">${applyRubyToText(r[5] || r[4] || '')}</div>
          <div class="example">例：${applyRubyToText(r[6]||'')}<br><span class="example-tc">${r[8]||''}</span></div>
          ${conjHtml}</div>`;
      });
    }
    container.innerHTML = html;
  } catch(e) { 
    console.error(e);
    container.innerHTML = '<p>語彙テーブルがありません</p>'; 
  }
}

function setFilter(pos) {
  currentFilter = pos;
  renderContent();
}

function applyRubyToText(text) {
  if (!text) return '';
  if (text.includes('<ruby>')) return text;
  const readings = {
    '私':'わたし','友達':'ともだち','先生':'せんせい','学生':'がくせい',
    '今日':'きょう','明日':'あした','昨日':'きのう','毎日':'まいにち',
    '日本語':'にほんご','学校':'がっこう','病院':'びょういん','会社':'かいしゃ',
    '銀行':'ぎんこう','駅':'えき','電車':'でんしゃ','勉強':'べんきょう',
    '少し':'すこし','上手':'じょうず','週末':'しゅうまつ','映画':'えいが',
    '一緒':'いっしょ','誰':'だれ','新しい':'あたらしい','便利':'べんり',
    '土曜日':'どようび','日曜日':'にちようび','金曜日':'きんようび',
    '場所':'ばしょ','時間':'じかん','目的':'もくてき','変化':'へんか',
    '希望':'きぼう','願望':'がんぼう','食事':'しょくじ','水':'みず',
    '大きい':'おおきい','小さい':'ちいさい','新しい':'あたらしい',
    '高い':'たかい','安い':'やすい','古い':'ふるい','長い':'ながい',
    '短い':'みじかい','広い':'ひろい','狭い':'せまい','厚い':'あつい',
    '薄い':'うすい','重い':'おもい','軽い':'かるい','明るい':'あかるい',
    '暗い':'くらい','暑い':'あつい','寒い':'さむい','熱い':'あつい',
    '冷たい':'つめたい','忙しい':'いそがしい','楽しい':'たのしい',
    '難しい':'むずかしい','易しい':'やさしい','強い':'つよい','弱い':'よわい',
    '早い':'はやい','遅い':'おそい','近い':'ちかい','遠い':'とおい',
    '若い':'わかい','部屋':'へや','店':'みせ','物':'もの','犬':'いぬ'
  };
  // Sort by length (longer first) to match multi-kanji first
  const sorted = Object.keys(readings).sort((a, b) => b.length - a.length);
  let result = text;
  const placeholders = [];
  // Replace with placeholders first to avoid nested matches
  for (let i = 0; i < sorted.length; i++) {
    const kanji = sorted[i];
    if (result.includes(kanji)) {
      const placeholder = `__RUBY${i}__`;
      placeholders.push({ placeholder, ruby: `<ruby>${kanji}<rt>${readings[kanji]}</rt></ruby>` });
      result = result.split(kanji).join(placeholder);
    }
  }
  // Replace placeholders with ruby tags
  for (const p of placeholders) {
    result = result.split(p.placeholder).join(p.ruby);
  }
  return result;
}

function showGrammar(container) {
  try {
    const rows = contentDB.exec("SELECT * FROM grammar WHERE level = ?", [currentLevel]);
    if (!rows.length) { container.innerHTML = '<p style="text-align:center;padding:40px;">文法データなし</p>'; return; }
    let html = '';
    rows[0].values.forEach(r => {
      const title = r[2];
      const examples = (r[5]||'').split('|').map(e => '・' + applyRubyToText(e)).join('<br>');
      html += `<div class="card"><div class="word">${title}</div>
        <div style="margin-top:8px;">${applyRubyToText(r[3])}<br><span style="color:#666;">${r[4]}</span></div>
        <div style="margin-top:8px;font-size:15px;">${examples}</div></div>`;
    });
    container.innerHTML = html;
  } catch(e) { container.innerHTML = '<p>文法テーブルがありません</p>'; }
}

function showExercises(container) {
  try {
    const rows = contentDB.exec("SELECT * FROM rearrange WHERE level = ? ORDER BY RANDOM() LIMIT 8", [currentLevel]);
    if (!rows.length) { container.innerHTML = '<p style="text-align:center;padding:40px;">練習問題がありません</p>'; return; }
    let html = '<div style="padding:8px 16px;font-weight:600;">並べ替え問題 / 句子重組</div>';
    rows[0].values.forEach((r, idx) => {
      const parts = r[3].split('|');
      // Shuffle parts
      for (let i = parts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [parts[i], parts[j]] = [parts[j], parts[i]];
      }
      const partsHtml = parts.map(p => {
        const rubyPart = applyRubyToText(p);
        return `<span class="part" onclick="addPart(${idx}, this)">${rubyPart}</span>`;
      }).join('');
      const correctRuby = applyRubyToText(r[2]);
      html += `<div class="card" id="rearr-${idx}">
        <div style="margin-bottom:8px;font-size:15px;color:#666;">正しい文を作ってください</div>
        <div id="parts-${idx}">${partsHtml}</div>
        <div id="answer-${idx}" style="margin:12px 0;min-height:2em;border-bottom:1px solid #ddd;padding:4px;"></div>
        <button class="action" onclick="checkRearrange(${idx}, '${r[2].replace(/'/g,"\\'")}')">確認</button>
        <div id="feedback-${idx}" style="margin-top:8px;"></div>
      </div>`;
    });
    container.innerHTML = html;
  } catch(e) { container.innerHTML = '<p>並べ替え問題がありません</p>'; }
}

function addPart(idx, el) {
  if (el.classList.contains('used')) return;
  el.classList.add('used');
  document.getElementById('answer-' + idx).innerHTML += `<span class="part">${el.textContent}</span> `;
}
function checkRearrange(idx, correct) {
  const user = document.getElementById('answer-' + idx).innerText.replace(/\s+/g,'').replace(/[。．、]/g,'').trim();
  const correctNorm = correct.replace(/\s+/g,'').replace(/[。．、]/g,'').trim();
  const fb = document.getElementById('feedback-' + idx);
  if (user === correctNorm) {
    fb.innerHTML = '<span style="color:#34c759;">正解！</span>';
  } else {
    fb.innerHTML = `<span style="color:#ff3b30;">不正解。正解：${correct}</span>`;
  }
}

async function fetchLatestDB() {
  const url = prompt('最新DBのURL', ONLINE_BASE + currentLevel.toLowerCase() + '.db');
  if (!url) return;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(resp.status);
    const buf = await resp.arrayBuffer();
    contentDB = new SQL.Database(new Uint8Array(buf));
    document.getElementById('status').innerText = '最新データを取得しました';
    closeSettings();
    renderContent();
  } catch(e) { alert('取得失敗: ' + e.message); }
}
function exportUserDB() {
  if (!userDB) return;
  const data = userDB.export();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data]));
  a.download = 'user_progress.db';
  a.click();
}
function importUserDB(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      userDB = new SQL.Database(new Uint8Array(e.target.result));
      // Restore theme from imported DB
      try {
        const pref = userDB.exec("SELECT value FROM preferences WHERE key='theme'");
        if (pref.length && pref[0].values.length) {
          const theme = pref[0].values[0][0];
          localStorage.setItem('theme', theme);
          document.body.classList.remove('dark', 'light');
          if (theme === 'dark') document.body.classList.add('dark');
          else if (theme === 'light') document.body.classList.add('light');
          updateDarkButton();
        }
      } catch(err) {}
      document.getElementById('status').innerText = '進捗と設定をインポートしました';
      renderContent();
    } catch(err) { alert('インポート失敗'); }
  };
  reader.readAsArrayBuffer(file);
}

init();
