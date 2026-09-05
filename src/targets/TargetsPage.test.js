import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TargetsPage from './TargetsPage';
import { createTarget, fetchTargets } from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargets: jest.fn(),
  createTarget: jest.fn(),
}));

const auth = { isAuthenticated: true, loading: false };
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

const targets = [
  {
    id: 7,
    opponent: 'OKC',
    title: 'OKC vs Corner 3 ≥ 40%',
    note: 'Leaks the corner late.',
    createdAt: '2026-04-08T15:12:00Z',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  },
  {
    id: 8,
    opponent: 'MIA',
    title: 'MIA vs Restricted area ≤ 20%',
    note: '',
    createdAt: '2026-04-08T15:12:00Z',
    qualifiers: [
      {
        base: 'shot_zones',
        sliceKey: 'Restricted Area',
        comparator: 'at_or_below',
        threshold: 0.2,
      },
    ],
  },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/targets']}>
      <TargetsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  auth.isAuthenticated = true;
  auth.loading = false;
  fetchTargets.mockResolvedValue(targets);
  createTarget.mockResolvedValue(undefined);
});

test('shows every saved Target as a card carrying its derived title, Qualifiers, and note', async () => {
  renderPage();

  const cards = await screen.findAllByRole('link', { name: /^Open / });
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveAccessibleName('Open OKC vs Corner 3 ≥ 40%');
  expect(cards[0]).toHaveAttribute('href', '/targets/7');
  expect(cards[0]).toHaveTextContent('Corner 3 ≥ 40%');
  expect(cards[0]).toHaveTextContent('Leaks the corner late.');
  expect(cards[1]).toHaveTextContent('No note');
  expect(screen.getByRole('heading', { name: '2 Targets' })).toBeInTheDocument();
});

test('says so plainly when the account has no Targets yet', async () => {
  fetchTargets.mockResolvedValue([]);
  renderPage();

  expect(await screen.findByRole('heading', { name: 'No Targets yet.' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '0 Targets' })).toBeInTheDocument();
});

test('previews the title the Qualifiers would derive', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '40' },
  });
  fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'OKC' } });

  expect(screen.getByText('OKC vs Corner 3 ≥ 40%')).toBeInTheDocument();
});

test('refuses to save a threshold outside the 0-100% share range', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });
  const save = screen.getByRole('button', { name: 'Save Target' });
  expect(save).toBeEnabled();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '140' },
  });

  expect(save).toBeDisabled();
  expect(
    screen.getByText('Every threshold must be a share between 0% and 100%.'),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '' },
  });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '0' },
  });
  expect(save).toBeEnabled();
});

test('refuses to save a Target with no Qualifier at all', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  fireEvent.click(screen.getByRole('button', { name: 'Remove Qualifier 1' }));

  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(screen.getByText('Add at least one Qualifier before saving.')).toBeInTheDocument();
});

test('saves several Qualifiers as one Target and reloads the list the backend returns', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'NOP' } });
  fireEvent.change(screen.getByLabelText('Qualifier 1 slice'), {
    target: { value: 'Restricted Area' },
  });
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '35' },
  });
  fireEvent.click(screen.getByRole('button', { name: '+ Add a Qualifier' }));
  fireEvent.change(screen.getByLabelText('Qualifier 2 diet base'), {
    target: { value: 'play_types' },
  });
  fireEvent.change(screen.getByLabelText('Qualifier 2 slice'), { target: { value: 'Transition' } });
  fireEvent.change(screen.getByLabelText('Qualifier 2 threshold percent'), {
    target: { value: '15' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'At or below' })[1]);
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
    target: { value: 'No rim protection when Missi sits.' },
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(createTarget).toHaveBeenCalledWith({
    opponent: 'NOP',
    note: 'No rim protection when Missi sits.',
    qualifiers: [
      {
        base: 'shot_zones',
        sliceKey: 'Restricted Area',
        comparator: 'at_or_above',
        threshold: 0.35,
      },
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_below', threshold: 0.15 },
    ],
  });
  expect(fetchTargets).toHaveBeenCalledTimes(2);
  // A saved Target leaves a blank form behind, ready for the next idea.
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(25);
  expect(screen.queryByLabelText('Qualifier 2 threshold percent')).not.toBeInTheDocument();
});

test('a refused duplicate reads as the backend explained it and keeps the draft', async () => {
  createTarget.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: { code: 'operation_conflict', message: 'You already have that Target for OKC.' },
      },
    },
  });
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'OKC' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You already have that Target for OKC.',
  );
  expect(screen.getByLabelText('Opponent')).toHaveValue('OKC');
  expect(fetchTargets).toHaveBeenCalledTimes(1);
});

test('a rejected list read stays readable rather than showing an empty account', async () => {
  fetchTargets.mockRejectedValue({
    response: {
      status: 503,
      data: { error: { code: 'provider_unavailable', message: 'Targets are unavailable.' } },
    },
  });
  renderPage();

  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Targets are unavailable.'),
  );
  expect(screen.queryByRole('heading', { name: 'No Targets yet.' })).not.toBeInTheDocument();
});

test('signed out, the page asks for sign-in the way the slate does', () => {
  auth.isAuthenticated = false;
  renderPage();

  expect(screen.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeInTheDocument();
  expect(fetchTargets).not.toHaveBeenCalled();
});
