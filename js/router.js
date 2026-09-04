/**
 * Hash Routing & View Switcher Engine
 */
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { switchCollection } from './components/sidebar.js';
import { openMeaningModal, closeDetailModal } from './components/modal.js';
import { renderCollectionNotice } from './data.js';

export function switchView(viewName, event, updateHash = true) {
  if (event && event.preventDefault) event.preventDefault();
  
  const { currentCollectionId } = store.get();
  store.set({ currentView: viewName });

  const navWelcome = document.getElementById('nav-welcome');
  const navAbout = document.getElementById('nav-about');
  const viewWelcome = document.getElementById('view-welcome');
  const viewDictionary = document.getElementById('view-dictionary');
  const viewAbout = document.getElementById('view-about');

  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));

  if (viewName === 'welcome') {
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

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function handleHashRoute() {
  const rawHash = window.location.hash;
  const decodedHash = decodeURIComponent(rawHash || '');
  const { currentCollectionId, allRecords } = store.get();

  if (!decodedHash || decodedHash === '#' || decodedHash === '#/') {
    switchView('welcome', null, false);
    closeDetailModal(false);
    if (location.hash !== '#/welcome') {
      location.hash = '#/welcome';
    }
    return;
  }

  const path = decodedHash.replace(/^#\/?/, '');
  if (!path || path === 'welcome' || path === 'home') {
    switchView('welcome', null, false);
    closeDetailModal(false);
    return;
  }

  if (path === 'about') {
    switchView('about', null, false);
    closeDetailModal(false);
    return;
  }

  const parts = path.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
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
        openMeaningModal(rec.row_index, false);
      } else {
        closeDetailModal(false);
      }
    } else {
      closeDetailModal(false);
    }
  } else {
    switchView('dictionary', null, false);
    const rec = allRecords.find(r => r.ja_term === colKey || r.id === colKey);
    if (rec) {
      openMeaningModal(rec.row_index, false);
    } else {
      closeDetailModal(false);
    }
  }
}
