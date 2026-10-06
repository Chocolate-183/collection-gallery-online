import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

test('Offline dumps cover C101 C102 C103 and profiles', () => {
  assert(Array.isArray(dataJson) && dataJson.length > 12);
  assert('ja_term' in dataJson[0] && 'tw_translation' in dataJson[0] && 'reading' in dataJson[0]);

  const chinaJson = JSON.parse(readFileSync(resolve('china-data.json'), 'utf-8'));
  assert(Array.isArray(chinaJson) && chinaJson.length > 12);
  assert('ja_term' in chinaJson[0] && 'tw_translation' in chinaJson[0]);

  const koreanJson = JSON.parse(readFileSync(resolve('korean-data.json'), 'utf-8'));
  assert(Array.isArray(koreanJson) && koreanJson.length > 12);
  assert.match(koreanJson[0].ja_term, /\|/);
  const posValues = [...new Set(koreanJson.map(r => String(r.pos || '').trim()).filter(Boolean))];
  for (const pos of ['名詞', '動詞', '形容詞', '副詞', '感嘆詞', '冠形詞', '代名詞', '量詞', '數詞', '依存名詞']) {
    assert.ok(posValues.includes(pos), `C103 dump missing POS ${pos}`);
  }
  assert.equal(koreanJson.filter(r => Array.isArray(r.tags) && r.tags.includes('基礎100')).length, 100);
  for (const tag of ['人名', '團體名', '公司名']) {
    assert.ok(koreanJson.some(r => Array.isArray(r.tags) && r.tags.includes(tag)), `C103 dump missing tag ${tag}`);
  }
  const etymologyValues = [...new Set(koreanJson.map(r => String(r.etymology || '').trim()).filter(Boolean))];
  for (const etym of ['漢字語', '外來語', '固有語', '混種語']) {
    assert.ok(etymologyValues.includes(etym), `C103 dump missing etymology ${etym}`);
  }

  const profilesJson = JSON.parse(readFileSync(resolve('profiles.json'), 'utf-8'));
  const chocolate = profilesJson.find(p => p.zhName === '巧克力');
  assert.equal(chocolate.id, '#P-0002');
});

test('Filter markup has C103 POS/Etymology pills and Catalog quick filters', () => {
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const posSection = html.match(/id="pos-tabs"[\s\S]*?<\/div>/)[0];
  for (const pos of ['名詞', '動詞', '形容詞', '副詞', '感嘆詞', '冠形詞', '代名詞', '量詞', '數詞', '依存名詞']) {
    assert.match(posSection, new RegExp(`data-tab="${pos}"`));
  }
  const etymologySection = html.match(/id="etymology-tabs"[\s\S]*?<\/div>/)[0];
  for (const etym of ['漢字語', '外來語', '固有語', '混種語']) {
    assert.match(etymologySection, new RegExp(`data-tab="${etym}"`));
  }
  const kindTabs = html.match(/id="kind-tabs"[\s\S]*?<\/div>/)[0];
  for (const kind of ['BASIC100', '人名', '團體名', '公司名']) {
    assert.match(kindTabs, new RegExp(`data-tab="${kind}"`));
  }
  assert.doesNotMatch(html, /id="modal-category-section"/);
  const posIdx = html.indexOf('id="filter-pos-section"');
  const etymologyIdx = html.indexOf('id="filter-etymology-section"');
  const kindIdx = html.indexOf('id="filter-kind-section"');
  assert.ok(posIdx > 0 && etymologyIdx > posIdx && kindIdx > etymologyIdx);

  assert.match(html, /id="search-input"[\s\S]*id="quick-filter-tabs"[\s\S]*最新10[\s\S]*隨機10[\s\S]*基礎100/);
  assert.match(html, /<script type="module" src="dist\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /src="js\/app\.js"/);
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
  assert.ok(fetched.some(url => url === 'korean-data.json'));

  fetched.length = 0;
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => originalSetTimeout(fn, ms === 5000 ? 0 : ms, ...args);
  await refreshGalleryData('japanese-terms');
  global.setTimeout = originalSetTimeout;
  assert.ok(fetched.some(url => url.includes('docs.google.com')), 'header refresh must request Google Sheets');

  Object.keys(collectionsCache).forEach(k => { delete collectionsCache[k]; });
  Object.keys(collectionsMetaCache).forEach(k => { delete collectionsMetaCache[k]; });
  profilesCache.length = 0;
  global.fetch = originalFetch;
});

test('Mobile Filter and Display merge into one panel', () => {
  const html = readFileSync(resolve('index.html'), 'utf-8');
  const css = readFileSync(resolve('styles.css'), 'utf-8');
  assert.match(html, /id="filter-combined-host"/);
  assert.match(html, /id="filter-panel-title-combined">Filter & Display</);
  const mobile = css.split('@media (max-width: 768px)').pop();
  assert.match(mobile, /#display-modal \{[\s\S]*display:\s*none\s*!important/);
});

test('Notice Panel stays open until work and 5s hold finish', async () => {
  const mockModal = createMockElement();
  const mockMsg = createMockElement();
  const mockCountdown = createMockElement({ style: {} });
  const mockBtn = createMockElement();
  mockDOM({
    'notice-modal': mockModal,
    'notice-modal-message': mockMsg,
    'notice-modal-countdown': mockCountdown,
    'btn-refresh-data': mockBtn
  });

  let holdFn;
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.setTimeout = (fn, ms) => {
    if (ms === 80) {
      holdFn = fn;
      return 1;
    }
    return originalSetTimeout(fn, ms);
  };
  global.setInterval = () => 99;
  global.clearInterval = () => {};

  const { isNoticeOpen, showNoticeUntil, NOTICE_MIN_VISIBLE_MS } = await import('../js/components/notice.js');
  assert.equal(NOTICE_MIN_VISIBLE_MS, 5000);

  let resolveWork;
  const work = new Promise((resolve) => { resolveWork = resolve; });
  const done = showNoticeUntil(work, { message: '展廳同步中', minVisibleMs: 80 });

  assert(mockModal.classes.has('open'));
  assert.equal(isNoticeOpen(), true);
  resolveWork();
  await Promise.resolve();
  assert(mockModal.classes.has('open'), 'must stay open after fast work until hold elapses');
  holdFn();
  await done;
  assert(!mockModal.classes.has('open'));
  global.setTimeout = originalSetTimeout;
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
});

test('Router sends 調整中 / 籌備中 halls to maintenance and sidebar badges follow status', async () => {
  const mockTitle = createMockElement();
  const mockViewMaint = createMockElement({ style: { display: 'none' } });
  const mockBadge = createMockElement({ style: { display: 'inline-block' } });
  mockDOM({
    'maintenance-title': mockTitle,
    'view-maintenance': mockViewMaint,
    'side-nav-count-japanese-terms': mockBadge,
    'side-nav-count-china-terms': mockBadge,
    'side-nav-count-korean-terms': mockBadge
  });

  const { setOpeningHoursSchedule, OPENING_HOURS_SCHEDULE } = await import('../js/utils.js');
  const originalSchedule = [...OPENING_HOURS_SCHEDULE];
  setOpeningHoursSchedule(Array(7).fill({ day: '全天', hours: '00:00 - 23:59' }));

  const { collectionsMetaCache } = await import('../js/data.js');
  const { store } = await import('../js/state.js');
  const { switchView } = await import('../js/router.js');
  const { updateSidebarBadge } = await import('../js/components/sidebar.js');

  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '調整中' };
  store.set({ currentCollectionId: 'japanese-terms' });
  switchView('dictionary', null, false);
  assert.equal(mockTitle.innerText, 'ADJUSTING');

  collectionsMetaCache['korean-terms'] = { title: '韓語單字速成攻略', status: '籌備中' };
  store.set({ currentCollectionId: 'korean-terms' });
  switchView('dictionary', null, false);
  assert.equal(mockTitle.innerText, 'COMING SOON');

  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '開放中' };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadge.style.display, 'none');

  collectionsMetaCache['japanese-terms'] = { title: '日本特色詞彙', status: '調整中' };
  updateSidebarBadge('japanese-terms');
  assert.equal(mockBadge.innerText, 'ADJUSTING');

  setOpeningHoursSchedule(originalSchedule);
});

test('Empty catalog, Collection modal, Description modal, and Profile panel', async () => {
  const mockContainer = createMockElement();
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
  const mockDescModal = createMockElement();
  const mockDescText = createMockElement();
  const mockMeaning = createMockElement({ clientHeight: 100, scrollHeight: 200, 'data-row-index': '1' });
  mockMeaning.classList.add('has-scroll');
  const mockColDesc = createMockElement({ innerText: '展廳詳細介紹說明內容' });
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
  const mockProfileDesc = createMockElement();
  const mockSocialRow = createMockElement();
  const mockProfileId = createMockElement();
  mockCurator.innerText = '巧克力';
  mockModal.classes.add('open');

  mockDOM({
    'card-grid': mockContainer,
    'collection-modal': mockModal,
    'collection-modal-title': mockTitle,
    'collection-modal-entitle': mockEnTitle,
    'collection-modal-curator-section': mockCuratorSection,
    'collection-modal-curator': mockCurator,
    'collection-modal-description': mockDesc,
    'collection-modal-total-items': mockTotal,
    'collection-modal-created-at': mockCreatedAt,
    'collection-modal-id': mockId,
    'collection-header-title': mockHeaderTitle,
    'description-modal': mockDescModal,
    'description-modal-text': mockDescText,
    'modal-meaning-text': mockMeaning,
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
    'profile-modal-description': mockProfileDesc,
    'profile-modal-social-row': mockSocialRow,
    'profile-modal-id': mockProfileId
  });

  const { store } = await import('../js/state.js');
  const { renderCards } = await import('../js/components/cards.js');
  const { collectionsMetaCache, collectionsCache, profilesCache } = await import('../js/data.js');
  const {
    openCollectionModal,
    closeCollectionModal,
    openDescriptionModal,
    handleCollectionDescriptionClick,
    handleCuratorClick,
    closeProfileModal
  } = await import('../js/components/modal.js');

  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ id: '1', ja_term: '測試' }],
    filteredRecords: [],
    invalidTerm: '查無此詞',
    searchQuery: ''
  });
  renderCards();
  assert(mockContainer.innerHTML.includes('尚無相符展品'));

  collectionsMetaCache['china-terms'] = {
    title: '簡中語境破解攻略',
    enTitle: 'Decoding Simplified Chinese: The Ultimate Guide',
    id: 'C102',
    tags: ['大陸', '語彙'],
    description: '簡中語境破解攻略說明內容',
    notice: '詞彙僅供參考',
    timestamp: '2026-09-04'
  };
  collectionsCache['china-terms'] = [{ id: '1' }, { id: '2' }];
  openCollectionModal('china-terms', false);
  assert(mockModal.classes.has('open'));
  assert.equal(mockTitle.innerText, '簡中語境破解攻略');
  assert.equal(mockTotal.innerText, 2);
  assert.equal(mockId.innerText, 'C102');
  closeCollectionModal(false);
  assert(!mockModal.classes.has('open'));

  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 1, ja_term: '測試詞彙', reading: 'チェシー', tw_translation: '測試詳細說明內容', created_at: '2024-01-01', id: 'J101' }]
  });
  openDescriptionModal(1, false);
  assert.equal(mockDescText.innerText, '測試詳細說明內容');
  mockDesc.innerText = '展廳詳細介紹說明內容';
  handleCollectionDescriptionClick();
  assert.equal(mockDescText.innerText, '展廳詳細介紹說明內容');

  profilesCache.length = 0;
  profilesCache.push({
    id: '#P-0002',
    enName: 'Chocolate',
    zhName: '巧克力',
    ig: '不公開',
    youtube: '不公開',
    gmail: '不公開',
    description: 'CGO Master'
  });
  handleCuratorClick();
  assert(mockProfileModal.classes.has('open'));
  assert.equal(mockName.innerText, '巧克力');
  closeProfileModal(false);
  assert(!mockProfileModal.classes.has('open'));
});

test('Filter modal shows hall-specific sections and resets Display', async () => {
  const mockFilterModal = createMockElement();
  const mockDisplayModal = createMockElement();
  const mockHangul = createMockElement({ style: { display: 'none' } });
  const mockKana = createMockElement({ style: { display: 'none' } });
  const mockKind = createMockElement({ style: { display: 'none' } });
  const mockEtymology = createMockElement({ style: { display: 'none' } });
  const mockPos = createMockElement({ style: { display: 'none' } });
  const mockBasic100 = createMockElement({ style: { display: 'none' } });
  const mockPerson = createMockElement({ style: { display: 'none' } });
  const mockGroup = createMockElement({ style: { display: 'none' } });
  const mockCompany = createMockElement({ style: { display: 'none' } });
  const mockQuickBasic100 = createMockElement({ style: { display: 'none' } });
  const mockReading = createMockElement({ style: {} });
  const mockGloss = createMockElement({ style: { display: 'none' } });
  const mockSummary = createMockElement();
  const mockTrigger = createMockElement();

  mockDOM({
    'filter-modal': mockFilterModal,
    'display-modal': mockDisplayModal,
    'filter-hangul-section': mockHangul,
    'filter-kana-section': mockKana,
    'filter-kind-section': mockKind,
    'filter-etymology-section': mockEtymology,
    'filter-pos-section': mockPos,
    'kind-basic100': mockBasic100,
    'kind-person': mockPerson,
    'kind-group': mockGroup,
    'kind-company': mockCompany,
    'quick-basic100': mockQuickBasic100,
    'sort-field-reading': mockReading,
    'sort-field-subtitle': mockGloss,
    'filter-summary': mockSummary,
    'btn-open-filter-modal': mockTrigger
  });

  const originalWindow = global.window;
  const originalLocation = global.location;
  const originalFetch = global.fetch;
  const pendingTimers = [];
  const fakeSetTimeout = (fn, ms) => {
    const id = pendingTimers.length + 1;
    pendingTimers.push({ id, fn, ms });
    return id;
  };
  const fakeClearTimeout = (id) => {
    const idx = pendingTimers.findIndex(t => t.id === id);
    if (idx >= 0) pendingTimers.splice(idx, 1);
  };
  const flushTimers = () => {
    const due = pendingTimers.splice(0);
    due.forEach(t => t.fn());
  };
  global.location = { hash: '' };
  global.window = {
    switchView: () => {},
    scrollTo: () => {},
    innerWidth: 1200,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
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
  const { openFilterModal, closeCatalogPanels, resetFineFilters, resetDisplaySettings, countActiveFineFilters, DISPLAY_FOLLOW_DELAY_MS } = await import('../js/filter.js');

  store.set({ currentCollectionId: 'japanese-terms', allRecords: [], filteredRecords: [] });
  switchCollection('korean-terms', false);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(mockHangul.style.display, '');
  assert.equal(mockEtymology.style.display, '');
  assert.equal(mockPos.style.display, '');
  assert.equal(mockPerson.style.display, '');
  assert.equal(mockGroup.style.display, '');
  assert.equal(mockCompany.style.display, '');
  assert.equal(mockKana.style.display, 'none');

  openFilterModal();
  assert(mockFilterModal.classes.has('open'));
  assert.equal(pendingTimers[0].ms, DISPLAY_FOLLOW_DELAY_MS);
  flushTimers();
  assert(mockDisplayModal.classes.has('open'));
  closeCatalogPanels();

  global.window.innerWidth = 390;
  openFilterModal();
  assert.equal(pendingTimers.length, 0, 'mobile does not schedule Display follow');
  closeCatalogPanels();

  store.set({ currentLengthTab: '2', currentInitialTab: 'ㄱ', etymologyTab: '外來語', posTab: '名詞', currentCollectionId: 'korean-terms' });
  assert.equal(countActiveFineFilters() >= 4, true);
  resetFineFilters();
  assert.equal(store.get().currentLengthTab, 'ALL');
  assert.equal(store.get().etymologyTab, 'ALL');

  store.set({ currentSortField: 'id', currentSortOrder: 'desc', pageSize: 50, currentCollectionId: 'korean-terms' });
  resetDisplaySettings();
  assert.equal(store.get().currentSortField, 'title');
  assert.equal(store.get().pageSize, 10);

  switchCollection('japanese-terms', false);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(mockKana.style.display, '');
  assert.equal(mockHangul.style.display, 'none');
  assert.equal(mockPerson.style.display, 'none');
  assert.equal(mockGroup.style.display, 'none');
  assert.equal(mockCompany.style.display, 'none');

  global.window = originalWindow;
  global.location = originalLocation;
  global.fetch = originalFetch;
});

test('C103 Item Modal hides Pronunciation and shows Etymology/POS; cards toggle active', async () => {
  const mockReadingSection = createMockElement({ style: { display: 'none' } });
  const mockReadingRow = createMockElement();
  const mockMeaning = createMockElement();
  const mockModal = createMockElement();
  const mockEtymPosRow = createMockElement({ style: { display: 'none' } });
  const mockEtymSection = createMockElement({ style: { display: 'none' } });
  const mockEtym = createMockElement();
  const mockPosSection = createMockElement({ style: { display: 'none' } });
  const mockPos = createMockElement();
  const mockReferenceSection = createMockElement({ style: { display: 'none' } });
  const mockReference = createMockElement();
  const card1 = createMockElement({ 'data-row-index': '1' });
  const card2 = createMockElement({ 'data-row-index': '2' });

  mockDOM({
    'detail-modal': mockModal,
    'modal-meaning-text': mockMeaning,
    'modal-reading-section': mockReadingSection,
    'modal-reading-row': mockReadingRow,
    'modal-etymology-pos-row': mockEtymPosRow,
    'modal-etymology-section': mockEtymSection,
    'modal-etymology': mockEtym,
    'modal-pos-section': mockPosSection,
    'modal-pos': mockPos,
    'modal-reference-section': mockReferenceSection,
    'modal-reference': mockReference
  });
  global.document.querySelectorAll = (sel) => {
    if (sel === '.awsui-card') return [card1, card2];
    return [];
  };

  const { store } = await import('../js/state.js');
  const { openMeaningModal, closeDetailModal } = await import('../js/components/modal.js');

  store.set({
    currentCollectionId: 'japanese-terms',
    allRecords: [{ row_index: 1, ja_term: '神経衰弱', reading: 'しんけいすいじゃく', tw_translation: '神經衰弱' }]
  });
  openMeaningModal(1, false);
  assert.equal(mockReadingRow.innerText, 'しんけいすいじゃく');
  assert.equal(mockReadingSection.style.display, 'block');
  assert.equal(mockReferenceSection.style.display, 'none');

  store.set({
    currentCollectionId: 'korean-terms',
    allRecords: [{
      row_index: 1,
      ja_term: '가능 | 可能',
      reading: '가능',
      tw_translation: '可能',
      etymology: '漢字語',
      pos: '名詞',
      tags: ['人名']
    }]
  });
  openMeaningModal(1, false);
  assert.equal(mockReadingSection.style.display, 'none');
  assert.equal(mockEtym.innerText, '漢字語');
  assert.equal(mockPos.innerText, '名詞');
  assert.equal(mockEtymPosRow.style.display, '');
  assert.equal(mockReferenceSection.style.display, 'none');
  assert.equal(mockReference.innerHTML, '');

  store.set({
    currentCollectionId: 'korean-terms',
    allRecords: [{
      row_index: 1,
      ja_term: '가능 | 可能',
      reading: '가능',
      tw_translation: '可能',
      etymology: '漢字語',
      pos: '名詞',
      tags: ['基礎100']
    }]
  });
  openMeaningModal(1, false);
  assert.equal(mockReferenceSection.style.display, '');
  assert.match(mockReference.innerHTML, /searchKeyword=%EA%B0%80%EB%8A%A5/);
  assert.match(mockReference.innerHTML, />國立國語院標準國語大辭典</);
  assert.equal(mockReference.innerHTML.includes('가능'), false);

  store.set({
    currentCollectionId: 'korean-terms',
    allRecords: [{
      row_index: 1,
      ja_term: '가능 | 可能',
      tags: ['團體名']
    }]
  });
  openMeaningModal(1, false);
  assert.equal(mockReferenceSection.style.display, 'none');

  store.set({
    currentCollectionId: 'korean-terms',
    allRecords: [{
      row_index: 1,
      ja_term: '가능 | 可能',
      tags: ['公司名']
    }]
  });
  openMeaningModal(1, false);
  assert.equal(mockReferenceSection.style.display, 'none');

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
  openMeaningModal(1, false);
  assert.equal(card1.classList.contains('active'), true);
  openMeaningModal(2, false);
  assert.equal(card2.classList.contains('active'), true);
  closeDetailModal(false);
  assert.equal(card1.classList.contains('active'), false);
  assert.equal(card2.classList.contains('active'), false);
});
