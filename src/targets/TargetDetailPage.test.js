import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TargetDetailPage from './TargetDetailPage';
import { deleteTarget, fetchTargets, updateTarget } from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargets: jest.fn(),
  updateTarget: jest.fn(),
  deleteTarget: jest.fn(),
}));

const auth = { isAuthenticated: true, loading: false };
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

/*
 * The title is the backend's and is deliberately not what these Qualifiers
 * would derive, so displaying a locally derived title fails here. The instant
 * is near midnight UTC, so a formatter reading it in local time would name the
 * wrong day.
 */
const target = {
  id: 7,
  opponent: 'OKC',
  title: 'OKC vs Corner 3 ≥ 40% (v2)',
  note: 'Leaks the corner late.',
  createdAt: '2026-04-08T23:30:00Z',
  qualifiers: [
    { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
  ],
};

const LocationProbe = () => <output data-testid="location">{useLocation().pathname}</output>;

const renderDetail = (path = '/targets/7') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/targets" element={<p>All Targets</p>} />
        <Route path="/targets/:targetId" element={<TargetDetailPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  auth.isAuthenticated = true;
  auth.loading = false;
  fetchTargets.mockResolvedValue([target]);
  updateTarget.mockResolvedValue(undefined);
  deleteTarget.mockResolvedValue(undefined);
});

test('shows one Target with its Qualifiers, note, creation date, and a way back', async () => {
  renderDetail();

  expect(
    await screen.findByRole('heading', { name: 'OKC vs Corner 3 ≥ 40% (v2)' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Target · set Apr 8, 2026')).toBeInTheDocument();
  expect(screen.getByText('Leaks the corner late.')).toBeInTheDocument();
  const qualifiers = screen.getAllByRole('listitem');
  expect(qualifiers).toHaveLength(1);
  expect(qualifiers[0]).toHaveTextContent('Shot zones');
  expect(qualifiers[0]).toHaveTextContent('Corner 3 ≥ 40%');
  expect(qualifiers[0]).toHaveTextContent('of FGA');
  expect(screen.getByRole('link', { name: '← All Targets' })).toHaveAttribute('href', '/targets');
});

test('a Target that is gone says so instead of showing an empty one', async () => {
  renderDetail('/targets/999');

  expect(await screen.findByRole('heading', { name: 'That Target is gone.' })).toBeInTheDocument();
});

test('editing changes the Qualifiers and the note, and the backend re-derives the title', async () => {
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

  // The opponent is what the Target is about, so editing cannot move it.
  expect(screen.queryByLabelText('Opponent')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(40);

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '45' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'At or below' }));
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
    target: { value: 'Zone walls off the corner instead.' },
  });

  fetchTargets.mockResolvedValue([
    {
      ...target,
      title: 'OKC vs Corner 3 ≤ 45%',
      note: 'Zone walls off the corner instead.',
      qualifiers: [
        { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_below', threshold: 0.45 },
      ],
    },
  ]);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  });

  expect(updateTarget).toHaveBeenCalledWith({
    id: 7,
    note: 'Zone walls off the corner instead.',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_below', threshold: 0.45 },
    ],
  });
  expect(await screen.findByRole('heading', { name: 'OKC vs Corner 3 ≤ 45%' })).toBeInTheDocument();
  expect(screen.getByText('Zone walls off the corner instead.')).toBeInTheDocument();
});

test('a refused edit reads as the backend explained it and keeps the form open', async () => {
  updateTarget.mockRejectedValue({
    response: {
      status: 409,
      data: { error: { code: 'operation_conflict', message: 'You already have that Target.' } },
    },
  });
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  });

  expect(screen.getByRole('alert')).toHaveTextContent('You already have that Target.');
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
});

test('deleting asks first, then removes the Target and returns to the grid', async () => {
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(screen.getByText('Delete this Target?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
  expect(deleteTarget).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
  });

  expect(deleteTarget).toHaveBeenCalledWith({ id: 7 });
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/targets$/);
});

/*
 * The slice vocabulary is the backend's. If a stored Target names a slice this
 * page has no label for, a picker would quietly swap it for its first option
 * and the edit would change a criterion nobody touched.
 */
test('an unrecognised slice is shown as stored rather than silently replaced', async () => {
  fetchTargets.mockResolvedValue([
    {
      ...target,
      qualifiers: [
        { base: 'play_types', sliceKey: 'Misc', comparator: 'at_or_above', threshold: 0.4 },
      ],
    },
  ]);
  renderDetail();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

  const slice = screen.getByLabelText('Qualifier 1 slice');
  expect(slice).toHaveValue('Misc');
  expect(slice).toBeDisabled();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  });

  expect(updateTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      qualifiers: [
        { base: 'play_types', sliceKey: 'Misc', comparator: 'at_or_above', threshold: 0.4 },
      ],
    }),
  );
});

test('signed out, the detail asks for sign-in the way the slate does', () => {
  auth.isAuthenticated = false;
  renderDetail();

  expect(screen.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeInTheDocument();
  expect(fetchTargets).not.toHaveBeenCalled();
});
