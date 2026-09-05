/**
 * Filtering, Search, Kana Matching, and Sorting Engine
 */
import { store } from './state.js';
import { renderCards } from './components/cards.js';
import { getUnicodeLength } from './utils.js';

export function matchesKanaGroup(str, group) {
  if (!str) return false;
  const ch = str.charAt(0);
  const kanaRanges = {
    'あ': /^[あ-おア-オ]/,
    'か': /^[か-こが-ごカ-コガ-ゴ]/,
    'さ': /^[さ-そざ-ぞサ-ソザ-ゾ]/,
    'た': /^[た-とだ-どタ-トダ-ド]/,
    'な': /^[な-のナ-ノ]/,
    'は': /^[は-ほば-ぼぱ-ぽハ-ホバ-ボパ-ポ]/,
    'ま': /^[ま-もマ-モ]/,
    'や': /^[や-よヤ-ヨ]/,
    'ら': /^[ら-ろラ-ロ]/,
    'わ': /^[わ-んワ-ン]/
  };
  if (kanaRanges[group]) return kanaRanges[group].test(ch);
  return true;
}

export function applyFiltersAndSort() {
  const {
    allRecords,
    searchQuery,
    currentLengthTab,
    currentKanaTab
  } = store.get();

  let result = [...allRecords];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(r => 
      (r.ja_term && r.ja_term.toLowerCase().includes(q)) ||
      (r.reading && r.reading.toLowerCase().includes(q)) ||
      (r.tw_translation && r.tw_translation.toLowerCase().includes(q)) ||
      (r.id && r.id.toLowerCase().includes(q))
    );
  }

  if (currentLengthTab !== 'ALL') {
    result = result.filter(r => {
      const term = r.ja_term || '';
      const len = getUnicodeLength(term);
      if (currentLengthTab === '1') return len === 1;
      if (currentLengthTab === '2') return len === 2;
      if (currentLengthTab === '3') return len === 3;
      if (currentLengthTab === '4') return len === 4;
      if (currentLengthTab === '5+') return len >= 5;
      return true;
    });
  }

  if (currentKanaTab === 'RANDOM10') {
    if (!searchQuery) {
      if (result.some(r => r._rand10 === undefined)) {
        store.reshuffleRandom10();
      }
      result.sort((a, b) => (a._rand10 ?? 0) - (b._rand10 ?? 0));
      result = result.slice(0, 10);
    }
  } else if (currentKanaTab !== 'ALL') {
    result = result.filter(r => matchesKanaGroup(r.reading || r.ja_term, currentKanaTab));
  }

  const sortSelect = document.getElementById('sort-select');
  const sortType = sortSelect ? sortSelect.value : 'reading-asc';
  if (sortType === 'reading-asc') {
    result.sort((a, b) => (a.reading || a.ja_term).localeCompare(b.reading || b.ja_term, 'ja'));
  } else if (sortType === 'reading-desc') {
    result.sort((a, b) => (b.reading || b.ja_term).localeCompare(a.reading || a.ja_term, 'ja'));
  } else if (sortType === 'ja-asc') {
    result.sort((a, b) => a.ja_term.localeCompare(b.ja_term, 'ja'));
  } else if (sortType === 'ja-desc') {
    result.sort((a, b) => b.ja_term.localeCompare(a.ja_term, 'ja'));
  } else if (sortType === 'id-asc') {
    result.sort((a, b) => a.row_index - b.row_index);
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
  store.set({ searchQuery: query });
  applyFiltersAndSort();
}

export function onFilterChange() {
  applyFiltersAndSort();
}

export function selectKanaTab(tab, element) {
  if (tab === 'RANDOM10') {
    store.reshuffleRandom10();
  }
  store.set({ currentKanaTab: tab });

  const pills = document.querySelectorAll('#kana-tabs .awsui-tab');
  pills.forEach(p => p.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }

  applyFiltersAndSort();
}

export function selectLengthTab(tab, element) {
  store.set({ currentLengthTab: tab });

  const pills = document.querySelectorAll('#length-tabs .awsui-tab');
  pills.forEach(p => p.classList.remove('active'));
  if (element) {
    element.classList.add('active');
  }

  applyFiltersAndSort();
}
