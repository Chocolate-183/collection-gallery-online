/**
 * Generic Data Parsers (CSV & Google GViz Response)
 */
import { collectionsConfig } from './config.js';

export function parseCSVData(csvText) {
  if (!csvText) return null;

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

  if (rows.length <= 1) return null;

  const header = rows[0].map(c => c.trim().toLowerCase());
  let idIdx = header.findIndex(h => h.includes('id') || h.includes('編號') || h.includes('序號'));
  let termIdx = header.findIndex(h => h.includes('title') || h.includes('term') || h.includes('name') || h.includes('日語') || h.includes('大陆') || h.includes('大陸') || h.includes('詞彙') || h.includes('用語') || h.includes('標題') || h.includes('項目'));
  let twIdx = header.findIndex(h => h.includes('content') || h.includes('meaning') || h.includes('description') || h.includes('translation') || h.includes('台灣') || h.includes('意思') || h.includes('對應') || h.includes('翻譯') || h.includes('說明') || h.includes('內容'));
  let readingIdx = header.findIndex(h => h.includes('reading') || h.includes('subtitle') || h.includes('phonetic') || h.includes('假名') || h.includes('標音') || h.includes('讀音') || h.includes('読み') || h.includes('音素'));
  let dateIdx = header.findIndex(h => h.includes('date') || h.includes('created') || h.includes('日期') || h.includes('時間'));

  if (idIdx === -1) idIdx = 0;
  if (termIdx === -1) termIdx = 1;
  if (twIdx === -1) twIdx = 2;

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length >= 2) {
      const id = cols[idIdx] ? cols[idIdx].trim() : `ROW-${i}`;
      const ja = cols[termIdx] ? cols[termIdx].trim() : '';
      const tw = cols[twIdx] ? cols[twIdx].trim() : '';
      const reading = (readingIdx !== -1 && cols[readingIdx]) ? cols[readingIdx].trim() : '';
      const created_at = (dateIdx !== -1 && cols[dateIdx]) ? cols[dateIdx].trim() : '';

      if (ja && ja !== '日語用詞' && ja !== '大陆' && ja !== '大陸' && ja.toLowerCase() !== 'title' && ja.toLowerCase() !== 'term') {
        results.push({
          id: id || `ROW-${i}`,
          ja_term: ja,
          tw_translation: tw,
          reading: reading,
          created_at: created_at,
          row_index: i
        });
      }
    }
  }
  return results;
}

export function parseGvizResponse(gvizText, currentCollectionId) {
  try {
    const jsonMatch = gvizText.match(/google\.visualization\.Query\.setResponse\((.*?)\);/s);
    if (!jsonMatch) return null;
    const json = JSON.parse(jsonMatch[1]);
    if (!json.table || !json.table.rows) return null;

    let idIdx = 0, termIdx = 1, twIdx = 2, readingIdx = -1, dateIdx = -1;
    if (json.table.cols && json.table.cols.length > 0) {
      const colsHeader = json.table.cols.map(col => ((col && col.label) || '').toLowerCase());
      idIdx = colsHeader.findIndex(h => h.includes('id') || h.includes('編號') || h.includes('序號'));
      termIdx = colsHeader.findIndex(h => h.includes('title') || h.includes('term') || h.includes('name') || h.includes('日語') || h.includes('大陆') || h.includes('大陸') || h.includes('詞彙') || h.includes('標題') || h.includes('項目'));
      twIdx = colsHeader.findIndex(h => h.includes('content') || h.includes('meaning') || h.includes('description') || h.includes('translation') || h.includes('台灣') || h.includes('意思') || h.includes('對應') || h.includes('說明') || h.includes('內容'));
      readingIdx = colsHeader.findIndex(h => h.includes('reading') || h.includes('subtitle') || h.includes('phonetic') || h.includes('假名') || h.includes('標音') || h.includes('讀音') || h.includes('読み') || h.includes('音素'));
      dateIdx = colsHeader.findIndex(h => h.includes('date') || h.includes('created') || h.includes('日期') || h.includes('時間'));

      if (idIdx === -1) idIdx = 0;
      if (termIdx === -1) termIdx = 1;
      if (twIdx === -1) twIdx = 2;
    } else {
      const colConfig = collectionsConfig[currentCollectionId];
      if (colConfig && colConfig.hasReading) {
        readingIdx = 3;
        dateIdx = 4;
      } else {
        readingIdx = -1;
        dateIdx = 3;
      }
    }

    const rows = json.table.rows;
    const results = [];

    rows.forEach((r, idx) => {
      const c = r.c;
      if (!c) return;
      const id = (idIdx >= 0 && c[idIdx]) ? (c[idIdx].v || '').toString().trim() : `ROW-${idx + 1}`;
      const ja = (termIdx >= 0 && c[termIdx]) ? (c[termIdx].v || '').toString().trim() : '';
      const tw = (twIdx >= 0 && c[twIdx]) ? (c[twIdx].v || '').toString().trim() : '';
      const reading = (readingIdx >= 0 && c[readingIdx]) ? (c[readingIdx].v || '').toString().trim() : '';
      const created_at = (dateIdx >= 0 && c[dateIdx]) ? (c[dateIdx].v || c[dateIdx].f || '').toString().trim() : '';

      if (ja && ja !== '日語用詞' && ja !== '大陆' && ja !== '大陸' && ja.toLowerCase() !== 'title' && ja.toLowerCase() !== 'term') {
        results.push({
          id: id || `ROW-${idx + 1}`,
          ja_term: ja,
          tw_translation: tw,
          reading: reading,
          created_at: created_at,
          row_index: idx + 1
        });
      }
    });
    return results;
  } catch (e) {
    return null;
  }
}

export function parseMetaCSVData(csvText) {
  if (!csvText) return null;
  
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

  if (rows.length <= 1) return null;

  const meta = {
    title: '',
    tags: [],
    subtitle: '',
    description: '',
    notice: '',
    author: ''
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;
    const key = (row[0] || '').trim();
    const val = (row[1] || '').trim();

    if (key.includes('標題')) {
      meta.title = val;
    } else if (key.includes('標籤')) {
      meta.tags = val.split(/[\n\r,，]/).map(t => t.trim()).filter(Boolean);
    } else if (key.includes('副標')) {
      meta.subtitle = val;
    } else if (key.includes('說明')) {
      meta.description = val;
    } else if (key.includes('注意事項') || key.includes('注意')) {
      meta.notice = val;
    } else if (key.includes('作者')) {
      meta.author = val;
    }
  }

  return meta.title ? meta : null;
}

export function parseMetaGvizResponse(gvizText) {
  try {
    const jsonMatch = gvizText.match(/google\.visualization\.Query\.setResponse\((.*?)\);/s);
    if (!jsonMatch) return null;
    const json = JSON.parse(jsonMatch[1]);
    if (!json.table || !json.table.rows) return null;

    const meta = {
      title: '',
      tags: [],
      subtitle: '',
      description: '',
      notice: '',
      author: ''
    };

    json.table.rows.forEach(r => {
      if (!r.c || r.c.length < 2) return;
      const key = (r.c[0] && r.c[0].v ? r.c[0].v : '').toString().trim();
      const val = (r.c[1] && (r.c[1].v || r.c[1].f) ? (r.c[1].v || r.c[1].f) : '').toString().trim();

      if (key.includes('標題')) {
        meta.title = val;
      } else if (key.includes('標籤')) {
        meta.tags = val.split(/[\n\r,，]/).map(t => t.trim()).filter(Boolean);
      } else if (key.includes('副標')) {
        meta.subtitle = val;
      } else if (key.includes('說明')) {
        meta.description = val;
      } else if (key.includes('注意事項') || key.includes('注意')) {
        meta.notice = val;
      } else if (key.includes('作者')) {
        meta.author = val;
      }
    });

    return meta.title ? meta : null;
  } catch (e) {
    return null;
  }
}
