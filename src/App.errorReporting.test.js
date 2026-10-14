import { render, screen } from '@testing-library/react';
import * as Sentry from '@sentry/react';
import App from './App';
import { initErrorReporting } from './errorReporting';

jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ isAuthenticated: false, isAdmin: false }),
}));
jest.mock('./components/Auth/LoginButton', () => () => null);
jest.mock('./GameLogFilter.js', () => () => {
  throw new Error('page exploded');
});

test('a render error keeps the fallback UI and is reported', async () => {
  const sent = [];
  jest.spyOn(console, 'error').mockImplementation(() => {});
  initErrorReporting({
    dsn: 'https://key@example.ingest.sentry.io/1',
    transport: () => ({
      send: async (envelope) => {
        sent.push(envelope);
        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });

  render(<App />);

  expect(await screen.findByText('Could not load this page.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  await Sentry.flush();
  const messages = sent.flatMap(([, items]) =>
    items
      .filter(([header]) => header.type === 'event')
      .map(([, payload]) => payload.exception.values[0].value),
  );
  expect(messages).toContain('page exploded');
  await Sentry.close();
});
