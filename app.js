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
  const fname = `data/${level.toLowerCase()}.db`;
  let loaded = false;
  let statusEl = document.getElementById('status');

  // Try relative path first
  try {
    const resp = await fetch(fname);
    if (resp.ok) {
      const buf = await resp.arrayBuffer();
      contentDB = new SQL.Database(new Uint8Array(buf));
      if (statusEl) statusEl.innerText = `${level} を読み込みました (${fname})`;
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
    if (statusEl) statusEl.innerText = `${level}.db が見つかりません。data/ フォルダを確認してください。`;
    contentDB = null;
    document.getElementById('content').innerHTML = '<p style="text-align:center;padding:40px;color:#8e8e93;">データが読み込めません。<br>data/' + level.toLowerCase() + '.db を確認してください。</p>';
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
  if (!reading || !word) return word;
  // Simple: if word has kanji, wrap with ruby
  if (/[\u4e00-\u9faf]/.test(word)) {
    return `<ruby>${word}<rt>${reading}</rt></ruby>`;
  }
  return word;
}

function showWords(container) {
  try {
    const rows = contentDB.exec("SELECT * FROM vocab LIMIT 200");
    if (!rows.length) { container.innerHTML = '<p style="text-align:center;padding:40px;">語彙データなし</p>'; return; }
    let html = '';
    rows[0].values.forEach(r => {
      const wordRuby = toRuby(r[1], r[2]);
      html += `<div class="card"><div class="word">${wordRuby}</div>
        <div style="margin-top:6px;color:#666;">${r[3]} / ${r[4]}</div>
        <div style="margin-top:6px;font-size:15px;color:#333;">例：${r[5]||''}</div></div>`;
    });
    container.innerHTML = html;
  } catch(e) { container.innerHTML = '<p>語彙テーブルがありません</p>'; }
}

function showGrammar(container) {
  try {
    const rows = contentDB.exec("SELECT * FROM grammar");
    if (!rows.length) { container.innerHTML = '<p style="text-align:center;padding:40px;">文法データなし</p>'; return; }
    let html = '';
    rows[0].values.forEach(r => {
      html += `<div class="card"><div class="word">${r[1]}</div>
        <div style="margin-top:8px;">${r[2]}<br><span style="color:#666;">${r[3]}</span></div>
        <div style="margin-top:8px;font-size:15px;">${(r[4]||'').split('|').map(e=>'・'+e).join('<br>')}</div></div>`;
    });
    container.innerHTML = html;
  } catch(e) { container.innerHTML = '<p>文法テーブルがありません</p>'; }
}

function showExercises(container) {
  try {
    const rows = contentDB.exec("SELECT * FROM rearrange ORDER BY RANDOM() LIMIT 8");
    if (!rows.length) { container.innerHTML = '<p style="text-align:center;padding:40px;">練習問題がありません</p>'; return; }
    let html = '<div style="padding:8px 16px;font-weight:600;">並べ替え問題 / 句子重組</div>';
    rows[0].values.forEach((r, idx) => {
      const parts = r[2].split('|');
      html += `<div class="card" id="rearr-${idx}">
        <div style="margin-bottom:8px;font-size:15px;color:#666;">正しい文を作ってください</div>
        <div id="parts-${idx}">${parts.map(p => `<span class="part" onclick="addPart(${idx}, this)">${p}</span>`).join('')}</div>
        <div id="answer-${idx}" style="margin:12px 0;min-height:2em;border-bottom:1px solid #ddd;padding:4px;"></div>
        <button class="action" onclick="checkRearrange(${idx}, '${r[1].replace(/'/g,"\\'")}')">確認</button>
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
  const user = document.getElementById('answer-' + idx).innerText.replace(/\s+/g,'').trim();
  const fb = document.getElementById('feedback-' + idx);
  if (user === correct.replace(/\s+/g,'')) {
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
