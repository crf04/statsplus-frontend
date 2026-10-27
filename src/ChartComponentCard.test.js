import { render, screen } from '@testing-library/react';
import ChartComponent from './ChartComponent';
import MetricsDashboardRow from './MetricsDashboardRow';

let barProps;
jest.mock('react-chartjs-2', () => ({
  Bar: (props) => {
    barProps = props;
    return null;
  },
}));
jest.mock('./chartSetup', () => ({}));

const logs = [
  { GAME_DATE: '2026-03-10', MATCHUP: 'ATL vs ORL', MIN: 34, PTS: 27 },
  { GAME_DATE: '2026-03-12', MATCHUP: 'ATL @ MIA', MIN: 30, PTS: 12 },
];
const averages = [
  { PTS: 19.5, MIN: 32 },
  { PTS: 22.5, MIN: 32 },
];

const renderCard = (appliedFilters) =>
  render(
    <ChartComponent
      gameLogs={logs}
      lineType="PTS"
      lineValue="21.5"
      averages={averages}
      appliedFilters={appliedFilters}
    />,
  );

test('the cards read the filtered average, per 36 and hit rate against the season', () => {
  const { container } = renderCard({});
  const cards = [...container.querySelectorAll('.metric-card')].map((card) => card.textContent);
  expect(cards).toEqual([
    'PTS avg19.50 from 22.50−13.3%',
    'Per-3621.94 from 25.31−13.3%',
    'Hit rate1/2 50%L5 1/2 · L10 1/2',
  ]);
});

test('the filter chips leave out the player the Player box already names', () => {
  renderCard({ player_name: 'Jalen Johnson', game_filter: 15 });
  expect(screen.queryByText('Player: Jalen Johnson')).toBeNull();
  expect(screen.getByText('GAMES <= 15')).toBeVisible();
});

test('dates under the bars read M/D, unrotated, and the y axis has no title', () => {
  renderCard({});
  const { x, y } = barProps.options.scales;
  const tick = (label) => x.ticks.callback.call({ getLabelForValue: () => label }, 0);
  expect(tick('2026-03-10')).toBe('3/10');
  expect(tick('2025-11-01')).toBe('11/1');
  expect(x.ticks.maxRotation).toBe(0);
  expect(x.ticks.maxTicksLimit).toBe(8);
  expect(y.title).toBeUndefined();
  expect(barProps.options.maintainAspectRatio).toBe(false);
});

test('an unchanged value reads ±0%, and a change from a zero season value reads —', () => {
  const { container } = render(
    <MetricsDashboardRow
      lineType="AST"
      rawValue={4}
      seasonRawValue={4}
      per36Value={2}
      seasonPer36Value={0}
      ratio="3/5"
      last5ratio="3/5"
      last10ratio="3/5"
    />,
  );
  const changes = [...container.querySelectorAll('.metric-change')].map((pill) => [
    pill.textContent,
    pill.className,
  ]);
  expect(changes).toEqual([
    ['±0%', 'metric-change'],
    ['—', 'metric-change'],
  ]);
});

test('a higher filtered value is a green plus, a lower one a red minus', () => {
  const { container } = render(
    <MetricsDashboardRow
      lineType="REB"
      rawValue={11}
      seasonRawValue={10}
      per36Value={9}
      seasonPer36Value={10}
      ratio="0/0"
    />,
  );
  const changes = [...container.querySelectorAll('.metric-change')].map((pill) => [
    pill.textContent,
    pill.className,
  ]);
  expect(changes).toEqual([
    ['+10.0%', 'metric-change is-up'],
    ['−10.0%', 'metric-change is-down'],
  ]);
  expect(container.querySelectorAll('.metric-card')[2].textContent).toBe(
    'Hit rate0/0 —L5 — · L10 —',
  );
});
