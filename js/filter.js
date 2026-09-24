/**
 * Filtering, Search, Kana Matching, and Sorting Engine
 */
import { KANA_RANGES, SORT_TYPES, KANA_TABS, LENGTH_TABS, HANGUL_INITIAL_TABS, HANGUL_INITIAL_INDEX_TO_TAB, HANGUL_SYLLABLE, SORT_FIELDS, SORT_ORDERS, pageSizeTabValue } from './constants.js';
import { store } from './state.js';
import { collectionsConfig } from './config.js';
import { renderCards } from './components/cards.js';
import { getExhibitFilterLength, getExhibitSubtitle, isEnglishLoanword } from './utils.js';

/**
 * Checks if a string starts with a kana character in the specified kana group.
 */
export function matchesKanaGroup(str, group) {
  if (!str) return false;
  const ch = str.charAt(0);
  const regex = KANA_RANGES[group];
  return regex ? regex.test(ch) : true;
}

/**
 * First 초성 tab for a Hangul string (C103), e.g. ㄱ.
 */
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

/**
 * Checks if a string's first Hangul syllable belongs to a 초성 tab (e.g. ㄱ).
 */
export function matchesHangulInitial(str, group) {
  return getHangulInitialTab(str) === group;
}

/**
 * Filters records by search query (keyword matching across fields).
 */
export function filterByQuery(records, query) {
  if (!query) return records;
  const q = query.toLowerCase();
  return records.filter(r =>
    (r.ja_term && r.ja_term.toLowerCase().includes(q)) ||
    (r.reading && r.reading.toLowerCase().includes(q)) ||
    (r.tw_translation && r.tw_translation.toLowerCase().includes(q)) ||
    (r.id && r.id.toLowerCase().includes(q))
  );
}

/**
 * Filters records by term character length tab.
 */
export function filterByLength(records, lengthTab) {
  if (!lengthTab || lengthTab === LENGTH_TABS.ALL) return records;
  const isFivePlus = lengthTab === LENGTH_TABS.FIVE_PLUS || lengthTab === '5+' || lengthTab === '5字+' || lengthTab === '5字＋';
  const targetLen = parseInt(lengthTab, 10);

  return records.filter(r => {
    const len = getExhibitFilterLength(r.ja_term || '');
    if (isFivePlus) return len >= 5;
    return !isNaN(targetLen) ? len === targetLen : true;
  });
}

/**
 * Filters records by Kana tab or special modes (RANDOM10, LATEST10).
 */
export function filterByKana(records, kanaTab, searchQuery) {
  if (!kanaTab || kanaTab === KANA_TABS.ALL) return records;

  let result = [...records];

  if (kanaTab === KANA_TABS.RANDOM10) {
    if (!searchQuery) {
      if (result.some(r => r._rand10 === undefined)) {
        store.reshuffleRandom10();
      }
      result.sort((a, b) => (a._rand10 ?? 0) - (b._rand10 ?? 0));
      result = result.slice(0, 10);
    }
  } else if (kanaTab === KANA_TABS.LATEST10) {
    result.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : NaN;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : NaN;
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return (b.row_index ?? 0) - (a.row_index ?? 0);
    });
    result = result.slice(0, 10);
  } else if (kanaTab === KANA_TABS.LOANWORD) {
    result = result.filter(r => isEnglishLoanword(r));
  } else if (HANGUL_INITIAL_TABS.includes(kanaTab)) {
    result = result.filter(r => matchesHangulInitial(r.reading || r.ja_term, kanaTab));
  } else {
    result = result.filter(r => matchesKanaGroup(r.reading || r.ja_term, kanaTab));
  }

  return result;
}

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

export function filterByLoanword(records, loanwordOnly) {
  if (!loanwordOnly) return records;
  return records.filter(r => isEnglishLoanword(r));
}

export function resolveSortType(sortField, sortOrder) {
  const desc = sortOrder === SORT_ORDERS.DESC;
  if (sortField === SORT_FIELDS.ID) return desc ? SORT_TYPES.JA_DESC : SORT_TYPES.ID_ASC;
  if (sortField === SORT_FIELDS.TITLE || sortField === SORT_FIELDS.SUBTITLE) {
    return desc ? SORT_TYPES.JA_DESC : SORT_TYPES.JA_ASC;
  }
  return desc ? SORT_TYPES.READING_DESC : SORT_TYPES.READING_ASC;
}

/**
 * Sorts records based on chosen sort option dropdown.
 */
export function sortRecords(records, sortType, options = {}) {
  const result = [...records];
  const field = options.sortField;
  const order = options.sortOrder;
  if (field) {
    const direction = order === SORT_ORDERS.DESC ? -1 : 1;
    return result.sort((a, b) => {
      let cmp = 0;
      if (field === SORT_FIELDS.ID) {
        cmp = String(a.id || '').localeCompare(String(b.id || ''), 'en', { numeric: true });
      } else if (field === SORT_FIELDS.SUBTITLE) {
        cmp = getExhibitSubtitle(a).localeCompare(getExhibitSubtitle(b), 'en', { sensitivity: 'base' });
      } else if (field === SORT_FIELDS.TITLE) {
        cmp = (a.ja_term || '').localeCompare(b.ja_term || '');
      } else {
        cmp = (a.reading || a.ja_term || '').localeCompare(b.reading || b.ja_term || '', 'ja');
      }
      if (cmp !== 0) return direction * cmp;
      return (a.row_index ?? 0) - (b.row_index ?? 0);
    });
  }

  const compareText = (aStr, bStr) => (aStr || '').localeCompare(bStr || '', 'ja');

  switch (sortType) {
    case SORT_TYPES.READING_ASC:
      return result.sort((a, b) => compareText(a.reading || a.ja_term, b.reading || b.ja_term));
    case SORT_TYPES.READING_DESC:
      return result.sort((a, b) => compareText(b.reading || b.ja_term, a.reading || a.ja_term));
    case SORT_TYPES.JA_ASC:
      return result.sort((a, b) => compareText(a.ja_term, b.ja_term));
    case SORT_TYPES.JA_DESC:
      return result.sort((a, b) => compareText(b.ja_term, a.ja_term));
    case SORT_TYPES.ID_ASC:
      return result.sort((a, b) => (a.row_index ?? 0) - (b.row_index ?? 0));
    default:
      return result;
  }
}

/**
 * C103 外來語 tab: sort by English 副標 (A–Z), not Hangul reading.
 */
export function sortBySubtitle(records) {
  const result = [...records];
  return result.sort((a, b) => {
    const cmp = getExhibitSubtitle(a).localeCompare(getExhibitSubtitle(b), 'en', { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return (a.row_index ?? 0) - (b.row_index ?? 0);
  });
}

function isQuickPresetTab(tab) {
  return tab === KANA_TABS.RANDOM10 || tab === KANA_TABS.LATEST10;
}

/**
 * Main filter pipeline entry point.
 */
export function applyFiltersAndSort() {
  const {
    allRecords,
    searchQuery,
    currentLengthTab,
    currentKanaTab,
    currentInitialTab,
    loanwordOnly,
    currentSortField,
    currentSortOrder,
    invalidTerm
  } = store.get();

  if (invalidTerm) {
    store.set({
      filteredRecords: [],
      currentPage: 1
    });
    renderCards();
    return;
  }

  let result = filterByQuery(allRecords, searchQuery);
  result = filterByLength(result, currentLengthTab);
  result = filterByLoanword(result, loanwordOnly);
  result = filterByInitial(result, currentInitialTab);

  if (isQuickPresetTab(currentKanaTab)) {
    result = filterByKana(result, currentKanaTab, searchQuery);
  }

  if (currentKanaTab !== KANA_TABS.LATEST10) {
    result = sortRecords(result, resolveSortType(currentSortField, currentSortOrder), {
      sortField: currentSortField,
      sortOrder: currentSortOrder
    });
  }

  store.set({
    filteredRecords: result,
    currentPage: 1
  });

  renderCards();
  syncFilterUi();
}

export function onSearchInput() {
  const input = document.getElementById('search-input');
  store.set({ searchQuery: input ? input.value.trim() : '', invalidTerm: null });
  applyFiltersAndSort();
}

export function onFilterChange() {
  applyFiltersAndSort();
}

function updateTabPills(containerSelector, element) {
  const pills = document.querySelectorAll(`${containerSelector} .awsui-tab`);
  pills.forEach(p => p.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }
}

function activateTabByValue(containerSelector, value) {
  const pills = document.querySelectorAll(`${containerSelector} .awsui-tab`);
  pills.forEach(p => {
    const tabValue = p.getAttribute('data-tab');
    p.classList.toggle('active', tabValue === value);
  });
}

export function selectKanaTab(tab, element) {
  if (tab === KANA_TABS.RANDOM10) {
    store.reshuffleRandom10();
  }
  store.set({ currentKanaTab: tab, invalidTerm: null });
  updateTabPills('#kana-tabs', element);
  applyFiltersAndSort();
}

export function selectLengthTab(tab, element) {
  store.set({ currentLengthTab: tab, invalidTerm: null });
  if (element) updateTabPills('#length-tabs', element);
  applyFiltersAndSort();
}

export function selectInitialTab(tab, element) {
  store.set({ currentInitialTab: tab, invalidTerm: null });
  if (element) {
    const parent = element.closest('.awsui-tabs');
    if (parent && parent.id) updateTabPills(`#${parent.id}`, element);
  }
  applyFiltersAndSort();
}

export function selectKindTab(tab, element) {
  store.set({ loanwordOnly: tab === KANA_TABS.LOANWORD, invalidTerm: null });
  if (element) updateTabPills('#kind-tabs', element);
  applyFiltersAndSort();
}

export function selectSortField(field, element) {
  store.set({ currentSortField: field, invalidTerm: null });
  if (element) updateTabPills('#sort-field-tabs', element);
  applyFiltersAndSort();
}

export function selectSortOrder(order, element) {
  store.set({ currentSortOrder: order, invalidTerm: null });
  if (element) updateTabPills('#sort-order-tabs', element);
  applyFiltersAndSort();
}

function getDefaultSortField(col) {
  if (col?.hasHangulTabs) return SORT_FIELDS.TITLE;
  if (col?.hasKanaTabs ?? col?.hasReading) return SORT_FIELDS.STANDARD;
  return SORT_FIELDS.TITLE;
}

export function resetFineFilters() {
  const { currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId] || {};
  store.set({
    currentLengthTab: LENGTH_TABS.ALL,
    currentInitialTab: KANA_TABS.ALL,
    loanwordOnly: false,
    currentSortField: getDefaultSortField(col),
    currentSortOrder: SORT_ORDERS.ASC,
    invalidTerm: null
  });
  applyFiltersAndSort();
}

export function countActiveFineFilters() {
  const { currentLengthTab, currentInitialTab, loanwordOnly, currentSortField, currentSortOrder, currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId] || {};
  let count = 0;
  if (currentLengthTab && currentLengthTab !== LENGTH_TABS.ALL) count += 1;
  if (currentInitialTab && currentInitialTab !== KANA_TABS.ALL) count += 1;
  if (loanwordOnly) count += 1;
  if (currentSortField !== getDefaultSortField(col) || currentSortOrder !== SORT_ORDERS.ASC) count += 1;
  return count;
}

export function getFilterSummary() {
  const { currentLengthTab, currentInitialTab, loanwordOnly, currentSortField, currentSortOrder, currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId] || {};
  const parts = [];

  if (currentInitialTab && currentInitialTab !== KANA_TABS.ALL) {
    parts.push(KANA_RANGES[currentInitialTab] ? `${currentInitialTab}行` : currentInitialTab);
  }
  if (currentLengthTab && currentLengthTab !== LENGTH_TABS.ALL) {
    parts.push(currentLengthTab === LENGTH_TABS.FIVE_PLUS ? '5字+' : `${currentLengthTab}字`);
  }
  if (loanwordOnly) parts.push('外來語');

  const fieldLabel = currentSortField === SORT_FIELDS.ID
    ? '編號'
    : currentSortField === SORT_FIELDS.TITLE
      ? '標題'
      : currentSortField === SORT_FIELDS.SUBTITLE
        ? '副標'
        : '読み方';
  const orderLabel = currentSortOrder === SORT_ORDERS.DESC ? '倒序' : '正序';
  parts.push(`${fieldLabel} ${orderLabel}`);

  return parts.join(' · ');
}

export function syncFilterUi() {
  if (typeof document === 'undefined') return;

  const { currentLengthTab, currentInitialTab, loanwordOnly, currentSortField, currentSortOrder, pageSize } = store.get();
  activateTabByValue('#length-tabs', currentLengthTab || LENGTH_TABS.ALL);
  activateTabByValue('#hangul-tabs', currentInitialTab || KANA_TABS.ALL);
  activateTabByValue('#kana-initial-tabs', currentInitialTab || KANA_TABS.ALL);
  activateTabByValue('#kind-tabs', loanwordOnly ? KANA_TABS.LOANWORD : 'ALL');
  activateTabByValue('#sort-field-tabs', currentSortField || SORT_FIELDS.STANDARD);
  activateTabByValue('#sort-order-tabs', currentSortOrder || SORT_ORDERS.ASC);
  activateTabByValue('#page-size-tabs', pageSizeTabValue(pageSize));

  const pageSizeSelect = document.getElementById('pagesize-select');
  if (pageSizeSelect) pageSizeSelect.value = pageSizeTabValue(pageSize);

  const count = countActiveFineFilters();
  const badge = document.getElementById('filter-modal-badge');
  if (badge) {
    badge.innerText = String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  const summary = document.getElementById('filter-summary');
  if (summary) {
    summary.innerText = getFilterSummary();
  }

  const trigger = document.getElementById('btn-open-filter-modal');
  if (trigger) {
    trigger.classList.toggle('has-active-filters', count > 0);
  }
}

export function openFilterModal() {
  const modal = document.getElementById('filter-modal');
  if (!modal) return;
  syncFilterUi();
  modal.classList.add('open');
  document.getElementById('btn-open-filter-modal')?.classList.add('active');
}

export function closeFilterModal() {
  const modal = document.getElementById('filter-modal');
  if (modal) modal.classList.remove('open');
  document.getElementById('btn-open-filter-modal')?.classList.remove('active');
}

export function closeFilterModalOnBackdrop(e) {
  if (e?.target?.id === 'filter-modal') closeFilterModal();
}

export function applyFilterModal() {
  applyFiltersAndSort();
  closeFilterModal();
}
