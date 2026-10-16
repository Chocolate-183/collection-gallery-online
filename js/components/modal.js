/**
 * Detail Modal Component
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';
import { collectionsCache, collectionsMetaCache, findProfileByName, findConjugationByLemma } from '../data.js';
import { escapeHtml, parseRecommendationList, formatExhibitTitleHtml, formatStdictReferenceHtml, getExhibitCategoryLabel, getExhibitDisplayTitle } from '../utils.js';
import { getConjugationLemma, getWorkProfessionalRows, isConjugatableRecord } from '../conjugations.js';
import { isCatalogMobile } from '../filter.js';

function syncHash(newHash) {
  if (typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== newHash) {
    location.hash = newHash;
  }
}

function getCollectionSlug(colId) {
  const col = collectionsConfig[colId];
  return col ? col.name : colId;
}

export const STDICT_OPEN_DELAY_MS = 500;
let stdictOpenTimer = null;

function clearStdictOpenTimer() {
  if (stdictOpenTimer) {
    clearTimeout(stdictOpenTimer);
    stdictOpenTimer = null;
  }
}

export function handleStdictReferenceClick(event) {
  const link = event?.target?.closest?.('.modal-reference-link');
  if (!link) return;
  event.preventDefault();
  const url = link.getAttribute('href');
  if (!url) return;
  clearStdictOpenTimer();
  link.classList.add('active');
  stdictOpenTimer = setTimeout(() => {
    stdictOpenTimer = null;
    link.classList.remove('active');
    if (typeof link.blur === 'function') link.blur();
    window.open(url, '_blank', 'noopener,noreferrer');
  }, STDICT_OPEN_DELAY_MS);
}

/**
 * Navigates directly to a target recommended term's detail modal.
 * @param {string} term - Term name or ID to open
 */
export function navigateToTerm(term) {
  if (!term) return;
  const { currentCollectionId, allRecords } = store.get();
  const colSlug = getCollectionSlug(currentCollectionId);

  // 1. Try finding in current collection
  let targetRec = allRecords.find(r => r.ja_term === term || r.id === term);
  if (targetRec) {
    openMeaningModal(targetRec.row_index, true);
    return;
  }

  // 2. Try finding in other cached collections
  for (const [colId, records] of Object.entries(collectionsCache)) {
    if (colId === currentCollectionId || !Array.isArray(records)) continue;
    targetRec = records.find(r => r.ja_term === term || r.id === term);
    if (targetRec) {
      location.hash = `#/${getCollectionSlug(colId)}/${targetRec.ja_term}`;
      return;
    }
  }

  // 3. Fallback: navigate via hash in current collection
  location.hash = `#/${colSlug}/${term}`;
}

/**
 * Standard accessor for Item Modal Description element.
 * @returns {HTMLElement|null}
 */
function getMeaningElement() {
  return typeof document !== 'undefined'
    ? (document.querySelector?.('#modal-meaning-text') || document.getElementById?.('modal-meaning-text') || null)
    : null;
}

function checkMeaningExceedsLines(maxLines, text, meaningElem) {
  const elem = meaningElem || getMeaningElement();
  const content = (text !== undefined && text !== null) ? text : (elem ? elem.innerText : '');
  if (!content) return false;

  const rawLines = content.split(/\r?\n/);
  if (rawLines.length > maxLines) return true;

  if (elem && elem.clientHeight > 0) {
    const thresholdHeight = 18 * 1.65 * maxLines;
    if (elem.scrollHeight > (thresholdHeight + 1)) {
      return true;
    }
  }

  let wrappedLines = 0;
  for (const line of rawLines) {
    wrappedLines += Math.max(1, Math.ceil(line.length / 25));
  }
  return wrappedLines > maxLines;
}

export const checkMeaningExceedsTwoLines = (text, meaningElem) => checkMeaningExceedsLines(2, text, meaningElem);

/**
 * Checks if the meaning element has vertical scrolling content.
 * @param {HTMLElement} [meaningElem]
 * @returns {boolean}
 */
export function checkMeaningHasScroll(meaningElem) {
  const elem = meaningElem || getMeaningElement();
  if (!elem || !(elem.clientHeight > 0)) return false;
  return elem.scrollHeight > (elem.clientHeight + 1);
}

/**
 * Handles double-click event on modal meaning text to open Description modal.
 */
export function handleMeaningTextClick() {
  if (isCatalogMobile()) return;
  const meaningElem = getMeaningElement();
  if (!meaningElem) return;
  const rowIndexStr = typeof meaningElem.getAttribute === 'function'
    ? meaningElem.getAttribute('data-row-index')
    : meaningElem['data-row-index'];
  const rowIndex = rowIndexStr !== null && rowIndexStr !== undefined ? parseInt(rowIndexStr, 10) : null;
  if (rowIndex !== null && !isNaN(rowIndex)) {
    openDescriptionModal(rowIndex);
  }
}

/**
 * Handles double-click event on collection modal description to open Description modal.
 */
export function handleCollectionDescriptionClick() {
  if (isCatalogMobile()) return;
  const { currentCollectionId } = store.get();
  const descElem = document.getElementById('collection-modal-description');
  const descText = descElem ? descElem.innerText : '';
  openCollectionDescriptionModal(currentCollectionId, descText);
}

/**
 * Handles click on Collection Curator to open Profile panel.
 */
export function handleCuratorClick() {
  const curatorElem = document.getElementById('collection-modal-curator');
  const name = curatorElem ? String(curatorElem.innerText || '').trim() : '';
  if (!name || name === '--') return;
  openProfileModal(name);
}

function setConjugationActive(isActive) {
  if (typeof document === 'undefined') return;
  const conjugationElem = document.getElementById('modal-view-conjugation');
  if (conjugationElem && conjugationElem.classList) {
    conjugationElem.classList.toggle('active', !!isActive);
  }
}

function getActiveItemRowIndex() {
  const meaningElem = getMeaningElement();
  const rowIndexStr = meaningElem && typeof meaningElem.getAttribute === 'function'
    ? meaningElem.getAttribute('data-row-index')
    : null;
  const rowIndex = rowIndexStr !== null && rowIndexStr !== undefined ? parseInt(rowIndexStr, 10) : null;
  if (rowIndex === null || Number.isNaN(rowIndex)) return null;
  return rowIndex;
}

export const ITEM_CONJUGATION_BUTTON_HOLD_MS = 420;

let pagerSlowTimer = null;
let pagerHoldTimer = null;

function getTimerFns() {
  const clearTimer = (typeof window !== 'undefined' && window.clearTimeout) || clearTimeout;
  const schedule = (typeof window !== 'undefined' && window.setTimeout) || setTimeout;
  return { clearTimer, schedule };
}

function markPagerSlow() {
  if (!isCatalogMobile() || typeof document === 'undefined') return;
  const detail = document.getElementById('detail-modal');
  const conj = document.getElementById('conjugation-modal');
  detail?.classList?.add('pager-slow', 'pager-anim');
  conj?.classList?.add('pager-slow', 'pager-anim');
}

function clearPagerSlow() {
  const { clearTimer } = getTimerFns();
  if (pagerSlowTimer != null) {
    clearTimer(pagerSlowTimer);
    pagerSlowTimer = null;
  }
  if (typeof document === 'undefined') return;
  const detail = document.getElementById('detail-modal');
  const conj = document.getElementById('conjugation-modal');
  detail?.classList?.remove('pager-slow');
  conj?.classList?.remove('pager-slow');
}

function scheduleClearPagerSlow() {
  const { clearTimer, schedule } = getTimerFns();
  if (pagerSlowTimer != null) clearTimer(pagerSlowTimer);
  pagerSlowTimer = schedule(() => {
    pagerSlowTimer = null;
    clearPagerSlow();
  }, 800);
}

function cancelPagerHold() {
  const { clearTimer } = getTimerFns();
  if (pagerHoldTimer == null) return;
  clearTimer(pagerHoldTimer);
  pagerHoldTimer = null;
}

export function handleConjugationClick() {
  const rowIndex = getActiveItemRowIndex();
  if (rowIndex === null) return;
  if (!isCatalogMobile()) {
    openConjugationModal(rowIndex);
    return;
  }
  const conj = document.getElementById('conjugation-modal');
  if (conj?.classList?.contains('open') || pagerHoldTimer != null) return;
  if (!fillConjugationPanel(rowIndex)) return;
  setConjugationActive(true);
  markPagerSlow();
  const { schedule } = getTimerFns();
  pagerHoldTimer = schedule(() => {
    pagerHoldTimer = null;
    openConjugationModal(rowIndex);
    scheduleClearPagerSlow();
  }, ITEM_CONJUGATION_BUTTON_HOLD_MS);
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

function renderConjugationSections(entry) {
  return getWorkProfessionalRows(entry).map(row => `
    <div class="conjugation-row">
      ${row.map(renderConjugationColumn).join('')}
    </div>
  `).join('');
}

function fillConjugationPanel(rowIndex) {
  const { allRecords, currentCollectionId } = store.get();
  const rec = allRecords.find(r => r.row_index === rowIndex);
  if (!rec || currentCollectionId !== 'korean-terms' || !isConjugatableRecord(rec)) return null;

  const lemma = getConjugationLemma(rec);
  const entry = findConjugationByLemma(lemma);
  if (!entry) return null;

  const titleElem = document.getElementById('conjugation-modal-title');
  const bodyElem = document.getElementById('conjugation-modal-body');
  if (titleElem) titleElem.innerText = lemma || rec.ja_term || '--';
  if (bodyElem) bodyElem.innerHTML = renderConjugationSections(entry);
  return rec;
}

export function openConjugationModal(rowIndex, updateHash = true) {
  const rec = fillConjugationPanel(rowIndex);
  if (!rec) return;

  const { currentCollectionId } = store.get();
  closeDescriptionModal(false);
  closeProfileModal(false);

  const modal = document.getElementById('conjugation-modal');
  setConjugationActive(true);
  if (modal) modal.classList.add('open');
  syncItemConjugationPager();

  if (updateHash) {
    syncHash(`#/${getCollectionSlug(currentCollectionId)}/${rec.ja_term}/conjugation`);
  }
}

export function closeConjugationModal(updateHash = true) {
  cancelPagerHold();
  setConjugationActive(false);
  const modal = document.getElementById('conjugation-modal');
  if (modal) modal.classList.remove('open');
  syncItemConjugationPager();

  if (updateHash) {
    const { currentCollectionId, allRecords } = store.get();
    const colSlug = getCollectionSlug(currentCollectionId);
    const rowIndex = getActiveItemRowIndex();
    const rec = rowIndex !== null ? allRecords.find(r => r.row_index === rowIndex) : null;
    syncHash(rec ? `#/${colSlug}/${rec.ja_term}` : `#/${colSlug}`);
  }
}

export const ITEM_CONJUGATION_SWIPE_THRESHOLD_PX = 56;
export const ITEM_CONJUGATION_SWIPE_AXIS_RATIO = 1.2;
export const ITEM_CONJUGATION_RUBBER_BAND = 0.32;
const ITEM_CONJUGATION_AXIS_LOCK_PX = 8;

export function rubberBandOffset(overshootPx, rangePx, constant = ITEM_CONJUGATION_RUBBER_BAND) {
  const range = Math.max(1, Number(rangePx) || 1);
  const overshoot = Number(overshootPx) || 0;
  const sign = overshoot < 0 ? -1 : 1;
  const abs = Math.abs(overshoot);
  return sign * ((abs * range * constant) / (range + (abs * constant)));
}

export function resolveItemConjugationSwipe(dx, dy, pageWidth, options = {}) {
  const {
    canGoConjugation = false,
    onConjugation = false,
    thresholdPx = ITEM_CONJUGATION_SWIPE_THRESHOLD_PX,
    axisRatio = ITEM_CONJUGATION_SWIPE_AXIS_RATIO,
    rubberBand = ITEM_CONJUGATION_RUBBER_BAND
  } = options;
  const width = Math.max(1, Number(pageWidth) || 1);
  const x = Number(dx) || 0;
  const y = Number(dy) || 0;
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX < ITEM_CONJUGATION_AXIS_LOCK_PX || absX < absY * axisRatio) {
    return { action: 'ignore', rubberBand: false, itemDrag: 0, conjDrag: 0 };
  }
  if (!onConjugation) {
    if (x < 0 && canGoConjugation) {
      const drag = Math.max(x, -width);
      return {
        action: absX >= thresholdPx ? 'open-conjugation' : 'stay',
        rubberBand: false,
        itemDrag: drag,
        conjDrag: drag
      };
    }
    return {
      action: 'rubber',
      rubberBand: true,
      itemDrag: rubberBandOffset(x, width, rubberBand),
      conjDrag: 0
    };
  }
  if (x > 0) {
    const drag = Math.min(x, width);
    return {
      action: absX >= thresholdPx ? 'close-conjugation' : 'stay',
      rubberBand: false,
      itemDrag: drag,
      conjDrag: drag
    };
  }
  return {
    action: 'rubber',
    rubberBand: true,
    itemDrag: 0,
    conjDrag: rubberBandOffset(x, width, rubberBand)
  };
}

function getPagerWidth() {
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0) {
    return window.innerWidth;
  }
  return 390;
}

function setPagerX(el, px) {
  if (!el || !el.style || typeof el.style.setProperty !== 'function') return;
  el.style.setProperty('--cgo-pager-x', `${px}px`);
}

function clearPagerX(el) {
  if (!el || !el.style || typeof el.style.removeProperty !== 'function') return;
  el.style.removeProperty('--cgo-pager-x');
}

export function applyItemConjugationPagerOffsets({ page = 0, itemDrag = 0, conjDrag = 0, width } = {}) {
  const w = Math.max(1, Number(width) || getPagerWidth());
  const itemX = (page === 1 ? -w : 0) + (Number(itemDrag) || 0);
  const conjX = (page === 1 ? 0 : w) + (Number(conjDrag) || 0);
  setPagerX(document.getElementById('detail-modal'), itemX);
  setPagerX(document.getElementById('conjugation-modal'), conjX);
}

export function canSwipeToConjugation() {
  const rowIndex = getActiveItemRowIndex();
  if (rowIndex === null) return false;
  const { allRecords, currentCollectionId } = store.get();
  const rec = allRecords.find(r => r.row_index === rowIndex);
  if (!rec || currentCollectionId !== 'korean-terms' || !isConjugatableRecord(rec)) return false;
  return Boolean(findConjugationByLemma(getConjugationLemma(rec)));
}

export function syncItemConjugationPager() {
  if (typeof document === 'undefined') return;
  const detail = document.getElementById('detail-modal');
  const conj = document.getElementById('conjugation-modal');
  if (!detail || !conj) return;

  const itemOpen = Boolean(detail.classList?.contains('open'));
  const conjOpen = Boolean(conj.classList?.contains('open'));
  const pairable = isCatalogMobile() && itemOpen && (conjOpen || canSwipeToConjugation());

  if (!pairable) {
    detail.classList?.remove('pager-paired', 'pager-ready', 'pager-dragging', 'pager-anim', 'pager-slow');
    conj.classList?.remove('pager-paired', 'pager-ready', 'pager-dragging', 'pager-anim', 'pager-slow');
    clearPagerX(detail);
    clearPagerX(conj);
    return;
  }

  applyItemConjugationPagerOffsets({ page: conjOpen ? 1 : 0, itemDrag: 0, conjDrag: 0 });
  detail.classList?.add('pager-paired');
  conj.classList?.add('pager-paired');

  if (!conjOpen && canSwipeToConjugation()) {
    fillConjugationPanel(getActiveItemRowIndex());
    conj.classList?.add('pager-ready');
  } else {
    conj.classList?.remove('pager-ready');
  }

  const raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (fn) => setTimeout(fn, 16);
  raf(() => {
    if (!detail.classList?.contains('pager-paired')) return;
    detail.classList?.add('pager-anim');
    conj.classList?.add('pager-anim');
  });
}

function getTouchPoint(e) {
  const t = e?.touches?.[0] || e?.changedTouches?.[0];
  if (!t) return null;
  return { x: t.clientX, y: t.clientY };
}

function isPagerControlTarget(target) {
  return Boolean(target?.closest?.('button, a, input, textarea, select'));
}

let pagerSwipe = null;

function onItemConjugationTouchStart(e) {
  if (!isCatalogMobile()) return;
  if (pagerHoldTimer != null) {
    cancelPagerHold();
    setConjugationActive(false);
  }
  clearPagerSlow();
  const detail = document.getElementById('detail-modal');
  const conj = document.getElementById('conjugation-modal');
  if (!detail?.classList?.contains('open')) return;
  if (isPagerControlTarget(e.target)) return;
  const onConjugation = Boolean(conj?.classList?.contains('open'));
  const canGoConjugation = canSwipeToConjugation();
  if (!onConjugation && !canGoConjugation) return;
  const host = onConjugation ? conj : detail;
  if (!host || (typeof host.contains === 'function' && !host.contains(e.target))) return;
  const point = getTouchPoint(e);
  if (!point) return;
  pagerSwipe = {
    startX: point.x,
    startY: point.y,
    lastX: point.x,
    lastY: point.y,
    axis: null,
    onConjugation,
    canGoConjugation
  };
}

function onItemConjugationTouchMove(e) {
  if (!pagerSwipe) return;
  const point = getTouchPoint(e);
  if (!point) return;
  pagerSwipe.lastX = point.x;
  pagerSwipe.lastY = point.y;
  const dx = point.x - pagerSwipe.startX;
  const dy = point.y - pagerSwipe.startY;
  if (!pagerSwipe.axis) {
    if (Math.abs(dx) < ITEM_CONJUGATION_AXIS_LOCK_PX && Math.abs(dy) < ITEM_CONJUGATION_AXIS_LOCK_PX) return;
    pagerSwipe.axis = Math.abs(dx) >= Math.abs(dy) * ITEM_CONJUGATION_SWIPE_AXIS_RATIO ? 'x' : 'y';
  }
  if (pagerSwipe.axis !== 'x') return;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  const detail = document.getElementById('detail-modal');
  const conj = document.getElementById('conjugation-modal');
  detail?.classList?.add('pager-dragging');
  conj?.classList?.add('pager-dragging');
  if (!pagerSwipe.onConjugation && pagerSwipe.canGoConjugation) {
    conj?.classList?.add('pager-ready');
  }
  const width = getPagerWidth();
  const resolved = resolveItemConjugationSwipe(dx, 0, width, {
    canGoConjugation: pagerSwipe.canGoConjugation,
    onConjugation: pagerSwipe.onConjugation
  });
  applyItemConjugationPagerOffsets({
    page: pagerSwipe.onConjugation ? 1 : 0,
    itemDrag: resolved.itemDrag,
    conjDrag: resolved.conjDrag,
    width
  });
}

function onItemConjugationTouchEnd(e) {
  if (!pagerSwipe) return;
  const state = pagerSwipe;
  pagerSwipe = null;
  const detail = document.getElementById('detail-modal');
  const conj = document.getElementById('conjugation-modal');
  detail?.classList?.remove('pager-dragging');
  conj?.classList?.remove('pager-dragging');
  if (state.axis !== 'x') {
    syncItemConjugationPager();
    return;
  }
  const point = getTouchPoint(e) || { x: state.lastX, y: state.lastY };
  const resolved = resolveItemConjugationSwipe(point.x - state.startX, point.y - state.startY, getPagerWidth(), {
    canGoConjugation: state.canGoConjugation,
    onConjugation: state.onConjugation
  });
  if (resolved.action === 'open-conjugation') {
    const rowIndex = getActiveItemRowIndex();
    if (rowIndex !== null) openConjugationModal(rowIndex);
    else syncItemConjugationPager();
    return;
  }
  if (resolved.action === 'close-conjugation') {
    closeConjugationModal();
    return;
  }
  syncItemConjugationPager();
}

export function initItemConjugationPager() {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  document.addEventListener('touchstart', onItemConjugationTouchStart, { passive: true });
  document.addEventListener('touchmove', onItemConjugationTouchMove, { passive: false });
  document.addEventListener('touchend', onItemConjugationTouchEnd);
  document.addEventListener('touchcancel', onItemConjugationTouchEnd);
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => {
      syncItemConjugationPager();
    });
  }
}

function setCuratorActive(isActive) {
  if (typeof document === 'undefined') return;
  const curatorElem = document.getElementById('collection-modal-curator');
  if (curatorElem && curatorElem.classList) {
    curatorElem.classList.toggle('active', !!isActive);
  }
}

function setProfileField(sectionId, valueId, value) {
  const text = value == null ? '' : String(value).trim();
  const section = document.getElementById(sectionId);
  const elem = document.getElementById(valueId);
  if (elem) elem.innerText = text || '--';
  if (section) section.style.display = text ? '' : 'none';
}

/**
 * Opens Profile panel for a curator name (matched against profiles sheet).
 */
export function openProfileModal(curatorName, updateHash = true) {
  const name = curatorName == null ? '' : String(curatorName).trim();
  if (!name || name === '--') return;

  const profile = findProfileByName(name) || {
    id: '',
    enName: '',
    zhName: name,
    ig: '',
    youtube: '',
    gmail: '',
    description: ''
  };

  const modal = document.getElementById('profile-modal');
  const nameElem = document.getElementById('profile-modal-name');
  const descElem = document.getElementById('profile-modal-description');
  const descSection = document.getElementById('profile-modal-description-section');
  const idElem = document.getElementById('profile-modal-id');

  if (nameElem) nameElem.innerText = profile.zhName || profile.enName || name;
  setProfileField('profile-modal-en-section', 'profile-modal-en', profile.enName);
  setProfileField('profile-modal-ig-section', 'profile-modal-ig', profile.ig);
  setProfileField('profile-modal-youtube-section', 'profile-modal-youtube', profile.youtube);
  setProfileField('profile-modal-gmail-section', 'profile-modal-gmail', profile.gmail);

  const socialRow = document.getElementById('profile-modal-social-row');
  if (socialRow) {
    const igText = profile.ig == null ? '' : String(profile.ig).trim();
    const ytText = profile.youtube == null ? '' : String(profile.youtube).trim();
    socialRow.style.display = (igText || ytText) ? '' : 'none';
  }

  const descText = profile.description ? String(profile.description).trim() : '';
  if (descElem) {
    descElem.innerText = descText || '--';
    if (descElem.classList) {
      descElem.classList.toggle('is-multiline', checkMeaningExceedsTwoLines(descText, descElem));
      descElem.classList.toggle('has-scroll', checkMeaningHasScroll(descElem));
    }
  }
  if (descSection) descSection.style.display = descText ? '' : 'none';
  if (idElem) idElem.innerText = profile.id || '--';

  closeDescriptionModal(false);
  closeConjugationModal(false);
  setCuratorActive(true);
  if (modal) modal.classList.add('open');

  if (updateHash) {
    const { currentCollectionId } = store.get();
    syncHash(`#/${getCollectionSlug(currentCollectionId)}/info/profile`);
  }
}

export function closeProfileModal(updateHash = true) {
  setCuratorActive(false);
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('open');

  if (updateHash) {
    const collectionModal = document.getElementById('collection-modal');
    const isCollectionModalOpen = collectionModal && collectionModal.classList.contains('open');
    const { currentCollectionId } = store.get();
    const colSlug = getCollectionSlug(currentCollectionId);
    syncHash(isCollectionModalOpen ? `#/${colSlug}/info` : `#/${colSlug}`);
  }
}

export function openMeaningModal(rowIndex, updateHash = true) {
  const { allRecords, currentCollectionId, scriptVariant } = store.get();
  const rec = allRecords.find(r => r.row_index === rowIndex);
  if (!rec) return;

  if (typeof document !== 'undefined') {
    const cards = document.querySelectorAll('.awsui-card');
    if (cards && typeof cards.forEach === 'function') {
      cards.forEach(card => {
        if (card.getAttribute && card.getAttribute('data-row-index') === String(rowIndex)) {
          card.classList.add('active');
        } else if (card.classList) {
          card.classList.remove('active');
        }
      });
    }
  }

  const titleElem = document.getElementById('modal-term-title');
  const readingSectionElem = document.getElementById('modal-reading-section');
  const readingElem = document.getElementById('modal-reading-row');
  const meaningElem = document.querySelector('#modal-meaning-text');
  const createdAtElem = document.getElementById('modal-created-at');
  const idElem = document.getElementById('modal-id');
  const modal = document.getElementById('detail-modal');

  if (titleElem) {
    const displayTitle = getExhibitDisplayTitle(rec, scriptVariant);
    titleElem.innerHTML = formatExhibitTitleHtml(displayTitle);
    titleElem.setAttribute('data-collection', currentCollectionId || '');
  }

  if (readingElem) {
    readingElem.setAttribute('data-collection', currentCollectionId || '');
    const showReading = Boolean(rec.reading) && currentCollectionId !== 'korean-terms';
    if (showReading) {
      readingElem.innerText = rec.reading;
      if (readingSectionElem) readingSectionElem.style.display = 'block';
    } else {
      readingElem.innerText = '';
      if (readingSectionElem) readingSectionElem.style.display = 'none';
    }
  }

  const etymPosRow = document.getElementById('modal-etymology-pos-row');
  const etymSection = document.getElementById('modal-etymology-section');
  const etymElem = document.getElementById('modal-etymology');
  const posSection = document.getElementById('modal-pos-section');
  const posElem = document.getElementById('modal-pos');
  const levelSection = document.getElementById('modal-level-section');
  const levelElem = document.getElementById('modal-level');
  const showEtymPos = Boolean(collectionsConfig[currentCollectionId]?.hasEtymologyPosFilter);
  const showLevel = Boolean(collectionsConfig[currentCollectionId]?.hasLevelFilter);
  const etymology = rec.etymology ? String(rec.etymology).trim() : '';
  const pos = rec.pos ? String(rec.pos).trim() : '';
  const level = rec.level ? String(rec.level).trim() : '';
  if (etymElem) etymElem.innerText = etymology || '--';
  if (posElem) posElem.innerText = pos || '--';
  if (levelElem) levelElem.innerText = level || '--';
  if (etymSection) etymSection.style.display = (showEtymPos && etymology) ? '' : 'none';
  if (posSection) posSection.style.display = (showEtymPos && pos) ? '' : 'none';
  if (levelSection) levelSection.style.display = (showLevel && level) ? '' : 'none';
  if (etymPosRow) {
    etymPosRow.style.display = ((showEtymPos && (etymology || pos)) || (showLevel && level)) ? '' : 'none';
  }

  if (meaningElem) {
    meaningElem.setAttribute('data-row-index', String(rowIndex));
    meaningElem.innerText = rec.tw_translation || '（無說明內容）';
    const meaningText = rec.tw_translation || '';
    if (meaningElem.classList) {
      meaningElem.classList.toggle('is-multiline', checkMeaningExceedsTwoLines(meaningText, meaningElem));
      meaningElem.classList.toggle('has-scroll', checkMeaningHasScroll(meaningElem));
    }
  }

  const referenceSection = document.getElementById('modal-reference-section');
  const referenceElem = document.getElementById('modal-reference');
  const showReference = currentCollectionId === 'korean-terms' && !getExhibitCategoryLabel(rec);
  const referenceHtml = showReference ? formatStdictReferenceHtml(rec.ja_term) : '';
  if (referenceElem) {
    referenceElem.setAttribute('data-collection', currentCollectionId || '');
    referenceElem.innerHTML = referenceHtml;
  }
  if (referenceSection) referenceSection.style.display = referenceHtml ? '' : 'none';

  const viewConjugationBtn = document.getElementById('modal-view-conjugation');
  const lemma = getConjugationLemma(rec);
  const conjugation = currentCollectionId === 'korean-terms' && isConjugatableRecord(rec)
    ? findConjugationByLemma(lemma)
    : null;
  if (viewConjugationBtn) viewConjugationBtn.style.display = conjugation ? '' : 'none';
  closeConjugationModal(false);

  if (createdAtElem) createdAtElem.innerText = rec.created_at || 'N/A';
  if (idElem) idElem.innerText = rec.id || (rec.row_index ? `ROW-${rec.row_index}` : 'N/A');

  // Render Recommendation Items
  const recSectionElem = document.getElementById('modal-recommendations-section');
  const recListElem = document.getElementById('modal-recommendations-list');
  if (recSectionElem && recListElem) {
    recListElem.setAttribute('data-collection', currentCollectionId || '');
    const recItems = parseRecommendationList(rec.recommendations);

    if (recItems.length > 0) {
      recListElem.innerHTML = recItems.map(item => {
        const chars = Array.from(item);
        const displayText = chars.length > 8 ? chars.slice(0, 8).join('') + '..' : item;
        return `
          <button type="button" class="awsui-recommendation-chip" data-collection="${escapeHtml(currentCollectionId || '')}" data-term="${escapeHtml(item)}" title="${escapeHtml(item)}">
            ${escapeHtml(displayText)}
          </button>
        `;
      }).join('');
      recSectionElem.style.display = 'flex';
    } else {
      recListElem.innerHTML = '';
      recSectionElem.style.display = 'none';
    }
  }

  if (modal) {
    modal.setAttribute('data-collection', currentCollectionId || '');
    const modalBox = modal.querySelector('.awsui-modal');
    if (modalBox) modalBox.classList.remove('awsui-modal-lg');
    modal.classList.add('open');
  }

  syncItemConjugationPager();

  if (updateHash) {
    syncHash(`#/${getCollectionSlug(currentCollectionId)}/${rec.ja_term}`);
  }
}

export function closeDetailModal(updateHash = true) {
  closeDescriptionModal(false);
  closeConjugationModal(false);
  clearStdictOpenTimer();
  const modal = document.getElementById('detail-modal');
  if (modal) modal.classList.remove('open');
  syncItemConjugationPager();
  if (typeof document !== 'undefined') {
    const cards = document.querySelectorAll('.awsui-card');
    if (cards && typeof cards.forEach === 'function') {
      cards.forEach(card => {
        if (card.classList) card.classList.remove('active');
      });
    }
  }

  if (updateHash) {
    const { currentCollectionId } = store.get();
    syncHash(`#/${getCollectionSlug(currentCollectionId)}`);
  }
}

export function openDescriptionModal(rowIndex, updateHash = true) {
  if (isCatalogMobile()) return;
  closeProfileModal(false);
  closeConjugationModal(false);
  const { allRecords, currentCollectionId } = store.get();
  const rec = allRecords.find(r => r.row_index === rowIndex);
  if (!rec) return;

  const descTextElem = document.getElementById('description-modal-text');
  const modal = document.getElementById('description-modal');

  if (descTextElem) {
    descTextElem.innerText = rec.tw_translation || '（無說明內容）';
    if (typeof descTextElem.setAttribute === 'function') {
      descTextElem.setAttribute('data-source', 'item');
    }
  }
  if (modal) {
    modal.classList.add('open');
  }

  if (updateHash) {
    syncHash(`#/${getCollectionSlug(currentCollectionId)}/${rec.ja_term}/description`);
  }
}

export function openCollectionDescriptionModal(collectionId, customText, updateHash = true) {
  if (isCatalogMobile()) return;
  closeProfileModal(false);
  const { currentCollectionId } = store.get();
  const targetColId = collectionId || currentCollectionId || 'china-terms';
  const col = collectionsConfig[targetColId];
  const meta = collectionsMetaCache[targetColId] || (col ? col.defaultMeta : null);

  const descTextElem = document.getElementById('description-modal-text');
  const modal = document.getElementById('description-modal');

  const textToDisplay = (customText !== undefined && customText !== null && customText !== '')
    ? customText
    : (meta?.description || '（無說明內容）');

  if (descTextElem) {
    descTextElem.innerText = textToDisplay;
    if (typeof descTextElem.setAttribute === 'function') {
      descTextElem.setAttribute('data-source', 'collection');
      descTextElem.setAttribute('data-collection-id', targetColId);
    }
  }
  if (modal) {
    modal.classList.add('open');
  }

  if (updateHash) {
    const colSlug = getCollectionSlug(targetColId);
    syncHash(`#/${colSlug}/info/description`);
  }
}

export function closeDescriptionModal(updateHash = true) {
  const modal = document.getElementById('description-modal');
  if (modal) modal.classList.remove('open');

  if (updateHash) {
    const descTextElem = document.getElementById('description-modal-text');
    const source = descTextElem && typeof descTextElem.getAttribute === 'function'
      ? descTextElem.getAttribute('data-source')
      : (descTextElem ? descTextElem['data-source'] : null);
    const { currentCollectionId, allRecords } = store.get();
    const colSlug = getCollectionSlug(currentCollectionId);

    const collectionModal = document.getElementById('collection-modal');
    const isCollectionModalOpen = collectionModal && collectionModal.classList.contains('open');

    if (source === 'collection' || isCollectionModalOpen) {
      syncHash(`#/${colSlug}/info`);
    } else {
      const meaningElem = getMeaningElement();
      const rowIndexStr = meaningElem ? meaningElem.getAttribute('data-row-index') : null;
      const rowIndex = rowIndexStr !== null ? parseInt(rowIndexStr, 10) : null;
      const rec = (rowIndex !== null && !isNaN(rowIndex)) ? allRecords.find(r => r.row_index === rowIndex) : null;

      syncHash(rec ? `#/${colSlug}/${rec.ja_term}` : `#/${colSlug}`);
    }
  }
}

export function openCollectionModal(collectionId, updateHash = true) {
  const { currentCollectionId, allRecords } = store.get();
  const targetColId = collectionId || currentCollectionId || 'china-terms';
  const col = collectionsConfig[targetColId];
  if (!col) return;

  const meta = collectionsMetaCache[targetColId] || col.defaultMeta;
  const modal = document.getElementById('collection-modal');
  if (!modal) return;

  const titleElem = document.getElementById('collection-modal-title');
  const enTitleElem = document.getElementById('collection-modal-entitle');
  const curatorSection = document.getElementById('collection-modal-curator-section');
  const curatorElem = document.getElementById('collection-modal-curator');
  const descElem = document.getElementById('collection-modal-description');
  const totalElem = document.getElementById('collection-modal-total-items');
  const timestampElem = document.getElementById('collection-modal-created-at');
  const idElem = document.getElementById('collection-modal-id');

  if (titleElem) titleElem.innerText = meta?.title || col.name;
  if (enTitleElem) enTitleElem.innerText = meta?.enTitle || col.enTitle || targetColId;
  const curator = typeof col.curator === 'string' ? col.curator.trim() : '';
  if (curatorElem) curatorElem.innerText = curator || '--';
  if (curatorSection) curatorSection.style.display = curator ? '' : 'none';
  if (descElem) {
    const descText = meta?.description || '（無說明內容）';
    descElem.innerText = descText;
    if (descElem.classList) {
      descElem.classList.toggle('is-multiline', checkMeaningExceedsTwoLines(descText, descElem));
      descElem.classList.toggle('has-scroll', checkMeaningHasScroll(descElem));
    }
  }
  if (totalElem) {
    const items = collectionsCache[targetColId];
    if (Array.isArray(items) && items.length > 0) {
      totalElem.innerText = items.length;
    } else if (targetColId === currentCollectionId && Array.isArray(allRecords) && allRecords.length > 0) {
      totalElem.innerText = allRecords.length;
    } else {
      totalElem.innerText = Array.isArray(items) ? items.length : '--';
    }
  }
  if (timestampElem) {
    timestampElem.innerText = meta?.timestamp || meta?.created_at || meta?.date || 'N/A';
  }
  if (idElem) idElem.innerText = meta?.id || 'N/A';

  if (typeof document !== 'undefined') {
    const headerTitle = document.getElementById('collection-header-title');
    if (headerTitle && headerTitle.classList) {
      headerTitle.classList.add('active');
    }
  }

  modal.classList.add('open');

  if (updateHash) {
    syncHash(`#/${col.name || targetColId}/info`);
  }
}

export function closeCollectionModal(updateHash = true) {
  closeProfileModal(false);
  const modal = document.getElementById('collection-modal');
  if (modal) modal.classList.remove('open');

  if (typeof document !== 'undefined') {
    const headerTitle = document.getElementById('collection-header-title');
    if (headerTitle && headerTitle.classList) {
      headerTitle.classList.remove('active');
    }
  }

  if (updateHash) {
    const { currentCollectionId } = store.get();
    syncHash(`#/${getCollectionSlug(currentCollectionId)}`);
  }
}

const createBackdropHandler = (targetId, closeFn) => (e) => {
  if (e?.target?.id === targetId) closeFn();
};

export const closeDetailModalOnBackdrop = createBackdropHandler('detail-modal', closeDetailModal);
export const closeDescriptionModalOnBackdrop = createBackdropHandler('description-modal', closeDescriptionModal);
export const closeCollectionModalOnBackdrop = createBackdropHandler('collection-modal', closeCollectionModal);
export const closeProfileModalOnBackdrop = createBackdropHandler('profile-modal', closeProfileModal);
export const closeConjugationModalOnBackdrop = createBackdropHandler('conjugation-modal', closeConjugationModal);
