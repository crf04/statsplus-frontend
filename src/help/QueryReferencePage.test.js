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
      const name = item.token.startsWith('sheet:') ? item.label : item.token;
      expect(screen.getByRole('rowheader', { name })).toBeInTheDocument();
    });
  });

  test('names a Defense Sheet row filter by its label, never its token', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Shot zone defense' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Restricted Area Makes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Play type volume' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Isolation Possessions' })).toBeInTheDocument();
    expect(screen.queryByText(/sheet:/)).not.toBeInTheDocument();
  });

  test('documents the stat threshold its stacked examples use', () => {
    renderPage();

    expect(screen.getByRole('rowheader', { name: '10+ FGA' })).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {
        name: 'Only games where he reached a box-score total, such as 10+ FGA or 30+ points.',
      }),
    ).toBeInTheDocument();
  });

  test('offers a way back to the search page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /back to search/i })).toHaveAttribute('href', '/');
  });
});
