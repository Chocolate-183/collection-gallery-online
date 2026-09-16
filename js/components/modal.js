/**
 * Detail Modal Component
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';
import { collectionsCache, collectionsMetaCache } from '../data.js';
import { escapeHtml, parseRecommendationList, formatExhibitTitleHtml } from '../utils.js';

function syncHash(newHash) {
  if (typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== newHash) {
    location.hash = newHash;
  }
}

function getCollectionSlug(colId) {
  const col = collectionsConfig[colId];
  return col ? col.name : colId;
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
export function getMeaningElement() {
  return typeof document !== 'undefined'
    ? (document.querySelector?.('#modal-meaning-text') || document.getElementById?.('modal-meaning-text') || null)
    : null;
}

/**
 * Generic helper to check if content exceeds a specified number of lines.
 */
export function checkMeaningExceedsLines(maxLines, text, meaningElem) {
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
export const checkMeaningExceedsFiveLines = (text, meaningElem) => checkMeaningExceedsLines(5, text, meaningElem);

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
  const { currentCollectionId } = store.get();
  const descElem = document.getElementById('collection-modal-description');
  const descText = descElem ? descElem.innerText : '';
  openCollectionDescriptionModal(currentCollectionId, descText);
}

export function openMeaningModal(rowIndex, updateHash = true) {
  const { allRecords, currentCollectionId } = store.get();
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
    titleElem.innerHTML = formatExhibitTitleHtml(rec.ja_term);
    titleElem.setAttribute('data-collection', currentCollectionId || '');
  }

  if (readingElem) {
    readingElem.setAttribute('data-collection', currentCollectionId || '');
    if (rec.reading) {
      readingElem.innerText = rec.reading;
      if (readingSectionElem) readingSectionElem.style.display = 'block';
    } else {
      readingElem.innerText = '';
      if (readingSectionElem) readingSectionElem.style.display = 'none';
    }
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
    const modalBox = modal.querySelector('.awsui-modal');
    if (modalBox) modalBox.classList.remove('awsui-modal-lg');
    modal.classList.add('open');
  }

  if (updateHash) {
    syncHash(`#/${getCollectionSlug(currentCollectionId)}/${rec.ja_term}`);
  }
}

export function closeDetailModal(updateHash = true) {
  closeDescriptionModal(false);
  const modal = document.getElementById('detail-modal');
  if (modal) modal.classList.remove('open');
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
  const descElem = document.getElementById('collection-modal-description');
  const totalElem = document.getElementById('collection-modal-total-items');
  const timestampElem = document.getElementById('collection-modal-created-at');
  const idElem = document.getElementById('collection-modal-id');

  if (titleElem) titleElem.innerText = meta?.title || col.name;
  if (enTitleElem) enTitleElem.innerText = meta?.enTitle || col.enTitle || targetColId;
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
