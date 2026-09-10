import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load local fallback data snapshot
const dataJson = JSON.parse(readFileSync(resolve('data.json'), 'utf-8'));

test('Local Fallback Snapshot Integrity - Japanese Terms', () => {
  assert(Array.isArray(dataJson));
  assert(dataJson.length > 0);
  const sample = dataJson[0];
  assert('ja_term' in sample);
  assert('tw_translation' in sample);
  assert('reading' in sample);
});

test('Router & View Switcher - View Routing & Maintenance Handling', async () => {
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

  // Test "調整中" status routing
  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '調整中' };
  store.set({ currentCollectionId: 'japanese-terms' });
  switchView('dictionary', null, false);

  assert.equal(mockTitleEl.innerText, 'ADJUSTING');
  assert.equal(mockViewMaintEl.style.display, 'block');

  // Test "籌備中" status routing
  collectionsMetaCache['korean-terms'] = { title: '最強韓文漢字學習法', status: '籌備中' };
  store.set({ currentCollectionId: 'korean-terms' });
  switchView('dictionary', null, false);

  assert.equal(mockTitleEl.innerText, 'COMING SOON');
  assert.equal(mockViewMaintEl.style.display, 'block');

  setOpeningHoursSchedule(originalSchedule);
  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

test('UI Components - Sidebar Badge Display Logic', async () => {
  const mockBadgeEl = { innerText: '', style: { display: 'inline-block' } };
  const originalGetElementById = global.document?.getElementById;
  global.document = global.document || {};
  global.document.getElementById = (id) => {
    if (id === 'side-nav-count-japanese-terms' || id === 'side-nav-count-korean-terms') return mockBadgeEl;
    return null;
  };

  const { collectionsMetaCache } = await import('../js/data.js');
  const { updateSidebarBadge } = await import('../js/components/sidebar.js');

  // Case 1: Normal open status
  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '開放中' };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadgeEl.style.display, 'none');

  // Case 2: Adjusting status
  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '調整中' };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadgeEl.innerText, 'ADJUSTING');
  assert.equal(mockBadgeEl.style.display, 'inline-block');

  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

test('UI Components - Empty State & Card Rendering', async () => {
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

  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

test('Scroll Prevention on Modal Open or Hash Sync', () => {
  let scrollCalled = false;
  const mockWindow = {
    scrollTo: () => { scrollCalled = true; }
  };

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

  assert.equal(checkScrollCondition('dictionary', null), false);
  assert.equal(checkScrollCondition('welcome', null), true);
  assert.equal(checkScrollCondition('welcome', { type: 'click' }), true);
});

test('Welcome Card Title Click Handler Integration - Japanese Terms Title Click', () => {
  const htmlContent = readFileSync(resolve('index.html'), 'utf-8');
  assert(htmlContent.includes('id="welcome-card-title-japanese-terms"'));
  assert(htmlContent.includes('onclick="switchCollection(\'japanese-terms\')"'));
});

test('Modal Sizing - Japanese Meaning Text Exceeding 5 Lines Triggers Large Modal', async () => {
  const mockClasses = new Set();
  const mockModalBox = {
    classList: {
      add: (cls) => mockClasses.add(cls),
      remove: (cls) => mockClasses.delete(cls),
      contains: (cls) => mockClasses.has(cls)
    }
  };

  const mockModal = {
    classList: { add: () => {}, remove: () => {} },
    querySelector: (sel) => sel === '.awsui-modal' ? mockModalBox : null
  };

  let meaningScrollHeight = 100;
  let meaningClientHeight = 100;
  const mockMeaningElem = {
    innerText: '',
    get scrollHeight() { return meaningScrollHeight; },
    get clientHeight() { return meaningClientHeight; },
    dataset: {}
  };

  const mockTitleElem = { innerText: '', setAttribute: (k, v) => { mockTitleElem[k] = v; }, getAttribute: (k) => mockTitleElem[k] };
  const mockReadingElem = { innerText: '', setAttribute: () => {} };
  const mockReadingSection = { style: {} };

  const originalGetElementById = global.document?.getElementById;
  global.document = global.document || {};
  global.document.getElementById = (id) => {
    if (id === 'detail-modal') return mockModal;
    if (id === 'modal-meaning-text') return mockMeaningElem;
    if (id === 'modal-term-title') return mockTitleElem;
    if (id === 'modal-reading-row') return mockReadingElem;
    if (id === 'modal-reading-section') return mockReadingSection;
    return { innerText: '', setAttribute: () => {}, style: {} };
  };

  const { store } = await import('../js/state.js');
  const { openMeaningModal, checkMeaningExceedsFiveLines } = await import('../js/components/modal.js');

  assert.equal(checkMeaningExceedsFiveLines('1\n2\n3\n4'), false);
  assert.equal(checkMeaningExceedsFiveLines('1\n2\n3\n4\n5\n6'), true);

  // Case 1: Japanese term <= 5 lines -> small modal
  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 1, ja_term: '測試', tw_translation: '1\n2\n3\n4' }]
  });
  meaningScrollHeight = 100;
  meaningClientHeight = 100;
  mockClasses.clear();
  openMeaningModal(1, false);
  assert(mockClasses.has('awsui-modal-sm'));
  assert(!mockClasses.has('awsui-modal-lg'));

  // Case 2: Japanese term > 5 lines -> upgraded to large modal
  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 2, ja_term: '測試', tw_translation: '1\n2\n3\n4\n5\n6' }]
  });
  meaningScrollHeight = 200;
  meaningClientHeight = 100;
  mockClasses.clear();
  openMeaningModal(2, false);
  assert(mockClasses.has('awsui-modal-lg'));
  assert(!mockClasses.has('awsui-modal-sm'));

  if (originalGetElementById) {
    global.document.getElementById = originalGetElementById;
  }
});

