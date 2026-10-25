import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

test('the ChatGPT tab copies the Project instructions', async () => {
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await openSkillPage();

  await userEvent.click(screen.getByRole('tab', { name: 'ChatGPT' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy instructions' }));

  expect(writeText).toHaveBeenCalledWith(
    expect.stringMatching(
      /^When I ask for the injury brief .* follow SKILL\.md in this project's files step by step/,
    ),
  );
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
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
