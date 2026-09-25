/**
 * Data Fetching, Caching & Parallel Sync Handler
 */
import { DEFAULT_TIMEOUT_MS } from './constants.js';
import { collectionsConfig, getCollectionDataUrls, getMetadataUrls, getProfileUrls } from './config.js';
import { store } from './state.js';
import { parseCSVData, parseGvizResponse, parseAllCollectionsMetaCSVData, parseAllCollectionsMetaGvizResponse, parseCSVRows, extractGvizTable, gvizTableToRows, extractOpeningHoursFromMetaRows, parseProfilesCSVData, parseProfilesGvizResponse } from './parser.js';
import { applyFiltersAndSort } from './filter.js';
import { handleHashRoute } from './router.js';
import { showLoadingState } from './components/cards.js';
import { showNoticeUntil, NOTICE_SYNC_MESSAGE, NOTICE_MIN_VISIBLE_MS } from './components/notice.js';
import { updateSidebarBadge } from './components/sidebar.js';
import { safeFetchText, setOpeningHoursSchedule, isCollectionAdjusting, isCollectionPreparing, isCollectionHidden, getCollectionEnTitle } from './utils.js';

// Cache for storing fetched collection records & metadata
export const collectionsCache = {};
export const collectionsMetaCache = {};
export const profilesCache = [];

function normalizeProfileName(name) {
  return String(name || '').trim();
}

/**
 * Looks up a curator profile by Chinese or English name.
 */
export function findProfileByName(name) {
  const key = normalizeProfileName(name);
  if (!key) return null;
  return profilesCache.find(p =>
    normalizeProfileName(p.zhName) === key || normalizeProfileName(p.enName) === key
  ) || null;
}

/**
 * Fetches curator profiles.
 * Live Sheets (CSV → GViz) only when `{ live: true }`; otherwise local JSON.
 */
export async function fetchProfiles({ live = false } = {}) {
  const { csvUrl, gvizUrl, localFallback } = getProfileUrls();
  let profiles = [];

  if (live && csvUrl) {
    const csvText = await safeFetchText(csvUrl, DEFAULT_TIMEOUT_MS);
    if (csvText) {
      profiles = parseProfilesCSVData(csvText);
    }
  }

  if (live && (!profiles || profiles.length === 0) && gvizUrl) {
    const gvizText = await safeFetchText(gvizUrl, DEFAULT_TIMEOUT_MS);
    if (gvizText) {
      profiles = parseProfilesGvizResponse(gvizText);
    }
  }

  if ((!profiles || profiles.length === 0) && localFallback) {
    const fallbackText = await safeFetchText(localFallback, DEFAULT_TIMEOUT_MS);
    if (fallbackText) {
      try {
        const parsed = JSON.parse(fallbackText);
        if (Array.isArray(parsed)) profiles = parsed;
      } catch (err) {
        console.warn('Failed to parse local profiles fallback JSON:', err);
      }
    }
  }

  profilesCache.length = 0;
  if (Array.isArray(profiles) && profiles.length > 0) {
    profilesCache.push(...profiles);
  }
  return profilesCache;
}

/**
 * Fetches metadata for all exhibition halls from the central metadata spreadsheet.
 */
function applyOpeningHoursFromMetaSource(csvText, gvizText) {
  let schedule = csvText ? extractOpeningHoursFromMetaRows(parseCSVRows(csvText)) : null;
  if (!schedule && gvizText) {
    schedule = extractOpeningHoursFromMetaRows(gvizTableToRows(extractGvizTable(gvizText)));
  }
  if (schedule) setOpeningHoursSchedule(schedule, { fromMetadata: true });
  return schedule;
}

export async function fetchAllMetadata({ live = false } = {}) {
  const { csvUrl, gvizUrl } = getMetadataUrls();
  let fetchedMetaMap = {};
  let csvText = null;
  let gvizText = null;

  if (live && csvUrl) {
    csvText = await safeFetchText(csvUrl, DEFAULT_TIMEOUT_MS);
    if (csvText) {
      fetchedMetaMap = parseAllCollectionsMetaCSVData(csvText);
    }
  }

  if (live && (!fetchedMetaMap || Object.keys(fetchedMetaMap).length === 0) && gvizUrl) {
    gvizText = await safeFetchText(gvizUrl, DEFAULT_TIMEOUT_MS);
    if (gvizText) {
      fetchedMetaMap = parseAllCollectionsMetaGvizResponse(gvizText);
    }
  }

  if (live) applyOpeningHoursFromMetaSource(csvText, gvizText);

  for (const [fetchedColId, meta] of Object.entries(fetchedMetaMap)) {
    if (!collectionsConfig[fetchedColId]) {
      collectionsConfig[fetchedColId] = {
        id: fetchedColId,
        name: meta.title || fetchedColId,
        sheetId: '',
        gid: '',
        localFallback: null,
        hasReading: false,
        searchPlaceholder: '尋找展品...',
        defaultMeta: meta
      };
    }
  }

  for (const [colId, col] of Object.entries(collectionsConfig)) {
    const fetchedMeta = fetchedMetaMap[colId];
    const meta = fetchedMeta || (col.defaultMeta ? { ...col.defaultMeta } : null);
    if (meta) {
      collectionsMetaCache[colId] = meta;
      col.meta = meta;
      applyCollectionMetaToUI(colId, meta);
    }
  }

  return collectionsMetaCache;
}

/**
 * Preload collections from local offline snapshots only.
 * Live Google Sheets sync happens when the user clicks the header refresh button.
 */
export async function preloadAllCollections() {
  await Promise.all([fetchAllMetadata({ live: false }), fetchProfiles({ live: false })]);
  const colIds = Object.keys(collectionsConfig);
  await Promise.all(colIds.map(id => fetchSingleCollection(collectionsConfig[id], { live: false })));
}

/**
 * Apply metadata to UI elements (welcome cards, header titles, tags, descriptions, about page).
 */
export function applyCollectionMetaToUI(colId, meta) {
  if (!meta || typeof document === 'undefined') return;

  const isHidden = isCollectionHidden(meta);

  // Toggle Sidebar Link Visibility
  const navBtn = document.getElementById(`nav-col-${colId}`);
  if (navBtn) {
    navBtn.style.display = isHidden ? 'none' : '';
  }

  // Toggle Welcome Card Visibility
  const cardElem = document.getElementById(`welcome-card-${colId}`) ||
                   document.getElementById(`welcome-card-title-${colId}`)?.closest('.awsui-welcome-card');
  if (cardElem) {
    cardElem.style.display = isHidden ? 'none' : '';
  }

  if (isHidden) return;

  // 1. Update Welcome Card Title
  const cardTitleElem = document.getElementById(`welcome-card-title-${colId}`);
  if (cardTitleElem && meta.title) {
    cardTitleElem.innerText = meta.title;
  }

  // 2. Update Welcome Card Tags
  const cardTagsElem = document.getElementById(`welcome-card-tags-${colId}`);
  if (cardTagsElem) {
    const isAdjusting = isCollectionAdjusting(meta);
    const isPreparing = isCollectionPreparing(meta);
    let tagsHtml = '';
    if (isAdjusting) {
      tagsHtml += `<span class="awsui-welcome-card-tag awsui-tag-adjusting">ADJUSTING</span>`;
    } else if (isPreparing) {
      tagsHtml += `<span class="awsui-welcome-card-tag awsui-tag-preparing">COMING SOON</span>`;
    }
    if (meta.tags?.length > 0) {
      tagsHtml += meta.tags.map(tag => `<span class="awsui-welcome-card-tag">${tag}</span>`).join('');
    } else if (meta.subtitle && !isAdjusting && !isPreparing) {
      tagsHtml = `<span class="awsui-welcome-card-tag">${meta.subtitle}</span>`;
    }
    cardTagsElem.innerHTML = tagsHtml;
  }

  // 3. Update Welcome Card Description
  const cardDescElem = document.getElementById(`welcome-card-desc-${colId}`);
  if (cardDescElem && meta.description) {
    cardDescElem.innerText = meta.description;
  }

  // 4. Update Sidebar Link Text
  const navTextElem = document.getElementById(`nav-text-${colId}`);
  if (navTextElem && meta.title) {
    navTextElem.innerText = meta.title;
  }

  // 5. Update Active Collection Header in Dictionary View
  const { currentCollectionId, currentView } = store.get();
  if (currentCollectionId === colId) {
    const col = collectionsConfig[colId];
    const headerTitle = document.getElementById('collection-header-title');
    if (headerTitle) {
      headerTitle.innerText = getCollectionEnTitle(colId, meta, col);
    }

    const headerCnTitle = document.getElementById('collection-header-cn-title');
    if (headerCnTitle && meta.title) {
      headerCnTitle.innerText = meta.title;
    }

    const headerId = document.getElementById('collection-header-id');
    if (headerId && meta.id) {
      headerId.innerText = meta.id;
    }

    const headerSubtitle = document.getElementById('collection-header-subtitle');
    if (headerSubtitle && meta.subtitle) {
      headerSubtitle.innerText = meta.subtitle;
    }

    if (currentView === 'dictionary' || currentView === 'maintenance') {
      handleHashRoute();
    }
  }

  // 6. Update Collection Notice Section & Sidebar Badge
  updateSidebarBadge(colId);
  renderCollectionNotice();
}

/**
 * Render collection notice / disclaimer in supplementary muted style at the bottom of collection page
 */
export function renderCollectionNotice() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('collection-notice-container');
  if (!container) return;

  const { currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId];
  const meta = collectionsMetaCache[currentCollectionId] || col?.defaultMeta;

  if (!meta?.notice) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="awsui-notice-footer-header">
      <span>Notice</span>
    </div>
    <div class="awsui-notice-footer-body">${meta.notice.replace(/\n/g, '<br>')}</div>
  `;
}

/**
 * Fetch metadata sheet for a collection or apply offline defaultMeta.
 */
export async function fetchCollectionMeta(col, { live = false } = {}) {
  if (!col) return null;

  if (live) {
    await fetchAllMetadata({ live: true });
  }

  const meta = collectionsMetaCache[col.id] || (col.defaultMeta ? { ...col.defaultMeta } : null);
  if (meta) {
    applyCollectionMetaToUI(col.id, meta);
  }

  return meta;
}

/**
 * Load collection data for a specific collection ID.
 */
export async function loadCollectionData(collectionId, forceRefresh = false) {
  const col = collectionsConfig[collectionId] || collectionsConfig['japanese-terms'];
  if (!col) return;

  if (!forceRefresh && collectionsCache[col.id]?.length > 0) {
    store.set({ allRecords: collectionsCache[col.id], isLoading: false });
    processDataAndRender();
    return;
  }

  const { currentCollectionId } = store.get();
  if (currentCollectionId === col.id) {
    store.set({ isLoading: true });
    showLoadingState();
  }

  await fetchSingleCollection(col, { live: forceRefresh });
}

/**
 * Fetch live Sheets data for the current hall. Only the header refresh button should call this.
 * Shows Notice Panel ("展廳同步中") for at least 2 seconds, even if the fetch finishes sooner.
 */
export async function refreshGalleryData(collectionId) {
  const sync = (async () => {
    await Promise.all([
      fetchAllMetadata({ live: true }),
      fetchProfiles({ live: true })
    ]);
    await loadCollectionData(collectionId, true);
  })();

  await showNoticeUntil(sync, {
    message: NOTICE_SYNC_MESSAGE,
    minVisibleMs: NOTICE_MIN_VISIBLE_MS
  });
}

async function loadLocalCollectionSnapshot(col) {
  const fallbackPath = col?.localFallback || 'data.json';
  const fallbackText = await safeFetchText(fallbackPath, DEFAULT_TIMEOUT_MS);
  if (!fallbackText) return null;
  try {
    return JSON.parse(fallbackText);
  } catch (err) {
    console.warn(`Failed to parse local fallback JSON at ${fallbackPath}:`, err);
    return null;
  }
}

/**
 * Fetch data for a single collection.
 * `{ live: false }` (default) uses the offline JSON snapshot only.
 * `{ live: true }` hits Google Sheets, then falls back to the local snapshot.
 */
export async function fetchSingleCollection(col, { live = false } = {}) {
  if (!col) return [];

  await fetchCollectionMeta(col, { live });

  const sheetId = col.sheetId;
  const gid = col.gid;

  let fetchedData = null;

  if (col.mockData) {
    fetchedData = col.mockData;
  } else if (live && sheetId && gid) {
    const { csvUrl, gvizUrl } = getCollectionDataUrls(col);

    // Method 1: Try CSV export endpoint
    if (csvUrl) {
      const csvText = await safeFetchText(csvUrl, DEFAULT_TIMEOUT_MS);
      if (csvText) {
        fetchedData = parseCSVData(csvText, col.id);
      }
    }

    // Method 2: Try GViz endpoint as secondary fallback
    if ((!fetchedData || fetchedData.length <= 5) && gvizUrl) {
      const gvizText = await safeFetchText(gvizUrl, DEFAULT_TIMEOUT_MS);
      if (gvizText) {
        const gvizParsed = parseGvizResponse(gvizText, col.id);
        if (gvizParsed && gvizParsed.length > (fetchedData ? fetchedData.length : 0)) {
          fetchedData = gvizParsed;
        }
      }
    }
  }

  if (!fetchedData || fetchedData.length === 0) {
    fetchedData = await loadLocalCollectionSnapshot(col);
  }

  if (fetchedData?.length > 0) {
    collectionsCache[col.id] = fetchedData;
    updateSidebarBadge(col.id);
    updateStatsView();

    const { currentCollectionId } = store.get();
    if (currentCollectionId === col.id) {
      store.set({ allRecords: fetchedData, isLoading: false });
      processDataAndRender();
    }
  } else if (store.get().currentCollectionId === col.id) {
    store.set({ isLoading: false });
  }

  return fetchedData || [];
}

export function processDataAndRender() {
  const { allRecords, currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId];
  const meta = collectionsMetaCache[currentCollectionId] || col?.defaultMeta;

  const titleElem = document.getElementById('collection-header-title');
  if (titleElem) titleElem.innerText = getCollectionEnTitle(currentCollectionId, meta, col);

  const cnTitleElem = document.getElementById('collection-header-cn-title');
  if (cnTitleElem) cnTitleElem.innerText = meta?.title || col?.name || '';

  const idHeaderElem = document.getElementById('collection-header-id');
  if (idHeaderElem) idHeaderElem.innerText = meta?.id || '';

  const subtitleElem = document.getElementById('collection-header-subtitle');
  if (subtitleElem) subtitleElem.innerText = meta?.subtitle || '';

  const totalElem = document.getElementById('kpi-total-count');
  if (totalElem) totalElem.innerText = allRecords.length;

  updateSidebarBadge(currentCollectionId);
  applyFiltersAndSort();
  renderCollectionNotice();
  updateStatsView();
  handleHashRoute();
}

/**
 * Updates KPI values on the Statistics page (Total Exhibition Halls & Total Exhibition Items).
 */
export function updateStatsView() {
  if (typeof document === 'undefined') return;

  const totalHallsElem = document.getElementById('stats-total-halls');
  const totalItemsElem = document.getElementById('stats-total-items');

  const visibleColIds = Object.keys(collectionsConfig).filter(id => {
    const col = collectionsConfig[id];
    const meta = collectionsMetaCache[id] || col?.defaultMeta;
    return !isCollectionHidden(meta);
  });

  const totalHalls = visibleColIds.length;
  let totalItems = 0;
  visibleColIds.forEach(id => {
    if (Array.isArray(collectionsCache[id])) {
      totalItems += collectionsCache[id].length;
    }
  });

  if (totalHallsElem) totalHallsElem.innerText = totalHalls;
  if (totalItemsElem) totalItemsElem.innerText = totalItems;
}
