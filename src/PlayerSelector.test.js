import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerSelector from './PlayerSelector';

const filtered = { PTS: 31.3, REB: 9.2 };
const season = { PTS: 24.7, REB: 5.1 };

const Harness = ({ averages }) => {
  const [lineType, setLineType] = useState('PTS');
  const [lineValue, setLineValue] = useState('');
  return (
    <PlayerSelector
      selectedPlayer=""
      setSelectedPlayer={() => {}}
      lineType={lineType}
      setLineType={setLineType}
      lineValue={lineValue}
      setLineValue={setLineValue}
      playerList={[]}
      averages={averages}
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
