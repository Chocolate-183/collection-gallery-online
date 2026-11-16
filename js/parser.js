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
  { key: 'notice', match: k => k.includes('注意') || k.includes('notice') },
  { key: 'announcement', match: k => k.includes('公告') || k.includes('announcement') },
  { key: 'author', match: k => k.includes('作者') || k.includes('策劃') || k.includes('負責人') || k.includes('author') },
  { key: 'status', match: k => k.includes('狀態') || k.includes('status') },
  { key: 'id', match: k => k === 'id' || k.includes('編號') || k.includes('序號') || k.includes('展廳id') },
  { key: 'timestamp', match: k => k.includes('timestamp') || k.includes('created') || k.includes('日期') || k.includes('時間') }
];

const IGNORED_META_KEYS = ['開館', '開放時間', '參觀時間'];

/** Builds a hall metadata object from [key, value] pairs; null when neither title nor id is present. */
function extractMetadataFromKeyValues(pairs) {
  const meta = {
    title: '', enTitle: '', tags: [], subtitle: '', description: '',
    notice: '', announcement: '', author: '', status: '', id: '', timestamp: ''
  };

  for (const [rawKey, rawVal] of pairs) {
    const key = (rawKey || '').trim().toLowerCase();
    const val = (rawVal || '').trim();
    if (!key || IGNORED_META_KEYS.some(k => key.includes(k))) continue;
    const def = META_FIELD_DEFINITIONS.find(d => d.match(key));
    if (def) meta[def.key] = def.transform ? def.transform(val) : val;
  }

  return (meta.title || meta.id) ? meta : null;
}

const isRecommendHeader = h => h.includes('recommend') || h.includes('推薦') || h.includes('推荐');
const includesAny = (h, words) => words.some(w => h.includes(w));

/**
 * Finds dataset column indexes from header titles.
 * hiddenColumnIndexes (0-based) are never used for any field except subtitle.
 */
function findDatasetColumnIndexes(headerTitles, hiddenColumnIndexes = []) {
  const hidden = new Set(hiddenColumnIndexes.map(Number).filter(n => Number.isInteger(n) && n >= 0));
  const headers = headerTitles.map(h => (h || '').toLowerCase());
  const findIdx = pred => headers.findIndex((h, i) => !hidden.has(i) && pred(h));
  const firstVisible = start => {
    for (let i = Math.max(start, 0); i < headers.length; i++) {
      if (!hidden.has(i)) return i;
    }
    return -1;
  };

  let idIdx = findIdx(h => includesAny(h, ['id', '編號', '序號']));
  let termIdx = findIdx(h => !isRecommendHeader(h) && includesAny(h, ['title', 'term', 'name', '顯示', '日語', '大陆', '大陸', '詞彙', '用語', '標題', '項目']));
  let twIdx = findIdx(h => !isRecommendHeader(h) && includesAny(h, ['content', 'meaning', 'description', 'translation', '台灣', '意思', '對應', '翻譯', '說明', '解釋', '內容']));

  if (idIdx === -1) idIdx = firstVisible(0);
  if (termIdx === -1) termIdx = firstVisible(idIdx + 1);
  if (twIdx === -1) twIdx = firstVisible(termIdx + 1);

  return {
    id: idIdx,
    ja: termIdx,
    tw: twIdx,
    reading: findIdx(h => includesAny(h, ['reading', 'subtitle', 'phonetic', '假名', '標音', '讀音', '発音', '發音', '読み', '音素'])),
    created_at: findIdx(h => includesAny(h, ['date', 'created', '日期', '時間'])),
    rawRecommend: findIdx(isRecommendHeader),
    subtitle: headers.findIndex(h => h.includes('副標') || h === 'subtitle' || h.includes('gloss')),
    traditional: findIdx(h => includesAny(h, ['繁體', '繁体', 'traditional'])),
    rawTags: findIdx(h => h.includes('標籤') || h.includes('标签') || h === 'tags' || h === 'tag'),
    etymology: findIdx(h => h.includes('詞源') || h.includes('etymology') || h === 'origin'),
    pos: findIdx(h => h.includes('詞性') || h === 'pos' || h.includes('part of speech') || h.includes('品詞')),
    level: findIdx(h => h === 'level' || h.includes('等級') || h.includes('級別'))
  };
}

/** Positional layout for GViz tables that come back without header labels. */
function defaultDatasetColumnIndexes(collectionId) {
  const col = collectionsConfig[collectionId];
  const isKorean = collectionId === 'korean-terms';
  return {
    id: 0, ja: 1, tw: 2,
    reading: col?.hasReading ? 3 : -1,
    created_at: col?.hasReading ? 4 : 3,
    rawRecommend: col?.hasReading ? 5 : 4,
    subtitle: isKorean ? 3 : -1,
    traditional: -1,
    rawTags: -1,
    etymology: isKorean ? 8 : -1,
    pos: isKorean ? 9 : -1,
    level: isKorean ? 10 : -1
  };
}

/**
 * Parses raw CSV text into a 2D array of string cells, preserving multiline values in quotes.
 */
export function parseCSVRows(csvText) {
  if (!csvText) return [];

  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let insideQuotes = false;

  const pushRow = () => {
    currentRow.push(currentVal);
    currentVal = '';
    if (currentRow.some(c => c.trim() !== '')) rows.push(currentRow);
    currentRow = [];
  };

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
      if (char === '\r' && nextChar === '\n') i++;
      pushRow();
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) pushRow();
  return rows;
}

/** Extracts the google.visualization table object from a GViz response. */
export function extractGvizTable(gvizText) {
  if (!gvizText) return null;
  try {
    const jsonMatch = gvizText.match(/google\.visualization\.Query\.setResponse\((.*?)\);/s);
    if (!jsonMatch) return null;
    const json = JSON.parse(jsonMatch[1]);
    return json?.table?.rows ? json.table : null;
  } catch {
    return null;
  }
}

/** Reads a GViz cell; `preferFormatted` returns the display string (`f`) first, e.g. "#C101-1047". */
function readGvizCell(cell, preferFormatted = false) {
  if (!cell) return '';
  if (preferFormatted && cell.f) return String(cell.f);
  if (cell.v === undefined || cell.v === null || cell.v === '') return cell.f ? String(cell.f) : '';
  return String(cell.v);
}

function gvizHeaderRow(table) {
  return (table?.cols || []).map(col => col?.label || '');
}

/**
 * Flattens a GViz table into string rows: header (when labelled) + data rows.
 * Columns listed in `formattedColumns` read the formatted value first.
 */
function gvizTableToRows(table, formattedColumns = []) {
  if (!table) return [];
  const rows = [];
  const header = gvizHeaderRow(table);
  if (header.some(Boolean)) rows.push(header);
  (table.rows || []).forEach(r => {
    if (r.c) rows.push(r.c.map((cell, i) => readGvizCell(cell, formattedColumns.includes(i))));
  });
  return rows;
}

function splitConjugationLines(cell) {
  return String(cell || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

/**
 * Parses C103 動詞形容詞變化 rows (header + one lemma per row).
 * Columns: 기본형, 현재형, 과거형, 미래형, 현재 의문형, 과거 의문형, 명령형, 청유형, 연결형 / 기타.
 */
function parseConjugationRows(rows) {
  return rows.slice(1)
    .map(row => row || [])
    .filter(row => {
      const lemma = String(row[0] || '').trim();
      return lemma && lemma !== '기본형';
    })
    .map(row => ({
      lemma: String(row[0]).trim(),
      present: splitConjugationLines(row[1]),
      past: splitConjugationLines(row[2]),
      future: splitConjugationLines(row[3]),
      presentQuestion: splitConjugationLines(row[4]),
      pastQuestion: splitConjugationLines(row[5]),
      command: splitConjugationLines(row[6]),
      suggestion: splitConjugationLines(row[7]),
      other: splitConjugationLines(row[8])
    }));
}

export function parseConjugationCSVData(csvText) {
  return parseConjugationRows(parseCSVRows(csvText));
}

export function parseConjugationGvizResponse(gvizText) {
  return parseConjugationRows(gvizTableToRows(extractGvizTable(gvizText)));
}

/**
 * Formats exhibit IDs to the C101 display pattern, e.g. #C101-1047.
 * GViz numeric cells often expose v=1047 / f="#C101-1047".
 */
function formatExhibitId(rawId, collectionId) {
  const text = rawId == null ? '' : String(rawId).trim();
  if (!text || text.startsWith('#')) return text;
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  const hallId = collectionsConfig[collectionId]?.defaultMeta?.id;
  const padded = String(Math.trunc(num)).padStart(4, '0');
  return hallId ? `#${hallId}-${padded}` : `#${padded}`;
}

/**
 * Normalizes timestamps to YYYY-MM-DD.
 * GViz date cells may be v="Date(2026,8,15)" (0-based month) with f="2026-09-15".
 */
function formatExhibitTimestamp(raw) {
  const text = raw == null ? '' : String(raw).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const gviz = text.match(/^Date\((\d+),\s*(\d+),\s*(\d+)/);
  if (gviz) {
    const month = String(Number(gviz[2]) + 1).padStart(2, '0');
    const day = String(Number(gviz[3])).padStart(2, '0');
    return `${gviz[1]}-${month}-${day}`;
  }
  return text;
}

const HEADER_TERMS = new Set(['日語用詞', '大陆', '大陸', '顯示', 'title', 'term']);

function createRecord(fields, rowIndex, collectionId) {
  const ja = fields.ja;
  if (!ja || HEADER_TERMS.has(ja) || HEADER_TERMS.has(ja.toLowerCase())) return null;

  return {
    id: formatExhibitId(fields.id, collectionId) || `ROW-${rowIndex}`,
    ja_term: ja,
    tw_translation: fields.tw,
    reading: fields.reading,
    created_at: formatExhibitTimestamp(fields.created_at),
    recommendations: parseRecommendationList(fields.rawRecommend),
    subtitle: fields.subtitle,
    traditional_term: fields.traditional,
    tags: parseRecommendationList(fields.rawTags),
    etymology: fields.etymology,
    pos: fields.pos,
    level: fields.level,
    row_index: rowIndex
  };
}

/** Maps data rows (header excluded) to records using resolved column indexes. */
function rowsToRecords(dataRows, indexes, collectionId) {
  const records = [];
  dataRows.forEach((cols, i) => {
    if (!cols || cols.length < 2) return;
    const fields = {};
    for (const [field, idx] of Object.entries(indexes)) {
      fields[field] = idx >= 0 && cols[idx] != null ? String(cols[idx]).trim() : '';
    }
    const record = createRecord(fields, i + 1, collectionId);
    if (record) records.push(record);
  });
  return records;
}

function hiddenColumnsFor(collectionId) {
  return collectionsConfig[collectionId]?.hiddenColumnIndexes || [];
}

/** Parses a hall CSV export into standard collection records. */
export function parseCSVData(csvText, collectionId) {
  const rows = parseCSVRows(csvText);
  if (rows.length <= 1) return null;
  const indexes = findDatasetColumnIndexes(rows[0], hiddenColumnsFor(collectionId));
  return rowsToRecords(rows.slice(1), indexes, collectionId);
}

/** Parses a hall GViz response into standard collection records. */
export function parseGvizResponse(gvizText, collectionId) {
  const table = extractGvizTable(gvizText);
  if (!table) return null;
  const header = gvizHeaderRow(table);
  const indexes = header.length > 0
    ? findDatasetColumnIndexes(header, hiddenColumnsFor(collectionId))
    : defaultDatasetColumnIndexes(collectionId);
  const formatted = [indexes.id, indexes.created_at].filter(i => i >= 0);
  const dataRows = table.rows.map(r => (r.c ? r.c.map((cell, i) => readGvizCell(cell, formatted.includes(i))) : null));
  return rowsToRecords(dataRows, indexes, collectionId);
}

/** Matches a parsed metadata object to a registered collection ID (by hall ID, then title). */
function matchCollectionIdForMeta(meta) {
  for (const [colId, col] of Object.entries(collectionsConfig)) {
    if (meta.id && (meta.id === col.id || meta.id === col.defaultMeta?.id)) return colId;
    if (meta.title && (meta.title === col.name || meta.title === col.defaultMeta?.title)) return colId;
  }
  if (meta.id) return collectionsConfig[meta.id] ? meta.id : meta.id.toLowerCase();
  return null;
}

/**
 * Parses metadata rows: a matrix (column 0 = keys, one column per hall)
 * or a legacy 2-column key/value sheet.
 */
function parseMetadataMatrixRows(rows) {
  if (!rows || rows.length === 0) return {};
  const results = {};
  const maxCols = Math.max(...rows.map(r => r.length));
  const valueColumns = maxCols > 2 ? Array.from({ length: maxCols - 1 }, (_, i) => i + 1) : [1];

  for (const colIdx of valueColumns) {
    const pairs = rows.filter(row => row.length > colIdx).map(row => [row[0], row[colIdx]]);
    const meta = extractMetadataFromKeyValues(pairs);
    const colId = meta && matchCollectionIdForMeta(meta);
    if (colId) results[colId] = meta;
  }
  return results;
}

export function parseAllCollectionsMetaCSVData(csvText) {
  return parseMetadataMatrixRows(parseCSVRows(csvText));
}

export function parseAllCollectionsMetaGvizResponse(gvizText) {
  return parseMetadataMatrixRows(gvizTableToRows(extractGvizTable(gvizText)));
}

/**
 * Formats curator profile IDs to #P-0002.
 * GViz numeric cells often expose v=2 / f="#P-0002".
 */
export function formatProfileId(raw) {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) return '';
  if (/^#P-/i.test(text)) return text;
  const num = Number(text);
  if (!Number.isFinite(num)) return text;
  return `#P-${String(Math.trunc(num)).padStart(4, '0')}`;
}

/** Parses curator profile rows (header + records): ID, English Name, Chinese Name, IG, Youtube, Gmail, Description. */
function parseProfileRows(rows) {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(h => (h || '').trim().toLowerCase());
  const idx = pred => headers.findIndex(pred);
  const columns = {
    id: idx(h => h === 'id' || h.includes('編號')),
    enName: idx(h => h.includes('english')),
    zhName: idx(h => h.includes('chinese') || h.includes('中文')),
    ig: idx(h => h === 'ig' || h.includes('instagram')),
    youtube: idx(h => h.includes('youtube') || h === 'yt'),
    gmail: idx(h => h.includes('mail')),
    description: idx(h => h.includes('description') || h.includes('說明'))
  };
  const cell = (row, i) => (i >= 0 && row[i] != null) ? String(row[i]).trim() : '';

  return rows.slice(1)
    .filter(row => row && (cell(row, columns.zhName) || cell(row, columns.enName)))
    .map(row => {
      const profile = Object.fromEntries(Object.entries(columns).map(([key, i]) => [key, cell(row, i)]));
      profile.id = formatProfileId(profile.id);
      return profile;
    });
}

export function parseProfilesCSVData(csvText) {
  return parseProfileRows(parseCSVRows(csvText));
}

export function parseProfilesGvizResponse(gvizText) {
  return parseProfileRows(gvizTableToRows(extractGvizTable(gvizText), [0]));
}
