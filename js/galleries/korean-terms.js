/**
 * C103 Hanja Hacks for Korean — gallery config (dataset wiring only).
 * Live hall metadata and opening hours come from the central spreadsheet.
 */
export default {
  id: 'korean-terms',
  name: '韓文單字加漢字 記憶更輕鬆',
  enTitle: 'Hanja Hacks for Korean',
  sheetId: '1J3tN8QV24FYi0ti4OFhNDDHE9jWhFq2c2s8LUQwp1VM',
  gid: '0',
  localFallback: 'korean-data.json',
  hasReading: true,
  hasKanaTabs: false,
  hasHangulTabs: true,
  hiddenColumnIndexes: [2, 3],
  searchPlaceholder: '尋找展品...',
  defaultMeta: {
    title: '韓文單字加漢字 記憶更輕鬆',
    enTitle: 'Hanja Hacks for Korean',
    id: 'C103',
    status: '開放中',
    announcement: 'COMING SOON',
    tags: ['韓語學習'],
    subtitle: 'COMING SOON',
    description: 'COMING SOON',
    notice: 'COMING SOON',
    timestamp: '2026-09-04'
  }
};
