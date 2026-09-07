/**
 * Multi-Collection Configuration
 */
export const collectionsConfig = {
  'japanese-terms': {
    id: 'japanese-terms',
    name: '日本特色詞彙',
    sheetId: '1rFrRNHwuPwBr27EuCqOj8r1evXU-9qE_HJfDCzXyWwI',
    gid: '1857942500',
    localFallback: 'data.json',
    hasReading: true,
    searchPlaceholder: '尋找展品...',
    defaultMeta: {
      title: '日本特色詞彙',
      id: 'C101',
      status: '調整中',
      announcement: '每日於 1230-1330 進行展廳調整',
      tags: ['日本', '語彙'],
      subtitle: '本展區精選由漢字與數字組成的日語詞彙，帶你跨越中文字面的直覺迷思，一秒搞懂最真實的日語意思',
      description: '【同字不同義：日語漢字語彙展】\n\n看到「非常口」以為是非常時期用的出口？看到「手紙」以為是衛生紙？那些你以為看懂的日語漢字，背後含意往往出乎意料！本展區精選由漢字與數字組成的日語詞彙，帶你跨越中文字面的直覺迷思，一秒搞懂最真實的日語意思！',
      notice: '收錄標準\n- 僅收錄與台灣中文用詞存在差異的日文詞彙\n- 僅收錄完全由漢字/英文/數字構成、不含假名的詞彙'
    }
  },
  'china-terms': {
    id: 'china-terms',
    name: '大陸特色詞彙',
    sheetId: '16q_oTeadINeCErFrnokO4iiTS2BUwo2umT3wAHH53J8',
    gid: '826763333',
    localFallback: 'china-data.json',
    hasReading: false,
    searchPlaceholder: '尋找展品...',
    defaultMeta: {
      title: '大陸特色詞彙',
      id: 'C102',
      status: '開放中',
      announcement: '每日於 1230-1330 進行展廳調整',
      tags: ['大陸', '語彙'],
      subtitle: '本展區精選大陸當代的網路熱詞與生活用語，幫你精準對照台灣熟悉的在地說法。',
      description: '【同字不同義：兩岸詞彙對照】\n\n同樣是中文，意思居然差這麼多？本展區精選大陸當代的網路熱詞與生活用語，幫你精準對照台灣熟悉的在地說法。從社群梗到日常表達，帶你快速看懂兩岸語境差異，掌握最道地的流行語脈絡！',
      notice: '詞彙可能因地區或時間有所變化，僅供參考。'
    }
  },
  'korean-terms': {
    id: 'korean-terms',
    name: '最強韓文漢字學習法',
    sheetId: '',
    gid: '',
    localFallback: null,
    hasReading: false,
    searchPlaceholder: '尋找展品...',
    defaultMeta: {
      title: '最強韓文漢字學習法',
      id: 'C103',
      status: '籌備中',
      announcement: '籌備中',
      tags: ['韓語學習'],
      subtitle: '籌備中',
      description: '籌備中',
      notice: '籌備中'
    }
  }
};

/**
 * Shared Metadata Sheet Configuration (Central metadata spreadsheet for all exhibition halls)
 */
export const metadataConfig = {
  sheetId: '162GJh8BkmI7T66d3zJR5FbWoiM-oni2GJzTXVg30JUs',
  gid: '0'
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

/**
 * Returns metadata CSV and GViz URLs for a collection configuration object
 */
export function getCollectionMetaUrls(col) {
  return getMetadataUrls();
}
