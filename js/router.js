/**
 * Hash Routing & View Switcher Engine
 */
import { VIEWS } from './constants.js';
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { switchCollection, closeSidebarOnMobile } from './components/sidebar.js';
import { openMeaningModal, closeDetailModal, openCollectionModal, closeCollectionModal, openDescriptionModal, closeDescriptionModal } from './components/modal.js';
import { renderCollectionNotice, collectionsMetaCache, updateStatsView } from './data.js';
import { applyFiltersAndSort } from './filter.js';
import { isGalleryOpen, isCollectionAdjusting, isCollectionPreparing, isCollectionHidden } from './utils.js';

function setHash(targetHash, updateHash = true) {
  if (updateHash && typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== targetHash) {
    location.hash = targetHash;
  }
}

/**
 * Toggles visibility of top-level application view sections
 */
function toggleViewElements(targetView) {
  const views = {
    [VIEWS.WELCOME]: document.getElementById('view-welcome'),
    [VIEWS.DICTIONARY]: document.getElementById('view-dictionary'),
    [VIEWS.ABOUT]: document.getElementById('view-about'),
    [VIEWS.STATS]: document.getElementById('view-stats'),
    [VIEWS.MAINTENANCE]: document.getElementById('view-maintenance')
  };

  Object.entries(views).forEach(([viewKey, elem]) => {
    if (!elem) return;
    if (viewKey === targetView) {
      elem.classList.add('active');
      elem.style.display = 'block';
    } else {
      elem.classList.remove('active');
      elem.style.display = 'none';
    }
  });
}

export function switchView(viewName, event, updateHash = true) {
  closeSidebarOnMobile();
  if (event && event.preventDefault) event.preventDefault();

  const isClosed = !isGalleryOpen();
  if (isClosed && viewName !== VIEWS.MAINTENANCE && viewName !== VIEWS.ABOUT && viewName !== VIEWS.STATS) {
    viewName = VIEWS.MAINTENANCE;
  }

  const { currentView, currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId];
  const colMeta = collectionsMetaCache[currentCollectionId] || (col ? col.defaultMeta : null);
  const isColAdjusting = isCollectionAdjusting(colMeta);
  const isColPreparing = isCollectionPreparing(colMeta);

  if (!isClosed && viewName === VIEWS.DICTIONARY && (isColAdjusting || isColPreparing)) {
    viewName = VIEWS.MAINTENANCE;
  }

  const isViewChanged = currentView !== viewName;
  store.set({ currentView: viewName });

  const navWelcome = document.getElementById('nav-welcome');
  const navAbout = document.getElementById('nav-about');
  const navStats = document.getElementById('nav-stats');

  const maintTitle = document.getElementById('maintenance-title');
  const maintDesc1 = document.getElementById('maintenance-desc-1');
  const maintDesc2 = document.getElementById('maintenance-desc-2');

  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));

  toggleViewElements(viewName);

  if (viewName === VIEWS.MAINTENANCE) {
    if (isClosed) {
      if (maintTitle) maintTitle.innerText = 'CLOSED';
      if (maintDesc1) maintDesc1.innerText = '目前為非開放時間，歡迎於開館時間再次蒞臨參觀。';
      if (maintDesc2) maintDesc2.style.display = 'block';
    } else if (isColPreparing) {
      if (maintTitle) maintTitle.innerText = 'COMING SOON';
      const prepareMsg = (colMeta && colMeta.announcement && colMeta.announcement !== '籌備中' && colMeta.announcement !== 'IN PREPARATION' && colMeta.announcement !== 'PREPARING' && colMeta.announcement !== 'COMING SOON')
        ? colMeta.announcement
        : '本展廳目前正在籌備中，暫不開放參觀，敬請期待。';
      if (maintDesc1) maintDesc1.innerText = prepareMsg;
      if (maintDesc2) maintDesc2.style.display = 'none';

      const activeColBtn = document.getElementById(`nav-col-${currentCollectionId}`);
      if (activeColBtn) activeColBtn.classList.add('active');
    } else if (isColAdjusting) {
      if (maintTitle) maintTitle.innerText = 'ADJUSTING';
      const adjustMsg = (colMeta && colMeta.announcement && colMeta.announcement !== '調整中' && colMeta.announcement !== '展廳調整中' && colMeta.announcement !== 'UNDER ADJUSTMENT' && colMeta.announcement !== 'ADJUSTING')
        ? colMeta.announcement
        : '本展廳目前正在進行內容調整，暫不開放參觀，敬請期待。';
      if (maintDesc1) maintDesc1.innerText = adjustMsg;
      if (maintDesc2) maintDesc2.style.display = 'none';

      const activeColBtn = document.getElementById(`nav-col-${currentCollectionId}`);
      if (activeColBtn) activeColBtn.classList.add('active');
    }

    if (isClosed) {
      setHash('#/maintenance', updateHash);
    } else if (isColAdjusting || isColPreparing) {
      const colName = col ? col.name : currentCollectionId;
      setHash(`#/${colName}`, updateHash);
    }
  } else if (viewName === VIEWS.WELCOME) {
    if (navWelcome) navWelcome.classList.add('active');
    setHash('#/welcome', updateHash);
  } else if (viewName === VIEWS.DICTIONARY) {
    const activeColBtn = document.getElementById(`nav-col-${currentCollectionId}`);
    if (activeColBtn) activeColBtn.classList.add('active');

    renderCollectionNotice();

    const col = collectionsConfig[currentCollectionId];
    const colName = col ? col.name : currentCollectionId;
    setHash(`#/${colName}`, updateHash);
  } else if (viewName === VIEWS.ABOUT) {
    if (navAbout) navAbout.classList.add('active');
    setHash('#/about', updateHash);
  } else if (viewName === VIEWS.STATS) {
    if (navStats) navStats.classList.add('active');
    setHash('#/stats', updateHash);
    updateStatsView();
  }

  if (isViewChanged || !!event) {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

export function handleHashRoute() {
  if (typeof window === 'undefined') return;
  const rawHash = window.location.hash;
  const decodedHash = decodeURIComponent(rawHash || '');
  const { currentCollectionId, allRecords } = store.get();
  const path = decodedHash.replace(/^#\/?/, '');

  if (!isGalleryOpen()) {
    if (path === 'about' || path === 'stats') {
      store.set({ invalidTerm: null });
      switchView(path === 'about' ? VIEWS.ABOUT : VIEWS.STATS, null, false);
      closeDetailModal(false);
      return;
    }

    store.set({ invalidTerm: null });
    switchView(VIEWS.MAINTENANCE, null, false);
    closeDetailModal(false);
    if (decodeURIComponent(location.hash) !== '#/maintenance') {
      location.hash = '#/maintenance';
    }
    return;
  }

  if (!decodedHash || decodedHash === '#' || decodedHash === '#/' || !path || path === 'welcome' || path === 'home' || path === 'maintenance') {
    store.set({ invalidTerm: null });
    switchView(VIEWS.WELCOME, null, false);
    closeDetailModal(false);
    if ((path === 'maintenance' || !decodedHash || decodedHash === '#' || decodedHash === '#/') && location.hash !== '#/welcome') {
      location.hash = '#/welcome';
    }
    return;
  }

  if (path === 'about') {
    store.set({ invalidTerm: null });
    switchView(VIEWS.ABOUT, null, false);
    closeDetailModal(false);
    return;
  }

  if (path === 'stats') {
    store.set({ invalidTerm: null });
    switchView(VIEWS.STATS, null, false);
    closeDetailModal(false);
    return;
  }

  const parts = path.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    store.set({ invalidTerm: null });
    closeDetailModal(false);
    return;
  }

  let colKey = parts[0];
  if (colKey === '中國特色詞彙') {
    colKey = '大陸特色詞彙';
  }
  let termName = parts.length >= 2 ? parts[1] : null;
  let subAction = parts.length >= 3 ? parts[2] : null;

  const targetColId = Object.keys(collectionsConfig).find(
    key => key === colKey || collectionsConfig[key].name === colKey
  );

  if (targetColId) {
    const targetMeta = collectionsMetaCache[targetColId] || (collectionsConfig[targetColId] ? collectionsConfig[targetColId].defaultMeta : null);
    if (isCollectionHidden(targetMeta)) {
      store.set({ invalidTerm: null });
      switchView(VIEWS.WELCOME, null, false);
      closeDetailModal(false);
      if (location.hash !== '#/welcome') {
        location.hash = '#/welcome';
      }
      return;
    }

    if (targetColId !== currentCollectionId) {
      switchCollection(targetColId, false);
      return;
    }
    switchView(VIEWS.DICTIONARY, null, false);

    if (termName) {
      if (termName === 'info' || termName === 'details') {
        store.set({ invalidTerm: null });
        closeDetailModal(false);
        openCollectionModal(targetColId, false);
      } else {
        const rec = allRecords.find(r => r.ja_term === termName || r.id === termName);
        if (rec) {
          store.set({ invalidTerm: null });
          closeCollectionModal(false);
          openMeaningModal(rec.row_index, false);
          if (subAction === 'description') {
            openDescriptionModal(rec.row_index, false);
          } else {
            closeDescriptionModal(false);
          }
        } else {
          closeDetailModal(false);
          closeCollectionModal(false);
          store.set({ invalidTerm: termName });
          applyFiltersAndSort();
        }
      }
    } else {
      const { invalidTerm } = store.get();
      if (invalidTerm) {
        store.set({ invalidTerm: null });
        applyFiltersAndSort();
      }
      closeDetailModal(false);
      closeCollectionModal(false);
    }
  } else {
    switchView(VIEWS.DICTIONARY, null, false);
    const rec = allRecords.find(r => r.ja_term === colKey || r.id === colKey);
    if (rec) {
      store.set({ invalidTerm: null });
      openMeaningModal(rec.row_index, false);
      if (termName === 'description') {
        openDescriptionModal(rec.row_index, false);
      } else {
        closeDescriptionModal(false);
      }
    } else {
      closeDetailModal(false);
      store.set({ invalidTerm: colKey });
      applyFiltersAndSort();
    }
  }
}
