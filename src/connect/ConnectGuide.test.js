import { render, screen, within } from '@testing-library/react';
import ConnectGuide from './ConnectGuide';

jest.mock('./connectClip', () => ({ CONNECT_CLIP: null }));
jest.mock('./tutorialList', () => ({
  TUTORIALS: [
    {
      src: '/clips/second.mp4',
      poster: '/clips/second.jpg',
      title: 'Second tutorial',
      summary: 'The newer one.',
      duration: '0:45',
      tweetUrl: 'https://x.com/CourtAI_App/status/2',
    },
    {
      src: '/clips/first.mp4',
      poster: '/clips/first.jpg',
      title: 'First tutorial',
      summary: 'The older one.',
      duration: '1:17',
      tweetUrl: 'https://x.com/CourtAI_App/status/1',
    },
  ],
}));

test('with no clip configured, Ask one question shows no clip and no X link', () => {
  render(<ConnectGuide setup={null} />);

  const ask = screen.getByRole('region', { name: 'Ask one question' });
  expect(within(ask).queryByRole('complementary')).not.toBeInTheDocument();
  expect(within(ask).queryByRole('button', { name: /^Play:/ })).not.toBeInTheDocument();
  expect(within(ask).queryByRole('link', { name: /Watch on X/ })).not.toBeInTheDocument();
  expect(within(ask).getByText('Say the stat')).toBeInTheDocument();
});

test('Watch the tutorials lists every tutorial in order, each with its X post', () => {
  render(<ConnectGuide setup={null} />);

  const tutorials = screen.getByRole('region', { name: 'Watch the tutorials' });
  expect(
    within(tutorials)
      .getAllByRole('button', { name: /^Play:/ })
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(['Play: Second tutorial', 'Play: First tutorial']);
  expect(
    within(tutorials)
      .getAllByRole('link', { name: /Watch on X/ })
      .map((link) => link.getAttribute('href')),
  ).toEqual(['https://x.com/CourtAI_App/status/2', 'https://x.com/CourtAI_App/status/1']);
  expect(within(tutorials).getByText('The older one.')).toBeInTheDocument();
});
