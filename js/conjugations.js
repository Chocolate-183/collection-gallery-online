/**
 * C103 verb/adjective conjugations — Dongsa Work / Professional view.
 */
import { POS_TABS } from './constants.js';
import { getExhibitHangulHeadword } from './utils.js';

export const CONJUGATABLE_POS = [POS_TABS.VERB, POS_TABS.ADJECTIVE];

const WORK_FOUR_INDEXES = [1, 3];
const WORK_FUTURE_INDEXES = [1, 3, 5, 7];
const WORK_FOUR_LABELS = ['Informal High', 'Formal High'];
const WORK_FUTURE_LABELS = [
  'Informal High',
  'Formal High',
  'Conditional Informal High',
  'Conditional Formal High'
];
const WORK_CONNECTIVE_LABELS = ['If', 'And'];
const WORK_OTHER_LABELS = ['Past Base', 'Future Base', 'Ing'];

function pickForms(values, indexes, labels) {
  const list = Array.isArray(values) ? values : [];
  const forms = [];
  indexes.forEach((idx, i) => {
    const value = list[idx] ? String(list[idx]).trim() : '';
    if (!value) return;
    forms.push({ value, label: labels[i] || '' });
  });
  return forms;
}

export function isConjugatablePos(pos) {
  const value = String(pos || '').trim();
  return CONJUGATABLE_POS.includes(value);
}

export function isConjugatableRecord(record) {
  return Boolean(record) && isConjugatablePos(record.pos);
}

export function getConjugationLemma(recordOrTerm) {
  if (!recordOrTerm) return '';
  if (typeof recordOrTerm === 'string') return getExhibitHangulHeadword(recordOrTerm);
  return getExhibitHangulHeadword(recordOrTerm.ja_term);
}

/**
 * Work / Professional forms from a parsed conjugation row (하다 example).
 * Informal High + Formal High; future also keeps the 겠어 family.
 */
export function getWorkProfessionalSections(entry) {
  if (!entry) return [];
  const connectiveSource = Array.isArray(entry.other) ? entry.other.slice(0, 2) : [];
  const otherSource = Array.isArray(entry.other) ? entry.other.slice(2, 5) : [];
  const sections = [
    { id: 'present', title: 'Present', forms: pickForms(entry.present, WORK_FOUR_INDEXES, WORK_FOUR_LABELS) },
    { id: 'past', title: 'Past', forms: pickForms(entry.past, WORK_FOUR_INDEXES, WORK_FOUR_LABELS) },
    { id: 'future', title: 'Future', forms: pickForms(entry.future, WORK_FUTURE_INDEXES, WORK_FUTURE_LABELS) },
    { id: 'present-question', title: 'Present Question', forms: pickForms(entry.presentQuestion, WORK_FOUR_INDEXES, WORK_FOUR_LABELS) },
    { id: 'past-question', title: 'Past Question', forms: pickForms(entry.pastQuestion, WORK_FOUR_INDEXES, WORK_FOUR_LABELS) },
    { id: 'command', title: 'Commands', forms: pickForms(entry.command, WORK_FOUR_INDEXES, WORK_FOUR_LABELS) },
    { id: 'suggestion', title: 'Suggestions', forms: pickForms(entry.suggestion, WORK_FOUR_INDEXES, WORK_FOUR_LABELS) },
    { id: 'connective', title: 'Connective', forms: pickForms(connectiveSource, [0, 1], WORK_CONNECTIVE_LABELS) },
    { id: 'other', title: 'Other', forms: pickForms(otherSource, [0, 1, 2], WORK_OTHER_LABELS) }
  ];
  return sections.filter(section => section.forms.length > 0);
}
