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

// ... [rest of the full app.js content from the local file, including all functions and the dynamic tab bar scroll handler at the end] ...

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
