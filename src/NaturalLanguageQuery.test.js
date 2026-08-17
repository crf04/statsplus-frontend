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
    const onFiltersApplied = jest.fn();

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
    expect(onFiltersApplied).not.toHaveBeenCalled();
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

  test('settles a stale game-log application without clearing a newer query', async () => {
    apiClient.post
      .mockResolvedValueOnce({ data: { player_name: 'LeBron James' } })
      .mockResolvedValueOnce({ data: { player_name: 'Stephen Curry' } });

    let firstFinishLoading;
    let secondFinishLoading;
    let resolveSecondApplication;
    const onFiltersApplied = jest
      .fn()
      .mockImplementationOnce((_filters, finishLoading) => {
        firstFinishLoading = finishLoading;
        return Promise.resolve({ stale: true, cancelled: true });
      })
      .mockImplementationOnce((_filters, finishLoading) => {
        secondFinishLoading = finishLoading;
        return new Promise((resolve) => {
          resolveSecondApplication = resolve;
        });
      });

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

    fireEvent.change(input, { target: { value: 'Stephen this year' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(onFiltersApplied).toHaveBeenCalledTimes(2));
    expect(input).toBeDisabled();

    // A late callback from the first request must not finish the second one.
    await act(async () => {
      firstFinishLoading(false);
    });
    expect(input).toBeDisabled();

    await act(async () => {
      secondFinishLoading(true);
      resolveSecondApplication({ ok: true });
    });
    expect(screen.getByRole('button', { name: /open search/i })).toBeInTheDocument();
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
