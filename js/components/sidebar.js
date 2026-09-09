/**
 * Side Navigation & Collection Switcher Component
 */
import { EXHIBITION_STATUS, STORAGE_KEYS } from '../constants.js';
import { collectionsConfig } from '../config.js';
import { store } from '../state.js';
import { loadCollectionData, collectionsMetaCache, renderCollectionNotice, isCollectionHidden } from '../data.js';

export function updateSidebarBadge(colId) {
  const badgeElem = document.getElementById(`side-nav-count-${colId}`);
  if (!badgeElem) return;

  const col = collectionsConfig[colId];
  const meta = collectionsMetaCache[colId] || (col ? col.defaultMeta : null);
  const statusStr = meta && meta.status ? String(meta.status) : '';
  const isAdjusting = statusStr === EXHIBITION_STATUS.ADJUSTING ||
                      statusStr === '調整中' || statusStr.includes('調整中') ||
                      statusStr.includes('ADJUSTMENT');
  const isPreparing = statusStr === EXHIBITION_STATUS.PREPARING ||
                      statusStr === '籌備中' || statusStr.includes('籌備中') ||
                      statusStr.includes('PREPARATION');

  if (isAdjusting) {
    badgeElem.innerText = EXHIBITION_STATUS.ADJUSTING;
    badgeElem.style.display = 'inline-block';
  } else if (isPreparing) {
    badgeElem.innerText = EXHIBITION_STATUS.PREPARING;
    badgeElem.style.display = 'inline-block';
  } else {
    badgeElem.innerText = '';
    badgeElem.style.display = 'none';
  }
}

export function initSidebarState() {
  const collapsedVal = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
  const collapsed = collapsedVal === 'true';
  const wrapper = document.getElementById('app-layout-wrapper');
  if (wrapper) {
    if (collapsed) {
      wrapper.classList.add('sidebar-collapsed');
    } else {
      wrapper.classList.remove('sidebar-collapsed');
    }
  }
}

export function toggleSidebar() {
  const wrapper = document.getElementById('app-layout-wrapper');
  if (!wrapper) return;

  const isCollapsed = wrapper.classList.toggle('sidebar-collapsed');
  wrapper.classList.toggle('sidebar-open', !isCollapsed);
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, isCollapsed);
}

export function switchCollection(collectionId, updateHash = true) {
  if (!collectionsConfig[collectionId]) return;

  const col = collectionsConfig[collectionId];
  const meta = collectionsMetaCache[collectionId] || col.defaultMeta;

  if (isCollectionHidden(meta)) {
    if (window.switchView) {
      window.switchView('welcome', null, updateHash);
    }
    return;
  }

  const { currentCollectionId, allRecords } = store.get();
  const isDifferent = currentCollectionId !== collectionId;

  store.set({
    currentCollectionId: collectionId,
    invalidTerm: null,
    searchQuery: ''
  });

  const cardGrid = document.getElementById('card-grid');
  if (cardGrid) cardGrid.setAttribute('data-collection', collectionId);

  // Update Header Title & Subtitle & ID
  const headerTitle = document.getElementById('collection-header-title');
  if (headerTitle) {
    headerTitle.innerText = (meta && meta.enTitle) ? meta.enTitle : (col && col.enTitle ? col.enTitle : (collectionId === 'china-terms' ? 'China Terms' : (collectionId === 'korean-terms' ? 'Korean Terms' : 'Japanese Terms')));
  }

  const headerCnTitle = document.getElementById('collection-header-cn-title');
  if (headerCnTitle) {
    headerCnTitle.innerText = (meta && meta.title) ? meta.title : col.name;
  }

  const headerId = document.getElementById('collection-header-id');
  if (headerId) headerId.innerText = (meta && meta.id) ? meta.id : '';

  const headerSubtitle = document.getElementById('collection-header-subtitle');
  if (headerSubtitle) headerSubtitle.innerText = (meta && meta.subtitle) ? meta.subtitle : '';

  // Update Search Input Placeholder
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    if (col.searchPlaceholder) {
      searchInput.placeholder = col.searchPlaceholder;
    }
  }

  // Toggle Kana Tabs
  const kanaTabsRow = document.getElementById('kana-tabs-row');
  const quickTabsLabel = document.getElementById('quick-tabs-label');
  const kanaOnlyTabs = document.querySelectorAll('#kana-tabs .kana-only');

  if (kanaTabsRow) {
    kanaTabsRow.style.display = 'flex';
  }

  if (quickTabsLabel) quickTabsLabel.innerText = '展品篩選：';
  if (col.hasReading) {
    kanaOnlyTabs.forEach(tab => tab.style.display = 'inline-flex');
  } else {
    kanaOnlyTabs.forEach(tab => tab.style.display = 'none');
  }

  // Update Select Dropdown
  const selectElem = document.getElementById('collection-select');
  if (selectElem) selectElem.value = collectionId;

  // Update Side Navigation Active State
  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-col-${collectionId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Ensure view is set to dictionary/collection view
  if (window.switchView) {
    window.switchView('dictionary', null, updateHash);
  }

  // Render Notice Footer
  renderCollectionNotice();

  // Load Collection Data
  if (isDifferent || allRecords.length === 0) {
    loadCollectionData(collectionId);
  }

  if (isDifferent) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export function onCollectionSelectChange(elem) {
  if (elem && elem.value) {
    switchCollection(elem.value);
  }
}
