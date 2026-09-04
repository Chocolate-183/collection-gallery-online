/**
 * Theme Management (Light / Dark Mode)
 */
import { store } from './state.js';
import { showToast } from './components/toast.js';

export function initTheme() {
  const { currentTheme } = store.get();
  applyTheme(currentTheme);
}

export function toggleTheme() {
  const { currentTheme } = store.get();
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('aws_theme', nextTheme);
  store.set({ currentTheme: nextTheme });
  applyTheme(nextTheme);
  showToast(nextTheme === 'dark' ? '已切換至深色模式' : '已切換至淺色模式');
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const sunIcon = document.querySelector('#btn-toggle-theme .icon-sun');
  const moonIcon = document.querySelector('#btn-toggle-theme .icon-moon');
  const btn = document.getElementById('btn-toggle-theme');

  if (theme === 'dark') {
    if (sunIcon) sunIcon.style.display = 'inline-block';
    if (moonIcon) moonIcon.style.display = 'none';
    if (btn) btn.setAttribute('title', '切換至淺色模式');
  } else {
    if (sunIcon) sunIcon.style.display = 'none';
    if (moonIcon) moonIcon.style.display = 'inline-block';
    if (btn) btn.setAttribute('title', '切換至深色模式');
  }
}
