/**
 * Data Fetching, Caching & Sync
 */
import { VIEWS } from './constants.js';
import { collectionsConfig, getCollectionDataUrls, getMetadataUrls, getProfileUrls, getConjugationUrls } from './config.js';
import { store } from './state.js';
import { parseCSVData, parseGvizResponse, parseAllCollectionsMetaCSVData, parseAllCollectionsMetaGvizResponse, parseProfilesCSVData, parseProfilesGvizResponse, parseConjugationCSVData, parseConjugationGvizResponse } from './parser.js';
import { applyFiltersAndSort } from './filter.js';
import { handleHashRoute } from './router.js';
import { showLoadingState } from './components/cards.js';
import { showNoticeUntil } from './components/notice.js';
import { updateSidebarBadge } from './components/sidebar.js';
import { safeFetchText, isCollectionAdjusting, isCollectionPreparing, isCollectionHidden, applyCollectionHeaderTitle, escapeHtml } from './utils.js';

export const collectionsCache = {};
export const collectionsMetaCache = {};
export const profilesCache = [];
const conjugationsByLemma = new Map();

/** Live metadata if loaded, else the hall's bundled defaultMeta. */
export function getCollectionMeta(colId) {
  return collectionsMetaCache[colId] || collectionsConfig[colId]?.defaultMeta || null;
}

const hasItems = value => Array.isArray(value) ? value.length > 0 : Boolean(value && Object.keys(value).length);

async function fetchJson(path) {
  const text = await safeFetchText(path);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn(`Failed to parse local JSON at ${path}:`, err);
    return null;
  }
}

const sizeOf = value => Array.isArray(value) ? value.length : Object.keys(value || {}).length;

/**
 * Shared sheet loader: live CSV → live GViz (only when `live`), then local JSON fallback.
 * Stops at the first result that passes `isUsable`; otherwise keeps the larger live
 * result, and only uses the local snapshot when both live sources came back empty.
 */
async function fetchSheet({ csvUrl, gvizUrl, localFallback }, { parseCsv, parseGviz, live = false, isUsable = hasItems }) {
  let best = null;
  const stages = live ? [[csvUrl, parseCsv], [gvizUrl, parseGviz]] : [];
  for (const [url, parse] of stages) {
    if (!url) continue;
    const text = await safeFetchText(url);
    const parsed = text ? parse(text) : null;
    if (isUsable(parsed)) return parsed;
    if (sizeOf(parsed) > sizeOf(best)) best = parsed;
  }
  if (best) return best;
  return localFallback ? await fetchJson(localFallback) : null;
}

function replaceArray(target, entries) {
  target.length = 0;
  if (Array.isArray(entries)) target.push(...entries);
  return target;
}

/** Replaces the C103 conjugation lookup table. */
export function replaceConjugationsCache(entries) {
  conjugationsByLemma.clear();
  (Array.isArray(entries) ? entries : []).forEach(entry => {
    const lemma = String(entry?.lemma || '').trim();
    if (lemma) conjugationsByLemma.set(lemma, entry);
  });
}

export function findConjugationByLemma(lemma) {
  const key = String(lemma || '').trim();
  return (key && conjugationsByLemma.get(key)) || null;
}

async function fetchConjugations({ live = false } = {}) {
  const entries = await fetchSheet(getConjugationUrls(), {
    parseCsv: parseConjugationCSVData,
    parseGviz: parseConjugationGvizResponse,
    live
  });
  replaceConjugationsCache(entries);
}

/** Looks up a curator profile by Chinese or English name. */
export function findProfileByName(name) {
  const key = String(name || '').trim();
  if (!key) return null;
  return profilesCache.find(p =>
    String(p.zhName || '').trim() === key || String(p.enName || '').trim() === key
  ) || null;
}

async function fetchProfiles({ live = false } = {}) {
  const profiles = await fetchSheet(getProfileUrls(), {
    parseCsv: parseProfilesCSVData,
    parseGviz: parseProfilesGvizResponse,
    live
  });
  replaceArray(profilesCache, profiles);
}

/** Fetches metadata for all halls from the central sheet (live) or uses each hall's defaultMeta. */
async function fetchAllMetadata({ live = false } = {}) {
  const { csvUrl, gvizUrl } = getMetadataUrls();
  const fetchedMetaMap = live
    ? (await fetchSheet({ csvUrl, gvizUrl }, {
      parseCsv: parseAllCollectionsMetaCSVData,
      parseGviz: parseAllCollectionsMetaGvizResponse,
      live
    })) || {}
    : {};

  // Halls that exist only in the metadata sheet get a placeholder config.
  for (const [colId, meta] of Object.entries(fetchedMetaMap)) {
    if (!collectionsConfig[colId]) {
      collectionsConfig[colId] = {
        id: colId,
        name: meta.title || colId,
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
    const meta = fetchedMetaMap[colId] || (col.defaultMeta ? { ...col.defaultMeta } : null);
    if (!meta) continue;
    collectionsMetaCache[colId] = meta;
    applyCollectionMetaToUI(colId, meta);
  }
}

/**
 * Preload every hall from local offline snapshots only.
 * Live Google Sheets sync happens when the user clicks the header refresh button.
 */
export async function preloadAllCollections() {
  await Promise.all([
    fetchAllMetadata(),
    fetchProfiles(),
    fetchConjugations()
  ]);
  await Promise.all(Object.values(collectionsConfig).map(col => fetchSingleCollection(col)));
}

function welcomeCardTagsHtml(meta) {
  const isAdjusting = isCollectionAdjusting(meta);
  const isPreparing = isCollectionPreparing(meta);
  const statusTag = isAdjusting
    ? '<span class="awsui-welcome-card-tag awsui-tag-adjusting">ADJUSTING</span>'
    : isPreparing
      ? '<span class="awsui-welcome-card-tag awsui-tag-preparing">COMING SOON</span>'
      : '';
  if (meta.tags?.length > 0) {
    return statusTag + meta.tags.map(tag => `<span class="awsui-welcome-card-tag">${escapeHtml(tag)}</span>`).join('');
  }
  if (meta.subtitle && !statusTag) {
    return `<span class="awsui-welcome-card-tag">${escapeHtml(meta.subtitle)}</span>`;
  }
  return statusTag;
}

/** Renders the Gallery header title for the active hall. */
export function renderCollectionHeader(colId) {
  if (typeof document === 'undefined') return;
  applyCollectionHeaderTitle(
    document.getElementById('collection-header-title'),
    colId,
    getCollectionMeta(colId),
    collectionsConfig[colId]
  );
}

/** Applies hall metadata to Lobby cards, sidebar, and (for the active hall) the Gallery header. */
function applyCollectionMetaToUI(colId, meta) {
  if (!meta || typeof document === 'undefined') return;

  const isHidden = isCollectionHidden(meta);
  const navBtn = document.getElementById(`nav-col-${colId}`);
  if (navBtn) navBtn.style.display = isHidden ? 'none' : '';
  const cardElem = document.getElementById(`welcome-card-${colId}`);
  if (cardElem) cardElem.style.display = isHidden ? 'none' : '';
  if (isHidden) return;

  const cardTitleElem = document.getElementById(`welcome-card-title-${colId}`);
  if (cardTitleElem && meta.title) cardTitleElem.innerText = meta.title;

  const cardTagsElem = document.getElementById(`welcome-card-tags-${colId}`);
  if (cardTagsElem) cardTagsElem.innerHTML = welcomeCardTagsHtml(meta);

  const cardDescElem = document.getElementById(`welcome-card-desc-${colId}`);
  if (cardDescElem && meta.description) cardDescElem.innerText = meta.description;

  const navTextElem = document.getElementById(`nav-text-${colId}`);
  if (navTextElem && meta.title) navTextElem.innerText = meta.title;

  const { currentCollectionId, currentView } = store.get();
  if (currentCollectionId === colId) {
    renderCollectionHeader(colId);
    if (currentView === VIEWS.DICTIONARY || currentView === VIEWS.MAINTENANCE) {
      handleHashRoute();
    }
  }

  updateSidebarBadge(colId);
  renderCollectionNotice();
}

/** Renders the active hall's notice in the muted footer at the bottom of the Gallery page. */
export function renderCollectionNotice() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('collection-notice-container');
  if (!container) return;

  const meta = getCollectionMeta(store.get().currentCollectionId);
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
    <div class="awsui-notice-footer-body">${escapeHtml(meta.notice).replace(/\n/g, '<br>')}</div>
  `;
}

/** Shows cached records for a hall, or fetches them (live when `forceRefresh`). */
export async function loadCollectionData(collectionId, forceRefresh = false) {
  const col = collectionsConfig[collectionId] || collectionsConfig['japanese-terms'];

  if (!forceRefresh && collectionsCache[col.id]?.length > 0) {
    store.set({ allRecords: collectionsCache[col.id], isLoading: false });
    processDataAndRender();
    return;
  }

  if (store.get().currentCollectionId === col.id) {
    store.set({ isLoading: true });
    showLoadingState();
  }

  await fetchSingleCollection(col, { live: forceRefresh });
}

/**
 * Pulls live Sheets data for the current hall. Only the header refresh button calls this.
 * Keeps the Notice Panel ("展廳同步中") open for at least 5 seconds.
 */
export async function refreshGalleryData(collectionId) {
  const sync = (async () => {
    await Promise.all([
      fetchAllMetadata({ live: true }),
      fetchProfiles({ live: true }),
      fetchConjugations({ live: true })
    ]);
    await loadCollectionData(collectionId, true);
  })();

  await showNoticeUntil(sync);
}

/**
 * Fetches records for a single hall.
 * `{ live: false }` (default) reads the offline JSON snapshot only;
 * `{ live: true }` tries Google Sheets first, then the snapshot.
 */
async function fetchSingleCollection(col, { live = false } = {}) {
  const urls = getCollectionDataUrls(col);
  const records = await fetchSheet({ ...urls, localFallback: col.localFallback || 'data.json' }, {
    parseCsv: text => parseCSVData(text, col.id),
    parseGviz: text => parseGvizResponse(text, col.id),
    // A short CSV result usually means the export was truncated; let GViz try too.
    isUsable: rows => Array.isArray(rows) && rows.length > 5,
    live
  });

  const isCurrent = store.get().currentCollectionId === col.id;
  if (records?.length > 0) {
    collectionsCache[col.id] = records;
    updateSidebarBadge(col.id);
    updateStatsView();
    if (isCurrent) {
      store.set({ allRecords: records, isLoading: false });
      processDataAndRender();
    }
  } else if (isCurrent) {
    store.set({ isLoading: false });
  }
}

function processDataAndRender() {
  const { currentCollectionId } = store.get();
  renderCollectionHeader(currentCollectionId);
  updateSidebarBadge(currentCollectionId);
  applyFiltersAndSort();
  renderCollectionNotice();
  updateStatsView();
  handleHashRoute();
}

/** Updates Stats page KPIs (Total Galleries & Total Items across visible halls). */
export function updateStatsView() {
  if (typeof document === 'undefined') return;

  const visibleColIds = Object.keys(collectionsConfig).filter(id => !isCollectionHidden(getCollectionMeta(id)));
  const totalItems = visibleColIds.reduce((sum, id) => sum + (collectionsCache[id]?.length || 0), 0);

  const totalHallsElem = document.getElementById('stats-total-halls');
  const totalItemsElem = document.getElementById('stats-total-items');
  if (totalHallsElem) totalHallsElem.innerText = visibleColIds.length;
  if (totalItemsElem) totalItemsElem.innerText = totalItems;
}
