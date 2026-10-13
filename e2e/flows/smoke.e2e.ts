import { expect } from 'e2e';
import { signedOutTest } from './support/courtai.ts';

signedOutTest('CourtAI app shell loads', { tags: ['smoke'] }, async ({ app, screen }) => {
  await app.open('/');
  const navigation = screen.getByRole('navigation', 'Primary');
  await expect(navigation.getByRole('link', 'CourtAI')).toBeVisible();
  await expect(navigation.getByRole('link', 'Search')).toHaveAttribute('aria-current', 'page');
  await expect(navigation.getByRole('link', 'Connect')).toHaveAttribute('href', '/connect');
  await expect(screen.getByRole('heading', 'Ask the box score')).toBeVisible();
  await app.screenshot('courtai-shell');
});
