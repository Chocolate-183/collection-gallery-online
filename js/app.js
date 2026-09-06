/**
 * Main Application Entry Point
 */
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { initTheme, toggleTheme, applyTheme } from './theme.js';
import { loadCollectionData, preloadAllCollections } from './data.js';
import { onSearchInput, onFilterChange, selectKanaTab, selectLengthTab } from './filter.js';
import { initSidebarState, toggleSidebar, switchCollection, onCollectionSelectChange, updateSidebarBadge, updateSidebarId } from './components/sidebar.js';
import { renderCards } from './components/cards.js';
import { onPageSizeChange, goToPage } from './components/pagination.js';
import { openMeaningModal, closeDetailModal, closeDetailModalOnBackdrop } from './components/modal.js';
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
window.collectionsConfig = collectionsConfig;
window.currentCollectionId = store.get().currentCollectionId;
window.isGalleryOpen = isGalleryOpen;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.switchView = switchView;
window.switchCollection = switchCollection;
window.onCollectionSelectChange = onCollectionSelectChange;
window.loadCollectionData = (colId) => loadCollectionData(colId, true);
window.preloadAllCollections = preloadAllCollections;
window.onSearchInput = onSearchInput;
window.onFilterChange = onFilterChange;
window.onPageSizeChange = onPageSizeChange;
window.selectKanaTab = selectKanaTab;
window.selectLengthTab = selectLengthTab;
window.openMeaningModal = openMeaningModal;
window.closeDetailModal = closeDetailModal;
window.closeDetailModalOnBackdrop = closeDetailModalOnBackdrop;
window.goToPage = goToPage;

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

  Object.keys(collectionsConfig).forEach(id => {
    updateSidebarBadge(id);
    updateSidebarId(id);
  });

  preloadAllCollections();
  handleHashRoute();

  window.addEventListener('hashchange', () => {
    handleHashRoute();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailModal();
    }
  });
});
