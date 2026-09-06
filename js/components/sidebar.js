/**
 * Side Navigation & Collection Switcher Component
 */
import { collectionsConfig } from '../config.js';
import { store } from '../state.js';
import { loadCollectionData, collectionsMetaCache, renderCollectionNotice } from '../data.js';

export function updateSidebarBadge(colId) {
  const badgeElem = document.getElementById(`side-nav-count-${colId}`);
  if (!badgeElem) return;

  const col = collectionsConfig[colId];
  const meta = collectionsMetaCache[colId] || (col ? col.defaultMeta : null);
  const isAdjusting = meta && (meta.status === '調整中' || (typeof meta.status === 'string' && meta.status.includes('調整中')));

  if (isAdjusting) {
    badgeElem.innerText = '調整中';
    badgeElem.style.display = 'inline-block';
  } else {
    badgeElem.innerText = '';
    badgeElem.style.display = 'none';
  }
}

export function initSidebarState() {
  const collapsedVal = localStorage.getItem('aws_sidebar_collapsed');
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
  localStorage.setItem('aws_sidebar_collapsed', isCollapsed);
}

export function switchCollection(collectionId, updateHash = true) {
  if (!collectionsConfig[collectionId]) return;
  const { currentCollectionId, allRecords } = store.get();
  const isDifferent = currentCollectionId !== collectionId;
  
  store.set({
    currentCollectionId: collectionId,
    invalidTerm: null,
    searchQuery: ''
  });
  const col = collectionsConfig[collectionId];

  const cardGrid = document.getElementById('card-grid');
  if (cardGrid) cardGrid.setAttribute('data-collection', collectionId);

  // Update Header Title & Subtitle & ID
  const meta = collectionsMetaCache[collectionId] || col.defaultMeta;
  const headerTitle = document.getElementById('collection-header-title');
  if (headerTitle) headerTitle.innerText = (meta && meta.title) ? meta.title : col.name;

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
