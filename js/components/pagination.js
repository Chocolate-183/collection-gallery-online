/**
 * Pagination Controls Component
 */
import { store } from '../state.js';
import { renderCards } from './cards.js';
import { applyFiltersAndSort } from '../filter.js';

export function renderPagination(total) {
  const { currentPage, pageSize } = store.get();
  const info = document.getElementById('pagination-info');
  const controls = document.getElementById('pagination-controls');
  if (!controls) return;
  controls.innerHTML = '';

  if (total === 0) {
    if (info) info.innerText = '展示 0 - 0 件 / 共 0 件';
    return;
  }

  const totalPages = Math.ceil(total / pageSize);
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, total);

  if (info) info.innerHTML = `展示第 <strong>${startIdx} - ${endIdx}</strong> 件 / 共 <strong>${total}</strong> 件`;

  if (totalPages <= 1) return;

  const prevBtn = document.createElement('button');
  prevBtn.className = 'awsui-page-btn';
  prevBtn.title = '上一頁';
  prevBtn.setAttribute('aria-label', '上一頁');
  prevBtn.innerHTML = `<svg class="awsui-icon" viewBox="0 0 16 16"><path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>`;
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => goToPage(currentPage - 1);
  controls.appendChild(prevBtn);

  let pagesToDisplay = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pagesToDisplay.push(i);
  } else {
    pagesToDisplay = [1];
    if (currentPage > 3) pagesToDisplay.push('...');
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pagesToDisplay.push(i);
    if (currentPage < totalPages - 2) pagesToDisplay.push('...');
    pagesToDisplay.push(totalPages);
  }

  pagesToDisplay.forEach(p => {
    if (p === '...') {
      const span = document.createElement('span');
      span.style.padding = '0 6px';
      span.style.color = '#888';
      span.innerText = '...';
      controls.appendChild(span);
    } else {
      const btn = document.createElement('button');
      btn.className = `awsui-page-btn ${p === currentPage ? 'active' : ''}`;
      btn.innerText = p;
      btn.onclick = () => goToPage(p);
      controls.appendChild(btn);
    }
  });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'awsui-page-btn';
  nextBtn.title = '下一頁';
  nextBtn.setAttribute('aria-label', '下一頁');
  nextBtn.innerHTML = `<svg class="awsui-icon" viewBox="0 0 16 16"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>`;
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => goToPage(currentPage + 1);
  controls.appendChild(nextBtn);
}

export function goToPage(p) {
  store.set({ currentPage: p });
  renderCards();
  window.scrollTo({ top: 300, behavior: 'smooth' });
}

export function onPageSizeChange() {
  const select = document.getElementById('pagesize-select');
  const pageSize = select ? parseInt(select.value, 10) : 12;
  store.set({ pageSize });
  applyFiltersAndSort();
}
