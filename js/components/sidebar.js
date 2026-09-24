/**
 * Side Navigation & Collection Switcher Component
 */
import { EXHIBITION_STATUS, STORAGE_KEYS, SORT_FIELDS, SORT_ORDERS } from '../constants.js';
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

  // Before live metadata arrives, treat every hall as open (no status badge).
  const meta = collectionsMetaCache[colId];
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
    ...(isDifferent ? {
      currentLengthTab: 'ALL',
      currentInitialTab: 'ALL',
      loanwordOnly: false,
      currentSortField: col.hasHangulTabs
        ? SORT_FIELDS.TITLE
        : ((col.hasKanaTabs ?? col.hasReading) ? SORT_FIELDS.STANDARD : SORT_FIELDS.TITLE),
      currentSortOrder: SORT_ORDERS.ASC
    } : {})
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

  const hangulSection = document.getElementById('filter-hangul-section');
  const kanaSection = document.getElementById('filter-kana-section');
  const kindSection = document.getElementById('filter-kind-section');
  const readingSortTab = document.getElementById('sort-field-reading');
  const glossSortTab = document.getElementById('sort-field-subtitle');
  if (hangulSection) hangulSection.style.display = col.hasHangulTabs ? '' : 'none';
  if (kanaSection) kanaSection.style.display = (col.hasKanaTabs ?? col.hasReading) ? '' : 'none';
  if (kindSection) kindSection.style.display = col.hasLoanwordFilter ? '' : 'none';
  if (readingSortTab) readingSortTab.style.display = (col.hasKanaTabs ?? col.hasReading) && !col.hasHangulTabs ? '' : 'none';
  if (glossSortTab) glossSortTab.style.display = col.hasHangulTabs ? '' : 'none';
  const titleSortTab = document.querySelector('#sort-field-tabs [data-tab="title"]');
  if (titleSortTab && titleSortTab.classList) {
    const defaultField = col.hasHangulTabs || !(col.hasKanaTabs ?? col.hasReading) ? 'title' : 'standard';
    if (isDifferent) {
      document.querySelectorAll('#sort-field-tabs .awsui-tab').forEach(p => p.classList.remove('active'));
      document.querySelector(`#sort-field-tabs [data-tab="${defaultField}"]`)?.classList.add('active');
    }
  }

  if (typeof window.syncFilterUi === 'function') {
    window.syncFilterUi();
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

