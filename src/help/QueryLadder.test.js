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

    expect(screen.getByRole('link', { name: /every filter we understand/i })).toHaveAttribute(
      'href',
      '/help',
    );
  });

  test('leaves a modified click to the browser so the reference can open in a new tab', () => {
    renderLadder();
    const link = screen.getByRole('link', { name: /every filter we understand/i });

    expect(fireEvent.click(link, { button: 0 })).toBe(false); // handled in-app
    expect(fireEvent.click(link, { button: 0, metaKey: true })).toBe(true); // left to the browser
  });
});
