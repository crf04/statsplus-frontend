// Research entries (crf04/statsplus#372) as GET /api/research serves them.
export const entry = (id, overrides = {}) => ({
  id,
  title: `Report ${id}`,
  listed_at: '2026-10-27T18:00:00Z',
  created_at: '2026-10-27T17:00:00Z',
  date: '2026-10-27',
  author: { handle: 'bighatprops' },
  covers: { games: ['DET @ CHA'], players: ['Cade Cunningham', 'LaMelo Ball'] },
  preview_url: `/api/reports/${id}/preview.png`,
  ...overrides,
});

export const researchPage = ({ featured = [], reports = [], next_cursor = null } = {}) => ({
  featured,
  reports,
  next_cursor,
});
