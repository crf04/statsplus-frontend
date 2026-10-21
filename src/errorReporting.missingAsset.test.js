import * as Sentry from '@sentry/react';
import { initErrorReporting, reportRenderError } from './errorReporting';

test('a render error from a missing asset is tagged; other render errors are not', async () => {
  const sent = [];
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

  reportRenderError(new Error('Unable to preload CSS for /assets/GameLogFilter-D1x7kbiG.css'), {
    componentStack: '\n    at Lazy',
  });
  reportRenderError(new ReferenceError('teamId is not defined'), {
    componentStack: '\n    at Lazy',
  });
  await Sentry.flush();

  const events = sent
    .flatMap(([, items]) => items.filter(([header]) => header.type === 'event'))
    .map(([, payload]) => [payload.exception.values[0].value, payload.tags?.missing_asset]);
  expect(events).toEqual([
    ['Unable to preload CSS for /assets/GameLogFilter-D1x7kbiG.css', 'true'],
    ['teamId is not defined', undefined],
  ]);
  await Sentry.close();
});
