import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCSVData,
  parseGvizResponse,
  parseMetaCSVData,
  parseAllCollectionsMetaCSVData,
  parseCSVRows,
  extractGvizTable,
  parseOpeningHoursCSV
} from '../js/parser.js';
import { matchesKanaGroup, filterByQuery, filterByLength, filterByKana, sortRecords } from '../js/filter.js';
import {
  escapeHtml,
  getUnicodeLength,
  getTodayOpeningHoursText,
  getNextOpeningTimeText,
  isCollectionAdjusting,
  isCollectionPreparing,
  isCollectionHidden
} from '../js/utils.js';
import { googleSheetsConfig, getCollectionDataUrls, getCollectionMetaUrls, collectionsConfig } from '../js/config.js';

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

  const sampleMatrixCSV = `展廳名,日本特色詞彙,大陸特色詞彙,最強韓文漢字學習法
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

test('Utils - HTML Escaping & Unicode Character Length', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  assert.equal(escapeHtml(''), '');

  assert.equal(getUnicodeLength(''), 0);
  assert.equal(getUnicodeLength('あい'), 2);
  assert.equal(getUnicodeLength('🌸日本'), 3);
});

test('Filter Engine - Kana Matching, Query, Length & Latest10 Sorting', () => {
  assert.equal(matchesKanaGroup('ありがとう', 'あ'), true);
  assert.equal(matchesKanaGroup('かさ', 'か'), true);
  assert.equal(matchesKanaGroup('さくら', 'あ'), false);

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
});

test('Config & Endpoint URL Builders', () => {
  const csvUrl = googleSheetsConfig.getCsvUrl('SHEET_ID', '123');
  assert.equal(csvUrl, 'https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=123');

  const jpCol = collectionsConfig['japanese-terms'];
  const dataUrls = getCollectionDataUrls(jpCol);
  assert(dataUrls.csvUrl.includes('1rFrRNHwuPwBr27EuCqOj8r1evXU-9qE_HJfDCzXyWwI'));
});

test('Status & Exhibition Helpers', () => {
  assert.equal(isCollectionAdjusting({ status: '調整中' }), true);
  assert.equal(isCollectionPreparing({ status: '籌備中' }), true);
  assert.equal(isCollectionPreparing({ status: 'COMING SOON' }), true);
  assert.equal(isCollectionHidden({ status: '不顯示' }), true);
  assert.equal(isCollectionHidden({ status: '開放中' }), false);
});

test('CSS Stylesheet - Desktop Modal 9:16 Aspect Ratio Size', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const cssPath = path.resolve('styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert(cssContent.includes('@media (min-width: 769px)'), 'Should contain desktop media query @media (min-width: 769px)');
  assert(cssContent.includes('aspect-ratio: 9 / 16;'), 'Should define 9:16 aspect ratio for desktop modal size');
  assert(cssContent.includes('#modal-meaning-text'), 'Should target description text element');
  assert(cssContent.includes('overflow-y: auto;'), 'Should enable internal scrolling for description text');
});
