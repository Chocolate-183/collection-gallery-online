/**
 * Multi-Collection Configuration
 */
export const collectionsConfig = {
  'japanese-terms': {
    id: 'japanese-terms',
    name: '日本特色詞彙',
    sheetId: '1rFrRNHwuPwBr27EuCqOj8r1evXU-9qE_HJfDCzXyWwI',
    gid: '1857942500',
    metaGid: '1001',
    localFallback: 'data.json',
    hasReading: true,
    searchPlaceholder: '尋找展品...',
    defaultMeta: {
      title: '日本特色詞彙',
      tags: ['日本文化', '流行新詞', '次文化用語'],
      subtitle: '收錄日本流行與次文化用語的數位展廳',
      description: '本展廳精心策展並收錄豐富的日本文化特色詞彙、生活慣用語、流行新詞與次文化用語。展區特別規劃 50 音快速索引，並提供完整的平假名標音對照，邀請您細細品味每個展品詞彙背後的文化意涵。',
      notice: '1. 收錄標準：\n   - 排除日文與台灣中文表達方式完全相同的詞彙。\n   - 排除含有純假名構成的詞彙。\n\n2. 觀展建議：本展區適合作為日文學習者的進階參考資料，協助深層理解道地的日本文化與用語細節。',
      author: '巧克力 (策展人)',
      status: '開放中'
    }
  },
  'china-terms': {
    id: 'china-terms',
    name: '大陸特色詞彙',
    sheetId: '16q_oTeadINeCErFrnokO4iiTS2BUwo2umT3wAHH53J8',
    gid: '826763333',
    metaGid: '1781155484',
    localFallback: 'china-data.json',
    hasReading: false,
    searchPlaceholder: '尋找展品...',
    defaultMeta: {
      title: '大陸特色詞彙',
      tags: ['大陸用語', '網路流行語', '兩岸差異'],
      subtitle: '兩岸用語對照特展',
      description: '特展匯集大陸網路流行用語與生活習慣詞彙，精準對照台灣慣用詞與語境背景，呈現兩岸語言文化的多元風貌。',
      notice: '收錄詞彙可能因地區或時間演變有所變化，僅供參觀研究參考。',
      author: '巧克力 (策展人)',
      status: '開放中'
    }
  }
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
    if (!sheetId || !gid) return null;
    return `${googleSheetsConfig.baseUrl}/${sheetId}/export?format=csv&gid=${gid}`;
  },

  /**
   * Constructs GViz JSON endpoint URL for a given sheet ID and gid
   */
  getGvizUrl: (sheetId, gid) => {
    if (!sheetId || !gid) return null;
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
 * Returns metadata CSV and GViz URLs for a collection configuration object
 */
export function getCollectionMetaUrls(col) {
  if (!col || !col.sheetId || !col.metaGid) return { csvUrl: null, gvizUrl: null };
  return {
    csvUrl: googleSheetsConfig.getCsvUrl(col.sheetId, col.metaGid),
    gvizUrl: googleSheetsConfig.getGvizUrl(col.sheetId, col.metaGid)
  };
}
