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
  expect(line.label.content).toBe('Season avg: 24.7');
});
