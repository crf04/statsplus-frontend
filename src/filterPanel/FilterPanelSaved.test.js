import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import FilterOptions from '../FilterOptions';
import {
  createSavedFilterSet,
  deleteSavedFilterSet,
  fetchSavedFilterSets,
  renameSavedFilterSet,
} from '../savedFilterSetsApi';
import { fetchNextOpponent } from '../nextOpponentApi';

let mockAuth;
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../seasonsApi', () => ({ fetchSeasons: jest.fn(() => Promise.reject(new Error('x'))) }));
jest.mock('../nextOpponentApi', () => ({
  fetchNextOpponent: jest.fn(() => new Promise(() => {})),
}));
// An account store behind the real notify-and-reload seam: every mutation
// changes what the next read returns and tells subscribers to read again.
jest.mock('../savedFilterSetsApi', () => {
  const listeners = new Set();
  const store = { sets: [] };
  const notify = () => listeners.forEach((listener) => listener());
  return {
    store,
    fetchSavedFilterSets: jest.fn(async () => store.sets.map((set) => ({ ...set }))),
    subscribeSavedFilterSets: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createSavedFilterSet: jest.fn(async ({ name, queryString }) => {
      store.sets = [{ id: 99, name, queryString }, ...store.sets];
      notify();
    }),
    renameSavedFilterSet: jest.fn(async ({ id, name }) => {
      store.sets = store.sets.map((set) => (set.id === id ? { ...set, name } : set));
      notify();
    }),
    deleteSavedFilterSet: jest.fn(async ({ id }) => {
      store.sets = store.sets.filter((set) => set.id !== id);
      notify();
    }),
  };
});
const { store } = jest.requireMock('../savedFilterSetsApi');

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
// Another applied link that is not saved, reached without the panel.
const GoElsewhere = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/?player_name=LeBron+James&game_filter=7')}>
      Go elsewhere
    </button>
  );
};

const renderPanel = async (url, appliedFilters = {}, extra = {}) => {
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
        {...extra}
      />
      <Location />
      <GoElsewhere />
    </MemoryRouter>,
  );
  await act(async () => {});
};

const savedTab = () => screen.getByRole('tab', { name: /^Saved/ });

beforeEach(() => {
  mockAuth = { isAuthenticated: true, currentUser: { uid: 'u1' }, waitlist: null };
  jest.clearAllMocks();
  store.sets = SETS.map((set) => ({ ...set }));
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
  // Each row says what its link asks for; the player chip only where it differs.
  expect(within(lists[0]).getByText('last 10')).toBeVisible();
  expect(within(lists[0]).getByText('home')).toBeVisible();
  expect(within(lists[0]).queryByText('LeBron James')).toBeNull();
  expect(within(lists[1]).getByText('Austin Reaves')).toBeVisible();
  expect(within(lists[1]).getByText('away')).toBeVisible();
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
  // The list reloads, so the applied link is now the saved one.
  expect(await screen.findByText('LeBron last 5', { selector: '.fpb-foot b' })).toBeVisible();
  expect(savedTab()).toHaveAccessibleName('Saved 4');
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
  expect(
    await screen.findByRole('button', { name: 'Open saved Filter Set LeBron home games' }),
  ).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Delete Reaves away' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deleting Reaves away' }));
  });
  expect(deleteSavedFilterSet).toHaveBeenCalledWith({ id: 1 });
  expect(screen.queryByRole('button', { name: 'Open saved Filter Set Reaves away' })).toBeNull();
  expect(savedTab()).toHaveAccessibleName('Saved 2');
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
  fetchSavedFilterSets.mockRejectedValueOnce(
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

test('the Saved tab keeps the panel reporting the Workspace as settled', async () => {
  fetchNextOpponent.mockResolvedValueOnce({ next_game: null, opponent_ranks: [] });
  const onContextSettled = jest.fn();
  await renderPanel(
    '/?player_name=LeBron+James',
    { player_name: 'LeBron James' },
    {
      onContextSettled,
    },
  );
  fireEvent.click(savedTab());
  await act(async () => {});
  // Leaving the filters must not withdraw the settled signal, or an Apply from
  // the Saved tab would hide the Workspace behind its loading state for good.
  expect(onContextSettled).not.toHaveBeenLastCalledWith(null);
  expect(onContextSettled).toHaveBeenLastCalledWith('LeBron James');
});

test('a link with the same teammates in another order is the same saved set', async () => {
  store.sets = [
    {
      id: 7,
      name: 'Without both',
      queryString:
        'player_name=LeBron+James&players_off%5B%5D=Anthony+Davis&players_off%5B%5D=Austin+Reaves&teams_against%5B%5D=OPP_PTS&rank_filter%5B%5D=5&teams_against%5B%5D=OPP_REB&rank_filter%5B%5D=-8',
    },
  ];
  await renderPanel(
    '/?player_name=LeBron+James&players_off%5B%5D=Austin+Reaves&players_off%5B%5D=Anthony+Davis&teams_against%5B%5D=OPP_REB&rank_filter%5B%5D=-8&teams_against%5B%5D=OPP_PTS&rank_filter%5B%5D=5',
    { player_name: 'LeBron James' },
  );
  expect(screen.getByText('Without both', { selector: '.fpb-foot b' })).toBeVisible();
});

test('a defensive category paired with another rank is a different Filter Set', async () => {
  store.sets = [
    {
      id: 8,
      name: 'Pairs',
      queryString:
        'player_name=LeBron+James&teams_against%5B%5D=OPP_PTS&rank_filter%5B%5D=5&teams_against%5B%5D=OPP_REB&rank_filter%5B%5D=-8',
    },
  ];
  await renderPanel(
    '/?player_name=LeBron+James&teams_against%5B%5D=OPP_PTS&rank_filter%5B%5D=-8&teams_against%5B%5D=OPP_REB&rank_filter%5B%5D=5',
    { player_name: 'LeBron James' },
  );
  expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
});

test('the naming form refuses to save once the panel holds unapplied changes', async () => {
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(screen.getByLabelText('Name this Filter Set'), { target: { value: 'Stale' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove last' }));
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await act(async () => {
    fireEvent.submit(screen.getByLabelText('Name this Filter Set').closest('form'));
  });
  expect(createSavedFilterSet).not.toHaveBeenCalled();
});

test('Cancel closes the naming form and the next Save starts fresh', async () => {
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(screen.getByLabelText('Name this Filter Set'), { target: { value: 'Draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByLabelText('Name this Filter Set')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByLabelText('Name this Filter Set')).toHaveValue('lebron last ten');
});

test('opening another link closes the naming form', async () => {
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.click(savedTab());
  fireEvent.click(screen.getByRole('button', { name: 'Open saved Filter Set Reaves away' }));
  expect(screen.queryByLabelText('Name this Filter Set')).toBeNull();
});

test('a save that answers after the reader moved on leaves the newer form alone', async () => {
  let answer;
  createSavedFilterSet.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  await renderPanel('/?player_name=LeBron+James&game_filter=5', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(screen.getByLabelText('Name this Filter Set'), { target: { value: 'Slow' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.click(screen.getByRole('button', { name: 'Go elsewhere' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(screen.getByLabelText('Name this Filter Set'), { target: { value: 'Newer' } });
  await act(async () => answer());
  expect(screen.getByLabelText('Name this Filter Set')).toHaveValue('Newer');
});

test('saving stores the Filter Set without the Line Type the chart is on', async () => {
  await renderPanel('/?player_name=LeBron+James&game_filter=5&line_type=REB', {
    player_name: 'LeBron James',
    game_filter: 5,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  fireEvent.change(screen.getByLabelText('Name this Filter Set'), {
    target: { value: 'Rebounds view' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });

  expect(createSavedFilterSet).toHaveBeenCalledWith({
    name: 'Rebounds view',
    queryString: 'player_name=LeBron+James&game_filter=5',
  });
});

test('a saved set stays the current one whichever Line Type the chart is on', async () => {
  await renderPanel('/?player_name=LeBron+James&game_filter=10&line_type=REB', {
    player_name: 'LeBron James',
    game_filter: 10,
  });

  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(screen.getByText('LeBron last 10', { selector: '.fpb-foot b' })).toBeVisible();
});

test('a Line Type alone is not a Filter Set to save', async () => {
  await renderPanel('/?browse=1&line_type=REB');

  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('opening a saved set keeps the Line Type the chart is on', async () => {
  await renderPanel('/?player_name=LeBron+James&line_type=REB', { player_name: 'LeBron James' });
  fireEvent.click(savedTab());
  fireEvent.click(screen.getByRole('button', { name: 'Open saved Filter Set Reaves away' }));

  expect(screen.getByTestId('location')).toHaveTextContent(
    '?player_name=Austin+Reaves&location_filter=Away&line_type=REB',
  );
});
