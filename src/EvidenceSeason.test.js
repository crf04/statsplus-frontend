import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { EvidenceSeasonBar, SeasonRefusal, useEvidenceSeason } from './EvidenceSeason';
import { fetchSeasons } from './seasonsApi';
import { unpublishedSeasons } from './seasonChoicesFixture';

jest.mock('./contexts/AuthContext');
jest.mock('./seasonsApi', () => ({ fetchSeasons: jest.fn() }));

// A page reading the Evidence season the way the Matchup and Slate do: the
// season it would name on its request, and the control.
function Page() {
  const evidence = useEvidenceSeason();
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
const renderPage = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Page />
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
