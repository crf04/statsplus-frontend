import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TargetForm, { targetToDraft } from './TargetForm';
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
