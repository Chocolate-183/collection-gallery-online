/**
 * Hash Routing & View Switcher Engine
 */
import { VIEWS } from './constants.js';
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { switchCollection, closeSidebarOnMobile } from './components/sidebar.js';
import { openMeaningModal, closeDetailModal, openCollectionModal, closeCollectionModal, openDescriptionModal, closeDescriptionModal, openCollectionDescriptionModal, openProfileModal, closeProfileModal } from './components/modal.js';
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
    const isActive = viewKey === targetView;
    elem.classList.toggle('active', isActive);
    elem.style.display = isActive ? 'block' : 'none';
  });
}

function updateMaintenanceView(isClosed, isColPreparing, isColAdjusting, colMeta, currentCollectionId) {
  const maintTitle = document.getElementById('maintenance-title');
  const maintDesc1 = document.getElementById('maintenance-desc-1');
  const maintDesc2 = document.getElementById('maintenance-desc-2');

  let title = 'MAINTENANCE';
  let desc1 = '';
  let showDesc2 = false;

  if (isClosed) {
    title = 'CLOSED';
    desc1 = '目前為非開放時間，歡迎於開館時間再次蒞臨參觀。';
    showDesc2 = true;
  } else if (isColPreparing) {
    title = 'COMING SOON';
    const rawAnnounce = colMeta?.announcement;
    desc1 = (rawAnnounce && !['籌備中', 'IN PREPARATION', 'PREPARING', 'COMING SOON'].includes(rawAnnounce))
      ? rawAnnounce
      : '本展廳目前正在籌備中，暫不開放參觀，敬請期待。';
  } else if (isColAdjusting) {
    title = 'ADJUSTING';
    const rawAnnounce = colMeta?.announcement;
    desc1 = (rawAnnounce && !['調整中', '展廳調整中', 'UNDER ADJUSTMENT', 'ADJUSTING'].includes(rawAnnounce))
      ? rawAnnounce
      : '本展廳目前正在進行內容調整，暫不開放參觀，敬請期待。';
  }

  if (maintTitle) maintTitle.innerText = title;
  if (maintDesc1) maintDesc1.innerText = desc1;
  if (maintDesc2) maintDesc2.style.display = showDesc2 ? 'block' : 'none';

  if (!isClosed && (isColAdjusting || isColPreparing)) {
    const activeColBtn = document.getElementById(`nav-col-${currentCollectionId}`);
    if (activeColBtn) activeColBtn.classList.add('active');
  }
}

export function switchView(viewName, event, updateHash = true) {
  closeSidebarOnMobile();
  if (event?.preventDefault) event.preventDefault();

  const isClosed = !isGalleryOpen();
  if (isClosed && viewName !== VIEWS.MAINTENANCE && viewName !== VIEWS.ABOUT && viewName !== VIEWS.STATS) {
    viewName = VIEWS.MAINTENANCE;
  }

  const { currentView, currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId];
  const colMeta = collectionsMetaCache[currentCollectionId] || col?.defaultMeta;
  const isColAdjusting = isCollectionAdjusting(colMeta);
  const isColPreparing = isCollectionPreparing(colMeta);

  if (!isClosed && viewName === VIEWS.DICTIONARY && (isColAdjusting || isColPreparing)) {
    viewName = VIEWS.MAINTENANCE;
  }

  const isViewChanged = currentView !== viewName;
  store.set({ currentView: viewName });

  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));
  toggleViewElements(viewName);

  const colSlug = col ? col.name : currentCollectionId;

  if (viewName === VIEWS.MAINTENANCE) {
    updateMaintenanceView(isClosed, isColPreparing, isColAdjusting, colMeta, currentCollectionId);
    setHash(isClosed ? '#/maintenance' : `#/${colSlug}`, updateHash);
  } else if (viewName === VIEWS.WELCOME) {
    document.getElementById('nav-welcome')?.classList.add('active');
    setHash('#/welcome', updateHash);
  } else if (viewName === VIEWS.DICTIONARY) {
    document.getElementById(`nav-col-${currentCollectionId}`)?.classList.add('active');
    renderCollectionNotice();
    setHash(`#/${colSlug}`, updateHash);
  } else if (viewName === VIEWS.ABOUT) {
    document.getElementById('nav-about')?.classList.add('active');
    setHash('#/about', updateHash);
  } else if (viewName === VIEWS.STATS) {
    document.getElementById('nav-stats')?.classList.add('active');
    setHash('#/stats', updateHash);
    updateStatsView();
  }

  if ((isViewChanged || !!event) && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setHash('#/maintenance');
    return;
  }

  if (!decodedHash || decodedHash === '#' || decodedHash === '#/' || !path || path === 'welcome' || path === 'home' || path === 'maintenance') {
    store.set({ invalidTerm: null });
    switchView(VIEWS.WELCOME, null, false);
    closeDetailModal(false);
    if (path === 'maintenance' || !decodedHash || decodedHash === '#' || decodedHash === '#/') {
      setHash('#/welcome');
    }
    return;
  }

  if (path === 'about' || path === 'stats') {
    store.set({ invalidTerm: null });
    switchView(path === 'about' ? VIEWS.ABOUT : VIEWS.STATS, null, false);
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
  if (colKey === '中國特色詞彙' || colKey === '大陸特色詞彙' || colKey === '大陸特色詞彙一覽') {
    colKey = '簡中語境破解攻略';
  }
  const termName = parts.length >= 2 ? parts[1] : null;
  const subAction = parts.length >= 3 ? parts[2] : null;

  const targetColId = Object.keys(collectionsConfig).find(
    key => key === colKey || collectionsConfig[key].name === colKey
  );

  if (targetColId) {
    const targetMeta = collectionsMetaCache[targetColId] || collectionsConfig[targetColId]?.defaultMeta;
    if (isCollectionHidden(targetMeta)) {
      store.set({ invalidTerm: null });
      switchView(VIEWS.WELCOME, null, false);
      closeDetailModal(false);
      setHash('#/welcome');
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
        if (subAction === 'description') {
          openCollectionDescriptionModal(targetColId, null, false);
        } else if (subAction === 'profile') {
          closeDescriptionModal(false);
          const curatorName = collectionsConfig[targetColId]?.curator;
          if (curatorName) openProfileModal(curatorName, false);
          else closeProfileModal(false);
        } else {
          closeDescriptionModal(false);
          closeProfileModal(false);
        }
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
            closeProfileModal(false);
          }
        } else {
          closeDetailModal(false);
          closeCollectionModal(false);
          store.set({ invalidTerm: termName });
          applyFiltersAndSort();
        }
      }
    } else {
      if (store.get().invalidTerm) {
        store.set({ invalidTerm: null });
        applyFiltersAndSort();
      }
      closeDetailModal(false);
      closeCollectionModal(false);
      closeProfileModal(false);
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
        closeProfileModal(false);
      }
    } else {
      closeDetailModal(false);
      store.set({ invalidTerm: colKey });
      applyFiltersAndSort();
    }
  }
}
