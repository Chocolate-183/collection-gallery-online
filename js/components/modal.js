/**
 * Detail Modal Component
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';
import { collectionsCache, collectionsMetaCache } from '../data.js';
import { escapeHtml, getUnicodeLength } from '../utils.js';

/**
 * Navigates directly to a target recommended term's detail modal.
 * @param {string} term - Term name or ID to open
 */
export function navigateToTerm(term) {
  if (!term) return;
  const { currentCollectionId, allRecords } = store.get();
  const col = collectionsConfig[currentCollectionId];
  const colName = col ? col.name : currentCollectionId;

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
      const otherCol = collectionsConfig[colId];
      const otherColName = otherCol ? otherCol.name : colId;
      location.hash = `#/${otherColName}/${targetRec.ja_term}`;
      return;
    }
  }

  // 3. Fallback: navigate via hash in current collection
  location.hash = `#/${colName}/${term}`;
}

/**
 * Standard accessor for Item Modal Description element.
 * Standardized on document.querySelector("#modal-meaning-text").
 * @returns {HTMLElement|null}
 */
export function getMeaningElement() {
  if (typeof document === 'undefined') return null;
  return document.querySelector ? document.querySelector('#modal-meaning-text') : (document.getElementById ? document.getElementById('modal-meaning-text') : null);
}

/**
 * Checks if the meaning-text content exceeds 2 lines.
 * Standardized on document.querySelector('#modal-meaning-text').
 * @param {string} [text] - Optional text (defaults to element innerText)
 * @param {HTMLElement} [meaningElem] - Optional DOM element (defaults to document.querySelector("#modal-meaning-text"))
 * @returns {boolean} True if line count exceeds 2 lines
 */
export function checkMeaningExceedsTwoLines(text, meaningElem) {
  const elem = meaningElem || getMeaningElement();
  const content = (text !== undefined && text !== null) ? text : (elem ? elem.innerText : '');
  if (!content) return false;

  const rawLines = content.split(/\r?\n/);
  if (rawLines.length > 2) return true;

  if (elem && elem.clientHeight > 0) {
    const twoLinesHeight = 18 * 1.65 * 2;
    if (elem.scrollHeight > (twoLinesHeight + 1)) {
      return true;
    }
  }

  let wrappedLines = 0;
  for (const line of rawLines) {
    wrappedLines += Math.max(1, Math.ceil(line.length / 25));
  }
  return wrappedLines > 2;
}

/**
 * Checks if the Japanese meaning-text content exceeds 5 lines.
 * Standardized on document.querySelector('#modal-meaning-text').
 */
export function checkMeaningExceedsFiveLines(text, meaningElem) {
  const elem = meaningElem || getMeaningElement();
  const content = (text !== undefined && text !== null) ? text : (elem ? elem.innerText : '');
  if (!content) return false;

  const rawLines = content.split(/\r?\n/);
  if (rawLines.length > 5) return true;

  if (elem && elem.clientHeight > 0) {
    const fiveLinesHeight = 18 * 1.65 * 5;
    if (elem.scrollHeight > (fiveLinesHeight + 1)) {
      return true;
    }
  }

  let wrappedLines = 0;
  for (const line of rawLines) {
    wrappedLines += Math.max(1, Math.ceil(line.length / 25));
  }
  return wrappedLines > 5;
}

/**
 * Checks if the meaning element has vertical scrolling content.
 * Standardized on document.querySelector("#modal-meaning-text").
 * @param {HTMLElement} [meaningElem]
 * @returns {boolean}
 */
export function checkMeaningHasScroll(meaningElem) {
  const elem = meaningElem || getMeaningElement();
  if (!elem) return false;
  if (elem.clientHeight > 0) {
    return elem.scrollHeight > (elem.clientHeight + 1);
  }
  return false;
}

/**
 * Handles double-click event on modal meaning text to open Description modal.
 * Standardized on document.querySelector('#modal-meaning-text').
 * Opens Description modal unconditionally regardless of whether content has scroll.
 */
export function handleMeaningTextClick() {
  const meaningElem = getMeaningElement();
  if (!meaningElem) return;
  const rowIndexStr = typeof meaningElem.getAttribute === 'function' ? meaningElem.getAttribute('data-row-index') : meaningElem['data-row-index'];
  const rowIndex = rowIndexStr !== null && rowIndexStr !== undefined ? parseInt(rowIndexStr, 10) : null;
  if (rowIndex !== null && !isNaN(rowIndex)) {
    openDescriptionModal(rowIndex);
  }
}

export function openMeaningModal(rowIndex, updateHash = true) {
  const { allRecords, currentCollectionId } = store.get();
  const rec = allRecords.find(r => r.row_index === rowIndex);
  if (!rec) return;

  const titleElem = document.getElementById('modal-term-title');
  const readingSectionElem = document.getElementById('modal-reading-section');
  const readingElem = document.getElementById('modal-reading-row');
  const meaningElem = document.querySelector('#modal-meaning-text');
  const createdAtElem = document.getElementById('modal-created-at');
  const idElem = document.getElementById('modal-id');
  const modal = document.getElementById('detail-modal');

  if (titleElem) {
    titleElem.innerText = rec.ja_term;
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
      if (checkMeaningExceedsTwoLines(meaningText, meaningElem)) {
        meaningElem.classList.add('is-multiline');
      } else {
        meaningElem.classList.remove('is-multiline');
      }
      if (checkMeaningHasScroll(meaningElem)) {
        meaningElem.classList.add('has-scroll');
      } else {
        meaningElem.classList.remove('has-scroll');
      }
    }
  }
  if (createdAtElem) createdAtElem.innerText = rec.created_at || 'N/A';
  if (idElem) idElem.innerText = rec.id || (rec.row_index ? `ROW-${rec.row_index}` : 'N/A');

  // Render Recommendation Items
  const recSectionElem = document.getElementById('modal-recommendations-section');
  const recListElem = document.getElementById('modal-recommendations-list');
  if (recSectionElem && recListElem) {
    recListElem.setAttribute('data-collection', currentCollectionId || '');
    const rawRecs = rec.recommendations;
    let recItems = [];
    if (Array.isArray(rawRecs)) {
      recItems = rawRecs;
    } else if (typeof rawRecs === 'string' && rawRecs.trim()) {
      recItems = rawRecs.replace(/<br\s*\/?>/gi, '\n').split(/[\n\r,，、;；]/).map(s => s.trim()).filter(Boolean);
    }

    if (recItems.length > 0) {
      recListElem.innerHTML = recItems.map(item => {
        const chars = Array.from(item);
        const displayText = chars.length > 5 ? chars.slice(0, 5).join('') + '..' : item;
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
    if (modalBox) {
      modalBox.classList.remove('awsui-modal-lg');
    }
    modal.classList.add('open');
  }

  if (updateHash) {
    const col = collectionsConfig[currentCollectionId];
    const colName = col ? col.name : currentCollectionId;
    const targetHash = `#/${colName}/${rec.ja_term}`;
    if (decodeURIComponent(window.location.hash) !== targetHash) {
      location.hash = `#/${colName}/${rec.ja_term}`;
    }
  }
}

export function closeDetailModal(updateHash = true) {
  closeDescriptionModal(false);
  const modal = document.getElementById('detail-modal');
  if (modal) modal.classList.remove('open');

  if (updateHash) {
    const { currentCollectionId } = store.get();
    const col = collectionsConfig[currentCollectionId];
    const colName = col ? col.name : currentCollectionId;
    const targetHash = `#/${colName}`;
    if (decodeURIComponent(window.location.hash) !== targetHash) {
      location.hash = `#/${colName}`;
    }
  }
}

export function closeDetailModalOnBackdrop(e) {
  if (e.target.id === 'detail-modal') {
    closeDetailModal();
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
  }

  if (modal) {
    modal.classList.add('open');
  }

  if (updateHash) {
    const col = collectionsConfig[currentCollectionId];
    const colName = col ? col.name : currentCollectionId;
    const targetHash = `#/${colName}/${rec.ja_term}/description`;
    if (typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== targetHash) {
      location.hash = `#/${colName}/${rec.ja_term}/description`;
    }
  }
}

export function closeDescriptionModal(updateHash = true) {
  const modal = document.getElementById('description-modal');
  if (modal) modal.classList.remove('open');

  if (updateHash) {
    const { currentCollectionId, allRecords } = store.get();
    const col = collectionsConfig[currentCollectionId];
    const colName = col ? col.name : currentCollectionId;

    const meaningElem = getMeaningElement();
    const rowIndexStr = meaningElem ? meaningElem.getAttribute('data-row-index') : null;
    const rowIndex = rowIndexStr !== null ? parseInt(rowIndexStr, 10) : null;
    const rec = (rowIndex !== null && !isNaN(rowIndex)) ? allRecords.find(r => r.row_index === rowIndex) : null;

    const targetHash = rec ? `#/${colName}/${rec.ja_term}` : `#/${colName}`;
    if (typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== targetHash) {
      location.hash = targetHash;
    }
  }
}

export function closeDescriptionModalOnBackdrop(e) {
  if (e.target.id === 'description-modal') {
    closeDescriptionModal();
  }
}

export function openCollectionModal(collectionId, updateHash = true) {
  const { currentCollectionId } = store.get();
  const targetColId = collectionId || currentCollectionId || 'china-terms';
  const col = collectionsConfig[targetColId];
  if (!col) return;

  const meta = collectionsMetaCache[targetColId] || (col ? col.defaultMeta : null);
  const modal = document.getElementById('collection-modal');
  if (!modal) return;

  const titleElem = document.getElementById('collection-modal-title');
  const enTitleElem = document.getElementById('collection-modal-entitle');
  const subtitleElem = document.getElementById('collection-modal-subtitle');
  const descElem = document.getElementById('collection-modal-description');
  const totalElem = document.getElementById('collection-modal-total-items');
  const idElem = document.getElementById('collection-modal-id');

  if (titleElem) {
    titleElem.innerText = (meta && meta.title) ? meta.title : col.name;
  }
  if (enTitleElem) {
    enTitleElem.innerText = (meta && meta.enTitle) ? meta.enTitle : (col.enTitle || targetColId);
  }
  if (subtitleElem) {
    if (meta && meta.subtitle) {
      subtitleElem.innerText = meta.subtitle;
      subtitleElem.style.display = 'block';
    } else {
      subtitleElem.innerText = '';
      subtitleElem.style.display = 'none';
    }
  }
  if (descElem) {
    descElem.innerText = (meta && meta.description) ? meta.description : '（無說明內容）';
  }
  if (totalElem) {
    const items = collectionsCache[targetColId];
    totalElem.innerText = Array.isArray(items) ? items.length : '--';
  }
  if (idElem) {
    idElem.innerText = (meta && meta.id) ? meta.id : 'N/A';
  }

  modal.classList.add('open');

  if (updateHash) {
    const colName = col ? col.name : targetColId;
    const targetHash = `#/${colName}/info`;
    if (typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== targetHash) {
      location.hash = `#/${colName}/info`;
    }
  }
}

export function closeCollectionModal(updateHash = true) {
  const modal = document.getElementById('collection-modal');
  if (modal) modal.classList.remove('open');

  if (updateHash) {
    const { currentCollectionId } = store.get();
    const col = collectionsConfig[currentCollectionId];
    const colName = col ? col.name : currentCollectionId;
    const targetHash = `#/${colName}`;
    if (typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== targetHash) {
      location.hash = `#/${colName}`;
    }
  }
}

export function closeCollectionModalOnBackdrop(e) {
  if (e.target.id === 'collection-modal') {
    closeCollectionModal();
  }
}
