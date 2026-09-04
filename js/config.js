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
    searchPlaceholder: '搜尋標題用詞、標音或詳細說明...',
    defaultMeta: {
      title: '日本特色詞彙',
      tags: ['日本文化', '流行新詞', '次文化用語'],
      subtitle: '探索日本流行與次文化用語的專屬辭典',
      description: '本表收錄了豐富的日本文化特色詞彙、生活慣用語、流行新詞與次文化用語。為了方便使用者查詢，特別支援了 50 音快捷按鈕索引，並提供完整的平假名標音對照，讓您能輕鬆掌握每個詞彙的發音與含義。',
      notice: '1. 收錄標準：\n   - 排除日文與台灣中文表達方式完全相同的詞彙。\n   - 排除含有純假名構成的詞彙。\n\n2. 使用建議：本表適合作為日文學習者的進階參考資料，幫助理解更道地的日本文化與用語。',
      author: '巧克力'
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
    searchPlaceholder: '搜尋特色用詞或詳細說明...',
    defaultMeta: {
      title: '大陸特色詞彙',
      tags: ['大陸用語', '網路流行語', '兩岸差異'],
      subtitle: '兩岸用語對照',
      description: '匯集大陸網路流行用語、生活習慣詞彙，精準對照台灣慣用詞與語境背景，輕鬆掌握兩岸語言文化差異。',
      notice: '詞彙可能因地區或時間有所變化，僅供參考。',
      author: '巧克力'
    }
  }
};
