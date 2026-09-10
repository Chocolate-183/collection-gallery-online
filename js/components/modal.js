/**
 * Detail Modal Component
 */
import { store } from '../state.js';
import { collectionsConfig } from '../config.js';
import { collectionsCache } from '../data.js';
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
 * Checks if the Japanese meaning-text content exceeds 5 lines.
 * @param {string} text - Explanation / translation text
 * @param {HTMLElement} [meaningElem] - Optional DOM element for measuring scroll height
 * @returns {boolean} True if line count exceeds 5 lines
 */
export function checkMeaningExceedsFiveLines(text, meaningElem) {
  if (!text) return false;

  // 1. Explicit line breaks in raw string
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length > 5) return true;

  // 2. DOM measurement when rendered in browser (line-height is 18px * 1.65 = 29.7px)
  if (meaningElem && meaningElem.clientHeight > 0) {
    const linePixelHeight = 18 * 1.65;
    // 5 lines height threshold = 5 * 29.7 = 148.5px
    if (meaningElem.scrollHeight > (linePixelHeight * 5 + 1)) {
      return true;
    }
  }

  // 3. Estimated wrapped lines for long paragraphs (~25 CJK chars per line in modal)
  let totalWrappedLines = 0;
  for (const line of rawLines) {
    totalWrappedLines += Math.max(1, Math.ceil(line.length / 25));
  }
  return totalWrappedLines > 5;
}

/**
 * Checks if the meaning-text content exceeds 1 line.
 * @param {string} text - Explanation / translation text
 * @param {HTMLElement} [meaningElem] - Optional DOM element for measuring scroll height
 * @returns {boolean} True if line count exceeds 1 line
 */
export function checkMeaningExceedsOneLine(text, meaningElem) {
  if (!text) return false;

  // 1. Explicit line breaks in raw string
  const rawLines = text.split(/\r?\n/);
  if (rawLines.length > 1) return true;

  // 2. DOM measurement when rendered in browser (line-height is 18px * 1.65 = 29.7px)
  if (meaningElem && meaningElem.clientHeight > 0) {
    const linePixelHeight = 18 * 1.65;
    // 1 line height threshold = 29.7px + buffer = 35.6px
    if (meaningElem.scrollHeight > (linePixelHeight * 1.2)) {
      return true;
    }
  }

  // 3. Estimated wrapped lines for long paragraphs (~25 CJK chars per line in modal)
  let totalWrappedLines = 0;
  for (const line of rawLines) {
    totalWrappedLines += Math.max(1, Math.ceil(line.length / 25));
  }
  return totalWrappedLines > 1;
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
  if (meaningElem) {
    meaningElem.innerText = rec.tw_translation || '（無說明內容）';
    const meaningText = rec.tw_translation || '';
    if (meaningElem.classList) {
      if (checkMeaningExceedsOneLine(meaningText, meaningElem)) {
        meaningElem.classList.add('is-multiline');
      } else {
        meaningElem.classList.remove('is-multiline');
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
      recSectionElem.style.display = 'block';
    } else {
      recListElem.innerHTML = '';
      recSectionElem.style.display = 'none';
    }
  }

  if (modal) {
    const modalBox = modal.querySelector('.awsui-modal');
    const isJapanese = (currentCollectionId === 'japanese-terms' || (titleElem && titleElem.getAttribute('data-collection') === 'japanese-terms'));
    if (modalBox) {
      const termTitle = rec.ja_term || '';
      const meaningText = rec.tw_translation || '';

      const titleExceedsLimit = getUnicodeLength(termTitle) > 15;
      const meaningExceedsFiveLines = isJapanese && checkMeaningExceedsFiveLines(meaningText, meaningElem);

      if (titleExceedsLimit || meaningExceedsFiveLines) {
        modalBox.classList.add('awsui-modal-lg');
        modalBox.classList.remove('awsui-modal-sm');
      } else {
        modalBox.classList.add('awsui-modal-sm');
        modalBox.classList.remove('awsui-modal-lg');
      }
    }
    modal.classList.add('open');

    if (modalBox && meaningElem && rec.tw_translation) {
      const checkLines = () => {
        if (meaningElem.classList) {
          if (checkMeaningExceedsOneLine(rec.tw_translation, meaningElem)) {
            meaningElem.classList.add('is-multiline');
          } else {
            meaningElem.classList.remove('is-multiline');
          }
        }
        if (isJapanese && checkMeaningExceedsFiveLines(rec.tw_translation, meaningElem)) {
          modalBox.classList.add('awsui-modal-lg');
          modalBox.classList.remove('awsui-modal-sm');
        }
      };
      checkLines();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(checkLines);
      }
    }
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
