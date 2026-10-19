import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerSelector from './PlayerSelector';

const filtered = { PTS: 31.3, REB: 9.2 };
const season = { PTS: 24.7, REB: 5.1 };

const postedLine = {
  gameDate: '2026-10-21',
  matchup: 'GSW vs LAL',
  lines: {
    PTS: { value: 26.5, provider: 'prizepicks' },
    '3PM': { value: 4.5, provider: 'underdog' },
  },
};

const Harness = ({ averages, posted = null, player = '' }) => {
  const [lineType, setLineType] = useState('PTS');
  const [lineValue, setLineValue] = useState('');
  return (
    <PlayerSelector
      selectedPlayer={player}
      setSelectedPlayer={() => {}}
      lineType={lineType}
      setLineType={setLineType}
      lineValue={lineValue}
      setLineValue={setLineValue}
      playerList={[]}
      averages={averages}
      postedLine={posted}
    />
  );
};

test('auto-fills the line with the season average, not the filtered average', () => {
  render(<Harness averages={[filtered, season]} />);
  expect(screen.getByLabelText('Line Value:')).toHaveValue('24.7');
});

test('changing the line type fills the new stat season average', () => {
  render(<Harness averages={[filtered, season]} />);
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'REB' } });
  expect(screen.getByLabelText('Line Value:')).toHaveValue('5.1');
});

test('defaults the line to his next game posted line for the stat', () => {
  render(<Harness averages={[filtered, season]} posted={postedLine} />);
  expect(screen.getByLabelText('Line Value:')).toHaveValue('26.5');
});

test('FG3M takes the 3PM posted line, and a stat without one the season average', () => {
  render(<Harness averages={[filtered, { ...season, FG3M: 3.9 }]} posted={postedLine} />);
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'FG3M' } });
  expect(screen.getByLabelText('Line Value:')).toHaveValue('4.5');
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'REB' } });
  expect(screen.getByLabelText('Line Value:')).toHaveValue('5.1');
});

test('a typed line survives a refetch until the stat or player changes', () => {
  const { rerender } = render(
    <Harness averages={[filtered, season]} posted={postedLine} player="Stephen Curry" />,
  );
  const line = screen.getByLabelText('Line Value:');
  fireEvent.change(line, { target: { value: '30' } });

  // A filter change refetches: new averages and posted-line objects, same values.
  rerender(
    <Harness
      averages={[{ ...filtered }, { ...season }]}
      posted={{ ...postedLine }}
      player="Stephen Curry"
    />,
  );
  expect(line).toHaveValue('30');

  rerender(
    <Harness
      averages={[filtered, { ...season }]}
      posted={{ ...postedLine }}
      player="LeBron James"
    />,
  );
  expect(line).toHaveValue('26.5');

  fireEvent.change(line, { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'REB' } });
  expect(line).toHaveValue('5.1');
  fireEvent.change(screen.getByLabelText('Line Type:'), { target: { value: 'PTS' } });
  expect(line).toHaveValue('26.5');
});
