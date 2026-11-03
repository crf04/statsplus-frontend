import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import NaturalLanguageQuery from '../NaturalLanguageQuery';
import apiClient from '../utils/axiosConfig';
import { homeGet } from './publicHomeFixtures';

const mockAuth = {};
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../utils/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const signedOut = () =>
  Object.assign(mockAuth, {
    isAuthenticated: false,
    currentUser: null,
    waitlist: null,
    signInWithGoogle: jest.fn(() => new Promise(() => {})),
  });

const Where = () => {
  const { pathname, search } = useLocation();
  return <output aria-label="location">{pathname + search}</output>;
};

const renderHome = (props = {}) => {
  const onFiltersApplied = jest.fn(() => ({ ok: true }));
  // A new element each time, so a change to the mocked account is rendered.
  const view = () => (
    <MemoryRouter>
      <NaturalLanguageQuery onFiltersApplied={onFiltersApplied} {...props} />
      <Where />
    </MemoryRouter>
  );
  const result = render(view());
  return { ...result, again: () => result.rerender(view()) };
};

const requested = () => apiClient.get.mock.calls.map(([url]) => new URL(url).pathname);

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  apiClient.get.mockReset();
  apiClient.get.mockImplementation(homeGet);
  apiClient.post.mockReset();
  signedOut();
});
afterEach(() => jest.restoreAllMocks());

test('signed out, the page shows the ticker, live answers and Tonight with a sign-up card for Targets', async () => {
  renderHome();

  const ticker = await screen.findByRole('navigation', { name: "Today's games" });
  expect(within(ticker).getByRole('link', { name: /MIA at WAS Matchup/ })).toHaveTextContent(
    'Ware+11%',
  );
  const firstRung = screen.getByRole('button', { name: /Start with a player/ });
  expect(firstRung).toHaveTextContent('22.4');
  expect(firstRung).toHaveTextContent('3 games');
  expect(screen.getByRole('article', { name: 'Best: Jaime Jaquez Jr.' })).toHaveTextContent(
    '+6.7%',
  );
  const targets = screen.getByRole('region', { name: 'Your Targets' });
  expect(within(targets).getByRole('button', { name: 'Sign up free' })).toBeEnabled();
  expect(screen.getByText('Free account. Sign up with Google to run it.')).toBeInTheDocument();
  expect(requested().sort()).toEqual([
    '/api/games/ladder',
    '/api/games/slate',
    '/api/games/slate/edges',
    '/api/research',
  ]);
});

test('signed out, the query box, Run it and Browse are enabled while "Try it" only fills the box', async () => {
  renderHome();

  const box = screen.getByRole('textbox');
  expect(box).toBeEnabled();
  expect(box).toHaveAttribute('placeholder', 'LeBron James this year');
  expect(screen.getByRole('button', { name: 'Browse without a query' })).toBeEnabled();
  fireEvent.click(await screen.findByRole('button', { name: 'Try it' }));
  expect(box).toHaveValue('Jaime Jaquez Jr. this year against bottom 10 defenses');
  // The box is above the fold from Tonight, so the fill must land in view.
  expect(box).toHaveFocus();
  expect(mockAuth.signInWithGoogle).not.toHaveBeenCalled();
});

test('Run it signs up and then runs exactly the typed query', async () => {
  const onFiltersApplied = jest.fn(() => ({ ok: true }));
  apiClient.post.mockResolvedValue({ data: { player_name: 'LeBron James' } });
  mockAuth.signInWithGoogle.mockResolvedValue({ uid: 'new-reader' });
  const { again } = renderHome({ onFiltersApplied });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'LeBron James this year' } });

  fireEvent.click(screen.getByRole('button', { name: 'Run it' }));

  expect(mockAuth.signInWithGoogle).toHaveBeenCalledWith({ silent: true });
  await act(async () => {});
  expect(apiClient.post).not.toHaveBeenCalled();
  Object.assign(mockAuth, { isAuthenticated: true, currentUser: { uid: 'new-reader' } });
  again();
  await waitFor(() => expect(onFiltersApplied).toHaveBeenCalledTimes(1));
  expect(apiClient.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/nl-query$/),
    { query: 'LeBron James this year' },
    expect.anything(),
  );
  expect(onFiltersApplied).toHaveBeenCalledWith({ player_name: 'LeBron James' });
});

test('Browse signs up and then opens the browse workspace', async () => {
  mockAuth.signInWithGoogle.mockResolvedValue({ uid: 'new-reader' });
  const { again } = renderHome();

  fireEvent.click(screen.getByRole('button', { name: 'Browse without a query' }));
  expect(screen.getByLabelText('location')).toHaveTextContent('/');
  Object.assign(mockAuth, { isAuthenticated: true, currentUser: { uid: 'new-reader' } });
  again();

  await waitFor(() => expect(screen.getByLabelText('location')).toHaveTextContent('/?browse=1'));
});

test('a cancelled sign-in keeps the typed query, runs nothing and shows no error', async () => {
  mockAuth.signInWithGoogle.mockRejectedValue(new Error('popup closed'));
  const { again } = renderHome();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'LeBron James this year' } });

  fireEvent.click(screen.getByRole('button', { name: 'Run it' }));
  await waitFor(() => expect(mockAuth.signInWithGoogle).toHaveBeenCalledTimes(1));
  await act(async () => {});
  // A later, unrelated sign-in must not replay the abandoned query.
  Object.assign(mockAuth, { isAuthenticated: true, currentUser: { uid: 'other-reader' } });
  again();
  await act(async () => {});

  expect(screen.getByRole('textbox')).toHaveValue('LeBron James this year');
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('waitlisted, the public sections show, search is disabled and there is no sign-up call to action', async () => {
  Object.assign(mockAuth, {
    isAuthenticated: true,
    currentUser: { uid: 'waiting' },
    waitlist: { message: 'The beta is full.' },
  });
  renderHome();

  await screen.findByRole('navigation', { name: "Today's games" });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Start with a player/ })).toHaveTextContent('22.4'),
  );
  expect(screen.getByRole('article', { name: 'Best: Jaime Jaquez Jr.' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Your Targets' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign up free' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Sign up with Google/)).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Browse without a query' })).toBeDisabled();
  expect(requested().sort()).toEqual([
    '/api/games/ladder',
    '/api/games/slate',
    '/api/games/slate/edges',
    '/api/research',
  ]);
});

test('Tonight notes once which inputs its scores take from an earlier season', async () => {
  const trailing = [
    { family: 'team_defense', serving_season: '2025-26', rule: 'every team has played 10 games' },
    { family: 'player_diets', serving_season: '2025-26', rule: 'every team has played 10 games' },
  ];
  apiClient.get.mockImplementation((url) =>
    new URL(url, 'http://localhost').pathname === '/api/games/slate'
      ? homeGet(url).then(({ data }) => ({ data: { ...data, trailing } }))
      : homeGet(url),
  );
  renderHome();

  const tonight = await screen.findByRole('region', { name: 'Tonight' });
  expect(await within(tonight).findByRole('note')).toHaveTextContent(
    'Scores use 2025-26 team defense and Diets until every team has played 10 games.',
  );
});

test('Tonight carries no season note when nothing trails', async () => {
  renderHome();

  const tonight = await screen.findByRole('region', { name: 'Tonight' });
  await within(tonight).findByRole('article', { name: 'Best: Jaime Jaquez Jr.' });
  expect(within(tonight).queryByRole('note')).not.toBeInTheDocument();
});
