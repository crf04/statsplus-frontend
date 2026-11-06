import { act, fireEvent, render, screen, within } from '@testing-library/react';
import PlayerProfile from './PlayerProfile';
import { apiClient } from './config';
// Toumani Camara vs DEN as production served it on 2026-11-06 (trimmed to what the card reads).
import camaraVsDen from '../e2e/fixtures/unscheduled-matchup.json';
// The same matchup read for the 2026-27 Evidence season, captured the same day.
import camaraVsDen2627 from '../e2e/fixtures/unscheduled-matchup-2026-27.json';
import { unpublishedSeasons } from './seasonChoicesFixture';

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
  // Each shot type reads DEN's overall points row (Catch and Shoot:PTS and so on).
  expect(rowsOf('Shot types')).toEqual([
    ['Catch & shoot', '52%', '19th', '+3%'],
    ['Less Than 10 ft', '32%', '14th', '−1%'],
    ['Pull-ups', '14%', '24th', '+6%'],
  ]);
  expect(screen.queryByText(/his mix/)).not.toBeInTheDocument();
  expect(rowsOf('Traditional')).toEqual([['DEN: points allowed per 48', '', '18th', '+0.4%']]);
  expect(
    screen.getByRole('img', { name: 'Shot zones half court against DEN' }),
  ).toBeInTheDocument();
  expect(screen.getByText('DEN allows vs league')).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
  expect(rowsOf('Play types')).toHaveLength(9);
});

const withShotTypeRow = (row) => ({
  ...camaraVsDen,
  teams: camaraVsDen.teams.map((team) => ({
    ...team,
    defense_sheet: {
      ...team.defense_sheet,
      shot_types: [...team.defense_sheet.shot_types, row],
    },
  })),
});

test("FGA reads a shot type's overall FGA row when DEN has one", async () => {
  apiClient.get.mockResolvedValue({
    data: withShotTypeRow({
      key: 'Catch and Shoot:FGA',
      markets: ['FGA'],
      season: { rank: 3, percent_vs_league_average: -4.2 },
    }),
  });
  await renderProfile({ lineType: 'FGA' });
  expect(rowsOf('Shot types')[0]).toEqual(['Catch & shoot', '52%', '3rd', '−4%']);
});

test('FGA without an overall row reads the 2PT or 3PT row furthest from league, ranked', async () => {
  await renderProfile({ lineType: 'FGA' });
  expect(rowsOf('Shot types')).toEqual([
    ['Catch & shoot', '52%', '25th', '+13%'],
    ['Less Than 10 ft', '32%', '7th', '−5%'],
    ['Pull-ups', '14%', '28th', '+13%'],
  ]);
});

test("FGM reads a shot type's overall FGM row over the 2PT and 3PT makes rows", async () => {
  apiClient.get.mockResolvedValue({
    data: withShotTypeRow({
      key: 'Catch and Shoot:FGM',
      markets: ['FGM'],
      season: { rank: 9, percent_vs_league_average: -2.1 },
    }),
  });
  await renderProfile({ lineType: 'FGM' });
  expect(rowsOf('Shot types')[0]).toEqual(['Catch & shoot', '52%', '9th', '−2%']);
});

test('FGM without an overall row reads the 2PT or 3PT makes row furthest from league, ranked', async () => {
  await renderProfile({ lineType: 'FGM' });
  expect(rowsOf('Shot types')).toEqual([
    ['Catch & shoot', '52%', '22nd', '+7%'],
    ['Less Than 10 ft', '32%', '14th', '−1%'],
    ['Pull-ups', '14%', '25th', '+10%'],
  ]);
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

const variant = (edit) => {
  const data = JSON.parse(JSON.stringify(camaraVsDen));
  edit(data);
  apiClient.get.mockResolvedValue({ data });
};

test('the picker leaves out a market the response gives no Matchup Score', async () => {
  variant((data) => {
    delete data.players[0].scores.STL;
    data.players[0].scores.BLK.season = {};
  });
  await renderProfile();
  const other = screen
    .getByRole('combobox', { name: 'Market' })
    .querySelector('optgroup[label="Other"]');
  expect([...other.querySelectorAll('option')].map((option) => option.value)).toEqual(['TOV']);
});

test('a stat averages the Bases its own market carries in the response, and divides by their count', async () => {
  // PTS scored on three Bases (no Shot types), its Blend their mean; the PRA score the sum.
  variant((data) => {
    const pts = data.players[0].scores.PTS.season;
    delete pts.components.shot_types;
    pts.blend.value =
      (pts.components.play_types.value +
        pts.components.shot_zones.value +
        pts.components.traditional.value) /
      3;
    data.players[0].scores.PRA.season.blend.value = 0.010583;
  });
  await renderProfile({ lineType: 'PRA' });
  fireEvent.click(within(group('Points')).getByRole('button', { name: '+2 more' }));
  expect(groupHead('Points')).toBe('+1.4%');
  expect(baseBars('Points')).toEqual(['▸Play types+1.0%', '▸Shot zones+0.3%', '▸Traditional+0.1%']);
  expect(screen.getByText('PRA score').parentElement).toHaveTextContent('PRA score+1.1%');
});

test("a points market reads a slice's own PTS row even when another row sits further from league", async () => {
  variant((data) => {
    data.teams[0].defense_sheet.play_types.push({
      key: 'Spotup:FTA',
      markets: ['PTS', 'FTA'],
      season: { rank: 30, percent_vs_league_average: 40 },
    });
  });
  await renderProfile();
  expect(rowsOf('Play types')[0]).toEqual(['Spot up', '41%', '27th', '+10%']);
});

test('the court tints each zone by its % vs league, green for more and red for less', async () => {
  await renderProfile();
  const court = screen.getByRole('img', { name: 'Shot zones half court against DEN' });
  // Above-break 3, both corners, mid-range, paint, restricted area, in drawing order.
  expect(
    [...court.querySelectorAll('[fill]')]
      .map((shape) => shape.getAttribute('fill'))
      .filter((fill) => fill.startsWith('rgb(')),
  ).toEqual([
    'rgb(var(--ct-miss-fill-rgb) / 0.13)',
    'rgb(var(--ct-hit-fill-rgb) / 0.40)',
    'rgb(var(--ct-hit-fill-rgb) / 0.40)',
    'rgb(var(--ct-hit-fill-rgb) / 0.31)',
    'rgb(var(--ct-hit-fill-rgb) / 0.32)',
    'rgb(var(--ct-miss-fill-rgb) / 0.22)',
  ]);
});

test('every W3 bar sits on one scale, the largest contribution reaching the edge', async () => {
  await renderProfile({ lineType: 'PRA' });
  fireEvent.click(within(group('Points')).getByRole('button', { name: '+3 more' }));
  const widths = (name) =>
    [...group(name).querySelectorAll('.pmc-bar > i')].map((bar) => bar.style.width);
  expect(widths('Points')).toEqual(['50%', '30.6%', '9.2%', '7.8%', '2.5%']);
  expect(widths('Rebounds')).toEqual(['24.3%', '14%']);
  expect(
    screen.getByText('PRA score').parentElement.querySelector('.pmc-bar > i').style.width,
  ).toBe('35%');
});

/*
 * Fit to space. jsdom has no layout, so the boxes the fit measures are faked: each Base row is
 * `rowHeight` tall, "+N more" 20, each stat header and the total row 30, the sheet their sum.
 * In jsdom the card has no neighbour, so the room is the phone budget, 640.
 */
describe('fit to space', () => {
  let rowHeight;
  const box = (height) => ({ top: 0, bottom: height, height, left: 0, right: 0, width: 0 });
  beforeEach(() => {
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function measure() {
      if (this.classList.contains('pmc-w3-base')) return box(rowHeight);
      if (this.classList.contains('pmc-w3-more')) return box(20);
      if (this.querySelector(':scope > [data-fit-group]')) {
        const sections = [...this.querySelectorAll(':scope > [data-fit-group]')];
        return box(
          sections.reduce(
            (sum, section) =>
              sum +
              30 +
              section.querySelectorAll('.pmc-w3-base').length * rowHeight +
              section.querySelectorAll('.pmc-w3-more').length * 20,
            30,
          ),
        );
      }
      return box(0);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  const more = () =>
    screen
      .getAllByRole('region')
      .map((section) => [
        section.getAttribute('aria-label'),
        section.querySelector('.pmc-w3-more')?.textContent ?? null,
      ]);
  const resize = (height) =>
    act(() => {
      rowHeight = height;
      window.dispatchEvent(new Event('resize'));
    });

  test('with room for every group, all open and none offers "+N more"', async () => {
    rowHeight = 20;
    await renderProfile({ lineType: 'PRA' });
    expect(more()).toEqual([
      ['Points', null],
      ['Rebounds', null],
      ['Assists', null],
    ]);
    expect(baseBars('Points')).toHaveLength(4);
  });

  test('with no room, every group stays compact behind "+N more"', async () => {
    rowHeight = 200;
    await renderProfile({ lineType: 'PRA' });
    expect(more()).toEqual([
      ['Points', '+3 more'],
      ['Rebounds', '+1 more'],
      ['Assists', '+1 more'],
    ]);
  });

  test('at the boundary only the group that does not fit offers "+N more"', async () => {
    // Compact sheet 480; Points needs 280 more (no), then Rebounds 80 (560) and Assists 80 (640).
    rowHeight = 100;
    await renderProfile({ lineType: 'PRA' });
    expect(more()).toEqual([
      ['Points', '+3 more'],
      ['Rebounds', null],
      ['Assists', null],
    ]);
  });

  test('a resize fits again', async () => {
    rowHeight = 200;
    await renderProfile({ lineType: 'PRA' });
    resize(20);
    expect(more()).toEqual([
      ['Points', null],
      ['Rebounds', null],
      ['Assists', null],
    ]);
    resize(200);
    expect(more()).toEqual([
      ['Points', '+3 more'],
      ['Rebounds', '+1 more'],
      ['Assists', '+1 more'],
    ]);
  });

  test('a group the reader opened survives a resize, and the fit no longer moves', async () => {
    rowHeight = 200;
    await renderProfile({ lineType: 'PRA' });
    fireEvent.click(within(group('Rebounds')).getByRole('button', { name: '+1 more' }));
    resize(20);
    expect(more()).toEqual([
      ['Points', '+3 more'],
      ['Rebounds', 'Show less'],
      ['Assists', '+1 more'],
    ]);
  });

  test('a new market starts the fit over, whatever the reader opened before', async () => {
    rowHeight = 200;
    const { rerenderWith } = await renderProfile({ lineType: 'PRA' });
    fireEvent.click(within(group('Points')).getByRole('button', { name: '+3 more' }));
    rowHeight = 20;
    await act(async () => rerenderWith({ lineType: 'PA' }));
    expect(more()).toEqual([
      ['Points', null],
      ['Assists', null],
    ]);
  });
});

/*
 * The Workspace's Evidence season (crf04/statsplus#453): the choice the Opposing Team Profile
 * also reads, null for the default season.
 */
describe('Evidence season', () => {
  const season2627 = unpublishedSeasons.choices.find((choice) => choice.season === '2026-27');
  const bySeason = (params) => (params.season === '2026-27' ? camaraVsDen2627 : camaraVsDen);
  const requests = () => apiClient.get.mock.calls.map(([url, { params }]) => [url, params]);
  const header = () => screen.getByText(/· data as of/).textContent;
  beforeEach(() => {
    apiClient.get.mockImplementation((url, { params }) =>
      Promise.resolve({ data: bySeason(params) }),
    );
  });

  test('2026-27 is asked for and read: header, Spot up, and a low-confidence score', async () => {
    await renderProfile({ seasonChoice: season2627 });
    expect(requests()).toEqual([
      [
        'MATCHUP_UNSCHEDULED',
        { player_name: 'Toumani Camara', opponent: 'DEN', season: '2026-27' },
      ],
    ]);
    expect(header()).toBe('Toumani Camara vs DEN · 2026-27 · data as of Nov 6');
    expect(rowsOf('Play types')[0]).toEqual(['Spot up', '56%', '28th', '+22%']);
    expect(screen.getByTitle('PTS Season Matchup Score')).toHaveTextContent('+7.0%');
    // The pill's marker, then the Play types Base, the one thin component.
    expect(
      screen.getAllByText('low confidence').map((marker) => marker.getAttribute('title')),
    ).toEqual([
      'Low confidence: thin evidence in Play types',
      'Low confidence: thin evidence in Play types',
    ]);
    expect(screen.getByText('low confidence', { selector: '.pmc-score *' })).toBeVisible();
    expect(screen.getByText('Play types').parentElement).toHaveTextContent(
      'Play typeslow confidence',
    );
  });

  test('the default season names none, reads 2025-26 and shows no marker', async () => {
    await renderProfile();
    expect(requests()).toEqual([
      ['MATCHUP_UNSCHEDULED', { player_name: 'Toumani Camara', opponent: 'DEN' }],
    ]);
    expect(header()).toBe('Toumani Camara vs DEN · 2025-26 · data as of Aug 24');
    expect(rowsOf('Play types')[0]).toEqual(['Spot up', '41%', '27th', '+10%']);
    expect(screen.queryByText('low confidence')).not.toBeInTheDocument();
  });

  test('a combo marks the stat whose score is low confidence and its thin Base', async () => {
    await renderProfile({ seasonChoice: season2627, lineType: 'PRA' });
    fireEvent.click(within(group('Points')).getByRole('button', { name: /more$/ }));
    expect(within(group('Points')).getAllByText('low confidence')).toHaveLength(2);
    expect(
      [...group('Points').querySelectorAll('.pmc-w3-toggle')]
        .filter((button) => button.textContent.includes('low confidence'))
        .map((button) => button.querySelector('.pmc-w3-name').textContent),
    ).toEqual(['Play typeslow confidence']);
  });

  test('a new season reads again, and a late answer for the season left behind changes nothing', async () => {
    const pending = {};
    apiClient.get.mockImplementation(
      (url, { params }) =>
        new Promise((resolve) => {
          pending[params.season ?? 'default'] = () => resolve({ data: bySeason(params) });
        }),
    );
    const onSettled = jest.fn();
    const { rerenderWith } = await renderProfile({ seasonChoice: season2627, onSettled });
    // The reader moves back to the default season before 2026-27 answers.
    rerenderWith({ seasonChoice: null });
    await act(async () => {});
    expect(screen.getByText('Loading data...')).toBeVisible();
    await act(async () => pending.default());
    await act(async () => pending['2026-27']());
    expect(header()).toBe('Toumani Camara vs DEN · 2025-26 · data as of Aug 24');
    expect(rowsOf('Play types')[0]).toEqual(['Spot up', '41%', '27th', '+10%']);
    expect(screen.queryByText('low confidence')).not.toBeInTheDocument();
    expect(onSettled).toHaveBeenLastCalledWith('Toumani Camara', 'Denver Nuggets');

    // And forward again: 2026-27 is read afresh.
    rerenderWith({ seasonChoice: season2627 });
    await act(async () => {});
    await act(async () => pending['2026-27']());
    expect(header()).toBe('Toumani Camara vs DEN · 2026-27 · data as of Nov 6');
    expect(rowsOf('Play types')[0]).toEqual(['Spot up', '56%', '28th', '+22%']);
  });

  // Each flag on its own: the selected score's, a lone component's, a Base's, the Rebound Diet's.
  const flagged = (season, edit) => {
    const data = JSON.parse(JSON.stringify(season === '2026-27' ? camaraVsDen2627 : camaraVsDen));
    edit(data.players[0]);
    apiClient.get.mockResolvedValue({ data });
  };
  const markers = () =>
    screen
      .getAllByText('low confidence')
      .map((marker) => [marker.parentElement.className, marker.getAttribute('title')]);

  test('a market whose own score is not flagged has no marker, whatever his Play types Diet says', async () => {
    // 2026-27 AST: Blend and components not thin, while his Play types Diet is thin.
    expect(camaraVsDen2627.players[0].diet_thin.play_types).toBe(true);
    await renderProfile({ seasonChoice: season2627, lineType: 'AST' });
    expect(screen.getByTitle('AST Season Matchup Score')).toHaveTextContent('+5.7%');
    expect(screen.queryByText('low confidence')).not.toBeInTheDocument();
  });

  test("a one-Base score with no Blend takes its component's flag", async () => {
    flagged('2025-26', (player) => {
      delete player.scores.STKS.season.blend;
      player.scores.STKS.season.components.traditional.thin = true;
    });
    await renderProfile({ lineType: 'STKS' });
    expect(screen.getByTitle('STKS Season Matchup Score')).toHaveTextContent('−6.9%');
    expect(markers()).toEqual([
      ['pmc-score', 'Low confidence: thin evidence in Traditional'],
      ['pmc-base', 'Low confidence: thin evidence in Traditional'],
    ]);
  });

  test('a thin Traditional component marks the Traditional heading only', async () => {
    flagged('2025-26', (player) => {
      player.scores.PTS.season.components.traditional.thin = true;
    });
    await renderProfile();
    expect(markers()).toEqual([['pmc-base', 'Low confidence: thin evidence in Traditional']]);
    expect(screen.getByText('Traditional', { selector: '.pmc-base' })).toHaveTextContent(
      'Traditionallow confidence',
    );
  });

  test('a thin Rebound types Diet marks the Rebound types Base', async () => {
    flagged('2025-26', (player) => {
      player.diet_thin.rebound_types = true;
    });
    await renderProfile({ lineType: 'REB' });
    expect(markers()).toEqual([['pmc-base', 'Low confidence: thin evidence in Rebound types']]);
    expect(screen.getByText('Rebound types', { selector: '.pmc-base' })).toHaveTextContent(
      'Rebound typeslow confidence',
    );
  });

  test("a season change hides the last season's read while the new one is pending", async () => {
    const pending = {};
    apiClient.get.mockImplementation(
      (url, { params }) =>
        new Promise((resolve) => {
          pending[params.season ?? 'default'] = () => resolve({ data: bySeason(params) });
        }),
    );
    const { rerenderWith } = await renderProfile({ seasonChoice: season2627 });
    await act(async () => pending['2026-27']());
    expect(rowsOf('Play types')[0]).toEqual(['Spot up', '56%', '28th', '+22%']);

    rerenderWith({ seasonChoice: null });
    await act(async () => {});
    expect(screen.getByText('Loading data...')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Play types' })).not.toBeInTheDocument();
    expect(screen.queryByText(/· 2026-27 ·/)).not.toBeInTheDocument();

    await act(async () => pending.default());
    expect(rowsOf('Play types')[0]).toEqual(['Spot up', '41%', '27th', '+10%']);
  });

  test('a season the backend refuses says it is not available yet', async () => {
    apiClient.get.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 503'), {
        response: {
          status: 503,
          data: {
            error: {
              code: 'season_unavailable',
              details: { selected_season: '2026-27', published_season: '2025-26' },
            },
          },
        },
      }),
    );
    await renderProfile({ seasonChoice: season2627 });
    expect(screen.getByText("2026-27 isn't available yet.")).toBeVisible();
  });
});
