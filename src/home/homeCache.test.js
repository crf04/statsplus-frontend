import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useHomeTonight } from './useHomeTonight';
import HomeTicker from './HomeTicker';
import HomeTonight from './HomeTonight';
import { fetchSlate } from '../slateApi';
import { fetchSlateEdges } from '../slateEdgesApi';
import { fetchResolvedTargets } from '../targets/targetsApi';

jest.mock('../slateApi', () => ({ fetchSlate: jest.fn() }));
jest.mock('../slateEdgesApi', () => ({ fetchSlateEdges: jest.fn() }));
jest.mock('../targets/targetsApi', () => ({ fetchResolvedTargets: jest.fn() }));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'reader-a' }, isAuthenticated: true, loading: false }),
}));

const CACHE_KEY = 'courtai.homeTonight.v1';
const pending = () => new Promise(() => {});

const stored = {
  games: [
    {
      gameId: 'g1',
      scheduledAt: '2026-04-10T23:00:00Z',
      away: { tricode: 'LAL' },
      home: { tricode: 'BOS' },
      effects: [{ canonicalId: 7, name: 'Austin Reaves', value: 0.24 }],
      scores: [[7, 0.24]],
    },
  ],
  spotlight: {
    best: {
      gameId: 'g1',
      name: 'Austin Reaves',
      opponent: 'BOS',
      value: 0.24,
      reason: { base: 'play_types', sliceKey: 'Transition', share: 0.18, opponentRank: 29 },
    },
    toughest: null,
  },
  slateDate: '2026-04-10',
  past: false,
};

// The page as the home route draws it from the hook's state.
const Home = ({ account = null }) => {
  const tonight = useHomeTonight(true, account);
  return (
    <MemoryRouter>
      {tonight.games && <HomeTicker slateDate={tonight.slateDate} games={tonight.games} />}
      {tonight.games && (
        <HomeTonight
          games={tonight.games}
          spotlight={tonight.spotlight}
          targets={tonight.targets}
          slateDate={tonight.slateDate}
          onUseQuery={() => {}}
        />
      )}
      <output>{tonight.targets ? `targets:${tonight.targets.total}` : 'no targets'}</output>
    </MemoryRouter>
  );
};

const game = (gameId) => ({
  gameId,
  scheduledAt: '2026-04-11T23:00:00Z',
  away: { tricode: 'A' },
  home: { tricode: 'B' },
});

beforeEach(() => {
  window.localStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  fetchSlate.mockReturnValue(pending());
  fetchSlateEdges.mockReturnValue(pending());
  fetchResolvedTargets.mockReturnValue(pending());
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test('a valid entry renders in the real ticker and Tonight', () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  render(<Home />);

  expect(screen.getByRole('navigation', { name: "Today's games" })).toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Best: Austin Reaves' })).toBeInTheDocument();
});

test.each([
  [
    'an effect without a name',
    (e) => ({ ...e, games: [{ ...e.games[0], effects: [{ canonicalId: 7, value: 0.2 }] }] }),
  ],
  [
    'an effect without a value',
    (e) => ({ ...e, games: [{ ...e.games[0], effects: [{ canonicalId: 7, name: 'A B' }] }] }),
  ],
  ['a slate date that is not a date', (e) => ({ ...e, slateDate: 'soon' })],
  [
    'a tip-off that is not a time',
    (e) => ({ ...e, games: [{ ...e.games[0], scheduledAt: 'later' }] }),
  ],
  [
    'a pick without a name',
    (e) => ({
      ...e,
      spotlight: { ...e.spotlight, best: { ...e.spotlight.best, name: undefined } },
    }),
  ],
  [
    'a best pick that hurts',
    (e) => ({ ...e, spotlight: { ...e.spotlight, best: { ...e.spotlight.best, value: -0.1 } } }),
  ],
  [
    'a reason with a rank outside 1-30',
    (e) => ({
      ...e,
      spotlight: {
        ...e.spotlight,
        best: { ...e.spotlight.best, reason: { ...e.spotlight.best.reason, opponentRank: 0 } },
      },
    }),
  ],
  [
    'a reason without a share',
    (e) => ({
      ...e,
      spotlight: {
        ...e.spotlight,
        best: { ...e.spotlight.best, reason: { base: 'x', sliceKey: 'y', opponentRank: 3 } },
      },
    }),
  ],
  [
    'a reason base that is an inherited property (constructor)',
    (e) => ({
      ...e,
      spotlight: {
        ...e.spotlight,
        best: { ...e.spotlight.best, reason: { ...e.spotlight.best.reason, base: 'constructor' } },
      },
    }),
  ],
  [
    'a reason base of __proto__',
    (e) => ({
      ...e,
      spotlight: {
        ...e.spotlight,
        best: { ...e.spotlight.best, reason: { ...e.spotlight.best.reason, base: '__proto__' } },
      },
    }),
  ],
])('the real page renders without crashing from %s, and the entry is removed', (_name, corrupt) => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(corrupt(stored)));
  render(<Home />);

  expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument();
  expect(screen.getByText('no targets')).toBeInTheDocument();
  expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
});

test('a targets field in the stored entry never reaches state or the page', () => {
  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ ...stored, targets: { total: 9, firing: [{ target: { id: 1 } }] } }),
  );
  const { result } = renderHook(() => useHomeTonight(true, 'reader-a'));
  render(<Home account="reader-a" />);

  expect(result.current.targets).toBeNull();
  expect(screen.getByText('no targets')).toBeInTheDocument();
  expect(screen.queryByText('targets:9')).not.toBeInTheDocument();
});

test('a fresh Slate for a new day with Edges for the cached day clears the old day', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockResolvedValue({ slateDate: '2026-04-11', games: [game('n')], fallback: null });
  fetchSlateEdges.mockResolvedValue({
    slateDate: '2026-04-10',
    games: [],
    spotlight: { best: null, toughest: null },
  });
  render(<Home />);

  await waitFor(() =>
    expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument(),
  );
  expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
});

test('a fresh empty Slate clears the cached day, and Targets for its date still show', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockResolvedValue({ slateDate: '2026-04-11', games: [], fallback: null });
  fetchSlateEdges.mockResolvedValue({
    slateDate: '2026-04-11',
    games: [],
    spotlight: { best: null, toughest: null },
  });
  fetchResolvedTargets.mockResolvedValue({ slateDate: '2026-04-11', entries: [] });
  render(<Home account="reader-a" />);

  await waitFor(() => expect(screen.getByText('targets:0')).toBeInTheDocument());
  expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument();
  expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
});

test('Targets for another day than the fresh Slate never show beside the cached day', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockResolvedValue({ slateDate: '2026-04-11', games: [], fallback: null });
  fetchSlateEdges.mockResolvedValue({
    slateDate: '2026-04-10',
    games: [],
    spotlight: { best: null, toughest: null },
  });
  fetchResolvedTargets.mockResolvedValue({ slateDate: '2026-04-10', entries: [] });
  render(<Home account="reader-a" />);

  await waitFor(() =>
    expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument(),
  );
  expect(screen.getByText('no targets')).toBeInTheDocument();
});

test('a failed Slate read leaves the cached paint on screen', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockRejectedValue(new Error('offline'));
  fetchSlateEdges.mockRejectedValue(new Error('offline'));
  render(<Home />);

  await waitFor(() => expect(console.warn).toHaveBeenCalled());
  expect(screen.getByRole('navigation', { name: "Today's games" })).toBeInTheDocument();
});

test('the previous account Targets that answer after a switch never render', async () => {
  let answerOld;
  fetchSlate.mockResolvedValue({ slateDate: '2026-04-10', games: [], fallback: null });
  fetchResolvedTargets.mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve)));
  const { rerender } = render(<Home account="reader-a" />);
  fetchResolvedTargets.mockReturnValue(pending());
  rerender(<Home account="reader-b" />);

  await act(async () => {
    answerOld({
      slateDate: '2026-04-10',
      entries: [{ target: { id: 1 }, game: null, players: [] }],
    });
  });

  expect(screen.getByText('no targets')).toBeInTheDocument();
});

test('an empty Slate for the cached day clears it even when Edges fail', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockResolvedValue({ slateDate: '2026-04-10', games: [], fallback: null });
  fetchSlateEdges.mockRejectedValue(new Error('boom'));
  render(<Home />);

  await waitFor(() =>
    expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument(),
  );
  expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
});

test('a cache for another day is not kept when Edges fail', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockResolvedValue({ slateDate: '2026-04-11', games: [game('n')], fallback: null });
  fetchSlateEdges.mockRejectedValue(new Error('boom'));
  render(<Home />);

  await waitFor(() =>
    expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument(),
  );
  expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
});

test('a same-day cache with a non-empty Slate stays when Edges fail', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockResolvedValue({ slateDate: '2026-04-10', games: [game('n')], fallback: null });
  fetchSlateEdges.mockRejectedValue(new Error('boom'));
  render(<Home />);

  await waitFor(() => expect(console.warn).toHaveBeenCalled());
  expect(screen.getByRole('navigation', { name: "Today's games" })).toBeInTheDocument();
  expect(window.localStorage.getItem(CACHE_KEY)).not.toBeNull();
});

test.each([
  ['a Slate for a new day', { slateDate: '2026-04-11', games: [game('n')], fallback: null }],
  ['an empty Slate for the cached day', { slateDate: '2026-04-10', games: [], fallback: null }],
])('%s clears the cached day while Edges are still pending', async (_label, slate) => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  fetchSlate.mockResolvedValue(slate);
  render(<Home />);

  await waitFor(() =>
    expect(screen.queryByRole('navigation', { name: "Today's games" })).not.toBeInTheDocument(),
  );
  expect(window.localStorage.getItem(CACHE_KEY)).toBeNull();
});

test('a new day that replaces the cached day is the one stored for the next visit', async () => {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  let answerSlate;
  let answerEdges;
  fetchSlate.mockReturnValue(new Promise((resolve) => (answerSlate = resolve)));
  fetchSlateEdges.mockReturnValue(new Promise((resolve) => (answerEdges = resolve)));
  render(<Home />);

  await act(async () => {
    answerSlate({ slateDate: '2026-04-11', games: [game('n')], fallback: null });
  });
  await act(async () => {
    answerEdges({ slateDate: '2026-04-11', games: [], spotlight: { best: null, toughest: null } });
  });

  expect(screen.getByRole('navigation', { name: "Today's games" })).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(CACHE_KEY))).toMatchObject({
    slateDate: '2026-04-11',
    games: [{ gameId: 'n' }],
  });
});
