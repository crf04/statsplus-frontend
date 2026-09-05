import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import SavedFilterSetsModal from './SavedFilterSetsModal';
import {
  deleteSavedFilterSet,
  fetchSavedFilterSets,
  renameSavedFilterSet,
} from './savedFilterSetsApi';

jest.mock('./savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(),
  renameSavedFilterSet: jest.fn(),
  deleteSavedFilterSet: jest.fn(),
}));

const savedFilterSets = [
  { id: 2, name: 'Curry at home', queryString: 'player_name=Stephen+Curry&home_away=home' },
  { id: 1, name: 'LeBron last 10', queryString: 'player_name=LeBron+James&game_filter=10' },
];

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
};

const renderModal = (onHide = jest.fn()) => {
  render(
    <MemoryRouter initialEntries={['/matchups']}>
      <SavedFilterSetsModal show onHide={onHide} />
      <LocationProbe />
    </MemoryRouter>,
  );
  return onHide;
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchSavedFilterSets.mockResolvedValue(savedFilterSets);
});

test('lists saved Filter Sets in the order the backend returned them', async () => {
  renderModal();

  const names = await screen.findAllByRole('button', { name: /Open saved Filter Set/ });
  expect(names).toHaveLength(2);
  expect(names[0]).toHaveAccessibleName('Open saved Filter Set Curry at home');
  expect(names[1]).toHaveAccessibleName('Open saved Filter Set LeBron last 10');
});

/*
 * A name is typed in a hurry and the prose of a Parsed Query is never stored,
 * so the parameters are the only description of a saved item that can be
 * relied on. One Filter Set carrying every kind of parameter says them all.
 */
test('describes a Saved Filter Set by every parameter its URL carries', async () => {
  fetchSavedFilterSets.mockResolvedValue([
    {
      id: 9,
      name: 'everything at once',
      queryString:
        'player_name=Luka+Doncic&season_filter=2025-26&game_filter=10&location_filter=Away' +
        '&opponent_tricode=OKC' +
        '&teams_against%5B%5D=Isolation&rank_filter%5B%5D=5' +
        '&teams_against%5B%5D=Transition&rank_filter%5B%5D=-8' +
        '&minutes_filter=32,48&date_filter=2026-02-01' +
        '&players_on%5B%5D=Kyrie+Irving&players_off%5B%5D=Anthony+Davis' +
        '&self_filters%5BAST%5D=8,999&playstyle_RTG_min=40&playstyle_RTG_max=90',
    },
  ]);
  renderModal();

  const row = await screen.findByRole('button', { name: /Open saved Filter Set/ });
  expect(row).toHaveTextContent(
    [
      'everything at once',
      'Luka Doncic',
      '2025-26',
      'last 10',
      'away',
      'vs OKC',
      'vs top 5 Isolation D',
      'vs bottom 8 Transition D',
      '32–48 min',
      'since 2026-02-01',
      'with Kyrie Irving',
      'without Anthony Davis',
      'AST ≥ 8',
      'PLAYTYPE_RTG 40–90',
    ].join(''),
  );
});

test('says a Filter Set with no parameters covers every logged game', async () => {
  fetchSavedFilterSets.mockResolvedValue([
    { id: 3, name: 'all of it', queryString: 'player_name=Stephen+Curry' },
  ]);
  renderModal();

  expect(await screen.findByText('every logged game')).toBeVisible();
});

/*
 * The decoder withholds the whole Filter Set when one parameter is
 * unhonourable, so a refused item has no parameters to show. It still has to be
 * identifiable enough to delete, so its player is read off the raw URL.
 */
test('says on the row when a saved link can no longer be opened', async () => {
  fetchSavedFilterSets.mockResolvedValue([
    { id: 4, name: 'old link', queryString: 'player_name=Kawhi+Leonard&game_filter=0' },
  ]);
  renderModal();

  expect(await screen.findByText('this link can no longer be opened')).toBeVisible();
  expect(screen.getByText('Kawhi Leonard')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Delete old link' })).toBeInTheDocument();
});

test('opening a saved Filter Set navigates to its query string and closes the list', async () => {
  const onHide = renderModal();

  fireEvent.click(
    await screen.findByRole('button', { name: 'Open saved Filter Set Curry at home' }),
  );

  await waitFor(() =>
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/?player_name=Stephen+Curry&home_away=home',
    ),
  );
  expect(onHide).toHaveBeenCalled();
});

test('renames an item and reloads the list', async () => {
  renameSavedFilterSet.mockResolvedValue(undefined);
  // The list is reloaded rather than patched in place, so the order shown is
  // always the backend's.
  fetchSavedFilterSets
    .mockResolvedValueOnce(savedFilterSets)
    .mockResolvedValueOnce([
      { ...savedFilterSets[0], name: 'Curry home splits' },
      savedFilterSets[1],
    ]);
  renderModal();

  fireEvent.click(await screen.findByRole('button', { name: 'Rename Curry at home' }));
  fireEvent.change(screen.getByLabelText('New name for Curry at home'), {
    target: { value: 'Curry home splits' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  });

  expect(renameSavedFilterSet).toHaveBeenCalledWith({ id: 2, name: 'Curry home splits' });
  expect(fetchSavedFilterSets).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole('button', { name: 'Open saved Filter Set Curry home splits' }),
  ).toBeVisible();
});

test('surfaces a duplicate-name conflict and keeps the item in the list', async () => {
  renameSavedFilterSet.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: { code: 'duplicate_name', message: 'You already have a saved set by that name.' },
      },
    },
  });
  renderModal();

  fireEvent.click(await screen.findByRole('button', { name: 'Rename Curry at home' }));
  fireEvent.change(screen.getByLabelText('New name for Curry at home'), {
    target: { value: 'LeBron last 10' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You already have a saved set by that name.',
  );
  // The rejection is answerable in place: the field and the attempted name stay
  // put, so fixing a duplicate is one edit rather than a retype.
  expect(screen.getByLabelText('New name for Curry at home')).toHaveValue('LeBron last 10');
});

test('a rename the backend takes closes the field', async () => {
  renameSavedFilterSet.mockResolvedValue(undefined);
  renderModal();

  fireEvent.click(await screen.findByRole('button', { name: 'Rename Curry at home' }));
  fireEvent.change(screen.getByLabelText('New name for Curry at home'), {
    target: { value: 'Curry home splits' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  });

  expect(screen.queryByLabelText('New name for Curry at home')).not.toBeInTheDocument();
});

test('deletes an item once the row confirms, and reloads the list', async () => {
  deleteSavedFilterSet.mockResolvedValue(undefined);
  fetchSavedFilterSets
    .mockResolvedValueOnce(savedFilterSets)
    .mockResolvedValueOnce([savedFilterSets[1]]);
  renderModal();

  fireEvent.click(await screen.findByRole('button', { name: 'Delete Curry at home' }));
  expect(deleteSavedFilterSet).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deleting Curry at home' }));
  });

  expect(deleteSavedFilterSet).toHaveBeenCalledWith({ id: 2 });
  expect(
    screen.queryByRole('button', { name: 'Open saved Filter Set Curry at home' }),
  ).not.toBeInTheDocument();
});

// Deleting is not undoable, so backing out of it has to keep the item.
test('a delete the row backs out of removes nothing', async () => {
  renderModal();

  fireEvent.click(await screen.findByRole('button', { name: 'Delete Curry at home' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep Curry at home' }));

  expect(deleteSavedFilterSet).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Open saved Filter Set Curry at home' })).toBeVisible();
});

test('reports a failed load and says when nothing is saved yet', async () => {
  fetchSavedFilterSets.mockRejectedValueOnce({
    response: { data: { error: { message: 'Saved filter sets are unavailable.' } } },
  });
  const { rerender } = render(
    <MemoryRouter>
      <SavedFilterSetsModal show onHide={jest.fn()} />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('alert')).toHaveTextContent('Saved filter sets are unavailable.');

  fetchSavedFilterSets.mockResolvedValue([]);
  rerender(
    <MemoryRouter>
      <SavedFilterSetsModal show={false} onHide={jest.fn()} />
    </MemoryRouter>,
  );
  rerender(
    <MemoryRouter>
      <SavedFilterSetsModal show onHide={jest.fn()} />
    </MemoryRouter>,
  );

  expect(await screen.findByText(/have not saved any Filter Sets yet/i)).toBeVisible();
});
