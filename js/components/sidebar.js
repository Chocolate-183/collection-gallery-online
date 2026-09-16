/**
 * Side Navigation & Collection Switcher Component
 */
import { EXHIBITION_STATUS, STORAGE_KEYS } from '../constants.js';
import { collectionsConfig } from '../config.js';
import { store } from '../state.js';
import { loadCollectionData, collectionsMetaCache, renderCollectionNotice } from '../data.js';
import { isCollectionAdjusting, isCollectionPreparing, isCollectionHidden, getCollectionEnTitle } from '../utils.js';

function isMobileView() {
  const win = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null);
  return win && typeof win.innerWidth === 'number' ? win.innerWidth <= 768 : true;
}

export function updateSidebarBadge(colId) {
  const badgeElem = document.getElementById(`side-nav-count-${colId}`);
  if (!badgeElem) return;

  const col = collectionsConfig[colId];
  const meta = collectionsMetaCache[colId] || col?.defaultMeta;
  const isAdjusting = isCollectionAdjusting(meta);
  const isPreparing = isCollectionPreparing(meta);

  if (isAdjusting || isPreparing) {
    badgeElem.innerText = isAdjusting ? EXHIBITION_STATUS.ADJUSTING : EXHIBITION_STATUS.PREPARING;
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
    wrapper.classList.toggle('sidebar-collapsed', collapsed);
  }
}

export function closeSidebarOnMobile() {
  const wrapper = document.getElementById('app-layout-wrapper');
  if (!wrapper) return;

  if (isMobileView()) {
    wrapper.classList.add('sidebar-collapsed');
    wrapper.classList.remove('sidebar-open');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, 'true');
    }
  }
}

export function initSidebarOutsideClick() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('app-layout-wrapper');
    if (!wrapper) return;

    const isSidebarOpen = wrapper.classList.contains('sidebar-open') || !wrapper.classList.contains('sidebar-collapsed');
    if (isMobileView() && isSidebarOpen) {
      const sidebar = (typeof document.querySelector === 'function') ? document.querySelector('.awsui-side-navigation') : document.getElementById('side-navigation');
      const toggleBtn = document.getElementById('btn-toggle-sidebar');

      const isOutsideSidebar = sidebar?.contains ? !sidebar.contains(e.target) : (sidebar !== e.target);
      const isOutsideToggle = toggleBtn?.contains ? !toggleBtn.contains(e.target) : (toggleBtn !== e.target);

      if (isOutsideSidebar && isOutsideToggle) {
        closeSidebarOnMobile();
      }
    }
  });
}

export function toggleSidebar() {
  const wrapper = document.getElementById('app-layout-wrapper');
  if (!wrapper) return;

  const isCollapsed = wrapper.classList.toggle('sidebar-collapsed');
  wrapper.classList.toggle('sidebar-open', !isCollapsed);
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, isCollapsed);
}

export function switchCollection(collectionId, updateHash = true) {
  closeSidebarOnMobile();
  const col = collectionsConfig[collectionId];
  if (!col) return;

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
    searchQuery: '',
    ...(isDifferent ? { currentKanaTab: 'ALL', currentLengthTab: 'ALL' } : {})
  });

  const cardGrid = document.getElementById('card-grid');
  if (cardGrid) cardGrid.setAttribute('data-collection', collectionId);

  // Update Header Title & Subtitle & ID
  const headerTitle = document.getElementById('collection-header-title');
  if (headerTitle) headerTitle.innerText = getCollectionEnTitle(collectionId, meta, col);

  const headerCnTitle = document.getElementById('collection-header-cn-title');
  if (headerCnTitle) headerCnTitle.innerText = meta?.title || col.name;

  const headerId = document.getElementById('collection-header-id');
  if (headerId) headerId.innerText = meta?.id || '';

  const headerSubtitle = document.getElementById('collection-header-subtitle');
  if (headerSubtitle) headerSubtitle.innerText = meta?.subtitle || '';

  // Update Search Input Placeholder
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    if (col.searchPlaceholder) searchInput.placeholder = col.searchPlaceholder;
  }

  // Toggle Kana / Hangul initial tabs
  const kanaTabsRow = document.getElementById('kana-tabs-row');
  const quickTabsLabel = document.getElementById('quick-tabs-label');
  const kanaOnlyTabs = document.querySelectorAll('#kana-tabs .kana-only');
  const hangulOnlyTabs = document.querySelectorAll('#kana-tabs .hangul-only');

  if (kanaTabsRow) kanaTabsRow.style.display = 'flex';
  if (quickTabsLabel) quickTabsLabel.innerText = '展品篩選：';
  kanaOnlyTabs.forEach(tab => {
    tab.style.display = (col.hasKanaTabs ?? col.hasReading) ? 'inline-flex' : 'none';
  });
  hangulOnlyTabs.forEach(tab => {
    tab.style.display = col.hasHangulTabs ? 'inline-flex' : 'none';
  });

  if (isDifferent) {
    const kanaPills = document.querySelectorAll('#kana-tabs .awsui-tab');
    kanaPills.forEach(p => p.classList.remove('active'));
    document.querySelector('#kana-tabs .awsui-tab')?.classList.add('active');
    const lengthPills = document.querySelectorAll('#length-tabs .awsui-tab');
    lengthPills.forEach(p => p.classList.remove('active'));
    document.querySelector('#length-tabs .awsui-tab')?.classList.add('active');
  }

  // Update Select Dropdown
  const selectElem = document.getElementById('collection-select');
  if (selectElem) selectElem.value = collectionId;

  // Update Side Navigation Active State
  document.querySelectorAll('.awsui-nav-link').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`nav-col-${collectionId}`)?.classList.add('active');

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

  if (isDifferent && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

