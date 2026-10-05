import { act, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TargetForm, { targetToDraft } from './TargetForm';
import { TargetConditionSummary, backtestMinutesNote, validConditions } from './TargetConditions';
import { fetchDietBaselines, fetchSeasonMinutes } from './targetsApi';
import { LabSeasonValueProvider } from './backtestSample';
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
test('the add menu offers only the opponent Conditions, and saves them', async () => {
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  expect(screen.queryByRole('button', { name: 'a player’s game minutes' })).not.toBeInTheDocument();
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
test('the floor stands at its first stop, reading any, until the track is moved', () => {
  render(<Form />);
  const floor = screen.getByLabelText('Player game minutes');
  expect(floor).toBeVisible();
  expect(floor).toHaveValue('-1');
  expect(floor).toHaveAttribute('aria-valuetext', 'any');
  expect(screen.getByText('any')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save Target' })).toBeEnabled();
  fireEvent.change(floor, { target: { value: '15' } });
  expect(floor).toHaveAttribute('aria-valuetext', 'over 15 minutes');
  expect(screen.getByText('15 min')).toBeVisible();
});

test('the first stop is kept apart from a floor of zero', () => {
  render(<Form />);
  const floor = screen.getByLabelText('Player game minutes');
  fireEvent.change(floor, { target: { value: '0' } });
  expect(floor).toHaveAttribute('aria-valuetext', 'over 0 minutes');
  expect(screen.getByText('0 min')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      conditions: { defender: null, from: null, to: null, playerMinutes: 0 },
    }),
  );
});
test('sliding back to the first stop saves no Condition rather than blocking the save', () => {
  render(<Form />);
  const floor = screen.getByLabelText('Player game minutes');
  fireEvent.change(floor, { target: { value: '15' } });
  fireEvent.change(floor, { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ conditions: null }));
});

// The track cannot produce one, but a stored Target can still carry one.
test('a stored fractional floor is refused', () => {
  expect(validConditions({ defender: null, from: null, to: null, playerMinutes: 1.5 })).toBe(false);
  expect(validConditions({ defender: null, from: null, to: null, playerMinutes: 49 })).toBe(false);
  expect(validConditions({ defender: null, from: null, to: null, playerMinutes: 15 })).toBe(true);
});
test('a player game minutes floor is saved and reads as a Backtest note, not a chip', async () => {
  render(<Form />);
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
  const conditioned = {
    ...target,
    conditions: { defender: null, from: null, to: null, playerMinutes: 10 },
  };
  expect(backtestMinutesNote(conditioned)).toBe('excludes games \u2264 10 min');
  const { container } = render(<TargetConditionSummary target={conditioned} />);
  expect(container.querySelector('.target-condition-chip')).toBeNull();
});
test('a Target with no player game minutes Condition has no Backtest note', () => {
  expect(backtestMinutesNote(target)).toBeNull();
  expect(
    backtestMinutesNote({
      ...target,
      conditions: { defender: null, from: '2026-01-01', to: null },
    }),
  ).toBeNull();
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

test('the minutes floor sits in its own card, apart from the opponent filters', () => {
  const { container } = render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a date window' }));
  const backtest = screen.getByRole('region', { name: 'Backtest' });
  expect(backtest).toHaveClass('target-form-card');
  expect(backtest.querySelector('[aria-label="Player game minutes"]')).toBeTruthy();
  const teamCard = container.querySelector('.target-form-card:has([aria-label="Window preset"])');
  expect(teamCard).not.toBe(backtest);
  expect(teamCard.querySelector('[aria-label="Player game minutes"]')).toBeNull();
  expect(backtest.contains(teamCard)).toBe(false);
  expect(teamCard.contains(backtest)).toBe(false);
});
/*
 * The Lab can read a season other than the published one while league
 * averages and opponent readings are the published season's. Presets follow
 * the season the Lab reads, and the published-season context is not shown
 * beside another season's evidence.
 */
const renderInLab = (season, otherSeason) =>
  render(
    <LabSeasonValueProvider value={{ season, otherSeason }}>
      <Form />
    </LabSeasonValueProvider>,
  );

test('another season names its own dates and hides published-season context', async () => {
  fetchDietBaselines.mockResolvedValue({ shares: { shot_zones: { 'Restricted Area': 0.1 } } });
  renderInLab('2026-27', true);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a date window' }));
  fireEvent.change(screen.getByLabelText('Window preset'), { target: { value: '01' } });
  expect(screen.getByLabelText('From')).toHaveValue('2027-01-01');
  expect(
    screen.getByText(
      'League averages and opponent context cover the published season, so they are hidden while the Lab reads another.',
    ),
  ).toBeVisible();
  await act(async () => {});
  expect(screen.queryByText('league 10%')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'MIN opponent context' })).not.toBeInTheDocument();
});

/*
 * The Defender roster is read for the season the Lab reads, so its choices,
 * minutes and games are that season's. What was offered for another season is
 * never shown while the next one loads.
 */
const inLab = (season, requested) => (
  <LabSeasonValueProvider value={{ season, requested, otherSeason: season === '2026-27' }}>
    <Form />
  </LabSeasonValueProvider>
);
const defenderOptions = () =>
  Array.from(screen.getByLabelText('Defender').options).map((option) => option.textContent);

test('Defender choices are the roster of the season the Lab reads', async () => {
  const nextSeason = { resolve: null };
  fetchSeasonMinutes.mockImplementation(({ season }) =>
    season === '2026-27'
      ? new Promise((resolve) => {
          nextSeason.resolve = resolve;
        })
      : Promise.resolve({
          season: '2025-26',
          seasonReason: 'default',
          publishedSeason: '2025-26',
          players: [{ playerId: 27, name: 'Rudy Gobert', gamesPlayed: 60, averageMinutes: 32 }],
        }),
  );
  const { rerender } = render(inLab('2025-26', null));
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a defender’s minutes' }));
  expect(
    await screen.findByRole('option', { name: 'Rudy Gobert · 32.0 min · 60 games' }),
  ).toBeInTheDocument();
  expect(fetchSeasonMinutes).toHaveBeenLastCalledWith(
    expect.not.objectContaining({ season: expect.anything() }),
  );

  rerender(inLab('2026-27', '2026-27'));
  expect(fetchSeasonMinutes).toHaveBeenLastCalledWith(
    expect.objectContaining({ opponent: 'MIN', season: '2026-27' }),
  );
  // Next season's roster is not in yet, and this season's is not offered for it.
  expect(defenderOptions()).toEqual(['Choose a defender']);

  await act(async () =>
    nextSeason.resolve({
      season: '2026-27',
      seasonReason: 'requested',
      publishedSeason: '2026-27',
      players: [
        { playerId: 27, name: 'Rudy Gobert', gamesPlayed: 76, averageMinutes: 34 },
        { playerId: 41, name: 'Naz Reid', gamesPlayed: 81, averageMinutes: 24 },
      ],
    }),
  );
  expect(defenderOptions()).toEqual([
    'Choose a defender',
    'Rudy Gobert · 34.0 min · 76 games',
    'Naz Reid · 24.0 min · 81 games',
  ]);
});

test('a roster answered for another season than the Lab reads is not offered', async () => {
  // A backend that ignores the season answers with the published roster.
  fetchSeasonMinutes.mockResolvedValue({
    season: '2025-26',
    players: [{ playerId: 27, name: 'Rudy Gobert', gamesPlayed: 60, averageMinutes: 32 }],
  });
  render(inLab('2026-27', '2026-27'));
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a defender’s minutes' }));
  expect(await screen.findByText('The MIN roster for 2026-27 is unavailable.')).toBeVisible();
  expect(defenderOptions()).toEqual(['Choose a defender']);
});

test('the published season keeps its dates and league averages', async () => {
  fetchDietBaselines.mockResolvedValue({ shares: { shot_zones: { 'Restricted Area': 0.1 } } });
  renderInLab('2025-26', false);
  expect(await screen.findByText('league 10%')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'MIN opponent context' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a date window' }));
  fireEvent.change(screen.getByLabelText('Window preset'), { target: { value: '01' } });
  expect(screen.getByLabelText('From')).toHaveValue('2026-01-01');
  expect(screen.queryByText(/hidden while the Lab reads a past one/)).not.toBeInTheDocument();
});

test('removing the window leaves the Backtest section standing', () => {
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a date window' }));
  fireEvent.change(screen.getByLabelText('Player game minutes'), { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove window Condition' }));
  expect(screen.queryByLabelText('Window preset')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Player game minutes')).toHaveValue('15');
});

// Opponent transport is exercised in its own API/hook tests.
jest.mock('./opponentContextApi', () => ({
  ...jest.requireActual('./opponentContextApi'),
  fetchOpponentProfile: () => new Promise(() => {}),
}));

test('a chosen defender keeps the name read for him when the next season’s roster is refused', async () => {
  fetchSeasonMinutes.mockImplementation(async ({ season }) => {
    if (season === '2026-27')
      throw Object.assign(new Error('Request failed with status code 503'), {
        response: {
          status: 503,
          data: {
            error: { code: 'season_unavailable', message: 'The 2026-27 season is unavailable.' },
          },
        },
      });
    return {
      season: '2025-26',
      seasonReason: 'default',
      publishedSeason: '2025-26',
      players: [{ playerId: 27, name: 'Rudy Gobert', gamesPlayed: 60, averageMinutes: 32 }],
    };
  });
  const { rerender } = render(inLab('2025-26', null));
  fireEvent.click(screen.getByRole('button', { name: '+ and' }));
  fireEvent.click(screen.getByRole('button', { name: 'a defender’s minutes' }));
  await screen.findByRole('option', { name: 'Rudy Gobert · 32.0 min · 60 games' });
  fireEvent.change(screen.getByLabelText('Defender'), { target: { value: '27' } });

  rerender(inLab('2026-27', '2026-27'));
  expect(
    await screen.findByText('The 2026-27 season is unavailable.', { exact: false }),
  ).toBeVisible();
  expect(defenderOptions()).toEqual(['Choose a defender', 'Rudy Gobert · roster unavailable']);
  expect(screen.getByLabelText('Defender')).toHaveValue('27');
});
