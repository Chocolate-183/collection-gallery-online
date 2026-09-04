/**
 * Data Fetching, Caching & Parallel Sync Handler
 */
import { collectionsConfig } from './config.js';
import { store } from './state.js';
import { parseCSVData, parseGvizResponse, parseMetaCSVData, parseMetaGvizResponse } from './parser.js';
import { applyFiltersAndSort } from './filter.js';
import { handleHashRoute } from './router.js';
import { showLoadingState, renderCards } from './components/cards.js';

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
    if (meta.tags && meta.tags.length > 0) {
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
  const { currentCollectionId } = store.get();
  if (currentCollectionId === colId) {
    const headerTitle = document.getElementById('collection-header-title');
    if (headerTitle && meta.title) {
      headerTitle.innerText = meta.title;
    }

    const headerSubtitle = document.getElementById('collection-header-subtitle');
    if (headerSubtitle && meta.subtitle) {
      headerSubtitle.innerText = meta.subtitle;
    }
  }

  // 6. Update Collection Notice Section
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
      <span>收錄說明與注意事項</span>
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
    const csvUrl = `https://docs.google.com/spreadsheets/d/${col.sheetId}/export?format=csv&gid=${col.metaGid}`;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${col.sheetId}/gviz/tq?tqx=out:json&gid=${col.metaGid}`;

    let fetchedMeta = null;

    try {
      const response = await fetch(csvUrl, { signal: AbortSignal.timeout(2500) });
      if (response.ok) {
        const text = await response.text();
        fetchedMeta = parseMetaCSVData(text);
      }
    } catch (err) {}

    if (!fetchedMeta || !fetchedMeta.title) {
      try {
        const response = await fetch(gvizUrl, { signal: AbortSignal.timeout(2500) });
        if (response.ok) {
          const text = await response.text();
          fetchedMeta = parseMetaGvizResponse(text);
        }
      } catch (err) {}
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
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;

    // Method 1: Try CSV export endpoint
    try {
      const response = await fetch(csvUrl, { signal: AbortSignal.timeout(2500) });
      if (response.ok) {
        const csvText = await response.text();
        fetchedData = parseCSVData(csvText);
      }
    } catch (err) {}

    // Method 2: Try GViz endpoint as secondary fallback
    if (!fetchedData || fetchedData.length <= 5) {
      try {
        const response = await fetch(gvizUrl, { signal: AbortSignal.timeout(2500) });
        if (response.ok) {
          const text = await response.text();
          const gvizParsed = parseGvizResponse(text, col.id);
          if (gvizParsed && gvizParsed.length > (fetchedData ? fetchedData.length : 0)) {
            fetchedData = gvizParsed;
          }
        }
      } catch (err) {}
    }

    // Method 3: Fallback to local dataset snapshot if offline or blocked
    if (!fetchedData || fetchedData.length === 0) {
      try {
        const fallbackPath = col.localFallback || 'data.json';
        const response = await fetch(fallbackPath, { signal: AbortSignal.timeout(2500) });
        if (response.ok) {
          fetchedData = await response.json();
        }
      } catch (err) {}
    }
  }

  if (fetchedData && fetchedData.length > 0) {
    collectionsCache[col.id] = fetchedData;

    // Update sidebar badge for this collection
    const badgeElem = document.getElementById(`side-nav-count-${col.id}`);
    if (badgeElem) {
      badgeElem.innerText = `${fetchedData.length}`;
    }

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

  const subtitleElem = document.getElementById('collection-header-subtitle');
  if (subtitleElem) {
    subtitleElem.innerText = meta && meta.subtitle ? meta.subtitle : '';
  }

  const totalElem = document.getElementById('kpi-total-count');
  if (totalElem) {
    totalElem.innerHTML = `${allRecords.length.toLocaleString()} <span class="awsui-kpi-unit">筆</span>`;
  }

  const badgeElem = document.getElementById(`side-nav-count-${currentCollectionId}`);
  if (badgeElem) {
    badgeElem.innerText = `${allRecords.length}`;
  }

  applyFiltersAndSort();
  renderCollectionNotice();
  handleHashRoute();
}
