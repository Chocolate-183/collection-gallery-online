/**
 * Filtering, Search, Kana Matching, and Sorting Engine
 */
import { KANA_RANGES, SORT_TYPES, KANA_TABS, LENGTH_TABS } from './constants.js';
import { store } from './state.js';
import { renderCards } from './components/cards.js';
import { getUnicodeLength } from './utils.js';

/**
 * Checks if a string starts with a kana character in the specified kana group.
 */
export function matchesKanaGroup(str, group) {
  if (!str) return false;
  const ch = str.charAt(0);
  const regex = KANA_RANGES[group];
  if (regex) return regex.test(ch);
  return true;
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
  return records.filter(r => {
    const term = r.ja_term || '';
    const len = getUnicodeLength(term);
    if (lengthTab === LENGTH_TABS.ONE) return len === 1;
    if (lengthTab === LENGTH_TABS.TWO) return len === 2;
    if (lengthTab === LENGTH_TABS.THREE) return len === 3;
    if (lengthTab === LENGTH_TABS.FOUR) return len === 4;
    if (lengthTab === LENGTH_TABS.FIVE_PLUS) return len >= 5;
    return true;
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
  } else {
    result = result.filter(r => matchesKanaGroup(r.reading || r.ja_term, kanaTab));
  }

  return result;
}

/**
 * Sorts records based on chosen sort option dropdown.
 */
export function sortRecords(records, sortType) {
  const result = [...records];
  if (sortType === SORT_TYPES.READING_ASC) {
    result.sort((a, b) => (a.reading || a.ja_term).localeCompare(b.reading || b.ja_term, 'ja'));
  } else if (sortType === SORT_TYPES.READING_DESC) {
    result.sort((a, b) => (b.reading || b.ja_term).localeCompare(a.reading || a.ja_term, 'ja'));
  } else if (sortType === SORT_TYPES.JA_ASC) {
    result.sort((a, b) => a.ja_term.localeCompare(b.ja_term, 'ja'));
  } else if (sortType === SORT_TYPES.JA_DESC) {
    result.sort((a, b) => b.ja_term.localeCompare(a.ja_term, 'ja'));
  } else if (sortType === SORT_TYPES.ID_ASC) {
    result.sort((a, b) => a.row_index - b.row_index);
  }
  return result;
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
  result = filterByKana(result, currentKanaTab, searchQuery);

  if (currentKanaTab !== KANA_TABS.LATEST10) {
    const sortSelect = document.getElementById('sort-select');
    const sortType = sortSelect ? sortSelect.value : SORT_TYPES.READING_ASC;
    result = sortRecords(result, sortType);
  }

  store.set({
    filteredRecords: result,
    currentPage: 1
  });

  renderCards();
}

export function onSearchInput() {
  const input = document.getElementById('search-input');
  const query = input ? input.value.trim() : '';
  store.set({ searchQuery: query, invalidTerm: null });
  applyFiltersAndSort();
}

export function onFilterChange() {
  applyFiltersAndSort();
}

export function selectKanaTab(tab, element) {
  if (tab === KANA_TABS.RANDOM10) {
    store.reshuffleRandom10();
  }
  store.set({ currentKanaTab: tab, invalidTerm: null });

  const pills = document.querySelectorAll('#kana-tabs .awsui-tab');
  pills.forEach(p => p.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }

  applyFiltersAndSort();
}

export function selectLengthTab(tab, element) {
  store.set({ currentLengthTab: tab, invalidTerm: null });

  const pills = document.querySelectorAll('#length-tabs .awsui-tab');
  pills.forEach(p => p.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }

  applyFiltersAndSort();
}
