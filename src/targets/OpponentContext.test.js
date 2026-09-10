import { render, screen } from '@testing-library/react';
import OpponentContext from './OpponentContext';

test.each([
  [10, -5, 'low', 'low'],
  [11, -4.9, 'neutral', 'neutral'],
  [20, 4.9, 'neutral', 'neutral'],
  [21, 5, 'high', 'high'],
  [null, null, 'neutral', 'neutral'],
])(
  'colors rank %s and percentage %s at the approved boundaries',
  (rank, vsAverage, rankTone, diffTone) => {
    render(
      <OpponentContext
        opponent="ORL"
        qualifier={{ base: 'play_types' }}
        row={{ rank, vsAverage }}
        status="ready"
      />,
    );
    const context = screen.getByRole('group', { name: 'ORL opponent context' });
    expect(context.querySelector('.target-qualifier-opponent-rank')).toHaveAttribute(
      'data-tone',
      rankTone,
    );
    expect(context.querySelector('.target-qualifier-opponent-diff')).toHaveAttribute(
      'data-tone',
      diffTone,
    );
  },
);
