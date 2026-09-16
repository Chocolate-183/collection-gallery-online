/**
 * Filtering, Search, Kana Matching, and Sorting Engine
 */
import { KANA_RANGES, SORT_TYPES, KANA_TABS, LENGTH_TABS, HANGUL_INITIAL_TABS, HANGUL_INITIAL_INDEX_TO_TAB, HANGUL_SYLLABLE } from './constants.js';
import { store } from './state.js';
import { renderCards } from './components/cards.js';
import { getExhibitFilterLength } from './utils.js';

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
 * First 가나다 tab for a Hangul string (C103). Uses the first syllable's 초성.
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
 * Checks if a string's first Hangul syllable belongs to a 가나다 tab (e.g. 가).
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
  } else if (HANGUL_INITIAL_TABS.includes(kanaTab)) {
    result = result.filter(r => matchesHangulInitial(r.reading || r.ja_term, kanaTab));
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
  updateTabPills('#length-tabs', element);
  applyFiltersAndSort();
}
