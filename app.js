console.log("app.js loaded");
let SQL = null;
let contentDB = null;
let userDB = null;
let currentLevel = 'N5';




let levelFilterEnabled = localStorage.getItem('levelFilterEnabled') !== 'false';

function toggleLevelFilter() {
  levelFilterEnabled = !levelFilterEnabled;
  localStorage.setItem('levelFilterEnabled', levelFilterEnabled);
  const toggle = document.getElementById('levelFilterToggle');
  const levelSection = document.getElementById('levelSection');
  if (toggle) toggle.classList.toggle('active', levelFilterEnabled);
  if (levelSection) levelSection.style.display = levelFilterEnabled ? 'block' : 'none';
  // Reload content
  if (currentTab === 'words') showWords(document.getElementById('content'));
}

function initLevelFilter() {
  const toggle = document.getElementById('levelFilterToggle');
  const levelSection = document.getElementById('levelSection');
  if (toggle) toggle.classList.toggle('active', levelFilterEnabled);
  if (levelSection) levelSection.style.display = levelFilterEnabled ? 'block' : 'none';
}


let currentTab = 'words';

const LEVELS = ['N5','N4','N3','N2','N1'];

function safeDBRun(sql, params) {
  if (!contentDB) {
    console.error('Database not loaded');
    return false;
  }
  try {
    contentDB.run(sql, params);
    return true;
  } catch(e) {
    console.error('DB error:', e);
    return false;
  }
}

async function init() {
  try {
    console.log('init() called');
    console.log('Initializing SQL.js...');
    SQL = await initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}` });
    console.log('SQL.js initialized OK');
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
  } catch(e) { 
    console.error('Init error:', e); 
    document.getElementById('content').innerHTML = '<p style="text-align:center;padding:40px;color:#ff3b30;">初期化エラー: ' + e.message + '</p>';
  }
  // Theme
  const theme = localStorage.getItem('theme');
  document.body.classList.remove('dark', 'light');
  if (theme === 'dark') document.body.classList.add('dark');
  else if (theme === 'light') document.body.classList.add('light');
  updateThemeButton();
  renderLevelNav();
  switchTab('words');
  // Auto-load N5 on startup
  console.log('Calling loadLevel...');
  await loadLevel('N5');
  console.log('loadLevel completed, contentDB:', contentDB ? 'OK' : 'NULL');
}

function goToWord(word) {
  closeSearch();
  currentFilter = '';
  currentOffset = 0;
  allLoaded = [];
  renderContent();
  setTimeout(() => {
    scrollToWord(word, 0);
  }, 200);
}

function scrollToWord(word, attempts) {
  const cards = document.querySelectorAll('.card');
  for (const card of cards) {
    const wordEl = card.querySelector('.word');
    if (wordEl) {
      const text = wordEl.textContent || '';
      const html = wordEl.innerHTML || '';
      if (text.includes(word) || html.includes(word)) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.outline = '2px solid var(--primary)';
        setTimeout(() => card.style.outline = '', 2000);
        return;
      }
    }
  }
  // Load more and retry
  if (hasMore && attempts < 10) {
    loadMore();
    setTimeout(() => scrollToWord(word, attempts + 1), 300);
  }
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
          html += `<div class="card search-result" style="margin:8px 0;cursor:pointer;" data-word="${r[0].replace(/"/g, '"')}" onclick="goToWord(this.dataset.word)"><div class="word">${toRuby(r[0], r[1])} <span class="badge">${r[3]}</span></div><div class="meaning">${r[2]}</div></div>`;
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
  updateThemeButton();
}
function updateThemeButton() {
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const theme = localStorage.getItem('theme') || 'auto';
  if (theme === 'dark') {
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  } else {
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
}
function updateLevelIndicator() {
  const title = document.getElementById('topTitle');
  if (!title) return;
  let wrap = document.getElementById('topTitleWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'topTitleWrap';
    wrap.className = 'top-title-wrap';
    title.parentNode.insertBefore(wrap, title);
    wrap.appendChild(title);
  }
  let indicator = document.getElementById('levelIndicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'levelIndicator';
    indicator.className = 'level-indicator';
    indicator.style.cursor = 'pointer';
    indicator.onclick = showLevelMenu;
    wrap.appendChild(indicator);
  }
  indicator.textContent = currentLevel ? currentLevel : '';
  indicator.style.display = levelFilterEnabled ? 'block' : 'none';
}

function showLevelMenu() {
  let menu = document.getElementById('levelMenu');
  if (menu) { menu.remove(); return; }
  menu = document.createElement('div');
  menu.id = 'levelMenu';
  menu.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:var(--card);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:200;padding:8px;min-width:120px;';
  LEVELS.forEach(lv => {
    const btn = document.createElement('button');
    btn.textContent = lv;
    btn.style.cssText = 'display:block;width:100%;padding:10px 16px;border:none;background:' + (lv===currentLevel?'var(--primary)':'transparent') + ';color:' + (lv===currentLevel?'#fff':'var(--text)') + ';border-radius:8px;cursor:pointer;font-size:16px;text-align:center;margin:2px 0;';
    btn.onclick = () => { menu.remove(); currentLevel = lv; loadLevel(lv); switchTab('words'); };
    menu.appendChild(btn);
  });
  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!menu.contains(e.target) && e.target.id !== 'levelIndicator') {
        menu.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 10);
}

function renderLevelNav() {
  const nav = document.getElementById('levelNav');
  if (!nav) return;
  nav.innerHTML = '';
  const levelColors = { 'N5': 'green', 'N4': 'blue', 'N3': 'orange', 'N2': 'purple', 'N1': 'red' };
  LEVELS.forEach(lv => {
    const item = document.createElement('div');
    item.className = 'settings-item';
    const isActive = lv === currentLevel;
    item.innerHTML = `
      <span class="settings-icon ${levelColors[lv] || 'blue'}">${isActive ? '✓' : lv.slice(1)}</span>
      <span class="settings-label">${lv}</span>
      <span class="settings-value">${isActive ? '選択中' : ''}</span>
      <span class="settings-chevron">›</span>
    `;
    item.onclick = () => { currentLevel = lv; loadLevel(lv); closeSettings(); switchTab('words'); };
    nav.appendChild(item);
  });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  const titles = { words: '単語', grammar: '文法', exercises: '練習', conversation: '会話', settings: '設定' };
  document.getElementById('topTitle').textContent = titles[tab] || 'JLPT';
  if (tab === 'settings') {
    showSettings();
  } else if (tab === 'conversation') {
    showConversations();
  } else {
    renderContent();
  }
  updateLevelIndicator();
}

async function loadLevel(level) {
  currentLevel = level;
  updateLevelIndicator();
  renderLevelNav();
  
  // Show loading message
  document.getElementById('content').innerHTML = '<p style="text-align:center;padding:40px;color:#8e8e93;">読み込み中...</p>';
  
  // Check if SQL is ready
  if (!SQL) {
    console.error('SQL.js not initialized');
    document.getElementById('content').innerHTML = '<p style="text-align:center;padding:40px;color:#ff3b30;">SQL.js が読み込まれていません。<br>ページを再読み込みしてください。</p>';
    return;
  }

  const paths = ['data/data.db', './data/data.db', '/data/data.db'];
  let loaded = false;

  for (const fname of paths) {
    try {
      console.log('Trying:', fname);
      const resp = await fetch(fname + '?t=' + Date.now());
      console.log('Response:', resp.status, resp.ok);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        console.log('Size:', buf.byteLength);
        if (buf.byteLength > 1000) {
          contentDB = new SQL.Database(new Uint8Array(buf));
          console.log('Loaded successfully from', fname);
          loaded = true;
          break;
        }
      }
    } catch(e) {
      console.error('Failed:', fname, e);
    }
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



function goBackToSettings() {
  switchTab('settings');
}

function showSettings() {
  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="settings-content" style="padding-top:20px;">
      <div class="settings-section">
        <div class="settings-section-header">表示設定</div>
        <div class="settings-group">
          <div class="settings-item">
            <span class="settings-icon orange">📚</span>
            <span class="settings-label">レベル別に表示</span>
            <div class="ios-toggle ${levelFilterEnabled ? 'active' : ''}" id="levelFilterToggle" onclick="toggleLevelFilter()"></div>
          </div>
        </div>
      </div>
      <div class="settings-section" id="levelSection" style="display:${levelFilterEnabled ? 'block' : 'none'}">
        <div class="settings-section-header">レベル選択</div>
        <div class="settings-group" id="levelNavSettings"></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-header">学習</div>
        <div class="settings-group">
          <div class="settings-item" onclick="showSummary()">
            <span class="settings-icon green">📊</span>
            <span class="settings-label">学習進捗</span>
            <span class="settings-chevron">›</span>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-header">データ管理</div>
        <div class="settings-group">
          <div class="settings-item" onclick="openCMS()">
            <span class="settings-icon blue">✏️</span>
            <span class="settings-label">内容を管理</span>
            <span class="settings-chevron">›</span>
          </div>
          <div class="settings-item" onclick="exportContentDB()">
            <span class="settings-icon orange">📤</span>
            <span class="settings-label">内容をエクスポート</span>
            <span class="settings-chevron">›</span>
          </div>
          <div class="settings-item" onclick="exportUserDB()">
            <span class="settings-icon purple">💾</span>
            <span class="settings-label">進捗をエクスポート</span>
            <span class="settings-chevron">›</span>
          </div>
          <input type="file" id="importUser" accept=".db,.sqlite" style="display:none" onchange="importUserDB(this)">
          <div class="settings-item" onclick="document.getElementById('importUser').click()">
            <span class="settings-icon gray">📥</span>
            <span class="settings-label">進捗をインポート</span>
            <span class="settings-chevron">›</span>
          </div>
        </div>
      </div>
    </div>
  `;
  renderLevelNavSettings();
}

function renderLevelNavSettings() {
  const nav = document.getElementById('levelNavSettings');
  if (!nav) return;
  nav.innerHTML = '';
  const levelColors = { 'N5': 'green', 'N4': 'blue', 'N3': 'orange', 'N2': 'purple', 'N1': 'red' };
  LEVELS.forEach(lv => {
    const item = document.createElement('div');
    item.className = 'settings-item';
    const isActive = lv === currentLevel;
    item.innerHTML = `
      <span class="settings-icon ${levelColors[lv] || 'blue'}">${isActive ? '✓' : lv.slice(1)}</span>
      <span class="settings-label">${lv}</span>
      <span class="settings-value">${isActive ? '選択中' : ''}</span>
      <span class="settings-chevron">›</span>
    `;
    item.onclick = () => { currentLevel = lv; loadLevel(lv); switchTab('words'); };
    nav.appendChild(item);
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
  if (word.includes('<ruby>')) return word;
  // Include 々 (U+3005) and other repetition marks as kanji
  const kanjiRegex = /[\u4e00-\u9faf\u3005]/;
  if (!kanjiRegex.test(word)) return word;
  if (!reading) {
    return word.replace(/([\u4e00-\u9faf\u3005]+)/g, '<ruby>$1<rt></rt></ruby>');
  }
  // If whole word is kanji (including 々)
  if (/^[\u4e00-\u9faf\u3005]+$/.test(word)) {
    return `<ruby>${word}<rt>${reading}</rt></ruby>`;
  }
  // Mixed kanji/hiragana - match reading to word structure
  let result = '';
  let ri = 0;
  let i = 0;
  while (i < word.length) {
    if (kanjiRegex.test(word[i])) {
      let kanjiEnd = i;
      while (kanjiEnd < word.length && kanjiRegex.test(word[kanjiEnd])) {
        kanjiEnd++;
      }
      const kanji = word.slice(i, kanjiEnd);
      let nextHira = '';
      if (kanjiEnd < word.length && /[ぁ-ん]/.test(word[kanjiEnd])) {
        let hiraEnd = kanjiEnd;
        while (hiraEnd < word.length && /[ぁ-ん]/.test(word[hiraEnd])) {
          hiraEnd++;
        }
        nextHira = word.slice(kanjiEnd, hiraEnd);
      }
      let kanjiReading = '';
      if (nextHira) {
        const nextHiraIdx = reading.indexOf(nextHira, ri);
        if (nextHiraIdx > ri) {
          kanjiReading = reading.slice(ri, nextHiraIdx);
          ri = nextHiraIdx;
        } else {
          kanjiReading = reading.slice(ri);
          ri = reading.length;
        }
      } else {
        kanjiReading = reading.slice(ri);
        ri = reading.length;
      }
      result += `<ruby>${kanji}<rt>${kanjiReading}</rt></ruby>`;
      i = kanjiEnd;
    } else {
      result += word[i];
      if (ri < reading.length && word[i] === reading[ri]) {
        ri++;
      }
      i++;
    }
  }
  return result;
}

let currentFilter = '';
let currentOffset = 0;
let isLoading = false;
let hasMore = true;
const PAGE_SIZE = 100;

function showWords(container, append = false) {
  try {
    console.log('showWords called, level:', currentLevel, 'filter:', currentFilter);
    let sql = levelFilterEnabled ? "SELECT * FROM vocab WHERE level = ?" : "SELECT * FROM vocab WHERE 1=1";
    let params = levelFilterEnabled ? [currentLevel] : [];
    console.log('SQL:', sql, 'params:', params);
    if (currentFilter) {
      if (currentFilter === '形容詞') {
        sql += " AND pos LIKE '%形容詞%'";
      } else if (currentFilter === 'い形容詞') {
        sql += " AND pos = 'い形容詞'";
      } else if (currentFilter === 'な形容詞') {
        sql += " AND pos = 'な形容詞'";
      } else if (currentFilter === '動詞') {
        sql += " AND (pos = '動詞' OR pos LIKE '%動詞%') AND pos != '感動詞'";
      } else {
        sql += " AND pos = ?";
        params.push(currentFilter);
      }
    }
    sql += " ORDER BY reading LIMIT " + PAGE_SIZE + " OFFSET " + currentOffset;
    const rows = contentDB.exec(sql, params);
    console.log('Query result:', rows.length, rows[0] ? rows[0].values.length : 0);
    
    let filterHtml = `<div class="filter-bar">
      <button class="filter-btn ${currentFilter===''?'active':''}" onclick="setFilter('')">すべて</button>
      <button class="filter-btn ${currentFilter==='名詞'?'active':''}" onclick="setFilter('名詞')">名詞</button>
      <button class="filter-btn ${currentFilter==='動詞'?'active':''}" onclick="setFilter('動詞')">動詞</button>
      <button class="filter-btn ${currentFilter==='い形容詞'?'active':''}" onclick="setFilter('い形容詞')">い形容詞</button>
      <button class="filter-btn ${currentFilter==='な形容詞'?'active':''}" onclick="setFilter('な形容詞')">な形容詞</button>
      <button class="filter-btn ${currentFilter==='副詞'?'active':''}" onclick="setFilter('副詞')">副詞</button>
      <button class="filter-btn ${currentFilter==='感動詞'?'active':''}" onclick="setFilter('感動詞')">感動詞</button>
    </div>`;
    
    let html = filterHtml;
    if (!rows.length || !rows[0].values.length) {
      if (!append) {
        html += '<p style="text-align:center;padding:40px;">語彙データなし</p>';
      }
      hasMore = false;
      const loadMore = document.getElementById('loadMore');
      if (loadMore) loadMore.remove();
      if (!append) container.innerHTML = html;
      return;
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
          // Always show ます形 as main word for verbs
          if (conjMap['ます']) {
            displayWord = conjMap['ます'];
            // Reading is already in ます形 from database
          }
          // Order: 辞書形 first, then others (exclude ます形 from list)
          const order = ['辞書','て','た','ない','可能','使役','受身','自然','相反','尊敬','謙譲'];
          const conjs = order.filter(k => conjMap[k]).map(k => {
            const label = {'辞書':'辞書形','て':'て形','た':'た形','ない':'ない形','可能':'可能形','使役':'使役形','受身':'受身形','自然':'自然形','相反':'相反','尊敬':'尊敬語','謙譲':'謙譲語'}[k] || k;
            let value = conjMap[k];
            // Apply ruby to conjugation values
            value = applyRubyToText(value);
            return `<div class="conj-row"><span class="conj-label">${label}</span><span>${value}</span></div>`;
          }).join('');
          conjHtml = `<div class="conj-block">${conjs}</div>`;
          badgeClass = 'badge badge-verb';
        }
        // Adjective conjugations
        else if ((pos === '形容詞' || pos.includes('形容詞')) && r[11]) {
          const conjMap = {};
          r[11].split('|').forEach(c => {
            const [k, v] = c.split(':');
            conjMap[k] = v;
          });
          const conjs = Object.entries(conjMap).map(([k, v]) => {
            const label = {'辞書':'辞書形','です':'です形','ない':'ない形','た':'た形','て':'て形','相反':'反義語'}[k] || k;
            return `<div class="conj-row"><span class="conj-label">${label}</span><span>${toRuby(v, '')}</span></div>`;
          }).join('');
          conjHtml = `<div class="conj-block">${conjs}</div>`;
          badgeClass = pos.includes('い') ? 'badge badge-iadj' : 'badge badge-nadj';
        }
        else if (pos === '名詞') badgeClass = 'badge badge-noun';
        else if (pos === '副詞') badgeClass = 'badge badge-adv';
        else if (pos === '接続詞') badgeClass = 'badge badge-conj';
        else if (pos === '感動詞' || pos === '表現') badgeClass = 'badge badge-expr';
        
        const wordRuby = toRuby(displayWord, displayReading);
        const learnt = isLearnt('vocab', r[0]);
        const learntBtn = `<button class="learnt-btn ${learnt?'done':''}" onclick="toggleLearnt('vocab', ${r[0]}, this)">${learnt?'学習済み':'学習済みにする'}</button>`;
        html += `<div class="card">
          <div class="word">${wordRuby} <span class="${badgeClass}">${pos}</span></div>
          <div class="meaning">${applyRubyToText(r[5] || r[4] || '')}</div>
          <div class="example">例：${applyRubyToText(r[6]||'')}<br><span class="example-tc">${r[8]||''}</span></div>
          ${conjHtml}
          <div style="margin-top:10px;">${learntBtn}</div>
        </div>`;
      });
      
    }
    if (append) {
      // Remove old loadMore indicator
      const oldLoadMore = document.getElementById('loadMore');
      if (oldLoadMore) oldLoadMore.remove();
      // Append new content (without filter bar)
      const cardsHtml = html.replace(filterHtml, '');
      container.insertAdjacentHTML('beforeend', cardsHtml);
    } else {
      container.innerHTML = html;
    }
  } catch(e) { 
    console.error(e);
    container.innerHTML = '<p>語彙テーブルがありません</p>'; 
  }
}


// Infinite scroll removed

function setFilter(pos) {
  currentFilter = pos;
  currentOffset = 0;
  hasMore = true;
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
    '若い':'わかい','部屋':'へや','店':'みせ','物':'もの','犬':'いぬ',
    '東京駅':'とうきょうえき','スカイツリー':'すかいつりー','山手線':'やまのてせん',
    '上野駅':'うえのえき','日比谷線':'ひびやせん','押上駅':'おしあげえき',
    '三十分':'さんじゅっぷん','便利':'べんり','電車':'でんしゃ','乗り換え':'のりかえ',
    '店員':'てんいん','客':'きゃく','注文':'ちゅうもん','決まり':'きまり',
    '飲み物':'のみもの','店内':'てんない','召し上がり':'めしあがり','持ち帰り':'もちかえり',
    '多め':'おおめ','少々':'しょうしょう','待ち':'まち','一つ':'ひとつ',
    'おにぎり':'おにぎり','朝':'あさ','作った':'つくった','温かい':'あたたかい',
    '二つ':'ふたつ','ポイントカード':'ぽいんとかーど','持っています':'もっています',
    'ありがとうございました':'ありがとうございました','お越し':'おこし',
    '居酒屋':'いざかや','夕食':'ゆうしょく','何名様':'なんめいさま','二名':'にめい',
    '席':'せき','奥':'おく','案内':'あんない','とりあえず':'とりあえず',
    '生ビール':'なまびーる','おすすめ':'おすすめ','メニュー':'めにゅー',
    '新鮮':'しんせん','刺身':'さしみ','焼き鳥':'やきとり','人気':'にんき',
    '盛り合わせ':'もりあわせ','五本':'ごほん','日本酒':'にほんしゅ','辛い':'からい',
    '好き':'すき','かしこまりました':'かしこまりました',
    '医師':'いし','患者':'かんじゃ','頭':'あたま','痛い':'いたい','熱':'ねつ',
    '昨日':'きのう','続く':'つづく','体温':'たいおん','測る':'はかる','口':'くち',
    '開ける':'あける','三十八度':'さんじゅうはちど','風邪':'かぜ','可能性':'かのうせい',
    '高い':'たかい','薬':'くすり','出す':'だす','食後':'しょくご','飲む':'のむ',
    '治る':'なおる','二、三日':'に、さんにち','思う':'おもう','無理':'むり',
    '美容院':'びよういん','予約':'よやく','希望':'きぼう','日時':'にちじ',
    '明日':'あした','午後':'ごご','三時':'さんじ','頃':'ごろ','空く':'あく',
    '少々':'しょうしょう','待つ':'まつ','大丈夫':'だいじょうぶ','名前':'なまえ',
    '教える':'おしえる','田中':'たなか','様':'さま','承る':'うけたまわる',
    '部下':'ぶか','上司':'じょうし','忙しい':'いそがしい','会議':'かいぎ',
    '内容':'ないよう','報告':'ほうこく','新しい':'あたらしい','予算':'よさん',
    '承認':'しょうにん','来週':'らいしゅう','作業':'さぎょう','始める':'はじめる',
    '問題':'もんだい','今':'いま','特に':'とくに','人員':'じんいん','少ない':'すくない',
    '追加':'ついか','検討':'けんとう','計画書':'けいかくしょ','作る':'つくる',
    '提出':'ていしゅつ','準備':'じゅんび','元気':'げんき','連絡':'れんらく',
    '旅行':'りょこう','楽しい':'たのしい','最近':'さいきん','面白い':'おもしろい',
    '道':'みち','進む':'すすむ','二つ目':'ふたつめ','信号':'しんごう','右':'みぎ',
    '曲がる':'まがる','歩く':'あるく','五分':'ごふん','迷う':'まよう','聞く':'きく',
    '気':'き','久しぶり':'ひさしぶり','仕事':'しごと','大変':'たいへん'
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
    const rows = contentDB.exec("SELECT * FROM grammar WHERE level = ? ORDER BY title", [currentLevel]);
    if (!rows.length) { container.innerHTML = '<p style="text-align:center;padding:40px;">文法データなし</p>'; return; }
    let html = '';
    rows[0].values.forEach(r => {
      const title = r[2];
      const examples = (r[5]||'').split('|').map(e => '・' + applyRubyToText(e)).join('<br>');
      const learnt = isLearnt('grammar', r[0]);
      const learntBtn = `<button class="learnt-btn ${learnt?'done':''}" onclick="toggleLearnt('grammar', ${r[0]}, this)">${learnt?'学習済み':'学習済みにする'}</button>`;
      html += `<div class="card"><div class="word">${title}</div>
        <div style="margin-top:8px;">${applyRubyToText(r[3])}<br><span style="color:#666;">${r[4]}</span></div>
        <div style="margin-top:8px;font-size:15px;">${examples}</div>
        <div style="margin-top:10px;">${learntBtn}</div></div>`;
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
          updateThemeButton();
        }
      } catch(err) {}
      document.getElementById('status').innerText = '進捗と設定をインポートしました';
      renderContent();
    } catch(err) { alert('インポート失敗'); }
  };
  reader.readAsArrayBuffer(file);
}

// ===== CMS Functions =====
let cmsType = 'vocab';

function openCMS() {
  currentTab = 'cms';
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  document.getElementById('topTitle').textContent = 'CMS';
  showCMS();
}

function showCMS() {
  const container = document.getElementById('content');
  container.innerHTML = `
    <div style="padding:12px 16px;">
      <button onclick="switchTab('settings')" style="background:none;border:none;color:var(--primary);font-size:16px;cursor:pointer;padding:8px 0;">← 戻る</button>
    </div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px;">内容管理 / 內容管理</div>
      <div class="level-btns">
        <button class="${cmsType==='vocab'?'active':''}" onclick="cmsType='vocab';showCMS()">単語</button>
        <button class="${cmsType==='grammar'?'active':''}" onclick="cmsType='grammar';showCMS()">文法</button>
        <button class="${cmsType==='rearrange'?'active':''}" onclick="cmsType='rearrange';showCMS()">練習</button>
      </div>
      <button class="action" onclick="showCMSForm()">新規追加</button>
    </div>
    <div id="cmsList"></div>
  `;
  loadCMSList();
}

function loadCMSList() {
  if (!contentDB) return;
  const list = document.getElementById('cmsList');
  let html = '';
  try {
    if (cmsType === 'vocab') {
      const rows = contentDB.exec("SELECT id, level, word, reading, pos FROM vocab ORDER BY level, id LIMIT 100");
      if (rows.length) {
        rows[0].values.forEach(r => {
          html += `<div class="card" style="padding:12px;">
            <div style="font-weight:600;">${r[2]} <span style="color:#888;font-size:13px;">${r[1]} · ${r[4]||''}</span></div>
            <div style="font-size:13px;color:#666;">${r[3]||''}</div>
            <button class="action" style="padding:6px 10px;font-size:13px;" onclick="editCMSItem('vocab', ${r[0]})">編集</button>
            <button class="action" style="padding:6px 10px;font-size:13px;background:#ff3b30;" onclick="deleteCMSItem('vocab', ${r[0]})">削除</button>
          </div>`;
        });
      }
    } else if (cmsType === 'grammar') {
      const rows = contentDB.exec("SELECT id, level, title FROM grammar ORDER BY level, id LIMIT 50");
      if (rows.length) {
        rows[0].values.forEach(r => {
          html += `<div class="card" style="padding:12px;">
            <div style="font-weight:600;">${r[2]} <span style="color:#888;font-size:13px;">${r[1]}</span></div>
            <button class="action" style="padding:6px 10px;font-size:13px;" onclick="editCMSItem('grammar', ${r[0]})">編集</button>
            <button class="action" style="padding:6px 10px;font-size:13px;background:#ff3b30;" onclick="deleteCMSItem('grammar', ${r[0]})">削除</button>
          </div>`;
        });
      }
    } else if (cmsType === 'rearrange') {
      const rows = contentDB.exec("SELECT id, level, correct FROM rearrange ORDER BY level, id LIMIT 50");
      if (rows.length) {
        rows[0].values.forEach(r => {
          html += `<div class="card" style="padding:12px;">
            <div style="font-weight:600;">${r[2].substring(0,40)}... <span style="color:#888;font-size:13px;">${r[1]}</span></div>
            <button class="action" style="padding:6px 10px;font-size:13px;" onclick="editCMSItem('rearrange', ${r[0]})">編集</button>
            <button class="action" style="padding:6px 10px;font-size:13px;background:#ff3b30;" onclick="deleteCMSItem('rearrange', ${r[0]})">削除</button>
          </div>`;
        });
      }
    }
  } catch(e) { html = '<p>読み込みエラー</p>'; }
  list.innerHTML = html || '<p style="text-align:center;padding:20px;color:#888;">データなし</p>';
}

function showCMSForm(id) {
  const container = document.getElementById('content');
  let formHtml = '<div class="card"><h3>' + (id ? '編集' : '新規追加') + '</h3>';
  if (cmsType === 'vocab') {
    formHtml += `
      <label>レベル</label><input id="f_level" placeholder="N5" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>単語</label><input id="f_word" placeholder="食べる" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>読み</label><input id="f_reading" placeholder="たべる" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>品詞</label><input id="f_pos" placeholder="動詞" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>意味（中文）</label><input id="f_meaning_tc" placeholder="吃" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>例文</label><textarea id="f_example" placeholder="ご飯を食べます。" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;height:60px;"></textarea><br>
      <label>例文翻訳</label><input id="f_example_tc" placeholder="吃飯。" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
    `;
  } else if (cmsType === 'grammar') {
    formHtml += `
      <label>レベル</label><input id="f_level" placeholder="N5" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>タイトル</label><input id="f_title" placeholder="は" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>説明（日）</label><textarea id="f_exp_jp" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;height:60px;"></textarea><br>
      <label>説明（中）</label><textarea id="f_exp_tc" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;height:60px;"></textarea><br>
      <label>例文（|区切り）</label><textarea id="f_examples" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;height:60px;"></textarea><br>
    `;
  } else {
    formHtml += `
      <label>レベル</label><input id="f_level" placeholder="N5" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>正しい文</label><input id="f_correct" placeholder="先生は新しいです。" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
      <label>パーツ（|区切り）</label><input id="f_parts" placeholder="先生|は|新しい|です" style="width:100%;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:8px;"><br>
    `;
  }
  formHtml += `<button class="action" onclick="saveCMSItem(${id||'null'})">保存</button>
    <button class="action" style="background:#8e8e93;" onclick="showCMS()">戻る</button></div>`;
  container.innerHTML = formHtml;
  if (id) loadCMSItem(id);
}

function loadCMSItem(id) {
  try {
    if (cmsType === 'vocab') {
      const r = contentDB.exec("SELECT level, word, reading, pos, meaning_tc, example, meaning_tc_example FROM vocab WHERE id=?", [id]);
      if (r.length) {
        const v = r[0].values[0];
        document.getElementById('f_level').value = v[0]||'';
        document.getElementById('f_word').value = v[1]||'';
        document.getElementById('f_reading').value = v[2]||'';
        document.getElementById('f_pos').value = v[3]||'';
        document.getElementById('f_meaning_tc').value = v[4]||'';
        document.getElementById('f_example').value = v[5]||'';
        document.getElementById('f_example_tc').value = v[6]||'';
      }
    } else if (cmsType === 'grammar') {
      const r = contentDB.exec("SELECT level, title, explanation_jp, explanation_tc, examples FROM grammar WHERE id=?", [id]);
      if (r.length) {
        const v = r[0].values[0];
        document.getElementById('f_level').value = v[0]||'';
        document.getElementById('f_title').value = v[1]||'';
        document.getElementById('f_exp_jp').value = v[2]||'';
        document.getElementById('f_exp_tc').value = v[3]||'';
        document.getElementById('f_examples').value = v[4]||'';
      }
    } else {
      const r = contentDB.exec("SELECT level, correct, parts FROM rearrange WHERE id=?", [id]);
      if (r.length) {
        const v = r[0].values[0];
        document.getElementById('f_level').value = v[0]||'';
        document.getElementById('f_correct').value = v[1]||'';
        document.getElementById('f_parts').value = v[2]||'';
      }
    }
  } catch(e) { 
    console.error('Init error:', e); 
    document.getElementById('content').innerHTML = '<p style="text-align:center;padding:40px;color:#ff3b30;">初期化エラー: ' + e.message + '</p>';
  }
}

function saveCMSItem(id) {
  try {
    if (cmsType === 'vocab') {
      const level = document.getElementById('f_level').value;
      const word = document.getElementById('f_word').value;
      const reading = document.getElementById('f_reading').value;
      const pos = document.getElementById('f_pos').value;
      const meaning_tc = document.getElementById('f_meaning_tc').value;
      const example = document.getElementById('f_example').value;
      const example_tc = document.getElementById('f_example_tc').value;
      if (id) {
        safeDBRun("UPDATE vocab SET level=?, word=?, reading=?, pos=?, meaning_tc=?, example=?, meaning_tc_example=? WHERE id=?",
          [level, word, reading, pos, meaning_tc, example, example_tc, id]);
      } else {
        safeDBRun("INSERT INTO vocab (level, word, reading, pos, meaning_tc, example, meaning_tc_example) VALUES (?,?,?,?,?,?,?)",
          [level, word, reading, pos, meaning_tc, example, example_tc]);
      }
    } else if (cmsType === 'grammar') {
      const level = document.getElementById('f_level').value;
      const title = document.getElementById('f_title').value;
      const exp_jp = document.getElementById('f_exp_jp').value;
      const exp_tc = document.getElementById('f_exp_tc').value;
      const examples = document.getElementById('f_examples').value;
      if (id) {
        safeDBRun("UPDATE grammar SET level=?, title=?, explanation_jp=?, explanation_tc=?, examples=? WHERE id=?",
          [level, title, exp_jp, exp_tc, examples, id]);
      } else {
        safeDBRun("INSERT INTO grammar (level, title, explanation_jp, explanation_tc, examples) VALUES (?,?,?,?,?)",
          [level, title, exp_jp, exp_tc, examples]);
      }
    } else {
      const level = document.getElementById('f_level').value;
      const correct = document.getElementById('f_correct').value;
      const parts = document.getElementById('f_parts').value;
      if (id) {
        safeDBRun("UPDATE rearrange SET level=?, correct=?, parts=? WHERE id=?", [level, correct, parts, id]);
      } else {
        safeDBRun("INSERT INTO rearrange (level, correct, parts) VALUES (?,?,?)", [level, correct, parts]);
      }
    }
    alert('保存しました');
    showCMS();
  } catch(e) { alert('保存エラー: ' + e.message); }
}

function editCMSItem(type, id) {
  cmsType = type;
  showCMSForm(id);
}

function deleteCMSItem(type, id) {
  if (!confirm('削除しますか？')) return;
  try {
    contentDB.run(`DELETE FROM ${type} WHERE id=?`, [id]);
    alert('削除しました');
    showCMS();
  } catch(e) { alert('削除エラー: ' + e.message); }
}

function exportContentDB() {
  if (!contentDB) { alert('DBがありません'); return; }
  try {
    const data = contentDB.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.db';
    a.click();
  } catch(e) { alert('エクスポートエラー: ' + e.message); }
}

// ===== Progress / Learnt =====
function isLearnt(type, id) {
  if (!userDB) return false;
  try {
    const r = userDB.exec("SELECT status FROM progress WHERE level=? AND type=? AND item_id=?", [currentLevel, type, id]);
    return r.length && r[0].values.length && r[0].values[0][0] === 'learnt';
  } catch(e) { return false; }
}

function toggleLearnt(type, id, btn) {
  if (!userDB) return;
  const learnt = isLearnt(type, id);
  if (learnt) {
    userDB.run("DELETE FROM progress WHERE level=? AND type=? AND item_id=?", [currentLevel, type, id]);
    btn.textContent = '学習済みにする';
    btn.classList.remove('done');
  } else {
    userDB.run("INSERT OR REPLACE INTO progress (level, type, item_id, status, last_reviewed) VALUES (?, ?, ?, 'learnt', datetime('now'))",
      [currentLevel, type, id]);
    btn.textContent = '学習済み';
    btn.classList.add('done');
  }
}

function showSummary() {
  const container = document.getElementById('content');
  let html = '<div style="padding:12px 16px;"><button onclick="switchTab(\'settings\')" style="background:none;border:none;color:var(--primary);font-size:16px;cursor:pointer;padding:8px 0;">← 戻る</button></div>';
  html += '<div class="card"><h3>学習進捗 / 學習進度</h3><div class="progress-summary">';
  LEVELS.forEach(lv => {
    let count = 0;
    if (userDB) {
      try {
        const r = userDB.exec("SELECT COUNT(*) FROM progress WHERE level=? AND status='learnt'", [lv]);
        if (r.length) count = r[0].values[0][0];
      } catch(e) {}
    }
    html += `<div class="progress-card"><div class="count">${count}</div><div>${lv}</div></div>`;
  });
  let total = 0;
  if (userDB) {
    try {
      const r = userDB.exec("SELECT COUNT(*) FROM progress WHERE status='learnt'");
      if (r.length) total = r[0].values[0][0];
    } catch(e) {}
  }
  html += `</div><div style="text-align:center;margin-top:12px;font-size:18px;">合計学習済み：<strong>${total}</strong></div></div>`;
  container.innerHTML = html;
}


// ===== Conversations =====

let currentConversation = null;

function showConversations() {
  const container = document.getElementById('content');
  if (currentConversation === null) {
    let html = '<div class="conv-list" style="padding:12px;">';
    conversations.forEach((sc, i) => {
      html += `<div class="card" onclick="openConversation(${i})" style="cursor:pointer;margin-bottom:8px;">
        <div style="font-weight:600;">${sc.title}</div>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  } else {
    const sc = conversations[currentConversation];
    let html = `<div class="chat-container">
      <div class="chat-title" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);">
        <button onclick="currentConversation=null;showConversations();" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--primary);">←</button>
        ${sc.title}
      </div>
      <div class="chat-messages">`;
    sc.lines.forEach(line => {
      const isRight = line.speaker === '自分';
      const side = isRight ? 'right' : 'left';
      const avatar = isRight ? '' : `<div class="chat-avatar">${getAvatar(line.speaker)}</div>`;
      html += `<div class="chat-row ${side}">
        ${avatar}
        <div class="chat-bubble ${side}">
          <div class="chat-speaker">${line.speaker}</div>
          <div class="chat-jp">${applyRubyToText(line.jp)}</div>
          <div class="chat-tc">${line.tc}</div>
        </div>
      </div>`;
    });
    html += '</div></div>';
    container.innerHTML = html;
  }
}

function openConversation(idx) {
  currentConversation = idx;
  showConversations();
}

function getAvatar(speaker) {
  const avatars = {
    '自分': '😊', '日本人': '👨', '店員': '🧑‍💼', '客': '🙋', '客B': '🙋‍♂️',
    '医師': '👨‍⚕️', '患者': '🤒', '上司': '👔', '彼氏': '👨', '友達B': '👩', '部下': '💼', '面接官': '📋',
    '応募者': '📝', '通行人': '🚶', '佐藤': '👩', '鈴木': '👨', '高橋': '👩', '伊藤': '👨'
  };
  return avatars[speaker] || '👤';
}

const conversations = [
  {
    title: 'シナリオ1：東京駅からスカイツリーまでの道を聞く会話',
    lines: [
      { speaker: '自分', jp: 'すみません。<ruby>東京駅<rt>とうきょうえき</rt></ruby>からスカイツリーまで、どうやって<ruby>行<rt>い</rt></ruby>けばいいですか。<ruby>電車<rt>でんしゃ</rt></ruby>がいいですか、それともバスですか。', tc: '不好意思。從東京車站到晴空塔，怎麼去比較好呢？坐電車好還是巴士好？' },
      { speaker: '日本人', jp: 'はい、スカイツリーですね。<ruby>電車<rt>でんしゃ</rt></ruby>で<ruby>行<rt>い</rt></ruby>くのが<ruby>一番<rt>いちばん</rt></ruby><ruby>便利<rt>べんり</rt></ruby>ですよ。<ruby>山手線<rt>やまのてせん</rt></ruby>に<ruby>乗<rt>の</rt></ruby>って、<ruby>上野駅<rt>うえのえき</rt></ruby>で<ruby>乗<rt>の</rt></ruby>り<ruby>換<rt>か</rt></ruby>えます。それから<ruby>日比谷線<rt>ひびやせん</rt></ruby>で<ruby>押上駅<rt>おしあげえき</rt></ruby>まで<ruby>行<rt>い</rt></ruby>きます。', tc: '是晴空塔啊。坐電車最方便喔。搭山手線到上野站轉車。然後搭日比谷線到押上站。' },
      { speaker: '自分', jp: 'ありがとうございます。どのくらい<ruby>時間<rt>じかん</rt></ruby>がかかりますか。<ruby>切符<rt>きっぷ</rt></ruby>はどこで<ruby>買<rt>か</rt></ruby>えばいいですか。ICカードは<ruby>使<rt>つか</rt></ruby>えますか。', tc: '謝謝。大概要花多久時間？車票要在哪裡買？IC卡可以使用嗎？' },
      { speaker: '日本人', jp: 'だいたい<ruby>三十分<rt>さんじゅっぷん</rt></ruby>くらいです。<ruby>切符<rt>きっぷ</rt></ruby>はこの<ruby>駅<rt>えき</rt></ruby>の<ruby>自動券売機<rt>じどうけんばいき</rt></ruby>で<ruby>買<rt>か</rt></ruby>えますよ。ICカードも<ruby>使<rt>つか</rt></ruby>えます。<ruby>駅<rt>えき</rt></ruby>を<ruby>出<rt>で</rt></ruby>たら、すぐスカイツリーが<ruby>見<rt>み</rt></ruby>えます。', tc: '大概三十分鐘左右。車票可以在這個車站的自動售票機買。IC卡也可以用。出了車站馬上就能看到晴空塔。' },
      { speaker: '自分', jp: 'わかりました。<ruby>助<rt>たす</rt></ruby>かります。もし<ruby>迷<rt>まよ</rt></ruby>ったら、また<ruby>聞<rt>き</rt></ruby>いてもいいですか。<ruby>帰<rt>かえ</rt></ruby>りの<ruby>電車<rt>でんしゃ</rt></ruby>は<ruby>終電<rt>しゅうでん</rt></ruby>が<ruby>遅<rt>おそ</rt></ruby>いですか。', tc: '明白了。幫了大忙。如果迷路了可以再問嗎？回程的電車末班車晚嗎？' },
      { speaker: '日本人', jp: 'もちろんです。<ruby>終電<rt>しゅうでん</rt></ruby>は<ruby>十二時<rt>じゅうにじ</rt></ruby><ruby>過<rt>す</rt></ruby>ぎまでありますよ。<ruby>気<rt>き</rt></ruby>をつけて<ruby>行<rt>い</rt></ruby>ってください。', tc: '當然可以。末班車到十二點過後都有喔。路上小心。' },
      { speaker: '自分', jp: 'ありがとうございます。<ruby>電車<rt>でんしゃ</rt></ruby>の<ruby>中<rt>なか</rt></ruby>で<ruby>座<rt>すわ</rt></ruby>れますか。<ruby>混<rt>こ</rt></ruby>んでますか。', tc: '謝謝。電車裡可以坐到位子嗎？會很擠嗎？' },
      { speaker: '日本人', jp: '<ruby>平日<rt>へいじつ</rt></ruby>の<ruby>昼間<rt>ひるま</rt></ruby>なら<ruby>空<rt>す</rt></ruby>いていますよ。<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。', tc: '平日的白天的話會比較空喔。沒問題的。' },
      { speaker: '自分', jp: 'わかりました。<ruby>本当<rt>ほんとう</rt></ruby>に<ruby>助<rt>たす</rt></ruby>かりました。ありがとうございました。', tc: '我知道了。真的幫了大忙。謝謝你。' },
      { speaker: '日本人', jp: 'いえいえ。いってらっしゃい。', tc: '不客氣。路上小心。' }
    ]
  },
  {
    title: 'シナリオ2：マクドナルドで食べ物を注文する会話',
    lines: [
      { speaker: '店員', jp: 'いらっしゃいませ。ご<ruby>注文<rt>ちゅうもん</rt></ruby>はお<ruby>決<rt>き</rt></ruby>まりですか。', tc: '歡迎光臨。您決定要點什麼了嗎？' },
      { speaker: '自分', jp: 'はい。ビッグマックセットを<ruby>一<rt>ひと</rt></ruby>つと、ポテトのMサイズをお<ruby>願<rt>ねが</rt></ruby>いします。あと、ナゲットも<ruby>追加<rt>ついか</rt></ruby>できますか。', tc: '是的。請給我一份大麥克套餐，還有一份中薯。雞塊也可以追加嗎？' },
      { speaker: '店員', jp: 'はい、できますよ。<ruby>何個<rt>なんこ</rt></ruby>にしますか。<ruby>飲<rt>の</rt></ruby>み<ruby>物<rt>もの</rt></ruby>は<ruby>何<rt>なに</rt></ruby>にしますか。セットの<ruby>飲<rt>の</rt></ruby>み<ruby>物<rt>もの</rt></ruby>は<ruby>変更<rt>へんこう</rt></ruby>できますよ。', tc: '可以的。要幾個呢？飲料要什麼？套餐的飲料可以更換喔。' },
      { speaker: '自分', jp: 'ナゲットは<ruby>六個<rt>ろっこ</rt></ruby>で、コーラをお<ruby>願<rt>ねが</rt></ruby>いします。ソースは<ruby>多<rt>おお</rt></ruby>めにお<ruby>願<rt>ねが</rt></ruby>いできますか。デザートは<ruby>何<rt>なに</rt></ruby>がありますか。', tc: '雞塊要六個，請給我可樂。醬汁可以多一點嗎？甜點有什麼？' },
      { speaker: '店員', jp: 'かしこまりました。<ruby>店内<rt>てんない</rt></ruby>でお<ruby>召<rt>め</rt></ruby>し<ruby>上<rt>あ</rt></ruby>がりですか、それともお<ruby>持<rt>も</rt></ruby>ち<ruby>帰<rt>かえ</rt></ruby>りですか。アップルパイとソフトクリームがありますよ。', tc: '好的。是在店內用餐，還是外帶呢？有蘋果派和霜淇淋喔。' },
      { speaker: '自分', jp: '<ruby>店内<rt>てんない</rt></ruby>でお<ruby>願<rt>ねが</rt></ruby>いします。アップルパイも<ruby>一<rt>ひと</rt></ruby>つください。ポイントカードは<ruby>使<rt>つか</rt></ruby>えますか。', tc: '在店內用餐。蘋果派也請給我一個。可以使用集點卡嗎？' },
      { speaker: '店員', jp: 'はい、<ruby>使<rt>つか</rt></ruby>えますよ。<ruby>少々<rt>しょうしょう</rt></ruby>お<ruby>待<rt>ま</rt></ruby>ちください。', tc: '可以的。請稍等一下。' },
      { speaker: '自分', jp: 'あと、ソースの<ruby>種類<rt>しゅるい</rt></ruby>は<ruby>何<rt>なに</rt></ruby>がありますか。', tc: '還有，醬汁有哪些種類？' },
      { speaker: '店員', jp: 'ケチャップとマスタード、あとBBQソースがありますよ。', tc: '有番茄醬和芥末醬，還有BBQ醬喔。' },
      { speaker: '自分', jp: 'じゃあ、BBQソースでお<ruby>願<rt>ねが</rt></ruby>いします。', tc: '那就請給我BBQ醬。' },
      { speaker: '店員', jp: 'かしこまりました。こちらがお<ruby>会計<rt>かいけい</rt></ruby>です。ありがとうございました。またお<ruby>越<rt>こ</rt></ruby>しください。', tc: '好的。這是帳單。謝謝您。歡迎再次光臨。' }
    ]
  },
  {
    title: 'シナリオ3：コンビニで買い物をする会話',
    lines: [
      { speaker: '店員', jp: 'いらっしゃいませ。', tc: '歡迎光臨。' },
      { speaker: '自分', jp: 'すみません。このおにぎりは<ruby>今日<rt>きょう</rt></ruby>の<ruby>朝<rt>あさ</rt></ruby><ruby>作<rt>つく</rt></ruby>ったものですか。<ruby>賞味期限<rt>しょうみきげん</rt></ruby>はいつまでですか。', tc: '不好意思。這個飯糰是今天早上做的嗎？保存期限到什麼時候？' },
      { speaker: '店員', jp: 'はい、<ruby>朝<rt>あさ</rt></ruby>に<ruby>新<rt>あたら</rt></ruby>しく<ruby>作<rt>つく</rt></ruby>りました。まだ<ruby>温<rt>あたた</rt></ruby>かいですよ。<ruby>賞味期限<rt>しょうみきげん</rt></ruby>は<ruby>明日<rt>あした</rt></ruby>までです。', tc: '是的，早上剛做好的。還是溫熱的喔。保存期限到明天。' },
      { speaker: '自分', jp: 'じゃあ、これを<ruby>二<rt>ふた</rt></ruby>つと、あとホットコーヒーを<ruby>一<rt>ひと</rt></ruby>つください。お<ruby>弁当<rt>べんとう</rt></ruby>もおすすめありますか。サラダも<ruby>欲<rt>ほ</rt></ruby>しいです。', tc: '那請給我兩個，還有一杯熱咖啡。便當有推薦的嗎？我也想要沙拉。' },
      { speaker: '店員', jp: 'はい、<ruby>今日<rt>きょう</rt></ruby>は<ruby>唐揚<rt>からあ</rt></ruby>げ<ruby>弁当<rt>べんとう</rt></ruby>が<ruby>人気<rt>にんき</rt></ruby>ですよ。サラダはこちらにあります。ポイントカードはお<ruby>持<rt>も</rt></ruby>ちですか。', tc: '有的，今天炸雞便當很受歡迎喔。沙拉在這邊。您有集點卡嗎？' },
      { speaker: '自分', jp: 'はい、<ruby>持<rt>も</rt></ruby>っています。<ruby>唐揚<rt>からあ</rt></ruby>げ<ruby>弁当<rt>べんとう</rt></ruby>も<ruby>一<rt>ひと</rt></ruby>つください。あと、ティッシュもください。', tc: '有的，我有帶。炸雞便當也請給我一個。還有，面紙也請給我。' },
      { speaker: '店員', jp: 'かしこまりました。ありがとうございました。またお<ruby>越<rt>こ</rt></ruby>しください。', tc: '好的。謝謝您。歡迎再次光臨。' },
      { speaker: '自分', jp: 'すみません、<ruby>袋<rt>ふくろ</rt></ruby>は<ruby>有料<rt>ゆうりょう</rt></ruby>ですか。', tc: '不好意思，袋子要收費嗎？' },
      { speaker: '店員', jp: 'はい、<ruby>一枚<rt>いちまい</rt></ruby><ruby>五円<rt>ごえん</rt></ruby>です。', tc: '是的，一個五圓。' },
      { speaker: '自分', jp: 'じゃあ、<ruby>袋<rt>ふくろ</rt></ruby>もお<ruby>願<rt>ねが</rt></ruby>いします。ありがとうございました。', tc: '那袋子也請給我。謝謝。' },
      { speaker: '店員', jp: 'はい、ありがとうございます。またお<ruby>越<rt>こ</rt></ruby>しください。', tc: '好的，謝謝。歡迎再次光臨。' }
    ]
  },
  {
    title: 'シナリオ4：居酒屋で夕食を食べる会話',
    lines: [
      { speaker: '店員', jp: 'いらっしゃいませ。<ruby>何名様<rt>なんめいさま</rt></ruby>ですか。', tc: '歡迎光臨。請問幾位呢？' },
      { speaker: '自分', jp: '<ruby>二名<rt>にめい</rt></ruby>です。<ruby>席<rt>せき</rt></ruby>はありますか。<ruby>禁煙席<rt>きんえんせき</rt></ruby>がいいのですが。', tc: '兩位。有位子嗎？我想要禁煙席。' },
      { speaker: '店員', jp: 'はい、<ruby>奥<rt>おく</rt></ruby>の<ruby>席<rt>せき</rt></ruby>をご<ruby>案内<rt>あんない</rt></ruby>します。メニューはこちらです。<ruby>本日<rt>ほんじつ</rt></ruby>のおすすめもございます。', tc: '有的，我帶您到裡面的位子。這是菜單。今天也有推薦的。' },
      { speaker: '自分', jp: 'とりあえず<ruby>生<rt>なま</rt></ruby>ビールを<ruby>二<rt>ふた</rt></ruby>つください。おすすめのメニューは<ruby>何<rt>なに</rt></ruby>ですか。', tc: '先請給我們兩杯生啤酒。有什麼推薦的菜色嗎？' },
      { speaker: '店員', jp: '<ruby>今日<rt>きょう</rt></ruby>は<ruby>新鮮<rt>しんせん</rt></ruby>な<ruby>刺身<rt>さしみ</rt></ruby>がおすすめです。あと、<ruby>焼<rt>や</rt></ruby>き<ruby>鳥<rt>とり</rt></ruby>も<ruby>人気<rt>にんき</rt></ruby>ですよ。<ruby>季節<rt>きせつ</rt></ruby>の<ruby>野菜<rt>やさい</rt></ruby>の<ruby>煮物<rt>にもの</rt></ruby>もあります。', tc: '今天新鮮的生魚片很推薦。還有烤鳥也很受歡迎喔。還有季節蔬菜的燉菜。' },
      { speaker: '客B', jp: 'じゃあ、<ruby>刺身<rt>さしみ</rt></ruby>の<ruby>盛<rt>も</rt></ruby>り<ruby>合<rt>あ</rt></ruby>わせと、<ruby>焼<rt>や</rt></ruby>き<ruby>鳥<rt>とり</rt></ruby>を<ruby>五本<rt>ごほん</rt></ruby>お<ruby>願<rt>ねが</rt></ruby>いします。', tc: '那就請給我們一份生魚片拼盤，還有五串烤鳥。' },
      { speaker: '自分', jp: '<ruby>私<rt>わたし</rt></ruby>は<ruby>日本酒<rt>にほんしゅ</rt></ruby>にします。<ruby>少<rt>すこ</rt></ruby>し<ruby>辛<rt>から</rt></ruby>いのが<ruby>好<rt>す</rt></ruby>きです。<ruby>野菜<rt>やさい</rt></ruby>の<ruby>煮物<rt>にもの</rt></ruby>も<ruby>一<rt>ひと</rt></ruby>つください。あと、<ruby>枝豆<rt>えだまめ</rt></ruby>もお<ruby>願<rt>ねが</rt></ruby>いします。', tc: '我要喝日本酒。我喜歡稍微辛一點的。蔬菜燉菜也請給我一份。還有毛豆也請給我。' },
      { speaker: '店員', jp: 'かしこまりました。<ruby>少々<rt>しょうしょう</rt></ruby>お<ruby>待<rt>ま</rt></ruby>ちください。', tc: '好的。請稍等一下。' },
      { speaker: '自分', jp: 'すみません、ビールは<ruby>大<rt>おお</rt></ruby>きいサイズありますか。', tc: '不好意思，啤酒有大杯的嗎？' },
      { speaker: '店員', jp: 'はい、ジョッキもありますよ。', tc: '有的，也有大杯喔。' },
      { speaker: '自分', jp: 'じゃあ、ジョッキでお<ruby>願<rt>ねが</rt></ruby>いします。ありがとうございました。', tc: '那就請給我大杯。謝謝。' },
      { speaker: '店員', jp: 'かしこまりました。<ruby>少々<rt>しょうしょう</rt></ruby>お<ruby>待<rt>ま</rt></ruby>ちください。', tc: '好的。請稍等一下。' }
    ]
  },
  {
    title: 'シナリオ5：久しぶりに会った友達との会話',
    lines: [
      { speaker: '自分', jp: '<ruby>久<rt>ひさ</rt></ruby>しぶりですね。<ruby>元気<rt>げんき</rt></ruby>にしていましたか。<ruby>仕事<rt>しごと</rt></ruby>は<ruby>忙<rt>いそが</rt></ruby>しいですか。', tc: '好久不見。你還好嗎？工作忙嗎？' },
      { speaker: 'B', jp: 'はい、おかげさまで<ruby>元気<rt>げんき</rt></ruby>にしています。Aさんはどうですか。<ruby>最近<rt>さいきん</rt></ruby>どうしていましたか。', tc: '還好，託你的福我一直很健康。A你呢？最近過得怎麼樣？' },
      { speaker: '自分', jp: '<ruby>私<rt>わたし</rt></ruby>も<ruby>忙<rt>いそが</rt></ruby>しいですが、<ruby>元気<rt>げんき</rt></ruby>です。<ruby>仕事<rt>しごと</rt></ruby>が<ruby>大変<rt>たいへん</rt></ruby>で、なかなか<ruby>連絡<rt>れんらく</rt></ruby>できなくてすみません。', tc: '我也還好，雖然很忙。工作很辛苦，一直沒聯絡真的很抱歉。' },
      { speaker: 'B', jp: '<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>ですよ。<ruby>今日<rt>きょう</rt></ruby>はゆっくり<ruby>話<rt>はな</rt></ruby>しましょう。<ruby>何<rt>なに</rt></ruby>か<ruby>飲<rt>の</rt></ruby>みますか。ビールでいいですか。', tc: '沒關係啦。今天就好好聊聊吧。要喝點什麼嗎？啤酒可以嗎？' },
      { speaker: '自分', jp: 'じゃあ、ビールを<ruby>一<rt>ひと</rt></ruby>つください。<ruby>最近<rt>さいきん</rt></ruby>、<ruby>何<rt>なに</rt></ruby>か<ruby>面白<rt>おもしろ</rt></ruby>いことがありましたか。<ruby>旅行<rt>りょこう</rt></ruby>に<ruby>行<rt>い</rt></ruby>ったと<ruby>聞<rt>き</rt></ruby>きましたが。', tc: '那就請給我一杯啤酒。最近有什麼有趣的事嗎？聽說你去旅行了？' },
      { speaker: 'B', jp: '<ruby>先週<rt>せんしゅう</rt></ruby>、<ruby>友達<rt>ともだち</rt></ruby>と<ruby>旅行<rt>りょこう</rt></ruby>に<ruby>行<rt>い</rt></ruby>きました。とても<ruby>楽<rt>たの</rt></ruby>しかったです。<ruby>景色<rt>けしき</rt></ruby>が<ruby>素晴<rt>すば</rt></ruby>らしかったですよ。<ruby>京都<rt>きょうと</rt></ruby>に<ruby>行<rt>い</rt></ruby>ってきました。', tc: '上週我跟朋友去旅行了。非常開心。風景非常棒喔。去了京都。' },
      { speaker: '自分', jp: 'いいですね。私も<ruby>近<rt>ちか</rt></ruby>いうちに<ruby>旅行<rt>りょこう</rt></ruby>したいです。<ruby>次<rt>つぎ</rt></ruby>は<ruby>一緒<rt>いっしょ</rt></ruby>に<ruby>行<rt>い</rt></ruby>きましょう。いつがいいですか。', tc: '真好啊。我也想最近去旅行。下次一起去吧。什麼時候好？' },
      { speaker: 'B', jp: '<ruby>来月<rt>らいげつ</rt></ruby>の<ruby>連休<rt>れんきゅう</rt></ruby>はどうですか。', tc: '下個月的連假怎麼樣？' },
      { speaker: '自分', jp: 'いいですね。じゃあ、また<ruby>連絡<rt>れんらく</rt></ruby>します。<ruby>今日<rt>きょう</rt></ruby>は<ruby>楽<rt>たの</rt></ruby>しかったです。', tc: '好啊。那就再聯絡。今天很開心。' },
      { speaker: 'B', jp: 'こちらこそ。また<ruby>会<rt>あ</rt></ruby>いましょう。', tc: '我才是。下次再見。' }
    ]
  },
  {
    title: 'シナリオ6：道を聞く会話',
    lines: [
      { speaker: '自分', jp: 'すみません。<ruby>駅<rt>えき</rt></ruby>までどうやって<ruby>行<rt>い</rt></ruby>けばいいですか。<ruby>歩<rt>ある</rt></ruby>いてどのくらいですか。', tc: '不好意思。到車站怎麼走比較好？走路大概要多久？' },
      { speaker: '通行人', jp: '<ruby>駅<rt>えき</rt></ruby>ですか。この<ruby>道<rt>みち</rt></ruby>をまっすぐ<ruby>進<rt>すす</rt></ruby>んで、<ruby>二<rt>ふた</rt></ruby>つ<ruby>目<rt>め</rt></ruby>の<ruby>信号<rt>しんごう</rt></ruby>を<ruby>右<rt>みぎ</rt></ruby>に<ruby>曲<rt>ま</rt></ruby>がります。それから<ruby>歩<rt>ある</rt></ruby>いて<ruby>五分<rt>ごふん</rt></ruby>くらいです。', tc: '到車站嗎。沿著這條路直走，在第二個紅綠燈右轉。然後再走大概五分鐘。' },
      { speaker: '自分', jp: '<ruby>二<rt>ふた</rt></ruby>つ<ruby>目<rt>め</rt></ruby>の<ruby>信号<rt>しんごう</rt></ruby>ですね。わかりました。コンビニやカフェはありますか。<ruby>バス停<rt>てい</rt></ruby>は<ruby>近<rt>ちか</rt></ruby>いですか。', tc: '第二個紅綠燈對吧。我知道了。附近有便利商店或咖啡廳嗎？公車站近嗎？' },
      { speaker: '通行人', jp: 'はい、<ruby>信号<rt>しんごう</rt></ruby>を<ruby>曲<rt>ま</rt></ruby>がったすぐのところにコンビニがあります。<ruby>バス停<rt>てい</rt></ruby>もすぐそこです。もし<ruby>迷<rt>まよ</rt></ruby>ったら、また<ruby>聞<rt>き</rt></ruby>いてください。タクシーを<ruby>使<rt>つか</rt></ruby>う<ruby>手<rt>て</rt></ruby>もありますよ。', tc: '有的，轉過紅綠燈馬上就有便利商店。公車站也在附近。如果迷路了再問別人吧。也可以搭計程車。' },
      { speaker: '自分', jp: 'ありがとうございます。<ruby>助<rt>たす</rt></ruby>かります。<ruby>夜<rt>よる</rt></ruby>は<ruby>安全<rt>あんぜん</rt></ruby>ですか。<ruby>終電<rt>しゅうでん</rt></ruby>は<ruby>何時<rt>なんじ</rt></ruby>ですか。', tc: '謝謝你。幫了大忙。晚上安全嗎？末班車是幾點？' },
      { speaker: '通行人', jp: 'はい、<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。<ruby>終電<rt>しゅうでん</rt></ruby>は<ruby>十二時<rt>じゅうにじ</rt></ruby><ruby>頃<rt>ごろ</rt></ruby>です。<ruby>気<rt>き</rt></ruby>をつけて<ruby>行<rt>い</rt></ruby>ってください。', tc: '沒問題的。末班車大概十二點。路上小心。' },
      { speaker: '自分', jp: 'ありがとうございます。<ruby>信号<rt>しんごう</rt></ruby>の<ruby>色<rt>いろ</rt></ruby>は<ruby>何<rt>なに</rt></ruby>ですか。', tc: '謝謝。紅綠燈的顏色是什麼？' },
      { speaker: '通行人', jp: '<ruby>青<rt>あお</rt></ruby>で<ruby>渡<rt>わた</rt></ruby>ってください。', tc: '請在綠燈時過馬路。' },
      { speaker: '自分', jp: 'わかりました。<ruby>本当<rt>ほんとう</rt></ruby>に<ruby>助<rt>たす</rt></ruby>かりました。ありがとうございました。', tc: '我知道了。真的幫了大忙。謝謝你。' },
      { speaker: '通行人', jp: 'いえいえ。いってらっしゃい。', tc: '不客氣。路上小心。' }
    ]
  },
  {
    title: 'シナリオ7：医師の診察を受ける会話',
    lines: [
      { speaker: '医師', jp: 'こんにちは。<ruby>今日<rt>きょう</rt></ruby>はどうされましたか。いつから<ruby>症状<rt>しょうじょう</rt></ruby>がありますか。', tc: '你好。今天是哪裡不舒服呢？從什麼時候開始有症狀的？' },
      { speaker: '自分', jp: '<ruby>頭<rt>あたま</rt></ruby>が<ruby>痛<rt>いた</rt></ruby>くて、<ruby>熱<rt>ねつ</rt></ruby>もあります。<ruby>昨日<rt>きのう</rt></ruby>からずっと<ruby>続<rt>つづ</rt></ruby>いています。<ruby>咳<rt>せき</rt></ruby>も<ruby>出<rt>で</rt></ruby>ます。<ruby>食欲<rt>しょくよく</rt></ruby>もありません。', tc: '頭痛，還有發燒。從昨天開始一直持續到現在。還有咳嗽。也沒有食慾。' },
      { speaker: '医師', jp: 'そうですか。では、<ruby>体温<rt>たいおん</rt></ruby>を<ruby>測<rt>はか</rt></ruby>りますね。<ruby>口<rt>くち</rt></ruby>を<ruby>開<rt>あ</rt></ruby>けてください。<ruby>喉<rt>のど</rt></ruby>も<ruby>見<rt>み</rt></ruby>ます。<ruby>血圧<rt>けつあつ</rt></ruby>も<ruby>測<rt>はか</rt></ruby>りましょう。', tc: '這樣啊。那我來量一下體溫。請張開嘴巴。喉嚨也看一下。血壓也量一下吧。' },
      { speaker: '自分', jp: 'はい。', tc: '好的。' },
      { speaker: '医師', jp: '<ruby>熱<rt>ねつ</rt></ruby>は<ruby>三十八度<rt>さんじゅうはちど</rt></ruby>です。<ruby>風邪<rt>かぜ</rt></ruby>の<ruby>可能性<rt>かのうせい</rt></ruby>が<ruby>高<rt>たか</rt></ruby>いです。<ruby>薬<rt>くすり</rt></ruby>を<ruby>出<rt>だ</rt></ruby>しますので、<ruby>食後<rt>しょくご</rt></ruby>に<ruby>飲<rt>の</rt></ruby>んでください。<ruby>休息<rt>きゅうそく</rt></ruby>も<ruby>取<rt>と</rt></ruby>ってください。', tc: '體溫是三十八度。很可能是感冒。我會開藥，請在飯後服用。也請休息。' },
      { speaker: '自分', jp: 'わかりました。どのくらいで<ruby>治<rt>なお</rt></ruby>りますか。<ruby>仕事<rt>しごと</rt></ruby>は<ruby>休<rt>やす</rt></ruby>んだほうがいいですか。<ruby>水分<rt>すいぶん</rt></ruby>はたくさん<ruby>取<rt>と</rt></ruby>ったほうがいいですか。', tc: '我知道了。大概多久會好呢？工作要休息比較好嗎？水分要多補充比較好嗎？' },
      { speaker: '医師', jp: '<ruby>二<rt>に</rt></ruby>、<ruby>三日<rt>さんにち</rt></ruby>でよくなると<ruby>思<rt>おも</rt></ruby>いますが、<ruby>無理<rt>むり</rt></ruby>をしないでください。<ruby>明日<rt>あした</rt></ruby>も<ruby>熱<rt>ねつ</rt></ruby>が<ruby>続<rt>つづ</rt></ruby>いたら、また<ruby>来<rt>き</rt></ruby>てください。<ruby>水分<rt>すいぶん</rt></ruby>はしっかり<ruby>取<rt>と</rt></ruby>ってください。', tc: '我想兩、三天就會好轉，但請不要勉強自己。如果明天還在發燒，請再來。水分要好好補充。' },
      { speaker: '自分', jp: 'はい、わかりました。お<ruby>薬<rt>くすり</rt></ruby>は<ruby>何日分<rt>なんにちぶん</rt></ruby>ですか。', tc: '好的，我知道了。藥是幾天份的？' },
      { speaker: '医師', jp: '<ruby>三日分<rt>みっかぶん</rt></ruby>です。お<ruby>大事<rt>だいじ</rt></ruby>に。', tc: '三天份。請多保重。' },
      { speaker: '自分', jp: 'ありがとうございました。', tc: '謝謝你。' }
    ]
  },
  {
    title: 'シナリオ8：電話でサービス予約する会話',
    lines: [
      { speaker: '店員', jp: 'はい、<ruby>美容院<rt>びよういん</rt></ruby>のさくらです。', tc: '您好，這裡是美容院櫻花。' },
      { speaker: '自分', jp: 'すみません。カットの<ruby>予約<rt>よやく</rt></ruby>をしたいのですが。カラーもできますか。パーマも<ruby>相談<rt>そうだん</rt></ruby>できますか。', tc: '不好意思。我想預約剪髮。染髮也可以嗎？燙髮也可以商量嗎？' },
      { speaker: '店員', jp: 'はい、かしこまりました。ご<ruby>希望<rt>きぼう</rt></ruby>の<ruby>日時<rt>にちじ</rt></ruby>はいつですか。カラーも<ruby>可能<rt>かのう</rt></ruby>ですよ。パーマもできます。', tc: '好的。請問您希望的日期和時間是什麼時候呢？染髮也可以的。燙髮也可以。' },
      { speaker: '自分', jp: '<ruby>明日<rt>あした</rt></ruby>の<ruby>午後<rt>ごご</rt></ruby><ruby>三時<rt>さんじ</rt></ruby><ruby>頃<rt>ごろ</rt></ruby>は<ruby>空<rt>あ</rt></ruby>いていますか。カットとカラーでお<ruby>願<rt>ねが</rt></ruby>いします。', tc: '明天下午三點左右有空嗎？請給我剪髮和染髮。' },
      { speaker: '店員', jp: '<ruby>少々<rt>しょうしょう</rt></ruby>お<ruby>待<rt>ま</rt></ruby>ちください。はい、<ruby>三時<rt>さんじ</rt></ruby>は<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。お<ruby>名前<rt>なまえ</rt></ruby>を<ruby>教<rt>おし</rt></ruby>えてください。<ruby>所要時間<rt>しょようじかん</rt></ruby>は<ruby>二時間<rt>にじかん</rt></ruby>くらいです。<ruby>担当<rt>たんとう</rt></ruby>のスタイリストは<ruby>希望<rt>きぼう</rt></ruby>ありますか。', tc: '請稍等一下。是的，三點沒問題。請告訴我您的名字。大約需要兩小時。有指定的設計師嗎？' },
      { speaker: '自分', jp: '<ruby>田中<rt>たなか</rt></ruby>です。<ruby>特<rt>とく</rt></ruby>に<ruby>希望<rt>きぼう</rt></ruby>はありません。わかりました。', tc: '我是田中。沒有特別指定。我知道了。' },
      { speaker: '店員', jp: '<ruby>田中様<rt>たなかさま</rt></ruby>、<ruby>明日<rt>あした</rt></ruby><ruby>三時<rt>さんじ</rt></ruby>でご<ruby>予約<rt>よやく</rt></ruby>を<ruby>承<rt>うけたまわ</rt></ruby>りました。お<ruby>待<rt>ま</rt></ruby>ちしております。', tc: '田中先生，已為您預約明天三點。我們恭候您的光臨。' },
      { speaker: '自分', jp: 'ありがとうございます。キャンセルは<ruby>何日前<rt>なんにちまえ</rt></ruby>まで<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>ですか。', tc: '謝謝。取消預約到幾天前都可以？' },
      { speaker: '店員', jp: '<ruby>前日<rt>ぜんじつ</rt></ruby>まで<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。', tc: '前一天都可以。' },
      { speaker: '自分', jp: 'わかりました。ありがとうございました。', tc: '我知道了。謝謝。' }
    ]
  },
  {
    title: 'シナリオ9：下屬が上司に報告する会話',
    lines: [
      { speaker: '自分', jp: 'お<ruby>忙<rt>いそが</rt></ruby>しいところすみません。<ruby>昨日<rt>きのう</rt></ruby>の<ruby>会議<rt>かいぎ</rt></ruby>の<ruby>内容<rt>ないよう</rt></ruby>について<ruby>報告<rt>ほうこく</rt></ruby>します。<ruby>資料<rt>しりょう</rt></ruby>も<ruby>持<rt>も</rt></ruby>ってきました。', tc: '不好意思打擾您。我來報告昨天會議的內容。資料也帶來了。' },
      { speaker: '上司', jp: 'はい、どうぞ。', tc: '好的，請說。' },
      { speaker: '自分', jp: '<ruby>新<rt>あたら</rt></ruby>しいプロジェクトの<ruby>予算<rt>よさん</rt></ruby>が<ruby>承認<rt>しょうにん</rt></ruby>されました。<ruby>来週<rt>らいしゅう</rt></ruby>から<ruby>作業<rt>さぎょう</rt></ruby>を<ruby>始<rt>はじ</rt></ruby>めます。スケジュールも<ruby>作<rt>つく</rt></ruby>りました。', tc: '新專案的預算已經獲得核准。從下週開始進行作業。行程表也做好了。' },
      { speaker: '上司', jp: 'わかりました。<ruby>問題<rt>もんだい</rt></ruby>はありそうですか。リスクは<ruby>何<rt>なに</rt></ruby>ですか。', tc: '我知道了。看起來有什麼問題嗎？風險是什麼？' },
      { speaker: '自分', jp: '<ruby>今<rt>いま</rt></ruby>のところ<ruby>特<rt>とく</rt></ruby>にありませんが、<ruby>人員<rt>じんいん</rt></ruby>が<ruby>少<rt>すく</rt></ruby>ないので、<ruby>追加<rt>ついか</rt></ruby>を<ruby>検討<rt>けんとう</rt></ruby>したいです。<ruby>外注<rt>がいちゅう</rt></ruby>も<ruby>考<rt>かんが</rt></ruby>えています。', tc: '目前特別沒有，但人員比較少，所以想討論一下是否要追加。也在考慮外包。' },
      { speaker: '上司', jp: 'そうですね。それでは、<ruby>計画書<rt>けいかくしょ</rt></ruby>を<ruby>作<rt>つく</rt></ruby>って<ruby>提出<rt>ていしゅつ</rt></ruby>してください。<ruby>来週<rt>らいしゅう</rt></ruby>までに<ruby>提出<rt>ていしゅつ</rt></ruby>できますか。<ruby>他<rt>ほか</rt></ruby>に<ruby>確認<rt>かくにん</rt></ruby>したいことはありますか。', tc: '這樣啊。那就請你製作計劃書並提交。下週前可以提交嗎？還有其他想確認的事情嗎？' },
      { speaker: '自分', jp: 'はい、すぐに<ruby>準備<rt>じゅんび</rt></ruby>します。<ruby>金曜日<rt>きんようび</rt></ruby>までに<ruby>提出<rt>ていしゅつ</rt></ruby>します。<ruby>進捗<rt>しんちょく</rt></ruby>は<ruby>毎週<rt>まいしゅう</rt></ruby><ruby>報告<rt>ほうこく</rt></ruby>します。', tc: '好的，我馬上準備。星期五前會提交。進度每週會報告。' },
      { speaker: '上司', jp: 'わかりました。よろしくお<ruby>願<rt>ねが</rt></ruby>いします。', tc: '我知道了。請多關照。' },
      { speaker: '自分', jp: 'はい、<ruby>失礼<rt>しつれい</rt></ruby>します。', tc: '好的，我先告辭了。' }
    ]
  }
,
  {  title: 'シナリオ10：就職面接の会話',
    lines: [
      { speaker: '面接官', jp: '<ruby>本日<rt>ほんじつ</rt></ruby>は<ruby>遠<rt>とお</rt></ruby>いところからお<ruby>越<rt>こ</rt></ruby>しいただき、ありがとうございます。まず<ruby>自己紹介<rt>じこしょうかい</rt></ruby>をお<ruby>願<rt>ねが</rt></ruby>いします。', tc: '今天非常感謝您從遠方過來。首先請做自我介紹。' },
      { speaker: '自分', jp: 'はい。<ruby>田中<rt>たなか</rt></ruby>と<ruby>申<rt>もう</rt></ruby>します。<ruby>大学<rt>だいがく</rt></ruby>では<ruby>経済<rt>けいざい</rt></ruby><ruby>学<rt>がく</rt></ruby>を<ruby>専攻<rt>せんこう</rt></ruby>し、<ruby>卒業<rt>そつぎょう</rt></ruby><ruby>後<rt>ご</rt></ruby>は<ruby>営業<rt>えいぎょう</rt></ruby><ruby>部門<rt>ぶもん</rt></ruby>で<ruby>三年<rt>さんねん</rt></ruby><ruby>働<rt>はたら</rt></ruby>いておりました。<ruby>御社<rt>おんしゃ</rt></ruby>の<ruby>商品<rt>しょうひん</rt></ruby>に<ruby>以前<rt>いぜん</rt></ruby>から<ruby>興味<rt>きょうみ</rt></ruby>があり、<ruby>今回<rt>こんかい</rt></ruby><ruby>応募<rt>おうぼ</rt></ruby>いたしました。', tc: '好的。我叫田中。大學主修經濟學，畢業後在業務部門工作了三年。我以前就對貴公司的商品有興趣，所以這次投了履歷。' },
      { speaker: '面接官', jp: 'わかりました。<ruby>前職<rt>ぜんしょく</rt></ruby>では<ruby>主<rt>おも</rt></ruby>にどのような<ruby>仕事<rt>しごと</rt></ruby>を<ruby>担当<rt>たんとう</rt></ruby>していましたか。', tc: '我了解了。在前職主要負責什麼樣的工作呢？' },
      { speaker: '自分', jp: '<ruby>新規<rt>しんき</rt></ruby><ruby>顧客<rt>こきゃく</rt></ruby>の<ruby>開拓<rt>かいたく</rt></ruby>と<ruby>既存<rt>きそん</rt></ruby><ruby>顧客<rt>こきゃく</rt></ruby>のフォローが<ruby>中心<rt>ちゅうしん</rt></ruby>でした。<ruby>数字<rt>すうじ</rt></ruby>を<ruby>分析<rt>ぶんせき</rt></ruby>して<ruby>提案<rt>ていあん</rt></ruby>を<ruby>作<rt>つく</rt></ruby>り、チームと<ruby>協力<rt>きょうりょく</rt></ruby>して<ruby>目標<rt>もくひょう</rt></ruby>を<ruby>達成<rt>たっせい</rt></ruby>していました。', tc: '主要是開發新客戶和跟進既有客戶。分析數據後製作提案，並和團隊合作達成目標。' },
      { speaker: '面接官', jp: '<ruby>具体的<rt>ぐたいてき</rt></ruby>な<ruby>成果<rt>せいか</rt></ruby>を<ruby>教<rt>おし</rt></ruby>えてください。<ruby>難<rt>むずか</rt></ruby>しかったことは<ruby>何<rt>なに</rt></ruby>ですか。', tc: '請告訴我具體的成果。困難的事情是什麼？' },
      { speaker: '自分', jp: '<ruby>一年目<rt>いちねんめ</rt></ruby>に<ruby>新規<rt>しんき</rt></ruby><ruby>顧客<rt>こきゃく</rt></ruby>を<ruby>十社<rt>じゅっしゃ</rt></ruby><ruby>獲得<rt>かくとく</rt></ruby>し、<ruby>売<rt>う</rt></ruby>り<ruby>上<rt>あ</rt></ruby>げを<ruby>二十<rt>にじゅう</rt></ruby>パーセント<ruby>上<rt>あ</rt></ruby>げることができました。<ruby>特<rt>とく</rt></ruby>に<ruby>難<rt>むずか</rt></ruby>しい<ruby>顧客<rt>こきゃく</rt></ruby>との<ruby>関係<rt>かんけい</rt></ruby>を<ruby>築<rt>きず</rt></ruby>いたことが<ruby>印象<rt>いんしょう</rt></ruby>に<ruby>残<rt>のこ</rt></ruby>っています。', tc: '第一年獲得了十家新客戶，並將營業額提升了百分之二十。特別是和困難客戶建立關係的經驗，讓我印象深刻。' },
      { speaker: '面接官', jp: 'それは<ruby>素晴<rt>すば</rt></ruby>らしいですね。<ruby>入社<rt>にゅうしゃ</rt></ruby><ruby>後<rt>ご</rt></ruby>はどの<ruby>部署<rt>ぶしょ</rt></ruby>で<ruby>働<rt>はたら</rt></ruby>きたいですか。', tc: '那很棒呢。入社後希望在哪個部門工作呢？' },
      { speaker: '自分', jp: 'マーケティング<ruby>部<rt>ぶ</rt></ruby>で<ruby>働<rt>はたら</rt></ruby>きたいと<ruby>考<rt>かんが</rt></ruby>えております。<ruby>営業<rt>えいぎょう</rt></ruby>で<ruby>培<rt>つちか</rt></ruby>った<ruby>顧客<rt>こきゃく</rt></ruby>の<ruby>声<rt>こえ</rt></ruby>を<ruby>活<rt>い</rt></ruby>かして、<ruby>商品<rt>しょうひん</rt></ruby>の<ruby>魅力<rt>みりょく</rt></ruby>を<ruby>広<rt>ひろ</rt></ruby>げたいからです。', tc: '我想在行銷部門工作。因為我想活用在業務中累積的客戶聲音，來推廣商品的魅力。' },
      { speaker: '面接官', jp: 'わかりました。<ruby>最後<rt>さいご</rt></ruby>に、<ruby>何<rt>なに</rt></ruby>か<ruby>質問<rt>しつもん</rt></ruby>はありますか。', tc: '我了解了。最後有什麼問題嗎？' },
      { speaker: '自分', jp: 'はい。<ruby>御社<rt>おんしゃ</rt></ruby>の<ruby>研修<rt>けんしゅう</rt></ruby><ruby>制度<rt>せいど</rt></ruby>について<ruby>少<rt>すこ</rt></ruby>し<ruby>教<rt>おし</rt></ruby>えていただけますか。', tc: '有的。可以稍微告訴我貴公司的研修制度嗎？' },
      { speaker: '面接官', jp: 'もちろんです。<ruby>入社<rt>にゅうしゃ</rt></ruby><ruby>後<rt>ご</rt></ruby>に<ruby>三ヶ月<rt>さんかげつ</rt></ruby>の<ruby>研修<rt>けんしゅう</rt></ruby>があります。<ruby>本日<rt>ほんじつ</rt></ruby>はありがとうございました。', tc: '當然可以。入社後有三個月的研修。今天謝謝您。' }
    ]
  },
  {
    title: 'シナリオ11：映画について話すグループチャット',
    lines: [
      { speaker: '自分', jp: 'みんな、<ruby>昨日<rt>きのう</rt></ruby><ruby>見<rt>み</rt></ruby>た<ruby>映画<rt>えいが</rt></ruby>、どう<ruby>思<rt>おも</rt></ruby>いましたか。<ruby>主人公<rt>しゅじんこう</rt></ruby>の<ruby>決断<rt>けつだん</rt></ruby>がすごく<ruby>印象的<rt>いんしょうてき</rt></ruby>だったよね。', tc: '大家昨天看的那部電影，覺得怎麼樣？主角的決定真的很令人印象深刻對吧。' },
      { speaker: '佐藤', jp: 'うん、<ruby>特<rt>とく</rt></ruby>に<ruby>最後<rt>さいご</rt></ruby>のシーンで<ruby>友達<rt>ともだち</rt></ruby>を<ruby>助<rt>たす</rt></ruby>ける<ruby>選択<rt>せんたく</rt></ruby>をしたところ、<ruby>心<rt>こころ</rt></ruby>を<ruby>動<rt>うご</rt></ruby>かされました。', tc: '對啊，特別是最後一幕選擇幫助朋友的地方，真的打動了我。' },
      { speaker: '鈴木', jp: 'でも、<ruby>友達<rt>ともだち</rt></ruby><ruby>役<rt>やく</rt></ruby>の<ruby>人<rt>ひと</rt></ruby>がもっと<ruby>話<rt>はな</rt></ruby>してほしかったです。<ruby>感情<rt>かんじょう</rt></ruby>の<ruby>表現<rt>ひょうげん</rt></ruby>が<ruby>少<rt>すく</rt></ruby>なかったような<ruby>気<rt>き</rt></ruby>がします。', tc: '可是我希望朋友角色的人可以多講一點話。感覺感情的表現有點少。' },
      { speaker: '高橋', jp: '<ruby>私<rt>わたし</rt></ruby>は<ruby>悪役<rt>あくやく</rt></ruby>の<ruby>動機<rt>どうき</rt></ruby>が<ruby>複雑<rt>ふくざつ</rt></ruby>で<ruby>好<rt>す</rt></ruby>きでした。ただの<ruby>悪<rt>わる</rt></ruby>い<ruby>人<rt>ひと</rt></ruby>じゃなくて、<ruby>過去<rt>かこ</rt></ruby>の<ruby>経験<rt>けいけん</rt></ruby>から<ruby>行動<rt>こうどう</rt></ruby>しているのが<ruby>面白<rt>おもしろ</rt></ruby>かったです。', tc: '我喜歡反派的動機很複雜。不是單純的壞人，而是從過去的經驗來行動，覺得很有趣。' },
      { speaker: '伊藤', jp: '<ruby>全体的<rt>ぜんたいてき</rt></ruby>にストーリーが<ruby>楽<rt>たの</rt></ruby>しかったです。でも<ruby>途中<rt>とちゅう</rt></ruby>でちょっと<ruby>長<rt>なが</rt></ruby>く<ruby>感<rt>かん</rt></ruby>じた<ruby>部分<rt>ぶぶん</rt></ruby>もありました。<ruby>続編<rt>ぞくへん</rt></ruby>があるといいですね。', tc: '整體來說故事很有趣。不過中途有些部分覺得有點長。如果有續集就好了。' },
      { speaker: '自分', jp: 'そうですね。キャラクターの<ruby>成長<rt>せいちょう</rt></ruby>がよく<ruby>描<rt>えが</rt></ruby>かれていました。<ruby>主人公<rt>しゅじんこう</rt></ruby>が<ruby>最初<rt>さいしょ</rt></ruby>は<ruby>弱<rt>よわ</rt></ruby>かったのに、だんだん<ruby>強<rt>つよ</rt></ruby>くなっていくのがよかったです。', tc: '是啊。角色的成長描寫得很好。主角一開始很弱，但漸漸變強的過程很棒。' },
      { speaker: '佐藤', jp: '<ruby>私<rt>わたし</rt></ruby>は<ruby>音楽<rt>おんがく</rt></ruby>も<ruby>良<rt>よ</rt></ruby>かったと<ruby>思<rt>おも</rt></ruby>います。<ruby>感情<rt>かんじょう</rt></ruby>の<ruby>場面<rt>ばめん</rt></ruby>で<ruby>使<rt>つか</rt></ruby>われている<ruby>曲<rt>きょく</rt></ruby>が<ruby>特<rt>とく</rt></ruby>に<ruby>印象<rt>いんしょう</rt></ruby>に<ruby>残<rt>のこ</rt></ruby>っています。', tc: '我也覺得音樂很好。在感情場面使用的曲子特別令人印象深刻。' },
      { speaker: '鈴木', jp: '<ruby>次<rt>つぎ</rt></ruby>はみんなで<ruby>一緒<rt>いっしょ</rt></ruby>に<ruby>見<rt>み</rt></ruby>ましょう。<ruby>別<rt>べつ</rt></ruby>の<ruby>映画<rt>えいが</rt></ruby>もおすすめですよ。', tc: '下次大家一起去看吧。我還有其他推薦的電影。' },
      { speaker: '高橋', jp: 'いいですね。<ruby>来週<rt>らいしゅう</rt></ruby>の<ruby>週末<rt>しゅうまつ</rt></ruby>はどうですか。', tc: '好啊。下週末怎麼樣？' },
      { speaker: '伊藤', jp: '<ruby>私<rt>わたし</rt></ruby>は<ruby>大丈夫<rt>だいじょうぶ</rt></ruby>です。<ruby>場所<rt>ばしょ</rt></ruby>を<ruby>決<rt>き</rt></ruby>めましょう。', tc: '我沒問題。那我們來決定地點吧。' },
      { speaker: '自分', jp: '<ruby>映画館<rt>えいがかん</rt></ruby>がいいです。<ruby>大画面<rt>だいがめん</rt></ruby>で<ruby>見<rt>み</rt></ruby>たいです。', tc: '電影院比較好。我想在大螢幕上看。' }
    ]
  },
  {
    title: 'シナリオ12：カップルがUSJに行く計画を立てる会話',
    lines: [
      { speaker: '自分', jp: '<ruby>来月<rt>らいげつ</rt></ruby>の<ruby>連休<rt>れんきゅう</rt></ruby>にUSJに<ruby>行<rt>い</rt></ruby>きたいんだけど、どう<ruby>思<rt>おも</rt></ruby>いますか。', tc: '下個月連休想去USJ，你覺得怎麼樣？' },
      { speaker: '彼氏', jp: 'いいですね。ずっと<ruby>行<rt>い</rt></ruby>きたかったです。<ruby>何日<rt>なんにち</rt></ruby>くらい<ruby>滞在<rt>たいざい</rt></ruby>しますか。', tc: '好啊。我一直想去。打算待幾天呢？' },
      { speaker: '自分', jp: '<ruby>二泊三日<rt>にはくみっか</rt></ruby>くらいがいいと<ruby>思<rt>おも</rt></ruby>います。ホテルも<ruby>近<rt>ちか</rt></ruby>くに<ruby>取<rt>と</rt></ruby>りたいです。', tc: '我覺得兩晚三天左右比較好。也想在附近訂飯店。' },
      { speaker: '彼氏', jp: 'そうですね。USJのオフィシャルホテルが<ruby>便利<rt>べんり</rt></ruby>ですよ。<ruby>早<rt>はや</rt></ruby>めに<ruby>予約<rt>よやく</rt></ruby>したほうがいいです。<ruby>混<rt>こ</rt></ruby>みますから。', tc: '對啊。USJ的官方飯店很方便。最好早點預約。因為會很擠。' },
      { speaker: '自分', jp: 'わかりました。チケットも<ruby>今<rt>いま</rt></ruby>のうちに<ruby>買<rt>か</rt></ruby>っておいたほうがいいですよね。エクスプレスパスも<ruby>必要<rt>ひつよう</rt></ruby>ですか。', tc: '知道了。票也最好現在就先買吧。需要快速通關嗎？' },
      { speaker: '彼氏', jp: '<ruby>必要<rt>ひつよう</rt></ruby>だと<ruby>思<rt>おも</rt></ruby>います。<ruby>人気<rt>にんき</rt></ruby>のアトラクションは<ruby>並<rt>なら</rt></ruby>ぶ<ruby>時間<rt>じかん</rt></ruby>が<ruby>長<rt>なが</rt></ruby>いです。マリオエリアも<ruby>見<rt>み</rt></ruby>たいです。', tc: '我覺得需要。受歡迎的設施排隊時間很長。也想看瑪利歐區。' },
      { speaker: '自分', jp: 'うん、<ruby>絶対<rt>ぜったい</rt></ruby><ruby>見<rt>み</rt></ruby>たいです。あと、<ruby>夜<rt>よる</rt></ruby>のパレードも<ruby>見<rt>み</rt></ruby>たいです。<ruby>食事<rt>しょくじ</rt></ruby>はパーク<ruby>内<rt>ない</rt></ruby>でしますか。それとも<ruby>外<rt>そと</rt></ruby>でしますか。', tc: '嗯，一定要看。還有晚上的遊行也想看。用餐是在園區內吃，還是外面？' },
      { speaker: '彼氏', jp: 'パーク<ruby>内<rt>ない</rt></ruby>で<ruby>軽<rt>かる</rt></ruby>く<ruby>食<rt>た</rt></ruby>べて、<ruby>夜<rt>よる</rt></ruby>はホテルの<ruby>近<rt>ちか</rt></ruby>くでゆっくり<ruby>ご飯<rt>はん</rt></ruby>を<ruby>食<rt>た</rt></ruby>べましょう。', tc: '園區內簡單吃一點，晚上在飯店附近慢慢吃吧。' },
      { speaker: '自分', jp: 'いいですね。じゃあ、<ruby>今週末<rt>こんしゅうまつ</rt></ruby>にチケットとホテルを<ruby>一緒<rt>いっしょ</rt></ruby>に<ruby>予約<rt>よやく</rt></ruby>しましょう。', tc: '好啊。那這週末一起預約票和飯店吧。' },
      { speaker: '彼氏', jp: 'わかりました。<ruby>楽<rt>たの</rt></ruby>しみです。', tc: '了解。很期待呢。' }
    ]
  },
  {
    title: 'シナリオ13：天気予報を確認して計画を立てる会話',
    lines: [
      { speaker: '自分', jp: '<ruby>明日<rt>あした</rt></ruby>の<ruby>天気<rt>てんき</rt></ruby><ruby>予報<rt>よほう</rt></ruby>を<ruby>見<rt>み</rt></ruby>ましたか。', tc: '你看明天的天氣預報了嗎？' },
      { speaker: '友達B', jp: 'はい、<ruby>見<rt>み</rt></ruby>ました。<ruby>午前<rt>ごぜん</rt></ruby>は<ruby>晴<rt>は</rt></ruby>れますが、<ruby>午後<rt>ごご</rt></ruby>から<ruby>雨<rt>あめ</rt></ruby>が<ruby>降<rt>ふ</rt></ruby>るそうです。', tc: '看了。上午會晴天，下午開始會下雨。' },
      { speaker: '自分', jp: 'そうですか。<ruby>気温<rt>きおん</rt></ruby>はどのくらいですか。', tc: '這樣啊。氣溫大概多少度？' },
      { speaker: '友達B', jp: '<ruby>最高気温<rt>さいこうきおん</rt></ruby>は<ruby>二十三度<rt>にじゅうさんど</rt></ruby>くらいで、<ruby>涼<rt>すず</rt></ruby>しいですよ。', tc: '最高氣溫大概二十三度左右，很涼爽喔。' },
      { speaker: '自分', jp: 'じゃあ、<ruby>午前中<rt>ごぜんちゅう</rt></ruby>に<ruby>外<rt>そと</rt></ruby>で<ruby>散歩<rt>さんぽ</rt></ruby>をして、<ruby>午後<rt>ごご</rt></ruby>は<ruby>室内<rt>しつない</rt></ruby>で<ruby>映画<rt>えいが</rt></ruby>を<ruby>見<rt>み</rt></ruby>ましょう。', tc: '那上午在外面散步，下午在室內看電影吧。' },
      { speaker: '友達B', jp: 'いいですね。<ruby>傘<rt>かさ</rt></ruby>を<ruby>持<rt>も</rt></ruby>って<ruby>行<rt>い</rt></ruby>ったほうがいいですよ。<ruby>急<rt>きゅう</rt></ruby>に<ruby>雨<rt>あめ</rt></ruby>が<ruby>強<rt>つよ</rt></ruby>くなるかもしれません。', tc: '好啊。最好帶傘去。可能會突然下大雨。' },
      { speaker: '自分', jp: 'わかりました。<ruby>天気予報<rt>てんきよほう</rt></ruby>は<ruby>正確<rt>せいかく</rt></ruby>ですか。', tc: '知道了。天氣預報準確嗎？' },
      { speaker: '友達B', jp: '<ruby>最近<rt>さいきん</rt></ruby>はわりと<ruby>正確<rt>せいかく</rt></ruby>ですよ。でも、<ruby>念<rt>ねん</rt></ruby>のため<ruby>傘<rt>かさ</rt></ruby>を<ruby>用意<rt>ようい</rt></ruby>しておきます。', tc: '最近還算準確。不過為了保險起見，還是準備傘比較好。' },
      { speaker: '自分', jp: 'そうしましょう。では、<ruby>明日<rt>あした</rt></ruby>の<ruby>十時<rt>じゅうじ</rt></ruby>に<ruby>駅<rt>えき</rt></ruby>で<ruby>会<rt>あ</rt></ruby>いましょう。', tc: '那就這樣吧。明天十點在車站見吧。' },
      { speaker: '友達B', jp: 'はい、<ruby>了解<rt>りょうかい</rt></ruby>です。<ruby>楽<rt>たの</rt></ruby>しみにしています。', tc: '好的，了解。很期待。' }
    ]
  }
];

// Start app
document.addEventListener("DOMContentLoaded", () => init());
