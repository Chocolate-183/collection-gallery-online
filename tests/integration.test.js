import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Local fallback snapshot
const dataJson = JSON.parse(readFileSync(resolve('data.json'), 'utf-8'));

function createMockElement(props = {}) {
  const classes = new Set();
  const el = {
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
    appendChild() { return this; },
    ...props
  };
  return el;
}

function mockDOM(elementsMap = {}) {
  const fallbackEl = createMockElement();
  global.document = global.document || {};
  global.document.createElement = () => createMockElement();
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
  assert(Array.isArray(dataJson) && dataJson.length > 12);
  const sample = dataJson[0];
  assert('ja_term' in sample && 'tw_translation' in sample && 'reading' in sample);
});

test('Local Fallback Snapshot Integrity - Decoding Simplified Chinese: The Ultimate Guide', () => {
  const chinaJson = JSON.parse(readFileSync(resolve('china-data.json'), 'utf-8'));
  assert(Array.isArray(chinaJson) && chinaJson.length > 12);
  const sample = chinaJson[0];
  assert('ja_term' in sample && 'tw_translation' in sample);
});

test('Local Fallback Snapshot Integrity - Master Korean Vocabulary Fast: The Ultimate Cheat Sheet', () => {
  const koreanJson = JSON.parse(readFileSync(resolve('korean-data.json'), 'utf-8'));
  assert(Array.isArray(koreanJson) && koreanJson.length > 12);
  const sample = koreanJson[0];
  assert('ja_term' in sample && 'tw_translation' in sample && 'reading' in sample);
  assert.match(sample.ja_term, /\|/);
  assert.notEqual(sample.ja_term, sample.reading);
});

test('Offline preload uses local JSON only; refresh hits Google Sheets', async () => {
  mockDOM({});
  const fetched = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    fetched.push(String(url));
    const path = String(url);
    const body = path.endsWith('.json') ? readFileSync(resolve(path), 'utf-8') : '[]';
    return {
      ok: true,
      text: async () => body
    };
  };

  const { preloadAllCollections, refreshGalleryData, collectionsCache, collectionsMetaCache, profilesCache } = await import('../js/data.js');
  await preloadAllCollections();

  assert.ok(collectionsCache['japanese-terms']?.length > 12);
  assert.ok(collectionsCache['china-terms']?.length > 12);
  assert.ok(collectionsCache['korean-terms']?.length > 12);
  assert.ok(fetched.every(url => !url.includes('docs.google.com')), 'boot must not hit Google Sheets');
  assert.ok(fetched.some(url => url === 'data.json'));
  assert.ok(fetched.some(url => url === 'china-data.json'));
  assert.ok(fetched.some(url => url === 'korean-data.json'));
  assert.ok(fetched.some(url => url === 'profiles.json'));

  fetched.length = 0;
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => originalSetTimeout(fn, ms === 2000 ? 0 : ms, ...args);
  await refreshGalleryData('japanese-terms');
  global.setTimeout = originalSetTimeout;
  assert.ok(fetched.some(url => url.includes('docs.google.com')), 'header refresh must request Google Sheets');

  Object.keys(collectionsCache).forEach(k => { delete collectionsCache[k]; });
  Object.keys(collectionsMetaCache).forEach(k => { delete collectionsMetaCache[k]; });
  profilesCache.length = 0;
  global.fetch = originalFetch;
});

test('Header refresh button is the second nav action and calls refreshGalleryData', () => {
  const html = readFileSync(resolve('index.html'), 'utf-8');
  assert.match(html, /<div class="awsui-nav-actions">[\s\S]*id="btn-toggle-theme"[\s\S]*id="btn-refresh-data"[\s\S]*onclick="refreshGalleryData\(window\.currentCollectionId\)"/);
});

test('Notice Panel markup is titled Notice and defaults to 展廳同步中', () => {
  const html = readFileSync(resolve('index.html'), 'utf-8');
  assert.match(html, /id="notice-modal"/);
  assert.match(html, /id="notice-modal"[\s\S]*class="awsui-modal awsui-notice-modal"/);
  assert.doesNotMatch(html, /id="notice-modal"[\s\S]*awsui-modal-lg/);
  assert.match(html, /id="notice-modal-title">Notice</);
  assert.match(html, /id="notice-modal-message">展廳同步中</);
  assert.doesNotMatch(html, /id="notice-modal"[\s\S]*onclick="close/);
});

test('Notice Panel holds at least 2 seconds even if work finishes immediately', async () => {
  const mockModal = createMockElement();
  const mockMsg = createMockElement();
  const mockBtn = createMockElement();
  mockDOM({
    'notice-modal': mockModal,
    'notice-modal-message': mockMsg,
    'btn-refresh-data': mockBtn
  });

  const timeouts = [];
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => {
    timeouts.push(ms);
    return originalSetTimeout(fn, 0, ...args);
  };

  const { showNoticeUntil, NOTICE_SYNC_MESSAGE, NOTICE_MIN_VISIBLE_MS } = await import('../js/components/notice.js');
  await showNoticeUntil(Promise.resolve(), { message: NOTICE_SYNC_MESSAGE, minVisibleMs: NOTICE_MIN_VISIBLE_MS });

  assert.equal(mockMsg.innerText, '展廳同步中');
  assert.deepEqual(timeouts, [2000]);
  assert(!mockModal.classes.has('open'));
  assert(!mockBtn.classes.has('active'));
  global.setTimeout = originalSetTimeout;
});

test('Notice Panel stays open until both work and 2s hold finish', async () => {
  const mockModal = createMockElement();
  const mockMsg = createMockElement();
  const mockBtn = createMockElement();
  mockDOM({
    'notice-modal': mockModal,
    'notice-modal-message': mockMsg,
    'btn-refresh-data': mockBtn
  });

  let holdFn;
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms) => {
    if (ms === 80) {
      holdFn = fn;
      return 1;
    }
    return originalSetTimeout(fn, ms);
  };

  const { isNoticeOpen, showNoticeUntil } = await import('../js/components/notice.js');
  let resolveWork;
  const work = new Promise((resolve) => { resolveWork = resolve; });
  const done = showNoticeUntil(work, { message: '展廳同步中', minVisibleMs: 80 });

  assert(mockModal.classes.has('open'));
  assert.equal(mockMsg.innerText, '展廳同步中');
  assert(mockBtn.classes.has('active'));
  assert.equal(isNoticeOpen(), true);

  resolveWork();
  await Promise.resolve();
  assert(mockModal.classes.has('open'), 'must stay open after fast work until hold elapses');

  holdFn();
  await done;
  assert(!mockModal.classes.has('open'));
  global.setTimeout = originalSetTimeout;
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
  collectionsMetaCache['korean-terms'] = { title: '韓語單字速成攻略', status: '籌備中' };
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
  const mockCuratorSection = createMockElement();
  const mockCurator = createMockElement();
  const mockDesc = createMockElement();
  const mockTotal = createMockElement();
  const mockCreatedAt = createMockElement();
  const mockId = createMockElement();
  const mockHeaderTitle = createMockElement();

  mockDOM({
    'collection-modal': mockModal,
    'collection-modal-title': mockTitle,
    'collection-modal-entitle': mockEnTitle,
    'collection-modal-curator-section': mockCuratorSection,
    'collection-modal-curator': mockCurator,
    'collection-modal-description': mockDesc,
    'collection-modal-total-items': mockTotal,
    'collection-modal-created-at': mockCreatedAt,
    'collection-modal-id': mockId,
    'collection-header-title': mockHeaderTitle
  });

  const { collectionsMetaCache, collectionsCache } = await import('../js/data.js');
  const { openCollectionModal, closeCollectionModal } = await import('../js/components/modal.js');

  collectionsMetaCache['china-terms'] = {
    title: '簡中語境破解攻略',
    enTitle: 'Decoding Simplified Chinese: The Ultimate Guide',
    id: 'C102',
    tags: ['大陸', '語彙'],
    description: '簡中語境破解攻略說明內容\n第二行說明\n第三行說明',
    notice: '詞彙僅供參考',
    timestamp: '2026-09-04'
  };
  collectionsCache['china-terms'] = [{ id: '1' }, { id: '2' }];

  openCollectionModal('china-terms', false);

  assert(mockModal.classes.has('open'));
  assert(mockHeaderTitle.classes.has('active'), 'collection-header-title should have active class when collection modal opens');
  assert.equal(mockTitle.innerText, '簡中語境破解攻略');
  assert.equal(mockEnTitle.innerText, 'Decoding Simplified Chinese: The Ultimate Guide');
  assert.equal(mockCurator.innerText, '巧克力');
  assert.notEqual(mockCuratorSection.style.display, 'none');
  assert.equal(mockDesc.innerText, '簡中語境破解攻略說明內容\n第二行說明\n第三行說明');
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
  assert.equal(mockTitle.innerText, '韓語單字速成攻略');
  assert.equal(mockEnTitle.innerText, 'Master Korean Vocabulary Fast: The Ultimate Cheat Sheet');
  assert.equal(mockCurator.innerText, '巧克力');
  assert.equal(mockCreatedAt.innerText, '2026-09-18');
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

test('Profile Panel - Open from Curator click and populate sheet fields', async () => {
  const mockProfileModal = createMockElement();
  const mockName = createMockElement();
  const mockEnSection = createMockElement();
  const mockEn = createMockElement();
  const mockIgSection = createMockElement();
  const mockIg = createMockElement();
  const mockYtSection = createMockElement();
  const mockYt = createMockElement();
  const mockGmSection = createMockElement();
  const mockGm = createMockElement();
  const mockDescSection = createMockElement();
  const mockDesc = createMockElement();
  const mockSocialRow = createMockElement();
  const mockId = createMockElement();
  const mockCurator = createMockElement({ innerText: '巧克力' });
  const mockCollectionModal = createMockElement();
  mockCollectionModal.classes.add('open');

  mockDOM({
    'profile-modal': mockProfileModal,
    'profile-modal-name': mockName,
    'profile-modal-en-section': mockEnSection,
    'profile-modal-en': mockEn,
    'profile-modal-ig-section': mockIgSection,
    'profile-modal-ig': mockIg,
    'profile-modal-youtube-section': mockYtSection,
    'profile-modal-youtube': mockYt,
    'profile-modal-gmail-section': mockGmSection,
    'profile-modal-gmail': mockGm,
    'profile-modal-description-section': mockDescSection,
    'profile-modal-description': mockDesc,
    'profile-modal-social-row': mockSocialRow,
    'profile-modal-id': mockId,
    'collection-modal-curator': mockCurator,
    'collection-modal': mockCollectionModal,
    'description-modal': createMockElement()
  });

  const { profilesCache } = await import('../js/data.js');
  const { handleCuratorClick, closeProfileModal } = await import('../js/components/modal.js');

  profilesCache.length = 0;
  profilesCache.push({
    id: '#P-0002',
    enName: 'Chocolate',
    zhName: '巧克力',
    ig: '不公開',
    youtube: '不公開',
    gmail: '不公開',
    description: 'CGO Master\n歡迎大家來玩'
  });

  handleCuratorClick();
  assert(mockProfileModal.classes.has('open'), 'click Curator should open Profile panel');
  assert(mockCurator.classes.has('active'), 'Curator should use collection-header-title active invert while Profile is open');
  assert.equal(mockName.innerText, '巧克力');
  assert.equal(mockEn.innerText, 'Chocolate');
  assert.equal(mockIg.innerText, '不公開');
  assert.equal(mockYt.innerText, '不公開');
  assert.equal(mockGm.innerText, '不公開');
  assert.equal(mockDesc.innerText, 'CGO Master\n歡迎大家來玩');
  assert.equal(mockId.innerText, '#P-0002');
  assert.notEqual(mockEnSection.style.display, 'none');
  assert.notEqual(mockSocialRow.style.display, 'none');
  assert.notEqual(mockDescSection.style.display, 'none');

  closeProfileModal(false);
  assert(!mockProfileModal.classes.has('open'));
  assert(!mockCurator.classes.has('active'), 'Curator should drop active invert when Profile closes');
});

test('Local Fallback Snapshot Integrity - Profiles', () => {
  const profilesJson = JSON.parse(readFileSync(resolve('profiles.json'), 'utf-8'));
  assert(Array.isArray(profilesJson) && profilesJson.length >= 1);
  const chocolate = profilesJson.find(p => p.zhName === '巧克力');
  assert(chocolate);
  assert.equal(chocolate.id, '#P-0002');
  assert.equal(chocolate.enName, 'Chocolate');
  assert('ig' in chocolate && 'youtube' in chocolate && 'gmail' in chocolate && 'description' in chocolate);
});

test('Filter Modal - Open, apply, reset and gallery-specific sections', async () => {
  const mockFilterModal = createMockElement();
  const mockHangul = createMockElement({ style: { display: 'none' } });
  const mockKana = createMockElement({ style: { display: 'none' } });
  const mockKind = createMockElement({ style: { display: 'none' } });
  const mockReading = createMockElement({ style: {} });
  const mockGloss = createMockElement({ style: { display: 'none' } });
  const mockSummary = createMockElement();
  const mockTrigger = createMockElement();

  mockDOM({
    'filter-modal': mockFilterModal,
    'filter-hangul-section': mockHangul,
    'filter-kana-section': mockKana,
    'filter-kind-section': mockKind,
    'sort-field-reading': mockReading,
    'sort-field-subtitle': mockGloss,
    'filter-summary': mockSummary,
    'btn-open-filter-modal': mockTrigger
  });

  const originalWindow = global.window;
  const originalLocation = global.location;
  const originalFetch = global.fetch;
  global.location = { hash: '' };
  global.window = {
    switchView: () => {},
    scrollTo: () => {},
    syncFilterUi: undefined,
    location: global.location
  };
  global.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith('.json')) {
      return { ok: true, text: async () => readFileSync(resolve(path), 'utf-8') };
    }
    return { ok: false, text: async () => '' };
  };

  const { store } = await import('../js/state.js');
  const { switchCollection } = await import('../js/components/sidebar.js');
  const { openFilterModal, closeFilterModal, applyFilterModal, resetFineFilters, countActiveFineFilters } = await import('../js/filter.js');

  store.set({ currentCollectionId: 'japanese-terms', allRecords: [], filteredRecords: [] });
  switchCollection('korean-terms', false);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(mockHangul.style.display, '');
  assert.equal(mockKind.style.display, '');
  assert.equal(mockKana.style.display, 'none');
  assert.equal(mockGloss.style.display, '');
  assert.equal(mockReading.style.display, 'none');

  openFilterModal();
  assert(mockFilterModal.classes.has('open'));
  assert(mockTrigger.classes.has('active'));
  applyFilterModal();
  assert(!mockFilterModal.classes.has('open'));
  assert(!mockTrigger.classes.has('active'));

  store.set({ currentLengthTab: '2', currentInitialTab: 'ㄱ', loanwordOnly: true, currentCollectionId: 'korean-terms' });
  assert.equal(countActiveFineFilters() >= 3, true);
  resetFineFilters();
  const afterReset = store.get();
  assert.equal(afterReset.currentLengthTab, 'ALL');
  assert.equal(afterReset.currentInitialTab, 'ALL');
  assert.equal(afterReset.loanwordOnly, false);
  assert.equal(afterReset.currentSortField, 'title');

  closeFilterModal();
  assert(!mockFilterModal.classes.has('open'));
  global.window = originalWindow;
  global.location = originalLocation;
  global.fetch = originalFetch;
});

test('Page size - Filter modal pills set store and stay in sync', async () => {
  const tab10 = createMockElement({ 'data-tab': '10' });
  const tab25 = createMockElement({ 'data-tab': '25' });
  const tabAll = createMockElement({ 'data-tab': 'all' });
  tab10.classList.add('active');
  tab10.getAttribute = (k) => (k === 'data-tab' ? '10' : tab10[k]);
  tab25.getAttribute = (k) => (k === 'data-tab' ? '25' : tab25[k]);
  tabAll.getAttribute = (k) => (k === 'data-tab' ? 'all' : tabAll[k]);

  mockDOM({
    'card-grid': createMockElement(),
    'cards-counter': createMockElement(),
    'pagination-controls': createMockElement(),
    'filter-summary': createMockElement()
  });
  global.document.querySelectorAll = (sel) => {
    if (sel === '#page-size-tabs .awsui-tab') return [tab10, tab25, tabAll];
    return [];
  };

  const { store } = await import('../js/state.js');
  const { setPageSize, selectPageSize } = await import('../js/components/pagination.js');
  const { syncFilterUi } = await import('../js/filter.js');

  store.set({ allRecords: [], filteredRecords: [], pageSize: 10 });
  selectPageSize('25', tab25);
  assert.equal(store.get().pageSize, 25);
  assert(tab25.classes.has('active'));
  assert(!tab10.classes.has('active'));

  setPageSize('all');
  assert.equal(store.get().pageSize, 9999);
  syncFilterUi();
  assert(tabAll.classes.has('active'));
  assert(!tab25.classes.has('active'));
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
    pageSize: 10,
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

