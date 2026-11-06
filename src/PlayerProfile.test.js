import { act, fireEvent, render, screen, within } from '@testing-library/react';
import PlayerProfile from './PlayerProfile';
import { apiClient } from './config';
// Toumani Camara vs DEN as production served it on 2026-11-06 (trimmed to what the card reads).
import camaraVsDen from '../e2e/fixtures/unscheduled-matchup.json';

jest.mock('./config', () => ({ apiClient: { get: jest.fn() }, getApiUrl: (key) => key }));

const matchupFor = (opponent) => ({
  ...camaraVsDen,
  teams: camaraVsDen.teams.map((team) => ({ ...team, tricode: opponent })),
});

beforeEach(() => {
  jest.clearAllMocks();
  apiClient.get.mockImplementation((url, { params }) =>
    url === 'MATCHUP_UNSCHEDULED'
      ? Promise.resolve({ data: matchupFor(params.opponent) })
      : Promise.reject(new Error(`unexpected ${url}`)),
  );
});

const renderProfile = async (props = {}) => {
  const setLineType = jest.fn();
  const view = (more) => (
    <PlayerProfile
      selectedPlayer="Toumani Camara"
      selectedTeam="Denver Nuggets"
      lineType="PTS"
      setLineType={setLineType}
      {...props}
      {...more}
    />
  );
  const utils = render(view());
  await act(async () => {});
  return { ...utils, setLineType, rerenderWith: (more) => utils.rerender(view(more)) };
};

const failedRequest = (status) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, headers: { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' } },
  });

// The cells of a slice row: name, his share, the opponent's rank, % vs league.
const cells = (row) =>
  [...row.querySelectorAll('.pmc-row-name, .pmc-row-share, .pmc-rank, .pmc-row-vs')].map(
    (cell) => cell.textContent,
  );
const rowsOf = (listName) =>
  within(screen.getByRole('list', { name: listName }))
    .getAllByRole('listitem')
    .map(cells);
const courtAgainst = (opponent) =>
  screen.queryByRole('img', { name: `Shot zones half court against ${opponent}` });
const group = (name) => screen.getByRole('region', { name });
const groupHead = (name) => group(name).querySelector('.pmc-w3-head .pmc-val').textContent;
const baseBars = (name) =>
  [...group(name).querySelectorAll('.pmc-w3-toggle')].map((button) => button.textContent);

test('one read of the unscheduled Matchup against the page opponent, no season and no legacy reads', async () => {
  await renderProfile();
  expect(apiClient.get.mock.calls.map(([url, { params }]) => [url, params])).toEqual([
    ['MATCHUP_UNSCHEDULED', { player_name: 'Toumani Camara', opponent: 'DEN' }],
  ]);
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.getByText(/2025-26 · data as of Aug 24/)).toBeVisible();
});

test('PTS reads S4: the Spot up row is 41% · 27th · +10% and the pill is the PTS score', async () => {
  await renderProfile();
  expect(screen.getByText('Where his PTS come from')).toBeVisible();
  expect(screen.getByTitle('PTS Season Matchup Score')).toHaveTextContent('+2.0%');
  expect(rowsOf('Play types')).toEqual([
    ['Spot up', '41%', '27th', '+10%'],
    ['Transition', '22%', '18th', '+1%'],
    ['Cut', '8%', '29th', '+16%'],
  ]);
  // Shot types are scored on his own mix of 2s and 3s, so they have no opponent rank.
  expect(screen.getByText('· for his mix of 2s and 3s')).toBeVisible();
  expect(rowsOf('Shot types')).toEqual([
    ['Catch & shoot', '52%', '–', '+3%'],
    ['Less Than 10 ft', '32%', '–', '−1%'],
    ['Pull-ups', '14%', '–', '+2%'],
  ]);
  expect(rowsOf('Traditional')).toEqual([['DEN: points allowed per 48', '', '18th', '+0.4%']]);
  expect(
    screen.getByRole('img', { name: 'Shot zones half court against DEN' }),
  ).toBeInTheDocument();
  expect(screen.getByText('DEN allows vs league')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
  expect(rowsOf('Play types')).toHaveLength(9);
});

test('slice rows show no league share', async () => {
  const { container } = await renderProfile();
  expect(container.textContent).not.toMatch(/\blg\b/);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Show all' })));
  expect(container.textContent).not.toMatch(/\blg\b/);
});

test('PRA reads W3: subtotals by stat that add up to the PRA score, and no court', async () => {
  await renderProfile({ lineType: 'PRA' });
  expect(screen.getByTitle('PRA Season Matchup Score')).toHaveTextContent('+0.9%');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  // Groups run largest contribution first.
  expect(
    screen.getAllByRole('region').map((section) => section.getAttribute('aria-label')),
  ).toEqual(['Points', 'Rebounds', 'Assists']);
  expect(groupHead('Points')).toBe('+1.3%');
  expect(group('Points')).toHaveTextContent('Points · 64% of his PRA');
  expect(groupHead('Rebounds')).toBe('−0.6%');
  expect(group('Rebounds')).toHaveTextContent('Rebounds · 24% of his PRA');
  expect(groupHead('Assists')).toBe('+0.2%');
  expect(group('Assists')).toHaveTextContent('Assists · 12% of his PRA');
  expect(screen.getByText('PRA score').parentElement).toHaveTextContent('PRA score+0.9%');
  expect(screen.getByText("Bars are each Base's share of the PRA score.")).toBeVisible();
});

test('each stat lists the Bases the response says feed it, Traditional under every one', async () => {
  await renderProfile({ lineType: 'PRA' });
  // Compact (nothing measured in jsdom): each group shows its largest Base and "+N more".
  expect(baseBars('Points')).toEqual(['▸Play types+0.8%']);
  fireEvent.click(within(group('Points')).getByRole('button', { name: '+3 more' }));
  fireEvent.click(within(group('Rebounds')).getByRole('button', { name: '+1 more' }));
  fireEvent.click(within(group('Assists')).getByRole('button', { name: '+1 more' }));
  expect(baseBars('Points')).toEqual([
    '▸Play types+0.8%',
    '▸Shot zones+0.2%',
    '▸Shot types+0.2%',
    '▸Traditional+0.1%',
  ]);
  expect(baseBars('Rebounds')).toEqual(['▸Traditional−0.4%', '▸Rebound types−0.3%']);
  expect(baseBars('Assists')).toEqual(['▸Assist locations+0.1%', '▸Traditional+0.1%']);
});

test("opening Traditional under Rebounds shows that stat's Defense Sheet row", async () => {
  await renderProfile({ lineType: 'PRA' });
  fireEvent.click(within(group('Rebounds')).getByRole('button', { name: /Traditional/ }));
  expect(within(group('Rebounds')).getAllByRole('listitem').map(cells)).toEqual([
    ['DEN: rebounds allowed per 48', '', '8th', '−3%'],
  ]);
});

test.each([
  ['PA', ['Points', 'Assists'], '+2.0%'],
  ['RA', ['Rebounds', 'Assists'], '−1.1%'],
])('%s groups only its own stats and totals the MCP score', async (lineType, groups, total) => {
  await renderProfile({ lineType });
  expect(
    screen.getAllByRole('region').map((section) => section.getAttribute('aria-label')),
  ).toEqual(groups);
  expect(screen.getByText(`${lineType} score`).parentElement).toHaveTextContent(
    `${lineType} score${total}`,
  );
});

test('the picker lists scored markets in the Line Type groups and writes the Line Type', async () => {
  const { setLineType } = await renderProfile();
  const picker = screen.getByRole('combobox', { name: 'Market' });
  expect(picker).toHaveValue('PTS');
  expect([...picker.querySelectorAll('optgroup')].map((g) => g.label)).toEqual([
    'Main',
    'Combos',
    'Shooting',
    'Other',
  ]);
  expect([...picker.querySelectorAll('optgroup')].map((g) => g.textContent)).toEqual([
    'PTSREBAST3PM',
    'PRAPAPRRASTKS',
    'FGMFGAFG2MFG2AFG3AFTMFTA',
    'STLBLKTOV',
  ]);
  expect(within(picker).getByRole('option', { name: '3PM' })).toHaveValue('FG3M');

  fireEvent.change(picker, { target: { value: 'PRA' } });
  expect(setLineType).toHaveBeenCalledWith('PRA');
});

test('a new Line Type switches the card; AST shows its court without a duplicate list', async () => {
  const { rerenderWith } = await renderProfile();
  rerenderWith({ lineType: 'AST' });
  expect(screen.getByRole('combobox', { name: 'Market' })).toHaveValue('AST');
  expect(screen.getByText('Where his AST come from')).toBeVisible();
  expect(screen.getByTitle('AST Season Matchup Score')).toHaveTextContent('+2.0%');
  expect(
    screen.getByRole('img', { name: 'Assist locations half court against DEN' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Assist locations' })).not.toBeInTheDocument();
  expect(rowsOf('Traditional')).toEqual([['DEN: assists allowed per 48', '', '18th', '+2%']]);

  rerenderWith({ lineType: 'FG3M' });
  expect(screen.getByRole('combobox', { name: 'Market' })).toHaveValue('FG3M');
  expect(screen.getByText('Where his 3PM come from')).toBeVisible();
});

test.each(['FD_PTS', 'None'])(
  'with Line Type %s the card shows PTS with a note, and picking RA sets the Line Type',
  async (lineType) => {
    const { setLineType } = await renderProfile({ lineType });
    expect(screen.getByText(`PTS shown; ${lineType} has no Matchup Score`)).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Market' })).toHaveValue('PTS');
    expect(screen.getByText('Where his PTS come from')).toBeVisible();
    fireEvent.change(screen.getByRole('combobox', { name: 'Market' }), {
      target: { value: 'RA' },
    });
    expect(setLineType).toHaveBeenCalledWith('RA');
  },
);

test.each([
  [500, 'Failed to fetch data. Please try again. (ref 77070cec)'],
  [400, 'Failed to fetch data. Please try again.'],
])('a matchup read refused with %i shows %j', async (status, text) => {
  apiClient.get.mockRejectedValue(failedRequest(status));
  await renderProfile();
  expect(screen.getByText(text)).toBeVisible();
});

test('a player the backend cannot score reads as missing data, not a failure', async () => {
  apiClient.get.mockRejectedValue(
    Object.assign(new Error('Request failed with status code 404'), {
      response: {
        status: 404,
        data: { error: { code: 'resource_not_found', details: { reason: 'no_player_diet' } } },
      },
    }),
  );
  await renderProfile({ selectedPlayer: 'Cooper Flagg' });
  expect(screen.getByText('No matchup read for Cooper Flagg this season.')).toBeVisible();
});

test('without an opponent it asks for one, reads nothing and is settled', async () => {
  const onSettled = jest.fn();
  await renderProfile({ selectedTeam: '', onSettled });
  expect(apiClient.get).not.toHaveBeenCalled();
  expect(
    screen.getByText('Pick an opponent in the Opposing Team card to see his matchup against them.'),
  ).toBeVisible();
  expect(onSettled).toHaveBeenLastCalledWith('Toumani Camara', '');
});

test('a late answer for an earlier opponent cannot replace the current card or its readiness', async () => {
  const pending = {};
  apiClient.get.mockImplementation(
    (url, { params }) =>
      new Promise((resolve, reject) => {
        pending[params.opponent] = { resolve, reject };
      }),
  );
  const onSettled = jest.fn();
  const { rerenderWith } = await renderProfile({ onSettled });
  await act(async () => pending.DEN.resolve({ data: matchupFor('DEN') }));
  expect(courtAgainst('DEN')).toBeInTheDocument();

  rerenderWith({ selectedTeam: 'New York Knicks' });
  await act(async () => {});
  expect(courtAgainst('DEN')).not.toBeInTheDocument();
  expect(screen.getByText('Loading data...')).toBeVisible();
  expect(onSettled).not.toHaveBeenCalledWith('Toumani Camara', 'New York Knicks');
  await act(async () => pending.NYK.resolve({ data: matchupFor('NYK') }));
  expect(courtAgainst('NYK')).toBeInTheDocument();
  expect(onSettled).toHaveBeenLastCalledWith('Toumani Camara', 'New York Knicks');

  rerenderWith({ selectedTeam: 'Los Angeles Lakers' });
  await act(async () => {});
  rerenderWith({ selectedTeam: 'Miami Heat' });
  await act(async () => pending.MIA.resolve({ data: matchupFor('MIA') }));
  await act(async () => pending.LAL.reject(failedRequest(500)));
  expect(courtAgainst('MIA')).toBeInTheDocument();
  expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  expect(onSettled).toHaveBeenLastCalledWith('Toumani Camara', 'Miami Heat');
});

test('a contribution that rounds to 0.0% is neither green nor red', async () => {
  const flat = JSON.parse(JSON.stringify(camaraVsDen));
  flat.players[0].scores.AST.season.components.assist_locations.value = 0.0002;
  flat.players[0].scores.AST.season.components.traditional.value = -0.0002;
  flat.players[0].scores.AST.season.blend.value = 0;
  apiClient.get.mockResolvedValue({ data: flat });
  await renderProfile({ lineType: 'PRA' });
  fireEvent.click(within(group('Assists')).getByRole('button', { name: '+1 more' }));
  expect(
    [...group('Assists').querySelectorAll('.pmc-val')].map((value) => [
      value.textContent,
      value.className,
    ]),
  ).toEqual([
    ['0.0%', 'pmc-val '],
    ['0.0%', 'pmc-val '],
    ['0.0%', 'pmc-val '],
  ]);
});
