import { render, screen, within } from '@testing-library/react';
import ShotTypeTable from './ShotTypeTable';

const rows = [
  { SHOT_TYPE: 'C&S', FGA_FREQUENCY: 0.203, FGM: 1.4, FGA: 3.5, FG_PCT: 0.402, FG2M: 0.2, FG2A: 0.4, FG2_PCT: 0.5, FG3M: 1.2, FG3A: 3.0, FG3_PCT: 0.388 },
  { SHOT_TYPE: '<10 Ft', FGA_FREQUENCY: 0.529, FGM: 5.2, FGA: 9.0, FG_PCT: 0.575, FG2M: 5.2, FG2A: 9.0, FG2_PCT: 0.575, FG3M: 0, FG3A: 0, FG3_PCT: 0 },
]; // prettier-ignore

const cells = (name) =>
  within(screen.getByRole('row', { name: new RegExp(`^${name}`) }))
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

test('each shot type reads share against league, then FG, 2PT and 3PT as % over made/attempted', () => {
  render(
    <ShotTypeTable
      rows={rows}
      leagueShares={{ 'Catch and Shoot': 0.324, Pullups: 0.237, 'Less Than 10 ft': 0.429 }}
    />,
  );
  expect(cells('Catch & shoot')).toEqual([
    'Catch & shoot',
    '20%lg 32%',
    '40.2%1.4/3.5',
    '50.0%0.2/0.4',
    '38.8%1.2/3.0',
  ]);
  // No 3-point attempts reads as a dash, not 0.0%.
  expect(cells('Inside 10 ft')).toEqual([
    'Inside 10 ft',
    '53%lg 43%',
    '57.5%5.2/9.0',
    '57.5%5.2/9.0',
    '—',
  ]);
});

test('the league tick sits at the league share and the bar at his share', () => {
  const { container } = render(
    <ShotTypeTable rows={rows.slice(0, 1)} leagueShares={{ 'Catch and Shoot': 0.324 }} />,
  );
  expect(container.querySelector('.ps-bar-fill')).toHaveStyle({ width: '20.3%' });
  expect(container.querySelector('.ps-bar-tick')).toHaveStyle({ left: '32.4%' });
});

test('without league baselines the share still reads and the league line is a dash', () => {
  const { container } = render(<ShotTypeTable rows={rows.slice(0, 1)} leagueShares={null} />);
  expect(cells('Catch & shoot')[1]).toBe('20%lg —');
  expect(container.querySelector('.ps-bar-tick')).toBeNull();
});
