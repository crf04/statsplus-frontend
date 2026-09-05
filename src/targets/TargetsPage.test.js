import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TargetsPage from './TargetsPage';
import { createTarget, fetchTargets } from './targetsApi';

jest.mock('./targetsApi', () => ({
  fetchTargets: jest.fn(),
  createTarget: jest.fn(),
}));

const auth = { isAuthenticated: true, loading: false };
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}));

/*
 * The stored title is the backend's, and it is deliberately not the string
 * these Qualifiers would derive. A card that displayed a locally derived title
 * would pass a matching fixture and still be wrong.
 */
const targets = [
  {
    id: 7,
    opponent: 'OKC',
    title: 'OKC vs Corner 3 ≥ 40% (v2)',
    note: 'Leaks the corner late.',
    createdAt: '2026-04-08T23:30:00Z',
    qualifiers: [
      { base: 'shot_zones', sliceKey: 'Corner 3', comparator: 'at_or_above', threshold: 0.4 },
    ],
  },
  {
    id: 8,
    opponent: 'MIA',
    title: 'MIA vs Restricted area ≤ 20% (v2)',
    note: '',
    createdAt: '2026-04-08T23:30:00Z',
    qualifiers: [
      {
        base: 'shot_zones',
        sliceKey: 'Restricted Area',
        comparator: 'at_or_below',
        threshold: 0.2,
      },
    ],
  },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/targets']}>
      <TargetsPage />
    </MemoryRouter>,
  );

const composeQualifier = ({ opponent = 'OKC', slice = 'Corner 3', percent = '40' } = {}) => {
  fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: opponent } });
  fireEvent.change(screen.getByLabelText('Qualifier 1 slice'), { target: { value: slice } });
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: percent },
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  auth.isAuthenticated = true;
  auth.loading = false;
  fetchTargets.mockResolvedValue(targets);
  createTarget.mockResolvedValue(undefined);
});

test('shows every saved Target as a card carrying the stored title, Qualifiers, and note', async () => {
  renderPage();

  const cards = await screen.findAllByRole('link', { name: /^Open / });
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveAccessibleName('Open OKC vs Corner 3 ≥ 40% (v2)');
  expect(cards[0]).toHaveAttribute('href', '/targets/7');
  expect(cards[0]).toHaveTextContent('Corner 3 ≥ 40%');
  // The bound is set apart from the slice it applies to, not run together
  // with it, so a card can be scanned for the number alone.
  expect(within(cards[0]).getByText('≥ 40%').tagName).toBe('B');
  expect(cards[0]).toHaveTextContent('Leaks the corner late.');
  expect(cards[1]).toHaveAccessibleName('Open MIA vs Restricted area ≤ 20% (v2)');
  expect(cards[1]).toHaveTextContent('No note');
  expect(screen.getByRole('heading', { name: '2 Targets' })).toBeInTheDocument();
});

test('counts one Target as a Target rather than as Targets', async () => {
  fetchTargets.mockResolvedValue([targets[0]]);
  renderPage();

  expect(await screen.findByRole('heading', { name: '1 Target' })).toBeInTheDocument();
});

test('says so plainly when the account has no Targets yet', async () => {
  fetchTargets.mockResolvedValue([]);
  renderPage();

  expect(await screen.findByRole('heading', { name: 'No Targets yet.' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '0 Targets' })).toBeInTheDocument();
});

test('previews the title the Qualifiers would derive', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  expect(screen.getByText('OKC vs Corner 3 ≥ 40%')).toBeInTheDocument();

  // The backend writes a whole percent plainly and keeps one decimal when
  // there is one, so the preview promises exactly what will be stored.
  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '40.5' },
  });
  expect(screen.getByText('OKC vs Corner 3 ≥ 40.5%')).toBeInTheDocument();
});

/*
 * The title is written to one decimal, so a share carrying more than one would
 * be stored as a number the title does not say. The preview and the saved
 * Target have to agree about what was composed.
 */
test('a threshold is stored at the same precision the title reads it at', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier({ percent: '6.25' });
  expect(screen.getByText('OKC vs Corner 3 ≥ 6.3%')).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(createTarget).toHaveBeenCalledWith(
    expect.objectContaining({
      qualifiers: [expect.objectContaining({ threshold: 0.063 })],
    }),
  );
});

test('the blank form is unsaveable until a threshold has been composed', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });
  const save = screen.getByRole('button', { name: 'Save Target' });

  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(null);
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '40' },
  });
  expect(save).toBeEnabled();
});

test('refuses to save a threshold outside the 0-100% share range', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });
  const save = screen.getByRole('button', { name: 'Save Target' });

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '140' },
  });
  expect(save).toBeDisabled();
  expect(
    screen.getByText('Every threshold must be a share between 0% and 100%.'),
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Qualifier 1 threshold percent'), {
    target: { value: '0' },
  });
  expect(save).toBeEnabled();
});

test('refuses to save a Target with no Qualifier at all', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  fireEvent.click(screen.getByRole('button', { name: 'Remove Qualifier 1' }));

  expect(screen.getByRole('button', { name: 'Save Target' })).toBeDisabled();
  expect(screen.getByText('Add at least one Qualifier before saving.')).toBeInTheDocument();
});

test('saves several Qualifiers as one Target and reloads the list the backend returns', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier({ opponent: 'NOP', slice: 'Restricted Area', percent: '35' });
  fireEvent.click(screen.getByRole('button', { name: '+ Add a Qualifier' }));
  fireEvent.change(screen.getByLabelText('Qualifier 2 diet base'), {
    target: { value: 'play_types' },
  });
  fireEvent.change(screen.getByLabelText('Qualifier 2 slice'), { target: { value: 'Transition' } });
  fireEvent.change(screen.getByLabelText('Qualifier 2 threshold percent'), {
    target: { value: '15' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'At or below' })[1]);
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
    target: { value: 'No rim protection when Missi sits.' },
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(createTarget).toHaveBeenCalledWith({
    opponent: 'NOP',
    note: 'No rim protection when Missi sits.',
    qualifiers: [
      {
        base: 'shot_zones',
        sliceKey: 'Restricted Area',
        comparator: 'at_or_above',
        threshold: 0.35,
      },
      { base: 'play_types', sliceKey: 'Transition', comparator: 'at_or_below', threshold: 0.15 },
    ],
  });
  expect(fetchTargets).toHaveBeenCalledTimes(2);
  // A saved Target leaves a blank form behind, ready for the next idea.
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(null);
  expect(screen.queryByLabelText('Qualifier 2 threshold percent')).not.toBeInTheDocument();
});

test('a note is stored without the whitespace it was typed with', async () => {
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  fireEvent.change(screen.getByLabelText('Note · optional, never the title'), {
    target: { value: '  Zone late in the shot clock.  ' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(createTarget).toHaveBeenCalledWith(
    expect.objectContaining({ note: 'Zone late in the shot clock.' }),
  );
});

test('a refused duplicate reads as the backend explained it and keeps the draft', async () => {
  createTarget.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: { code: 'operation_conflict', message: 'You already have that Target for OKC.' },
      },
    },
  });
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You already have that Target for OKC.',
  );
  expect(screen.getByLabelText('Opponent')).toHaveValue('OKC');
  expect(screen.getByLabelText('Qualifier 1 threshold percent')).toHaveValue(40);
  expect(fetchTargets).toHaveBeenCalledTimes(1);
});

/*
 * A full account is refused by the same status as a duplicate but for a
 * different reason, and only the backend knows the cap, so its sentence is the
 * one the reader sees.
 */
test('a refused save against a full account reads as the backend explained it', async () => {
  createTarget.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: {
          code: 'operation_conflict',
          message: 'You have reached the limit of 50 Targets.',
        },
      },
    },
  });
  renderPage();
  await screen.findAllByRole('link', { name: /^Open / });

  composeQualifier();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save Target' }));
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'You have reached the limit of 50 Targets.',
  );
});

test('a rejected list read stays readable rather than showing an empty account', async () => {
  fetchTargets.mockRejectedValue({
    response: {
      status: 503,
      data: { error: { code: 'provider_unavailable', message: 'Targets are unavailable.' } },
    },
  });
  renderPage();

  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Targets are unavailable.'),
  );
  expect(screen.queryByRole('heading', { name: 'No Targets yet.' })).not.toBeInTheDocument();
});

test('signed out, the page asks for sign-in the way the slate does', () => {
  auth.isAuthenticated = false;
  renderPage();

  expect(screen.getByRole('heading', { name: 'Sign in to view your Targets' })).toBeInTheDocument();
  expect(fetchTargets).not.toHaveBeenCalled();
});
