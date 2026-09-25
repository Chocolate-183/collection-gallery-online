/**
 * Notice Panel — blocking status overlay (e.g. hall sync).
 */
export const NOTICE_MIN_VISIBLE_MS = 3000;
export const NOTICE_TICK_MS = 1000;
export const NOTICE_SYNC_MESSAGE = '展廳同步中';

let holdTimer = null;
let tickTimer = null;
let holdUntil = 0;

function getNoticeModal() {
  return typeof document !== 'undefined' ? document.getElementById('notice-modal') : null;
}

function getNoticeMessageEl() {
  return typeof document !== 'undefined' ? document.getElementById('notice-modal-message') : null;
}

function getNoticeCountdownEl() {
  return typeof document !== 'undefined' ? document.getElementById('notice-modal-countdown') : null;
}

function getRefreshButton() {
  return typeof document !== 'undefined' ? document.getElementById('btn-refresh-data') : null;
}

function clearNoticeTimers() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

export function remainingHoldSeconds(holdUntilMs, now = Date.now()) {
  if (!holdUntilMs) return 0;
  return Math.max(0, Math.ceil((holdUntilMs - now) / 1000));
}

export function renderNoticeCountdown(now = Date.now()) {
  const el = getNoticeCountdownEl();
  if (!el) return 0;

  const remaining = remainingHoldSeconds(holdUntil, now);
  el.innerText = remaining;
  if (el.style) el.style.display = remaining > 0 ? '' : 'none';
  return remaining;
}

export function isNoticeOpen() {
  const modal = getNoticeModal();
  return !!(modal && modal.classList && modal.classList.contains('open'));
}

/**
 * Show Notice Panel. Does not close itself.
 * @param {string} [message]
 */
export function openNoticePanel(message = NOTICE_SYNC_MESSAGE) {
  const modal = getNoticeModal();
  if (!modal) return;

  const msgElem = getNoticeMessageEl();
  if (msgElem) msgElem.innerText = message;

  modal.classList.add('open');
  getRefreshButton()?.classList.add('active');
}

export function closeNoticePanel() {
  clearNoticeTimers();
  holdUntil = 0;
  const modal = getNoticeModal();
  if (modal) modal.classList.remove('open');
  getRefreshButton()?.classList.remove('active');
}

/**
 * Keep the panel open until both the work and the minimum hold have finished.
 * @param {Promise<unknown>} workPromise
 * @param {{ message?: string, minVisibleMs?: number }} [options]
 */
export async function showNoticeUntil(workPromise, options = {}) {
  const message = options.message ?? NOTICE_SYNC_MESSAGE;
  const minVisibleMs = Number.isFinite(options.minVisibleMs) ? options.minVisibleMs : NOTICE_MIN_VISIBLE_MS;

  holdUntil = Date.now() + minVisibleMs;
  openNoticePanel(message);
  renderNoticeCountdown();
  tickTimer = setInterval(() => renderNoticeCountdown(), NOTICE_TICK_MS);

  const hold = new Promise((resolve) => {
    holdTimer = setTimeout(resolve, minVisibleMs);
  });

  let workError;
  const work = Promise.resolve(workPromise).catch((err) => {
    workError = err;
  });

  try {
    await Promise.all([work, hold]);
  } finally {
    closeNoticePanel();
  }

  if (workError) throw workError;
}
