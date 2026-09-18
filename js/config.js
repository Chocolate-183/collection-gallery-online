/**
 * Multi-Collection Configuration
 *
 * Each gallery is declared in its own file under js/galleries/.
 * Hall intro metadata and opening hours are always loaded from the
 * central spreadsheet (metadataConfig) — defaultMeta is offline failover only.
 */
import japaneseTerms from './galleries/japanese-terms.js';
import chinaTerms from './galleries/china-terms.js';
import koreanTerms from './galleries/korean-terms.js';

const galleryConfigs = [japaneseTerms, chinaTerms, koreanTerms];

export const collectionsConfig = Object.fromEntries(
  galleryConfigs.map(col => [col.id, col])
);

/**
 * Shared Metadata Sheet Configuration (intro + opening hours for all halls)
 * https://docs.google.com/spreadsheets/d/162GJh8BkmI7T66d3zJR5FbWoiM-oni2GJzTXVg30JUs
 */
const metadataConfig = {
  sheetId: '162GJh8BkmI7T66d3zJR5FbWoiM-oni2GJzTXVg30JUs',
  gid: '1574352890'
};

/**
 * Google Sheets Base URL Configuration & Endpoint URL Builders
 */
export const googleSheetsConfig = {
  baseUrl: 'https://docs.google.com/spreadsheets/d',

  /**
   * Constructs CSV export URL for a given sheet ID and gid
   */
  getCsvUrl: (sheetId, gid) => {
    if (!sheetId || gid === undefined || gid === null) return null;
    return `${googleSheetsConfig.baseUrl}/${sheetId}/export?format=csv&gid=${gid}`;
  },

  /**
   * Constructs GViz JSON endpoint URL for a given sheet ID and gid
   */
  getGvizUrl: (sheetId, gid) => {
    if (!sheetId || gid === undefined || gid === null) return null;
    return `${googleSheetsConfig.baseUrl}/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
  }
};

/**
 * Returns dataset CSV and GViz URLs for a collection configuration object
 */
export function getCollectionDataUrls(col) {
  if (!col || !col.sheetId || !col.gid) return { csvUrl: null, gvizUrl: null };
  return {
    csvUrl: googleSheetsConfig.getCsvUrl(col.sheetId, col.gid),
    gvizUrl: googleSheetsConfig.getGvizUrl(col.sheetId, col.gid)
  };
}

/**
 * Returns CSV and GViz URLs for the central metadata spreadsheet
 */
export function getMetadataUrls() {
  if (!metadataConfig.sheetId) return { csvUrl: null, gvizUrl: null };
  return {
    csvUrl: googleSheetsConfig.getCsvUrl(metadataConfig.sheetId, metadataConfig.gid || '0'),
    gvizUrl: googleSheetsConfig.getGvizUrl(metadataConfig.sheetId, metadataConfig.gid || '0')
  };
}
