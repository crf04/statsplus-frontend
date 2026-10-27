import { render } from '@testing-library/react';
import { Chart } from 'chart.js';
import ChartComponent from './ChartComponent';

/* The unit tests in ChartComponent.test.js read the props the component hands
   to <Bar />. These build a real Chart.js chart from those same props, with the
   canvas context stubbed, so the bars' laid-out geometry and draw order are the
   renderer's, not the config's. */

let barProps;
jest.mock('react-chartjs-2', () => ({
  Bar: (props) => {
    barProps = props;
    return null;
  },
}));
jest.mock('./chartSetup', () => {
  jest.requireActual('./chartSetup');
  return {};
});
jest.mock('./MetricsDashboardRow', () => ({ __esModule: true, default: () => null }));
jest.mock('./AppliedFilters', () => ({ __esModule: true, default: () => null }));

const stubContext = () =>
  new Proxy(
    {},
    {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return target.canvas;
        return () => undefined;
      },
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    },
  );

const logs = [
  { GAME_DATE: '2026-01-01', MIN: 30, REB: 8, REB_CHANCES: 15, AST: 7, POTENTIAL_AST: 13 },
  { GAME_DATE: '2026-01-03', MIN: 28, REB: 5, REB_CHANCES: null, AST: 4, POTENTIAL_AST: null },
  { GAME_DATE: '2026-01-05', MIN: 31, REB: 11, REB_CHANCES: 12, AST: 9, POTENTIAL_AST: 10 },
];

const realChart = (lineType) => {
  render(<ChartComponent gameLogs={logs} lineType={lineType} lineValue="" averages={[{}, {}]} />);
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 300;
  const ctx = stubContext();
  ctx.canvas = canvas;
  canvas.getContext = () => ctx;
  const chart = new Chart(canvas, {
    type: 'bar',
    data: barProps.data,
    options: { ...barProps.options, responsive: false, animation: false, devicePixelRatio: 1 },
  });
  return chart;
};

// jsdom does not resolve CSS variables, so the colour hook hands back the
// token; a ladder step names its alpha (--ct-gold-bg-16 paints at 0.16).
const alpha = (color) => Number(/^var\(--ct-[a-z-]+-(\d+)\)$/.exec(color)[1]) / 100;

describe.each([
  ['REB', 'REB_CHANCES'],
  ['AST', 'POTENTIAL_AST'],
])('%s ghost bars in the real renderer', (lineType, chancesKey) => {
  let chart;
  beforeEach(() => {
    chart = realChart(lineType);
  });
  afterEach(() => chart.destroy());

  test('each tracked ghost bar shares its main bar centre and contains it', () => {
    const main = chart.getDatasetMeta(0).data;
    const ghost = chart.getDatasetMeta(1).data;
    [0, 2].forEach((i) => {
      expect(ghost[i].x).toBeCloseTo(main[i].x, 5);
      expect(ghost[i].width).toBeGreaterThanOrEqual(main[i].width);
      expect(ghost[i].base).toBeCloseTo(main[i].base, 5);
      // smaller y is higher on the canvas: the ghost reaches at least as high
      expect(ghost[i].y).toBeLessThan(main[i].y);
    });
    expect(logs[0][chancesKey]).toBeGreaterThan(logs[0][lineType]);
  });

  test('the ghost bar is drawn first, behind the main bar, and is translucent', () => {
    const drawn = [];
    chart.data.datasets.forEach((_, datasetIndex) => {
      chart.getDatasetMeta(datasetIndex).data.forEach((element) => {
        const original = element.draw.bind(element);
        element.draw = (...args) => {
          drawn.push(datasetIndex);
          return original(...args);
        };
      });
    });
    chart.render();
    expect(new Set(drawn)).toEqual(new Set([0, 1]));
    expect(drawn.indexOf(0)).toBeGreaterThan(drawn.lastIndexOf(1));

    const ghost = chart.getDatasetMeta(1).data[0].options.backgroundColor;
    expect(alpha(ghost)).toBeLessThan(0.3);
  });
});
