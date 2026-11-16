/**
 * Side Navigation & Collection Switcher
 */
import { EXHIBITION_STATUS, STORAGE_KEYS, VIEWS } from '../constants.js';
import { collectionsConfig } from '../config.js';
import { store } from '../state.js';
import { loadCollectionData, collectionsMetaCache, getCollectionMeta, renderCollectionNotice, renderCollectionHeader } from '../data.js';
import { getDefaultSortField, getHallDefaultState, syncFilterUi } from '../filter.js';
import { switchView } from '../router.js';
import { isCollectionAdjusting, isCollectionPreparing, isCollectionHidden, isMobileViewport } from '../utils.js';

/**
 * Sidebar status badge. Uses live metadata only, so every hall reads as open
 * until the metadata cache is filled (avoids flashing ADJUSTING from defaultMeta).
 */
export function updateSidebarBadge(colId) {
  const badgeElem = document.getElementById(`side-nav-count-${colId}`);
  if (!badgeElem) return;

  const meta = collectionsMetaCache[colId];
  const status = isCollectionAdjusting(meta)
    ? EXHIBITION_STATUS.ADJUSTING
    : isCollectionPreparing(meta) ? EXHIBITION_STATUS.PREPARING : '';
  badgeElem.innerText = status;
  badgeElem.style.display = status ? 'inline-block' : 'none';
}

function getLayoutWrapper() {
  return document.getElementById('app-layout-wrapper');
}

export function initSidebarState() {
  const collapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  getLayoutWrapper()?.classList.toggle('sidebar-collapsed', collapsed);
}

export function closeSidebarOnMobile() {
  const wrapper = getLayoutWrapper();
  if (!wrapper || !isMobileViewport()) return;
  wrapper.classList.add('sidebar-collapsed');
  wrapper.classList.remove('sidebar-open');
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, 'true');
}

/** On mobile, tapping anywhere outside the sidebar and its toggle button closes it. */
export function initSidebarOutsideClick() {
  document.addEventListener('click', (e) => {
    const wrapper = getLayoutWrapper();
    if (!wrapper || !isMobileViewport()) return;
    const isSidebarOpen = wrapper.classList.contains('sidebar-open') || !wrapper.classList.contains('sidebar-collapsed');
    if (!isSidebarOpen) return;

    const sidebar = document.querySelector('.awsui-side-navigation');
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (!sidebar?.contains(e.target) && !toggleBtn?.contains(e.target)) closeSidebarOnMobile();
  });
}

export function toggleSidebar() {
  const wrapper = getLayoutWrapper();
  if (!wrapper) return;
  const isCollapsed = wrapper.classList.toggle('sidebar-collapsed');
  wrapper.classList.toggle('sidebar-open', !isCollapsed);
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, isCollapsed);
}

/** Element id → predicate deciding whether that hall-specific control is shown. */
const HALL_SPECIFIC_CONTROLS = {
  'filter-hangul-section': col => col.hasHangulTabs,
  'filter-kana-section': col => col.hasKanaTabs ?? col.hasReading,
  'filter-kind-section': col => col.hasBasic100Filter || col.hasNameCategoryFilter,
  'filter-etymology-section': col => col.hasEtymologyPosFilter,
  'filter-pos-section': col => col.hasEtymologyPosFilter,
  'filter-level-section': col => col.hasLevelFilter,
  'kind-basic100': col => col.hasBasic100Filter,
  'kind-person': col => col.hasNameCategoryFilter,
  'kind-group': col => col.hasNameCategoryFilter,
  'kind-company': col => col.hasNameCategoryFilter,
  'quick-basic100': col => col.hasBasic100Filter,
  'quick-beginner': col => col.hasLevelFilter,
  'quick-intermediate': col => col.hasLevelFilter,
  'quick-advanced': col => col.hasLevelFilter,
  'sort-field-reading': col => (col.hasKanaTabs ?? col.hasReading) && !col.hasHangulTabs,
  'sort-field-subtitle': col => col.hasHangulTabs,
  'display-script-section': col => col.hasScriptDisplay
};

function applyHallSpecificControls(col) {
  Object.entries(HALL_SPECIFIC_CONTROLS).forEach(([id, isShown]) => {
    const elem = document.getElementById(id);
    if (elem) elem.style.display = isShown(col) ? '' : 'none';
  });
}

export function switchCollection(collectionId, updateHash = true) {
  closeSidebarOnMobile();
  const col = collectionsConfig[collectionId];
  if (!col) return;

  if (isCollectionHidden(getCollectionMeta(collectionId))) {
    switchView(VIEWS.WELCOME, null, updateHash);
    return;
  }

  const { currentCollectionId, allRecords } = store.get();
  const isDifferent = currentCollectionId !== collectionId;

  store.set({
    currentCollectionId: collectionId,
    invalidTerm: null,
    searchQuery: '',
    ...(isDifferent ? getHallDefaultState(col) : {})
  });

  if (isDifferent) {
    document.getElementById('pos-tabs')?.classList.remove('pos-expanded');
    document.querySelectorAll('#sort-field-tabs .awsui-tab').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-tab') === getDefaultSortField(col));
    });
  }

  document.getElementById('card-grid')?.setAttribute('data-collection', collectionId);
  renderCollectionHeader(collectionId);

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    if (col.searchPlaceholder) searchInput.placeholder = col.searchPlaceholder;
  }

  applyHallSpecificControls(col);
  syncFilterUi();

  switchView(VIEWS.DICTIONARY, null, updateHash);
  renderCollectionNotice();

  if (isDifferent || allRecords.length === 0) loadCollectionData(collectionId);

  if (isDifferent && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
