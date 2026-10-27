import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import {
  EvidenceSeasonBar,
  SeasonRefusal,
  pageDefaultSeason,
  useEvidenceSeason,
} from './EvidenceSeason';
import { fetchSeasons } from './seasonsApi';
import { publishedOnlySeasons, unpublishedSeasons } from './seasonChoicesFixture';

jest.mock('./contexts/AuthContext');
jest.mock('./seasonsApi', () => ({ fetchSeasons: jest.fn() }));

// A page reading the Evidence season the way the Matchup and Slate do: the
// season it would name on its request, and the control.
function Page({ newestUpTo }) {
  const evidence = useEvidenceSeason({ newestUpTo });
  const { search } = useLocation();
  return (
    <>
      <output aria-label="Request season">
        {evidence.ready ? (evidence.season ?? 'default') : 'waiting'}
      </output>
      <output aria-label="Current URL">{search}</output>
      <EvidenceSeasonBar evidence={evidence} />
    </>
  );
}
const renderPage = (entry, newestUpTo) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Page newestUpTo={newestUpTo} />
    </MemoryRouter>,
  );

beforeEach(() => fetchSeasons.mockResolvedValue(unpublishedSeasons));
afterEach(() => jest.clearAllMocks());

test('signed in, a linked 2026-27 waits for the choices, then is named', async () => {
  useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
  renderPage('/?season=2026-27');
  expect(screen.getByLabelText('Request season')).toHaveTextContent('waiting');
  await waitFor(() => expect(screen.getByLabelText('Request season')).toHaveTextContent('2026-27'));
  expect(screen.getByRole('combobox', { name: 'Evidence season' })).toHaveValue('2026-27');
});

test('signed in, a linked default reads as the default, never named', async () => {
  useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
  renderPage('/?season=2025-26');
  await screen.findByRole('combobox', { name: 'Evidence season' });
  expect(screen.getByLabelText('Request season')).toHaveTextContent('default');
});

test('signed out, there is no control and a linked season is never named', async () => {
  useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
  renderPage('/?season=2026-27');
  expect(screen.getByLabelText('Request season')).toHaveTextContent('default');
  await waitFor(() => expect(fetchSeasons).not.toHaveBeenCalled());
  expect(screen.queryByRole('combobox', { name: 'Evidence season' })).not.toBeInTheDocument();
  expect(screen.queryByText(/isn’t offered/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('?season=2026-27');
});

// The way back keeps Game Logs' Back to search button, hover lift included.
test('a refusal offers the default as the Back to search button', () => {
  render(
    <SeasonRefusal selectedSeason="2026-27" defaultSeason="2025-26" onShowDefault={() => {}} />,
  );
  expect(screen.getByRole('button', { name: 'Show 2025-26' })).toHaveClass(
    'btn',
    'btn-back-to-search',
  );
});

test.each([
  ['2026-27', unpublishedSeasons, '2026-27'],
  ['2027-28', unpublishedSeasons, '2026-27'],
  ['2025-26', unpublishedSeasons, '2025-26'],
  ['2024-25', unpublishedSeasons, '2025-26'],
  [null, unpublishedSeasons, '2025-26'],
  ['2026-27', publishedOnlySeasons, '2025-26'],
  ['2026-27', { defaultSeason: '2025-26', choices: undefined }, '2025-26'],
])(
  'a page up to %s defaults to the newest offered season not after it',
  (ceiling, seasons, expected) => {
    expect(
      pageDefaultSeason({
        choices: seasons.choices,
        publishedSeason: seasons.defaultSeason,
        ceiling,
      }),
    ).toBe(expected);
  },
);

describe('a page that reads the newest offered season up to its own', () => {
  beforeEach(() => useAuth.mockReturnValue({ isAuthenticated: true, loading: false }));

  test('waits for the choices, then names 2026-27 with its sample', async () => {
    renderPage('/', '2026-27');
    expect(screen.getByLabelText('Request season')).toHaveTextContent('waiting');
    await waitFor(() =>
      expect(screen.getByLabelText('Request season')).toHaveTextContent('2026-27'),
    );
    expect(screen.getByRole('combobox', { name: 'Evidence season' })).toHaveValue('2026-27');
    expect(screen.getByTestId('evidence-season-chip')).toHaveTextContent(
      'Evidence season 2026-27 · early, 2–4 games per team',
    );
    expect(screen.getByLabelText('Current URL')).toBeEmptyDOMElement();
  });

  test('keeps a chosen 2025-26 in the URL and a chosen 2026-27 out of it', async () => {
    renderPage('/', '2026-27');
    const select = await screen.findByRole('combobox', { name: 'Evidence season' });
    fireEvent.change(select, { target: { value: '2025-26' } });
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('?season=2025-26');
    expect(screen.getByLabelText('Request season')).toHaveTextContent('default');
    expect(select).toHaveValue('2025-26');

    fireEvent.change(select, { target: { value: '2026-27' } });
    expect(screen.getByLabelText('Current URL')).toBeEmptyDOMElement();
    expect(screen.getByLabelText('Request season')).toHaveTextContent('2026-27');
  });

  test('a linked season not offered falls back to 2026-27 and says so', async () => {
    renderPage('/?season=2027-28', '2026-27');
    await waitFor(() =>
      expect(screen.getByLabelText('Request season')).toHaveTextContent('2026-27'),
    );
    expect(
      screen.getByText('2027-28 isn’t offered, so this is 2026-27 evidence.'),
    ).toBeInTheDocument();
  });

  test('a failed read of the choices reads the default', async () => {
    fetchSeasons.mockRejectedValue(new Error('Network Error'));
    renderPage('/', '2026-27');
    expect(screen.getByLabelText('Request season')).toHaveTextContent('waiting');
    await waitFor(() =>
      expect(screen.getByLabelText('Request season')).toHaveTextContent('default'),
    );
  });
});
