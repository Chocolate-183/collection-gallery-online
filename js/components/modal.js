/**
 * Detail Modal Component
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';

export function openMeaningModal(rowIndex, updateHash = true) {
  const { allRecords, currentCollectionId } = store.get();
  const rec = allRecords.find(r => r.row_index === rowIndex);
  if (!rec) return;

  const titleElem = document.getElementById('modal-term-title');
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
      readingElem.style.display = 'block';
    } else {
      readingElem.innerText = '';
      readingElem.style.display = 'none';
    }
  }
  if (meaningElem) meaningElem.innerText = rec.tw_translation || '（無說明內容）';
  if (createdAtElem) createdAtElem.innerText = rec.created_at || 'N/A';
  if (idElem) idElem.innerText = rec.id || (rec.row_index ? `ROW-${rec.row_index}` : 'N/A');

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
