import { useState } from 'react';
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
test('a Condition line names the defender and the count of opponent games kept', async () => {
  render(
    <TargetConditionSummary
      target={{
        ...target,
        conditions: {
          defender: { playerId: 27, comparator: 'under', minutes: 8 },
          from: null,
          to: null,
        },
      }}
      gamesConsidered={{ kept: 3, played: 10 }}
    />,
  );
  expect(await screen.findByText(/Rudy Gobert under 8 min/)).toHaveTextContent(
    '3 of 10 opponent games kept',
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
  oldRoster({
    season: '2025-26',
    players: [{ playerId: 27, name: 'Rudy Gobert', gamesPlayed: 60, averageMinutes: 32 }],
  });
  await waitFor(() =>
    expect(screen.queryByRole('option', { name: /Rudy Gobert/ })).not.toBeInTheDocument(),
  );
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
