/**
 * Generic Data Parsers (CSV & Google GViz Response)
 */
import { collectionsConfig } from './config.js';
import { parseRecommendationList } from './utils.js';

const META_FIELD_DEFINITIONS = [
  { key: 'enTitle', match: k => k.includes('英文標題') || k.includes('en_title') || k.includes('entitle') },
  { key: 'title', match: k => k.includes('標題') || k.includes('展廳名') || k === 'name' },
  { key: 'tags', match: k => k.includes('標籤') || k.includes('tags'), transform: v => v.split(/[\n\r,，]/).map(t => t.trim()).filter(Boolean) },
  { key: 'subtitle', match: k => k.includes('副標') || k.includes('subtitle') },
  { key: 'description', match: k => k.includes('說明') || k.includes('description') },
  { key: 'notice', match: k => k.includes('注意事項') || k.includes('注意') || k.includes('notice') },
  { key: 'announcement', match: k => k.includes('公告') || k.includes('announcement') },
  { key: 'author', match: k => k.includes('作者') || k.includes('策劃') || k.includes('負責人') || k.includes('author') },
  { key: 'status', match: k => k.includes('狀態') || k.includes('status') },
  { key: 'id', match: k => k.toUpperCase() === 'ID' || k.includes('編號') || k.includes('序號') || k.includes('展廳id') },
  { key: 'timestamp', match: k => k.includes('時間') || k.includes('日期') || k.includes('timestamp') || k.includes('created') }
];

/**
 * Helper to construct metadata object from key-value pairs
 * @param {Array<[string, string]>} pairs - Array of [key, value] pairs
 * @returns {object|null} Structured metadata object or null if title is missing
 */
function extractMetadataFromKeyValues(pairs) {
  const meta = {
    title: '',
    enTitle: '',
    tags: [],
    subtitle: '',
    description: '',
    notice: '',
    announcement: '',
    author: '',
    status: '',
    id: '',
    timestamp: ''
  };

  for (const [rawKey, rawVal] of pairs) {
    const key = (rawKey || '').trim().toLowerCase();
    const val = (rawVal || '').trim();
    if (!key) continue;

    for (const def of META_FIELD_DEFINITIONS) {
      if (def.match(key)) {
        meta[def.key] = def.transform ? def.transform(val) : val;
        break;
      }
    }
  }

  return (meta.title || meta.id) ? meta : null;
}

/**
 * Finds standard column indexes for datasets from a list of header string titles.
 * hiddenColumnIndexes (0-based) are never used for title / reading / meaning.
 */
function findDatasetColumnIndexes(headerTitles, options = {}) {
  const hidden = new Set((options.hiddenColumnIndexes || []).map(Number).filter(n => Number.isInteger(n) && n >= 0));
  const headers = headerTitles.map(h => (h || '').toLowerCase());
  const isRecommendHeader = (h) => h.includes('recommend') || h.includes('推薦') || h.includes('推荐');
  const findIdx = (pred) => headers.findIndex((h, i) => !hidden.has(i) && pred(h));
  const firstVisible = (start) => {
    for (let i = start; i < headers.length; i++) {
      if (!hidden.has(i)) return i;
    }
    return -1;
  };

  let idIdx = findIdx(h => h.includes('id') || h.includes('編號') || h.includes('序號'));
  let termIdx = findIdx(h => !isRecommendHeader(h) && (h.includes('title') || h.includes('term') || h.includes('name') || h.includes('顯示') || h.includes('日語') || h.includes('大陆') || h.includes('大陸') || h.includes('詞彙') || h.includes('用語') || h.includes('標題') || h.includes('項目')));
  let twIdx = findIdx(h => !isRecommendHeader(h) && (h.includes('content') || h.includes('meaning') || h.includes('description') || h.includes('translation') || h.includes('台灣') || h.includes('意思') || h.includes('對應') || h.includes('翻譯') || h.includes('說明') || h.includes('內容')));
  let readingIdx = findIdx(h => h.includes('reading') || h.includes('subtitle') || h.includes('phonetic') || h.includes('假名') || h.includes('標音') || h.includes('讀音') || h.includes('発音') || h.includes('發音') || h.includes('読み') || h.includes('音素'));
  let dateIdx = findIdx(h => h.includes('date') || h.includes('created') || h.includes('日期') || h.includes('時間'));
  let recommendIdx = findIdx(h => isRecommendHeader(h));

  if (idIdx === -1) idIdx = firstVisible(0);
  if (termIdx === -1) termIdx = firstVisible(idIdx >= 0 ? idIdx + 1 : 0);
  if (twIdx === -1) twIdx = firstVisible((termIdx >= 0 ? termIdx + 1 : 0));

  return { idIdx, termIdx, twIdx, readingIdx, dateIdx, recommendIdx };
}

function getHiddenColumnIndexes(currentCollectionId) {
  const col = currentCollectionId ? collectionsConfig[currentCollectionId] : null;
  return col?.hiddenColumnIndexes || [];
}

/**
 * Parses raw CSV text into a 2D array of string cells, preserving multiline values in quotes.
 * @param {string} csvText - Raw CSV content
 * @returns {string[][]} Array of row cell arrays
 */
export function parseCSVRows(csvText) {
  if (!csvText) return [];

  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal);
      currentVal = '';
      if (currentRow.some(c => c.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    if (currentRow.some(c => c.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Extracts google.visualization table object from GViz response text.
 * @param {string} gvizText - Raw GViz endpoint response
 * @returns {object|null} GViz table object
 */
export function extractGvizTable(gvizText) {
  if (!gvizText) return null;
  try {
    const jsonMatch = gvizText.match(/google\.visualization\.Query\.setResponse\((.*?)\);/s);
    if (!jsonMatch) return null;
    const json = JSON.parse(jsonMatch[1]);
    return (json?.table?.rows) ? json.table : null;
  } catch {
    return null;
  }
}

/**
 * Helper to construct a standard record object if valid.
 */
function createRecord({ id, ja, tw, reading, created_at, rawRecommend, rowIndex }) {
  if (!ja || ja === '日語用詞' || ja === '大陆' || ja === '大陸' || ja === '顯示' || ja.toLowerCase() === 'title' || ja.toLowerCase() === 'term') {
    return null;
  }

  return {
    id: id || `ROW-${rowIndex}`,
    ja_term: ja,
    tw_translation: tw,
    reading: reading || '',
    created_at: created_at || '',
    recommendations: parseRecommendationList(rawRecommend),
    row_index: rowIndex
  };
}

/**
 * Parses CSV dataset into standard collection records.
 */
export function parseCSVData(csvText, currentCollectionId) {
  const rows = parseCSVRows(csvText);
  if (rows.length <= 1) return null;

  const { idIdx, termIdx, twIdx, readingIdx, dateIdx, recommendIdx } = findDatasetColumnIndexes(
    rows[0],
    { hiddenColumnIndexes: getHiddenColumnIndexes(currentCollectionId) }
  );

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length >= 2) {
      const id = cols[idIdx] ? cols[idIdx].trim() : `ROW-${i}`;
      const ja = cols[termIdx] ? cols[termIdx].trim() : '';
      const tw = cols[twIdx] ? cols[twIdx].trim() : '';
      const reading = (readingIdx !== -1 && cols[readingIdx]) ? cols[readingIdx].trim() : '';
      const created_at = (dateIdx !== -1 && cols[dateIdx]) ? cols[dateIdx].trim() : '';
      const rawRecommend = (recommendIdx !== -1 && cols[recommendIdx]) ? cols[recommendIdx].trim() : '';

      const record = createRecord({ id, ja, tw, reading, created_at, rawRecommend, rowIndex: i });
      if (record) results.push(record);
    }
  }
  return results;
}

/**
 * Parses GViz response text into standard collection records.
 */
export function parseGvizResponse(gvizText, currentCollectionId) {
  const table = extractGvizTable(gvizText);
  if (!table) return null;

  let idIdx = 0, termIdx = 1, twIdx = 2, readingIdx = -1, dateIdx = -1, recommendIdx = -1;
  if (table.cols && table.cols.length > 0) {
    const colsHeader = table.cols.map(col => col?.label || '');
    const found = findDatasetColumnIndexes(colsHeader, {
      hiddenColumnIndexes: getHiddenColumnIndexes(currentCollectionId)
    });
    idIdx = found.idIdx;
    termIdx = found.termIdx;
    twIdx = found.twIdx;
    readingIdx = found.readingIdx;
    dateIdx = found.dateIdx;
    recommendIdx = found.recommendIdx;
  } else {
    const colConfig = collectionsConfig[currentCollectionId];
    if (colConfig?.hasReading) {
      readingIdx = 3;
      dateIdx = 4;
      recommendIdx = 5;
    } else {
      readingIdx = -1;
      dateIdx = 3;
      recommendIdx = 4;
    }
  }

  const results = [];
  table.rows.forEach((r, idx) => {
    const c = r.c;
    if (!c) return;
    const rowIndex = idx + 1;
    const id = (idIdx >= 0 && c[idIdx]) ? (c[idIdx].v || '').toString().trim() : `ROW-${rowIndex}`;
    const ja = (termIdx >= 0 && c[termIdx]) ? (c[termIdx].v || '').toString().trim() : '';
    const tw = (twIdx >= 0 && c[twIdx]) ? (c[twIdx].v || '').toString().trim() : '';
    const reading = (readingIdx >= 0 && c[readingIdx]) ? (c[readingIdx].v || '').toString().trim() : '';
    const created_at = (dateIdx >= 0 && c[dateIdx]) ? (c[dateIdx].v || c[dateIdx].f || '').toString().trim() : '';
    const rawRecommend = (recommendIdx >= 0 && c[recommendIdx]) ? (c[recommendIdx].v || c[recommendIdx].f || '').toString().trim() : '';

    const record = createRecord({ id, ja, tw, reading, created_at, rawRecommend, rowIndex });
    if (record) results.push(record);
  });
  return results;
}

/**
 * Matches a parsed metadata object to a collection ID registered in collectionsConfig.
 * @param {object} meta - Parsed metadata object containing title, id, etc.
 * @returns {string|null} Matched collection ID (e.g. 'japanese-terms', 'china-terms') or null
 */
export function matchCollectionIdForMeta(meta) {
  if (!meta) return null;

  for (const [colId, col] of Object.entries(collectionsConfig)) {
    // 1. Match by ID (e.g. 'C101', 'C102', 'C103')
    if (meta.id && (meta.id === col.id || meta.id === col.defaultMeta?.id)) {
      return colId;
    }
    // 2. Match by title or name (e.g. '日本特色詞彙', '大陸特色詞彙', '最強韓文漢字學習法')
    if (meta.title && (meta.title === col.name || meta.title === col.defaultMeta?.title)) {
      return colId;
    }
  }

  // Fallback: direct match if meta.id is equal to col.id key or formatted
  if (meta.id) {
    if (collectionsConfig[meta.id]) return meta.id;
    return meta.id.toLowerCase();
  }

  return null;
}

/**
 * Helper to process matrix rows or 2-column key-value rows into collection metadata.
 */
function parseMetadataMatrixRows(rows) {
  if (!rows || rows.length === 0) return {};

  const results = {};
  const maxCols = Math.max(...rows.map(r => r.length));

  const processPairs = (pairs) => {
    const meta = extractMetadataFromKeyValues(pairs);
    if (meta) {
      const matchedColId = matchCollectionIdForMeta(meta);
      if (matchedColId) {
        results[matchedColId] = meta;
      }
    }
  };

  if (maxCols > 2) {
    for (let colIdx = 1; colIdx < maxCols; colIdx++) {
      const pairs = [];
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (row.length > colIdx) {
          pairs.push([row[0], row[colIdx]]);
        }
      }
      processPairs(pairs);
    }
  } else {
    const pairs = rows.filter(row => row.length >= 2).map(row => [row[0], row[1]]);
    processPairs(pairs);
  }

  return results;
}

/**
 * Parses CSV text containing metadata for one or more exhibition halls.
 * Supports matrix format and legacy 2-column key-value format.
 */
export function parseAllCollectionsMetaCSVData(csvText) {
  return parseMetadataMatrixRows(parseCSVRows(csvText));
}

/**
 * Parses GViz response containing metadata for one or more exhibition halls.
 */
export function parseAllCollectionsMetaGvizResponse(gvizText) {
  const table = extractGvizTable(gvizText);
  if (!table) return {};

  const rows = [];
  if (table.cols?.length > 0) {
    const headerRow = table.cols.map(col => col?.label || '');
    if (headerRow.some(Boolean)) {
      rows.push(headerRow);
    }
  }

  if (table.rows) {
    table.rows.forEach(r => {
      if (!r.c) return;
      const rowVals = r.c.map(cell => (cell && cell.v !== null && cell.v !== undefined) ? (cell.v || cell.f || '').toString() : '');
      rows.push(rowVals);
    });
  }

  return parseMetadataMatrixRows(rows);
}

/**
 * Parses key-value pairs from metadata CSV sheets.
 */
export function parseMetaCSVData(csvText) {
  const allMeta = parseAllCollectionsMetaCSVData(csvText);
  const first = Object.values(allMeta)[0];
  if (first) return first;

  const rows = parseCSVRows(csvText);
  if (rows.length === 0) return null;
  return extractMetadataFromKeyValues(rows.filter(r => r.length >= 2).map(r => [r[0], r[1]]));
}

/**
 * Parses opening hours schedule from CSV content.
 * @param {string} csvText - Raw CSV content
 * @returns {Array<{day: string, hours: string}>|null} Array of 7 day schedule items
 */
export function parseOpeningHoursCSV(csvText) {
  const rows = parseCSVRows(csvText);
  if (!rows || rows.length < 2) return null;

  const dayMap = {
    '週日': 0, '星期日': 0, '禮拜日': 0, '0': 0, 'sun': 0, 'sunday': 0,
    '週一': 1, '星期一': 1, '禮拜一': 1, '1': 1, 'mon': 1, 'monday': 1,
    '週二': 2, '星期二': 2, '禮拜二': 2, '2': 2, 'tue': 2, 'tuesday': 2,
    '週三': 3, '星期三': 3, '禮拜三': 3, '3': 3, 'wed': 3, 'wednesday': 3,
    '週四': 4, '星期四': 4, '禮拜四': 4, '4': 4, 'thu': 4, 'thursday': 4,
    '週五': 5, '星期五': 5, '禮拜五': 5, '5': 5, 'fri': 5, 'friday': 5,
    '週六': 6, '星期六': 6, '禮拜六': 6, '6': 6, 'sat': 6, 'saturday': 6
  };

  const schedule = [
    { day: '週日', hours: '16:00 - 23:55' },
    { day: '週一', hours: '01:00 - 23:55' },
    { day: '週二', hours: '01:00 - 23:55' },
    { day: '週三', hours: '01:00 - 23:55' },
    { day: '週四', hours: '01:00 - 23:55' },
    { day: '週五', hours: '06:00 - 23:55' },
    { day: '週六', hours: '06:00 - 23:55' }
  ];

  let hasValidRow = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    const dayRaw = (row[0] || '').trim().toLowerCase();
    const hours = (row[1] || '').trim();

    const idx = dayMap[dayRaw];
    if (idx !== undefined && hours) {
      schedule[idx].hours = hours;
      hasValidRow = true;
    }
  }

  return hasValidRow ? schedule : null;
}
