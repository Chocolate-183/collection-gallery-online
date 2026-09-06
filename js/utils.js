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
  { day: '週日', hours: '06:00 - 23:55' },
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
  return `今日開館時間（${today.day}）：${today.hours}`;
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
