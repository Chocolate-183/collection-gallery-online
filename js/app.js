/**
 * Main Application Entry Point
 */
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { initTheme, toggleTheme, applyTheme } from './theme.js';
import { loadCollectionData, preloadAllCollections, updateStatsView } from './data.js';
import { onSearchInput, onFilterChange, selectKanaTab, selectLengthTab } from './filter.js';
import { initSidebarState, toggleSidebar, switchCollection, onCollectionSelectChange, updateSidebarBadge } from './components/sidebar.js';
import { renderCards } from './components/cards.js';
import { onPageSizeChange, goToPage } from './components/pagination.js';
import { openMeaningModal, closeDetailModal, closeDetailModalOnBackdrop, navigateToTerm, openCollectionModal, closeCollectionModal, closeCollectionModalOnBackdrop, openDescriptionModal, closeDescriptionModal, closeDescriptionModalOnBackdrop, handleMeaningTextClick } from './components/modal.js';
import { switchView, handleHashRoute } from './router.js';
import { getTodayOpeningHoursText, getNextOpeningTimeText, isGalleryOpen, loadOpeningHours, OPENING_HOURS_SCHEDULE } from './utils.js';

export function renderScheduleGrid() {
  const scheduleGrid = document.getElementById('schedule-grid');
  if (!scheduleGrid) return;
  const displayOrder = [1, 2, 3, 4, 5, 6, 0];
  scheduleGrid.innerHTML = displayOrder.map(idx => {
    const item = OPENING_HOURS_SCHEDULE[idx];
    return `<div class="awsui-schedule-row"><span>${item.day}</span><span>${item.hours}</span></div>`;
  }).join('');
}

// Expose functions globally for backward compatibility with inline HTML events
Object.assign(window, {
  collectionsConfig,
  currentCollectionId: store.get().currentCollectionId,
  isGalleryOpen,
  toggleSidebar,
  toggleTheme,
  switchView,
  switchCollection,
  onCollectionSelectChange,
  loadCollectionData: (colId) => loadCollectionData(colId, true),
  preloadAllCollections,
  updateStatsView,
  onSearchInput,
  onFilterChange,
  onPageSizeChange,
  selectKanaTab,
  selectLengthTab,
  openMeaningModal,
  closeDetailModal,
  closeDetailModalOnBackdrop,
  openCollectionModal,
  closeCollectionModal,
  closeCollectionModalOnBackdrop,
  openDescriptionModal,
  closeDescriptionModal,
  closeDescriptionModalOnBackdrop,
  handleMeaningTextClick,
  navigateToTerm,
  goToPage
});

// Sync state changes with window.currentCollectionId for legacy scripts if any
store.subscribe(state => {
  window.currentCollectionId = state.currentCollectionId;
});

// App Initializer
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSidebarState();

  await loadOpeningHours();
  renderScheduleGrid();

  const todayHoursEl = document.getElementById('today-hours-text');
  if (todayHoursEl) {
    todayHoursEl.textContent = getTodayOpeningHoursText();
  }

  const maintHoursEl = document.getElementById('maintenance-hours-text');
  if (maintHoursEl) {
    maintHoursEl.textContent = getNextOpeningTimeText();
  }

  Object.keys(collectionsConfig).forEach(updateSidebarBadge);

  preloadAllCollections();
  updateStatsView();
  handleHashRoute();

  window.addEventListener('hashchange', () => {
    handleHashRoute();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const descModal = document.getElementById('description-modal');
      if (descModal && descModal.classList.contains('open')) {
        closeDescriptionModal();
      } else {
        closeDetailModal();
        closeCollectionModal();
      }
    }
  });

  const recListElem = document.getElementById('modal-recommendations-list');
  if (recListElem) {
    recListElem.addEventListener('click', (e) => {
      const chip = e.target.closest('.awsui-recommendation-chip');
      if (chip) {
        const term = chip.getAttribute('data-term');
        if (term) {
          navigateToTerm(term);
        }
      }
    });
  }
});
