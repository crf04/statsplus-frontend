import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QueryReferencePage from './QueryReferencePage';
import { OPPONENT_FILTERS, KEYWORDS } from './queryHelp';

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

  test('offers a way back to the search page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /back to search/i })).toHaveAttribute('href', '/');
  });
});
