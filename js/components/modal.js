/**
 * Item, Description, Collection & Profile modals
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';
import { collectionsCache, findProfileByName, getCollectionMeta } from '../data.js';
import { escapeHtml, parseRecommendationList, formatExhibitTitleHtml, formatStdictReferenceHtml, getExhibitCategoryLabel, getExhibitDisplayTitle, isMobileViewport } from '../utils.js';
import { closeConjugationModal, getRecordConjugation, syncItemConjugationPager } from './conjugation.js';

const NO_DESCRIPTION = '（無說明內容）';
const STDICT_OPEN_DELAY_MS = 500;
const RECOMMENDATION_MAX_CHARS = 8;
const DESCRIPTION_LINE_HEIGHT_PX = 18 * 1.65;
const DESCRIPTION_CHARS_PER_LINE = 25;

/* ------------------------------------------------------------------ */
/* Shared helpers                                                     */
/* ------------------------------------------------------------------ */

export function syncHash(newHash) {
  if (typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== newHash) {
    location.hash = newHash;
  }
}

/** `#/{hall name}/{...parts}` — empty parts are dropped. */
export function collectionHash(colId, ...parts) {
  const slug = collectionsConfig[colId]?.name || colId;
  return ['#', slug, ...parts.filter(Boolean)].join('/');
}

export function findRecordByRow(rowIndex) {
  if (rowIndex === null || rowIndex === undefined) return null;
  return store.get().allRecords.find(r => r.row_index === rowIndex) || null;
}

const getMeaningElement = () => document.getElementById('modal-meaning-text');

/** Row index of the record shown in the Item modal, or null. */
export function getActiveItemRowIndex() {
  const raw = getMeaningElement()?.getAttribute?.('data-row-index');
  const rowIndex = raw == null ? NaN : parseInt(raw, 10);
  return Number.isNaN(rowIndex) ? null : rowIndex;
}

function isOpen(id) {
  return Boolean(document.getElementById(id)?.classList.contains('open'));
}

function setOpen(id, open) {
  const modal = document.getElementById(id);
  if (modal) modal.classList[open ? 'add' : 'remove']('open');
}

/** Shows `value` in `valueId` (or `--`) and hides `sectionId` when there is no value. */
function setOptionalField(sectionId, valueId, value, visible = Boolean(value)) {
  const elem = document.getElementById(valueId);
  const section = document.getElementById(sectionId);
  if (elem) elem.innerText = value || '--';
  if (section) section.style.display = visible ? '' : 'none';
}

function textOf(value) {
  return value == null ? '' : String(value).trim();
}

/** True when text needs more than `maxLines` lines (explicit newlines, rendered height, or ~25 CJK chars per line). */
function exceedsLines(maxLines, text, elem) {
  const content = text ?? elem?.innerText ?? '';
  if (!content) return false;

  const rawLines = content.split(/\r?\n/);
  if (rawLines.length > maxLines) return true;
  if (elem?.clientHeight > 0 && elem.scrollHeight > DESCRIPTION_LINE_HEIGHT_PX * maxLines + 1) return true;

  const wrappedLines = rawLines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / DESCRIPTION_CHARS_PER_LINE)), 0);
  return wrappedLines > maxLines;
}

/** Fills a description block and toggles its multiline / scroll styling. */
function setDescriptionText(elem, text, displayText = text) {
  if (!elem) return;
  elem.innerText = displayText;
  elem.classList.toggle('is-multiline', exceedsLines(2, text, elem));
  elem.classList.toggle('has-scroll', elem.clientHeight > 0 && elem.scrollHeight > elem.clientHeight + 1);
}

function setActiveCard(rowIndex) {
  document.querySelectorAll('.awsui-card').forEach(card => {
    card.classList.toggle('active', rowIndex != null && card.getAttribute?.('data-row-index') === String(rowIndex));
  });
}

/* ------------------------------------------------------------------ */
/* Item modal                                                         */
/* ------------------------------------------------------------------ */

let stdictOpenTimer = null;

function clearStdictOpenTimer() {
  if (stdictOpenTimer) {
    clearTimeout(stdictOpenTimer);
    stdictOpenTimer = null;
  }
}

/** Reference link: show the pressed state briefly before opening the dictionary in a new tab. */
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
    link.blur?.();
    window.open(url, '_blank', 'noopener,noreferrer');
  }, STDICT_OPEN_DELAY_MS);
}

/** Opens a recommended term: in this hall directly, in another cached hall via hash, else via hash here. */
export function navigateToTerm(term) {
  if (!term) return;
  const { currentCollectionId, allRecords } = store.get();
  const matches = r => r.ja_term === term || r.id === term;

  const local = allRecords.find(matches);
  if (local) {
    openMeaningModal(local.row_index, true);
    return;
  }

  for (const [colId, records] of Object.entries(collectionsCache)) {
    if (colId === currentCollectionId || !Array.isArray(records)) continue;
    const rec = records.find(matches);
    if (rec) {
      location.hash = collectionHash(colId, rec.ja_term);
      return;
    }
  }

  location.hash = collectionHash(currentCollectionId, term);
}

function renderItemTaxonomy(rec, col) {
  const showEtymPos = Boolean(col?.hasEtymologyPosFilter);
  const showLevel = Boolean(col?.hasLevelFilter);
  const etymology = textOf(rec.etymology);
  const pos = textOf(rec.pos);
  const level = textOf(rec.level);

  setOptionalField('modal-etymology-section', 'modal-etymology', etymology, showEtymPos && Boolean(etymology));
  setOptionalField('modal-pos-section', 'modal-pos', pos, showEtymPos && Boolean(pos));
  setOptionalField('modal-level-section', 'modal-level', level, showLevel && Boolean(level));

  const row = document.getElementById('modal-etymology-pos-row');
  if (row) row.style.display = ((showEtymPos && (etymology || pos)) || (showLevel && level)) ? '' : 'none';
}

function renderRecommendations(rec, colId) {
  const section = document.getElementById('modal-recommendations-section');
  const list = document.getElementById('modal-recommendations-list');
  if (!section || !list) return;

  list.setAttribute('data-collection', colId || '');
  const items = parseRecommendationList(rec.recommendations);
  list.innerHTML = items.map(item => {
    const chars = Array.from(item);
    const label = chars.length > RECOMMENDATION_MAX_CHARS ? `${chars.slice(0, RECOMMENDATION_MAX_CHARS).join('')}..` : item;
    return `
      <button type="button" class="awsui-recommendation-chip" data-collection="${escapeHtml(colId || '')}" data-term="${escapeHtml(item)}" title="${escapeHtml(item)}">
        ${escapeHtml(label)}
      </button>
    `;
  }).join('');
  section.style.display = items.length > 0 ? 'flex' : 'none';
}

export function openMeaningModal(rowIndex, updateHash = true) {
  const rec = findRecordByRow(rowIndex);
  if (!rec) return;
  const { currentCollectionId: colId, scriptVariant } = store.get();
  const col = collectionsConfig[colId];
  const colAttr = colId || '';

  setActiveCard(rowIndex);

  const titleElem = document.getElementById('modal-term-title');
  if (titleElem) {
    titleElem.innerHTML = formatExhibitTitleHtml(getExhibitDisplayTitle(rec, scriptVariant));
    titleElem.setAttribute('data-collection', colAttr);
  }

  // C103 titles already include Hangul, so Pronunciation is hidden there.
  const readingElem = document.getElementById('modal-reading-row');
  if (readingElem) {
    const showReading = Boolean(rec.reading) && colId !== 'korean-terms';
    readingElem.setAttribute('data-collection', colAttr);
    readingElem.innerText = showReading ? rec.reading : '';
    const readingSection = document.getElementById('modal-reading-section');
    if (readingSection) readingSection.style.display = showReading ? 'block' : 'none';
  }

  renderItemTaxonomy(rec, col);

  const meaningElem = getMeaningElement();
  if (meaningElem) {
    meaningElem.setAttribute('data-row-index', String(rowIndex));
    setDescriptionText(meaningElem, rec.tw_translation || '', rec.tw_translation || NO_DESCRIPTION);
  }

  // C103 dictionary reference (skipped for person / group / company names).
  const referenceHtml = colId === 'korean-terms' && !getExhibitCategoryLabel(rec)
    ? formatStdictReferenceHtml(rec.ja_term)
    : '';
  const referenceElem = document.getElementById('modal-reference');
  if (referenceElem) {
    referenceElem.setAttribute('data-collection', colAttr);
    referenceElem.innerHTML = referenceHtml;
  }
  const referenceSection = document.getElementById('modal-reference-section');
  if (referenceSection) referenceSection.style.display = referenceHtml ? '' : 'none';

  const viewConjugationBtn = document.getElementById('modal-view-conjugation');
  if (viewConjugationBtn) viewConjugationBtn.style.display = getRecordConjugation(rec) ? '' : 'none';
  closeConjugationModal(false);

  const createdAtElem = document.getElementById('modal-created-at');
  if (createdAtElem) createdAtElem.innerText = rec.created_at || 'N/A';
  const idElem = document.getElementById('modal-id');
  if (idElem) idElem.innerText = rec.id || (rec.row_index ? `ROW-${rec.row_index}` : 'N/A');

  renderRecommendations(rec, colId);

  const modal = document.getElementById('detail-modal');
  if (modal) {
    modal.setAttribute('data-collection', colAttr);
    modal.classList.add('open');
  }
  syncItemConjugationPager();

  if (updateHash) syncHash(collectionHash(colId, rec.ja_term));
}

export function closeDetailModal(updateHash = true) {
  closeDescriptionModal(false);
  closeConjugationModal(false);
  clearStdictOpenTimer();
  setOpen('detail-modal', false);
  syncItemConjugationPager();
  setActiveCard(null);

  if (updateHash) syncHash(collectionHash(store.get().currentCollectionId));
}

/* ------------------------------------------------------------------ */
/* Description modal (desktop only)                                   */
/* ------------------------------------------------------------------ */

function showDescriptionModal(text, attrs) {
  const textElem = document.getElementById('description-modal-text');
  if (textElem) {
    textElem.innerText = text;
    Object.entries(attrs).forEach(([key, value]) => textElem.setAttribute(key, value));
  }
  setOpen('description-modal', true);
}

/** Double-click on the Item description opens it full size. */
export function handleMeaningTextClick() {
  const rowIndex = getActiveItemRowIndex();
  if (rowIndex !== null) openDescriptionModal(rowIndex);
}

export function openDescriptionModal(rowIndex, updateHash = true) {
  if (isMobileViewport()) return;
  closeProfileModal(false);
  closeConjugationModal(false);
  const rec = findRecordByRow(rowIndex);
  if (!rec) return;

  showDescriptionModal(rec.tw_translation || NO_DESCRIPTION, { 'data-source': 'item' });
  if (updateHash) syncHash(collectionHash(store.get().currentCollectionId, rec.ja_term, 'description'));
}

/** Double-click on the Collection description opens it full size. */
export function handleCollectionDescriptionClick() {
  const descText = document.getElementById('collection-modal-description')?.innerText || '';
  openCollectionDescriptionModal(store.get().currentCollectionId, descText);
}

export function openCollectionDescriptionModal(collectionId, customText, updateHash = true) {
  if (isMobileViewport()) return;
  closeProfileModal(false);
  const colId = collectionId || store.get().currentCollectionId;
  const text = customText || getCollectionMeta(colId)?.description || NO_DESCRIPTION;

  showDescriptionModal(text, { 'data-source': 'collection', 'data-collection-id': colId });
  if (updateHash) syncHash(collectionHash(colId, 'info', 'description'));
}

export function closeDescriptionModal(updateHash = true) {
  setOpen('description-modal', false);
  if (!updateHash) return;

  const colId = store.get().currentCollectionId;
  const source = document.getElementById('description-modal-text')?.getAttribute?.('data-source');
  if (source === 'collection' || isOpen('collection-modal')) {
    syncHash(collectionHash(colId, 'info'));
  } else {
    syncHash(collectionHash(colId, findRecordByRow(getActiveItemRowIndex())?.ja_term));
  }
}

/* ------------------------------------------------------------------ */
/* Collection modal                                                   */
/* ------------------------------------------------------------------ */

export function openCollectionModal(collectionId, updateHash = true) {
  const { currentCollectionId, allRecords } = store.get();
  const colId = collectionId || currentCollectionId;
  const col = collectionsConfig[colId];
  if (!col || !document.getElementById('collection-modal')) return;
  const meta = getCollectionMeta(colId);

  const titleElem = document.getElementById('collection-modal-title');
  if (titleElem) titleElem.innerText = meta?.title || col.name;
  const enTitleElem = document.getElementById('collection-modal-entitle');
  if (enTitleElem) enTitleElem.innerText = meta?.enTitle || col.enTitle || colId;

  setOptionalField('collection-modal-curator-section', 'collection-modal-curator', textOf(col.curator));
  setDescriptionText(document.getElementById('collection-modal-description'), meta?.description || NO_DESCRIPTION);

  const totalElem = document.getElementById('collection-modal-total-items');
  if (totalElem) {
    const cached = collectionsCache[colId];
    if (cached?.length > 0) totalElem.innerText = cached.length;
    else if (colId === currentCollectionId && allRecords.length > 0) totalElem.innerText = allRecords.length;
    else totalElem.innerText = Array.isArray(cached) ? 0 : '--';
  }
  const timestampElem = document.getElementById('collection-modal-created-at');
  if (timestampElem) timestampElem.innerText = meta?.timestamp || 'N/A';
  const idElem = document.getElementById('collection-modal-id');
  if (idElem) idElem.innerText = meta?.id || 'N/A';

  document.getElementById('collection-header-title')?.classList.add('active');
  setOpen('collection-modal', true);

  if (updateHash) syncHash(collectionHash(colId, 'info'));
}

export function closeCollectionModal(updateHash = true) {
  closeProfileModal(false);
  setOpen('collection-modal', false);
  document.getElementById('collection-header-title')?.classList.remove('active');

  if (updateHash) syncHash(collectionHash(store.get().currentCollectionId));
}

/* ------------------------------------------------------------------ */
/* Profile modal                                                      */
/* ------------------------------------------------------------------ */

function setCuratorActive(isActive) {
  document.getElementById('collection-modal-curator')?.classList.toggle('active', isActive);
}

/** Collection modal Curator click → Profile panel. */
export function handleCuratorClick() {
  openProfileModal(document.getElementById('collection-modal-curator')?.innerText);
}

/** Opens the Profile panel for a curator name (matched against the profiles sheet). */
export function openProfileModal(curatorName, updateHash = true) {
  const name = textOf(curatorName);
  if (!name || name === '--') return;
  const profile = findProfileByName(name) || { zhName: name };

  const nameElem = document.getElementById('profile-modal-name');
  if (nameElem) nameElem.innerText = profile.zhName || profile.enName || name;
  setOptionalField('profile-modal-en-section', 'profile-modal-en', textOf(profile.enName));
  setOptionalField('profile-modal-ig-section', 'profile-modal-ig', textOf(profile.ig));
  setOptionalField('profile-modal-youtube-section', 'profile-modal-youtube', textOf(profile.youtube));
  setOptionalField('profile-modal-gmail-section', 'profile-modal-gmail', textOf(profile.gmail));

  const socialRow = document.getElementById('profile-modal-social-row');
  if (socialRow) socialRow.style.display = (textOf(profile.ig) || textOf(profile.youtube)) ? '' : 'none';

  const descText = textOf(profile.description);
  setDescriptionText(document.getElementById('profile-modal-description'), descText, descText || '--');
  const descSection = document.getElementById('profile-modal-description-section');
  if (descSection) descSection.style.display = descText ? '' : 'none';
  const idElem = document.getElementById('profile-modal-id');
  if (idElem) idElem.innerText = profile.id || '--';

  closeDescriptionModal(false);
  closeConjugationModal(false);
  setCuratorActive(true);
  setOpen('profile-modal', true);

  if (updateHash) syncHash(collectionHash(store.get().currentCollectionId, 'info', 'profile'));
}

export function closeProfileModal(updateHash = true) {
  setCuratorActive(false);
  setOpen('profile-modal', false);

  if (updateHash) {
    syncHash(collectionHash(store.get().currentCollectionId, isOpen('collection-modal') ? 'info' : null));
  }
}

/* ------------------------------------------------------------------ */
/* Backdrop handlers                                                  */
/* ------------------------------------------------------------------ */

const createBackdropHandler = (targetId, closeFn) => (e) => {
  if (e?.target?.id === targetId) closeFn();
};

export const closeDetailModalOnBackdrop = createBackdropHandler('detail-modal', closeDetailModal);
export const closeDescriptionModalOnBackdrop = createBackdropHandler('description-modal', closeDescriptionModal);
export const closeCollectionModalOnBackdrop = createBackdropHandler('collection-modal', closeCollectionModal);
export const closeProfileModalOnBackdrop = createBackdropHandler('profile-modal', closeProfileModal);
