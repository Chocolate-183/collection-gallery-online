/**
 * Centralized Application Constants & Enums
 */

export const VIEWS = {
  WELCOME: 'welcome',
  DICTIONARY: 'dictionary',
  ABOUT: 'about',
  MAINTENANCE: 'maintenance'
};

export const SORT_TYPES = {
  READING_ASC: 'reading-asc',
  READING_DESC: 'reading-desc',
  JA_ASC: 'ja-asc',
  JA_DESC: 'ja-desc',
  ID_ASC: 'id-asc'
};

export const KANA_TABS = {
  ALL: 'ALL',
  RANDOM10: 'RANDOM10',
  LATEST10: 'LATEST10'
};

export const LENGTH_TABS = {
  ALL: 'ALL',
  ONE: '1',
  TWO: '2',
  THREE: '3',
  FOUR: '4',
  FIVE_PLUS: '5+'
};

export const STORAGE_KEYS = {
  THEME: 'aws_theme',
  SIDEBAR_COLLAPSED: 'aws_sidebar_collapsed'
};

export const DEFAULT_TIMEOUT_MS = 2500;

export const EXHIBITION_STATUS = {
  ADJUSTING: '調整中',
  OPEN: '開放中'
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

export const DEFAULT_OPENING_HOURS = [
  { day: '週日', hours: '16:00 - 23:55' },
  { day: '週一', hours: '01:00 - 23:55' },
  { day: '週二', hours: '01:00 - 23:55' },
  { day: '週三', hours: '01:00 - 23:55' },
  { day: '週四', hours: '01:00 - 23:55' },
  { day: '週五', hours: '06:00 - 23:55' },
  { day: '週六', hours: '06:00 - 23:55' }
];
