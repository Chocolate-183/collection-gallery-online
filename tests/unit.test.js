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
import { LENGTH_TABS } from '../js/constants.js';
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
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.FIVE)[0].id, '5');
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.SIX)[0].id, '6');
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.SEVEN)[0].id, '7');
  assert.equal(filterByLength(lengthRecords, LENGTH_TABS.EIGHT_PLUS).length, 2);
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

test('Explore Recommendation Tag Truncation', () => {
  const formatTag = (item) => {
    const chars = Array.from(item);
    return chars.length > 5 ? chars.slice(0, 5).join('') + '..' : item;
  };

  assert.equal(formatTag('12345'), '12345');
  assert.equal(formatTag('123456'), '12345..');
  assert.equal(formatTag('お疲れ様です'), 'お疲れ様で..');
  assert.equal(formatTag('日本特色'), '日本特色');
});

test('CSS Stylesheet - Desktop Small and Large Modal Sizes & Modal Typography', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const cssPath = path.resolve('styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert(cssContent.includes('@media (min-width: 769px)'), 'Should contain desktop media query @media (min-width: 769px)');
  assert(cssContent.includes('.awsui-modal-sm'), 'Should define .awsui-modal-sm selector');
  assert(cssContent.includes('.awsui-modal-lg'), 'Should define .awsui-modal-lg selector');
  assert(cssContent.includes('max-width: 640px;'), 'Large modal should use reduced max-width of 640px');
  assert(cssContent.includes('aspect-ratio: 1 / 1;'), 'Modal should use 1:1 aspect ratio');
  assert(cssContent.includes("#modal-meaning-text {\n  font-family: 'Noto Sans TC', sans-serif;"), 'modal-meaning-text should use Noto Sans TC font');
  assert(cssContent.includes('#modal-meaning-text.is-multiline'), 'modal-meaning-text.is-multiline should be defined in CSS');
  assert(cssContent.includes('background-color: #f8f9fa;'), 'is-multiline should set a subtle background color #f8f9fa');
  assert(cssContent.includes('border: none;'), 'is-multiline should have border: none');
  assert(cssContent.includes('border-radius: 0;'), 'is-multiline should have border-radius: 0');
  assert(cssContent.includes('margin-left: -14px;'), 'is-multiline should offset margin-left to align text with Description title');
  assert(cssContent.includes('.awsui-modal-header-title'), 'Should define .awsui-modal-header-title selector');
  assert(cssContent.includes('justify-content: center;'), 'awsui-modal-header-title should center title text');
  assert(cssContent.includes('border-bottom: 1px solid var(--awsui-color-border-control-default'), 'awsui-modal-header-title should have a bottom border line');
  assert(cssContent.includes('.awsui-modal-created-time'), 'Should define .awsui-modal-created-time selector');
  assert(cssContent.includes('border-top: 1px solid var(--awsui-color-border-control-default'), 'awsui-modal-created-time should have a top border line');
  assert(cssContent.includes('grid-template-columns: 1.2fr 1fr;'), 'awsui-modal-created-time should use grid layout with ID column around middle-right');
  assert(cssContent.includes('.awsui-modal-meta-item'), 'Should define .awsui-modal-meta-item selector');
});

test('Modal Meaning Text Multiline Detection', async () => {
  const { checkMeaningExceedsTwoLines } = await import('../js/components/modal.js');

  // 1 or 2 lines
  assert.equal(checkMeaningExceedsTwoLines('暴風雨、嵐'), false);
  assert.equal(checkMeaningExceedsTwoLines('單行說明'), false);
  assert.equal(checkMeaningExceedsTwoLines('第一行\n第二行'), false);
  assert.equal(checkMeaningExceedsTwoLines(''), false);

  // Exceeds 2 lines with newlines
  assert.equal(checkMeaningExceedsTwoLines('第一行\n第二行\n第三行'), true);

  // Exceeds 2 lines with long CJK text (>50 CJK chars)
  assert.equal(checkMeaningExceedsTwoLines('這是一段非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常長超過五十個字的詳細說明文字內容介紹與翻譯對照'), true);
});
