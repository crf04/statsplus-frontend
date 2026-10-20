import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NaturalLanguageQuery from './NaturalLanguageQuery';
import apiClient from './utils/axiosConfig';

jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

jest.mock('./utils/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('NaturalLanguageQuery', () => {
  beforeEach(() => {
    apiClient.post.mockReset();
  });

  test('clears loading when the parser returns no usable filters', async () => {
    apiClient.post.mockResolvedValue({ data: { confidence: 0 } });
    const onFiltersApplied = jest.fn(() => ({ ok: false, reason: 'empty' }));

    render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={onFiltersApplied} />
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'an unsupported query' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() =>
      expect(screen.getByText(/could not find usable filters/i)).toBeInTheDocument(),
    );
    expect(onFiltersApplied).toHaveBeenCalledWith({});
    expect(screen.getByRole('textbox')).not.toBeDisabled();
  });

  test('gives natural-language parsing a cold-start-safe timeout', async () => {
    apiClient.post.mockResolvedValue({ data: { confidence: 0 } });

    render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} />
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'LeBron last 10 games' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(apiClient.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/nl-query$/),
      { query: 'LeBron last 10 games' },
      expect.objectContaining({ timeout: 15000 }),
    );
  });

  test('finishes loading for a synchronous successful application without showing an error', async () => {
    apiClient.post.mockResolvedValue({ data: { player_name: 'LeBron James' } });
    const onFiltersApplied = jest.fn(() => ({ ok: true }));

    render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={onFiltersApplied} />
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'LeBron this year' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(onFiltersApplied).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(screen.queryByText(/could not find usable filters/i)).not.toBeInTheDocument();
  });

  test('a superseded parser response neither applies nor unlocks the newer query', async () => {
    let resolveFirst;
    let resolveSecond;
    apiClient.post
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    const onFiltersApplied = jest.fn(() => ({ ok: true }));

    render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={onFiltersApplied} />
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'LeBron this year' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(resolveFirst).toBeDefined());
    fireEvent.change(input, { target: { value: 'Stephen this year' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(resolveSecond).toBeDefined());

    await act(async () => {
      resolveFirst({ data: { player_name: 'LeBron James' } });
    });
    expect(onFiltersApplied).not.toHaveBeenCalled();
    expect(input).toBeDisabled();

    await act(async () => {
      resolveSecond({ data: { player_name: 'Stephen Curry' } });
    });
    expect(onFiltersApplied).toHaveBeenCalledTimes(1);
    expect(onFiltersApplied).toHaveBeenCalledWith({ player_name: 'Stephen Curry' });
    expect(input).not.toBeDisabled();
  });

  test('the court behind the Query Prompt is scenery, hidden from assistive technology', () => {
    const { container } = render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} inWorkspace={false} />
      </MemoryRouter>,
    );
    const court = container.querySelector('.landing-court');
    expect(court).toBeInTheDocument();
    expect(court).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('the Query Prompt gives way to the compact search on the URL alone', () => {
    // Whether we are past the prompt is the URL's business. This component
    // keeps no flag of its own, so a future entry path cannot be locked behind
    // the language model the way the manual filter panel was.
    const { rerender } = render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} inWorkspace={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Ask the box score' })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} inWorkspace />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /open search/i })).toBeInTheDocument();
  });

  test('points to the Connect page from above the headline', () => {
    render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} />
      </MemoryRouter>,
    );

    const pill = screen.getByRole('link', { name: 'New Ask CourtAI in Claude or ChatGPT' });
    expect(pill).toHaveAttribute('href', '/connect');
    const headline = screen.getByRole('heading', { name: 'Ask the box score' });
    expect(pill.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('offers a deterministic door beside the query prompt', () => {
    render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /browse without a query/i })).toBeInTheDocument();
  });

  test('seeds the search box with an example chosen on the query reference page', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { query: 'Giannis games at home' } }]}>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('textbox')).toHaveValue('Giannis games at home');
  });

  test('teaches the query language on the page instead of behind a dialog', () => {
    render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /narrow it down/i })).toBeInTheDocument();
  });

  describe('ambiguous player references', () => {
    const BALL = {
      role: 'main',
      text: 'Ball',
      candidates: [
        { name: 'LaMelo Ball', team: 'CHA' },
        { name: 'Lonzo Ball', team: 'CLE' },
      ],
    };
    const DAVIS = {
      role: 'with',
      text: 'Davis',
      candidates: [
        { name: 'Anthony Davis', team: 'DAL' },
        { name: 'Terence Davis', team: null },
      ],
    };

    const ask = async (data, props = {}) => {
      apiClient.post.mockResolvedValue({ data });
      const onFiltersApplied = jest.fn(() => ({ ok: true }));
      const onQueryUpdate = jest.fn();
      render(
        <MemoryRouter>
          <NaturalLanguageQuery
            onFiltersApplied={onFiltersApplied}
            onQueryUpdate={onQueryUpdate}
            {...props}
          />
        </MemoryRouter>,
      );
      // The compact layout hides its input until the search is opened.
      if (props.inWorkspace) fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Ball last 10' } });
      fireEvent.submit(input.closest('form'));
      return { onFiltersApplied, onQueryUpdate, input };
    };

    test('asks which player and applies nothing until one is chosen', async () => {
      const { onFiltersApplied, onQueryUpdate } = await ask({
        player_name: null,
        game_count: 10,
        player_choices: [BALL],
      });

      expect(await screen.findByText('Which player did you mean?')).toBeInTheDocument();
      expect(screen.getByText('Ball')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'LaMelo Ball CHA' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Lonzo Ball CLE' })).toBeInTheDocument();
      expect(onFiltersApplied).not.toHaveBeenCalled();
      expect(onQueryUpdate).not.toHaveBeenCalled();
    });

    test('choosing a candidate fills the player slot and applies as usual', async () => {
      const { onFiltersApplied, onQueryUpdate } = await ask({
        player_name: null,
        game_count: 10,
        player_choices: [BALL],
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Lonzo Ball CLE' }));

      expect(onFiltersApplied).toHaveBeenCalledTimes(1);
      expect(onFiltersApplied).toHaveBeenCalledWith({
        player_name: 'Lonzo Ball',
        game_filter: 10,
      });
      expect(onQueryUpdate).toHaveBeenCalledWith('Ball last 10');
      expect(screen.queryByText('Which player did you mean?')).not.toBeInTheDocument();
    });

    test('several references wait for every answer and fill their own slots', async () => {
      const { onFiltersApplied } = await ask({
        player_name: null,
        players_on: ['Karl-Anthony Towns'],
        player_choices: [BALL, DAVIS, { ...DAVIS, role: 'without', text: 'Williams' }],
      });

      fireEvent.click(await screen.findByRole('button', { name: 'LaMelo Ball CHA' }));
      expect(onFiltersApplied).not.toHaveBeenCalled();
      fireEvent.click(screen.getAllByRole('button', { name: 'Anthony Davis DAL' })[0]);
      expect(onFiltersApplied).not.toHaveBeenCalled();
      fireEvent.click(screen.getAllByRole('button', { name: 'Terence Davis' })[1]);

      expect(onFiltersApplied).toHaveBeenCalledWith({
        player_name: 'LaMelo Ball',
        'players_on[]': ['Karl-Anthony Towns', 'Anthony Davis'],
        'players_off[]': ['Terence Davis'],
      });
    });

    test('is reachable with the keyboard in the compact layout', async () => {
      const { onFiltersApplied } = await ask(
        { player_name: null, player_choices: [BALL] },
        { inWorkspace: true },
      );

      const button = await screen.findByRole('button', { name: 'LaMelo Ball CHA' });
      expect(button.tagName).toBe('BUTTON');
      expect(button).not.toBeDisabled();
      fireEvent.click(button);
      expect(onFiltersApplied).toHaveBeenCalledWith({ player_name: 'LaMelo Ball' });
    });

    test('a new query clears the pending choices', async () => {
      const { onFiltersApplied, input } = await ask({
        player_name: null,
        player_choices: [BALL],
      });
      await screen.findByText('Which player did you mean?');

      apiClient.post.mockResolvedValue({ data: { player_name: 'LeBron James' } });
      fireEvent.change(input, { target: { value: 'LeBron this year' } });
      fireEvent.submit(input.closest('form'));

      await waitFor(() =>
        expect(onFiltersApplied).toHaveBeenCalledWith({ player_name: 'LeBron James' }),
      );
      expect(screen.queryByText('Which player did you mean?')).not.toBeInTheDocument();
      expect(onFiltersApplied).toHaveBeenCalledTimes(1);
    });

    test.each([
      ['an empty player_choices', { player_choices: [] }],
      ['no player_choices field', {}],
    ])('%s applies at once, exactly as before', async (_label, extra) => {
      const { onFiltersApplied, onQueryUpdate } = await ask({
        player_name: 'LeBron James',
        game_count: 10,
        ...extra,
      });

      await waitFor(() =>
        expect(onFiltersApplied).toHaveBeenCalledWith({
          player_name: 'LeBron James',
          game_filter: 10,
        }),
      );
      expect(onQueryUpdate).toHaveBeenCalledWith('Ball last 10');
      expect(screen.queryByText('Which player did you mean?')).not.toBeInTheDocument();
    });
  });
});
