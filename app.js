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
  updateThemeButton();
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
  nav.innerHTML = '';
  LEVELS.forEach(lv => {
    const btn = document.createElement('button');
    btn.textContent = lv;
    btn.className = lv === currentLevel ? 'active' : '';
    btn.onclick = () => { currentLevel = lv; loadLevel(lv); switchTab('words'); };
    nav.appendChild(btn);
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


function showSettings() {
  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px;">データベース / 資料庫</div>
      <button class="action" onclick="showSummary()">学習進捗を見る</button>
      <button class="action" onclick="openCMS()">内容を管理（CMS）</button>
      <button class="action" onclick="exportContentDB()">内容DBをエクスポート</button>
      <button class="action" onclick="exportUserDB()">進捗と設定をエクスポート</button>
      <input type="file" id="importUser" accept=".db,.sqlite" style="display:none" onchange="importUserDB(this)">
      <button class="action" onclick="document.getElementById('importUser').click()">進捗をインポート</button>
      <div id="status">レベル選択時に ./data から読み込みます。</div>
    </div>
  `;
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
const PAGE_SIZE = 20;

function showWords(container, append = false) {
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
        sql += " AND (pos = '動詞' OR pos LIKE '%動詞%') AND pos != '感動詞'";
      } else {
        sql += " AND pos = ?";
        params.push(currentFilter);
      }
    }
    sql += " ORDER BY reading LIMIT " + PAGE_SIZE + " OFFSET " + currentOffset;
    const rows = contentDB.exec(sql, params);
    
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
      if (rows[0].values.length === PAGE_SIZE) {
        html += '<div id="loadMore" style="text-align:center;padding:20px;color:var(--muted);">読み込み中...</div>';
      }
    }
    container.innerHTML = html;
  } catch(e) { 
    console.error(e);
    container.innerHTML = '<p>語彙テーブルがありません</p>'; 
  }
}


// Infinite scroll
let scrollTimeout;
window.addEventListener('scroll', function() {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(function() {
    if (currentTab !== 'words') return;
    const loadMore = document.getElementById('loadMore');
    if (!loadMore || isLoading) return;
    const rect = loadMore.getBoundingClientRect();
    if (rect.top < window.innerHeight + 100) {
      loadMoreWords();
    }
  }, 100);
});

function loadMoreWords() {
  if (isLoading || !hasMore) return;
  isLoading = true;
  currentOffset += PAGE_SIZE;
  showWords(document.getElementById('content'), true);
  isLoading = false;
}

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
  } catch(e) { console.error(e); }
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
        contentDB.run("UPDATE vocab SET level=?, word=?, reading=?, pos=?, meaning_tc=?, example=?, meaning_tc_example=? WHERE id=?",
          [level, word, reading, pos, meaning_tc, example, example_tc, id]);
      } else {
        contentDB.run("INSERT INTO vocab (level, word, reading, pos, meaning_tc, example, meaning_tc_example) VALUES (?,?,?,?,?,?,?)",
          [level, word, reading, pos, meaning_tc, example, example_tc]);
      }
    } else if (cmsType === 'grammar') {
      const level = document.getElementById('f_level').value;
      const title = document.getElementById('f_title').value;
      const exp_jp = document.getElementById('f_exp_jp').value;
      const exp_tc = document.getElementById('f_exp_tc').value;
      const examples = document.getElementById('f_examples').value;
      if (id) {
        contentDB.run("UPDATE grammar SET level=?, title=?, explanation_jp=?, explanation_tc=?, examples=? WHERE id=?",
          [level, title, exp_jp, exp_tc, examples, id]);
      } else {
        contentDB.run("INSERT INTO grammar (level, title, explanation_jp, explanation_tc, examples) VALUES (?,?,?,?,?)",
          [level, title, exp_jp, exp_tc, examples]);
      }
    } else {
      const level = document.getElementById('f_level').value;
      const correct = document.getElementById('f_correct').value;
      const parts = document.getElementById('f_parts').value;
      if (id) {
        contentDB.run("UPDATE rearrange SET level=?, correct=?, parts=? WHERE id=?", [level, correct, parts, id]);
      } else {
        contentDB.run("INSERT INTO rearrange (level, correct, parts) VALUES (?,?,?)", [level, correct, parts]);
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
  let html = '<div class="card"><h3>学習進捗 / 學習進度</h3><div class="progress-summary">';
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
const conversations = [
  {
    title: 'シナリオ1：東京駅からスカイツリーまでの道を聞く会話',
    lines: [
      { speaker: '外国人', jp: 'すみません。東京駅からスカイツリーまで、どうやって行けばいいですか。', tc: '不好意思。從東京車站到晴空塔，怎麼去比較好呢？' },
      { speaker: '日本人', jp: 'はい、スカイツリーですね。電車で行くのが一番便利ですよ。山手線に乗って、上野駅で乗り換えます。それから日比谷線で押上駅まで行きます。', tc: '是晴空塔啊。坐電車最方便喔。搭山手線到上野站轉車。然後搭日比谷線到押上站。' },
      { speaker: '外国人', jp: 'ありがとうございます。どのくらい時間がかかりますか。', tc: '謝謝。大概要花多久時間？' },
      { speaker: '日本人', jp: 'だいたい三十分くらいです。駅を出たら、すぐ見えますよ。', tc: '大概三十分鐘左右。出了車站馬上就能看到。' },
      { speaker: '外国人', jp: 'わかりました。助かります。', tc: '明白了。幫了大忙。' }
    ]
  },
  {
    title: 'シナリオ2：マクドナルドで食べ物を注文する会話',
    lines: [
      { speaker: '店員', jp: 'いらっしゃいませ。ご注文はお決まりですか。', tc: '歡迎光臨。您決定要點什麼了嗎？' },
      { speaker: '客', jp: 'はい。ビッグマックセットを一つと、ポテトのMサイズをお願いします。', tc: '是的。請給我一份大麥克套餐，還有一份中薯。' },
      { speaker: '店員', jp: '飲み物は何にしますか。', tc: '飲料要什麼呢？' },
      { speaker: '客', jp: 'コーラをお願いします。', tc: '請給我可樂。' },
      { speaker: '店員', jp: '店内でお召し上がりですか、それともお持ち帰りですか。', tc: '是在店內用餐，還是外帶呢？' },
      { speaker: '客', jp: '店内でお願いします。ソースは多めにお願いできますか。', tc: '在店內用餐。醬汁可以多一點嗎？' },
      { speaker: '店員', jp: 'かしこまりました。少々お待ちください。', tc: '好的。請稍等一下。' }
    ]
  },
  {
    title: 'シナリオ3：コンビニで買い物をする会話',
    lines: [
      { speaker: '店員', jp: 'いらっしゃいませ。', tc: '歡迎光臨。' },
      { speaker: '客', jp: 'すみません。このおにぎりは今日の朝作ったものですか。', tc: '不好意思。這個飯糰是今天早上做的嗎？' },
      { speaker: '店員', jp: 'はい、朝に新しく作りました。まだ温かいですよ。', tc: '是的，早上剛做好的。還是溫熱的喔。' },
      { speaker: '客', jp: 'じゃあ、これを二つと、あとホットコーヒーを一つください。', tc: '那請給我兩個，還有一杯熱咖啡。' },
      { speaker: '店員', jp: 'かしこまりました。ポイントカードはお持ちですか。', tc: '好的。您有集點卡嗎？' },
      { speaker: '客', jp: 'はい、持っています。', tc: '有的，我有帶。' },
      { speaker: '店員', jp: 'ありがとうございました。またお越しください。', tc: '謝謝您。歡迎再次光臨。' }
    ]
  },
  {
    title: 'シナリオ4：居酒屋で夕食を食べる会話',
    lines: [
      { speaker: '店員', jp: 'いらっしゃいませ。何名様ですか。', tc: '歡迎光臨。請問幾位呢？' },
      { speaker: '客', jp: '二名です。席はありますか。', tc: '兩位。有位子嗎？' },
      { speaker: '店員', jp: 'はい、奥の席をご案内します。', tc: '有的，我帶您到裡面的位子。' },
      { speaker: '客A', jp: 'とりあえず生ビールを二つください。おすすめのメニューは何ですか。', tc: '先請給我們兩杯生啤酒。有什麼推薦的菜色嗎？' },
      { speaker: '店員', jp: '今日は新鮮な刺身がおすすめです。あと、焼き鳥も人気ですよ。', tc: '今天新鮮的生魚片很推薦。還有烤鳥也很受歡迎喔。' },
      { speaker: '客B', jp: 'じゃあ、刺身の盛り合わせと、焼き鳥を五本お願いします。', tc: '那就請給我們一份生魚片拼盤，還有五串烤鳥。' },
      { speaker: '客A', jp: '私は日本酒にします。少し辛いのが好きです。', tc: '我要喝日本酒。我喜歡稍微辛一點的。' },
      { speaker: '店員', jp: 'かしこまりました。少々お待ちください。', tc: '好的。請稍等一下。' }
    ]
  },
  {
    title: 'シナリオ5：久しぶりに会った友達との会話',
    lines: [
      { speaker: 'A', jp: '久しぶりですね。元気にしていましたか。', tc: '好久不見。你還好嗎？' },
      { speaker: 'B', jp: 'はい、おかげさまで元気にしています。Aさんはどうですか。', tc: '還好，託你的福我一直很健康。A你呢？' },
      { speaker: 'A', jp: '私も忙しいですが、元気です。仕事が大変で、なかなか連絡できなくてすみません。', tc: '我也還好，雖然很忙。工作很辛苦，一直沒聯絡真的很抱歉。' },
      { speaker: 'B', jp: '大丈夫ですよ。今日はゆっくり話しましょう。何か飲みますか。', tc: '沒關係啦。今天就好好聊聊吧。要喝點什麼嗎？' },
      { speaker: 'A', jp: 'じゃあ、ビールを一つください。最近、何か面白いことがありましたか。', tc: '那就請給我一杯啤酒。最近有什麼有趣的事嗎？' },
      { speaker: 'B', jp: '先週、友達と旅行に行きました。とても楽しかったです。', tc: '上週我跟朋友去旅行了。非常開心。' },
      { speaker: 'A', jp: 'いいですね。私も近いうちに旅行したいです。', tc: '真好啊。我也想最近去旅行。' }
    ]
  },
  {
    title: 'シナリオ6：道を聞く会話（詳細な案内）',
    lines: [
      { speaker: '外国人', jp: 'すみません。駅までどうやって行けばいいですか。', tc: '不好意思。到車站怎麼走比較好？' },
      { speaker: '通行人', jp: '駅ですか。この道をまっすぐ進んで、二つ目の信号を右に曲がります。それから歩いて五分くらいです。', tc: '到車站嗎。沿著這條路直走，在第二個紅綠燈右轉。然後再走大概五分鐘。' },
      { speaker: '外国人', jp: '二つ目の信号ですね。わかりました。コンビニはありますか。', tc: '第二個紅綠燈對吧。我知道了。附近有便利商店嗎？' },
      { speaker: '通行人', jp: 'はい、信号を曲がったすぐのところにあります。もし迷ったら、また聞いてください。', tc: '有的，轉過紅綠燈馬上就有。如果迷路了再問別人吧。' },
      { speaker: '外国人', jp: 'ありがとうございます。助かります。', tc: '謝謝你。幫了大忙。' },
      { speaker: '通行人', jp: 'いえいえ。気をつけて行ってください。', tc: '不客氣。路上小心。' }
    ]
  },
  {
    title: 'シナリオ7：医師の診察を受ける会話',
    lines: [
      { speaker: '医師', jp: 'こんにちは。今日はどうされましたか。', tc: '你好。今天是哪裡不舒服呢？' },
      { speaker: '患者', jp: '頭が痛くて、熱もあります。昨日からずっと続いています。', tc: '頭痛，還有發燒。從昨天開始一直持續到現在。' },
      { speaker: '医師', jp: 'そうですか。では、体温を測りますね。口を開けてください。', tc: '這樣啊。那我來量一下體溫。請張開嘴巴。' },
      { speaker: '患者', jp: 'はい。', tc: '好的。' },
      { speaker: '医師', jp: '熱は三十八度です。風邪の可能性が高いです。薬を出しますので、食後に飲んでください。', tc: '體溫是三十八度。很可能是感冒。我會開藥，請在飯後服用。' },
      { speaker: '患者', jp: 'わかりました。どのくらいで治りますか。', tc: '我知道了。大概多久會好呢？' },
      { speaker: '医師', jp: '二、三日でよくなると思いますが、無理をしないでください。', tc: '我想兩、三天就會好轉，但請不要勉強自己。' }
    ]
  },
  {
    title: 'シナリオ8：電話でサービス予約する会話',
    lines: [
      { speaker: '店員', jp: 'はい、美容院のさくらです。', tc: '您好，這裡是美容院櫻花。' },
      { speaker: '客', jp: 'すみません。カットの予約をしたいのですが。', tc: '不好意思。我想預約剪髮。' },
      { speaker: '店員', jp: 'はい、かしこまりました。ご希望の日時はいつですか。', tc: '好的。請問您希望的日期和時間是什麼時候呢？' },
      { speaker: '客', jp: '明日の午後三時頃は空いていますか。', tc: '明天下午三點左右有空嗎？' },
      { speaker: '店員', jp: '少々お待ちください。はい、三時は大丈夫です。お名前を教えてください。', tc: '請稍等一下。是的，三點沒問題。請告訴我您的名字。' },
      { speaker: '客', jp: '田中です。', tc: '我是田中。' },
      { speaker: '店員', jp: '田中様、明日三時でご予約を承りました。お待ちしております。', tc: '田中先生，已為您預約明天三點。我們恭候您的光臨。' }
    ]
  },
  {
    title: 'シナリオ9：下屬が上司に報告する会話',
    lines: [
      { speaker: '部下', jp: 'お忙しいところすみません。昨日の会議の内容について報告します。', tc: '不好意思打擾您。我來報告昨天會議的內容。' },
      { speaker: '上司', jp: 'はい、どうぞ。', tc: '好的，請說。' },
      { speaker: '部下', jp: '新しいプロジェクトの予算が承認されました。来週から作業を始めます。', tc: '新專案的預算已經獲得核准。從下週開始進行作業。' },
      { speaker: '上司', jp: 'わかりました。問題はありそうですか。', tc: '我知道了。看起來有什麼問題嗎？' },
      { speaker: '部下', jp: '今のところ特にありませんが、人員が少ないので、追加を検討したいです。', tc: '目前特別沒有，但人員比較少，所以想討論一下是否要追加。' },
      { speaker: '上司', jp: 'そうですね。それでは、計画書を作って提出してください。', tc: '這樣啊。那就請你製作計劃書並提交。' },
      { speaker: '部下', jp: 'はい、すぐに準備します。', tc: '好的，我馬上準備。' }
    ]
  }
];

let currentConversation = null;

function showConversations() {
  const container = document.getElementById('content');
  if (currentConversation === null) {
    // Show list
    let html = '<div style="padding:8px 16px;font-weight:600;">会話シナリオ / 會話情境</div>';
    conversations.forEach((sc, idx) => {
      html += `<div class="card" style="cursor:pointer;" onclick="openConversation(${idx})">
        <div style="font-weight:600;">${sc.title}</div>
      </div>`;
    });
    container.innerHTML = html;
  } else {
    // Show chat
    const sc = conversations[currentConversation];
    let html = `<div class="chat-scenario">
      <div class="chat-title" style="display:flex;align-items:center;gap:8px;">
        <button onclick="currentConversation=null;showConversations();" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--primary);">←</button>
        ${sc.title}
      </div>
      <div class="chat-messages">`;
    sc.lines.forEach(line => {
      const rightSpeakers = ['日本人', '店員', 'B', '通行人', '客A', '客B'];
      const isRight = rightSpeakers.includes(line.speaker);
      const side = isRight ? 'right' : 'left';
      html += `<div class="chat-row ${side}">
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

init();
