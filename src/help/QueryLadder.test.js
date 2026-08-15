import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QueryLadder from './QueryLadder';
import { QUERY_LADDER } from './queryHelp';

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

  test('marks only the clause each rung adds to the rung above it', () => {
    renderLadder();

    const marks = document.querySelectorAll('.query-ladder-query mark');
    expect([...marks].map((mark) => mark.textContent)).toEqual(
      QUERY_LADDER.map((step) => step.added),
    );
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
});
