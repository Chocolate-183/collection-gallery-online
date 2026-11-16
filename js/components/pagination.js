/**
 * Pagination Controls
 */
import { resolvePageSize } from '../constants.js';
import { store } from '../state.js';
import { renderCards } from './cards.js';
import { applyFiltersAndSort } from '../filter.js';

const CHEVRON_LEFT = '<svg class="awsui-icon" viewBox="0 0 16 16"><path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>';
const CHEVRON_RIGHT = '<svg class="awsui-icon" viewBox="0 0 16 16"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>';

/** Page numbers to show: all when ≤ 7, else 1 … (current ± 1) … last. */
function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = [1];
  if (currentPage > 3) pages.push('...');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  pages.push(totalPages);
  return pages;
}

function createArrowButton(label, icon, disabled, page) {
  const btn = document.createElement('button');
  btn.className = 'awsui-page-btn';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = icon;
  btn.disabled = disabled;
  btn.onclick = () => goToPage(page);
  return btn;
}

export function renderPagination(total) {
  const { currentPage, pageSize } = store.get();
  const controls = document.getElementById('pagination-controls');
  if (!controls) return;
  controls.innerHTML = '';

  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return;

  controls.appendChild(createArrowButton('上一頁', CHEVRON_LEFT, currentPage === 1, currentPage - 1));
  getVisiblePages(currentPage, totalPages).forEach(p => {
    if (p === '...') {
      const span = document.createElement('span');
      span.style.padding = '0 2px';
      span.style.color = '#888';
      span.innerText = '...';
      controls.appendChild(span);
      return;
    }
    const btn = document.createElement('button');
    btn.className = `awsui-page-btn ${p === currentPage ? 'active' : ''}`;
    btn.innerText = p;
    btn.onclick = () => goToPage(p);
    controls.appendChild(btn);
  });
  controls.appendChild(createArrowButton('下一頁', CHEVRON_RIGHT, currentPage === totalPages, currentPage + 1));
}

/** Changes page without moving the viewport. */
function goToPage(p) {
  const y = typeof window !== 'undefined' ? window.scrollY : 0;
  store.set({ currentPage: p });
  renderCards();
  if (typeof window !== 'undefined') window.scrollTo(0, y);
}

export function selectPageSize(tab, element) {
  if (element) {
    document.querySelectorAll('#page-size-tabs .awsui-tab').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
  }
  store.set({ pageSize: resolvePageSize(tab) });
  applyFiltersAndSort();
}
