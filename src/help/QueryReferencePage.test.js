import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QueryReferencePage from './QueryReferencePage';
import { OPPONENT_FILTERS, KEYWORDS, STACKED_EXAMPLES } from './queryHelp';
import { defensiveOptions } from '../opponentFilters';

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryReferencePage />
    </MemoryRouter>,
  );

describe('QueryReferencePage', () => {
  test('publishes every clause and opponent filter the parser accepts', () => {
    renderPage();

    KEYWORDS.forEach((entry) => {
      expect(screen.getByRole('rowheader', { name: entry.keyword })).toBeInTheDocument();
    });

    OPPONENT_FILTERS.flatMap((group) => group.items).forEach((item) => {
      expect(screen.getByRole('rowheader', { name: item.token })).toBeInTheDocument();
    });
  });

  // The page promises "every filter we understand", so the claim is checked
  // against the app's own opponent vocabulary rather than against this
  // module's constants.
  test('documents every opponent filter the app offers, spelled the same way', () => {
    renderPage();

    const documented = new Set(
      OPPONENT_FILTERS.flatMap((group) => group.items).map((item) => item.token),
    );

    defensiveOptions
      .filter((option) => option !== 'None')
      .forEach((option) => {
        expect(documented.has(option)).toBe(true);
        expect(screen.getByRole('rowheader', { name: option })).toBeInTheDocument();
      });
  });

  test('sends a chosen example back to the search page as router state', () => {
    renderPage();

    const example = screen.getByRole('link', { name: STACKED_EXAMPLES[0] });
    expect(example).toHaveAttribute('href', '/');
  });

  test('offers a way back to the search page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /back to search/i })).toHaveAttribute('href', '/');
  });
});
