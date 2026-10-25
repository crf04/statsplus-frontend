import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zlib from 'node:zlib';
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

// The Project instructions as CHATGPT.md in the downloadable zip states them, so the
// page's copy cannot drift from the skill it ships.
const LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const zipEntry = (zip, name) => {
  for (let at = zip.indexOf(LOCAL_HEADER); at !== -1;) {
    const method = zip.readUInt16LE(at + 8);
    const size = zip.readUInt32LE(at + 18);
    const nameLength = zip.readUInt16LE(at + 26);
    const start = at + 30 + nameLength + zip.readUInt16LE(at + 28);
    if (zip.toString('utf8', at + 30, at + 30 + nameLength) === name) {
      const body = zip.subarray(start, start + size);
      return (method === 8 ? zlib.inflateRawSync(body) : body).toString('utf8');
    }
    at = zip.indexOf(LOCAL_HEADER, start + size);
  }
  throw new Error(`${name} is not in the zip`);
};

const shippedChatgptInstructions = () => {
  const zip = fs.readFileSync(
    path.resolve(process.cwd(), 'public/skills/courtai-injury-brief.zip'),
  );
  const block = zipEntry(zip, 'courtai-injury-brief/CHATGPT.md').match(
    /```text\n([\s\S]*?)\n\s*```/,
  )[1];
  return block
    .split('\n')
    .map((line) => line.trim())
    .join(' ');
};

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

test('the ChatGPT tab copies the Project instructions', async () => {
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await openSkillPage();

  await userEvent.click(screen.getByRole('tab', { name: 'ChatGPT' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy instructions' }));

  expect(writeText).toHaveBeenCalledWith(shippedChatgptInstructions());
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
