import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import FilterOptions from '../FilterOptions';
import {
  createSavedFilterSet,
  deleteSavedFilterSet,
  fetchSavedFilterSets,
  renameSavedFilterSet,
} from '../savedFilterSetsApi';

let mockAuth;
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../seasonsApi', () => ({ fetchSeasons: jest.fn(() => Promise.reject(new Error('x'))) }));
jest.mock('../nextOpponentApi', () => ({
  fetchNextOpponent: jest.fn(() => new Promise(() => {})),
}));
jest.mock('../savedFilterSetsApi', () => ({
  fetchSavedFilterSets: jest.fn(),
  subscribeSavedFilterSets: () => () => {},
  createSavedFilterSet: jest.fn(),
  renameSavedFilterSet: jest.fn(),
  deleteSavedFilterSet: jest.fn(),
}));

global.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false });

const SETS = [
  { id: 1, name: 'Reaves away', queryString: 'player_name=Austin+Reaves&location_filter=Away' },
  { id: 2, name: 'LeBron last 10', queryString: 'player_name=LeBron+James&game_filter=10' },
  { id: 3, name: 'LeBron at home', queryString: 'player_name=LeBron+James&location_filter=Home' },
];

const Location = () => <output data-testid="location">{useLocation().search}</output>;

const renderPanel = async (url, appliedFilters = {}) => {
  render(
    <MemoryRouter initialEntries={[url]}>
      <FilterOptions
        playerList={['LeBron James', 'Austin Reaves']}
        onApplyFilters={() => {}}
        onSeasonChange={() => {}}
        selectedPlayer="LeBron James"
        seasonGameLogs={[]}
        gameLogs={[]}
        lineType="PTS"
        lineValue={20}
        averages={[]}
        onOpenSelfFilters={() => {}}
        appliedFilters={appliedFilters}
        defaultSaveName="lebron last ten"
      />
      <Location />
    </MemoryRouter>,
  );
  await act(async () => {});
};

const savedTab = () => screen.getByRole('tab', { name: /^Saved/ });

beforeEach(() => {
  mockAuth = { isAuthenticated: true, currentUser: { uid: 'u1' }, waitlist: null };
  jest.clearAllMocks();
  fetchSavedFilterSets.mockResolvedValue(SETS);
});

test('the Saved tab lists the player on screen first, then other players', async () => {
  await renderPanel('/?player_name=LeBron+James', { player_name: 'LeBron James' });
  expect(savedTab()).toHaveAccessibleName('Saved 3');
  fireEvent.click(savedTab());

  const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(headings).toEqual(['For LeBron James', 'Other players']);
  const lists = screen.getAllByRole('list');
  expect(
    within(lists[0])
      .getAllByRole('button', { name: /^Open saved Filter Set/ })
      .map((b) => b.getAttribute('aria-label')),
  ).toEqual(['Open saved Filter Set LeBron last 10', 'Open saved Filter Set LeBron at home']);
  expect(within(lists[1]).getByText('Austin Reaves')).toBeVisible();
  expect(screen.queryByRole('button', { name: /\+ Minutes/ })).toBeNull();
});

test('opening a saved set goes to its link and returns to the filters', async () => {
  await renderPanel('/?player_name=LeBron+James', { player_name: 'LeBron James' });
  fireEvent.click(savedTab());
  fireEvent.click(screen.getByRole('button', { name: 'Open saved Filter Set Reaves away' }));

  expect(screen.getByTestId('location')).toHaveTextContent(
    '?player_name=Austin+Reaves&location_filter=Away',
  );
  expect(screen.getByRole('tab', { name: 'Filters' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: /\+ Minutes/ })).toBeVisible();
});

test('the applied Filter Set that is saved is named, in any parameter order', async () => {
  await renderPanel('/?game_filter=10&player_name=LeBron+James', {
    player_name: 'LeBron James',
    game_filter: 10,
  });
  const named = (selector) =>
    screen.getByText(
      (_, el) => el.matches(selector) && el.textContent === 'Saved as LeBron last 10',
    );
  expect(named('.fpb-head p')).toBeVisible();
  expect(named('.fpb-foot span')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

  fireEvent.click(savedTab());
  expect(
    screen.getByRole('button', { name: 'Open saved Filter Set LeBron last 10' }),
  ).toHaveAttribute('aria-current', 'true');
  expect(
    screen.getByRole('button', { name: 'Open saved Filter Set LeBron at home' }),
  ).not.toHaveAttribute('aria-current');
});

test('Save names the applied link in place and stores its query string', async () => {
  createSavedFilterSet.mockResolvedValue(undefined);
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const field = screen.getByLabelText('Name this Filter Set');
  expect(field).toHaveValue('lebron last ten');
  fireEvent.change(field, { target: { value: 'LeBron last 5' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });

  expect(createSavedFilterSet).toHaveBeenCalledWith({
    name: 'LeBron last 5',
    queryString: 'player_name=LeBron+James&game_filter=5',
  });
  expect(screen.queryByLabelText('Name this Filter Set')).toBeNull();
});

test('a refused save keeps the name and says why', async () => {
  createSavedFilterSet.mockRejectedValue({
    response: {
      status: 409,
      data: { error: { message: 'You already have a saved set by that name.' } },
    },
  });
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(screen.getByLabelText('Name this Filter Set'), {
    target: { value: 'LeBron last 10' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });

  expect(screen.getByRole('alert')).toHaveTextContent('You already have a saved set by that name.');
  expect(screen.getByLabelText('Name this Filter Set')).toHaveValue('LeBron last 10');
});

test('Save waits for unapplied changes to be applied', async () => {
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove last' }));
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('rename and delete work from the Saved tab', async () => {
  renameSavedFilterSet.mockResolvedValue(undefined);
  deleteSavedFilterSet.mockResolvedValue(undefined);
  await renderPanel('/?player_name=LeBron+James', { player_name: 'LeBron James' });
  fireEvent.click(savedTab());

  fireEvent.click(screen.getByRole('button', { name: 'Rename LeBron at home' }));
  fireEvent.change(screen.getByLabelText('New name for LeBron at home'), {
    target: { value: 'LeBron home games' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
  });
  expect(renameSavedFilterSet).toHaveBeenCalledWith({ id: 3, name: 'LeBron home games' });

  fireEvent.click(screen.getByRole('button', { name: 'Delete Reaves away' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deleting Reaves away' }));
  });
  expect(deleteSavedFilterSet).toHaveBeenCalledWith({ id: 1 });
});

test.each([
  [
    500,
    { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
    'Could not load Saved Filter Sets. (ref 77070cec)',
  ],
  [
    400,
    { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
    'Could not load Saved Filter Sets.',
  ],
])('a %i load failure with headers %j reads %j in the Saved tab', async (status, headers, text) => {
  fetchSavedFilterSets.mockRejectedValue(
    Object.assign(new Error(`Request failed with status code ${status}`), {
      response: { status, headers, data: {} },
    }),
  );
  await renderPanel('/?player_name=LeBron+James', { player_name: 'LeBron James' });
  fireEvent.click(savedTab());
  expect(screen.getByText(text, { selector: 'p' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Retry saved sets' })).toBeVisible();
});

test.each([
  ['signed out', { isAuthenticated: false, currentUser: null, waitlist: null }],
  ['waitlisted', { isAuthenticated: true, currentUser: { uid: 'u1' }, waitlist: { position: 3 } }],
])('a %s reader gets no Saved tab and no Save', async (_label, auth) => {
  mockAuth = auth;
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  expect(screen.queryByRole('tab')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(screen.getByRole('button', { name: /^Apply/ })).toBeVisible();
});

test('a browse link carries no Filter Set, so it offers the Saved tab but no Save', async () => {
  await renderPanel('/?browse=1', {});
  expect(savedTab()).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
});
