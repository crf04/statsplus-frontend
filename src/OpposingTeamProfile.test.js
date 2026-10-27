import { act, fireEvent, render, screen, within } from '@testing-library/react';
import OpposingTeamProfile from './OpposingTeamProfile';
import { apiClient } from './config';

jest.mock('./config', () => ({ apiClient: { get: jest.fn() }, getApiUrl: (key) => key }));

const traditional = {
  OPP_PTS: 110.76082004555809,
  OPP_PTS_RANK: 7,
  OPP_PTS_vs_avg_pct: -3.6904371197442942,
  OPP_FTA: 20.300683371298405,
  OPP_FTA_RANK: 1,
  OPP_FTA_vs_avg_pct: -13.09613820198009,
};
const playtypes = { Misc: 1.171157615146854, Misc_RANK: 29 };

const show = async (category, data, seasonChoice) => {
  apiClient.get.mockResolvedValue({ data });
  render(
    <OpposingTeamProfile
      teams={['Charlotte Hornets']}
      selectedTeam="Charlotte Hornets"
      seasonChoice={seasonChoice}
    />,
  );
  if (category !== 'Traditional') {
    fireEvent.change(screen.getByDisplayValue('Traditional'), { target: { value: category } });
  }
  await act(async () => {});
};

beforeEach(() => jest.clearAllMocks());

test('Traditional shows each reading as a labelled bar, split into two columns', async () => {
  await show('Traditional', traditional);
  const columns = screen.getAllByTestId('opponent-bars-column');
  expect(columns).toHaveLength(2);
  const scoring = within(columns[0]);
  expect(scoring.getByText('Scoring')).toBeInTheDocument();
  expect(scoring.getByText('Points')).toBeInTheDocument();
  expect(scoring.getByText('110.8')).toBeInTheDocument();
  expect(scoring.getByText('−3.7%')).toBeInTheDocument();
  expect(scoring.getByTitle('Rank 7 of 30')).toHaveTextContent('7');
  expect(scoring.getByText('−13%')).toBeInTheDocument();
  expect(within(columns[1]).getByText('Defense events')).toBeInTheDocument();
  // Bars grow from the centre line in proportion to the gap, on a ±15% scale.
  const bar = (label) =>
    screen.getByText(label).closest('[role="listitem"]').querySelector('.opp-bars-fill');
  expect(bar('Points')).toHaveClass('opp-bars-fill-less');
  expect(bar('Points').style.right).toBe('50%');
  expect(parseFloat(bar('Points').style.width)).toBeCloseTo(12.3, 1);
  expect(parseFloat(bar('FT attempts').style.width)).toBeCloseTo(43.65, 1);
  expect(screen.queryByText('Value (Rank & vs Avg %)')).not.toBeInTheDocument();
});

test('Playtypes stay in one column with percent vs league and no footnote', async () => {
  await show('Playtypes', playtypes);
  expect(screen.getAllByTestId('opponent-bars-column')).toHaveLength(1);
  expect(screen.getByText('Misc')).toBeInTheDocument();
  expect(screen.getByText('+17%')).toBeInTheDocument();
  expect(screen.getByTitle('Rank 29 of 30')).toBeInTheDocument();
  expect(screen.queryByText(/relative to league average/)).not.toBeInTheDocument();
});

test('a Shooting Type payload with no rows says so', async () => {
  await show('Shooting Type', []);
  expect(screen.getByText('No data available for Shooting Type stats.')).toBeInTheDocument();
});

test('no team selected asks for one', async () => {
  apiClient.get.mockResolvedValue({ data: traditional });
  render(<OpposingTeamProfile teams={['Charlotte Hornets']} selectedTeam="" />);
  await act(async () => {});
  expect(screen.getByText('Select a team and category to view stats.')).toBeInTheDocument();
  expect(apiClient.get).not.toHaveBeenCalled();
});

const early = { season: '2026-27', mode: 'unpublished', teamGames: { min: 2, max: 4 } };
const sentParams = () => apiClient.get.mock.calls.map(([, options]) => options.params);
const wrapped = (data, trailing = []) => ({
  data,
  season_context: { selected_season: '2026-27', published_season: '2025-26' },
  trailing,
});

test('an Evidence season choice is sent as season and named over the bars', async () => {
  await show('Traditional', wrapped(traditional), early);
  expect(sentParams()).toEqual([
    { category: 'Traditional', team: 'Charlotte Hornets', date: null, season: '2026-27' },
  ]);
  expect(
    screen.getByText('Evidence season 2026-27 · early, 2–4 games per team'),
  ).toBeInTheDocument();
  expect(screen.getByText('Points')).toBeInTheDocument();
  expect(screen.getByText('110.8')).toBeInTheDocument();
});

test('without a choice no season is sent and the bare body renders unlabelled', async () => {
  await show('Traditional', traditional);
  expect(sentParams()).toEqual([
    { category: 'Traditional', team: 'Charlotte Hornets', date: null },
  ]);
  expect(screen.getByText('110.8')).toBeInTheDocument();
  expect(screen.queryByText(/Evidence season/)).toBeNull();
});

test('a backend that predates the season answers a choice with the bare body, which still renders', async () => {
  await show('Traditional', traditional, early);
  expect(screen.getByText('110.8')).toBeInTheDocument();
  expect(screen.queryByText(/Evidence season/)).toBeNull();
});

test('a trailing team defense family is named with its sample', async () => {
  await show(
    'Traditional',
    wrapped(traditional, [
      {
        family: 'team_defense',
        serving_season: '2025-26',
        rule: 'every team has played a game',
        team_games: { min: 82, max: 82 },
      },
    ]),
    early,
  );
  expect(
    screen.getByText(
      'Profile numbers use 2025-26 team defense (82 games per team) until every team has played a game.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('110.8')).toBeInTheDocument();
});

test('an empty wrapped body says there is no data', async () => {
  await show('Shooting Type', wrapped([]), early);
  expect(screen.getByText('No data available for Shooting Type stats.')).toBeInTheDocument();
});

test('an empty wrapped Traditional body says there is no data, with no bars', async () => {
  await show('Traditional', wrapped({}), early);
  expect(screen.getByText('No data available for Traditional stats.')).toBeInTheDocument();
  expect(screen.queryAllByTestId('opponent-bars-column')).toEqual([]);
});

const published = { season: '2025-26', mode: 'published', teamGames: null };

test('any Evidence season choice is sent as its own season', async () => {
  await show('Traditional', wrapped(traditional), published);
  expect(sentParams()).toEqual([
    { category: 'Traditional', team: 'Charlotte Hornets', date: null, season: '2025-26' },
  ]);
});

test('a new Evidence season choice reads again with that season', async () => {
  apiClient.get.mockResolvedValue({ data: wrapped(traditional) });
  const { rerender } = render(
    <OpposingTeamProfile
      teams={['Charlotte Hornets']}
      selectedTeam="Charlotte Hornets"
      seasonChoice={early}
    />,
  );
  await act(async () => {});
  rerender(
    <OpposingTeamProfile
      teams={['Charlotte Hornets']}
      selectedTeam="Charlotte Hornets"
      seasonChoice={published}
    />,
  );
  await act(async () => {});
  expect(sentParams().map((params) => params.season)).toEqual(['2026-27', '2025-26']);
});

test('a season that is not offered shows the unavailable text', async () => {
  apiClient.get.mockRejectedValue({
    response: {
      status: 503,
      data: {
        error: {
          code: 'season_unavailable',
          message: 'Season 2026-27 is unavailable.',
          details: { selected_season: '2026-27', published_season: '2025-26' },
        },
      },
    },
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <OpposingTeamProfile
      teams={['Charlotte Hornets']}
      selectedTeam="Charlotte Hornets"
      seasonChoice={early}
    />,
  );
  await act(async () => {});
  expect(screen.getByText("2026-27 isn't available yet.")).toBeInTheDocument();
  expect(screen.queryByText('Select a team and category to view stats.')).toBeNull();
  console.error.mockRestore();
});
