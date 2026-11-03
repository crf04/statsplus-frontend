import { fireEvent, render, screen, within } from '@testing-library/react';
import GameLogsTable from './GameLogsTable';

const gameLog = {
  GAME_DATE: '2025-01-10',
  MATCHUP: 'LAL vs. ATL',
  WL: 'W',
  MIN: 36,
  PTS: 31,
  REB: 8,
  AST: 9,
  STL: 1,
  BLK: 1,
  TOV: 3,
  FGM: 11,
  FGA: 20,
  FG_PCT: 0.55,
  FG3M: 4,
  FG3A: 8,
  FG3_PCT: 0.5,
  FTM: 5,
  FTA: 6,
};

describe('GameLogsTable', () => {
  test('formats a date-only game date through the table', () => {
    render(<GameLogsTable gameLogs={[gameLog]} appliedFilters={{}} />);

    expect(screen.getByRole('cell', { name: '1/10', exact: true })).toBeVisible();
  });

  test('keeps a finite epoch game date usable', () => {
    render(
      <GameLogsTable
        gameLogs={[{ ...gameLog, GAME_DATE: Date.parse('2025-01-10T00:00:00Z') }]}
        appliedFilters={{}}
      />,
    );

    expect(screen.getByRole('cell', { name: '1/10', exact: true })).toBeVisible();
  });

  test('renders and sorts the backend WL and TOV fields with turnover colors', () => {
    render(
      <GameLogsTable
        gameLogs={[
          { ...gameLog, GAME_DATE: '2025-01-10', WL: 'W', TOV: 1 },
          { ...gameLog, GAME_DATE: '2025-01-08', WL: 'L', TOV: 4 },
        ]}
        appliedFilters={{}}
      />,
    );

    const table = screen.getByRole('table');
    const bodyRows = () => within(table).getAllByRole('row').slice(1);
    const rowCells = (row) => within(row).getAllByRole('cell');

    expect(rowCells(bodyRows()[0])[2]).toHaveTextContent('W');
    expect(rowCells(bodyRows()[0])[19]).toHaveTextContent('1');
    expect(rowCells(bodyRows()[0])[19]).toHaveStyle({ color: 'var(--ct-x-5fce93)' });

    fireEvent.click(screen.getByRole('button', { name: 'Sort by TOV (ascending)' }));
    expect(rowCells(bodyRows()[0])[19]).toHaveTextContent('4');
    expect(rowCells(bodyRows()[0])[19]).toHaveStyle({ color: 'var(--ct-x-d95f5f)' });

    fireEvent.click(screen.getByRole('button', { name: 'Sort by TOV (ascending)' }));
    expect(rowCells(bodyRows()[0])[19]).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Sort by W/L (ascending)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sort by W/L (ascending)' }));
    expect(rowCells(bodyRows()[0])[2]).toHaveTextContent('L');
  });

  test('renders tracking columns as literal values and an en dash for null', () => {
    render(
      <GameLogsTable
        gameLogs={[
          { ...gameLog, GAME_DATE: '2025-01-10', REB_CHANCES: 14, POTENTIAL_AST: 17 },
          { ...gameLog, GAME_DATE: '2025-01-08', REB_CHANCES: null, POTENTIAL_AST: null },
          { ...gameLog, GAME_DATE: '2025-01-06', REB_CHANCES: 0, POTENTIAL_AST: 0 },
        ]}
        appliedFilters={{}}
      />,
    );

    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    const rc = headers.findIndex((h) => h.startsWith('REB CH'));
    const pa = headers.findIndex((h) => h.startsWith('POT AST'));
    expect(headers.slice(rc - 1, pa + 1)).toEqual(['REB↕', 'REB CH↕', 'AST↕', 'POT AST↕']);
    expect(rc).toBeGreaterThan(-1);
    expect(pa).toBeGreaterThan(-1);
    const rows = within(table).getAllByRole('row').slice(1);
    const cells = (r) =>
      within(r)
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect([cells(rows[0])[rc], cells(rows[0])[pa]]).toEqual(['14', '17']);
    expect([cells(rows[1])[rc], cells(rows[1])[pa]]).toEqual(['–', '–']);
    expect([cells(rows[2])[rc], cells(rows[2])[pa]]).toEqual(['0', '0']);
  });
});
