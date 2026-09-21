/**
 * C103 中文母語者韓語單字集 — gallery config (dataset wiring only).
 * Live hall metadata and opening hours come from the central spreadsheet.
 */
export default {
  id: 'korean-terms',
  name: '中文母語者韓語單字集',
  enTitle: 'Korean Vocabulary for Chinese Speakers',
  sheetId: '1J3tN8QV24FYi0ti4OFhNDDHE9jWhFq2c2s8LUQwp1VM',
  gid: '168524304',
  localFallback: 'korean-data.json',
  hasReading: true,
  hasKanaTabs: false,
  hasHangulTabs: true,
  hiddenColumnIndexes: [2, 3],
  searchPlaceholder: '尋找展品...',
  defaultMeta: {
    title: '中文母語者韓語單字集',
    enTitle: 'Korean Vocabulary for Chinese Speakers',
    id: 'C103',
    status: '開放中',
    announcement: '',
    tags: ['韓語', '語彙'],
    subtitle: '籌備中',
    description: '你知道韓語以前也使用過漢字嗎？\n如果你懂漢字，背韓語單字會輕鬆很多！\n本單字集會依單字來源加上輔助標註：若是漢字詞，會標註對應漢字；若是源自英文的外來詞，則會標註英文。\n相信會對你很有幫助！',
    notice: '詞彙可能因地區或時間有所變化，僅供參考。',
    timestamp: '2026-09-18'
  }
};
