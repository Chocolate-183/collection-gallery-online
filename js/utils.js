/**
 * Shared Helper Utilities
 */
import { EXHIBITION_STATUS, DEFAULT_OPENING_HOURS, DEFAULT_TIMEOUT_MS } from './constants.js';
import { parseOpeningHoursCSV } from './parser.js';

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
  if (colId === 'china-terms') return 'China Terms';
  if (colId === 'korean-terms') return 'Hanja Hacks for Korean';
  return 'Japanese Terms';
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

export let OPENING_HOURS_SCHEDULE = [...DEFAULT_OPENING_HOURS];
let openingHoursFromMetadata = false;

export function setOpeningHoursSchedule(newSchedule, { fromMetadata = false } = {}) {
  if (Array.isArray(newSchedule) && newSchedule.length === 7) {
    OPENING_HOURS_SCHEDULE = newSchedule;
    if (fromMetadata) openingHoursFromMetadata = true;
  }
}

export async function loadOpeningHours(csvUrl = 'opening-hours.csv') {
  if (openingHoursFromMetadata) return OPENING_HOURS_SCHEDULE;
  const csvText = await safeFetchText(csvUrl);
  if (csvText) {
    const parsed = parseOpeningHoursCSV(csvText);
    if (parsed) {
      setOpeningHoursSchedule(parsed);
      return parsed;
    }
  }
  return OPENING_HOURS_SCHEDULE;
}

/**
 * Returns formatted today's opening hours text based on current day of week.
 * @param {Date} [date] - Optional date object for testing
 * @returns {string} Formatted opening hours string
 */
function isClosedHours(hours) {
  return !hours || hours === '休館' || hours === 'CLOSED';
}

function parseHoursRange(hours) {
  const parts = String(hours).split('-').map(s => s.trim());
  if (parts.length !== 2) return null;
  const [startH, startM] = parts[0].split(':').map(Number);
  const [endH, endM] = parts[1].split(':').map(Number);
  if ([startH, startM, endH, endM].some(Number.isNaN)) return null;
  return {
    startTotal: startH * 60 + startM,
    endTotal: endH * 60 + endM
  };
}

export function getTodayOpeningHoursText(date = new Date()) {
  const hours = OPENING_HOURS_SCHEDULE[date.getDay()]?.hours;
  return `Today's Hours: ${isClosedHours(hours) ? 'CLOSED' : hours}`;
}

/**
 * Returns formatted next opening time text with date based on OPENING_HOURS_SCHEDULE.
 * @param {Date} [now] - Optional date object for testing
 * @returns {string} Formatted next opening time string
 */
export function getNextOpeningTimeText(now = new Date()) {
  for (let offset = 0; offset < 7; offset++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const sched = OPENING_HOURS_SCHEDULE[targetDate.getDay()];
    if (isClosedHours(sched?.hours)) continue;

    const range = parseHoursRange(sched.hours);
    if (!range) continue;

    if (offset === 0) {
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentTotalMinutes >= range.startTotal) continue;
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dateStr = String(targetDate.getDate()).padStart(2, '0');
    return `Next Opening: ${year}/${month}/${dateStr} (${sched.day}) ${sched.hours}`;
  }

  return 'Next Opening: N/A';
}

/**
 * Checks whether the gallery is currently open based on OPENING_HOURS_SCHEDULE.
 * @param {Date} [date] - Optional date object for testing
 * @returns {boolean} True if within opening hours, false otherwise
 */
export function isGalleryOpen(date = new Date()) {
  const hours = OPENING_HOURS_SCHEDULE[date.getDay()]?.hours;
  if (isClosedHours(hours)) return false;

  const range = parseHoursRange(hours);
  if (!range) return false;

  const currentTotal = date.getHours() * 60 + date.getMinutes();
  return currentTotal >= range.startTotal && currentTotal <= range.endTotal;
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
