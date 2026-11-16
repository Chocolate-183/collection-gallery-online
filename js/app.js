/**
 * Main Application Entry Point
 */
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { initTheme, toggleTheme } from './theme.js';
import { preloadAllCollections, refreshGalleryData, updateStatsView } from './data.js';
import { onSearchInput, selectQuickFilter, selectLengthTab, selectInitialTab, selectKindTab, selectEtymologyTab, selectPosTab, selectLevelTab, showMorePosTabs, selectSortField, selectSortOrder, selectScriptVariant, resetFineFilters, resetDisplaySettings, resetFilterAndDisplay, openFilterModal, closeFilterModalOnBackdrop, closeDisplayModalOnBackdrop, closeCatalogPanels, initCatalogPanelLayout } from './filter.js';
import { initSidebarState, toggleSidebar, closeSidebarOnMobile, initSidebarOutsideClick, switchCollection, updateSidebarBadge } from './components/sidebar.js';
import { selectPageSize } from './components/pagination.js';
import { openMeaningModal, closeDetailModal, closeDetailModalOnBackdrop, navigateToTerm, openCollectionModal, closeCollectionModal, closeCollectionModalOnBackdrop, closeDescriptionModal, closeDescriptionModalOnBackdrop, handleMeaningTextClick, handleCollectionDescriptionClick, handleCuratorClick, closeProfileModal, closeProfileModalOnBackdrop, handleStdictReferenceClick } from './components/modal.js';
import { handleConjugationClick, closeConjugationModal, closeConjugationModalOnBackdrop, initItemConjugationPager } from './components/conjugation.js';
import { switchView, handleHashRoute } from './router.js';

// Handlers referenced by inline HTML attributes (index.html and generated card markup).
Object.assign(window, {
  currentCollectionId: store.get().currentCollectionId,
  toggleSidebar,
  closeSidebarOnMobile,
  toggleTheme,
  switchView,
  switchCollection,
  refreshGalleryData,
  onSearchInput,
  selectQuickFilter,
  selectPageSize,
  selectLengthTab,
  selectInitialTab,
  selectKindTab,
  selectEtymologyTab,
  selectPosTab,
  selectLevelTab,
  showMorePosTabs,
  selectSortField,
  selectSortOrder,
  selectScriptVariant,
  resetFineFilters,
  resetDisplaySettings,
  resetFilterAndDisplay,
  openFilterModal,
  closeFilterModalOnBackdrop,
  closeDisplayModalOnBackdrop,
  closeCatalogPanels,
  openMeaningModal,
  closeDetailModal,
  closeDetailModalOnBackdrop,
  openCollectionModal,
  closeCollectionModal,
  closeCollectionModalOnBackdrop,
  closeDescriptionModal,
  closeDescriptionModalOnBackdrop,
  handleMeaningTextClick,
  handleCollectionDescriptionClick,
  handleCuratorClick,
  closeProfileModal,
  closeProfileModalOnBackdrop,
  handleConjugationClick,
  closeConjugationModal,
  closeConjugationModalOnBackdrop
});

// `#btn-refresh-data` reads window.currentCollectionId.
store.subscribe(state => {
  window.currentCollectionId = state.currentCollectionId;
});

const isOpen = id => Boolean(document.getElementById(id)?.classList.contains('open'));

/** Escape closes the top-most layer only. The Notice Panel cannot be dismissed. */
function handleEscape() {
  if (isOpen('notice-modal')) return;
  if (isOpen('description-modal')) closeDescriptionModal();
  else if (isOpen('profile-modal')) closeProfileModal();
  else if (isOpen('conjugation-modal')) closeConjugationModal();
  else if (isOpen('filter-modal') || isOpen('display-modal')) closeCatalogPanels();
  else {
    closeDetailModal();
    closeCollectionModal();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSidebarState();
  initSidebarOutsideClick();
  initCatalogPanelLayout();
  initItemConjugationPager();

  const colIds = Object.keys(collectionsConfig);
  colIds.forEach(updateSidebarBadge);
  await preloadAllCollections();
  colIds.forEach(updateSidebarBadge);
  updateStatsView();
  handleHashRoute();

  window.addEventListener('hashchange', handleHashRoute);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') handleEscape();
  });

  document.getElementById('modal-recommendations-list')?.addEventListener('click', (e) => {
    const term = e.target.closest('.awsui-recommendation-chip')?.getAttribute('data-term');
    if (term) navigateToTerm(term);
  });
  document.getElementById('modal-reference')?.addEventListener('click', handleStdictReferenceClick);
});
