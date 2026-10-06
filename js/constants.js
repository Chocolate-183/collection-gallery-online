/**
 * Centralized Application Constants & Enums
 */

export const VIEWS = {
  WELCOME: 'welcome',
  DICTIONARY: 'dictionary',
  ABOUT: 'about',
  STATS: 'stats',
  MAINTENANCE: 'maintenance'
};

export const SORT_TYPES = {
  READING_ASC: 'reading-asc',
  READING_DESC: 'reading-desc',
  JA_ASC: 'ja-asc',
  JA_DESC: 'ja-desc',
  ID_ASC: 'id-asc'
};

export const SORT_FIELDS = {
  ID: 'id',
  TITLE: 'title',
  STANDARD: 'standard',
  SUBTITLE: 'subtitle',
  RANDOM: 'random',
  CREATED_AT: 'created_at'
};

export const SORT_ORDERS = {
  ASC: 'asc',
  DESC: 'desc'
};

export const KANA_TABS = {
  ALL: 'ALL',
  LOANWORD: 'LOANWORD'
};

export const CATEGORY_TABS = {
  ALL: 'ALL',
  BASIC100: 'BASIC100',
  PERSON: '人名',
  GROUP: '團體名',
  COMPANY: '公司名'
};

/** C103 詞源 (sheet H). */
export const ETYMOLOGY_TABS = {
  ALL: 'ALL',
  HANJA: '漢字語',
  LOANWORD: '外來語',
  NATIVE: '固有語',
  HYBRID: '混種語'
};

/** C103 詞性 (sheet I). */
export const POS_TABS = {
  ALL: 'ALL',
  NOUN: '名詞',
  VERB: '動詞',
  ADJECTIVE: '形容詞',
  ADVERB: '副詞',
  INTERJECTION: '感嘆詞',
  DETERMINER: '冠形詞',
  PRONOUN: '代名詞',
  COUNTER: '量詞',
  NUMERAL: '數詞',
  BOUND_NOUN: '依存名詞'
};

/** Filter POS pills shown before more. */
export const POS_PRIMARY_TABS = [
  POS_TABS.ALL,
  POS_TABS.NOUN,
  POS_TABS.VERB,
  POS_TABS.ADJECTIVE,
  POS_TABS.ADVERB
];

/** Filter POS pills revealed by more. */
export const POS_EXTRA_TABS = [
  POS_TABS.INTERJECTION,
  POS_TABS.DETERMINER,
  POS_TABS.PRONOUN,
  POS_TABS.COUNTER,
  POS_TABS.NUMERAL,
  POS_TABS.BOUND_NOUN
];

/** C103 Level (sheet J). */
export const LEVEL_TABS = {
  ALL: 'ALL',
  BEGINNER: '初級',
  INTERMEDIATE: '中級',
  ADVANCED: '高級'
};

export const BASIC100_TAG = '基礎100';

/** C103 sheet J name-class tags (Filter Category + Item Modal). */
export const NAME_CATEGORY_TAGS = [
  CATEGORY_TABS.PERSON,
  CATEGORY_TABS.GROUP,
  CATEGORY_TABS.COMPANY
];

export const FILTER_CATEGORY_TAGS = [BASIC100_TAG, ...NAME_CATEGORY_TAGS];

export function categoryTabToTag(tab) {
  if (!tab || tab === CATEGORY_TABS.ALL) return null;
  return tab === CATEGORY_TABS.BASIC100 ? BASIC100_TAG : tab;
}

export const QUICK_FILTERS = {
  ALL: 'ALL',
  LATEST10: 'LATEST10',
  RANDOM10: 'RANDOM10',
  BASIC100: 'BASIC100'
};

export const LENGTH_TABS = {
  ALL: 'ALL',
  ONE: '1',
  TWO: '2',
  THREE: '3',
  FOUR: '4',
  FIVE_PLUS: '5+'
};

export const PAGE_SIZE_ALL = 9999;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, PAGE_SIZE_ALL];
export const DEFAULT_PAGE_SIZE = 10;

export function resolvePageSize(value) {
  if (value === 'all' || value === 'ALL' || value === String(PAGE_SIZE_ALL)) return PAGE_SIZE_ALL;
  const n = parseInt(value, 10);
  if (PAGE_SIZE_OPTIONS.includes(n)) return n;
  return DEFAULT_PAGE_SIZE;
}

export function pageSizeTabValue(pageSize) {
  const n = resolvePageSize(pageSize);
  return n >= PAGE_SIZE_ALL ? 'all' : String(n);
}

export const STORAGE_KEYS = {
  THEME: 'aws_theme',
  SIDEBAR_COLLAPSED: 'aws_sidebar_collapsed'
};

export const DEFAULT_TIMEOUT_MS = 2500;

export const EXHIBITION_STATUS = {
  ADJUSTING: 'ADJUSTING',
  OPEN: '開放中',
  PREPARING: 'COMING SOON',
  HIDDEN: '不顯示'
};

export const KANA_RANGES = {
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

/** C103 초성 tabs (ㄱ ㄴ … ㅎ; ㄲ/ㄸ/ㅃ/ㅆ/ㅉ fold into ㄱ/ㄷ/ㅂ/ㅅ/ㅈ). */
export const HANGUL_INITIAL_TABS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const HANGUL_SYLLABLE_BASE = 0xAC00;
const HANGUL_VOWEL_COUNT = 21;
const HANGUL_FINAL_COUNT = 28;

/** Unicode 초성 index 0–18 → ㄱㄴㄷ tab. */
export const HANGUL_INITIAL_INDEX_TO_TAB = [
  'ㄱ', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅂ', 'ㅅ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

export const HANGUL_SYLLABLE = {
  BASE: HANGUL_SYLLABLE_BASE,
  END: 0xD7A3,
  VOWEL_COUNT: HANGUL_VOWEL_COUNT,
  FINAL_COUNT: HANGUL_FINAL_COUNT
};

export const DEFAULT_OPENING_HOURS = [
  { day: '週日', hours: '00:01 - 23:59' },
  { day: '週一', hours: '00:01 - 23:59' },
  { day: '週二', hours: '00:01 - 23:59' },
  { day: '週三', hours: '00:01 - 23:59' },
  { day: '週四', hours: '00:01 - 23:59' },
  { day: '週五', hours: '00:01 - 23:59' },
  { day: '週六', hours: '00:01 - 23:59' }
];
