/**
 * Generic Data Parsers (CSV & Google GViz Response)
 */
import { collectionsConfig } from './config.js';

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
    id: ''
  };

  for (const [rawKey, rawVal] of pairs) {
    const key = (rawKey || '').trim();
    const val = (rawVal || '').trim();
    if (!key) continue;

    if (key.includes('英文標題') || key.includes('en_title') || key.includes('enTitle')) {
      meta.enTitle = val;
    } else if (key.includes('標題') || key.includes('展廳名') || key === 'name') {
      meta.title = val;
    } else if (key.includes('標籤') || key.includes('tags')) {
      meta.tags = val.split(/[\n\r,，]/).map(t => t.trim()).filter(Boolean);
    } else if (key.includes('副標') || key.includes('subtitle')) {
      meta.subtitle = val;
    } else if (key.includes('說明') || key.includes('description')) {
      meta.description = val;
    } else if (key.includes('注意事項') || key.includes('注意') || key.includes('notice')) {
      meta.notice = val;
    } else if (key.includes('公告') || key.includes('announcement')) {
      meta.announcement = val;
    } else if (key.includes('作者') || key.includes('策劃') || key.includes('負責人') || key.includes('author')) {
      meta.author = val;
    } else if (key.includes('狀態') || key.includes('status')) {
      meta.status = val;
    } else if (key.toUpperCase() === 'ID' || key.includes('編號') || key.includes('序號') || key.includes('展廳ID')) {
      meta.id = val;
    }
  }

  return (meta.title || meta.id) ? meta : null;
}

/**
 * Finds standard column indexes for datasets from a list of header string titles.
 */
function findDatasetColumnIndexes(headerTitles) {
  const headers = headerTitles.map(h => (h || '').toLowerCase());
  const isRecommendHeader = (h) => h.includes('recommend') || h.includes('推薦') || h.includes('推荐');

  let idIdx = headers.findIndex(h => h.includes('id') || h.includes('編號') || h.includes('序號'));
  let termIdx = headers.findIndex(h => !isRecommendHeader(h) && (h.includes('title') || h.includes('term') || h.includes('name') || h.includes('日語') || h.includes('大陆') || h.includes('大陸') || h.includes('詞彙') || h.includes('用語') || h.includes('標題') || h.includes('項目')));
  let twIdx = headers.findIndex(h => !isRecommendHeader(h) && (h.includes('content') || h.includes('meaning') || h.includes('description') || h.includes('translation') || h.includes('台灣') || h.includes('意思') || h.includes('對應') || h.includes('翻譯') || h.includes('說明') || h.includes('內容')));
  let readingIdx = headers.findIndex(h => h.includes('reading') || h.includes('subtitle') || h.includes('phonetic') || h.includes('假名') || h.includes('標音') || h.includes('讀音') || h.includes('読み') || h.includes('音素'));
  let dateIdx = headers.findIndex(h => h.includes('date') || h.includes('created') || h.includes('日期') || h.includes('時間'));
  let recommendIdx = headers.findIndex(h => isRecommendHeader(h));

  if (idIdx === -1) idIdx = 0;
  if (termIdx === -1) termIdx = 1;
  if (twIdx === -1) twIdx = 2;

  return { idIdx, termIdx, twIdx, readingIdx, dateIdx, recommendIdx };
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
    return (json && json.table && json.table.rows) ? json.table : null;
  } catch (e) {
    return null;
  }
}

/**
 * Parses CSV dataset into standard collection records.
 */
export function parseCSVData(csvText) {
  const rows = parseCSVRows(csvText);
  if (rows.length <= 1) return null;

  const { idIdx, termIdx, twIdx, readingIdx, dateIdx, recommendIdx } = findDatasetColumnIndexes(rows[0]);

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
      const recommendations = rawRecommend
        ? rawRecommend.replace(/<br\s*\/?>/gi, '\n').split(/[\n\r,，、;；]/).map(s => s.trim()).filter(Boolean)
        : [];

      if (ja && ja !== '日語用詞' && ja !== '大陆' && ja !== '大陸' && ja.toLowerCase() !== 'title' && ja.toLowerCase() !== 'term') {
        results.push({
          id: id || `ROW-${i}`,
          ja_term: ja,
          tw_translation: tw,
          reading: reading,
          created_at: created_at,
          recommendations: recommendations,
          row_index: i
        });
      }
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
    const colsHeader = table.cols.map(col => (col && col.label) || '');
    const found = findDatasetColumnIndexes(colsHeader);
    idIdx = found.idIdx;
    termIdx = found.termIdx;
    twIdx = found.twIdx;
    readingIdx = found.readingIdx;
    dateIdx = found.dateIdx;
    recommendIdx = found.recommendIdx;
  } else {
    const colConfig = collectionsConfig[currentCollectionId];
    if (colConfig && colConfig.hasReading) {
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
    const id = (idIdx >= 0 && c[idIdx]) ? (c[idIdx].v || '').toString().trim() : `ROW-${idx + 1}`;
    const ja = (termIdx >= 0 && c[termIdx]) ? (c[termIdx].v || '').toString().trim() : '';
    const tw = (twIdx >= 0 && c[twIdx]) ? (c[twIdx].v || '').toString().trim() : '';
    const reading = (readingIdx >= 0 && c[readingIdx]) ? (c[readingIdx].v || '').toString().trim() : '';
    const created_at = (dateIdx >= 0 && c[dateIdx]) ? (c[dateIdx].v || c[dateIdx].f || '').toString().trim() : '';
    const rawRecommend = (recommendIdx >= 0 && c[recommendIdx]) ? (c[recommendIdx].v || c[recommendIdx].f || '').toString().trim() : '';
    const recommendations = rawRecommend
      ? rawRecommend.replace(/<br\s*\/?>/gi, '\n').split(/[\n\r,，、;；]/).map(s => s.trim()).filter(Boolean)
      : [];

    if (ja && ja !== '日語用詞' && ja !== '大陆' && ja !== '大陸' && ja.toLowerCase() !== 'title' && ja.toLowerCase() !== 'term') {
      results.push({
        id: id || `ROW-${idx + 1}`,
        ja_term: ja,
        tw_translation: tw,
        reading: reading,
        created_at: created_at,
        recommendations: recommendations,
        row_index: idx + 1
      });
    }
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
    if (meta.id && (meta.id === col.id || (col.defaultMeta && meta.id === col.defaultMeta.id))) {
      return colId;
    }
    // 2. Match by title or name (e.g. '日本特色詞彙', '大陸特色詞彙', '最強韓文漢字學習法')
    if (meta.title && (meta.title === col.name || (col.defaultMeta && meta.title === col.defaultMeta.title))) {
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
 * Parses CSV text containing metadata for one or more exhibition halls.
 * Supports matrix format (rows = attribute keys, columns = exhibition halls)
 * as well as legacy 2-column key-value format.
 * @param {string} csvText - Raw CSV content
 * @returns {Object.<string, object>} Map of colId -> metadata object
 */
export function parseAllCollectionsMetaCSVData(csvText) {
  const rows = parseCSVRows(csvText);
  if (!rows || rows.length === 0) return {};

  const results = {};
  const maxCols = Math.max(...rows.map(r => r.length));

  if (maxCols > 2) {
    // Matrix format: each column index >= 1 represents one exhibition hall
    for (let colIdx = 1; colIdx < maxCols; colIdx++) {
      const pairs = [];
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (row.length > colIdx) {
          pairs.push([row[0], row[colIdx]]);
        }
      }
      const meta = extractMetadataFromKeyValues(pairs);
      if (meta) {
        const matchedColId = matchCollectionIdForMeta(meta);
        if (matchedColId) {
          results[matchedColId] = meta;
        }
      }
    }
  } else {
    // 2-column key-value format (Col 0 = key, Col 1 = value)
    const pairs = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2) {
        pairs.push([row[0], row[1]]);
      }
    }
    const meta = extractMetadataFromKeyValues(pairs);
    if (meta) {
      const matchedColId = matchCollectionIdForMeta(meta);
      if (matchedColId) {
        results[matchedColId] = meta;
      }
    }
  }

  return results;
}

/**
 * Parses GViz response containing metadata for one or more exhibition halls.
 * @param {string} gvizText - Raw GViz endpoint response
 * @returns {Object.<string, object>} Map of colId -> metadata object
 */
export function parseAllCollectionsMetaGvizResponse(gvizText) {
  const table = extractGvizTable(gvizText);
  if (!table) return {};

  const rows = [];
  if (table.cols && table.cols.length > 0) {
    const headerRow = table.cols.map(col => (col && col.label) || '');
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

  if (rows.length === 0) return {};

  const results = {};
  const maxCols = Math.max(...rows.map(r => r.length));

  if (maxCols > 2) {
    for (let colIdx = 1; colIdx < maxCols; colIdx++) {
      const pairs = [];
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (row.length > colIdx) {
          pairs.push([row[0], row[colIdx]]);
        }
      }
      const meta = extractMetadataFromKeyValues(pairs);
      if (meta) {
        const matchedColId = matchCollectionIdForMeta(meta);
        if (matchedColId) {
          results[matchedColId] = meta;
        }
      }
    }
  } else {
    const pairs = [];
    rows.forEach(row => {
      if (row.length >= 2) pairs.push([row[0], row[1]]);
    });
    const meta = extractMetadataFromKeyValues(pairs);
    if (meta) {
      const matchedColId = matchCollectionIdForMeta(meta);
      if (matchedColId) {
        results[matchedColId] = meta;
      }
    }
  }

  return results;
}

/**
 * Parses key-value pairs from metadata CSV sheets.
 */
export function parseMetaCSVData(csvText) {
  const allMeta = parseAllCollectionsMetaCSVData(csvText);
  const keys = Object.keys(allMeta);
  if (keys.length > 0) {
    return allMeta[keys[0]];
  }

  const rows = parseCSVRows(csvText);
  if (rows.length === 0) return null;
  const pairs = rows.filter(r => r.length >= 2).map(r => [r[0], r[1]]);
  return extractMetadataFromKeyValues(pairs);
}

/**
 * Parses key-value pairs from metadata GViz responses.
 */
export function parseMetaGvizResponse(gvizText) {
  const allMeta = parseAllCollectionsMetaGvizResponse(gvizText);
  const keys = Object.keys(allMeta);
  if (keys.length > 0) {
    return allMeta[keys[0]];
  }

  const table = extractGvizTable(gvizText);
  if (!table) return null;

  const pairs = [];
  table.rows.forEach(r => {
    if (r.c && r.c.length >= 2) {
      const k = (r.c[0] && (r.c[0].v !== null && r.c[0].v !== undefined) ? r.c[0].v : '').toString();
      const v = (r.c[1] && (r.c[1].v || r.c[1].f) ? (r.c[1].v || r.c[1].f) : '').toString();
      pairs.push([k, v]);
    }
  });

  return extractMetadataFromKeyValues(pairs);
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
