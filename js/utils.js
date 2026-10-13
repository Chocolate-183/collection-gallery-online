/**
 * Shared Helper Utilities
 */
import { EXHIBITION_STATUS, DEFAULT_TIMEOUT_MS, NAME_CATEGORY_TAGS } from './constants.js';

function matchStatus(meta, keywords) {
  if (!meta || !meta.status) return false;
  const s = String(meta.status).trim().toUpperCase();
  return keywords.some(k => k && (s === k.toUpperCase() || s.includes(k.toUpperCase())));
}

/**
 * Checks if a collection's status is adjusting / under maintenance.
 */
export function isCollectionAdjusting(meta) {
  return matchStatus(meta, [EXHIBITION_STATUS.ADJUSTING, '調整中', 'ADJUSTMENT']);
}

/**
 * Checks if a collection's status is preparing / under development.
 */
export function isCollectionPreparing(meta) {
  return matchStatus(meta, [EXHIBITION_STATUS.PREPARING, 'PREPARING', 'COMING SOON', '籌備中', 'PREPARATION']);
}

/**
 * Checks if a collection's status is hidden ("不顯示").
 */
export function isCollectionHidden(meta) {
  return matchStatus(meta, [EXHIBITION_STATUS.HIDDEN]);
}

/**
 * Returns English Title for a collection with proper fallbacks.
 */
export function getCollectionEnTitle(colId, meta, col) {
  if (meta?.enTitle) return meta.enTitle;
  if (col?.enTitle) return col.enTitle;
  if (colId === 'china-terms') return 'Decoding Simplified Chinese: The Ultimate Guide';
  if (colId === 'korean-terms') return 'Master Korean Vocabulary Fast: The Ultimate Cheat Sheet';
  return 'Japanese Terms';
}

/**
 * Gallery page header (`#collection-header-title`):
 * "Collection {hall number}" + wider CSS gap + "{Chinese title}"
 * e.g. C103 → Collection 103  韓語單字量最強速成攻略
 */
export function getCollectionHeaderTitleParts(colId, meta, col) {
  const hallId = meta?.id || col?.defaultMeta?.id || '';
  const number = String(hallId).replace(/^[Cc]/, '').trim();
  const cnTitle = (meta?.title || col?.name || '').trim();
  return {
    hall: number ? `Collection ${number}` : '',
    name: cnTitle
  };
}

export function getCollectionHeaderTitle(colId, meta, col) {
  const { hall, name } = getCollectionHeaderTitleParts(colId, meta, col);
  if (hall && name) return `${hall} ${name}`;
  if (name) return name;
  if (hall) return hall;
  return getCollectionEnTitle(colId, meta, col);
}

export function applyCollectionHeaderTitle(el, colId, meta, col) {
  if (!el) return;
  const { hall, name } = getCollectionHeaderTitleParts(colId, meta, col);
  if (hall && name) {
    el.innerHTML = `<span class="collection-header-hall">${escapeHtml(hall)}</span><span class="collection-header-name">${escapeHtml(name)}</span>`;
    return;
  }
  el.textContent = name || hall || getCollectionEnTitle(colId, meta, col);
}

/**
 * Escapes special HTML characters to prevent XSS in dynamic rendering.
 * @param {string} str - Raw input string
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Calculates Unicode character length accurately (handles multibyte Unicode, emoji, etc.).
 * @param {string} str - Input string
 * @returns {number} Character count
 */
export function getUnicodeLength(str) {
  if (!str) return 0;
  return [...str].length;
}

/**
 * Character length used by Length tabs.
 * C103 titles like "가능 | 可能" count only Hangul before `|` (2 chars).
 */
export function getExhibitFilterLength(str) {
  if (!str) return 0;
  const left = String(str).split('|')[0].trim();
  return getUnicodeLength(left);
}

/**
 * Text after the first `|` in a C103 exhibit title (the on-card 副標).
 */
export function getExhibitTitleSuffix(str) {
  if (!str) return '';
  const idx = String(str).indexOf('|');
  if (idx === -1) return '';
  return String(str).slice(idx + 1).trim();
}

/**
 * Hangul headword in a C103 title (text before the first `|`).
 * e.g. "가능 | 可能" → "가능", "가게" → "가게"
 */
export function getExhibitHangulHeadword(str) {
  if (!str) return '';
  return String(str).split('|')[0].trim();
}

/**
 * 국립국어원 표준국어대사전 search URL for a Hangul headword.
 */
export function getStdictSearchUrl(keyword) {
  const q = String(keyword || '').trim();
  if (!q) return '';
  return `https://stdict.korean.go.kr/search/searchResult.do?pageSize=10&searchKeyword=${encodeURIComponent(q)}`;
}

export const STDICT_SOURCE_LABEL = '國立國語院標準國語大辭典';

/**
 * C103 Item Reference link label: `國立國語院標準國語大辭典`
 */
export function formatStdictReferenceHtml(headword) {
  const q = getExhibitHangulHeadword(headword);
  const url = getStdictSearchUrl(q);
  if (!url) return '';
  return `<a class="modal-reference-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(STDICT_SOURCE_LABEL)}</a>`;
}

/**
 * C103 副標 used for loanword filtering: sheet column D, else title suffix after `|`.
 */
export function getExhibitSubtitle(record) {
  if (!record) return '';
  if (typeof record === 'string') return getExhibitTitleSuffix(record);
  const fromColumn = String(record.subtitle || '').trim();
  if (fromColumn) return fromColumn;
  return getExhibitTitleSuffix(record.ja_term);
}

/**
 * True when a 副標 is English (Latin letters, no CJK / Hangul / Kana).
 */
export function isEnglishSubtitle(str) {
  const s = String(str || '').trim();
  if (!s || !/[A-Za-z]/.test(s)) return false;
  return !/[\u1100-\u11FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7A3\uF900-\uFAFF]/.test(s);
}

export function isEnglishLoanword(record) {
  return isEnglishSubtitle(getExhibitSubtitle(record));
}

/**
 * Renders exhibit titles so C103 `|` and the text after it stay muted (e.g. 가능 | 可能).
 */
export function formatExhibitTitleHtml(str) {
  if (!str) return '';
  const escaped = escapeHtml(String(str));
  const idx = escaped.indexOf('|');
  if (idx === -1) return escaped;
  const left = escaped.slice(0, idx);
  const right = escaped.slice(idx + 1);
  return `${left}<span class="awsui-title-separator">|</span><span class="awsui-title-suffix">${right}</span>`;
}

/**
 * Parses recommendation entries from array or string delimiter format.
 * @param {string|string[]} val - Raw recommendation content
 * @returns {string[]} Formatted recommendation tokens
 */
export function parseRecommendationList(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    return val
      .replace(/<br\s*\/?>/gi, '\n')
      .split(/[\n\r,，、;；]/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseExhibitTagList(val) {
  return parseRecommendationList(val);
}

export function getExhibitCategoryLabel(record) {
  const tags = Array.isArray(record?.tags) ? record.tags : [];
  for (const wanted of NAME_CATEGORY_TAGS) {
    if (tags.some(t => String(t).trim() === wanted)) return wanted;
  }
  return '';
}

/**
 * Safe fetch wrapper with timeout and error handling.
 * @param {string} url - Target URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds (default 2500)
 * @returns {Promise<Response|null>} Response object or null if failed/timed out
 */
export async function safeFetch(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (response.ok) return response;
  } catch {
    // Network failure, CORS blockage, or timeout
  }
  return null;
}

/**
 * Safe fetch text wrapper.
 * @param {string} url - Target URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds (default 2500)
 * @returns {Promise<string|null>} Response text or null
 */
export async function safeFetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const response = await safeFetch(url, timeoutMs);
  if (!response) return null;
  try {
    return await response.text();
  } catch {
    return null;
  }
}
