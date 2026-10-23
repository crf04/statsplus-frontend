import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpTip from './HelpTip';

const renderTip = () =>
  render(
    <div>
      <h2>What OKC allows</h2>
      <HelpTip tip="defenseSheet" />
      <p>Outside</p>
    </div>,
  );

test('opens a note explaining the section and closes it again from the button', async () => {
  renderTip();
  const button = screen.getByRole('button', { name: 'About Defense Sheet' });
  expect(screen.queryByRole('note')).toBeNull();

  await userEvent.click(button);
  const note = screen.getByRole('note', { name: 'Defense Sheet' });
  expect(note).toHaveTextContent('The track is its rank from 1 to 30, where 30 allows the most.');
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(button).toHaveAttribute('aria-controls', note.id);

  await userEvent.click(button);
  expect(screen.queryByRole('note')).toBeNull();
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('Escape closes the note and returns focus to its button', async () => {
  renderTip();
  const button = screen.getByRole('button', { name: 'About Defense Sheet' });
  await userEvent.click(button);
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('note')).toBeNull();
  expect(button).toHaveFocus();
});

test('a press outside the tip closes the note; a press inside it does not', async () => {
  renderTip();
  await userEvent.click(screen.getByRole('button', { name: 'About Defense Sheet' }));
  fireEvent.pointerDown(screen.getByRole('note'));
  expect(screen.getByRole('note')).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByText('Outside'));
  expect(screen.queryByRole('note')).toBeNull();
});
