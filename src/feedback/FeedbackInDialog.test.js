import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SaveFilterSetModal from '../SaveFilterSetModal';
import { createSavedFilterSet } from '../savedFilterSetsApi';
import ErrorMessage from './ErrorMessage';
import { FeedbackProvider } from './FeedbackContext';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, currentUser: { email: 'sam@example.com' } }),
}));
jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../savedFilterSetsApi', () => ({ createSavedFilterSet: jest.fn() }));

const renderInProvider = (ui) =>
  render(
    <MemoryRouter>
      <FeedbackProvider>{ui}</FeedbackProvider>
    </MemoryRouter>,
  );

test('Report this from a failed Save Filter Set takes typing despite the modal focus trap', async () => {
  createSavedFilterSet.mockRejectedValue({
    response: { status: 500, headers: { 'x-request-id': '3f9a12bc-0000' }, data: {} },
  });
  const onHide = jest.fn();
  renderInProvider(
    <SaveFilterSetModal show onHide={onHide} queryString="a=1" defaultName="Mine" />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Report this' }));

  const box = screen.getByRole('textbox', { name: 'Your feedback' });
  await userEvent.type(box, 'It would not save');
  // The modal reclaims focus from anything outside it a moment later.
  await new Promise((resolve) => setTimeout(resolve, 100));
  await userEvent.type(box, '!');
  expect(box).toHaveValue('It would not save!');
  expect(box).toHaveFocus();
  // Escape closes the popover and leaves the dialog it was opened from.
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: 'Send feedback' })).not.toBeInTheDocument();
  expect(onHide).not.toHaveBeenCalled();
});

test('the popover opens inside the dialog that holds the error, above its backdrop', async () => {
  renderInProvider(
    <div role="dialog" aria-label="Operator confirmation" aria-modal="true">
      <ErrorMessage message="The action failed. (ref 3f9a12bc)" />
    </div>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Report this' }));

  const host = screen.getByRole('dialog', { name: 'Operator confirmation' });
  expect(within(host).getByRole('dialog', { name: 'Send feedback' })).toBeVisible();
});

test('the popover goes when the dialog that hosts it does', async () => {
  const Host = ({ open }) => (
    <FeedbackProvider>
      {open && (
        <div role="dialog" aria-label="Operator confirmation">
          <ErrorMessage message="The action failed. (ref 3f9a12bc)" />
        </div>
      )}
    </FeedbackProvider>
  );
  const { rerender } = render(
    <MemoryRouter>
      <Host open />
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Report this' }));
  expect(screen.getByRole('dialog', { name: 'Send feedback' })).toBeVisible();

  rerender(
    <MemoryRouter>
      <Host open={false} />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Send feedback' })).not.toBeInTheDocument(),
  );
});
