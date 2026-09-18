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
    querySelector: () => null,
    querySelectorAll: () => [],
    ...props
  };
}

function mockDOM(elementsMap = {}) {
  const fallbackEl = createMockElement();
  global.document = global.document || {};
  global.document.getElementById = (id) => elementsMap[id] || fallbackEl;
  global.document.querySelector = (sel) => {
    if (typeof sel === 'string') {
      if (sel.startsWith('#')) {
        return elementsMap[sel.slice(1)] || fallbackEl;
      }
      if (sel === '.awsui-side-navigation') {
        return elementsMap['side-navigation'] || fallbackEl;
      }
    }
    return elementsMap[sel] || fallbackEl;
  };
  global.document.querySelectorAll = () => [];
}

test('Local Fallback Snapshot Integrity - Japanese Terms', () => {
  assert(Array.isArray(dataJson) && dataJson.length > 0);
  const sample = dataJson[0];
  assert('ja_term' in sample && 'tw_translation' in sample && 'reading' in sample);
});

test('Local Fallback Snapshot Integrity - Korean Terms', () => {
  const koreanJson = JSON.parse(readFileSync(resolve('korean-data.json'), 'utf-8'));
  assert(Array.isArray(koreanJson) && koreanJson.length > 0);
  const sample = koreanJson[0];
  assert('ja_term' in sample && 'tw_translation' in sample && 'reading' in sample);
  assert.match(sample.ja_term, /\|/);
  assert.notEqual(sample.ja_term, sample.reading);
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
    'side-nav-count-china-terms': mockBadge,
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

  // No live meta yet (even if defaultMeta is 調整中) -> treat as open
  delete collectionsMetaCache['china-terms'];
  mockBadge.innerText = 'ADJUSTING';
  mockBadge.style.display = 'inline-block';
  updateSidebarBadge('china-terms');
  assert.equal(mockBadge.innerText, '');
  assert.equal(mockBadge.style.display, 'none');
});

test('UI Components - Mobile Sidebar Outside Click & Auto-Collapse Logic', async () => {
  const mockWrapper = createMockElement();
  mockWrapper.classList.add('sidebar-open');
  const mockSidebar = createMockElement();
  const mockToggleBtn = createMockElement();

  mockSidebar.contains = (target) => target === mockSidebar;
  mockToggleBtn.contains = (target) => target === mockToggleBtn;

  mockDOM({
    'app-layout-wrapper': mockWrapper,
    'side-navigation': mockSidebar,
    'btn-toggle-sidebar': mockToggleBtn
  });

  const { closeSidebarOnMobile, initSidebarOutsideClick } = await import('../js/components/sidebar.js');

  // Simulate mobile window width <= 768
  const originalInnerWidth = global.innerWidth;
  global.innerWidth = 393;

  // 1. Explicit closeSidebarOnMobile
  closeSidebarOnMobile();
  assert(mockWrapper.classList.contains('sidebar-collapsed'));
  assert(!mockWrapper.classList.contains('sidebar-open'));

  // Reset to open
  mockWrapper.classList.add('sidebar-open');
  mockWrapper.classList.remove('sidebar-collapsed');

  // 2. Simulate outside click event handler
  let clickHandler = null;
  const originalAddEventListener = global.document.addEventListener;
  global.document.addEventListener = (event, listener) => {
    if (event === 'click') clickHandler = listener;
  };

  initSidebarOutsideClick();
  assert.equal(typeof clickHandler, 'function');

  // Click inside sidebar -> should NOT close
  clickHandler({ target: mockSidebar });
  assert(mockWrapper.classList.contains('sidebar-open'));

  // Click on toggle button -> should NOT close via listener
  clickHandler({ target: mockToggleBtn });
  assert(mockWrapper.classList.contains('sidebar-open'));

  // Click outside sidebar -> SHOULD close
  const mockOutsideElem = createMockElement();
  clickHandler({ target: mockOutsideElem });
  assert(mockWrapper.classList.contains('sidebar-collapsed'));
  assert(!mockWrapper.classList.contains('sidebar-open'));

  global.innerWidth = originalInnerWidth;
  global.document.addEventListener = originalAddEventListener;
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

test('Collection Modal Component - Population and Open/Close Logic', async () => {
  const mockModal = createMockElement();
  const mockTitle = createMockElement();
  const mockEnTitle = createMockElement();
  const mockDesc = createMockElement();
  const mockTotal = createMockElement();
  const mockCreatedAt = createMockElement();
  const mockId = createMockElement();
  const mockHeaderTitle = createMockElement();

  mockDOM({
    'collection-modal': mockModal,
    'collection-modal-title': mockTitle,
    'collection-modal-entitle': mockEnTitle,
    'collection-modal-description': mockDesc,
    'collection-modal-total-items': mockTotal,
    'collection-modal-created-at': mockCreatedAt,
    'collection-modal-id': mockId,
    'collection-header-title': mockHeaderTitle
  });

  const { collectionsMetaCache, collectionsCache } = await import('../js/data.js');
  const { openCollectionModal, closeCollectionModal } = await import('../js/components/modal.js');

  collectionsMetaCache['china-terms'] = {
    title: '大陸特色詞彙一覽',
    enTitle: 'China Terms',
    id: 'C102',
    tags: ['大陸', '語彙'],
    description: '大陸特色詞彙說明內容\n第二行說明\n第三行說明',
    notice: '詞彙僅供參考',
    timestamp: '2026-09-04'
  };
  collectionsCache['china-terms'] = [{ id: '1' }, { id: '2' }];

  openCollectionModal('china-terms', false);

  assert(mockModal.classes.has('open'));
  assert(mockHeaderTitle.classes.has('active'), 'collection-header-title should have active class when collection modal opens');
  assert.equal(mockTitle.innerText, '大陸特色詞彙一覽');
  assert.equal(mockEnTitle.innerText, 'China Terms');
  assert.equal(mockDesc.innerText, '大陸特色詞彙說明內容\n第二行說明\n第三行說明');
  assert(mockDesc.classes.has('is-multiline'), 'Collection modal description should have is-multiline class for background color block');
  assert.equal(mockTotal.innerText, 2);
  assert.equal(mockCreatedAt.innerText, '2026-09-04');
  assert.equal(mockId.innerText, 'C102');

  closeCollectionModal(false);
  assert(!mockModal.classes.has('open'));
  assert(!mockHeaderTitle.classes.has('active'), 'collection-header-title should remove active class when collection modal closes');

  // Test fallback to defaultMeta for korean-terms
  delete collectionsMetaCache['korean-terms'];
  openCollectionModal('korean-terms', false);
  assert(mockModal.classes.has('open'));
  assert.equal(mockTitle.innerText, '韓文單字加漢字 記憶更輕鬆');
  assert.equal(mockEnTitle.innerText, 'Korean Terms');
  assert.equal(mockCreatedAt.innerText, '2026-09-04');
  assert.equal(mockId.innerText, 'C103');

  closeCollectionModal(false);
  assert(!mockModal.classes.has('open'));
});

test('Description Modal Component & Interaction Logic', async () => {
  const mockDescModal = createMockElement();
  const mockDescText = createMockElement();
  const mockMeaning = createMockElement({ clientHeight: 100, scrollHeight: 200, 'data-row-index': '1' });
  mockMeaning.classList.add('has-scroll');
  const mockColDesc = createMockElement({ innerText: '展廳詳細介紹說明內容' });

  mockDOM({
    'description-modal': mockDescModal,
    'description-modal-text': mockDescText,
    'modal-meaning-text': mockMeaning,
    'collection-modal-description': mockColDesc
  });

  const { store } = await import('../js/state.js');
  const { openDescriptionModal, closeDescriptionModal, handleMeaningTextClick, handleCollectionDescriptionClick } = await import('../js/components/modal.js');

  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 1, ja_term: '測試詞彙', reading: 'チェシー', tw_translation: '測試詳細說明內容', created_at: '2024-01-01', id: 'J101' }]
  });

  // Test opening Description Modal directly
  openDescriptionModal(1, false);
  assert(mockDescModal.classes.has('open'));
  assert.equal(mockDescText.innerText, '測試詳細說明內容');

  closeDescriptionModal(false);
  assert(!mockDescModal.classes.has('open'));

  // Test handleMeaningTextClick (with scroll)
  handleMeaningTextClick();
  assert(mockDescModal.classes.has('open'));

  // Test handleMeaningTextClick without scroll (unconditional double-click)
  closeDescriptionModal(false);
  assert(!mockDescModal.classes.has('open'));
  mockMeaning.classList.remove('has-scroll');
  mockMeaning.clientHeight = 200;
  mockMeaning.scrollHeight = 100;
  handleMeaningTextClick();
  assert(mockDescModal.classes.has('open'), 'handleMeaningTextClick should open Description modal even without scroll');

  // Test Collection Modal double-click opens Description Modal
  closeDescriptionModal(false);
  assert(!mockDescModal.classes.has('open'));
  handleCollectionDescriptionClick();
  assert(mockDescModal.classes.has('open'), 'handleCollectionDescriptionClick should open Description modal');
  assert.equal(mockDescText.innerText, '展廳詳細介紹說明內容');
});

test('C103 Item Modal hides Pronunciation while C101 still shows it', async () => {
  const mockReadingSection = createMockElement({ style: { display: 'none' } });
  const mockReadingRow = createMockElement();
  const mockMeaning = createMockElement();
  const mockModal = createMockElement();

  mockDOM({
    'detail-modal': mockModal,
    'modal-meaning-text': mockMeaning,
    'modal-reading-section': mockReadingSection,
    'modal-reading-row': mockReadingRow
  });

  const { store } = await import('../js/state.js');
  const { openMeaningModal } = await import('../js/components/modal.js');

  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 1, ja_term: '神経衰弱', reading: 'しんけいすいじゃく', tw_translation: '神經衰弱' }]
  });
  openMeaningModal(1, false);
  assert.equal(mockReadingRow.innerText, 'しんけいすいじゃく');
  assert.equal(mockReadingSection.style.display, 'block');

  store.set({
    currentCollectionId: 'korean-terms',
    allRecords: [{ row_index: 1, ja_term: '가능 | 可能', reading: '가능', tw_translation: '可能' }]
  });
  openMeaningModal(1, false);
  assert.equal(mockReadingRow.innerText, '');
  assert.equal(mockReadingSection.style.display, 'none');
});

test('Card Active State - Toggle Active Class on Open/Close Modal', async () => {
  const card1 = createMockElement({ 'data-row-index': '1' });
  const card2 = createMockElement({ 'data-row-index': '2' });
  const mockModal = createMockElement();
  const mockMeaning = createMockElement({ 'data-row-index': '1' });

  mockDOM({
    'detail-modal': mockModal,
    'modal-meaning-text': mockMeaning
  });

  global.document.querySelectorAll = (sel) => {
    if (sel === '.awsui-card') return [card1, card2];
    return [];
  };

  const { store } = await import('../js/state.js');
  const { openMeaningModal, closeDetailModal } = await import('../js/components/modal.js');

  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [
      { row_index: 1, ja_term: '詞彙一', tw_translation: '說明一' },
      { row_index: 2, ja_term: '詞彙二', tw_translation: '說明二' }
    ],
    filteredRecords: [
      { row_index: 1, ja_term: '詞彙一', tw_translation: '說明一' },
      { row_index: 2, ja_term: '詞彙二', tw_translation: '說明二' }
    ],
    currentPage: 1,
    pageSize: 12,
    invalidTerm: null
  });

  // Test 1: openMeaningModal activates matching card
  openMeaningModal(1, false);
  assert.equal(card1.classList.contains('active'), true, 'Card 1 should be active');
  assert.equal(card2.classList.contains('active'), false, 'Card 2 should not be active');

  // Test 2: openMeaningModal switches active card
  openMeaningModal(2, false);
  assert.equal(card1.classList.contains('active'), false, 'Card 1 should no longer be active');
  assert.equal(card2.classList.contains('active'), true, 'Card 2 should now be active');

  // Test 3: closeDetailModal removes active from all cards
  closeDetailModal(false);
  assert.equal(card1.classList.contains('active'), false, 'Card 1 should not be active after close');
  assert.equal(card2.classList.contains('active'), false, 'Card 2 should not be active after close');

});

