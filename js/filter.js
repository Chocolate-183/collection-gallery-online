/**
 * Filtering, Search, Initial Matching, Sorting & Catalog Panels
 */
import { KANA_RANGES, KANA_TABS, CATEGORY_TABS, ETYMOLOGY_TABS, POS_TABS, POS_EXTRA_TABS, LEVEL_TABS, categoryTabToTag, QUICK_FILTERS, QUICK_LEVEL_FILTERS, LENGTH_TABS, HANGUL_INITIAL_TABS, HANGUL_INITIAL_INDEX_TO_TAB, HANGUL_SYLLABLE, SORT_FIELDS, SORT_ORDERS, pageSizeTabValue, DEFAULT_PAGE_SIZE, SCRIPT_VARIANTS, DEFAULT_SCRIPT_VARIANT } from './constants.js';
import { store } from './state.js';
import { collectionsConfig } from './config.js';
import { renderCards } from './components/cards.js';
import { getExhibitFilterLength, getExhibitSubtitle, getExhibitDisplayTitle, formatExhibitTitleHtml, hasTag, isMobileViewport, getTimers } from './utils.js';

/* ------------------------------------------------------------------ */
/* Matching                                                           */
/* ------------------------------------------------------------------ */

/** True when the first character belongs to a 50-sound row (e.g. あ). */
export function matchesKanaGroup(str, group) {
  if (!str) return false;
  const regex = KANA_RANGES[group];
  return regex ? regex.test(str.charAt(0)) : true;
}

/** 초성 tab (e.g. ㄱ) of the first Hangul syllable in a string (C103). */
export function getHangulInitialTab(str) {
  if (!str) return null;
  for (const ch of String(str)) {
    const code = ch.codePointAt(0);
    if (code >= HANGUL_SYLLABLE.BASE && code <= HANGUL_SYLLABLE.END) {
      const initialIndex = Math.floor(
        (code - HANGUL_SYLLABLE.BASE) / (HANGUL_SYLLABLE.VOWEL_COUNT * HANGUL_SYLLABLE.FINAL_COUNT)
      );
      return HANGUL_INITIAL_INDEX_TO_TAB[initialIndex] || null;
    }
  }
  return null;
}

export function matchesHangulInitial(str, group) {
  return getHangulInitialTab(str) === group;
}

/* ------------------------------------------------------------------ */
/* Filters                                                            */
/* ------------------------------------------------------------------ */

const SEARCH_FIELDS = ['ja_term', 'traditional_term', 'reading', 'tw_translation', 'id'];

export function filterByQuery(records, query) {
  if (!query) return records;
  const q = query.toLowerCase();
  return records.filter(r => SEARCH_FIELDS.some(field => r[field] && r[field].toLowerCase().includes(q)));
}

export function filterByLength(records, lengthTab) {
  if (!lengthTab || lengthTab === LENGTH_TABS.ALL) return records;
  if (lengthTab === LENGTH_TABS.FIVE_PLUS) {
    return records.filter(r => getExhibitFilterLength(r.ja_term) >= 5);
  }
  const targetLen = parseInt(lengthTab, 10);
  if (Number.isNaN(targetLen)) return records;
  return records.filter(r => getExhibitFilterLength(r.ja_term) === targetLen);
}

/** Kana row (あ…わ) or Hangul 초성 (ㄱ…ㅎ) filter on reading, falling back to the title. */
export function filterByInitial(records, initialTab) {
  if (!initialTab || initialTab === KANA_TABS.ALL) return records;
  if (HANGUL_INITIAL_TABS.includes(initialTab)) {
    return records.filter(r => matchesHangulInitial(r.reading || r.ja_term, initialTab));
  }
  if (KANA_RANGES[initialTab]) {
    return records.filter(r => matchesKanaGroup(r.reading || r.ja_term, initialTab));
  }
  return records;
}

/** Exact match on a trimmed record field; `ALL` (or empty) keeps every record. */
function filterByField(records, field, value) {
  if (!value || value === 'ALL') return records;
  return records.filter(r => String(r?.[field] || '').trim() === value);
}

export const filterByEtymology = (records, tab) => filterByField(records, 'etymology', tab);
export const filterByPos = (records, tab) => filterByField(records, 'pos', tab);
export const filterByLevel = (records, tab) => filterByField(records, 'level', tab);

export function filterByCategory(records, categoryTab) {
  const tag = categoryTabToTag(categoryTab);
  return tag ? records.filter(r => hasTag(r, tag)) : records;
}

/* ------------------------------------------------------------------ */
/* Sorting                                                            */
/* ------------------------------------------------------------------ */

/** Oldest first; undated rows last; same-day rows by sheet order (so Latest 10 shows newest rows first). */
function compareCreatedAt(a, b) {
  const dateA = a.created_at ? new Date(a.created_at).getTime() : NaN;
  const dateB = b.created_at ? new Date(b.created_at).getTime() : NaN;
  const hasA = !Number.isNaN(dateA);
  const hasB = !Number.isNaN(dateB);
  if (hasA && hasB && dateA !== dateB) return dateA - dateB;
  if (hasA !== hasB) return hasA ? -1 : 1;
  return (a.row_index ?? 0) - (b.row_index ?? 0);
}

const SORT_COMPARATORS = {
  [SORT_FIELDS.ID]: (a, b) => String(a.id || '').localeCompare(String(b.id || ''), 'en', { numeric: true }),
  [SORT_FIELDS.SUBTITLE]: (a, b) => getExhibitSubtitle(a).localeCompare(getExhibitSubtitle(b), 'en', { sensitivity: 'base' }),
  [SORT_FIELDS.TITLE]: (a, b) => (a.ja_term || '').localeCompare(b.ja_term || ''),
  [SORT_FIELDS.RANDOM]: (a, b) => (a._randSort ?? 0) - (b._randSort ?? 0),
  [SORT_FIELDS.CREATED_AT]: compareCreatedAt,
  [SORT_FIELDS.STANDARD]: (a, b) => (a.reading || a.ja_term || '').localeCompare(b.reading || b.ja_term || '', 'ja')
};

/** Sorts by field + order; ties fall back to sheet row order. */
export function sortRecords(records, { sortField = SORT_FIELDS.STANDARD, sortOrder = SORT_ORDERS.ASC } = {}) {
  if (sortField === SORT_FIELDS.RANDOM && records.some(r => r._randSort === undefined)) {
    store.reshuffleRandomSort();
  }
  const compare = SORT_COMPARATORS[sortField] || SORT_COMPARATORS[SORT_FIELDS.STANDARD];
  const direction = sortOrder === SORT_ORDERS.DESC ? -1 : 1;
  return [...records].sort((a, b) => (direction * compare(a, b)) || ((a.row_index ?? 0) - (b.row_index ?? 0)));
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                           */
/* ------------------------------------------------------------------ */

export function applyFiltersAndSort() {
  const {
    allRecords, searchQuery, currentLengthTab, currentInitialTab, etymologyTab, posTab,
    levelTab, categoryTab, currentSortField, currentSortOrder, invalidTerm
  } = store.get();

  if (invalidTerm) {
    store.set({ filteredRecords: [], currentPage: 1 });
    renderCards();
    return;
  }

  let result = filterByQuery(allRecords, searchQuery);
  result = filterByLength(result, currentLengthTab);
  result = filterByEtymology(result, etymologyTab);
  result = filterByPos(result, posTab);
  result = filterByLevel(result, levelTab);
  result = filterByCategory(result, categoryTab);
  result = filterByInitial(result, currentInitialTab);
  result = sortRecords(result, { sortField: currentSortField, sortOrder: currentSortOrder });

  store.set({ filteredRecords: result, currentPage: 1 });
  renderCards();
  syncFilterUi();
}

export function onSearchInput() {
  const input = document.getElementById('search-input');
  store.set({ searchQuery: input ? input.value.trim() : '', invalidTerm: null });
  applyFiltersAndSort();
}

/* ------------------------------------------------------------------ */
/* Tab selection                                                      */
/* ------------------------------------------------------------------ */

function updateTabPills(containerSelector, element) {
  document.querySelectorAll(`${containerSelector} .awsui-tab`).forEach(p => p.classList.remove('active'));
  element?.classList.add('active');
}

function activateTabByValue(containerSelector, value) {
  document.querySelectorAll(`${containerSelector} .awsui-tab`).forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-tab') === value);
  });
}

/** Builds a pill handler that stores `tab` under `stateKey`, highlights the pill, and re-filters. */
function createTabSelector(stateKey, containerSelector, afterSet) {
  return (tab, element) => {
    store.set({ [stateKey]: tab, invalidTerm: null });
    if (element) updateTabPills(containerSelector, element);
    afterSet?.(tab);
    applyFiltersAndSort();
  };
}

export const selectLengthTab = createTabSelector('currentLengthTab', '#length-tabs');
export const selectEtymologyTab = createTabSelector('etymologyTab', '#etymology-tabs');
export const selectLevelTab = createTabSelector('levelTab', '#level-tabs');
export const selectSortOrder = createTabSelector('currentSortOrder', '#sort-order-tabs');
export const selectPosTab = createTabSelector('posTab', '#pos-tabs', tab => {
  if (POS_EXTRA_TABS.includes(tab)) showMorePosTabs();
});

export function selectKindTab(tab, element) {
  createTabSelector('categoryTab', '#kind-tabs')(tab || CATEGORY_TABS.ALL, element);
}

export function selectInitialTab(tab, element) {
  const parentId = element?.closest('.awsui-tabs')?.id;
  createTabSelector('currentInitialTab', parentId ? `#${parentId}` : null)(tab, parentId ? element : null);
}

export function selectSortField(field, element) {
  if (field === SORT_FIELDS.RANDOM) store.reshuffleRandomSort();
  createTabSelector('currentSortField', '#sort-field-tabs')(field, element);
}

export function selectScriptVariant(variant, element) {
  const next = variant === SCRIPT_VARIANTS.TRADITIONAL ? SCRIPT_VARIANTS.TRADITIONAL : SCRIPT_VARIANTS.SIMPLIFIED;
  store.set({ scriptVariant: next });
  if (element) updateTabPills('#script-tabs', element);
  applyFiltersAndSort();

  // Re-title an open Item modal in the new script.
  const modal = document.getElementById('detail-modal');
  const titleElem = document.getElementById('modal-term-title');
  const meaningElem = document.getElementById('modal-meaning-text');
  if (!modal?.classList.contains('open') || !titleElem || !meaningElem) return;
  const rowIndex = Number(meaningElem.getAttribute('data-row-index'));
  const rec = store.get().allRecords.find(r => r.row_index === rowIndex);
  if (rec) titleElem.innerHTML = formatExhibitTitleHtml(getExhibitDisplayTitle(rec, next));
}

function setPosTabsExpanded(expanded) {
  if (typeof document === 'undefined') return;
  document.getElementById('pos-tabs')?.classList.toggle('pos-expanded', expanded);
}

export function showMorePosTabs() {
  setPosTabsExpanded(true);
}

/* ------------------------------------------------------------------ */
/* Quick filters & defaults                                           */
/* ------------------------------------------------------------------ */

export function getDefaultSortField(col) {
  if (!col?.hasHangulTabs && (col?.hasKanaTabs ?? col?.hasReading)) return SORT_FIELDS.STANDARD;
  return SORT_FIELDS.TITLE;
}

function currentDefaultSortField() {
  return getDefaultSortField(collectionsConfig[store.get().currentCollectionId]);
}

function getActiveQuickFilter({ currentSortField, currentSortOrder, categoryTab, levelTab }) {
  if (categoryTab === CATEGORY_TABS.BASIC100) return QUICK_FILTERS.BASIC100;
  if (QUICK_LEVEL_FILTERS.includes(levelTab)) return levelTab;
  if (currentSortField === SORT_FIELDS.RANDOM) return QUICK_FILTERS.RANDOM10;
  if (currentSortField === SORT_FIELDS.CREATED_AT && currentSortOrder === SORT_ORDERS.DESC) return QUICK_FILTERS.LATEST10;
  return QUICK_FILTERS.ALL;
}

/** State patch applied when a quick filter pill is switched on. */
function quickFilterPatch(tab) {
  const defaultSort = { currentSortField: currentDefaultSortField(), currentSortOrder: SORT_ORDERS.ASC };
  if (tab === QUICK_FILTERS.BASIC100) {
    return { categoryTab: CATEGORY_TABS.BASIC100, levelTab: LEVEL_TABS.ALL, pageSize: 100, ...defaultSort };
  }
  if (QUICK_LEVEL_FILTERS.includes(tab)) {
    return { levelTab: tab, categoryTab: CATEGORY_TABS.ALL, pageSize: 100, ...defaultSort };
  }
  const reset = { categoryTab: CATEGORY_TABS.ALL, levelTab: LEVEL_TABS.ALL, pageSize: DEFAULT_PAGE_SIZE };
  if (tab === QUICK_FILTERS.RANDOM10) {
    store.reshuffleRandomSort();
    return { ...reset, currentSortField: SORT_FIELDS.RANDOM, currentSortOrder: SORT_ORDERS.ASC };
  }
  if (tab === QUICK_FILTERS.LATEST10) {
    return { ...reset, currentSortField: SORT_FIELDS.CREATED_AT, currentSortOrder: SORT_ORDERS.DESC };
  }
  return {};
}

/** State patch applied when the already-active quick filter pill is clicked again (toggle off). */
function quickFilterOffPatch(tab) {
  if (tab === QUICK_FILTERS.BASIC100) return { categoryTab: CATEGORY_TABS.ALL };
  if (QUICK_LEVEL_FILTERS.includes(tab)) return { levelTab: LEVEL_TABS.ALL };
  return { currentSortField: currentDefaultSortField(), currentSortOrder: SORT_ORDERS.ASC };
}

export function selectQuickFilter(tab) {
  const isActive = getActiveQuickFilter(store.get()) === tab;
  store.set({ ...(isActive ? quickFilterOffPatch(tab) : quickFilterPatch(tab)), invalidTerm: null });
  applyFiltersAndSort();
}

const FINE_FILTER_DEFAULTS = {
  currentLengthTab: LENGTH_TABS.ALL,
  currentInitialTab: KANA_TABS.ALL,
  etymologyTab: ETYMOLOGY_TABS.ALL,
  posTab: POS_TABS.ALL,
  levelTab: LEVEL_TABS.ALL,
  categoryTab: CATEGORY_TABS.ALL
};

/** Fine filter + display state used when entering a different hall. */
export function getHallDefaultState(col) {
  return {
    ...FINE_FILTER_DEFAULTS,
    currentSortField: getDefaultSortField(col),
    currentSortOrder: SORT_ORDERS.ASC,
    scriptVariant: DEFAULT_SCRIPT_VARIANT
  };
}

export function resetFineFilters() {
  store.set({ ...FINE_FILTER_DEFAULTS, invalidTerm: null });
  setPosTabsExpanded(false);
  applyFiltersAndSort();
}

export function resetDisplaySettings() {
  store.set({
    currentSortField: currentDefaultSortField(),
    currentSortOrder: SORT_ORDERS.ASC,
    pageSize: DEFAULT_PAGE_SIZE,
    scriptVariant: DEFAULT_SCRIPT_VARIANT,
    invalidTerm: null
  });
  applyFiltersAndSort();
}

export function resetFilterAndDisplay() {
  resetFineFilters();
  resetDisplaySettings();
}

export function countActiveFineFilters() {
  const state = store.get();
  return Object.entries(FINE_FILTER_DEFAULTS)
    .filter(([key, def]) => state[key] && state[key] !== def)
    .length;
}

function countActiveDisplaySettings() {
  const { currentSortField, currentSortOrder, pageSize, scriptVariant, currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId] || {};
  let count = 0;
  if (currentSortField !== getDefaultSortField(col) || currentSortOrder !== SORT_ORDERS.ASC) count += 1;
  if (pageSize !== DEFAULT_PAGE_SIZE) count += 1;
  if (col.hasScriptDisplay && scriptVariant && scriptVariant !== DEFAULT_SCRIPT_VARIANT) count += 1;
  return count;
}

const SORT_FIELD_LABELS = {
  [SORT_FIELDS.ID]: '編號',
  [SORT_FIELDS.TITLE]: '標題',
  [SORT_FIELDS.SUBTITLE]: '副標',
  [SORT_FIELDS.RANDOM]: '隨機',
  [SORT_FIELDS.CREATED_AT]: '新增日期',
  [SORT_FIELDS.STANDARD]: '読み方'
};

/** One-line summary of active filters + sort, e.g. "ㄱ · 2字 · 名詞 · 標題 正序". */
export function getFilterSummary() {
  const { currentLengthTab, currentInitialTab, etymologyTab, posTab, levelTab, categoryTab, currentSortField, currentSortOrder, scriptVariant, currentCollectionId } = store.get();
  const parts = [];
  const isSet = value => value && value !== 'ALL';

  if (isSet(currentInitialTab)) parts.push(KANA_RANGES[currentInitialTab] ? `${currentInitialTab}行` : currentInitialTab);
  if (isSet(currentLengthTab)) parts.push(currentLengthTab === LENGTH_TABS.FIVE_PLUS ? '5字+' : `${currentLengthTab}字`);
  [posTab, etymologyTab, levelTab].filter(isSet).forEach(v => parts.push(v));
  const categoryLabel = categoryTabToTag(categoryTab);
  if (categoryLabel) parts.push(categoryLabel);

  const fieldLabel = SORT_FIELD_LABELS[currentSortField] || SORT_FIELD_LABELS[SORT_FIELDS.STANDARD];
  parts.push(`${fieldLabel} ${currentSortOrder === SORT_ORDERS.DESC ? '倒序' : '正序'}`);
  if (collectionsConfig[currentCollectionId]?.hasScriptDisplay && scriptVariant === SCRIPT_VARIANTS.TRADITIONAL) {
    parts.push('繁體');
  }
  return parts.join(' · ');
}

/** Syncs every pill, the summary text, and the Filter trigger badge with store state. */
export function syncFilterUi() {
  if (typeof document === 'undefined') return;

  const state = store.get();
  const tabGroups = {
    '#quick-filter-tabs': getActiveQuickFilter(state),
    '#length-tabs': state.currentLengthTab || LENGTH_TABS.ALL,
    '#hangul-tabs': state.currentInitialTab || KANA_TABS.ALL,
    '#kana-initial-tabs': state.currentInitialTab || KANA_TABS.ALL,
    '#kind-tabs': state.categoryTab || CATEGORY_TABS.ALL,
    '#etymology-tabs': state.etymologyTab || ETYMOLOGY_TABS.ALL,
    '#pos-tabs': state.posTab || POS_TABS.ALL,
    '#level-tabs': state.levelTab || LEVEL_TABS.ALL,
    '#sort-field-tabs': state.currentSortField || SORT_FIELDS.STANDARD,
    '#sort-order-tabs': state.currentSortOrder || SORT_ORDERS.ASC,
    '#page-size-tabs': pageSizeTabValue(state.pageSize),
    '#script-tabs': state.scriptVariant || DEFAULT_SCRIPT_VARIANT
  };
  Object.entries(tabGroups).forEach(([selector, value]) => activateTabByValue(selector, value));
  if (POS_EXTRA_TABS.includes(state.posTab)) setPosTabsExpanded(true);

  const summary = document.getElementById('filter-summary');
  if (summary) summary.innerText = getFilterSummary();

  const activeCount = countActiveFineFilters() + countActiveDisplaySettings();
  document.getElementById('btn-open-filter-modal')?.classList.toggle('has-active-filters', activeCount > 0);

  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) resetBtn.style.display = activeCount > 0 ? '' : 'none';
}

/* ------------------------------------------------------------------ */
/* Filter / Display panels                                            */
/* ------------------------------------------------------------------ */

export const DISPLAY_FOLLOW_DELAY_MS = 160;
let displayFollowTimer = null;

function isPanelOpen(id) {
  return Boolean(document.getElementById(id)?.classList.contains('open'));
}

function setPanelOpen(id, open) {
  document.getElementById(id)?.classList.toggle('open', open);
}

/** Mobile merges Display into the Filter panel; desktop keeps it in its own panel. */
function placeDisplayPanel() {
  if (typeof document === 'undefined') return;
  const body = document.getElementById('display-panel-body');
  const combined = document.getElementById('filter-combined-host');
  const displayHost = document.getElementById('display-panel-host');
  if (!body || !combined || !displayHost) return;
  const target = isMobileViewport() ? combined : displayHost;
  if (body.parentNode !== target) target.appendChild(body);
}

function cancelDisplayFollow() {
  if (displayFollowTimer == null) return;
  getTimers().clear(displayFollowTimer);
  displayFollowTimer = null;
}

/** On desktop the Display panel slides in shortly after the Filter panel opens. */
function scheduleDisplayFollow() {
  cancelDisplayFollow();
  displayFollowTimer = getTimers().set(() => {
    displayFollowTimer = null;
    if (isPanelOpen('filter-modal')) openDisplayModal();
  }, DISPLAY_FOLLOW_DELAY_MS);
}

function syncFilterTriggerActive() {
  const filterOpen = isPanelOpen('filter-modal');
  const displayOpen = isPanelOpen('display-modal');
  document.getElementById('btn-open-filter-modal')?.classList.toggle('active', filterOpen || displayOpen);
  document.getElementById('display-modal')?.classList.toggle('solo', displayOpen && !filterOpen);
}

function closeDisplayPanelForMobile() {
  cancelDisplayFollow();
  setPanelOpen('display-modal', false);
  syncFilterTriggerActive();
}

function openDisplayModal() {
  if (isMobileViewport() || !document.getElementById('display-modal')) return;
  syncFilterUi();
  setPanelOpen('display-modal', true);
  syncFilterTriggerActive();
}

function closeDisplayModal() {
  cancelDisplayFollow();
  setPanelOpen('display-modal', false);
  syncFilterTriggerActive();
}

export function openFilterModal() {
  if (!document.getElementById('filter-modal')) return;
  placeDisplayPanel();
  syncFilterUi();
  setPanelOpen('filter-modal', true);
  syncFilterTriggerActive();
  if (isMobileViewport()) {
    closeDisplayPanelForMobile();
  } else {
    scheduleDisplayFollow();
  }
}

function closeFilterModal() {
  cancelDisplayFollow();
  setPanelOpen('filter-modal', false);
  syncFilterTriggerActive();
}

export function closeCatalogPanels() {
  closeFilterModal();
  closeDisplayModal();
}

export function closeFilterModalOnBackdrop(e) {
  if (e?.target?.id === 'filter-modal') closeCatalogPanels();
}

export function closeDisplayModalOnBackdrop(e) {
  if (e?.target?.id === 'display-modal') closeCatalogPanels();
}

export function initCatalogPanelLayout() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  placeDisplayPanel();
  window.addEventListener('resize', () => {
    placeDisplayPanel();
    if (isMobileViewport()) {
      closeDisplayPanelForMobile();
    } else if (isPanelOpen('filter-modal') && !isPanelOpen('display-modal')) {
      scheduleDisplayFollow();
    }
  });
}
