/**
 * Hash Routing & View Switcher Engine
 */
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { switchCollection } from './components/sidebar.js';
import { openMeaningModal, closeDetailModal } from './components/modal.js';
import { renderCollectionNotice } from './data.js';
import { applyFiltersAndSort } from './filter.js';
import { isGalleryOpen } from './utils.js';

export function switchView(viewName, event, updateHash = true) {
  if (event && event.preventDefault) event.preventDefault();

  if (!isGalleryOpen() && viewName !== 'maintenance') {
    viewName = 'maintenance';
  }
  
  const { currentView, currentCollectionId } = store.get();
  const isViewChanged = currentView !== viewName;
  store.set({ currentView: viewName });

  const navWelcome = document.getElementById('nav-welcome');
  const navAbout = document.getElementById('nav-about');
  const viewWelcome = document.getElementById('view-welcome');
  const viewDictionary = document.getElementById('view-dictionary');
  const viewAbout = document.getElementById('view-about');
  const viewMaintenance = document.getElementById('view-maintenance');

  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));

  if (viewName === 'maintenance') {
    if (viewWelcome) {
      viewWelcome.classList.remove('active');
      viewWelcome.style.display = 'none';
    }
    if (viewDictionary) {
      viewDictionary.classList.remove('active');
      viewDictionary.style.display = 'none';
    }
    if (viewAbout) {
      viewAbout.classList.remove('active');
      viewAbout.style.display = 'none';
    }
    if (viewMaintenance) {
      viewMaintenance.classList.add('active');
      viewMaintenance.style.display = 'block';
    }

    if (updateHash) {
      if (decodeURIComponent(window.location.hash) !== '#/maintenance') {
        location.hash = '#/maintenance';
      }
    }
  } else if (viewName === 'welcome') {
    if (navWelcome) navWelcome.classList.add('active');

    if (viewWelcome) {
      viewWelcome.classList.add('active');
      viewWelcome.style.display = 'block';
    }
    if (viewDictionary) {
      viewDictionary.classList.remove('active');
      viewDictionary.style.display = 'none';
    }
    if (viewAbout) {
      viewAbout.classList.remove('active');
      viewAbout.style.display = 'none';
    }
    if (viewMaintenance) {
      viewMaintenance.classList.remove('active');
      viewMaintenance.style.display = 'none';
    }

    if (updateHash) {
      if (decodeURIComponent(window.location.hash) !== '#/welcome') {
        location.hash = '#/welcome';
      }
    }
  } else if (viewName === 'dictionary') {
    const activeColBtn = document.getElementById(`nav-col-${currentCollectionId}`);
    if (activeColBtn) activeColBtn.classList.add('active');

    if (viewWelcome) {
      viewWelcome.classList.remove('active');
      viewWelcome.style.display = 'none';
    }
    if (viewAbout) {
      viewAbout.classList.remove('active');
      viewAbout.style.display = 'none';
    }
    if (viewMaintenance) {
      viewMaintenance.classList.remove('active');
      viewMaintenance.style.display = 'none';
    }
    if (viewDictionary) {
      viewDictionary.classList.add('active');
      viewDictionary.style.display = 'block';
      renderCollectionNotice();
    }

    if (updateHash) {
      const col = collectionsConfig[currentCollectionId];
      const colName = col ? col.name : currentCollectionId;
      const targetHash = `#/${colName}`;
      if (decodeURIComponent(window.location.hash) !== targetHash) {
        location.hash = targetHash;
      }
    }
  } else if (viewName === 'about') {
    if (navAbout) navAbout.classList.add('active');

    if (viewWelcome) {
      viewWelcome.classList.remove('active');
      viewWelcome.style.display = 'none';
    }
    if (viewDictionary) {
      viewDictionary.classList.remove('active');
      viewDictionary.style.display = 'none';
    }
    if (viewMaintenance) {
      viewMaintenance.classList.remove('active');
      viewMaintenance.style.display = 'none';
    }
    if (viewAbout) {
      viewAbout.classList.add('active');
      viewAbout.style.display = 'block';
    }

    if (updateHash) {
      if (decodeURIComponent(window.location.hash) !== '#/about') {
        location.hash = '#/about';
      }
    }
  }

  if (isViewChanged || !!event) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export function handleHashRoute() {
  if (!isGalleryOpen()) {
    store.set({ invalidTerm: null });
    switchView('maintenance', null, false);
    closeDetailModal(false);
    if (decodeURIComponent(location.hash) !== '#/maintenance') {
      location.hash = '#/maintenance';
    }
    return;
  }

  const rawHash = window.location.hash;
  const decodedHash = decodeURIComponent(rawHash || '');
  const { currentCollectionId, allRecords } = store.get();

  if (!decodedHash || decodedHash === '#' || decodedHash === '#/') {
    store.set({ invalidTerm: null });
    switchView('welcome', null, false);
    closeDetailModal(false);
    if (location.hash !== '#/welcome') {
      location.hash = '#/welcome';
    }
    return;
  }

  const path = decodedHash.replace(/^#\/?/, '');
  if (path === 'maintenance') {
    store.set({ invalidTerm: null });
    switchView('welcome', null, false);
    closeDetailModal(false);
    if (location.hash !== '#/welcome') {
      location.hash = '#/welcome';
    }
    return;
  }

  if (!path || path === 'welcome' || path === 'home') {
    store.set({ invalidTerm: null });
    switchView('welcome', null, false);
    closeDetailModal(false);
    return;
  }

  if (path === 'about') {
    store.set({ invalidTerm: null });
    switchView('about', null, false);
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
    switchView('dictionary', null, false);

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
    switchView('dictionary', null, false);
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
