import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeTutorial from './HomeTutorial';
import { TUTORIALS } from '../connect/tutorialList';

jest.mock('../connect/tutorialList', () => ({ TUTORIALS: [] }));

const tutorial = (name, title, summary) => ({
  src: `/clips/${name}.mp4`,
  poster: `/clips/${name}.jpg`,
  title,
  summary,
  duration: '0:45',
  tweetUrl: `https://x.com/CourtAI_App/status/${name}`,
});

const renderStrip = () =>
  render(
    <MemoryRouter>
      <HomeTutorial />
    </MemoryRouter>,
  );

afterEach(() => TUTORIALS.splice(0));

test('shows only the newest tutorial, numbered by its place in the series', () => {
  TUTORIALS.push(
    tutorial('second', 'Second tutorial', 'The newer one.'),
    tutorial('first', 'First tutorial', 'The older one.'),
  );
  renderStrip();

  const strip = screen.getByRole('region', { name: 'Second tutorial' });
  expect(within(strip).getByText(/^New tutorial/)).toHaveTextContent('New tutorial · Part 2');
  expect(within(strip).getByText('The newer one.')).toBeInTheDocument();
  expect(within(strip).queryByText('First tutorial')).not.toBeInTheDocument();
  expect(within(strip).getByRole('link', { name: 'All tutorials' })).toHaveAttribute(
    'href',
    '/connect#guide-tutorials',
  );
});

test('Watch plays the newest video in an open dialog', () => {
  TUTORIALS.push(
    tutorial('second', 'Second tutorial', 'The newer one.'),
    tutorial('first', 'First tutorial', 'The older one.'),
  );
  const { container } = renderStrip();
  expect(container.querySelector('video')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: /Watch/ }));

  const videos = container.querySelectorAll('video');
  expect(videos).toHaveLength(1);
  expect(videos[0].getAttribute('src')).toBe('/clips/second.mp4');
  expect(videos[0].closest('dialog')).toHaveAttribute('open');
});

test('with no tutorials, the home page shows no strip', () => {
  const { container } = renderStrip();
  expect(container).toBeEmptyDOMElement();
});
