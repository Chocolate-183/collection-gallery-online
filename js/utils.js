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
