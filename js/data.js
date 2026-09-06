/**
 * Data Fetching, Caching & Parallel Sync Handler
 */
import { collectionsConfig, getCollectionDataUrls, getCollectionMetaUrls } from './config.js';
import { store } from './state.js';
import { parseCSVData, parseGvizResponse, parseMetaCSVData, parseMetaGvizResponse } from './parser.js';
import { applyFiltersAndSort } from './filter.js';
import { handleHashRoute } from './router.js';
import { showLoadingState } from './components/cards.js';
import { updateSidebarBadge } from './components/sidebar.js';
import { safeFetchText } from './utils.js';

// Cache for storing fetched collection records & metadata
export const collectionsCache = {};
export const collectionsMetaCache = {};

/**
 * Preload and synchronize all collections and metadata in parallel at app initialization.
 */
export async function preloadAllCollections() {
  const colIds = Object.keys(collectionsConfig);
  await Promise.all(colIds.map(id => fetchSingleCollection(collectionsConfig[id])));
}

/**
 * Apply metadata to UI elements (welcome cards, header titles, tags, descriptions, about page).
 */
export function applyCollectionMetaToUI(colId, meta) {
  if (!meta) return;

  // 1. Update Welcome Card Title
  const cardTitleElem = document.getElementById(`welcome-card-title-${colId}`);
  if (cardTitleElem && meta.title) {
    cardTitleElem.innerText = meta.title;
  }

  // 2. Update Welcome Card Tags
  const cardTagsElem = document.getElementById(`welcome-card-tags-${colId}`);
  if (cardTagsElem) {
    const isAdjusting = meta.status === '調整中' || (typeof meta.status === 'string' && meta.status.includes('調整中'));
    if (isAdjusting) {
      let tagsHtml = `<span class="awsui-welcome-card-tag awsui-tag-adjusting">展廳調整中</span>`;
      if (meta.tags && meta.tags.length > 0) {
        tagsHtml += meta.tags.map(tag => `<span class="awsui-welcome-card-tag">${tag}</span>`).join('');
      }
      cardTagsElem.innerHTML = tagsHtml;
    } else if (meta.tags && meta.tags.length > 0) {
      cardTagsElem.innerHTML = meta.tags.map(tag => `<span class="awsui-welcome-card-tag">${tag}</span>`).join('');
    } else if (meta.subtitle) {
      cardTagsElem.innerHTML = `<span class="awsui-welcome-card-tag">${meta.subtitle}</span>`;
    }
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
    const headerTitle = document.getElementById('collection-header-title');
    if (headerTitle && meta.title) {
      headerTitle.innerText = meta.title;
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
  const container = document.getElementById('collection-notice-container');
  if (!container) return;

  const { currentCollectionId } = store.get();
  const col = collectionsConfig[currentCollectionId];
  const meta = collectionsMetaCache[currentCollectionId] || (col ? col.defaultMeta : null);

  if (!meta || !meta.notice) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="awsui-notice-footer-header">
      <svg class="awsui-icon" style="width:14px; height:14px; opacity:0.65;" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
      </svg>
      <span>注意事項</span>
    </div>
    <div class="awsui-notice-footer-body">${meta.notice.replace(/\n/g, '<br>')}</div>
  `;
}

/**
 * Fetch metadata sheet (gid) for a collection.
 */
export async function fetchCollectionMeta(col) {
  if (!col) return null;

  let meta = col.defaultMeta ? { ...col.defaultMeta } : null;

  if (col.metaGid && col.sheetId) {
    const { csvUrl, gvizUrl } = getCollectionMetaUrls(col);

    let fetchedMeta = null;

    if (csvUrl) {
      const csvText = await safeFetchText(csvUrl, 2500);
      if (csvText) {
        fetchedMeta = parseMetaCSVData(csvText);
      }
    }

    if ((!fetchedMeta || !fetchedMeta.title) && gvizUrl) {
      const gvizText = await safeFetchText(gvizUrl, 2500);
      if (gvizText) {
        fetchedMeta = parseMetaGvizResponse(gvizText);
      }
    }

    if (fetchedMeta && fetchedMeta.title) {
      meta = fetchedMeta;
    }
  }

  if (meta) {
    collectionsMetaCache[col.id] = meta;
    col.meta = meta;
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

  if (!forceRefresh && collectionsCache[col.id] && collectionsCache[col.id].length > 0) {
    store.set({ allRecords: collectionsCache[col.id], isLoading: false });
    processDataAndRender();
    return;
  }

  const { currentCollectionId } = store.get();
  if (currentCollectionId === col.id) {
    store.set({ isLoading: true });
    showLoadingState();
  }

  await fetchSingleCollection(col);
}

/**
 * Fetch live data and metadata for a single collection.
 */
export async function fetchSingleCollection(col) {
  if (!col) return [];

  // Fetch metadata concurrently
  fetchCollectionMeta(col);

  const sheetId = col.sheetId;
  const gid = col.gid;

  let fetchedData = null;

  if (col.mockData) {
    fetchedData = col.mockData;
  } else if (sheetId && gid) {
    const { csvUrl, gvizUrl } = getCollectionDataUrls(col);

    // Method 1: Try CSV export endpoint
    if (csvUrl) {
      const csvText = await safeFetchText(csvUrl, 2500);
      if (csvText) {
        fetchedData = parseCSVData(csvText);
      }
    }

    // Method 2: Try GViz endpoint as secondary fallback
    if ((!fetchedData || fetchedData.length <= 5) && gvizUrl) {
      const gvizText = await safeFetchText(gvizUrl, 2500);
      if (gvizText) {
        const gvizParsed = parseGvizResponse(gvizText, col.id);
        if (gvizParsed && gvizParsed.length > (fetchedData ? fetchedData.length : 0)) {
          fetchedData = gvizParsed;
        }
      }
    }

    // Method 3: Fallback to local dataset snapshot if offline or blocked
    if (!fetchedData || fetchedData.length === 0) {
      const fallbackPath = col.localFallback || 'data.json';
      const fallbackText = await safeFetchText(fallbackPath, 2500);
      if (fallbackText) {
        try {
          fetchedData = JSON.parse(fallbackText);
        } catch (err) {}
      }
    }
  }

  if (fetchedData && fetchedData.length > 0) {
    collectionsCache[col.id] = fetchedData;

    // Update sidebar badge for this collection
    updateSidebarBadge(col.id);

    // If this is currently active collection, update active view records
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
  const meta = collectionsMetaCache[currentCollectionId] || (col ? col.defaultMeta : null);

  const titleElem = document.getElementById('collection-header-title');
  if (titleElem) {
    titleElem.innerText = meta && meta.title ? meta.title : (col ? col.name : '');
  }

  const idHeaderElem = document.getElementById('collection-header-id');
  if (idHeaderElem) {
    idHeaderElem.innerText = meta && meta.id ? meta.id : '';
  }

  const subtitleElem = document.getElementById('collection-header-subtitle');
  if (subtitleElem) {
    subtitleElem.innerText = meta && meta.subtitle ? meta.subtitle : '';
  }

  const totalElem = document.getElementById('kpi-total-count');
  if (totalElem) {
    totalElem.innerHTML = `${allRecords.length.toLocaleString()} <span class="awsui-kpi-unit">件</span>`;
  }

  updateSidebarBadge(currentCollectionId);

  applyFiltersAndSort();
  renderCollectionNotice();
  handleHashRoute();
}
