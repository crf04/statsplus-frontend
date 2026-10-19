import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ErrorMessage, { extractRequestReference } from './ErrorMessage';
import FeedbackButton from './FeedbackButton';
import { FeedbackProvider } from './FeedbackContext';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, currentUser: { email: 'sam@example.com' } }),
}));
jest.mock('../utils/axiosConfig', () => ({ __esModule: true, default: { post: jest.fn() } }));

test('finds the reference a request error message ends with', () => {
  expect(extractRequestReference('Unable to load this slate. (ref 3f9a12bc)')).toBe('3f9a12bc');
  expect(extractRequestReference('Unable to load this slate.')).toBeNull();
  expect(extractRequestReference('(ref 3F9A12BC) (ref 123)')).toBeNull();
  expect(extractRequestReference(null)).toBeNull();
});

test('outside a signed-in account the message is plain text with no Report this link', () => {
  render(<p role="alert">{<ErrorMessage message="It failed. (ref 3f9a12bc)" />}</p>);
  expect(screen.getByRole('alert')).toHaveTextContent('It failed. (ref 3f9a12bc)');
  expect(screen.queryByRole('button', { name: 'Report this' })).not.toBeInTheDocument();
});

const Screen = ({ refs }) => (
  <MemoryRouter>
    <FeedbackProvider>
      <FeedbackButton />
      {refs.map((ref) => (
        <p key={ref} role="alert">
          <ErrorMessage message={`Failed. (ref ${ref})`} />
        </p>
      ))}
    </FeedbackProvider>
  </MemoryRouter>
);

test('the header attaches the most recently mounted ref still on screen', async () => {
  const { rerender } = render(<Screen refs={['aaaaaaaa']} />);
  rerender(<Screen refs={['aaaaaaaa', 'bbbbbbbb']} />);
  await userEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  expect(within(screen.getByRole('dialog')).getByText('ref bbbbbbbb')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Close feedback' }));

  // The newest error leaves the screen, so the older one is on offer again.
  rerender(<Screen refs={['aaaaaaaa']} />);
  await userEvent.click(screen.getByRole('button', { name: 'Feedback' }));
  expect(within(screen.getByRole('dialog')).getByText('ref aaaaaaaa')).toBeVisible();
});

test('Report this attaches its own ref, not the newest one', async () => {
  render(<Screen refs={['aaaaaaaa', 'bbbbbbbb']} />);
  const first = screen.getAllByRole('alert')[0];
  await userEvent.click(within(first).getByRole('button', { name: 'Report this' }));
  expect(within(screen.getByRole('dialog')).getByText('ref aaaaaaaa')).toBeVisible();
});
