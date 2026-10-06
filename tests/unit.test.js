import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCSVData,
  parseGvizResponse,
  parseMetaCSVData,
  parseAllCollectionsMetaCSVData,
  parseCSVRows,
  extractGvizTable,
  parseProfilesCSVData,
  parseProfilesGvizResponse,
  formatProfileId
} from '../js/parser.js';
import {
  matchesKanaGroup,
  matchesHangulInitial,
  getHangulInitialTab,
  filterByQuery,
  filterByLength,
  filterByKana,
  filterByInitial,
  filterByLoanword,
  filterByEtymology,
  filterByPos,
  filterByBasic100,
  filterByCategory,
  sortRecords,
  getFilterSummary
} from '../js/filter.js';
import {
  LENGTH_TABS,
  KANA_TABS,
  QUICK_FILTERS,
  SORT_FIELDS,
  SORT_ORDERS,
  ETYMOLOGY_TABS,
  POS_TABS,
  POS_PRIMARY_TABS,
  POS_EXTRA_TABS,
  CATEGORY_TABS
} from '../js/constants.js';
import {
  escapeHtml,
  getExhibitFilterLength,
  formatExhibitTitleHtml,
  getExhibitHangulHeadword,
  getStdictSearchUrl,
  formatStdictReferenceHtml,
  isEnglishLoanword,
  isCollectionAdjusting,
  isCollectionPreparing,
  isCollectionHidden,
  getCollectionHeaderTitle,
  getCollectionHeaderTitleParts,
  applyCollectionHeaderTitle,
  getExhibitCategoryLabel
} from '../js/utils.js';
import { googleSheetsConfig, getCollectionDataUrls, getMetadataUrls, getProfileUrls, collectionsConfig } from '../js/config.js';

test('CSV and GViz parsers handle quotes, newlines, and table extraction', () => {
  const sampleCSV = `ID,日語用詞,台灣意思,假名標音,建立日期,推薦條目
1,"お疲れ様","辛苦了
多行測試","おつかれさま","2024-01-01","211<br>一本"
2,"""Quotes"" Term","包含""雙引號""","クォート","2024-01-02","牛马\\n大厂"`;

  const parsed = parseCSVData(sampleCSV);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].ja_term, 'お疲れ様');
  assert.equal(parsed[0].tw_translation, '辛苦了\n多行測試');
  assert.deepEqual(parsed[0].recommendations, ['211', '一本']);
  assert.equal(parsed[1].ja_term, '"Quotes" Term');

  const rows = parseCSVRows('a,b,c\n1,"2\n3",4');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], ['1', '2\n3', '4']);

  const sampleGviz = `google.visualization.Query.setResponse({"status":"ok","table":{"cols":[{"label":"id"}],"rows":[{"c":[{"v":"1"}]}]}});`;
  const table = extractGvizTable(sampleGviz);
  assert.equal(table.rows.length, 1);
  assert.equal(extractGvizTable('invalid input'), null);
});

test('Metadata parsers map hall matrix status and ids', () => {
  const meta = parseMetaCSVData(`項目,內容
標題,日本特色詞彙
ID,C101
狀態,調整中
標籤,"日本文化
流行新詞"`);
  assert.equal(meta.title, '日本特色詞彙');
  assert.equal(meta.id, 'C101');
  assert.equal(meta.status, '調整中');
  assert.deepEqual(meta.tags, ['日本文化', '流行新詞']);

  const parsedMap = parseAllCollectionsMetaCSVData(`展廳名,日本特色詞彙,簡中語境破解攻略,韓語單字速成攻略
展廳ID,C101,C102,C103
展廳狀態,調整中,開放中,籌備中`);
  assert.equal(parsedMap['japanese-terms'].status, '調整中');
  assert.equal(parsedMap['china-terms'].status, '開放中');
  assert.equal(parsedMap['korean-terms'].status, '籌備中');
});

test('Utils escape HTML and count C103 exhibit titles before the pipe', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(getExhibitFilterLength('가능 | 可能'), 2);
  assert.equal(getExhibitFilterLength('강하다 | 強하다'), 3);
  assert.equal(formatExhibitTitleHtml('가능 | 可能'), '가능 <span class="awsui-title-separator">|</span><span class="awsui-title-suffix"> 可能</span>');
  assert.equal(isEnglishLoanword({ ja_term: '컴퓨터 | computer' }), true);
  assert.equal(isEnglishLoanword({ ja_term: '가능 | 可能' }), false);
  assert.equal(getExhibitHangulHeadword('가게'), '가게');
  assert.equal(getExhibitHangulHeadword('가능 | 可能'), '가능');
  assert.equal(
    getStdictSearchUrl('가게'),
    'https://stdict.korean.go.kr/search/searchResult.do?pageSize=10&searchKeyword=%EA%B0%80%EA%B2%8C'
  );
  const refHtml = formatStdictReferenceHtml('가게');
  assert.match(refHtml, />國立國語院標準國語大辭典</);
  assert.equal(refHtml.includes('|'), false);
  assert.equal(refHtml.includes('가게'), false);
  assert.match(refHtml, /searchKeyword=%EA%B0%80%EA%B2%8C/);
  assert.equal(formatStdictReferenceHtml('가능 | 可能').includes('가능'), false);
  assert.equal(formatStdictReferenceHtml('가능 | 可能').includes('可能'), false);
});

test('Gallery header title is Collection number plus Chinese hall name', () => {
  assert.deepEqual(
    getCollectionHeaderTitleParts('korean-terms', { id: 'C103', title: '韓語單字量最強速成攻略' }),
    { hall: 'Collection 103', name: '韓語單字量最強速成攻略' }
  );
  assert.equal(
    getCollectionHeaderTitle('korean-terms', { id: 'C103', title: '韓語單字量最強速成攻略' }),
    'Collection 103 韓語單字量最強速成攻略'
  );
  assert.deepEqual(
    getCollectionHeaderTitleParts('china-terms', { id: 'C102', title: '簡中語境破解攻略' }),
    { hall: 'Collection 102', name: '簡中語境破解攻略' }
  );
  assert.deepEqual(
    getCollectionHeaderTitleParts('japanese-terms', { id: 'C101', title: '日本特色詞彙一覽' }),
    { hall: 'Collection 101', name: '日本特色詞彙一覽' }
  );
  const el = { innerHTML: '', textContent: '' };
  applyCollectionHeaderTitle(el, 'korean-terms', { id: 'C103', title: '韓語單字量最強速成攻略' });
  assert.match(el.innerHTML, /collection-header-hall">Collection 103</);
  assert.match(el.innerHTML, /collection-header-name">韓語單字量最強速成攻略</);
});

test('Filter engine chains query, length, Hangul, etymology, and POS', () => {
  assert.equal(matchesKanaGroup('ありがとう', 'あ'), true);
  assert.equal(getHangulInitialTab('가능 | 可能'), 'ㄱ');
  assert.equal(matchesHangulInitial('실수 | 失手', 'ㅅ'), true);

  const mockRecords = [
    { id: '1', ja_term: 'A', tw_translation: '意思A' },
    { id: '2', ja_term: 'B', tw_translation: '意思B' }
  ];
  assert.equal(filterByQuery(mockRecords, '意思A')[0].id, '1');

  const lengthRecords = [
    { id: '1', ja_term: '一' },
    { id: '4', ja_term: '四字詞語' },
    { id: '5', ja_term: '五字詞語長' }
  ];
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.ONE)[0].id, '1');
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.FIVE_PLUS)[0].id, '5');
  assert.equal(filterByLength([{ id: 'k2', ja_term: '가능 | 可能' }], LENGTH_TABS.TWO)[0].id, 'k2');

  const hangulRecords = [
    { id: 'g', ja_term: '가능 | 可能', reading: '가능' },
    { id: 's', ja_term: '실수 | 失手', reading: '실수' }
  ];
  assert.equal(filterByKana(hangulRecords, 'ㄱ')[0].id, 'g');

  const records = [
    { id: '#C103-0003', ja_term: '가능 | 可能', reading: '가능', subtitle: '可能', row_index: 3 },
    { id: '#C103-0001', ja_term: '컴퓨터 | computer', reading: '컴퓨터', subtitle: 'computer', row_index: 1 },
    { id: '#C103-0002', ja_term: '강하다 | 強하다', reading: '강하다', subtitle: '強하다', row_index: 2 }
  ];
  assert.deepEqual(filterByLoanword(records, true).map(r => r.id), ['#C103-0001']);
  assert.equal(filterByInitial(records, 'ㄱ').length, 2);
  assert.equal(filterByLength(filterByLoanword(filterByInitial(records, 'ㄱ'), true), LENGTH_TABS.TWO).length, 0);

  const etymologyRecords = [
    { id: 'hanja', etymology: '漢字語', pos: '名詞' },
    { id: 'loan', etymology: '外來語', pos: '名詞' },
    { id: 'native', etymology: '固有語', pos: '動詞' },
    { id: 'hybrid', etymology: '混種語', pos: '名詞' }
  ];
  assert.deepEqual(filterByEtymology(etymologyRecords, ETYMOLOGY_TABS.HYBRID).map(r => r.id), ['hybrid']);
  assert.deepEqual(filterByPos(etymologyRecords, POS_TABS.VERB).map(r => r.id), ['native']);
  assert.deepEqual(POS_PRIMARY_TABS, [POS_TABS.ALL, POS_TABS.NOUN, POS_TABS.VERB, POS_TABS.ADJECTIVE, POS_TABS.ADVERB]);
  assert.ok(POS_EXTRA_TABS.includes(POS_TABS.BOUND_NOUN));

  const byIdDesc = sortRecords(records, null, { sortField: SORT_FIELDS.ID, sortOrder: SORT_ORDERS.DESC });
  assert.deepEqual(byIdDesc.map(r => r.id), ['#C103-0003', '#C103-0002', '#C103-0001']);
});

test('Hall config builds Sheets URLs and C103 flags', () => {
  const csvUrl = googleSheetsConfig.getCsvUrl('SHEET_ID', '123');
  assert.equal(csvUrl, 'https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=123');

  const jpCol = collectionsConfig['japanese-terms'];
  const dataUrls = getCollectionDataUrls(jpCol);
  assert(dataUrls.csvUrl.includes('gid=1923603290'));
  assert.equal(jpCol.defaultMeta.status, '開放中');

  const metaUrls = getMetadataUrls();
  assert(metaUrls.csvUrl.includes('gid=1574352890'));
  const profileUrls = getProfileUrls();
  assert.equal(profileUrls.localFallback, 'profiles.json');

  const krCol = collectionsConfig['korean-terms'];
  const krUrls = getCollectionDataUrls(krCol);
  assert.equal(krCol.defaultMeta.id, 'C103');
  assert.equal(krCol.gid, '585106275');
  assert(krUrls.csvUrl.includes('gid=585106275'));
  assert.equal(krCol.hasHangulTabs, true);
  assert.equal(krCol.hasEtymologyPosFilter, true);
  assert.equal(krCol.hasNameCategoryFilter, true);
  assert.deepEqual(krCol.hiddenColumnIndexes, [2, 3]);
});

test('Gallery CSV maps C103 columns, tags, and GViz formatted ids', () => {
  const krCsv = `ID,顯示,諺文,副標,發音,意思,新增日期,推薦條目,詞源,詞性,標籤
#C103-0002,가능 | 可能,가능,可能,가능,可能,2026-09-15,,漢字語,名詞,基礎100
#C103-0005,실수 | 失手,실수,失手,실수,失誤,2026-09-15,,漢字語,名詞,`;
  const kr = parseCSVData(krCsv, 'korean-terms');
  assert.equal(kr[0].ja_term, '가능 | 可能');
  assert.equal(kr[0].tw_translation, '可能');
  assert.equal(kr[0].etymology, '漢字語');
  assert.equal(kr[0].pos, '名詞');
  assert.deepEqual(kr[0].tags, ['基礎100']);
  assert.deepEqual(filterByBasic100(kr, true).map(r => r.id), ['#C103-0002']);
  const named = [
    { id: 'p', tags: ['人名'] },
    { id: 'g', tags: ['團體名'] },
    { id: 'c', tags: ['公司名'] },
    { id: 'b', tags: ['基礎100'] }
  ];
  assert.deepEqual(filterByCategory(named, CATEGORY_TABS.PERSON).map(r => r.id), ['p']);
  assert.deepEqual(filterByCategory(named, CATEGORY_TABS.GROUP).map(r => r.id), ['g']);
  assert.deepEqual(filterByCategory(named, CATEGORY_TABS.COMPANY).map(r => r.id), ['c']);
  assert.deepEqual(filterByCategory(named, CATEGORY_TABS.BASIC100).map(r => r.id), ['b']);
  assert.equal(getExhibitCategoryLabel(named[0]), '人名');
  assert.equal(getExhibitCategoryLabel(named[3]), '');

  const jpCsv = `ID,日語用詞,台灣用詞,読み方,新增日期,推薦條目,標籤
#C101-0002,1LDK,一房一廳一廚（格局）,ワンエルディーケー,2026-09-02,物件,基礎100`;
  const jp = parseCSVData(jpCsv, 'japanese-terms');
  assert.deepEqual(jp[0].tags, ['基礎100']);

  const sampleGviz = `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: {
      cols: [
        { label: 'ID' }, { label: '顯示' }, { label: '諺文' }, { label: '副標' },
        { label: '發音' }, { label: '意思' }, { label: '新增日期' }, { label: '推薦條目' },
        { label: '詞源' }, { label: '詞性' }
      ],
      rows: [{
        c: [
          { v: 2.0, f: '#C103-0002' },
          { v: '가능 | 可能' },
          { v: '가능' },
          { v: '可能' },
          { v: '가능' },
          { v: '可能' },
          { v: 'Date(2026,8,15)', f: '2026-09-15' },
          { v: '' },
          { v: '漢字語' },
          { v: '名詞' }
        ]
      }, {
        c: [
          { v: 1047 },
          { v: '실수 | 失手' },
          { v: '실수' },
          { v: '失手' },
          { v: '실수' },
          { v: '失誤' },
          { v: 'Date(2026,8,15)' },
          { v: '' },
          { v: '漢字語' },
          { v: '名詞' }
        ]
      }]
    }
  })});`;
  const parsed = parseGvizResponse(sampleGviz, 'korean-terms');
  assert.equal(parsed[0].id, '#C103-0002');
  assert.equal(parsed[0].created_at, '2026-09-15');
  assert.equal(parsed[1].id, '#C103-1047');
});

test('Profile parsers and hall status helpers', () => {
  assert.equal(formatProfileId(2), '#P-0002');
  const csv = `ID,English Name,Chinese Name,IG,Youtube,Gmail,Description
#P-0002,Chocolate,巧克力,不公開,不公開,不公開,"CGO Master
歡迎大家來玩"`;
  const parsed = parseProfilesCSVData(csv);
  assert.equal(parsed[0].zhName, '巧克力');
  assert.equal(parsed[0].description, 'CGO Master\n歡迎大家來玩');

  const gviz = `google.visualization.Query.setResponse({"status":"ok","table":{"cols":[{"label":"ID"},{"label":"English Name"},{"label":"Chinese Name"},{"label":"IG"},{"label":"Youtube"},{"label":"Gmail"},{"label":"Description"}],"rows":[{"c":[{"v":2.0,"f":"#P-0002"},{"v":"Chocolate"},{"v":"巧克力"},{"v":"不公開"},{"v":"不公開"},{"v":"不公開"},{"v":"CGO Master\\\\n歡迎大家來玩"}]}]}});`;
  const fromGviz = parseProfilesGvizResponse(gviz);
  assert.equal(fromGviz[0].id, '#P-0002');

  assert.equal(isCollectionAdjusting({ status: '調整中' }), true);
  assert.equal(isCollectionPreparing({ status: '籌備中' }), true);
  assert.equal(isCollectionHidden({ status: '不顯示' }), true);
  assert.equal(isCollectionHidden({ status: '開放中' }), false);
});

test('Catalog quick filters map Latest / Random / 基礎100', async () => {
  const makePill = (tab) => {
    const classes = new Set();
    return {
      getAttribute: () => tab,
      classList: {
        toggle(name, on) {
          if (name !== 'active') return;
          if (on) classes.add('active');
          else classes.delete('active');
        },
        add(name) { if (name === 'active') classes.add('active'); },
        remove(name) { if (name === 'active') classes.delete('active'); },
        contains(name) { return classes.has(name); }
      }
    };
  };
  const pills = {
    LATEST10: makePill('LATEST10'),
    RANDOM10: makePill('RANDOM10'),
    BASIC100: makePill('BASIC100')
  };
  const activeQuickTabs = () => Object.entries(pills)
    .filter(([, el]) => el.classList.contains('active'))
    .map(([tab]) => tab);
  global.document = {
    getElementById: () => null,
    querySelectorAll: (sel) => sel.includes('#quick-filter-tabs') ? Object.values(pills) : [],
    querySelector: () => null
  };

  const { store } = await import('../js/state.js');
  const { selectQuickFilter } = await import('../js/filter.js');

  store.set({
    currentLengthTab: LENGTH_TABS.ALL,
    currentInitialTab: KANA_TABS.ALL,
    loanwordOnly: false,
    categoryTab: CATEGORY_TABS.ALL,
    currentSortField: SORT_FIELDS.STANDARD,
    currentSortOrder: SORT_ORDERS.ASC,
    currentCollectionId: 'japanese-terms',
    allRecords: [],
    filteredRecords: [],
    pageSize: 50
  });
  assert.equal(getFilterSummary(), '読み方 正序');

  selectQuickFilter(QUICK_FILTERS.LATEST10);
  assert.equal(store.get().currentSortField, SORT_FIELDS.CREATED_AT);
  assert.equal(store.get().pageSize, 10);
  assert.deepEqual(activeQuickTabs(), ['LATEST10']);

  selectQuickFilter(QUICK_FILTERS.RANDOM10);
  assert.equal(store.get().currentSortField, SORT_FIELDS.RANDOM);
  assert.equal(store.get().pageSize, 10);
  assert.deepEqual(activeQuickTabs(), ['RANDOM10']);

  selectQuickFilter(QUICK_FILTERS.BASIC100);
  assert.equal(store.get().categoryTab, CATEGORY_TABS.BASIC100);
  assert.equal(store.get().pageSize, 100);
  assert.equal(store.get().currentSortField, SORT_FIELDS.STANDARD);
  assert.deepEqual(activeQuickTabs(), ['BASIC100']);

  selectQuickFilter(QUICK_FILTERS.LATEST10);
  assert.equal(store.get().categoryTab, CATEGORY_TABS.ALL);
  assert.equal(store.get().currentSortField, SORT_FIELDS.CREATED_AT);
  assert.equal(store.get().pageSize, 10);
  assert.deepEqual(activeQuickTabs(), ['LATEST10']);
});
