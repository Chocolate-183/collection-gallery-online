/**
 * Cards Matrix Component
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';
import { renderPagination } from './pagination.js';
import { updateSidebarBadge } from './sidebar.js';
import { escapeHtml } from '../utils.js';

export { escapeHtml };

export function showLoadingState() {
  const { currentCollectionId } = store.get();
  store.set({ allRecords: [], filteredRecords: [] });

  const totalElem = document.getElementById('kpi-total-count');
  if (totalElem) {
    totalElem.innerHTML = `-- <span class="awsui-kpi-unit">件</span>`;
  }

  const counter = document.getElementById('cards-counter');
  if (counter) counter.innerText = '(展廳載入中...)';

  updateSidebarBadge(currentCollectionId);

  const info = document.getElementById('pagination-info');
  if (info) info.innerText = '展廳載入中...';

  const controls = document.getElementById('pagination-controls');
  if (controls) controls.innerHTML = '';

  const container = document.getElementById('card-grid');
  if (container) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--awsui-color-text-body-secondary, #5f6b7a);">
        <div class="awsui-spinner" style="margin: 0 auto 16px auto;"></div>
        <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: var(--awsui-color-text-heading, #16191f);">展廳載入中...</h3>
        <p style="font-size: 13px; margin: 0; opacity: 0.8;">請稍候，策展團隊正在佈展與同步最新展品</p>
      </div>
    `;
  }
}

export function renderCards() {
  const { filteredRecords, currentPage, pageSize, currentCollectionId } = store.get();
  const container = document.getElementById('card-grid');
  const counter = document.getElementById('cards-counter');
  if (!container) return;
  container.innerHTML = '';
  container.setAttribute('data-collection', currentCollectionId || '');

  if (counter) counter.innerText = `(${filteredRecords.length})`;

  if (filteredRecords.length === 0) {
    container.innerHTML = `
      <div class="awsui-card awsui-empty-card">
        <svg class="awsui-icon awsui-icon-lg" viewBox="0 0 16 16">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
        </svg>
        <div class="awsui-empty-title">
          尚無相符展品
        </div>
      </div>
    `;
    renderPagination(0);
    return;
  }

  const total = filteredRecords.length;
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageRecords = filteredRecords.slice(startIdx, endIdx);

  pageRecords.forEach(rec => {
    const meaning = rec.tw_translation || '（無說明內容）';
    const isLongText = meaning.length > 20;

    const cardHtml = `
      <div class="awsui-card" data-collection="${escapeHtml(currentCollectionId)}" onclick="openMeaningModal(${rec.row_index})" style="cursor: pointer;" title="點擊開啟說明">
        <div class="awsui-card-top-content">
          <div class="awsui-card-header-title" data-collection="${escapeHtml(currentCollectionId)}" title="${escapeHtml(rec.ja_term)}">${escapeHtml(rec.ja_term)}</div>

          ${rec.reading ? `<span class="awsui-reading-subtext" data-collection="${escapeHtml(currentCollectionId)}" title="${escapeHtml(rec.reading)}">${escapeHtml(rec.reading)}</span>` : '<span class="awsui-reading-subtext">&nbsp;</span>'}

          <div class="awsui-card-divider"></div>

          <div class="awsui-meaning-wrapper">
            <div class="awsui-meaning-value" title="點擊瀏覽完整展品導覽">
              ${escapeHtml(meaning)}
            </div>
            ${isLongText ? `
              <div class="awsui-expand-hint" title="瀏覽說明">
                <svg class="awsui-icon" style="width:12px; height:12px;" viewBox="0 0 16 16"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });

  renderPagination(total);
}
