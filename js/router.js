/**
 * Hash Routing & View Switcher Engine
 */
import { VIEWS, EXHIBITION_STATUS } from './constants.js';
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { switchCollection } from './components/sidebar.js';
import { openMeaningModal, closeDetailModal } from './components/modal.js';
import { renderCollectionNotice, collectionsMetaCache } from './data.js';
import { applyFiltersAndSort } from './filter.js';
import { isGalleryOpen } from './utils.js';

/**
 * Toggles visibility of top-level application view sections
 */
function toggleViewElements(targetView) {
  const views = {
    [VIEWS.WELCOME]: document.getElementById('view-welcome'),
    [VIEWS.DICTIONARY]: document.getElementById('view-dictionary'),
    [VIEWS.ABOUT]: document.getElementById('view-about'),
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

/**
 * Checks if a collection's metadata status is adjusting/maintenance
 */
function isCollectionAdjusting(colMeta) {
  if (!colMeta || !colMeta.status) return false;
  return colMeta.status === EXHIBITION_STATUS.ADJUSTING ||
         (typeof colMeta.status === 'string' && colMeta.status.includes(EXHIBITION_STATUS.ADJUSTING));
}

export function switchView(viewName, event, updateHash = true) {
  if (event && event.preventDefault) event.preventDefault();

  const isClosed = !isGalleryOpen();
  if (isClosed && viewName !== VIEWS.MAINTENANCE && viewName !== VIEWS.ABOUT) {
    viewName = VIEWS.MAINTENANCE;
  }

  const { currentView, currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId];
  const colMeta = collectionsMetaCache[currentCollectionId] || (col ? col.defaultMeta : null);
  const isColAdjusting = isCollectionAdjusting(colMeta);

  if (!isClosed && viewName === VIEWS.DICTIONARY && isColAdjusting) {
    viewName = VIEWS.MAINTENANCE;
  }

  const isViewChanged = currentView !== viewName;
  store.set({ currentView: viewName });

  const navWelcome = document.getElementById('nav-welcome');
  const navAbout = document.getElementById('nav-about');

  const maintTitle = document.getElementById('maintenance-title');
  const maintDesc1 = document.getElementById('maintenance-desc-1');
  const maintDesc2 = document.getElementById('maintenance-desc-2');

  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));

  toggleViewElements(viewName);

  if (viewName === VIEWS.MAINTENANCE) {
    if (isClosed) {
      if (maintTitle) maintTitle.innerText = '閉館中';
      if (maintDesc1) maintDesc1.innerText = '目前非線上展廳開放時間，歡迎於開館時間再次蒞臨參觀。';
      if (maintDesc2) maintDesc2.style.display = 'block';
    } else if (isColAdjusting) {
      if (maintTitle) maintTitle.innerText = '展廳調整中';
      if (maintDesc1) maintDesc1.innerText = '本展廳目前正在進行內容調整，暫不開放參觀，敬請期待。';
      if (maintDesc2) maintDesc2.style.display = 'none';

      const activeColBtn = document.getElementById(`nav-col-${currentCollectionId}`);
      if (activeColBtn) activeColBtn.classList.add('active');
    }

    if (updateHash) {
      if (isClosed) {
        if (decodeURIComponent(window.location.hash) !== '#/maintenance') {
          location.hash = '#/maintenance';
        }
      } else if (isColAdjusting) {
        const colName = col ? col.name : currentCollectionId;
        const targetHash = `#/${colName}`;
        if (decodeURIComponent(window.location.hash) !== targetHash) {
          location.hash = targetHash;
        }
      }
    }
  } else if (viewName === VIEWS.WELCOME) {
    if (navWelcome) navWelcome.classList.add('active');

    if (updateHash) {
      if (decodeURIComponent(window.location.hash) !== '#/welcome') {
        location.hash = '#/welcome';
      }
    }
  } else if (viewName === VIEWS.DICTIONARY) {
    const activeColBtn = document.getElementById(`nav-col-${currentCollectionId}`);
    if (activeColBtn) activeColBtn.classList.add('active');

    renderCollectionNotice();

    if (updateHash) {
      const col = collectionsConfig[currentCollectionId];
      const colName = col ? col.name : currentCollectionId;
      const targetHash = `#/${colName}`;
      if (decodeURIComponent(window.location.hash) !== targetHash) {
        location.hash = targetHash;
      }
    }
  } else if (viewName === VIEWS.ABOUT) {
    if (navAbout) navAbout.classList.add('active');

    if (updateHash) {
      if (decodeURIComponent(window.location.hash) !== '#/about') {
        location.hash = '#/about';
      }
    }
  }

  if (isViewChanged || !!event) {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

export function handleHashRoute() {
  const rawHash = window.location.hash;
  const decodedHash = decodeURIComponent(rawHash || '');
  const { currentCollectionId, allRecords } = store.get();
  const path = decodedHash.replace(/^#\/?/, '');

  if (!isGalleryOpen()) {
    if (path === 'about') {
      store.set({ invalidTerm: null });
      switchView(VIEWS.ABOUT, null, false);
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

  const targetColId = Object.keys(collectionsConfig).find(
    key => key === colKey || collectionsConfig[key].name === colKey
  );

  if (targetColId) {
    if (targetColId !== currentCollectionId) {
      switchCollection(targetColId, false);
      return;
    }
    switchView(VIEWS.DICTIONARY, null, false);

    if (termName) {
      const rec = allRecords.find(r => r.ja_term === termName || r.id === termName);
      if (rec) {
        store.set({ invalidTerm: null });
        openMeaningModal(rec.row_index, false);
      } else {
        closeDetailModal(false);
        store.set({ invalidTerm: termName });
        applyFiltersAndSort();
      }
    } else {
      const { invalidTerm } = store.get();
      if (invalidTerm) {
        store.set({ invalidTerm: null });
        applyFiltersAndSort();
      }
      closeDetailModal(false);
    }
  } else {
    switchView(VIEWS.DICTIONARY, null, false);
    const rec = allRecords.find(r => r.ja_term === colKey || r.id === colKey);
    if (rec) {
      store.set({ invalidTerm: null });
      openMeaningModal(rec.row_index, false);
    } else {
      closeDetailModal(false);
      store.set({ invalidTerm: colKey });
      applyFiltersAndSort();
    }
  }
}
