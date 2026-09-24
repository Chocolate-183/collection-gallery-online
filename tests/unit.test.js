import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCSVData,
  parseGvizResponse,
  parseMetaCSVData,
  parseAllCollectionsMetaCSVData,
  parseCSVRows,
  extractGvizTable,
  parseOpeningHoursCSV,
  extractOpeningHoursFromMetaRows,
  parseProfilesCSVData,
  parseProfilesGvizResponse,
  formatProfileId
} from '../js/parser.js';
import { matchesKanaGroup, matchesHangulInitial, getHangulInitialTab, filterByQuery, filterByLength, filterByKana, filterByInitial, filterByLoanword, sortBySubtitle, sortRecords, resolveSortType } from '../js/filter.js';
import { LENGTH_TABS, KANA_TABS, SORT_FIELDS, SORT_ORDERS } from '../js/constants.js';
import {
  escapeHtml,
  getUnicodeLength,
  getExhibitFilterLength,
  formatExhibitTitleHtml,
  isEnglishSubtitle,
  isEnglishLoanword,
  getTodayOpeningHoursText,
  isCollectionAdjusting,
  isCollectionPreparing,
  isCollectionHidden,
  parseRecommendationList
} from '../js/utils.js';
import { googleSheetsConfig, getCollectionDataUrls, getMetadataUrls, getProfileUrls, collectionsConfig } from '../js/config.js';

test('CSV & Data Parsers - Core CSV Parsing & GViz Extraction', () => {
  const sampleCSV = `ID,日語用詞,台灣意思,假名標音,建立日期,推薦條目
1,"お疲れ様","辛苦了
多行測試","おつかれさま","2024-01-01","211<br>一本"
2,"""Quotes"" Term","包含""雙引號""","クォート","2024-01-02","牛马\n大厂"`;

  const parsed = parseCSVData(sampleCSV);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].ja_term, 'お疲れ様');
  assert.equal(parsed[0].tw_translation, '辛苦了\n多行測試');
  assert.deepEqual(parsed[0].recommendations, ['211', '一本']);
  assert.equal(parsed[1].ja_term, '"Quotes" Term');
  assert.equal(parsed[1].tw_translation, '包含"雙引號"');
  assert.deepEqual(parsed[1].recommendations, ['牛马', '大厂']);

  const rows = parseCSVRows('a,b,c\n1,"2\n3",4');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], ['1', '2\n3', '4']);

  const sampleGviz = `google.visualization.Query.setResponse({"status":"ok","table":{"cols":[{"label":"id"}],"rows":[{"c":[{"v":"1"}]}]}});`;
  const table = extractGvizTable(sampleGviz);
  assert.notEqual(table, null);
  assert.equal(table.rows.length, 1);
  assert.equal(extractGvizTable('invalid input'), null);
});

test('Metadata Parsers - Single & Multi-Collection Matrix', () => {
  const sampleMetaCSV = `項目,內容
標題,日本特色詞彙
副標,探索日本流行與次文化用語的專屬辭典
ID,C101
狀態,調整中
標籤,"日本文化
流行新詞"
作者,巧克力`;

  const meta = parseMetaCSVData(sampleMetaCSV);
  assert.equal(meta.title, '日本特色詞彙');
  assert.equal(meta.id, 'C101');
  assert.equal(meta.status, '調整中');
  assert.deepEqual(meta.tags, ['日本文化', '流行新詞']);
  assert.equal(meta.author, '巧克力');

  const sampleMatrixCSV = `展廳名,日本特色詞彙,簡中語境破解攻略,韓語單字速成攻略
展廳ID,C101,C102,C103
展廳狀態,調整中,開放中,籌備中
展廳副標,日語副標測試,大陸副標測試,籌備中`;

  const parsedMap = parseAllCollectionsMetaCSVData(sampleMatrixCSV);
  assert('japanese-terms' in parsedMap);
  assert('china-terms' in parsedMap);
  assert('korean-terms' in parsedMap);
  assert.equal(parsedMap['japanese-terms'].status, '調整中');
  assert.equal(parsedMap['china-terms'].status, '開放中');
  assert.equal(parsedMap['korean-terms'].status, '籌備中');

  const hoursMatrixCSV = `展廳名,日本特色詞彙,簡中語境破解攻略
展廳ID,C101,C102
週日,00:01 - 23:59,09:00 - 18:00
週一,01:00 - 22:00,09:00 - 18:00
週二,01:00 - 22:00,09:00 - 18:00
週三,01:00 - 22:00,09:00 - 18:00
週四,01:00 - 22:00,09:00 - 18:00
週五,06:00 - 23:55,09:00 - 18:00
週六,06:00 - 23:55,09:00 - 18:00`;
  const hoursFromMeta = extractOpeningHoursFromMetaRows(parseCSVRows(hoursMatrixCSV));
  assert.equal(hoursFromMeta[0].hours, '00:01 - 23:59');
  assert.equal(hoursFromMeta[1].hours, '01:00 - 22:00');
  assert.equal(hoursFromMeta[5].hours, '06:00 - 23:55');
});

test('Opening Hours Parser & Schedule Utilities', () => {
  const sampleCSV = `星期,開放時間\n週日,00:01 - 23:59\n週一,00:01 - 23:59`;
  const schedule = parseOpeningHoursCSV(sampleCSV);
  assert.notEqual(schedule, null);
  assert.equal(schedule.length, 7);
  assert.equal(schedule[0].day, '週日');
  assert.equal(schedule[0].hours, '00:01 - 23:59');

  const monday = new Date('2026-09-07T10:00:00');
  assert.equal(getTodayOpeningHoursText(monday), "Today's Hours: 00:01 - 23:59");
});

test('Utils - HTML Escaping, Unicode Length & Recommendations', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  assert.equal(escapeHtml(''), '');

  assert.equal(getUnicodeLength(''), 0);
  assert.equal(getUnicodeLength('あい'), 2);
  assert.equal(getUnicodeLength('🌸日本'), 3);
  assert.equal(getExhibitFilterLength('가능 | 可能'), 2);
  assert.equal(getExhibitFilterLength('강하다 | 強하다'), 3);
  assert.equal(getExhibitFilterLength('개인기 | 個人技'), 3);
  assert.equal(getExhibitFilterLength('1LDK'), 4);
  assert.equal(formatExhibitTitleHtml('가능 | 可能'), '가능 <span class="awsui-title-separator">|</span><span class="awsui-title-suffix"> 可能</span>');
  assert.equal(formatExhibitTitleHtml('1LDK'), '1LDK');
  assert.equal(formatExhibitTitleHtml('<script>|x'), '&lt;script&gt;<span class="awsui-title-separator">|</span><span class="awsui-title-suffix">x</span>');

  assert.equal(isEnglishSubtitle('computer'), true);
  assert.equal(isEnglishSubtitle('Wi-Fi'), true);
  assert.equal(isEnglishSubtitle('e-mail'), true);
  assert.equal(isEnglishSubtitle('可能'), false);
  assert.equal(isEnglishSubtitle('失手'), false);
  assert.equal(isEnglishSubtitle('가능'), false);
  assert.equal(isEnglishSubtitle(''), false);
  assert.equal(isEnglishLoanword({ ja_term: '컴퓨터 | computer' }), true);
  assert.equal(isEnglishLoanword({ ja_term: '가능 | 可能' }), false);
  assert.equal(isEnglishLoanword({ ja_term: '가능 | 可能', subtitle: 'computer' }), true);

  assert.deepEqual(parseRecommendationList('211<br>一本,二本\n三本；四本'), ['211', '一本', '二本', '三本', '四本']);
  assert.deepEqual(parseRecommendationList(['A', 'B']), ['A', 'B']);
  assert.deepEqual(parseRecommendationList(null), []);
});

test('Filter Engine - Kana Matching, Query, Length & Latest10 Sorting', () => {
  assert.equal(matchesKanaGroup('ありがとう', 'あ'), true);
  assert.equal(matchesKanaGroup('かさ', 'か'), true);
  assert.equal(matchesKanaGroup('さくら', 'あ'), false);

  assert.equal(getHangulInitialTab('가능 | 可能'), 'ㄱ');
  assert.equal(getHangulInitialTab('강하다'), 'ㄱ');
  assert.equal(getHangulInitialTab('나다'), 'ㄴ');
  assert.equal(getHangulInitialTab('까다롭다'), 'ㄱ');
  assert.equal(matchesHangulInitial('가능 | 可能', 'ㄱ'), true);
  assert.equal(matchesHangulInitial('실수 | 失手', 'ㄱ'), false);
  assert.equal(matchesHangulInitial('실수 | 失手', 'ㅅ'), true);

  const mockRecords = [
    { id: '1', ja_term: 'A', tw_translation: '意思A', created_at: '2024-01-01', row_index: 1 },
    { id: '2', ja_term: 'B', tw_translation: '意思B', created_at: '2024-03-01', row_index: 2 },
    { id: '3', ja_term: 'C', tw_translation: '意思C', created_at: '2024-03-01', row_index: 3 }
  ];

  const queryResult = filterByQuery(mockRecords, '意思A');
  assert.equal(queryResult.length, 1);
  assert.equal(queryResult[0].id, '1');

  const latestResult = filterByKana(mockRecords, 'LATEST10', '');
  assert.equal(latestResult[0].id, '3', 'Highest row index on same newest date should be first');
  assert.equal(latestResult[1].id, '2');

  const lengthRecords = [
    { id: '1', ja_term: '一' },
    { id: '2', ja_term: '二字' },
    { id: '3', ja_term: '三字詞' },
    { id: '4', ja_term: '四字詞語' },
    { id: '5', ja_term: '五字詞語長' },
    { id: '6', ja_term: '六字詞語長度' },
    { id: '7', ja_term: '七字詞語長度啊' },
    { id: '8', ja_term: '八字詞語長度啊哈' },
    { id: '9', ja_term: '九字詞語長度啊哈喔' }
  ];

  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.ALL).length, 9);
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.ONE)[0].id, '1');
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.FOUR)[0].id, '4');
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.FIVE_PLUS).length, 5);
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.FIVE_PLUS)[0].id, '5');
  assert.equal(filterByLength(lengthRecords, '5+').length, 5);
  assert.equal(filterByLength(lengthRecords, '5字＋').length, 5);

  const koreanLengthRecords = [
    { id: 'k2', ja_term: '가능 | 可能' },
    { id: 'k3', ja_term: '강하다 | 強하다' },
    { id: 'k4', ja_term: '개인기요 | 個人技' }
  ];
  assert.equal(filterByLength(koreanLengthRecords, LENGTH_TABS.TWO)[0].id, 'k2');
  assert.equal(filterByLength(koreanLengthRecords, LENGTH_TABS.THREE)[0].id, 'k3');
  assert.equal(filterByLength(koreanLengthRecords, LENGTH_TABS.FOUR)[0].id, 'k4');
  assert.equal(filterByLength(koreanLengthRecords, LENGTH_TABS.FIVE_PLUS).length, 0);

  const hangulRecords = [
    { id: 'g', ja_term: '가능 | 可能', reading: '가능' },
    { id: 'n', ja_term: '나다', reading: '나다' },
    { id: 's', ja_term: '실수 | 失手', reading: '실수' }
  ];
  const gaOnly = filterByKana(hangulRecords, 'ㄱ', '');
  assert.equal(gaOnly.length, 1);
  assert.equal(gaOnly[0].id, 'g');
  const saOnly = filterByKana(hangulRecords, 'ㅅ', '');
  assert.equal(saOnly.length, 1);
  assert.equal(saOnly[0].id, 's');

  const loanwordRecords = [
    { id: 'hanja', ja_term: '가능 | 可能', subtitle: '可能' },
    { id: 'eng-col', ja_term: '컴퓨터 | computer', subtitle: 'computer' },
    { id: 'eng-title', ja_term: '이메일 | e-mail' }
  ];
  const loanwords = filterByKana(loanwordRecords, KANA_TABS.LOANWORD, '');
  assert.equal(loanwords.length, 2);
  assert.deepEqual(loanwords.map(r => r.id), ['eng-col', 'eng-title']);

  const unsortedLoanwords = [
    { id: 'wifi', ja_term: '와이파이 | Wi-Fi', subtitle: 'Wi-Fi' },
    { id: 'computer', ja_term: '컴퓨터 | computer', subtitle: 'computer' },
    { id: 'email', ja_term: '이메일 | e-mail' }
  ];
  assert.deepEqual(sortBySubtitle(unsortedLoanwords).map(r => r.id), ['computer', 'email', 'wifi']);
});

test('Filter Modal - Initial, Length, Kind and Sort combine independently', () => {
  const records = [
    { id: '#C103-0003', ja_term: '가능 | 可能', reading: '가능', subtitle: '可能', row_index: 3 },
    { id: '#C103-0001', ja_term: '컴퓨터 | computer', reading: '컴퓨터', subtitle: 'computer', row_index: 1 },
    { id: '#C103-0002', ja_term: '강하다 | 強하다', reading: '강하다', subtitle: '強하다', row_index: 2 },
    { id: '#C103-0010', ja_term: '개인기 | 個人技', reading: '개인기', subtitle: '個人技', row_index: 10 }
  ];

  const loanOnly = filterByLoanword(records, true);
  assert.deepEqual(loanOnly.map(r => r.id), ['#C103-0001']);

  const gaOnly = filterByInitial(records, 'ㄱ');
  assert.equal(gaOnly.length, 3);
  assert.equal(filterByInitial(gaOnly, 'ALL').length, 3);

  const twoChars = filterByLength(gaOnly, LENGTH_TABS.TWO);
  assert.deepEqual(twoChars.map(r => r.id), ['#C103-0003']);

  const combined = filterByLength(filterByLoanword(filterByInitial(records, 'ㄱ'), true), LENGTH_TABS.TWO);
  assert.equal(combined.length, 0);

  const byIdAsc = sortRecords(records, null, { sortField: SORT_FIELDS.ID, sortOrder: SORT_ORDERS.ASC });
  assert.deepEqual(byIdAsc.map(r => r.id), ['#C103-0001', '#C103-0002', '#C103-0003', '#C103-0010']);

  const byIdDesc = sortRecords(records, null, { sortField: SORT_FIELDS.ID, sortOrder: SORT_ORDERS.DESC });
  assert.deepEqual(byIdDesc.map(r => r.id), ['#C103-0010', '#C103-0003', '#C103-0002', '#C103-0001']);

  const byTitle = sortRecords(records, null, { sortField: SORT_FIELDS.TITLE, sortOrder: SORT_ORDERS.ASC });
  assert.equal(byTitle[0].ja_term, '가능 | 可能');

  const byGloss = sortRecords(records, null, { sortField: SORT_FIELDS.SUBTITLE, sortOrder: SORT_ORDERS.ASC });
  assert.deepEqual(byGloss.map(r => r.subtitle), ['computer', '個人技', '可能', '強하다']);

  assert.equal(resolveSortType(SORT_FIELDS.ID, SORT_ORDERS.ASC), 'id-asc');
  assert.equal(resolveSortType(SORT_FIELDS.TITLE, SORT_ORDERS.DESC), 'ja-desc');
});

test('Config & Endpoint URL Builders', () => {
  const csvUrl = googleSheetsConfig.getCsvUrl('SHEET_ID', '123');
  assert.equal(csvUrl, 'https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=123');

  const jpCol = collectionsConfig['japanese-terms'];
  const dataUrls = getCollectionDataUrls(jpCol);
  assert(dataUrls.csvUrl.includes('1rFrRNHwuPwBr27EuCqOj8r1evXU-9qE_HJfDCzXyWwI'));
  const metaUrls = getMetadataUrls();
  assert(metaUrls.csvUrl.includes('162GJh8BkmI7T66d3zJR5FbWoiM-oni2GJzTXVg30JUs'));
  assert(metaUrls.csvUrl.includes('gid=1574352890'));
  const profileUrls = getProfileUrls();
  assert(profileUrls.csvUrl.includes('162GJh8BkmI7T66d3zJR5FbWoiM-oni2GJzTXVg30JUs'));
  assert(profileUrls.csvUrl.includes('gid=1665955868'));
  assert.equal(profileUrls.localFallback, 'profiles.json');
  assert.equal(collectionsConfig['japanese-terms'].defaultMeta.status, '開放中');
  assert.equal(collectionsConfig['china-terms'].defaultMeta.status, '開放中');
  assert.equal(collectionsConfig['korean-terms'].defaultMeta.status, '開放中');
  assert.equal(isCollectionAdjusting(collectionsConfig['japanese-terms'].defaultMeta), false);
  assert.equal(isCollectionAdjusting(collectionsConfig['china-terms'].defaultMeta), false);

  const cnCol = collectionsConfig['china-terms'];
  assert.equal(cnCol.enTitle, 'Decoding Simplified Chinese: The Ultimate Guide');
  assert.equal(cnCol.defaultMeta.enTitle, 'Decoding Simplified Chinese: The Ultimate Guide');
  assert.equal(cnCol.name, '簡中語境破解攻略');
  assert.equal(cnCol.defaultMeta.title, '簡中語境破解攻略');
  assert.equal(cnCol.defaultMeta.id, 'C102');

  const krCol = collectionsConfig['korean-terms'];
  assert.equal(krCol.enTitle, 'Master Korean Vocabulary Fast: The Ultimate Cheat Sheet');
  assert.equal(krCol.defaultMeta.enTitle, 'Master Korean Vocabulary Fast: The Ultimate Cheat Sheet');
  assert.equal(krCol.name, '韓語單字速成攻略');
  assert.equal(krCol.defaultMeta.title, '韓語單字速成攻略');
  assert.equal(krCol.defaultMeta.id, 'C103');
  assert.equal(krCol.gid, '168524304');
  assert.equal(krCol.hasReading, true);
  assert.equal(krCol.hasKanaTabs, false);
  assert.equal(krCol.hasHangulTabs, true);
  assert.equal(krCol.hasLoanwordFilter, true);
  assert.deepEqual(krCol.hiddenColumnIndexes, [2, 3]);
  const krUrls = getCollectionDataUrls(krCol);
  assert(krUrls.csvUrl.includes('1J3tN8QV24FYi0ti4OFhNDDHE9jWhFq2c2s8LUQwp1VM'));
  assert(krUrls.csvUrl.includes('gid=168524304'));
});

test('C103 Korean gallery CSV uses 顯示 / 發音 / 意思 and hides columns C and D', () => {
  const sampleCSV = `ID,顯示,諺文,副標,發音,意思,新增日期,推薦條目
#C103-0002,가능 | 可能,가능,可能,가능,可能,2026-09-15,
#C103-0005,실수 | 失手,실수,失手,실수,失誤,2026-09-15,`;

  const parsed = parseCSVData(sampleCSV, 'korean-terms');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, '#C103-0002');
  assert.equal(parsed[0].ja_term, '가능 | 可能');
  assert.equal(parsed[0].reading, '가능');
  assert.equal(parsed[0].tw_translation, '可能');
  assert.equal(parsed[0].subtitle, '可能');
  assert.equal(parsed[1].ja_term, '실수 | 失手');
  assert.equal(parsed[1].reading, '실수');
  assert.equal(parsed[1].tw_translation, '失誤');
  assert.equal(parsed[0].created_at, '2026-09-15');
});

test('GViz exhibit ID and Timestamp use C101 formatted values', () => {
  const sampleGviz = `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table: {
      cols: [
        { label: 'ID' }, { label: '顯示' }, { label: '諺文' }, { label: '副標' },
        { label: '發音' }, { label: '意思' }, { label: '新增日期' }, { label: '推薦條目' }
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
          { v: '' }
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
          { v: '' }
        ]
      }]
    }
  })});`;

  const parsed = parseGvizResponse(sampleGviz, 'korean-terms');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, '#C103-0002');
  assert.equal(parsed[0].created_at, '2026-09-15');
  assert.equal(parsed[1].id, '#C103-1047');
  assert.equal(parsed[1].created_at, '2026-09-15');
});

test('Gallery curator lives on config, not metadata', () => {
  for (const col of Object.values(collectionsConfig)) {
    assert.equal(col.curator, '巧克力');
    assert.equal(col.defaultMeta.author, undefined);
    assert.equal(col.defaultMeta.curator, undefined);
  }
});

test('Profile parsers - CSV, GViz formatted ID, name lookup keys', () => {
  assert.equal(formatProfileId(2), '#P-0002');
  assert.equal(formatProfileId('#P-0003'), '#P-0003');
  assert.equal(formatProfileId(''), '');

  const csv = `ID,English Name,Chinese Name,IG,Youtube,Gmail,Description
#P-0002,Chocolate,巧克力,不公開,不公開,不公開,"CGO Master
歡迎大家來玩"
#P-0003,Hikari,光,不公開,不公開,不公開,光追`;
  const parsed = parseProfilesCSVData(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, '#P-0002');
  assert.equal(parsed[0].enName, 'Chocolate');
  assert.equal(parsed[0].zhName, '巧克力');
  assert.equal(parsed[0].ig, '不公開');
  assert.equal(parsed[0].description, 'CGO Master\n歡迎大家來玩');
  assert.equal(parsed[1].zhName, '光');

  const gviz = `google.visualization.Query.setResponse({"status":"ok","table":{"cols":[{"label":"ID"},{"label":"English Name"},{"label":"Chinese Name"},{"label":"IG"},{"label":"Youtube"},{"label":"Gmail"},{"label":"Description"}],"rows":[{"c":[{"v":2.0,"f":"#P-0002"},{"v":"Chocolate"},{"v":"巧克力"},{"v":"不公開"},{"v":"不公開"},{"v":"不公開"},{"v":"CGO Master\\n歡迎大家來玩"}]}]}});`;
  const fromGviz = parseProfilesGvizResponse(gviz);
  assert.equal(fromGviz.length, 1);
  assert.equal(fromGviz[0].id, '#P-0002');
  assert.equal(fromGviz[0].zhName, '巧克力');
  assert.equal(fromGviz[0].description, 'CGO Master\n歡迎大家來玩');
});

test('Status & Exhibition Helpers', () => {
  assert.equal(isCollectionAdjusting({ status: '調整中' }), true);
  assert.equal(isCollectionPreparing({ status: '籌備中' }), true);
  assert.equal(isCollectionPreparing({ status: 'COMING SOON' }), true);
  assert.equal(isCollectionHidden({ status: '不顯示' }), true);
  assert.equal(isCollectionHidden({ status: '開放中' }), false);
});

test('Modal Meaning Text Multiline Detection', async () => {
  const { checkMeaningExceedsTwoLines, checkMeaningHasScroll } = await import('../js/components/modal.js');

  // 1 or 2 lines
  assert.equal(checkMeaningExceedsTwoLines('暴風雨、嵐'), false);
  assert.equal(checkMeaningExceedsTwoLines('單行說明'), false);
  assert.equal(checkMeaningExceedsTwoLines('第一行\n第二行'), false);
  assert.equal(checkMeaningExceedsTwoLines(''), false);

  // Exceeds 2 lines with newlines
  assert.equal(checkMeaningExceedsTwoLines('第一行\n第二行\n第三行'), true);

  // Exceeds 2 lines with long CJK text (>50 CJK chars)
  assert.equal(checkMeaningExceedsTwoLines('這是一段非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常長超過五十個字的詳細說明文字內容介紹與翻譯對照'), true);

  // Test checkMeaningHasScroll
  assert.equal(checkMeaningHasScroll(null), false);
  assert.equal(checkMeaningHasScroll({ clientHeight: 100, scrollHeight: 100 }), false);
  assert.equal(checkMeaningHasScroll({ clientHeight: 100, scrollHeight: 150 }), true);
});
