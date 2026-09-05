/**
 * Side Navigation & Collection Switcher Component
 */
import { collectionsConfig } from '../config.js';
import { store } from '../state.js';
import { loadCollectionData, collectionsMetaCache, renderCollectionNotice } from '../data.js';

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
  
  store.set({ currentCollectionId: collectionId });
  const col = collectionsConfig[collectionId];

  const cardGrid = document.getElementById('card-grid');
  if (cardGrid) cardGrid.setAttribute('data-collection', collectionId);

  // Update Header Title & Subtitle
  const meta = collectionsMetaCache[collectionId] || col.defaultMeta;
  const headerTitle = document.getElementById('collection-header-title');
  if (headerTitle) headerTitle.innerText = (meta && meta.title) ? meta.title : col.name;

  const headerSubtitle = document.getElementById('collection-header-subtitle');
  if (headerSubtitle) headerSubtitle.innerText = (meta && meta.subtitle) ? meta.subtitle : '';

  // Update Search Input Placeholder
  const searchInput = document.getElementById('search-input');
  if (searchInput && col.searchPlaceholder) {
    searchInput.placeholder = col.searchPlaceholder;
  }

  // Toggle Kana Tabs
  const kanaTabsRow = document.getElementById('kana-tabs-row');
  const quickTabsLabel = document.getElementById('quick-tabs-label');
  const kanaOnlyTabs = document.querySelectorAll('#kana-tabs .kana-only');

  if (kanaTabsRow) {
    kanaTabsRow.style.display = 'flex';
  }

  if (quickTabsLabel) quickTabsLabel.innerText = '快速篩選：';
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
