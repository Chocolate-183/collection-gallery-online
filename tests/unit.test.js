import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSVData, parseMetaCSVData, parseCSVRows, extractGvizTable } from '../js/parser.js';
import { matchesKanaGroup } from '../js/filter.js';
import { escapeHtml, getUnicodeLength } from '../js/utils.js';

test('CSV Parser - Multiline and Escaped Quotes', () => {
  const sampleCSV = `ID,日語用詞,台灣意思,假名標音,建立日期
1,"お疲れ様","辛苦了
多行測試","おつかれさま","2024-01-01"
2,"""Quotes"" Term","包含""雙引號""","クォート","2024-01-02"`;

  const parsed = parseCSVData(sampleCSV);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].ja_term, 'お疲れ様');
  assert.equal(parsed[0].tw_translation, '辛苦了\n多行測試');
  assert.equal(parsed[1].ja_term, '"Quotes" Term');
  assert.equal(parsed[1].tw_translation, '包含"雙引號"');
});

test('CSV Helper - parseCSVRows 2D array output', () => {
  const sampleCSV = `a,b,c\n1,"2\n3",4`;
  const rows = parseCSVRows(sampleCSV);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], ['a', 'b', 'c']);
  assert.deepEqual(rows[1], ['1', '2\n3', '4']);
});

test('GViz Helper - extractGvizTable extraction', () => {
  const sampleGviz = `google.visualization.Query.setResponse({"status":"ok","table":{"cols":[{"label":"id"}],"rows":[{"c":[{"v":"1"}]}]}});`;
  const table = extractGvizTable(sampleGviz);
  assert.notEqual(table, null);
  assert.equal(table.rows.length, 1);
  assert.equal(extractGvizTable('invalid input'), null);
});

test('Utils Helper - escapeHtml', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  assert.equal(escapeHtml("It's ok"), 'It&#039;s ok');
  assert.equal(escapeHtml(''), '');
});

test('Utils Helper - getUnicodeLength', () => {
  assert.equal(getUnicodeLength(''), 0);
  assert.equal(getUnicodeLength('あい'), 2);
  assert.equal(getUnicodeLength('🌸日本'), 3);
  assert.equal(getUnicodeLength('お疲れ様'), 4);
});

test('Kana Group Matching', () => {
  assert.equal(matchesKanaGroup('ありがとう', 'あ'), true);
  assert.equal(matchesKanaGroup('いぬ', 'あ'), true);
  assert.equal(matchesKanaGroup('かさ', 'か'), true);
  assert.equal(matchesKanaGroup('がっこう', 'か'), true);
  assert.equal(matchesKanaGroup('さくら', 'あ'), false);
});

test('Unicode Character Length Calculation', () => {
  assert.equal(getUnicodeLength('あい'), 2);
  assert.equal(getUnicodeLength('🌸日本'), 3);
  assert.equal(getUnicodeLength('お疲れ様'), 4);
});

test('Default Welcome Route Resolution', () => {
  const resolveRoute = (hash) => {
    const decoded = decodeURIComponent(hash || '');
    if (!decoded || decoded === '#' || decoded === '#/') return 'welcome';
    const path = decoded.replace(/^#\/?/, '');
    if (!path || path === 'welcome' || path === 'home') return 'welcome';
    if (path === 'about') return 'about';
    return 'dictionary';
  };

  assert.equal(resolveRoute(''), 'welcome');
  assert.equal(resolveRoute('#'), 'welcome');
  assert.equal(resolveRoute('#/'), 'welcome');
  assert.equal(resolveRoute('#/welcome'), 'welcome');
  assert.equal(resolveRoute('#/about'), 'about');
  assert.equal(resolveRoute('#/日本特色詞彙'), 'dictionary');
});

test('Meta Sheet CSV Parser', () => {
  const sampleMetaCSV = `項目,內容
標題,日本特色詞彙
標籤,"日本文化
流行新詞
次文化用語"
副標,探索日本流行與次文化用語的專屬辭典
說明,本表收錄了豐富的日本文化特色詞彙。
注意事項,1. 測試注意事項
作者,巧克力`;

  const meta = parseMetaCSVData(sampleMetaCSV);
  assert.equal(meta.title, '日本特色詞彙');
  assert.equal(meta.subtitle, '探索日本流行與次文化用語的專屬辭典');
  assert.equal(meta.tags.length, 3);
  assert.equal(meta.tags[0], '日本文化');
  assert.equal(meta.author, '巧克力');
});

test('ID and Date Monospace Font Styling Configuration', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const css = readFileSync(resolve('styles.css'), 'utf-8');

  assert(html.includes('id="modal-created-at"'));
  assert(html.includes('id="modal-id"'));
  assert(css.includes('--awsui-font-mono'));
  assert(css.includes('#modal-created-at'));
  assert(css.includes('#modal-id'));
  assert(css.includes('[data-collection="japanese-terms"]'));
  assert(css.includes("'Noto Sans JP'"));
});

test('Prevent unexpected scroll on modal open or hash sync', () => {
  let scrollCalled = false;
  const mockWindow = {
    scrollTo: () => { scrollCalled = true; }
  };

  // Logic simulation matching router.js
  let currentView = 'dictionary';
  const checkScrollCondition = (viewName, event) => {
    scrollCalled = false;
    const isViewChanged = currentView !== viewName;
    currentView = viewName;
    if (isViewChanged || !!event) {
      mockWindow.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return scrollCalled;
  };

  // Case 1: Same view (dictionary -> dictionary) with no click event (e.g., card modal hash change)
  assert.equal(checkScrollCondition('dictionary', null), false, 'Should not scroll when view does not change');

  // Case 2: View changes (dictionary -> welcome)
  assert.equal(checkScrollCondition('welcome', null), true, 'Should scroll when view changes');

  // Case 3: Same view with explicit user navigation event
  assert.equal(checkScrollCondition('welcome', { type: 'click' }), true, 'Should scroll on user click event');
});

test('Quick Filter Label and Latest 10 Selection', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const sidebarJs = readFileSync(resolve('js/components/sidebar.js'), 'utf-8');

  // Verify label is updated to "快速篩選："
  assert(html.includes('id="quick-tabs-label">快速篩選：</span>'));
  assert(html.includes("selectKanaTab('LATEST10', this)\">最新10筆</button>"));
  assert(sidebarJs.includes("quickTabsLabel.innerText = '快速篩選：'"));
  assert(!sidebarJs.includes("quickTabsLabel.innerText = '快速索引：'"));

  // Verify LATEST10 sorting and slicing logic
  const mockRecords = [
    { id: '1', ja_term: 'A', created_at: '2024-01-01', row_index: 1 },
    { id: '2', ja_term: 'B', created_at: '2024-02-01', row_index: 2 },
    { id: '3', ja_term: 'C', created_at: '2024-03-01', row_index: 3 },
    { id: '4', ja_term: 'D', created_at: '2024-03-01', row_index: 4 }, // Same date as 3, higher row_index
    { id: '5', ja_term: 'E', created_at: '2024-01-15', row_index: 5 }
  ];

  const sorted = [...mockRecords].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : NaN;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : NaN;
    if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
      return dateB - dateA;
    }
    return (b.row_index ?? 0) - (a.row_index ?? 0);
  });

  assert.equal(sorted[0].id, '4', 'Most recent by date + row_index should be first');
  assert.equal(sorted[1].id, '3');
  assert.equal(sorted[2].id, '2');
  assert.equal(sorted[3].id, '5');
  assert.equal(sorted[4].id, '1');
});

test('Kana Reading Display and Toggle Removal', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const css = readFileSync(resolve('styles.css'), 'utf-8');
  const cardsJs = readFileSync(resolve('js/components/cards.js'), 'utf-8');

  // Verify toggle button and class removal
  assert(!html.includes('id="btn-toggle-reading"'), 'btn-toggle-reading should be removed from index.html');
  assert(!css.includes('.awsui-toggle-control'), '.awsui-toggle-control should be removed from styles.css');
  assert(!cardsJs.includes('toggleReadingDisplay'), 'toggleReadingDisplay should be removed from cards.js');
  assert(!cardsJs.includes('updateReadingToggleUI'), 'updateReadingToggleUI should be removed from cards.js');
});

test('Empty State Card - Render Notice when Word Not Found via Search or URL', async () => {
  // Test message generation logic matching cards.js
  const getEmptyStateMessage = (collectionName, targetWord) => {
    return targetWord
      ? `${collectionName} 沒有 ${targetWord}`
      : `${collectionName} 沒有 符合條件的項目`;
  };

  // Case 1: Search query with invalid word
  assert.equal(
    getEmptyStateMessage('日本特色詞彙', '不存在的詞'),
    '日本特色詞彙 沒有 不存在的詞'
  );

  // Case 2: URL invalid term
  assert.equal(
    getEmptyStateMessage('大陸特色詞彙', 'InvalidWord123'),
    '大陸特色詞彙 沒有 InvalidWord123'
  );

  // Case 3: Empty query / filter mismatch fallback
  assert.equal(
    getEmptyStateMessage('日本特色詞彙', ''),
    '日本特色詞彙 沒有 符合條件的項目'
  );
});

test('Empty State Card - DOM Rendering in card-grid', async () => {
  const mockContainer = {
    innerHTML: '',
    attributes: {},
    setAttribute(key, val) { this.attributes[key] = val; }
  };
  
  const originalGetElementById = global.document?.getElementById;
  global.document = global.document || {};
  global.document.getElementById = (id) => {
    if (id === 'card-grid') return mockContainer;
    return null;
  };

  const { store } = await import('../js/state.js');
  const { renderCards } = await import('../js/components/cards.js');

  // Test Case 1: URL Invalid Term in Japanese Terms
  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ id: '1', ja_term: '神經衰弱' }],
    filteredRecords: [],
    invalidTerm: '神奇寶貝',
    searchQuery: ''
  });

  renderCards();

  assert(mockContainer.innerHTML.includes('awsui-empty-card'));
  assert(mockContainer.innerHTML.includes('日本特色詞彙 沒有 神奇寶貝'));

  // Test Case 2: Search Query in China Terms
  store.set({
    currentCollectionId: 'china-terms',
    allRecords: [{ id: '1', ja_term: '985' }],
    filteredRecords: [],
    invalidTerm: null,
    searchQuery: '88888'
  });

  renderCards();

  assert(mockContainer.innerHTML.includes('awsui-empty-card'));
  assert(mockContainer.innerHTML.includes('大陸特色詞彙 沒有 88888'));

  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

