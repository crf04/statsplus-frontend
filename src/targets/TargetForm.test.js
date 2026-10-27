import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TargetForm, { describeDraft, targetDraftToRequest, targetToDraft } from './TargetForm';
import { fetchDietBaselines } from './targetsApi';
jest.mock('./targetsApi', () => ({ fetchDietBaselines: jest.fn() }));
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));
const target = {
  opponent: 'OKC',
  note: '',
  qualifiers: [
    { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
  ],
};
function Form() {
  const [draft, setDraft] = useState(targetToDraft(target));
  return (
    <TargetForm
      draft={draft}
      onChange={(patch) => setDraft({ ...draft, ...patch })}
      onSubmit={() => {}}
    />
  );
}
test('the shared qualifier slider reads the league tick, flips its side and nudges by one percent', async () => {
  fetchDietBaselines.mockResolvedValue({ shares: { shot_zones: { 'Corner 3': 0.23 } } });
  render(<Form />);
  expect(await screen.findByText('league 23%')).toBeVisible();
  const slider = screen.getByRole('slider', { name: 'Qualifier 1 threshold percent' });
  expect(slider).toHaveAttribute('max', '60');
  expect(slider).toHaveValue('40');
  fireEvent.keyDown(slider, { key: 'ArrowRight' });
  expect(slider).toHaveValue('41');
  fireEvent.click(screen.getByRole('button', { name: 'At or above; switch to at or below' }));
  expect(screen.getByRole('button', { name: 'At or below; switch to at or above' })).toBeVisible();
  expect(slider.closest('.target-slider-row')).toHaveClass('is-at-or-below');
  fireEvent.change(slider, { target: { value: '60' } });
  expect(slider).toHaveAttribute('max', '70');
});

test('changing the slice moves its league tick and an absent baseline never becomes zero', async () => {
  fetchDietBaselines.mockResolvedValue({
    shares: { shot_zones: { 'Corner 3': 0.23, 'Mid-Range': 0.61, 'Restricted Area': null } },
  });
  render(<Form />);
  expect(await screen.findByText('league 23%')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Qualifier 1 slice'), { target: { value: 'Mid-Range' } });
  expect(screen.getByText('league 61%')).toBeVisible();
  expect(screen.getByRole('slider', { name: /threshold percent/ })).toHaveAttribute('max', '70');
  fireEvent.change(screen.getByLabelText('Qualifier 1 slice'), {
    target: { value: 'Restricted Area' },
  });
  expect(screen.queryByText(/^league /)).not.toBeInTheDocument();
  expect(screen.getByRole('slider', { name: /threshold percent/ })).toHaveValue('40');
});

test('a pointer threshold is displayed at the precision that will be saved', async () => {
  fetchDietBaselines.mockResolvedValue({ shares: {} });
  render(<Form />);
  fireEvent.change(screen.getByRole('slider', { name: /threshold percent/ }), {
    target: { value: '25.930123' },
  });
  expect(screen.getByRole('slider', { name: /threshold percent/ })).toHaveValue('25.9');
  expect(screen.getByText('25.9%')).toBeVisible();
});

test('nudging a threshold below zero keeps it at zero', async () => {
  fetchDietBaselines.mockResolvedValue({ shares: {} });
  render(<Form />);
  const slider = screen.getByRole('slider', { name: /threshold percent/ });
  fireEvent.change(slider, { target: { value: '0' } });
  fireEvent.keyDown(slider, { key: 'ArrowLeft' });
  expect(screen.getByText('0%')).toBeVisible();
  expect(screen.queryByText('-1%')).not.toBeInTheDocument();
});

const withPosition = {
  ...target,
  qualifiers: [
    { base: 'position', groups: ['Wing', 'Big'] },
    ...target.qualifiers,
    { base: 'season_average', stat: '3PA', comparator: 'at_or_above', threshold: 0.3 },
  ],
};

test('a stored Position and Average Qualifier become the toggle and a row, and go back out as they came', () => {
  const draft = targetToDraft(withPosition);
  expect(draft.positions).toEqual(['Wing', 'Big']);
  expect(draft.qualifiers).toEqual([
    { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', thresholdPercent: '40' },
    { base: 'season_average', stat: '3PA', comparator: 'at_or_above', thresholdText: '0.3' },
  ]);
  expect(targetDraftToRequest(draft).qualifiers).toEqual(withPosition.qualifiers);
});

test('no Position selected sends none, and a Position alone is a complete draft', () => {
  const draft = { ...targetToDraft(target), positions: [] };
  expect(targetDraftToRequest(draft).qualifiers.map(({ base }) => base)).toEqual(['shot_zones']);
  const onlyPosition = { ...draft, positions: ['Big'], qualifiers: [] };
  expect(describeDraft(onlyPosition)).toMatchObject({
    valid: true,
    request: { qualifiers: [{ base: 'position', groups: ['Big'] }] },
  });
  expect(describeDraft({ ...onlyPosition, positions: [] })).toEqual({
    valid: false,
    problem: 'Add at least one Qualifier before saving.',
  });
});

test.each(['', '-1', 'abc'])('an average threshold of %p keeps the draft unsaveable', (text) => {
  const draft = targetToDraft(withPosition);
  draft.qualifiers[1].thresholdText = text;
  expect(describeDraft(draft)).toEqual({
    valid: false,
    problem: 'Every season average threshold must be a number of 0 or more.',
  });
});

test('toggling a Position, then a Season average row, edits the draft the way a user does', () => {
  fetchDietBaselines.mockResolvedValue({ shares: {} });
  let latest;
  function Probe() {
    const [draft, setDraft] = useState(targetToDraft(target));
    latest = draft;
    return (
      <TargetForm
        draft={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onSubmit={() => {}}
      />
    );
  }
  render(<Probe />);
  const big = screen.getByRole('button', { name: 'Big' });
  expect(big).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(big);
  fireEvent.click(screen.getByRole('button', { name: 'Wing' }));
  expect(big).toHaveAttribute('aria-pressed', 'true');
  expect(targetDraftToRequest(latest).qualifiers[0]).toEqual({
    base: 'position',
    groups: ['Wing', 'Big'],
  });
  fireEvent.click(big);
  expect(targetDraftToRequest(latest).qualifiers[0]).toEqual({
    base: 'position',
    groups: ['Wing'],
  });

  fireEvent.change(screen.getByLabelText('Qualifier 1 diet base'), {
    target: { value: 'season_average' },
  });
  fireEvent.change(screen.getByLabelText('Qualifier 1 stat'), { target: { value: '3PA/36' } });
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold'), { target: { value: '2.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'At or above; switch to at or below' }));
  expect(targetDraftToRequest(latest).qualifiers.slice(1)).toEqual([
    { base: 'season_average', stat: '3PA/36', comparator: 'at_or_below', threshold: 2.5 },
  ]);
  expect(screen.getByText('per 36 min average')).toBeVisible();
});

// Opponent transport is exercised in its own API/hook tests.
jest.mock('./opponentContextApi', () => ({
  ...jest.requireActual('./opponentContextApi'),
  fetchOpponentProfile: () => new Promise(() => {}),
}));
