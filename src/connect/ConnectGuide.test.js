import { render, screen, within } from '@testing-library/react';
import ConnectGuide from './ConnectGuide';

jest.mock('./connectClip', () => ({ CONNECT_CLIP: null }));

test('with no clip configured, Ask one question shows no clip and no X link', () => {
  render(<ConnectGuide setup={null} />);

  const ask = screen.getByRole('region', { name: 'Ask one question' });
  expect(within(ask).queryByRole('complementary')).not.toBeInTheDocument();
  expect(within(ask).queryByRole('button', { name: /^Play:/ })).not.toBeInTheDocument();
  expect(within(ask).queryByRole('link', { name: /Watch on X/ })).not.toBeInTheDocument();
  expect(within(ask).getByText('Say the stat')).toBeInTheDocument();
});
