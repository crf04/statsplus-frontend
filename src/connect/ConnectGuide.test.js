import { render, screen, within } from '@testing-library/react';
import ConnectGuide from './ConnectGuide';

jest.mock('./connectClip', () => ({
  CONNECT_CLIP: {
    src: '/clips/courtai-in-a-chat.mp4',
    poster: '/clips/courtai-in-a-chat.jpg',
    title: 'CourtAI in a chat',
    duration: '0:23',
    tweetUrl: 'https://x.com/courtai/status/1',
  },
}));

test('a configured clip plays beside Ask one question with its Watch on X link', () => {
  render(<ConnectGuide setup={null} />);

  const ask = screen.getByRole('region', { name: 'Ask one question' });
  const clip = within(ask).getByRole('complementary', { name: 'CourtAI in a chat' });
  const video = clip.querySelector('video');
  expect(video).toHaveAttribute('src', '/clips/courtai-in-a-chat.mp4');
  expect(video).toHaveAttribute('poster', '/clips/courtai-in-a-chat.jpg');
  expect(within(clip).getByText('0:23', { exact: false })).toBeInTheDocument();
  expect(within(clip).getByRole('link', { name: /Watch on X/ })).toHaveAttribute(
    'href',
    'https://x.com/courtai/status/1',
  );
  // The habits stay in the lesson beside the clip.
  expect(within(ask).getByText('Say the stat')).toBeInTheDocument();
  expect(document.querySelectorAll('video')).toHaveLength(1);
});
