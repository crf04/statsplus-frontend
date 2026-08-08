import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    render(<NaturalLanguageQuery onFiltersApplied={onFiltersApplied} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'an unsupported query' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() =>
      expect(screen.getByText(/could not find usable filters/i)).toBeInTheDocument(),
    );
    expect(onFiltersApplied).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).not.toBeDisabled();
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

    render(<NaturalLanguageQuery onFiltersApplied={onFiltersApplied} />);
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
});
