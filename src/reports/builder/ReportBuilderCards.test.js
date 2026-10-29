import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../App';
import { resetSeasonsCache } from '../../seasonsApi';
import { payload as matchupPayload } from '../../matchups/matchupPayloadFixture';
import { partialPoolSlatePayload } from '../../slatePartialPoolFixture';

/*
 * Report Builder Cards (crf04/statsplus#382): the author picks a card tool,
 * the MCP server previews the Card, and the Card goes in as a block or into
 * a row. A Report with Cards publishes through the MCP server; text alone
 * still goes to the backend.
 */

const mockAuth = {
  currentUser: { uid: 'u1', email: 'author@example.com' },
  loading: false,
  error: null,
  signInWithGoogle: jest.fn(),
  logout: jest.fn(),
  getToken: jest.fn(),
  isAuthenticated: true,
  isAdmin: false,
  waitlist: null,
};
jest.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => mockAuth,
}));

// The filter panel's sliders measure themselves.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../../utils/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const API = 'http://127.0.0.1:8000';
const PREVIEW = 'http://127.0.0.1:8001/web/cards/preview';
const MCP_PUBLISH = 'http://127.0.0.1:8001/web/reports';
const DRAFT_KEY = 'courtai:report-draft';

const team = (team_id, tricode, name) => ({ team_id, tricode, name, targetable_player_count: 0 });
const TEAMS = {
  LAL: team(1, 'LAL', 'Los Angeles Lakers'),
  BOS: team(2, 'BOS', 'Boston Celtics'),
  MEM: team(3, 'MEM', 'Memphis Grizzlies'),
  ORL: team(4, 'ORL', 'Orlando Magic'),
  DAL: team(5, 'DAL', 'Dallas Mavericks'),
  NYK: team(6, 'NYK', 'New York Knicks'),
};
const game = (id, away, home, state) => ({
  game_id: id,
  scheduled_at: '2026-10-27T23:30:00Z',
  status: { state },
  preseason: false,
  away_team: TEAMS[away],
  home_team: TEAMS[home],
});
// Today is 2026-10-27 on the Slate (US Eastern); MEM played on the 25th and the 23rd.
const SLATES = {
  '2026-10-27': {
    previous: '2026-10-25',
    games: [
      game('0022500584', 'LAL', 'BOS', 'scheduled'),
      game('0022600120', 'MEM', 'ORL', 'scheduled'),
      game('0022600121', 'DAL', 'NYK', 'postponed'),
    ],
  },
  '2026-10-25': {
    previous: '2026-10-23',
    games: [game('0022600100', 'MEM', 'LAL', 'final'), game('0022600101', 'BOS', 'NYK', 'final')],
  },
  '2026-10-23': { previous: null, games: [game('0022600080', 'DAL', 'MEM', 'final')] },
};
const slate = (date) => ({
  slate_date: date,
  previous_game_date: SLATES[date]?.previous ?? null,
  next_game_date: null,
  fallback: null,
  freshness: partialPoolSlatePayload.freshness,
  games: SLATES[date]?.games ?? [],
});

const baneLogs = {
  game_logs: [
    { GAME_DATE: '2026-04-01', PTS: 31, REB: 4 },
    { GAME_DATE: '2026-03-30', PTS: 12, REB: 6 },
  ],
  season_averages: [{ PTS: 21.5 }, { PTS: 21.5 }],
  posted_line: {
    game_date: '2026-10-29',
    matchup: 'MEM @ ORL',
    lines: { PTS: { value: 24.5, provider: 'prizepicks' } },
    provider_lines: { prizepicks: { PTS: 24.5 } },
  },
};

const published = {
  report: {
    id: 'n3wr3p0rt1',
    created_at: '2026-10-28T03:00:00Z',
    author: { label: 'Chris' },
    is_author: true,
    listed: false,
    featured: false,
    origin: 'builder',
    calls: [],
    cards: {},
    document: {
      title: 'Bane tonight',
      date: '2026-10-28',
      blocks: [{ id: 'b1', type: 'paragraph', text: 'Bane takes the shots.', lede: false }],
    },
  },
};

const ok = (data) => Promise.resolve({ data });

beforeEach(() => {
  window.localStorage.clear();
  resetSeasonsCache();
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation((url, config = {}) => {
    const params = config.params || {};
    if (url === `${API}/api/user/profile`) return ok({ success: true, user: {} });
    if (url === `${API}/api/reports/n3wr3p0rt1`) return ok(published);
    if (url === `${API}/api/players`) return ok(['Desmond Bane', 'Ja Morant', 'Jalen Williams']);
    if (url === `${API}/api/games/seasons`) {
      return ok({ seasons: ['2025-26', '2024-25'], default_season: '2025-26' });
    }
    if (url === `${API}/api/games/game_logs` && params.player_name === 'Desmond Bane') {
      return ok(baneLogs);
    }
    if (url === `${API}/api/games/slate`) return ok(slate(params.date));
    if (url === `${API}/api/games/matchup` && params.game_id === '0022500584') {
      return ok(matchupPayload);
    }
    if (url === `${API}/api/teams/MEM/season-minutes`) {
      return ok({
        season: params.season ?? '2025-26',
        players: [
          { player_id: 11, name: 'Desmond Bane', games_played: 70, average_minutes: 33 },
          { player_id: 12, name: 'Ja Morant', games_played: 50, average_minutes: 31 },
          { player_id: 13, name: 'Jaren Jackson Jr.', games_played: 65, average_minutes: 29 },
        ],
      });
    }
    return Promise.reject({ response: { status: 404 } });
  });
  // 2026-10-28 03:00 UTC: 12:00 in Tokyo, the test time zone, and 23:00 on the 27th in New York.
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-28T03:00:00Z'));
});

afterEach(() => jest.restoreAllMocks());

/* A Card the preview route drew for the request it was sent. */
const drawn = (request, { card = 'game-logs', structured = {} } = {}) => ({
  data: {
    call: { tool: request.tool, args: request.args ?? { player: request.filter_set.player_name } },
    structured,
    meta: null,
    card,
    html: `<p>${card}</p>`,
  },
});

const refused = (status, error, headers = {}) =>
  Promise.reject({ response: { status, data: { error }, headers } });

/* The preview route draws every Card; the publish routes answer with `n3wr3p0rt1`. */
const serveCards = () =>
  mockPost.mockImplementation((url, body) => {
    if (url === PREVIEW) return Promise.resolve(drawn(body, { structured: { team: 'MEM' } }));
    return ok({ report: { id: 'n3wr3p0rt1', url: 'https://courtai.app/reports/n3wr3p0rt1' } });
  });

const previews = () => mockPost.mock.calls.filter(([url]) => url === PREVIEW).map(([, b]) => b);

const openBuilder = async () => {
  window.history.pushState({}, '', '/reports/new');
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Write a report' });
};

const blocks = () => screen.queryAllByRole('region', { name: /^Block \d+: / });
const blockNames = () => blocks().map((block) => block.getAttribute('aria-label'));
const choose = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const openPicker = (card) => {
  fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
  if (card) choose('Card', card);
  return screen.getByRole('region', { name: 'Add a card' });
};

const preview = () => fireEvent.click(screen.getByRole('button', { name: 'Preview card' }));
const insert = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Insert card' }));
};

const playersLoaded = () =>
  waitFor(() => expect(screen.queryByText('Loading players…')).not.toBeInTheDocument());

const pickBane = async () => {
  await playersLoaded();
  choose('Player', 'Desmond Bane');
  await screen.findByText('Posted line: PrizePicks 24.5 (MEM @ ORL, 2026-10-29)');
};

/* Inserts an injuries Card for MEM, placed as `place` says. */
const addInjuriesCard = async (place) => {
  openPicker('get_injuries');
  choose('Team (optional)', 'MEM');
  preview();
  await screen.findByRole('button', { name: 'Insert card' });
  if (place) choose('Place', place);
  await insert();
};

const publishWith = async (title) => {
  fireEvent.click(screen.getByRole('button', { name: 'Publish…' }));
  const dialog = screen.getByRole('dialog', { name: 'Publish your report' });
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: title } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
  return dialog;
};

test('a game-log Card previews with the posted line and goes in as its own block', async () => {
  serveCards();
  mockPost.mockImplementationOnce((url, body) =>
    Promise.resolve(
      drawn(body, { structured: { player: { name: 'Desmond Bane' }, chart_stat: 'PTS' } }),
    ),
  );
  await openBuilder();
  const picker = openPicker();
  expect(screen.getByLabelText('Card')).toHaveValue('query_game_logs');
  expect(screen.getByLabelText('Market')).toHaveValue('PTS');
  await pickBane();
  expect(within(picker).getByRole('radio', { name: /Posted line/ })).toBeChecked();
  preview();

  expect(await screen.findByTitle('Bane PTS season')).toHaveAttribute('srcdoc', '<p>game-logs</p>');
  expect(previews()).toEqual([
    { tool: 'query_game_logs', filter_set: { player_name: 'Desmond Bane', line_type: 'PTS' } },
  ]);
  expect(blocks()).toHaveLength(0);
  await insert();

  expect(screen.queryByRole('region', { name: 'Add a card' })).not.toBeInTheDocument();
  expect(blockNames()).toEqual(['Block 1: Card']);
  expect(within(blocks()[0]).getByTitle('Bane PTS season')).toBeInTheDocument();
});

test('a typed line and the panel filters go to the server in the web app’s names', async () => {
  serveCards();
  await openBuilder();
  openPicker();
  await pickBane();
  choose('Market', 'FG3M');
  fireEvent.click(screen.getByRole('radio', { name: 'My line' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'My line' }), { target: { value: '2.5' } });

  fireEvent.click(screen.getByRole('button', { name: /\+ Opp. defense/ }));
  choose('Defensive metric', 'OPP_PTS');
  fireEvent.click(screen.getByRole('button', { name: 'Add: Points Allowed, ranks 21–30' }));

  fireEvent.click(screen.getByRole('button', { name: /\+ Teammate/ }));
  fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Teammate' }), {
    target: { value: 'Ja' },
  });
  fireEvent.click(screen.getByRole('option', { name: /Ja Morant/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  fireEvent.click(screen.getByRole('button', { name: /\+ Last N/ }));
  fireEvent.click(screen.getByRole('button', { name: '10' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  fireEvent.click(screen.getByRole('button', { name: /\+ Home \/ Away/ }));
  fireEvent.click(screen.getByRole('radio', { name: 'Home' }));
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  fireEvent.click(screen.getByRole('button', { name: /\+ Own stat line/ }));
  choose('Stat', 'PTS');
  fireEvent.click(await screen.findByRole('button', { name: 'Add stat filter' }));
  preview();

  await screen.findByRole('button', { name: 'Insert card' });
  expect(previews()).toEqual([
    {
      tool: 'query_game_logs',
      filter_set: {
        player_name: 'Desmond Bane',
        line_type: 'FG3M',
        line: 2.5,
        'teams_against[]': ['OPP_PTS'],
        'rank_filter[]': [10],
        'players_off[]': ['Ja Morant'],
        game_filter: 10,
        location_filter: 'Home',
        'self_filters[PTS]': '12,31',
      },
    },
  ]);
});

test('the game-log picker offers only what a Card can draw', async () => {
  await openBuilder();
  openPicker();
  expect(
    within(screen.getByLabelText('Market'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual([
    'PTS · Points',
    'PRA · Pts+Reb+Ast',
    'PA · Pts+Ast',
    'RA · Reb+Ast',
    'PR · Pts+Reb',
    'AST · Assists',
    'REB · Rebounds',
    'FTM · FT made',
    'FTA · FT attempts',
    'STL · Steals',
    'BLK · Blocks',
    'STKS · Stocks',
    '3PM · 3s made',
    'FG3A · 3PT attempts',
    'FG2M · 2PT made',
    'FG2A · 2PT attempts',
    'FGM · FG made',
    'FGA · FG attempts',
    'TOV · Turnovers',
    'REB_CHANCES · Rebound chances',
    'POTENTIAL_AST · Potential assists',
  ]);
  await pickBane();
  expect(screen.queryByRole('tab', { name: /Saved/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /\+ Playtype/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Next opponent/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /\+ Own stat line/ }));
  const stats = within(screen.getByLabelText('Stat'))
    .getAllByRole('option')
    .map((option) => option.value);
  expect(stats).toContain('USG_PCT');
  expect(stats).toContain('FD_PTS');
  expect(stats).not.toContain('PLAYTYPE_RTG');
});

test('a Matchup Card offers the day’s games, then a player in the game', async () => {
  serveCards();
  await openBuilder();
  openPicker('get_matchup');
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-27');
  await screen.findByLabelText('Game');
  expect(
    within(screen.getByLabelText('Game'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Choose a game', 'LAL @ BOS', 'MEM @ ORL']);
  expect(screen.getByRole('button', { name: 'Preview card' })).toBeDisabled();
  choose('Game', '0022500584');
  await screen.findByRole('option', { name: 'LeBron James' });
  choose('Player', 'LeBron James');
  preview();
  await insert();

  expect(previews()).toEqual([
    {
      tool: 'get_matchup',
      args: { game: 'LAL @ BOS', date: '2026-10-27', player: 'LeBron James' },
    },
  ]);
  expect(blockNames()).toEqual(['Block 1: Card']);
});

test('a rotation Card offers only a finished game, by date or from the last games', async () => {
  serveCards();
  await openBuilder();
  openPicker('get_rotation');
  choose('Team', 'MEM');
  expect(
    await screen.findByText('MEM @ ORL hasn’t finished, so it has no rotation yet.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preview card' })).toBeDisabled();
  choose('Date', '2026-10-24');
  expect(await screen.findByText('MEM has no game on this date.')).toBeInTheDocument();
  choose('Date', '2026-10-25');
  expect(await screen.findByText('MEM @ LAL, final.')).toBeInTheDocument();
  preview();
  await screen.findByRole('button', { name: 'Insert card' });

  fireEvent.click(screen.getByRole('radio', { name: 'From the last N games' }));
  const recent = await screen.findByRole('group', { name: 'Game' });
  expect(
    within(recent)
      .getAllByRole('radio')
      .map((radio) => radio.parentElement.textContent),
  ).toEqual(['MEM @ LAL, 2026-10-25', 'DAL @ MEM, 2026-10-23']);
  fireEvent.click(within(recent).getByRole('radio', { name: 'DAL @ MEM, 2026-10-23' }));
  preview();
  await insert();

  expect(previews()).toEqual([
    { tool: 'get_rotation', args: { game: 'MEM @ LAL', date: '2026-10-25' } },
    { tool: 'get_rotation', args: { game: 'DAL @ MEM', date: '2026-10-23' } },
  ]);
  expect(blockNames()).toEqual(['Block 1: Card']);
});

test('an on/off Card names a team, the players on and off the floor, and a season', async () => {
  serveCards();
  await openBuilder();
  openPicker('get_on_off');
  choose('Team', 'MEM');
  await screen.findByRole('option', { name: '2024-25' });
  choose('Season', '2024-25');
  await screen.findByLabelText('Ja Morant');
  choose('Ja Morant', 'off');
  choose('Desmond Bane', 'on');
  preview();
  await insert();

  expect(previews()).toEqual([
    {
      tool: 'get_on_off',
      args: { team: 'MEM', on: ['Desmond Bane'], off: ['Ja Morant'], season: '2024-25' },
    },
  ]);
  expect(mockGet).toHaveBeenCalledWith(`${API}/api/teams/MEM/season-minutes`, {
    params: { season: '2024-25' },
    signal: expect.anything(),
  });
  expect(blockNames()).toEqual(['Block 1: Card']);
});

test('an injuries Card takes a date and, optionally, a team', async () => {
  serveCards();
  await openBuilder();
  openPicker('get_injuries');
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-27');
  preview();
  await screen.findByRole('button', { name: 'Insert card' });
  choose('Team (optional)', 'MEM');
  preview();
  await insert();

  expect(previews()).toEqual([
    { tool: 'get_injuries', args: { date: '2026-10-27' } },
    { tool: 'get_injuries', args: { date: '2026-10-27', team: 'MEM' } },
  ]);
  expect(blockNames()).toEqual(['Block 1: Card']);
});

test.each([
  [422, 'call_failed', 'The backend timed out.', {}, 'The backend timed out.'],
  [422, 'no_card', 'Only the game view draws a card.', {}, 'Only the game view draws a card.'],
  [422, 'unavailable', 'Injury report is unavailable.', {}, 'Injury report is unavailable.'],
  [400, 'invalid_input', 'date must be YYYY-MM-DD.', {}, 'date must be YYYY-MM-DD.'],
  [
    429,
    'rate_limited',
    'You have used your 300 calls today.',
    { 'retry-after': '5400' },
    'You have used your 300 calls today. Try again in 2 hours.',
  ],
])('a %s %s refusal shows its reason and inserts nothing', async (...refusal) => {
  const [status, code, message, headers, shown] = refusal;
  mockPost.mockImplementation(() => refused(status, { code, message }, headers));
  await openBuilder();
  openPicker('get_injuries');
  preview();

  expect(await screen.findByRole('alert')).toHaveTextContent(shown);
  expect(screen.queryByRole('button', { name: 'Insert card' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(blocks()).toHaveLength(0);
});

test('a needs_choice refusal lists the choices, and picking one previews again', async () => {
  mockPost
    .mockImplementationOnce(() =>
      refused(422, {
        code: 'needs_choice',
        message: '"Jalen Williams" matches 2 players.',
        details: {
          choices: [
            { name: 'Jalen Williams', team: 'DEN' },
            { name: 'Jalen Williams', team: 'OKC' },
          ],
        },
      }),
    )
    .mockImplementation((url, body) => Promise.resolve(drawn(body)));
  await openBuilder();
  openPicker();
  await playersLoaded();
  choose('Player', 'Jalen Williams');
  preview();

  const choices = await screen.findByRole('group', { name: 'Choose one' });
  expect(screen.getByRole('alert')).toHaveTextContent('"Jalen Williams" matches 2 players.');
  expect(screen.queryByRole('button', { name: 'Insert card' })).not.toBeInTheDocument();
  fireEvent.click(within(choices).getByRole('button', { name: 'Jalen Williams (OKC)' }));
  await insert();

  expect(previews().map((body) => body.filter_set.player_name)).toEqual([
    'Jalen Williams',
    'Jalen Williams (OKC)',
  ]);
  expect(blockNames()).toEqual(['Block 1: Card']);
});

test('Cards make a row of two or three, and a card leaves a row with its call', async () => {
  serveCards();
  await openBuilder();
  await addInjuriesCard();
  await addInjuriesCard('b1');
  expect(blockNames()).toEqual(['Block 1: Card row']);
  await addInjuriesCard('b1');
  expect(within(blocks()[0]).getAllByTitle('Report')).toHaveLength(3);

  openPicker('get_injuries');
  preview();
  await screen.findByRole('button', { name: 'Insert card' });
  expect(
    within(screen.getByLabelText('Place'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['As its own block']);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  fireEvent.click(screen.getByRole('button', { name: 'Remove card 2 from the row' }));
  await publishWith('Three cards, then two');

  await waitFor(() =>
    expect(mockPost).toHaveBeenLastCalledWith(MCP_PUBLISH, expect.anything(), {
      timeout: 180000,
    }),
  );
  expect(mockPost.mock.calls.at(-1)[1]).toEqual({
    report: {
      title: 'Three cards, then two',
      date: '2026-10-28',
      blocks: [{ id: 'b1', type: 'cards', cards: ['c1', 'c3'] }],
    },
    calls: [
      { id: 'c1', tool: 'get_injuries', args: { date: '2026-10-27', team: 'MEM' } },
      { id: 'c3', tool: 'get_injuries', args: { date: '2026-10-27', team: 'MEM' } },
    ],
    show_author: false,
    listed: false,
  });
  expect(await screen.findByText('Bane takes the shots.')).toBeInTheDocument();
  expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
});

test('a row down to one card becomes a lone card block', async () => {
  serveCards();
  await openBuilder();
  await addInjuriesCard();
  await addInjuriesCard('b1');
  fireEvent.click(screen.getByRole('button', { name: 'Remove card 1 from the row' }));
  expect(blockNames()).toEqual(['Block 1: Card']);
  expect(screen.queryByRole('button', { name: /from the row/ })).not.toBeInTheDocument();
});

test('deleting a card’s block drops its call, so the text goes straight to the backend', async () => {
  serveCards();
  await openBuilder();
  fireEvent.click(screen.getByRole('button', { name: 'Add paragraph' }));
  fireEvent.change(within(blocks()[0]).getByLabelText('Text'), {
    target: { value: 'Bane takes the shots.' },
  });
  await addInjuriesCard();
  fireEvent.click(within(blocks()[1]).getByRole('button', { name: /^Delete/ }));
  await publishWith('Text only');

  await waitFor(() => expect(mockPost.mock.calls.at(-1)[0]).toBe(`${API}/api/user/reports`));
  expect(mockPost.mock.calls.at(-1)[1]).toEqual({
    report: {
      title: 'Text only',
      date: '2026-10-28',
      blocks: [{ id: 'b1', type: 'paragraph', text: 'Bane takes the shots.', lede: false }],
    },
    calls: [],
    cards: {},
    show_author: false,
    listed: false,
    origin: 'builder',
  });
  expect(mockPost.mock.calls.some(([url]) => url === MCP_PUBLISH)).toBe(false);
});

const storedDraft = (blocks, calls) =>
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: '', date: null, blocks, calls }));
const injuriesCall = (n) => ({ id: `c${n}`, tool: 'get_injuries', args: { date: '2026-10-27' } });

test('a reloaded draft keeps its Cards’ calls but not their previews, and draws one again', async () => {
  serveCards();
  storedDraft([{ id: 'b1', type: 'card', card: 'c1' }], [injuriesCall(1)]);
  await openBuilder();

  expect(blockNames()).toEqual(['Block 1: Card']);
  expect(screen.queryByTitle('Report')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preview again' }));
  expect(await screen.findByTitle('Report')).toHaveAttribute('srcdoc', '<p>game-logs</p>');
  expect(previews()).toEqual([{ tool: 'get_injuries', args: { date: '2026-10-27' } }]);
  expect(JSON.parse(window.localStorage.getItem(DRAFT_KEY)).calls).toEqual([injuriesCall(1)]);
});

test('a report holds at most 120 blocks and 48 Cards', async () => {
  serveCards();
  const cards = Array.from({ length: 47 }, (_, i) => ({
    id: `b${i + 1}`,
    type: 'card',
    card: `c${i + 1}`,
  }));
  const text = Array.from({ length: 73 }, (_, i) => ({
    id: `b${i + 48}`,
    type: 'heading',
    text: 'More',
  }));
  storedDraft(
    [...cards, ...text],
    cards.map((_, i) => injuriesCall(i + 1)),
  );
  await openBuilder();
  openPicker('get_injuries');
  preview();
  await screen.findByRole('button', { name: 'Insert card' });

  expect(
    within(screen.getByRole('region', { name: 'Add a card' })).getByText(
      'A report holds at most 120 blocks.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Insert card' })).toBeDisabled();
  choose('Place', 'b1');
  await insert();

  expect(blocks()).toHaveLength(120);
  expect(blockNames()[0]).toBe('Block 1: Card row');
  expect(screen.getByRole('button', { name: 'Add card' })).toBeDisabled();
  expect(screen.getByText('A report holds at most 48 cards.')).toBeInTheDocument();
});

test('a refused rerun names the card’s block, and a publish limit says when to try again', async () => {
  serveCards();
  await openBuilder();
  fireEvent.click(screen.getByRole('button', { name: 'Add heading' }));
  fireEvent.change(within(blocks()[0]).getByLabelText('Heading'), { target: { value: 'Tonight' } });
  await addInjuriesCard();
  mockPost.mockImplementation(() =>
    refused(422, {
      code: 'unavailable',
      message: 'The injury report is unavailable right now.',
      details: { call: 'c1' },
    }),
  );
  const dialog = await publishWith('Refused');

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'The card in block 2: The injury report is unavailable right now.',
  );
  mockPost.mockImplementation(() =>
    refused(
      429,
      { code: 'rate_limited', message: 'Daily limit reached.' },
      { 'retry-after': '30' },
    ),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }));
  await waitFor(() =>
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Daily limit reached. Try again in 30 seconds.',
    ),
  );
  expect(blockNames()).toEqual(['Block 1: Heading', 'Block 2: Card']);
  await act(async () => {});
});
