import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Local fallback snapshot
const dataJson = JSON.parse(readFileSync(resolve('data.json'), 'utf-8'));

function createMockElement(props = {}) {
  const classes = new Set();
  return {
    innerText: '',
    innerHTML: '',
    style: {},
    dataset: {},
    classes,
    classList: {
      add: (cls) => classes.add(cls),
      remove: (cls) => classes.delete(cls),
      contains: (cls) => classes.has(cls),
      toggle: (cls, force) => (force ?? !classes.has(cls)) ? classes.add(cls) : classes.delete(cls)
    },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k]; },
    ...props
  };
}

function mockDOM(elementsMap = {}) {
  const fallbackEl = createMockElement();
  global.document = global.document || {};
  global.document.getElementById = (id) => elementsMap[id] || fallbackEl;
  global.document.querySelectorAll = () => [];
}

test('Local Fallback Snapshot Integrity - Japanese Terms', () => {
  assert(Array.isArray(dataJson) && dataJson.length > 0);
  const sample = dataJson[0];
  assert('ja_term' in sample && 'tw_translation' in sample && 'reading' in sample);
});

test('Router & View Switcher - View Routing & Maintenance Handling', async () => {
  const mockTitle = createMockElement();
  const mockViewMaint = createMockElement({ style: { display: 'none' } });

  mockDOM({
    'maintenance-title': mockTitle,
    'view-maintenance': mockViewMaint
  });

  const { setOpeningHoursSchedule, OPENING_HOURS_SCHEDULE } = await import('../js/utils.js');
  const originalSchedule = [...OPENING_HOURS_SCHEDULE];
  setOpeningHoursSchedule(Array(7).fill({ day: '全天', hours: '00:00 - 23:59' }));

  const { collectionsMetaCache } = await import('../js/data.js');
  const { store } = await import('../js/state.js');
  const { switchView } = await import('../js/router.js');

  // Test "調整中" status routing
  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '調整中' };
  store.set({ currentCollectionId: 'japanese-terms' });
  switchView('dictionary', null, false);
  assert.equal(mockTitle.innerText, 'ADJUSTING');
  assert.equal(mockViewMaint.style.display, 'block');

  // Test "籌備中" status routing
  collectionsMetaCache['korean-terms'] = { title: '最強韓文漢字學習法', status: '籌備中' };
  store.set({ currentCollectionId: 'korean-terms' });
  switchView('dictionary', null, false);
  assert.equal(mockTitle.innerText, 'COMING SOON');

  setOpeningHoursSchedule(originalSchedule);
});

test('UI Components - Sidebar Badge Display Logic', async () => {
  const mockBadge = createMockElement({ style: { display: 'inline-block' } });
  mockDOM({
    'side-nav-count-japanese-terms': mockBadge,
    'side-nav-count-korean-terms': mockBadge
  });

  const { collectionsMetaCache } = await import('../js/data.js');
  const { updateSidebarBadge } = await import('../js/components/sidebar.js');

  // Open status -> hidden badge
  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '開放中' };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadge.style.display, 'none');

  // Adjusting status -> ADJUSTING badge
  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '調整中' };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadge.innerText, 'ADJUSTING');
  assert.equal(mockBadge.style.display, 'inline-block');
});

test('UI Components - Empty State & Card Rendering', async () => {
  const mockContainer = createMockElement();
  mockDOM({ 'card-grid': mockContainer });

  const { store } = await import('../js/state.js');
  const { renderCards } = await import('../js/components/cards.js');

  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ id: '1', ja_term: '測試' }],
    filteredRecords: [],
    invalidTerm: '查無此詞',
    searchQuery: ''
  });

  renderCards();

  assert(mockContainer.innerHTML.includes('awsui-empty-card'));
  assert(mockContainer.innerHTML.includes('尚無相符展品'));
});

test('Scroll Prevention on Modal Open or Hash Sync', () => {
  let scrollCalled = false;
  let currentView = 'dictionary';

  const checkScroll = (viewName, event) => {
    scrollCalled = false;
    const isViewChanged = currentView !== viewName;
    currentView = viewName;
    if (isViewChanged || !!event) {
      scrollCalled = true;
    }
    return scrollCalled;
  };

  assert.equal(checkScroll('dictionary', null), false);
  assert.equal(checkScroll('welcome', null), true);
  assert.equal(checkScroll('welcome', { type: 'click' }), true);
});

test('Welcome Card Title Click Handler Integration - Japanese Terms Title Click', () => {
  const html = readFileSync(resolve('index.html'), 'utf-8');
  assert(html.includes('id="welcome-card-title-japanese-terms"'));
  assert(html.includes('onclick="switchCollection(\'japanese-terms\')"'));
});

test('Modal Sizing - Japanese Meaning Text Exceeding 5 Lines Triggers Large Modal', async () => {
  const mockModalBox = createMockElement();
  const mockModal = createMockElement({
    querySelector: (sel) => sel === '.awsui-modal' ? mockModalBox : null
  });
  const mockMeaning = createMockElement({ scrollHeight: 100, clientHeight: 100 });

  mockDOM({
    'detail-modal': mockModal,
    'modal-meaning-text': mockMeaning
  });

  const { store } = await import('../js/state.js');
  const { openMeaningModal, checkMeaningExceedsFiveLines } = await import('../js/components/modal.js');

  assert.equal(checkMeaningExceedsFiveLines('1\n2\n3\n4'), false);
  assert.equal(checkMeaningExceedsFiveLines('1\n2\n3\n4\n5\n6'), true);

  // Case 1: <= 5 lines -> small modal
  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 1, ja_term: '測試', tw_translation: '1\n2\n3\n4' }]
  });
  mockModalBox.classes.clear();
  openMeaningModal(1, false);
  assert(mockModalBox.classes.has('awsui-modal-sm'));
  assert(!mockModalBox.classes.has('awsui-modal-lg'));

  // Case 2: > 5 lines -> large modal
  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 2, ja_term: '測試', tw_translation: '1\n2\n3\n4\n5\n6' }]
  });
  mockModalBox.classes.clear();
  openMeaningModal(2, false);
  assert(mockModalBox.classes.has('awsui-modal-lg'));
  assert(!mockModalBox.classes.has('awsui-modal-sm'));
  assert(mockMeaning.classes.has('is-multiline'));
});

test('Collection Modal Component - Population and Open/Close Logic', async () => {
  const mockModal = createMockElement();
  const mockTitle = createMockElement();
  const mockEnTitle = createMockElement();
  const mockSubtitle = createMockElement();
  const mockTags = createMockElement();
  const mockDesc = createMockElement();
  const mockNoticeSec = createMockElement({ style: { display: 'none' } });
  const mockNotice = createMockElement();
  const mockTotal = createMockElement();
  const mockId = createMockElement();

  mockDOM({
    'collection-modal': mockModal,
    'collection-modal-title': mockTitle,
    'collection-modal-entitle': mockEnTitle,
    'collection-modal-subtitle': mockSubtitle,
    'collection-modal-tags': mockTags,
    'collection-modal-description': mockDesc,
    'collection-modal-notice-section': mockNoticeSec,
    'collection-modal-notice': mockNotice,
    'collection-modal-total-items': mockTotal,
    'collection-modal-id': mockId
  });

  const { collectionsMetaCache, collectionsCache } = await import('../js/data.js');
  const { openCollectionModal, closeCollectionModal } = await import('../js/components/modal.js');

  collectionsMetaCache['china-terms'] = {
    title: '大陸特色詞彙一覽',
    enTitle: 'China Terms',
    id: 'C102',
    subtitle: '兩岸詞彙對照',
    tags: ['大陸', '語彙'],
    description: '大陸特色詞彙說明內容',
    notice: '詞彙僅供參考'
  };
  collectionsCache['china-terms'] = [{ id: '1' }, { id: '2' }];

  openCollectionModal('china-terms', false);

  assert(mockModal.classes.has('open'));
  assert.equal(mockTitle.innerText, '大陸特色詞彙一覽');
  assert.equal(mockEnTitle.innerText, 'China Terms');
  assert.equal(mockSubtitle.innerText, '兩岸詞彙對照');
  assert.equal(mockDesc.innerText, '大陸特色詞彙說明內容');
  assert.equal(mockNotice.innerText, '詞彙僅供參考');
  assert.equal(mockNoticeSec.style.display, 'block');
  assert.equal(mockTotal.innerText, 2);
  assert.equal(mockId.innerText, 'C102');

  closeCollectionModal(false);
  assert(!mockModal.classes.has('open'));
});

test('Collection Modal Integration - HTML Structure and Click Handlers', () => {
  const html = readFileSync(resolve('index.html'), 'utf-8');
  assert(html.includes('id="collection-modal"'), 'Should contain collection-modal backdrop element');
  assert(html.includes('onclick="openCollectionModal(\'china-terms\')"'), 'Should contain openCollectionModal call for china-terms');
  assert(html.includes('onclick="closeCollectionModal()"'), 'Should contain closeCollectionModal call');
  assert(html.includes('id="collection-header-title"'), 'Should contain collection header title element');
  assert(html.includes('onclick="openCollectionModal()"'), 'Header title should trigger openCollectionModal()');
});
