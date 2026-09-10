import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TargetCaptureModal from './TargetCaptureModal';
import { createTarget, fetchDietBaselines, fetchTargetPreview } from './targetsApi';

jest.mock('./targetsApi', () => ({
  createTarget: jest.fn(),
  fetchDietBaselines: jest.fn(),
  fetchTargetPreview: jest.fn(),
}));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

/*
 * The one capture object a row hands the dialog, held by the host across a
 * dismissal and a reopening, as a host that memoises its row action would.
 */
const capture = {
  opponent: 'BOS',
  base: 'shot_zones',
  sliceKey: 'Restricted Area',
  leagueAverageShare: 0.2,
};

const LocationProbe = () => <span data-testid="location">{useLocation().pathname}</span>;

function Host() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <TargetCaptureModal capture={open ? capture : null} onHide={() => setOpen(false)} />
    </>
  );
}

const renderHost = () =>
  render(
    <MemoryRouter initialEntries={['/matchups/0022500584']}>
      <Routes>
        <Route path="/matchups/:gameId" element={<Host />} />
        <Route path="/targets/:targetId" element={<p>One Target</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  fetchDietBaselines.mockResolvedValue({ shares: {} });
  fetchTargetPreview.mockReturnValue(new Promise(() => {}));
});

/*
 * A save is this opening's. Dismissing the dialog and opening the same row
 * again is a new opening — the same capture object or not — and the first
 * save's late answer must not open a Target over the draft now being composed.
 */
test('a save that resolves after the same capture was dismissed and reopened does not navigate', async () => {
  let settle;
  createTarget.mockReturnValue(
    new Promise((resolve) => {
      settle = () => resolve({ id: 4, opponent: 'BOS', title: 'BOS vs Restricted area ≥ 20%' });
    }),
  );
  renderHost();

  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save Target' }));
  expect(createTarget).toHaveBeenCalledTimes(1);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));
  const reopened = await screen.findByRole('dialog');
  // The reopening starts from the prefill, with nothing left over from the
  // save still in flight: it is saveable again.
  const threshold = within(reopened).getByRole('slider', {
    name: 'Qualifier 1 threshold percent',
  });
  expect(threshold).toHaveValue('20');
  expect(within(reopened).getByRole('button', { name: 'Save Target' })).toBeEnabled();
  fireEvent.change(threshold, { target: { value: '26' } });

  await act(async () => settle());

  expect(screen.getByTestId('location')).toHaveTextContent(/^\/matchups\/0022500584$/);
  expect(screen.queryByText('One Target')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(threshold).toHaveValue('26');
});

test('a save answered while its own opening is still current opens the Target', async () => {
  createTarget.mockResolvedValue({ id: 4, opponent: 'BOS', title: 'BOS vs Restricted area ≥ 20%' });
  renderHost();

  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save Target' }));

  expect(await screen.findByText('One Target')).toBeVisible();
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/targets\/4$/);
});

// Opponent transport is exercised in its own API/hook tests.
jest.mock('./opponentContextApi', () => ({
  ...jest.requireActual('./opponentContextApi'),
  fetchOpponentProfile: () => new Promise(() => {}),
}));
