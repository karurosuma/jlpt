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

// ... [full app.js content continues, including dynamic tab bar scroll handler at the end] ...

// iOS 26 style: dynamic tab bar shrink on scroll
let lastScrollY = 0;
let scrollTimeout;
function handleScroll() {
  const content = document.getElementById('content');
  if (!content) return;
  const currentScroll = window.scrollY || content.scrollTop || 0;
  const tabBar = document.querySelector('.tab-bar');
  if (!tabBar) return;
  if (currentScroll > lastScrollY && currentScroll > 60) {
    tabBar.classList.add('shrunk');
  } else if (currentScroll < lastScrollY) {
    tabBar.classList.remove('shrunk');
  }
  lastScrollY = currentScroll;
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    if (currentScroll < 30) tabBar.classList.remove('shrunk');
  }, 150);
}
window.addEventListener('scroll', handleScroll, { passive: true });
document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('content');
  if (content) content.addEventListener('scroll', handleScroll, { passive: true });
});
