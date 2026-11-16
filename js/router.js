/**
 * Hash Routing & View Switcher
 *
 * Routes:
 *   #/welcome | #/about | #/stats
 *   #/{hall}                         Gallery
 *   #/{hall}/info[/description|/profile]
 *   #/{hall}/{term}[/description|/conjugation]
 *   #/{term}[/...]                   term in the current hall (legacy)
 */
import { VIEWS } from './constants.js';
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { switchCollection, closeSidebarOnMobile } from './components/sidebar.js';
import { openMeaningModal, closeDetailModal, openCollectionModal, closeCollectionModal, openDescriptionModal, closeDescriptionModal, openCollectionDescriptionModal, openProfileModal, closeProfileModal, collectionHash } from './components/modal.js';
import { openConjugationModal, closeConjugationModal } from './components/conjugation.js';
import { renderCollectionNotice, getCollectionMeta, updateStatsView } from './data.js';
import { applyFiltersAndSort } from './filter.js';
import { isCollectionAdjusting, isCollectionPreparing, isCollectionHidden } from './utils.js';

const LEGACY_HALL_ALIASES = {
  '中國特色詞彙': '簡中語境破解攻略',
  '大陸特色詞彙': '簡中語境破解攻略',
  '大陸特色詞彙一覽': '簡中語境破解攻略'
};

const VIEW_NAV_IDS = {
  [VIEWS.WELCOME]: 'nav-welcome',
  [VIEWS.ABOUT]: 'nav-about',
  [VIEWS.STATS]: 'nav-stats'
};

const MAINTENANCE_COPY = {
  preparing: {
    title: 'COMING SOON',
    defaultText: '本展廳目前正在籌備中，暫不開放參觀，敬請期待。',
    statusWords: ['籌備中', 'IN PREPARATION', 'PREPARING', 'COMING SOON']
  },
  adjusting: {
    title: 'ADJUSTING',
    defaultText: '本展廳目前正在進行內容調整，暫不開放參觀，敬請期待。',
    statusWords: ['調整中', '展廳調整中', 'UNDER ADJUSTMENT', 'ADJUSTING']
  }
};

function setHash(targetHash, updateHash = true) {
  if (updateHash && typeof window !== 'undefined' && decodeURIComponent(window.location.hash) !== targetHash) {
    location.hash = targetHash;
  }
}

function toggleViewElements(targetView) {
  Object.values(VIEWS).forEach(view => {
    const elem = document.getElementById(`view-${view}`);
    if (!elem) return;
    const isActive = view === targetView;
    elem.classList.toggle('active', isActive);
    elem.style.display = isActive ? 'block' : 'none';
  });
}

function updateMaintenanceView(colId, meta) {
  const copy = isCollectionPreparing(meta) ? MAINTENANCE_COPY.preparing : MAINTENANCE_COPY.adjusting;
  // A custom announcement replaces the default text unless it just restates the status.
  const announcement = meta?.announcement;
  const text = announcement && !copy.statusWords.includes(announcement) ? announcement : copy.defaultText;

  const titleElem = document.getElementById('maintenance-title');
  if (titleElem) titleElem.innerText = copy.title;
  const descElem = document.getElementById('maintenance-desc-1');
  if (descElem) descElem.innerText = text;
  document.getElementById(`nav-col-${colId}`)?.classList.add('active');
}

export function switchView(viewName, event, updateHash = true) {
  closeSidebarOnMobile();
  event?.preventDefault?.();

  const { currentView, currentCollectionId } = store.get();
  const meta = getCollectionMeta(currentCollectionId);
  if (viewName === VIEWS.DICTIONARY && (isCollectionAdjusting(meta) || isCollectionPreparing(meta))) {
    viewName = VIEWS.MAINTENANCE;
  }

  const isViewChanged = currentView !== viewName;
  store.set({ currentView: viewName });

  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));
  toggleViewElements(viewName);

  if (viewName === VIEWS.MAINTENANCE) {
    updateMaintenanceView(currentCollectionId, meta);
    setHash(collectionHash(currentCollectionId), updateHash);
  } else if (viewName === VIEWS.DICTIONARY) {
    document.getElementById(`nav-col-${currentCollectionId}`)?.classList.add('active');
    renderCollectionNotice();
    setHash(collectionHash(currentCollectionId), updateHash);
  } else {
    document.getElementById(VIEW_NAV_IDS[viewName])?.classList.add('active');
    setHash(`#/${viewName}`, updateHash);
    if (viewName === VIEWS.STATS) updateStatsView();
  }

  if ((isViewChanged || event) && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function showStaticView(view) {
  store.set({ invalidTerm: null });
  switchView(view, null, false);
  closeDetailModal(false);
}

function showInvalidTerm(term) {
  closeDetailModal(false);
  closeCollectionModal(false);
  store.set({ invalidTerm: term });
  applyFiltersAndSort();
}

/** Opens the Item modal for `rec`, plus an optional stacked panel (`description` / `conjugation`). */
function openRecordRoute(rec, subAction) {
  store.set({ invalidTerm: null });
  closeCollectionModal(false);
  openMeaningModal(rec.row_index, false);
  if (subAction === 'description') {
    closeConjugationModal(false);
    openDescriptionModal(rec.row_index, false);
    return;
  }
  closeDescriptionModal(false);
  closeProfileModal(false);
  if (subAction === 'conjugation') openConjugationModal(rec.row_index, false);
  else closeConjugationModal(false);
}

/** Opens the Collection modal plus an optional stacked panel (`description` / `profile`). */
function openInfoRoute(colId, subAction) {
  store.set({ invalidTerm: null });
  closeDetailModal(false);
  openCollectionModal(colId, false);
  if (subAction === 'description') {
    openCollectionDescriptionModal(colId, null, false);
    return;
  }
  closeDescriptionModal(false);
  const curator = collectionsConfig[colId]?.curator;
  if (subAction === 'profile' && curator) openProfileModal(curator, false);
  else closeProfileModal(false);
}

function findRecordByTerm(term) {
  return store.get().allRecords.find(r => r.ja_term === term || r.id === term);
}

export function handleHashRoute() {
  if (typeof window === 'undefined') return;
  const path = decodeURIComponent(window.location.hash || '').replace(/^#\/?/, '');

  if (!path || path === 'maintenance') {
    showStaticView(VIEWS.WELCOME);
    setHash('#/welcome');
    return;
  }
  if (path === 'welcome' || path === 'home') return showStaticView(VIEWS.WELCOME);
  if (path === 'about') return showStaticView(VIEWS.ABOUT);
  if (path === 'stats') return showStaticView(VIEWS.STATS);

  const parts = path.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    store.set({ invalidTerm: null });
    closeDetailModal(false);
    return;
  }

  const [rawKey, termName, subAction] = parts;
  const colKey = LEGACY_HALL_ALIASES[rawKey] || rawKey;
  const targetColId = Object.keys(collectionsConfig).find(
    key => key === colKey || collectionsConfig[key].name === colKey
  );

  // Legacy form: #/{term}[/sub] inside the current hall.
  if (!targetColId) {
    switchView(VIEWS.DICTIONARY, null, false);
    const rec = findRecordByTerm(colKey);
    if (rec) openRecordRoute(rec, termName);
    else {
      closeDetailModal(false);
      store.set({ invalidTerm: colKey });
      applyFiltersAndSort();
    }
    return;
  }

  if (isCollectionHidden(getCollectionMeta(targetColId))) {
    showStaticView(VIEWS.WELCOME);
    setHash('#/welcome');
    return;
  }

  if (targetColId !== store.get().currentCollectionId) {
    switchCollection(targetColId, false);
    return;
  }
  switchView(VIEWS.DICTIONARY, null, false);

  if (!termName) {
    if (store.get().invalidTerm) {
      store.set({ invalidTerm: null });
      applyFiltersAndSort();
    }
    closeDetailModal(false);
    closeCollectionModal(false);
    closeProfileModal(false);
    return;
  }

  if (termName === 'info' || termName === 'details') {
    openInfoRoute(targetColId, subAction);
    return;
  }

  const rec = findRecordByTerm(termName);
  if (rec) openRecordRoute(rec, subAction);
  else showInvalidTerm(termName);
}
