/**
 * Multi-Collection Configuration
 *
 * Each gallery is declared in its own file under js/galleries/.
 * Hall intro metadata lives in defaultMeta until the user
 * clicks header refresh (`#btn-refresh-data`); then the metadata sheet is fetched.
 */
import japaneseTerms from './galleries/japanese-terms.js';
import chinaTerms from './galleries/china-terms.js';
import koreanTerms from './galleries/korean-terms.js';
import japaneseAttack from './galleries/japanese-attack.js';

export const collectionsConfig = Object.fromEntries(
  [japaneseTerms, chinaTerms, koreanTerms, japaneseAttack].map(col => [col.id, col])
);

const SHEETS_BASE_URL = 'https://docs.google.com/spreadsheets/d';

export const googleSheetsConfig = {
  getCsvUrl: (sheetId, gid) => (sheetId && gid != null)
    ? `${SHEETS_BASE_URL}/${sheetId}/export?format=csv&gid=${gid}`
    : null,
  getGvizUrl: (sheetId, gid) => (sheetId && gid != null)
    ? `${SHEETS_BASE_URL}/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`
    : null
};

/** CSV + GViz endpoints (and optional local JSON fallback) for a `{ sheetId, gid, localFallback }` source. */
function buildSheetUrls({ sheetId, gid, localFallback = null }) {
  return {
    csvUrl: googleSheetsConfig.getCsvUrl(sheetId, gid),
    gvizUrl: googleSheetsConfig.getGvizUrl(sheetId, gid),
    localFallback
  };
}

/** Central hall metadata sheet (one column per hall). */
const metadataSource = {
  sheetId: '162GJh8BkmI7T66d3zJR5FbWoiM-oni2GJzTXVg30JUs',
  gid: '1360584899'
};

/** Curator profiles sheet (same workbook as hall metadata). */
const profilesSource = {
  sheetId: '162GJh8BkmI7T66d3zJR5FbWoiM-oni2GJzTXVg30JUs',
  gid: '1665955868',
  localFallback: 'profiles.json'
};

/** C103 verb/adjective conjugations (same workbook as the C103 hall; tab 動詞形容詞變化). */
const conjugationsSource = {
  sheetId: '1J3tN8QV24FYi0ti4OFhNDDHE9jWhFq2c2s8LUQwp1VM',
  gid: '467198079',
  localFallback: 'C103-conjugations.json'
};

export function getCollectionDataUrls(col) {
  if (!col?.sheetId || !col?.gid) return { csvUrl: null, gvizUrl: null, localFallback: col?.localFallback || null };
  return buildSheetUrls(col);
}

export const getMetadataUrls = () => buildSheetUrls(metadataSource);
export const getProfileUrls = () => buildSheetUrls(profilesSource);
export const getConjugationUrls = () => buildSheetUrls(conjugationsSource);
