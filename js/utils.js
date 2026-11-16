/**
 * Shared Helper Utilities
 */
import { EXHIBITION_STATUS, DEFAULT_TIMEOUT_MS, NAME_CATEGORY_TAGS, MOBILE_MAX_WIDTH } from './constants.js';

function matchStatus(meta, keywords) {
  if (!meta || !meta.status) return false;
  const s = String(meta.status).trim().toUpperCase();
  return keywords.some(k => s.includes(k.toUpperCase()));
}

export function isCollectionAdjusting(meta) {
  return matchStatus(meta, [EXHIBITION_STATUS.ADJUSTING, '調整中', 'ADJUSTMENT']);
}

export function isCollectionPreparing(meta) {
  return matchStatus(meta, [EXHIBITION_STATUS.PREPARING, 'PREPARING', '籌備中', 'PREPARATION']);
}

export function isCollectionHidden(meta) {
  return matchStatus(meta, [EXHIBITION_STATUS.HIDDEN]);
}

/** True on phone-sized viewports (≤ 768px). False when there is no window. */
export function isMobileViewport() {
  return typeof window !== 'undefined'
    && typeof window.innerWidth === 'number'
    && window.innerWidth <= MOBILE_MAX_WIDTH;
}

/**
 * Gallery page header (`#collection-header-title`):
 * "Collection {hall number}" + "{Chinese title}", e.g. C103 → Collection 103 / 韓語單字量最強速成攻略
 */
export function getCollectionHeaderTitleParts(colId, meta, col) {
  const hallId = meta?.id || col?.defaultMeta?.id || '';
  const number = String(hallId).replace(/^[Cc]/, '').trim();
  return {
    hall: number ? `Collection ${number}` : '',
    name: (meta?.title || col?.name || '').trim()
  };
}

export function applyCollectionHeaderTitle(el, colId, meta, col) {
  if (!el) return;
  const { hall, name } = getCollectionHeaderTitleParts(colId, meta, col);
  if (hall && name) {
    el.innerHTML = `<span class="collection-header-hall">${escapeHtml(hall)}</span><span class="collection-header-name">${escapeHtml(name)}</span>`;
    return;
  }
  el.textContent = name || hall || meta?.enTitle || col?.enTitle || colId;
}

/** Escapes special HTML characters to prevent XSS in dynamic rendering. */
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
 * Hangul headword in a C103 title (text before the first `|`).
 * e.g. "가능 | 可能" → "가능", "가게" → "가게"
 */
export function getExhibitHangulHeadword(str) {
  if (!str) return '';
  return String(str).split('|')[0].trim();
}

/**
 * Character length used by Length tabs.
 * C103 titles like "가능 | 可能" count only Hangul before `|` (2 chars).
 */
export function getExhibitFilterLength(str) {
  return [...getExhibitHangulHeadword(str)].length;
}

/** Text after the first `|` in a C103 exhibit title. */
function getExhibitTitleSuffix(str) {
  if (!str) return '';
  const idx = String(str).indexOf('|');
  return idx === -1 ? '' : String(str).slice(idx + 1).trim();
}

/** C103 副標: sheet column D, else the title suffix after `|`. */
export function getExhibitSubtitle(record) {
  if (!record) return '';
  return String(record.subtitle || '').trim() || getExhibitTitleSuffix(record.ja_term);
}

/** 국립국어원 표준국어대사전 search URL for a Hangul headword. */
export function getStdictSearchUrl(keyword) {
  const q = String(keyword || '').trim();
  if (!q) return '';
  return `https://stdict.korean.go.kr/search/searchResult.do?pageSize=10&searchKeyword=${encodeURIComponent(q)}`;
}

const STDICT_SOURCE_LABEL = '國立國語院標準國語大辭典';

/** C103 Item Reference link labelled `國立國語院標準國語大辭典`. */
export function formatStdictReferenceHtml(headword) {
  const url = getStdictSearchUrl(getExhibitHangulHeadword(headword));
  if (!url) return '';
  return `<a class="modal-reference-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(STDICT_SOURCE_LABEL)}</a>`;
}

/** C102 card/modal title: 大陆 (simplified) or 繁體中文, falling back to simplified. */
export function getExhibitDisplayTitle(record, scriptVariant) {
  if (!record) return '';
  const simplified = String(record.ja_term || '').trim();
  if (scriptVariant === 'traditional') {
    return String(record.traditional_term || '').trim() || simplified;
  }
  return simplified;
}

/** Renders exhibit titles so C103 `|` and the text after it stay muted (e.g. 가능 | 可能). */
export function formatExhibitTitleHtml(str) {
  if (!str) return '';
  const escaped = escapeHtml(String(str));
  const idx = escaped.indexOf('|');
  if (idx === -1) return escaped;
  return `${escaped.slice(0, idx)}<span class="awsui-title-separator">|</span><span class="awsui-title-suffix">${escaped.slice(idx + 1)}</span>`;
}

/** Splits a recommendation / tag cell on `<br>`, newlines, commas, 、 and semicolons. */
export function parseRecommendationList(val) {
  if (Array.isArray(val)) return val;
  if (typeof val !== 'string' || !val.trim()) return [];
  return val
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/[\n\r,，、;；]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** True when a record carries the given tag. */
export function hasTag(record, tag) {
  if (!tag || !Array.isArray(record?.tags)) return false;
  return record.tags.some(t => String(t).trim() === tag);
}

export function getExhibitCategoryLabel(record) {
  return NAME_CATEGORY_TAGS.find(tag => hasTag(record, tag)) || '';
}

/** Timer functions resolved through `window` at call time (lets tests swap them in). */
export function getTimers() {
  const win = globalThis.window;
  // Call through wrappers: invoking window.setTimeout with a foreign `this` throws "Illegal invocation".
  return {
    set: (fn, ms) => (win?.setTimeout || setTimeout)(fn, ms),
    clear: id => (win?.clearTimeout || clearTimeout)(id)
  };
}

/** Fetches text with a timeout. Returns null on network failure, CORS block, non-2xx, or timeout. */
export async function safeFetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}
