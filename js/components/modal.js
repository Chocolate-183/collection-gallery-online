/**
 * Detail Modal Component
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';
import { collectionsCache } from '../data.js';
import { escapeHtml } from '../utils.js';

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

export function openMeaningModal(rowIndex, updateHash = true) {
  const { allRecords, currentCollectionId } = store.get();
  const rec = allRecords.find(r => r.row_index === rowIndex);
  if (!rec) return;

  const titleElem = document.getElementById('modal-term-title');
  const readingSectionElem = document.getElementById('modal-reading-section');
  const readingElem = document.getElementById('modal-reading-row');
  const meaningElem = document.getElementById('modal-meaning-text');
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
  if (meaningElem) meaningElem.innerText = rec.tw_translation || '（無說明內容）';
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
      recSectionElem.style.display = 'block';
    } else {
      recListElem.innerHTML = '';
      recSectionElem.style.display = 'none';
    }
  }

  if (modal) modal.classList.add('open');

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
