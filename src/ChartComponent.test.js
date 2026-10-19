import { render } from '@testing-library/react';
import ChartComponent from './ChartComponent';

let barProps;
jest.mock('react-chartjs-2', () => ({
  Bar: (props) => {
    barProps = props;
    return null;
  },
}));
jest.mock('./chartSetup', () => ({}));
jest.mock('./MetricsDashboardRow', () => ({ __esModule: true, default: () => null }));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));

const averages = [
  { PTS: 31.3, MIN: 34 },
  { PTS: 24.7, MIN: 30 },
];

test('without an explicit line the chart draws the season average', () => {
  render(
    <ChartComponent
      gameLogs={[{ GAME_DATE: '2026-01-01', PTS: 20 }]}
      lineType="PTS"
      lineValue=""
      averages={averages}
    />,
  );
  const line = barProps.options.plugins.annotation.annotations.line1;
  expect(line.yMin).toBe(24.7);
  expect(line.label.content).toEqual(['Season avg: 24.7']);
});

const postedLine = {
  gameDate: '2026-10-21',
  matchup: 'GSW vs LAL',
  lines: { PTS: { value: 26.5, provider: 'prizepicks' } },
};

const lineLabel = (lineValue, lineIsPosted) => {
  render(
    <ChartComponent
      gameLogs={[{ GAME_DATE: '2026-01-01', PTS: 20 }]}
      lineType="PTS"
      lineValue={lineValue}
      averages={averages}
      postedLine={postedLine}
      lineIsPosted={lineIsPosted}
    />,
  );
  const { label } = barProps.options.plugins.annotation.annotations.line1;
  expect(label.display).toBe(true);
  return label.content;
};

test('the posted line is labelled with its provider and game', () => {
  expect(lineLabel('26.5', true)).toEqual(['PrizePicks 26.5', 'GSW vs LAL · Wed, Oct 21']);
});

test('a typed line keeps the plain label, even at the posted value', () => {
  expect(lineLabel('30', false)).toEqual(['Line: 30']);
  expect(lineLabel('26.5', false)).toEqual(['Line: 26.5']);
});
