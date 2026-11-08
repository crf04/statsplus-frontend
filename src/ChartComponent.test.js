import { render } from '@testing-library/react';
import ChartComponent from './ChartComponent';
import { decodeGameLogsResponse } from './gameLogsApi';

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

const { postedLine } = decodeGameLogsResponse({
  game_logs: [],
  posted_line: {
    game_date: '2026-10-21',
    matchup: 'GSW vs LAL',
    lines: { PTS: { value: 26.5, provider: 'prizepicks' } },
  },
});

const lineLabel = (lineValue, lineSource) => {
  render(
    <ChartComponent
      gameLogs={[{ GAME_DATE: '2026-01-01', PTS: 20 }]}
      lineType="PTS"
      lineValue={lineValue}
      averages={averages}
      postedLine={postedLine}
      lineSource={lineSource}
    />,
  );
  const { label } = barProps.options.plugins.annotation.annotations.line1;
  expect(label.display).toBe(true);
  return label.content;
};

test('the posted line is labelled with its provider and game', () => {
  expect(lineLabel('26.5', 'provider:prizepicks')).toEqual([
    'PrizePicks 26.5',
    'GSW vs LAL · Wed, Oct 21',
  ]);
});

test('a typed line keeps the plain label, even at the posted value', () => {
  expect(lineLabel('30', null)).toEqual(['Line: 30']);
  expect(lineLabel('26.5', null)).toEqual(['Line: 26.5']);
});

test('the points tooltip adds the shot attempts behind the points', () => {
  const logs = [
    { GAME_DATE: '2026-01-01', MATCHUP: 'LAL @ BOS', MIN: 34, PTS: 28, FGA: 19, FG3A: 7 },
  ];
  const tooltipFor = (lineType) => {
    render(<ChartComponent gameLogs={logs} lineType={lineType} lineValue="" averages={averages} />);
    const { callbacks } = barProps.options.plugins.tooltip;
    return callbacks.label({ dataIndex: 0, raw: barProps.data.datasets[0].data[0] });
  };
  expect(tooltipFor('PTS')).toEqual(['OPP: BOS', 'MIN: 34', 'PTS: 28', 'FGA: 19', '3PA: 7']);
  expect(tooltipFor('FGA')).toEqual(['OPP: BOS', 'MIN: 34', 'FGA: 19']);
});

describe('the opponent line names its rank in the charted stat', () => {
  const tooltipFor = (lineType, opponentRanks, MATCHUP = 'LAL vs. BOS') => {
    const logs = [
      { GAME_DATE: '2026-01-01', MATCHUP, MIN: 34, PTS: 31, FGA: 20, FG3A: 8, PRA: 45 },
    ];
    render(
      <ChartComponent
        gameLogs={logs}
        lineType={lineType}
        lineValue=""
        averages={averages}
        opponentRanks={opponentRanks}
      />,
    );
    const { callbacks } = barProps.options.plugins.tooltip;
    return callbacks.label({ dataIndex: 0, raw: barProps.data.datasets[0].data[0] });
  };
  const ranks = (BOS) => ({ PTS: { label: 'Points Allowed', ranks: { BOS } } });

  test("a PTS chart reads the opponent's Points Allowed rank", () => {
    expect(tooltipFor('PTS', ranks(27))).toEqual([
      'OPP: BOS',
      '27th PTS Allowed',
      'MIN: 34',
      'PTS: 31',
      'FGA: 20',
      '3PA: 8',
    ]);
  });

  test('ranks read as ordinals', () => {
    expect(tooltipFor('PTS', ranks(1)).slice(0, 2)).toEqual(['OPP: BOS', '1st PTS Allowed']);
    expect(tooltipFor('PTS', ranks(22)).slice(0, 2)).toEqual(['OPP: BOS', '22nd PTS Allowed']);
  });

  test('the rank keeps a Forced verb and drops a label with neither verb', () => {
    const rankLine = (lineType, label) =>
      tooltipFor(lineType, { [lineType]: { label, ranks: { BOS: 17 } } })[1];
    expect(rankLine('TOV', 'Turnovers Forced')).toBe('17th TOV Forced');
    expect(rankLine('STL', 'Steals')).toBe('17th STL');
  });

  test('a line type with no ranking keeps the plain opponent', () => {
    expect(tooltipFor('PRA', ranks(27))).toEqual(['OPP: BOS', 'MIN: 34', 'PRA: 45']);
  });

  test('without rankings, or for an unranked opponent, the opponent stays plain', () => {
    const plain = (opponent) => [`OPP: ${opponent}`, 'MIN: 34', 'PTS: 31', 'FGA: 20', '3PA: 8'];
    expect(tooltipFor('PTS', undefined)).toEqual(plain('BOS'));
    expect(tooltipFor('PTS', {})).toEqual(plain('BOS'));
    expect(tooltipFor('PTS', ranks(27), 'LAL @ DEN')).toEqual(plain('DEN'));
  });
});

describe('tracking ghost bars', () => {
  const logs = [
    {
      GAME_DATE: '2026-01-01',
      MATCHUP: 'LAL @ BOS',
      MIN: 30,
      REB: 8,
      REB_CHANCES: 15,
      AST: 7,
      POTENTIAL_AST: 13,
      PTS: 20,
    },
    {
      GAME_DATE: '2026-01-03',
      MATCHUP: 'LAL vs. DEN',
      MIN: 28,
      REB: 8,
      REB_CHANCES: null,
      AST: 7,
      POTENTIAL_AST: null,
      PTS: 20,
    },
  ];
  const draw = (lineType, extra = {}) => {
    render(
      <ChartComponent
        gameLogs={logs}
        lineType={lineType}
        lineValue=""
        averages={averages}
        {...extra}
      />,
    );
    return barProps;
  };
  const tooltipLines = (props, index) => {
    const { callbacks } = props.options.plugins.tooltip;
    return callbacks.label({ dataIndex: index, raw: props.data.datasets[0].data[index] });
  };

  test('REB and AST add a ghost dataset of the tracked values, null for an untracked game', () => {
    const reb = draw('REB');
    expect(reb.data.datasets.map((d) => d.label)).toEqual(['REB', 'Rebound chances']);
    expect(reb.data.datasets[1].data).toEqual([15, null]);
    expect(reb.options.plugins.legend.display).toBe(true);
    const ast = draw('AST');
    expect(ast.data.datasets.map((d) => d.label)).toEqual(['AST', 'Potential assists']);
    expect(ast.data.datasets[1].data).toEqual([13, null]);
  });

  test('other line types have no ghost bar and no legend', () => {
    const pts = draw('PTS');
    expect(pts.data.datasets).toHaveLength(1);
    expect(pts.options.plugins.legend.display).toBe(false);
  });

  test('tooltip names the chances and conversion, or says the game is not tracked', () => {
    const reb = draw('REB');
    expect(tooltipLines(reb, 0)[2]).toBe('REB 8 · 15 chances · 53%');
    expect(tooltipLines(reb, 1)[2]).toBe('REB 8 · not tracked');
    const ast = draw('AST');
    expect(tooltipLines(ast, 0)[2]).toBe('AST 7 · 13 potential · 54%');
    expect(tooltipLines(ast, 1)[2]).toBe('AST 7 · not tracked');
  });

  test('a REB rank line sits under the opponent and leaves the tracked stat line intact', () => {
    const reb = draw('REB', {
      opponentRanks: { REB: { label: 'Rebounds Allowed', ranks: { BOS: 22, DEN: 4 } } },
    });
    expect(tooltipLines(reb, 0)).toEqual([
      'OPP: BOS',
      '22nd REB Allowed',
      'MIN: 30',
      'REB 8 · 15 chances · 53%',
    ]);
    expect(tooltipLines(reb, 1)).toEqual([
      'OPP: DEN',
      '4th REB Allowed',
      'MIN: 28',
      'REB 8 · not tracked',
    ]);
  });

  test('the tooltip lists a game once, from the main bar', () => {
    const { filter } = draw('REB').options.plugins.tooltip;
    expect(filter({ datasetIndex: 0 })).toBe(true);
    expect(filter({ datasetIndex: 1 })).toBe(false);
  });

  test('the averages row shows the average and the season value, and hides when null', () => {
    const avg = [
      {
        REB: 8,
        AST: 7,
        MIN: 30,
        REB_CHANCES: 15.8,
        REB_CONV_PCT: 0.59,
        POTENTIAL_AST: 12.1,
        AST_CONV_PCT: 0.58,
      },
      {
        REB: 7,
        AST: 6,
        MIN: 30,
        REB_CHANCES: 14.2,
        REB_CONV_PCT: 0.57,
        POTENTIAL_AST: null,
        AST_CONV_PCT: null,
      },
    ];
    const { unmount } = render(
      <ChartComponent gameLogs={logs} lineType="REB" lineValue="" averages={avg} />,
    );
    expect(document.querySelector('.tracking-averages').textContent).toBe(
      'Chances 15.8 · season 14.2',
    );
    unmount();
    const ast = render(
      <ChartComponent gameLogs={logs} lineType="AST" lineValue="" averages={avg} />,
    );
    // season value null: the season part is dropped
    expect(document.querySelector('.tracking-averages').textContent).toBe('Potential 12.1');
    ast.unmount();
    render(
      <ChartComponent
        gameLogs={logs}
        lineType="AST"
        lineValue=""
        averages={[avg[0], { ...avg[1], POTENTIAL_AST: 11.4 }]}
      />,
    );
    expect(document.querySelector('.tracking-averages').textContent).toBe(
      'Potential 12.1 · season 11.4',
    );
  });

  test('no averages row without tracking averages, or for PTS', () => {
    draw('REB');
    expect(document.querySelector('.tracking-averages')).toBeNull();
  });

  test('the row is hidden when the filtered average is null', () => {
    const avg = [
      { REB: 8, MIN: 30, REB_CHANCES: null },
      { REB: 7, MIN: 30, REB_CHANCES: 14.2 },
    ];
    render(<ChartComponent gameLogs={logs} lineType="REB" lineValue="" averages={avg} />);
    expect(document.querySelector('.tracking-averages')).toBeNull();
  });
});
