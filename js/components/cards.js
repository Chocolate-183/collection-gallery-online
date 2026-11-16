/**
 * Catalog Cards Grid
 */
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_ALL } from '../constants.js';
import { store } from '../state.js';
import { renderPagination } from './pagination.js';
import { updateSidebarBadge } from './sidebar.js';
import { escapeHtml, formatExhibitTitleHtml, getExhibitDisplayTitle } from '../utils.js';

const NO_DESCRIPTION = '（無說明內容）';
const LONG_TEXT_CHARS = 20;
const PLACEHOLDER_CARD_HTML = '<div class="awsui-card awsui-card-placeholder" aria-hidden="true"></div>';
const EMPTY_STATE_HTML = `
  <div class="awsui-card awsui-empty-card">
    <svg class="awsui-icon awsui-icon-lg" viewBox="0 0 16 16">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
    </svg>
    <div class="awsui-empty-title">
      尚無相符展品
    </div>
  </div>
`;
const EXPAND_HINT_HTML = `
  <div class="awsui-expand-hint" title="瀏覽說明">
    <svg class="awsui-icon" style="width:12px; height:12px;" viewBox="0 0 16 16"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
  </div>
`;

/** The grid always renders a full page of slots so Catalog height stays stable while filtering. */
function catalogSlotCount(pageSize, recordCount) {
  const size = Number(pageSize) || 0;
  if (!size || size >= PAGE_SIZE_ALL) return Math.max(recordCount, DEFAULT_PAGE_SIZE);
  return size;
}

/**
 * Empty state: overlaid on the grid shell when present (keeps placeholder height),
 * otherwise returned as HTML to prepend inside the grid.
 */
function syncEmptyOverlay(container, total) {
  const shell = container.parentElement;
  if (!shell?.classList?.contains('awsui-cards-grid-shell')) {
    return total === 0 ? EMPTY_STATE_HTML : '';
  }
  const existing = shell.querySelector('.awsui-empty-card');
  if (total === 0 && !existing) shell.insertAdjacentHTML('beforeend', EMPTY_STATE_HTML);
  if (total > 0 && existing) existing.remove();
  return '';
}

export function showLoadingState() {
  store.set({ allRecords: [], filteredRecords: [] });

  const counter = document.getElementById('cards-counter');
  if (counter) counter.innerText = '(展廳載入中...)';
  updateSidebarBadge(store.get().currentCollectionId);

  const controls = document.getElementById('pagination-controls');
  if (controls) controls.innerHTML = '';

  const container = document.getElementById('card-grid');
  if (container) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--awsui-color-text-body-secondary, #5f6b7a);">
        <div class="awsui-spinner" style="margin: 0 auto 16px auto;"></div>
        <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 4px 0; color: var(--awsui-color-text-heading, #16191f);">展廳載入中...</h3>
        <p style="font-size: 13px; margin: 0; opacity: 0.8;">請稍候，團隊正在佈展與同步最新展品</p>
      </div>
    `;
  }
}

/** Row index of the record open in the Item modal (so its card renders active), else null. */
function getOpenItemRowIndex() {
  const detailModal = document.getElementById('detail-modal');
  if (!detailModal?.classList?.contains('open')) return null;
  return document.getElementById('modal-meaning-text')?.getAttribute('data-row-index') ?? null;
}

function cardHtml(rec, { colId, scriptVariant, activeRowIndex }) {
  const meaning = rec.tw_translation || NO_DESCRIPTION;
  const isActive = activeRowIndex !== null && String(rec.row_index) === String(activeRowIndex);
  const displayTitle = getExhibitDisplayTitle(rec, scriptVariant);
  const colAttr = escapeHtml(colId);
  const reading = rec.reading
    ? `<span class="awsui-reading-subtext" data-collection="${colAttr}" title="${escapeHtml(rec.reading)}">${escapeHtml(rec.reading)}</span>`
    : '<span class="awsui-reading-subtext">&nbsp;</span>';

  return `
    <div class="awsui-card${isActive ? ' active' : ''}" data-row-index="${rec.row_index}" data-collection="${colAttr}" onclick="openMeaningModal(${rec.row_index})" style="cursor: pointer;" title="點擊開啟說明">
      <div class="awsui-card-top-content">
        <div class="awsui-card-header-title" data-collection="${colAttr}" title="${escapeHtml(displayTitle)}">${formatExhibitTitleHtml(displayTitle)}</div>
        ${reading}
        <div class="awsui-card-divider"></div>
        <div class="awsui-meaning-wrapper">
          <div class="awsui-meaning-value" title="點擊瀏覽完整展品導覽">
            ${escapeHtml(meaning)}
          </div>
          ${meaning.length > LONG_TEXT_CHARS ? EXPAND_HINT_HTML : ''}
        </div>
      </div>
    </div>
  `;
}

export function renderCards() {
  const { filteredRecords, currentPage, pageSize, currentCollectionId, scriptVariant } = store.get();
  const container = document.getElementById('card-grid');
  if (!container) return;

  container.setAttribute('data-collection', currentCollectionId || '');
  const counter = document.getElementById('cards-counter');
  if (counter) counter.innerText = `(${filteredRecords.length})`;

  const total = filteredRecords.length;
  const startIdx = (currentPage - 1) * pageSize;
  const pageRecords = filteredRecords.slice(startIdx, startIdx + pageSize);
  const options = { colId: currentCollectionId, scriptVariant, activeRowIndex: getOpenItemRowIndex() };

  const slots = Array.from({ length: catalogSlotCount(pageSize, pageRecords.length) }, (_, i) =>
    pageRecords[i] ? cardHtml(pageRecords[i], options) : PLACEHOLDER_CARD_HTML
  );

  container.innerHTML = syncEmptyOverlay(container, total) + slots.join('');
  renderPagination(total);
}
