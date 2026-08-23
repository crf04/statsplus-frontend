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
  expect(names.map((button) => button.textContent)).toEqual(['Curry at home', 'LeBron last 10']);
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
  expect(screen.getByRole('button', { name: 'Open saved Filter Set Curry at home' })).toBeVisible();
});

test('deletes an item and reloads the list', async () => {
  deleteSavedFilterSet.mockResolvedValue(undefined);
  fetchSavedFilterSets
    .mockResolvedValueOnce(savedFilterSets)
    .mockResolvedValueOnce([savedFilterSets[1]]);
  renderModal();

  const deleteButton = await screen.findByRole('button', { name: 'Delete Curry at home' });
  await act(async () => {
    fireEvent.click(deleteButton);
  });

  expect(deleteSavedFilterSet).toHaveBeenCalledWith({ id: 2 });
  expect(
    screen.queryByRole('button', { name: 'Open saved Filter Set Curry at home' }),
  ).not.toBeInTheDocument();
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
