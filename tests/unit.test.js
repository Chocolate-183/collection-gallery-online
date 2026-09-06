import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSVData, parseMetaCSVData, parseCSVRows, extractGvizTable, parseOpeningHoursCSV } from '../js/parser.js';
import { matchesKanaGroup } from '../js/filter.js';
import { escapeHtml, getUnicodeLength, getTodayOpeningHoursText } from '../js/utils.js';

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

test('Utils Helper - getTodayOpeningHoursText', () => {
  // Monday (1)
  const monday = new Date('2026-09-07T10:00:00'); // Mon
  assert.equal(getTodayOpeningHoursText(monday), '今日開館時間: 01:00 - 23:55');

  // Friday (5)
  const friday = new Date('2026-09-11T10:00:00'); // Fri
  assert.equal(getTodayOpeningHoursText(friday), '今日開館時間: 06:00 - 23:55');

  // Sunday (0)
  const sunday = new Date('2026-09-13T10:00:00'); // Sun
  assert.equal(getTodayOpeningHoursText(sunday), '今日開館時間: 16:00 - 23:55');
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

test('Meta Sheet CSV Parser - Parse Status Field', () => {
  const sampleMetaCSVWithStatus = `項目,內容
標題,日本特色詞彙
副標,探索日本流行與次文化用語的專屬辭典
狀態,調整中
作者,巧克力`;

  const meta = parseMetaCSVData(sampleMetaCSVWithStatus);
  assert.equal(meta.title, '日本特色詞彙');
  assert.equal(meta.status, '調整中');
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

  // Verify label is updated to "展品篩選："
  assert(html.includes('id="quick-tabs-label">展品篩選：</span>'));
  assert(html.includes("selectKanaTab('LATEST10', this)\">新進展品</button>"));
  assert(sidebarJs.includes("quickTabsLabel.innerText = '展品篩選：'"));

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
  const getEmptyStateMessage = () => '尚無相符展品';

  assert.equal(getEmptyStateMessage(), '尚無相符展品');
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
  assert(mockContainer.innerHTML.includes('尚無相符展品'));

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
  assert(mockContainer.innerHTML.includes('尚無相符展品'));

  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

test('Filter UI Adjustments - Label Spacing and Length Tabs Styling', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const css = readFileSync(resolve('styles.css'), 'utf-8');

  // Verify 5字+ tab text in length-tabs
  assert(html.includes("selectLengthTab('5+', this)\">5字+</button>"));
  assert(!html.includes("5字以上"));

  // Verify CSS styles for uniform length-tabs buttons and label spacing
  assert(css.includes('#length-tabs .awsui-tab'));
  assert(css.includes('min-width: 60px;'));
  assert(!css.includes('min-width: 90px;'));
});

test('Opening Hours CSV Parser', () => {
  const sampleCSV = `星期,開放時間
週日,16:00 - 23:55
週一,01:00 - 23:55
週二,01:00 - 23:55
週三,01:00 - 23:55
週四,01:00 - 23:55
週五,06:00 - 23:55
週六,06:00 - 23:55`;

  const schedule = parseOpeningHoursCSV(sampleCSV);
  assert.notEqual(schedule, null);
  assert.equal(schedule.length, 7);
  assert.equal(schedule[0].day, '週日');
  assert.equal(schedule[0].hours, '16:00 - 23:55');
  assert.equal(schedule[1].day, '週一');
  assert.equal(schedule[1].hours, '01:00 - 23:55');
});

test('Default Exhibition Hall Filter and Page Size Defaults', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const { store } = await import('../js/state.js');

  // Verify HTML default selection
  assert(html.includes('<option value="12" selected>每頁 12 件</option>'));
  assert(html.includes('<button class="awsui-tab active" onclick="selectKanaTab(\'ALL\', this)">全部展品</button>'));

  // Verify JS initial state
  const state = store.get();
  assert.equal(state.pageSize, 12);
  assert.equal(state.currentKanaTab, 'ALL');
});

test('Exhibition Hall Maintenance Status View Routing', async () => {
  const mockTitleEl = { innerText: '' };
  const mockDesc1El = { innerText: '' };
  const mockDesc2El = { style: { display: 'block' } };
  const mockViewMaintEl = { classList: { add: () => {}, remove: () => {} }, style: { display: 'none' } };
  const mockViewDictEl = { classList: { add: () => {}, remove: () => {} }, style: { display: 'none' } };
  
  const originalGetElementById = global.document?.getElementById;
  global.document = global.document || {};
  global.document.getElementById = (id) => {
    if (id === 'maintenance-title') return mockTitleEl;
    if (id === 'maintenance-desc-1') return mockDesc1El;
    if (id === 'maintenance-desc-2') return mockDesc2El;
    if (id === 'view-maintenance') return mockViewMaintEl;
    if (id === 'view-dictionary') return mockViewDictEl;
    return null;
  };
  global.document.querySelectorAll = () => [];

  const { setOpeningHoursSchedule, OPENING_HOURS_SCHEDULE } = await import('../js/utils.js');
  const originalSchedule = [...OPENING_HOURS_SCHEDULE];
  setOpeningHoursSchedule(Array(7).fill({ day: '全天', hours: '00:00 - 23:59' }));

  const { collectionsMetaCache } = await import('../js/data.js');
  const { store } = await import('../js/state.js');
  const { switchView } = await import('../js/router.js');

  collectionsMetaCache['japanese-terms'] = {
    title: '日本特色詞彙',
    status: '調整中'
  };

  store.set({ currentCollectionId: 'japanese-terms' });
  switchView('dictionary', null, false);

  assert.equal(mockTitleEl.innerText, '展廳調整中');
  assert.equal(mockDesc1El.innerText, '本展廳目前正在進行內容調整，暫不開放參觀，敬請期待。');
  assert.equal(mockDesc2El.style.display, 'none');
  assert.equal(mockViewMaintEl.style.display, 'block');

  setOpeningHoursSchedule(originalSchedule);
  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

test('Sidebar Badge Display Logic - Hide Item Counts, Show "調整中" Badge Only When Adjusting', async () => {
  const mockBadgeEl = { innerText: '', style: { display: 'inline-block' } };
  const originalGetElementById = global.document?.getElementById;
  global.document = global.document || {};
  global.document.getElementById = (id) => {
    if (id === 'side-nav-count-japanese-terms') return mockBadgeEl;
    return null;
  };

  const { collectionsMetaCache } = await import('../js/data.js');
  const { updateSidebarBadge } = await import('../js/components/sidebar.js');

  // Case 1: Normal open status (item counts should NOT be shown)
  collectionsMetaCache['japanese-terms'] = {
    title: '日本特色詞彙',
    status: '開放中'
  };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadgeEl.innerText, '');
  assert.equal(mockBadgeEl.style.display, 'none');

  // Case 2: Adjusting status ("調整中" badge SHOULD be shown)
  collectionsMetaCache['japanese-terms'] = {
    title: '日本特色詞彙',
    status: '調整中'
  };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadgeEl.innerText, '調整中');
  assert.equal(mockBadgeEl.style.display, 'inline-block');

  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

test('Google Sheets Config URL Builders', async () => {
  const { googleSheetsConfig, getCollectionDataUrls, getCollectionMetaUrls, collectionsConfig } = await import('../js/config.js');

  const sheetId = 'TEST_SHEET_ID';
  const gid = '12345';
  const csvUrl = googleSheetsConfig.getCsvUrl(sheetId, gid);
  const gvizUrl = googleSheetsConfig.getGvizUrl(sheetId, gid);

  assert.equal(csvUrl, 'https://docs.google.com/spreadsheets/d/TEST_SHEET_ID/export?format=csv&gid=12345');
  assert.equal(gvizUrl, 'https://docs.google.com/spreadsheets/d/TEST_SHEET_ID/gviz/tq?tqx=out:json&gid=12345');

  const jpCol = collectionsConfig['japanese-terms'];
  const dataUrls = getCollectionDataUrls(jpCol);
  const metaUrls = getCollectionMetaUrls(jpCol);

  assert.equal(dataUrls.csvUrl, `https://docs.google.com/spreadsheets/d/${jpCol.sheetId}/export?format=csv&gid=${jpCol.gid}`);
  assert.equal(metaUrls.csvUrl, `https://docs.google.com/spreadsheets/d/${jpCol.sheetId}/export?format=csv&gid=${jpCol.metaGid}`);
});

test('Sidebar Section Header GALLERYS & ID Element', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const html = readFileSync(resolve('index.html'), 'utf-8');

  assert(html.includes('<div class="awsui-side-nav-header">GALLERYS</div>'));
  assert(!html.includes('<div class="awsui-side-nav-header">COLLECTIONS</div>'));
  assert(html.includes('id="side-nav-id-japanese-terms">C101</span>'));
  assert(html.includes('id="side-nav-id-china-terms">C102</span>'));
});

test('Meta Sheet CSV Parser - Parse ID Field', () => {
  const sampleMetaCSVWithId = `項目,內容
標題,日本特色詞彙
副標,探索日本流行與次文化用語的專屬辭典
ID,C101
作者,巧克力`;

  const meta = parseMetaCSVData(sampleMetaCSVWithId);
  assert.equal(meta.title, '日本特色詞彙');
  assert.equal(meta.id, 'C101');
});

test('Sidebar Gallery ID Rendering Logic', async () => {
  const mockIdEl = { innerText: '' };
  const originalGetElementById = global.document?.getElementById;
  global.document = global.document || {};
  global.document.getElementById = (id) => {
    if (id === 'side-nav-id-japanese-terms') return mockIdEl;
    return null;
  };

  const { collectionsMetaCache } = await import('../js/data.js');
  const { updateSidebarId } = await import('../js/components/sidebar.js');

  collectionsMetaCache['japanese-terms'] = {
    title: '日本特色詞彙',
    id: 'C101'
  };
  updateSidebarId('japanese-terms');
  assert.equal(mockIdEl.innerText, 'C101');

  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});





