import { act, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TargetForm, { targetToDraft } from './TargetForm';
import { TargetConditionSummary } from './TargetConditions';
import { fetchDietBaselines, fetchSeasonMinutes } from './targetsApi';
jest.mock('./targetsApi', () => ({ fetchDietBaselines: jest.fn(), fetchSeasonMinutes: jest.fn() }));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
const target = {
  opponent: 'MIN',
  note: '',
  qualifiers: [
    { base: 'shot_zones', sliceKey: 'Restricted Area', comparator: 'at_or_above', threshold: 0.3 },
  ],
};
const save = jest.fn();
function Form() {
  const [draft, setDraft] = useState(targetToDraft(target));
  return (
    <TargetForm
      draft={draft}
      onChange={(patch) => setDraft({ ...draft, ...patch })}
      onSubmit={save}
    />
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  fetchDietBaselines.mockResolvedValue({ shares: {} });
  fetchSeasonMinutes.mockResolvedValue({
    season: '2025-26',
    players: [{ playerId: 27, name: 'Rudy Gobert', gamesPlayed: 60, averageMinutes: 32 }],
  });
});
test('one add menu offers each Condition once and saves defender and season-window criteria', async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a defender’s minutes' }));
  expect(screen.getByText('Games he sat out count as 0 min.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(
    await screen.findByRole('option', { name: 'Rudy Gobert · 32.0 min · 60 games' }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Defender'), { target: { value: '27' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Defender minutes' }), {
    target: { value: '8' },
  });
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  expect(screen.queryByRole('button', { name: 'a defender’s minutes' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'a date window' }));
  fireEvent.change(screen.getByLabelText('Window preset'), { target: { value: '01' } });
  expect(screen.getByLabelText('From')).toHaveValue('2026-01-01');
  fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      conditions: {
        defender: { playerId: 27, comparator: 'under', minutes: 8 },
        from: '2026-01-01',
        to: null,
      },
    }),
  );
  fireEvent.change(screen.getByLabelText('Through'), { target: { value: '2025-12-01' } });
  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
});
test('a player game minutes Condition defaults to a strict backtest threshold and can be removed', async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a player’s game minutes' }));
  expect(screen.getByLabelText('Player game minutes')).toHaveValue(10);
  expect(screen.getByText(/strictly greater than 10 minutes in the backtest/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Remove player game minutes Condition' }));
  expect(screen.queryByLabelText('Player game minutes')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  expect(screen.getByRole('button', { name: 'a player’s game minutes' })).toBeVisible();
});
test('an incomplete player game minutes threshold remains invalid until filled', () => {
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a player’s game minutes' }));
  fireEvent.change(screen.getByLabelText('Player game minutes'), { target: { value: '' } });
  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(
    screen.getByText('Player game minutes must be an integer from 0 through 48.'),
  ).toBeVisible();
  expect(screen.getByText('Enter an integer threshold from 0 through 48 minutes.')).toBeVisible();
  expect(screen.queryByText(/strictly greater than\s+minutes/)).not.toBeInTheDocument();
});
test('a player game minutes Condition is included in the saved draft and compact summary', async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a player’s game minutes' }));
  fireEvent.change(screen.getByLabelText('Player game minutes'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      conditions: {
        defender: null,
        from: null,
        to: null,
        playerMinutes: 0,
      },
    }),
  );
  const { container } = render(
    <TargetConditionSummary
      target={{
        ...target,
        conditions: { defender: null, from: null, to: null, playerMinutes: 10 },
      }}
    />,
  );
  expect(container.querySelector('.target-condition-chip')).toHaveTextContent(
    'player game minutes > 10 min (backtest only)',
  );
});
test('a Condition chip names the defender once the roster read resolves', async () => {
  const { container } = render(
    <TargetConditionSummary
      target={{
        ...target,
        conditions: {
          defender: { playerId: 27, comparator: 'under', minutes: 8 },
          from: null,
          to: null,
        },
      }}
    />,
  );
  await screen.findByText(/Rudy Gobert under/);
  expect(container.querySelector('.target-condition-chip')).toHaveTextContent(
    'Rudy Gobert under 8 min (sat out = 0)',
  );
});
test('changing opponent clears the defender and ignores the old roster response', async () => {
  let oldRoster;
  fetchSeasonMinutes.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        oldRoster = resolve;
      }),
  );
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a defender’s minutes' }));
  fetchSeasonMinutes.mockResolvedValue({
    season: '2025-26',
    players: [{ playerId: 2, name: 'New Defender', gamesPlayed: 50, averageMinutes: 20 }],
  });
  fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'BOS' } });
  expect(await screen.findByRole('option', { name: /New Defender/ })).toBeInTheDocument();
  await act(async () =>
    oldRoster({
      season: '2025-26',
      players: [{ playerId: 27, name: 'Rudy Gobert', gamesPlayed: 60, averageMinutes: 32 }],
    }),
  );
  expect(screen.getByRole('option', { name: /New Defender/ })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /Rudy Gobert/ })).not.toBeInTheDocument();
});

test('a selected defender cannot carry over to a different opponent', async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a defender’s minutes' }));
  await screen.findByRole('option', { name: /Rudy Gobert/ });
  fireEvent.change(screen.getByLabelText('Defender'), { target: { value: '27' } });
  expect(screen.getByRole('button', { name: 'Save Target' })).toBeEnabled();
  fetchSeasonMinutes.mockResolvedValue({
    season: '2025-26',
    players: [{ playerId: 2, name: 'New Defender', gamesPlayed: 50, averageMinutes: 20 }],
  });
  fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'BOS' } });
  await screen.findByRole('option', { name: /New Defender/ });
  expect(screen.getByLabelText('Defender')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
});

test('a window-only roster failure explains why its season presets are unavailable', async () => {
  fetchSeasonMinutes.mockRejectedValueOnce(new Error('Roster unavailable.'));
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a date window' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Roster unavailable.');
  expect(screen.getByRole('option', { name: 'Since Jan 1' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry roster' }));
  await waitFor(() => expect(screen.getByRole('option', { name: 'Since Jan 1' })).toBeEnabled());
});
