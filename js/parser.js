/**
 * Generic Data Parsers (CSV & Google GViz Response)
 */
import { collectionsConfig } from './config.js';
import { DEFAULT_OPENING_HOURS } from './constants.js';
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
  { key: 'timestamp', match: k => !isOpeningHoursMetaKey(k) && (k.includes('新增日期') || k.includes('timestamp') || k.includes('created') || k.includes('日期') || k.includes('時間')) }
];

const DAY_INDEX_MAP = {
  '週日': 0, '星期日': 0, '禮拜日': 0, '0': 0, 'sun': 0, 'sunday': 0,
  '週一': 1, '星期一': 1, '禮拜一': 1, '1': 1, 'mon': 1, 'monday': 1,
  '週二': 2, '星期二': 2, '禮拜二': 2, '2': 2, 'tue': 2, 'tuesday': 2,
  '週三': 3, '星期三': 3, '禮拜三': 3, '3': 3, 'wed': 3, 'wednesday': 3,
  '週四': 4, '星期四': 4, '禮拜四': 4, '4': 4, 'thu': 4, 'thursday': 4,
  '週五': 5, '星期五': 5, '禮拜五': 5, '5': 5, 'fri': 5, 'friday': 5,
  '週六': 6, '星期六': 6, '禮拜六': 6, '6': 6, 'sat': 6, 'saturday': 6
};

function isOpeningHoursMetaKey(key) {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return false;
  if (DAY_INDEX_MAP[k] !== undefined) return true;
  return k.includes('開館') || k.includes('開放時間') || k.includes('參觀時間') || k.includes('opening');
}

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
  const subtitleIdx = headers.findIndex(h => h.includes('副標') || h === 'subtitle' || h.includes('gloss'));

  if (idIdx === -1) idIdx = firstVisible(0);
  if (termIdx === -1) termIdx = firstVisible(idIdx >= 0 ? idIdx + 1 : 0);
  if (twIdx === -1) twIdx = firstVisible((termIdx >= 0 ? termIdx + 1 : 0));

  return { idIdx, termIdx, twIdx, readingIdx, dateIdx, recommendIdx, subtitleIdx };
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

function gvizCellText(cell) {
  if (!cell || cell.v === null || cell.v === undefined) return '';
  return (cell.v || cell.f || '').toString();
}

/** Flattens a GViz table into string rows (optional header + cell values). */
export function gvizTableToRows(table) {
  if (!table) return [];
  const rows = [];
  if (table.cols?.length > 0) {
    const headerRow = table.cols.map(col => col?.label || '');
    if (headerRow.some(Boolean)) rows.push(headerRow);
  }
  if (table.rows) {
    table.rows.forEach(r => {
      if (!r.c) return;
      rows.push(r.c.map(gvizCellText));
    });
  }
  return rows;
}

/**
 * Formats exhibit IDs to the C101 display pattern, e.g. #C101-1047.
 * GViz numeric cells often expose v=1047 / f="#C101-1047"; prefer the formatted value.
 */
function formatExhibitId(rawId, currentCollectionId) {
  const text = rawId == null ? '' : String(rawId).trim();
  if (!text) return '';
  if (text.startsWith('#')) return text;
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  const hallId = collectionsConfig[currentCollectionId]?.defaultMeta?.id;
  const padded = String(Math.trunc(num)).padStart(4, '0');
  return hallId ? `#${hallId}-${padded}` : `#${padded}`;
}

/**
 * Normalizes timestamps to YYYY-MM-DD (C101 modal Timestamp format).
 * GViz date cells may be v="Date(2026,8,15)" with f="2026-09-15".
 */
function formatExhibitTimestamp(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && typeof raw.getFullYear === 'function') {
    const year = raw.getFullYear();
    const month = String(raw.getMonth() + 1).padStart(2, '0');
    const day = String(raw.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const text = String(raw).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const gviz = text.match(/^Date\((\d+),\s*(\d+),\s*(\d+)/);
  if (gviz) {
    const year = gviz[1];
    const month = String(Number(gviz[2]) + 1).padStart(2, '0');
    const day = String(Number(gviz[3])).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return text;
}

function readGvizCell(cell, { preferFormatted = false } = {}) {
  if (!cell) return '';
  if (preferFormatted && cell.f) return cell.f;
  if (cell.v === undefined || cell.v === null || cell.v === '') return cell.f || '';
  return cell.v;
}

/**
 * Helper to construct a standard record object if valid.
 */
function createRecord({ id, ja, tw, reading, created_at, rawRecommend, subtitle, rowIndex, collectionId }) {
  if (!ja || ja === '日語用詞' || ja === '大陆' || ja === '大陸' || ja === '顯示' || ja.toLowerCase() === 'title' || ja.toLowerCase() === 'term') {
    return null;
  }

  return {
    id: formatExhibitId(id, collectionId) || `ROW-${rowIndex}`,
    ja_term: ja,
    tw_translation: tw,
    reading: reading || '',
    created_at: formatExhibitTimestamp(created_at) || '',
    recommendations: parseRecommendationList(rawRecommend),
    subtitle: subtitle || '',
    row_index: rowIndex
  };
}

/**
 * Parses CSV dataset into standard collection records.
 */
export function parseCSVData(csvText, currentCollectionId) {
  const rows = parseCSVRows(csvText);
  if (rows.length <= 1) return null;

  const { idIdx, termIdx, twIdx, readingIdx, dateIdx, recommendIdx, subtitleIdx } = findDatasetColumnIndexes(
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
      const subtitle = (subtitleIdx !== -1 && cols[subtitleIdx]) ? cols[subtitleIdx].trim() : '';

      const record = createRecord({ id, ja, tw, reading, created_at, rawRecommend, subtitle, rowIndex: i, collectionId: currentCollectionId });
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

  let idIdx = 0, termIdx = 1, twIdx = 2, readingIdx = -1, dateIdx = -1, recommendIdx = -1, subtitleIdx = -1;
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
    subtitleIdx = found.subtitleIdx;
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
    if (currentCollectionId === 'korean-terms') subtitleIdx = 3;
  }

  const results = [];
  table.rows.forEach((r, idx) => {
    const c = r.c;
    if (!c) return;
    const rowIndex = idx + 1;
    const id = (idIdx >= 0 && c[idIdx]) ? String(readGvizCell(c[idIdx], { preferFormatted: true }) || '').trim() : `ROW-${rowIndex}`;
    const ja = (termIdx >= 0 && c[termIdx]) ? String(readGvizCell(c[termIdx]) || '').trim() : '';
    const tw = (twIdx >= 0 && c[twIdx]) ? String(readGvizCell(c[twIdx]) || '').trim() : '';
    const reading = (readingIdx >= 0 && c[readingIdx]) ? String(readGvizCell(c[readingIdx]) || '').trim() : '';
    const created_at = (dateIdx >= 0 && c[dateIdx]) ? String(readGvizCell(c[dateIdx], { preferFormatted: true }) || '').trim() : '';
    const rawRecommend = (recommendIdx >= 0 && c[recommendIdx]) ? String(readGvizCell(c[recommendIdx]) || '').trim() : '';
    const subtitle = (subtitleIdx >= 0 && c[subtitleIdx]) ? String(readGvizCell(c[subtitleIdx]) || '').trim() : '';

    const record = createRecord({ id, ja, tw, reading, created_at, rawRecommend, subtitle, rowIndex, collectionId: currentCollectionId });
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
    // 2. Match by title or name (e.g. '日本特色詞彙', '簡中語境破解攻略', '韓語單字速成攻略')
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
  return parseMetadataMatrixRows(gvizTableToRows(table));
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

function emptyOpeningHoursSchedule() {
  return DEFAULT_OPENING_HOURS.map(item => ({ ...item }));
}

function applyOpeningHoursPair(schedule, dayRaw, hours) {
  const idx = DAY_INDEX_MAP[(dayRaw || '').trim().toLowerCase()];
  if (idx === undefined || !hours) return false;
  schedule[idx].hours = hours;
  return true;
}

/**
 * Parses opening hours from the central metadata matrix (intro + hours).
 * Uses weekday rows (週日…週六) in column 0; hours come from column 1
 * (first hall / platform column). Returns null when the sheet has no hours rows.
 */
export function extractOpeningHoursFromMetaRows(rows) {
  if (!rows || rows.length === 0) return null;

  const schedule = emptyOpeningHoursSchedule();
  let hasValidRow = false;

  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const key = (row[0] || '').trim();
    const hours = (row[1] || '').trim();
    if (applyOpeningHoursPair(schedule, key, hours)) {
      hasValidRow = true;
    }
  }

  return hasValidRow ? schedule : null;
}

/**
 * Parses opening hours schedule from CSV content.
 * @param {string} csvText - Raw CSV content
 * @returns {Array<{day: string, hours: string}>|null} Array of 7 day schedule items
 */
export function parseOpeningHoursCSV(csvText) {
  const rows = parseCSVRows(csvText);
  if (!rows || rows.length < 2) return null;
  return extractOpeningHoursFromMetaRows(rows);
}

/**
 * Formats curator profile IDs to #P-0002.
 * GViz numeric cells often expose v=2 / f="#P-0002"; prefer the formatted value.
 */
export function formatProfileId(raw) {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) return '';
  if (/^#P-/i.test(text)) return text.startsWith('#') ? text : `#${text.slice(1)}`;
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  return `#P-${String(Math.trunc(num)).padStart(4, '0')}`;
}

function headerIndex(headers, predicates) {
  return headers.findIndex(h => predicates.some(pred => pred(h)));
}

/**
 * Parses curator profile rows (header + records) into profile objects.
 */
export function parseProfileRows(rows) {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(h => (h || '').trim().toLowerCase());
  const idIdx = headerIndex(headers, [h => h === 'id' || h.includes('編號')]);
  const enIdx = headerIndex(headers, [h => h.includes('english')]);
  const zhIdx = headerIndex(headers, [h => h.includes('chinese') || h.includes('中文') || h.includes('chinese name')]);
  const igIdx = headerIndex(headers, [h => h === 'ig' || h.includes('instagram')]);
  const ytIdx = headerIndex(headers, [h => h.includes('youtube') || h === 'yt']);
  const gmIdx = headerIndex(headers, [h => h.includes('gmail') || h.includes('email') || h.includes('mail')]);
  const descIdx = headerIndex(headers, [h => h.includes('description') || h.includes('說明')]);

  const cell = (row, idx) => (idx >= 0 && row[idx] != null) ? String(row[idx]).trim() : '';
  const profiles = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const zhName = cell(row, zhIdx);
    const enName = cell(row, enIdx);
    if (!zhName && !enName) continue;
    profiles.push({
      id: formatProfileId(cell(row, idIdx)),
      enName,
      zhName,
      ig: cell(row, igIdx),
      youtube: cell(row, ytIdx),
      gmail: cell(row, gmIdx),
      description: cell(row, descIdx)
    });
  }

  return profiles;
}

/**
 * Parses curator profiles CSV (ID, English Name, Chinese Name, IG, Youtube, Gmail, Description).
 */
export function parseProfilesCSVData(csvText) {
  return parseProfileRows(parseCSVRows(csvText));
}

/**
 * Parses curator profiles from a GViz JSON response.
 */
export function parseProfilesGvizResponse(gvizText) {
  const table = extractGvizTable(gvizText);
  if (!table) return [];

  const rows = [];
  if (table.cols?.length > 0) {
    const headerRow = table.cols.map(col => col?.label || '');
    if (headerRow.some(Boolean)) rows.push(headerRow);
  }
  if (table.rows) {
    table.rows.forEach(r => {
      if (!r.c) return;
      rows.push(r.c.map((cell, i) => {
        const preferFormatted = i === 0;
        const value = readGvizCell(cell, { preferFormatted });
        return value == null ? '' : String(value);
      }));
    });
  }
  return parseProfileRows(rows);
}
