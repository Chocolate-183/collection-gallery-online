/**
 * Shared Helper Utilities
 */

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

export const OPENING_HOURS_SCHEDULE = [
  { day: '週日', hours: '16:00 - 23:55' },
  { day: '週一', hours: '01:00 - 23:55' },
  { day: '週二', hours: '01:00 - 23:55' },
  { day: '週三', hours: '01:00 - 23:55' },
  { day: '週四', hours: '01:00 - 23:55' },
  { day: '週五', hours: '06:00 - 23:55' },
  { day: '週六', hours: '06:00 - 23:55' }
];

/**
 * Returns formatted today's opening hours text based on current day of week.
 * @param {Date} [date] - Optional date object for testing
 * @returns {string} Formatted opening hours string
 */
export function getTodayOpeningHoursText(date = new Date()) {
  const dayIndex = date.getDay();
  const today = OPENING_HOURS_SCHEDULE[dayIndex];
  return `今日開館時間: ${today.hours}`;
}

/**
 * Returns formatted next opening time text with date based on OPENING_HOURS_SCHEDULE.
 * @param {Date} [now] - Optional date object for testing
 * @returns {string} Formatted next opening time string
 */
export function getNextOpeningTimeText(now = new Date()) {
  for (let offset = 0; offset < 7; offset++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayIndex = targetDate.getDay();
    const sched = OPENING_HOURS_SCHEDULE[dayIndex];

    if (!sched || !sched.hours || sched.hours === '休館') {
      continue;
    }

    const parts = sched.hours.split('-').map(s => s.trim());
    if (parts.length !== 2) continue;

    const [startStr] = parts;
    const [startH, startM] = startStr.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM)) continue;

    const startTotalMinutes = startH * 60 + startM;

    if (offset === 0) {
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentTotalMinutes >= startTotalMinutes) {
        continue;
      }
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dateStr = String(targetDate.getDate()).padStart(2, '0');
    return `下次開館時間: ${year}/${month}/${dateStr} (${sched.day}) ${sched.hours}`;
  }

  return '下次開館時間: 暫無資料';
}

/**
 * Checks whether the gallery is currently open based on OPENING_HOURS_SCHEDULE.
 * @param {Date} [date] - Optional date object for testing
 * @returns {boolean} True if within opening hours, false otherwise
 */
export function isGalleryOpen(date = new Date()) {
  const dayIndex = date.getDay();
  const today = OPENING_HOURS_SCHEDULE[dayIndex];
  if (!today || !today.hours || today.hours === '休館') {
    return false;
  }

  const parts = today.hours.split('-').map(s => s.trim());
  if (parts.length !== 2) return false;

  const [startStr, endStr] = parts;
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return false;
  }

  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;
  const currentTotalMinutes = date.getHours() * 60 + date.getMinutes();

  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
}

/**
 * Safe fetch wrapper with timeout and error handling.
 * @param {string} url - Target URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds (default 2500)
 * @returns {Promise<Response|null>} Response object or null if failed/timed out
 */
export async function safeFetch(url, timeoutMs = 2500) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (response.ok) {
      return response;
    }
  } catch (err) {
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
export async function safeFetchText(url, timeoutMs = 2500) {
  const response = await safeFetch(url, timeoutMs);
  if (!response) return null;
  try {
    return await response.text();
  } catch (err) {
    return null;
  }
}
