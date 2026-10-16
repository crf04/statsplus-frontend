// Facts about the operator that only the operator can supply. They are marked
// `{{LIKE_THIS}}` until then, and every legal page reads them from here so that
// filling them in is one edit. The pull request stays a draft while any remain.
export const OPERATOR_NAME = '{{OPERATOR_NAME}}';
export const CONTACT_EMAIL = '{{CONTACT_EMAIL}}';
export const GOVERNING_STATE = '{{GOVERNING_STATE}}';

// The date the pages were last checked against what the product does.
export const LAST_UPDATED = 'October 16, 2026';

export const HELPLINE = '1-800-GAMBLER';
// What the letters dial: G-A-M-B-L-E-R is 426-2537.
export const HELPLINE_DIGITS = '1-800-426-2537';
export const HELPLINE_HREF = 'tel:+18004262537';

export const FACTS_NOT_ADVICE = 'CourtAI reports facts; it never predicts or gives betting advice.';
export const DATA_SOURCE = 'Source: NBA.com';

export const TERMS_PATH = '/terms';
export const PRIVACY_PATH = '/privacy';
export const RESPONSIBLE_GAMBLING_PATH = '/responsible-gambling';

// Footer order. The page components are routed in App.js.
export const LEGAL_LINKS = [
  { path: TERMS_PATH, label: 'Terms' },
  { path: PRIVACY_PATH, label: 'Privacy' },
  { path: RESPONSIBLE_GAMBLING_PATH, label: 'Responsible gambling' },
];
