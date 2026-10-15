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

const show = async (category, data) => {
  apiClient.get.mockResolvedValue({ data });
  render(<OpposingTeamProfile teams={['Charlotte Hornets']} selectedTeam="Charlotte Hornets" />);
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
