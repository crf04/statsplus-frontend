import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';

jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    currentUser: null,
    loading: false,
    error: null,
    signInWithGoogle: jest.fn(),
    logout: jest.fn(),
    getToken: jest.fn(),
    isAuthenticated: false,
    isAdmin: false,
  }),
}));

const openSkillPage = async () => {
  window.history.pushState({}, '', '/skills/injury-brief');
  render(<App />);
  const heading = await screen.findByRole('heading', { level: 1, name: 'Injury brief' });
  await waitFor(() => expect(heading).toHaveFocus());
};

test('a signed-out visitor can open the page and download the skill zip that ships in the build', async () => {
  await openSkillPage();

  const download = screen.getByRole('link', { name: 'Download the skill (.zip)' });
  expect(download).toHaveAttribute('href', '/skills/courtai-injury-brief.zip');
  expect(within(screen.getByRole('main')).getByRole('link', { name: 'Connect' })).toHaveAttribute(
    'href',
    '/connect#guide-setup',
  );
  expect(fs.existsSync(path.resolve(process.cwd(), 'public/skills/courtai-injury-brief.zip'))).toBe(
    true,
  );
});

test('the Claude tab is first and says where to upload the skill', async () => {
  await openSkillPage();

  const tabs = within(screen.getByRole('tablist', { name: 'Where you run it' })).getAllByRole(
    'tab',
  );
  expect(tabs.map((t) => t.textContent)).toEqual(['Claude', 'Claude Code', 'ChatGPT']);
  expect(screen.getByRole('tabpanel')).toHaveTextContent(
    'Open Customize → Skills, select +, then Create skill → Upload a skill, and choose the zip.',
  );
});

test('the ChatGPT tab says which plans can upload skills and where to upload the zip', async () => {
  await openSkillPage();

  fireEvent.click(screen.getByRole('tab', { name: 'ChatGPT' }));

  const panel = screen.getByRole('tabpanel', { name: 'ChatGPT' });
  expect(panel).toHaveTextContent(
    'Skill uploads are on ChatGPT Business, Enterprise, Edu and Healthcare workspaces, when your admin allows them; Plus and Pro do not include them.',
  );
  expect(panel).toHaveTextContent(
    'In the sidebar, open Plugins → Skills, select Create, then Upload from your computer, and choose the zip without unzipping it.',
  );
  expect(within(panel).getByRole('link', { name: 'Download the skill (.zip)' })).toHaveAttribute(
    'href',
    '/skills/courtai-injury-brief.zip',
  );
});

test("the ChatGPT tab's Copy button puts exactly the prompt on the clipboard", async () => {
  let clipboardText = '';
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text) => {
        clipboardText = text;
        return Promise.resolve();
      },
    },
  });
  await openSkillPage();

  fireEvent.click(screen.getByRole('tab', { name: 'ChatGPT' }));
  const panel = screen.getByRole('tabpanel', { name: 'ChatGPT' });
  fireEvent.click(within(panel).getByRole('button', { name: 'Copy' }));

  expect(await within(panel).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  expect(clipboardText).toBe('Run the injury brief for tonight.');
  delete navigator.clipboard;
});

test('the Connect guide links to the skill page', async () => {
  window.history.pushState({}, '', '/connect');
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Ask CourtAI from your chat' });

  expect(screen.getByRole('link', { name: 'injury brief skill' })).toHaveAttribute(
    'href',
    '/skills/injury-brief',
  );
});
