import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserProfile from './UserProfile';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSavedFilterSets } from '../../savedFilterSetsApi';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(),
  renameSavedFilterSet: jest.fn(),
  deleteSavedFilterSet: jest.fn(),
}));

const renderUserProfile = () =>
  render(
    <MemoryRouter>
      <UserProfile />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  fetchSavedFilterSets.mockResolvedValue([]);
  useAuth.mockReturnValue({
    currentUser: { displayName: 'Chris Fu', email: 'chris@example.com' },
    logout: jest.fn(),
  });
});

test('opens the saved list from the account menu', async () => {
  renderUserProfile();

  fireEvent.click(screen.getByRole('button', { name: /Chris Fu/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Saved Filter Sets' }));
  });

  expect(await screen.findByRole('heading', { name: 'Saved Filter Sets' })).toBeVisible();
  expect(fetchSavedFilterSets).toHaveBeenCalledTimes(1);
});

test('shows nothing at all while signed out', () => {
  useAuth.mockReturnValue({ currentUser: null, logout: jest.fn() });

  const { container } = renderUserProfile();

  expect(container).toBeEmptyDOMElement();
  expect(fetchSavedFilterSets).not.toHaveBeenCalled();
});
