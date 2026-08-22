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

  test('finishes loading for a synchronous unchanged application without showing an error', async () => {
    apiClient.post.mockResolvedValue({ data: { player_name: 'LeBron James' } });
    const onFiltersApplied = jest.fn(() => ({ ok: false, reason: 'unchanged' }));

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

  test('the Query Prompt gives way to the compact search on the URL alone', () => {
    // Whether we are past the prompt is the URL's business. This component
    // keeps no flag of its own, so a future entry path cannot be locked behind
    // the language model the way the manual filter panel was.
    const { rerender } = render(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} inWorkspace={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'CourtAI' })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NaturalLanguageQuery onFiltersApplied={jest.fn()} inWorkspace />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /open search/i })).toBeInTheDocument();
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
});
