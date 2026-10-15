import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QueryLadder from './QueryLadder';
import { QUERY_LADDER } from './queryHelp';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderLadder = (props = {}) =>
  render(
    <MemoryRouter>
      <QueryLadder onUseQuery={() => {}} {...props} />
    </MemoryRouter>,
  );

describe('QueryLadder', () => {
  test('loads the whole query for the rung that was clicked', () => {
    const onUseQuery = jest.fn();
    renderLadder({ onUseQuery });

    fireEvent.click(screen.getByRole('button', { name: /stack the filters/i }));

    expect(onUseQuery).toHaveBeenCalledWith(QUERY_LADDER[2].query);
  });

  test('marks exactly what each rung adds to the query above it', () => {
    renderLadder();

    const marks = [...document.querySelectorAll('.query-ladder-query mark')];
    expect(marks).toHaveLength(QUERY_LADDER.length);

    // The first rung marks a clause inside its own base query; every later rung
    // must mark exactly the difference from the rung above it. Compared against
    // the queries, not against the `added` constant the component renders.
    expect(QUERY_LADDER[0].query.endsWith(marks[0].textContent)).toBe(true);

    QUERY_LADDER.slice(1).forEach((step, index) => {
      const previous = QUERY_LADDER[index].query;
      expect(step.query.startsWith(previous)).toBe(true);
      expect(marks[index + 1].textContent).toBe(step.query.slice(previous.length).trim());
    });
  });

  test('names the added clause for assistive technology, not just visually', () => {
    renderLadder();

    QUERY_LADDER.forEach((step) => {
      expect(
        screen.getByRole('button', { name: new RegExp(`Adds ${escapeRegExp(step.added)}\\.`) }),
      ).toBeInTheDocument();
    });
  });

  test('does not offer queries while the search is unavailable', () => {
    const onUseQuery = jest.fn();
    renderLadder({ onUseQuery, disabled: true });

    const rung = screen.getByRole('button', { name: /start with a player/i });
    expect(rung).toBeDisabled();

    fireEvent.click(rung);
    expect(onUseQuery).not.toHaveBeenCalled();
  });

  test('links to the query reference', () => {
    renderLadder();

    expect(screen.getByRole('link', { name: /all filters/i })).toHaveAttribute('href', '/help');
  });

  test('leaves a modified click to the browser so the reference can open in a new tab', () => {
    renderLadder();
    const link = screen.getByRole('link', { name: /all filters/i });

    expect(fireEvent.click(link, { button: 0 })).toBe(false); // handled in-app
    expect(fireEvent.click(link, { button: 0, metaKey: true })).toBe(true); // left to the browser
  });
});

describe('QueryLadder answers', () => {
  const answers = [
    { points: 22.5, games: 72, series: [20, 25, 30] },
    { points: 22.1, games: 63, series: [18, 26] },
    { points: 23.1, games: 18, series: [31] },
  ];

  test('each rung shows its average, its change from the rung before, and its games', () => {
    renderLadder({ answers });

    const rungs = screen.getAllByRole('listitem');
    expect(rungs[0]).toHaveTextContent('22.5 PTS72 games');
    expect(rungs[1]).toHaveTextContent('22.1 PTS−0.463 games');
    expect(rungs[2]).toHaveTextContent('23.1 PTS+1.018 games');
  });

  test('a bar per game, gold where the game beat the rung average', () => {
    renderLadder({ answers });

    const bars = document.querySelectorAll('.query-ladder-rung:first-child .query-ladder-bars i');
    expect([...bars].map((bar) => bar.className)).toEqual(['', 'is-over', 'is-over']);
  });

  test('without answers the rungs keep their titles and notes', () => {
    renderLadder();

    expect(screen.getByText('Start with a player')).toBeInTheDocument();
    expect(screen.queryByText(/PTS/)).not.toBeInTheDocument();
  });
});
