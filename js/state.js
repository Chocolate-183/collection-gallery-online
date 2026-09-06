/**
 * Global Application State Store
 */
import { collectionsConfig } from './config.js';

const safeLocalStorage = {
  getItem: (key) => typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null,
  setItem: (key, val) => typeof localStorage !== 'undefined' ? localStorage.setItem(key, val) : null
};

const prefersDarkMode = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

class Store {
  constructor() {
    this.listeners = new Set();
    this.state = {
      currentCollectionId: 'japanese-terms',
      allRecords: [],
      filteredRecords: [],
      currentPage: 1,
      pageSize: 12,
      currentKanaTab: 'ALL',
      currentLengthTab: 'ALL',
      searchQuery: '',
      invalidTerm: null,
      currentView: 'dictionary',
      currentTheme: safeLocalStorage.getItem('aws_theme') || (prefersDarkMode() ? 'dark' : 'light'),
      isLoading: false
    };
  }

  get() {
    return this.state;
  }

  set(partialState) {
    this.state = { ...this.state, ...partialState };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    }
  }

  reshuffleRandom10() {
    this.state.allRecords.forEach(r => {
      r._rand10 = Math.random();
    });
  }
}

export const store = new Store();
export { safeLocalStorage };
