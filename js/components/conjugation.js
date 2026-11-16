/**
 * C103 Conjugation panel + mobile Item ⇄ Conjugation swipe pager.
 */
import { store } from '../state.js';
import { findConjugationByLemma } from '../data.js';
import { escapeHtml, getTimers, isMobileViewport } from '../utils.js';
import { getConjugationLemma, getWorkProfessionalRows, isConjugatableRecord } from '../conjugations.js';
import { syncHash, collectionHash, findRecordByRow, getActiveItemRowIndex, closeDescriptionModal, closeProfileModal } from './modal.js';

const BUTTON_HOLD_MS = 420;
const PAGER_SLOW_MS = 800;
const SWIPE_THRESHOLD_PX = 56;
const SWIPE_AXIS_RATIO = 1.2;
const RUBBER_BAND = 0.32;
const AXIS_LOCK_PX = 8;
const PAGER_CLASSES = ['pager-paired', 'pager-ready', 'pager-dragging', 'pager-anim', 'pager-slow'];

let pagerSlowTimer = null;
let pagerHoldTimer = null;
let pagerSwipe = null;

const getItemModal = () => document.getElementById('detail-modal');
const getConjugationModal = () => document.getElementById('conjugation-modal');

function forBothPages(fn) {
  [getItemModal(), getConjugationModal()].forEach(el => el && fn(el));
}

/** Conjugation entry for a C103 verb/adjective record, or null. */
export function getRecordConjugation(rec) {
  if (!rec || store.get().currentCollectionId !== 'korean-terms' || !isConjugatableRecord(rec)) return null;
  return findConjugationByLemma(getConjugationLemma(rec));
}

function setConjugationActive(isActive) {
  document.getElementById('modal-view-conjugation')?.classList.toggle('active', Boolean(isActive));
}

function renderConjugationColumn(section) {
  const forms = section.forms.map(form => `
    <div class="conjugation-form">
      <div class="conjugation-form-value">${escapeHtml(form.value)}</div>
    </div>
  `).join('');
  return `
    <div class="awsui-modal-section conjugation-section conjugation-section-${escapeHtml(section.id)}">
      <div class="awsui-modal-section-title"><span>${escapeHtml(section.title)}</span></div>
      <div class="conjugation-forms conjugation-forms-${escapeHtml(section.id)}">${forms}</div>
    </div>
  `;
}

function fillConjugationPanel(rowIndex) {
  const rec = findRecordByRow(rowIndex);
  const entry = getRecordConjugation(rec);
  if (!entry) return null;

  const titleElem = document.getElementById('conjugation-modal-title');
  const bodyElem = document.getElementById('conjugation-modal-body');
  if (titleElem) titleElem.innerText = getConjugationLemma(rec) || rec.ja_term || '--';
  if (bodyElem) {
    bodyElem.innerHTML = getWorkProfessionalRows(entry)
      .map(row => `<div class="conjugation-row">${row.map(renderConjugationColumn).join('')}</div>`)
      .join('');
  }
  return rec;
}

export function openConjugationModal(rowIndex, updateHash = true) {
  const rec = fillConjugationPanel(rowIndex);
  if (!rec) return;

  closeDescriptionModal(false);
  closeProfileModal(false);
  setConjugationActive(true);
  getConjugationModal()?.classList.add('open');
  syncItemConjugationPager();

  if (updateHash) syncHash(collectionHash(store.get().currentCollectionId, rec.ja_term, 'conjugation'));
}

export function closeConjugationModal(updateHash = true) {
  cancelPagerHold();
  setConjugationActive(false);
  getConjugationModal()?.classList.remove('open');
  syncItemConjugationPager();

  if (updateHash) {
    const rec = findRecordByRow(getActiveItemRowIndex());
    syncHash(collectionHash(store.get().currentCollectionId, rec?.ja_term));
  }
}

export function closeConjugationModalOnBackdrop(e) {
  if (e?.target?.id === 'conjugation-modal') closeConjugationModal();
}

/* ------------------------------------------------------------------ */
/* Mobile pager                                                       */
/* ------------------------------------------------------------------ */

function markPagerSlow() {
  if (!isMobileViewport()) return;
  forBothPages(el => el.classList.add('pager-slow', 'pager-anim'));
}

function clearPagerSlow() {
  if (pagerSlowTimer != null) {
    getTimers().clear(pagerSlowTimer);
    pagerSlowTimer = null;
  }
  forBothPages(el => el.classList.remove('pager-slow'));
}

function cancelPagerHold() {
  if (pagerHoldTimer == null) return;
  getTimers().clear(pagerHoldTimer);
  pagerHoldTimer = null;
}

/** Item modal "Conjugation" button. On mobile, hold the pressed state briefly, then slide over. */
export function handleConjugationClick() {
  const rowIndex = getActiveItemRowIndex();
  if (rowIndex === null) return;
  if (!isMobileViewport()) {
    openConjugationModal(rowIndex);
    return;
  }
  if (getConjugationModal()?.classList.contains('open') || pagerHoldTimer != null) return;
  if (!fillConjugationPanel(rowIndex)) return;
  setConjugationActive(true);
  markPagerSlow();
  const { set, clear } = getTimers();
  pagerHoldTimer = set(() => {
    pagerHoldTimer = null;
    openConjugationModal(rowIndex);
    if (pagerSlowTimer != null) clear(pagerSlowTimer);
    pagerSlowTimer = set(clearPagerSlow, PAGER_SLOW_MS);
  }, BUTTON_HOLD_MS);
}

/** iOS-style rubber band: resistance grows with overshoot, never exceeding `range * constant`. */
export function rubberBandOffset(overshootPx, rangePx, constant = RUBBER_BAND) {
  const range = Math.max(1, Number(rangePx) || 1);
  const overshoot = Number(overshootPx) || 0;
  const abs = Math.abs(overshoot);
  return Math.sign(overshoot || 1) * ((abs * range * constant) / (range + (abs * constant)));
}

/**
 * Resolves a horizontal swipe between the Item page (0) and the Conjugation page (1).
 * Returns the action to take plus the drag offsets to render for each page.
 */
export function resolveItemConjugationSwipe(dx, dy, pageWidth, { canGoConjugation = false, onConjugation = false } = {}) {
  const width = Math.max(1, Number(pageWidth) || 1);
  const x = Number(dx) || 0;
  const absX = Math.abs(x);
  if (absX < AXIS_LOCK_PX || absX < Math.abs(Number(dy) || 0) * SWIPE_AXIS_RATIO) {
    return { action: 'ignore', rubberBand: false, itemDrag: 0, conjDrag: 0 };
  }

  const pastThreshold = absX >= SWIPE_THRESHOLD_PX;
  if (!onConjugation && x < 0 && canGoConjugation) {
    const drag = Math.max(x, -width);
    return { action: pastThreshold ? 'open-conjugation' : 'stay', rubberBand: false, itemDrag: drag, conjDrag: drag };
  }
  if (onConjugation && x > 0) {
    const drag = Math.min(x, width);
    return { action: pastThreshold ? 'close-conjugation' : 'stay', rubberBand: false, itemDrag: drag, conjDrag: drag };
  }
  const offset = rubberBandOffset(x, width);
  return {
    action: 'rubber',
    rubberBand: true,
    itemDrag: onConjugation ? 0 : offset,
    conjDrag: onConjugation ? offset : 0
  };
}

function getPagerWidth() {
  const w = globalThis.window?.innerWidth;
  return typeof w === 'number' && w > 0 ? w : 390;
}

function setPagerX(el, px) {
  el?.style?.setProperty?.('--cgo-pager-x', `${px}px`);
}

function applyPagerOffsets({ page = 0, itemDrag = 0, conjDrag = 0, width = getPagerWidth() } = {}) {
  setPagerX(getItemModal(), (page === 1 ? -width : 0) + itemDrag);
  setPagerX(getConjugationModal(), (page === 1 ? 0 : width) + conjDrag);
}

function canSwipeToConjugation() {
  return Boolean(getRecordConjugation(findRecordByRow(getActiveItemRowIndex())));
}

/** Pairs the Item and Conjugation modals side by side on mobile when the item is conjugatable. */
export function syncItemConjugationPager() {
  if (typeof document === 'undefined') return;
  const detail = getItemModal();
  const conj = getConjugationModal();
  if (!detail || !conj) return;

  const itemOpen = detail.classList.contains('open');
  const conjOpen = conj.classList.contains('open');
  const canSwipe = canSwipeToConjugation();

  if (!isMobileViewport() || !itemOpen || !(conjOpen || canSwipe)) {
    forBothPages(el => {
      el.classList.remove(...PAGER_CLASSES);
      el.style?.removeProperty?.('--cgo-pager-x');
    });
    return;
  }

  applyPagerOffsets({ page: conjOpen ? 1 : 0 });
  forBothPages(el => el.classList.add('pager-paired'));

  if (!conjOpen && canSwipe) {
    fillConjugationPanel(getActiveItemRowIndex());
    conj.classList.add('pager-ready');
  } else {
    conj.classList.remove('pager-ready');
  }

  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 16);
  raf(() => {
    if (detail.classList.contains('pager-paired')) forBothPages(el => el.classList.add('pager-anim'));
  });
}

function getTouchPoint(e) {
  const t = e?.touches?.[0] || e?.changedTouches?.[0];
  return t ? { x: t.clientX, y: t.clientY } : null;
}

function onTouchStart(e) {
  if (!isMobileViewport()) return;
  if (pagerHoldTimer != null) {
    cancelPagerHold();
    setConjugationActive(false);
  }
  clearPagerSlow();

  const detail = getItemModal();
  const conj = getConjugationModal();
  if (!detail?.classList.contains('open')) return;
  if (e.target?.closest?.('button, a, input, textarea, select')) return;

  const onConjugation = Boolean(conj?.classList.contains('open'));
  const canGoConjugation = canSwipeToConjugation();
  if (!onConjugation && !canGoConjugation) return;

  const host = onConjugation ? conj : detail;
  if (typeof host.contains === 'function' && !host.contains(e.target)) return;

  const point = getTouchPoint(e);
  if (!point) return;
  pagerSwipe = { startX: point.x, startY: point.y, lastX: point.x, lastY: point.y, axis: null, onConjugation, canGoConjugation };
}

function onTouchMove(e) {
  if (!pagerSwipe) return;
  const point = getTouchPoint(e);
  if (!point) return;
  pagerSwipe.lastX = point.x;
  pagerSwipe.lastY = point.y;
  const dx = point.x - pagerSwipe.startX;
  const dy = point.y - pagerSwipe.startY;

  if (!pagerSwipe.axis) {
    if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
    pagerSwipe.axis = Math.abs(dx) >= Math.abs(dy) * SWIPE_AXIS_RATIO ? 'x' : 'y';
  }
  if (pagerSwipe.axis !== 'x') return;

  e.preventDefault?.();
  forBothPages(el => el.classList.add('pager-dragging'));
  if (!pagerSwipe.onConjugation && pagerSwipe.canGoConjugation) {
    getConjugationModal()?.classList.add('pager-ready');
  }
  const width = getPagerWidth();
  const { itemDrag, conjDrag } = resolveItemConjugationSwipe(dx, 0, width, pagerSwipe);
  applyPagerOffsets({ page: pagerSwipe.onConjugation ? 1 : 0, itemDrag, conjDrag, width });
}

function onTouchEnd(e) {
  if (!pagerSwipe) return;
  const swipe = pagerSwipe;
  pagerSwipe = null;
  forBothPages(el => el.classList.remove('pager-dragging'));
  if (swipe.axis !== 'x') {
    syncItemConjugationPager();
    return;
  }

  const point = getTouchPoint(e) || { x: swipe.lastX, y: swipe.lastY };
  const { action } = resolveItemConjugationSwipe(point.x - swipe.startX, point.y - swipe.startY, getPagerWidth(), swipe);
  const rowIndex = getActiveItemRowIndex();
  if (action === 'open-conjugation' && rowIndex !== null) {
    openConjugationModal(rowIndex);
  } else if (action === 'close-conjugation') {
    closeConjugationModal();
  } else {
    syncItemConjugationPager();
  }
}

export function initItemConjugationPager() {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchEnd);
  globalThis.window?.addEventListener?.('resize', syncItemConjugationPager);
}
