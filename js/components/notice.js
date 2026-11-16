/**
 * Notice Panel — blocking status overlay (e.g. hall sync).
 */
export const NOTICE_MIN_VISIBLE_MS = 5000;
const NOTICE_SYNC_MESSAGE = '展廳同步中';
const NOTICE_TICK_MS = 1000;

let holdTimer = null;
let tickTimer = null;
let holdUntil = 0;

const byId = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

function clearNoticeTimers() {
  clearTimeout(holdTimer);
  clearInterval(tickTimer);
  holdTimer = null;
  tickTimer = null;
}

function renderNoticeCountdown() {
  const el = byId('notice-modal-countdown');
  if (el) el.innerText = Math.max(0, Math.ceil((holdUntil - Date.now()) / 1000));
}

/** Shows the Notice Panel. Does not close itself. */
function openNoticePanel(message = NOTICE_SYNC_MESSAGE) {
  const modal = byId('notice-modal');
  if (!modal) return;
  const msgElem = byId('notice-modal-message');
  if (msgElem) msgElem.innerText = message;
  modal.classList.add('open');
  byId('btn-refresh-data')?.classList.add('active');
}

function closeNoticePanel() {
  clearNoticeTimers();
  holdUntil = 0;
  byId('notice-modal')?.classList.remove('open');
  byId('btn-refresh-data')?.classList.remove('active');
}

/**
 * Keeps the panel open until both the work and the minimum hold have finished.
 * Re-throws the work's error after closing.
 */
export async function showNoticeUntil(workPromise, { message = NOTICE_SYNC_MESSAGE, minVisibleMs = NOTICE_MIN_VISIBLE_MS } = {}) {
  holdUntil = Date.now() + minVisibleMs;
  openNoticePanel(message);
  renderNoticeCountdown();
  tickTimer = setInterval(renderNoticeCountdown, NOTICE_TICK_MS);

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
