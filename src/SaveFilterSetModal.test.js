import { act, fireEvent, render, screen } from '@testing-library/react';
import SaveFilterSetModal from './SaveFilterSetModal';
import { createSavedFilterSet } from './savedFilterSetsApi';

jest.mock('./savedFilterSetsApi', () => ({ createSavedFilterSet: jest.fn() }));

const queryString = 'player_name=LeBron+James&game_filter=10';

beforeEach(() => {
  jest.clearAllMocks();
});

test('saves the current Filter Set query string under the typed name', async () => {
  createSavedFilterSet.mockResolvedValue(undefined);
  const onHide = jest.fn();
  render(<SaveFilterSetModal show onHide={onHide} queryString={queryString} />);

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  LeBron last 10  ' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });

  expect(createSavedFilterSet).toHaveBeenCalledWith({
    name: 'LeBron last 10',
    queryString,
  });
  expect(onHide).toHaveBeenCalled();
});

test('cannot save without a name', () => {
  render(<SaveFilterSetModal show onHide={jest.fn()} queryString={queryString} />);

  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(createSavedFilterSet).not.toHaveBeenCalled();
});

test('surfaces the backend conflict message and stays open', async () => {
  createSavedFilterSet.mockRejectedValue({
    response: {
      status: 409,
      data: { error: { code: 'limit_reached', message: 'You have reached the limit of 100.' } },
    },
  });
  const onHide = jest.fn();
  render(<SaveFilterSetModal show onHide={onHide} queryString={queryString} />);

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'One too many' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });

  expect(screen.getByRole('alert')).toHaveTextContent('You have reached the limit of 100.');
  expect(onHide).not.toHaveBeenCalled();
});
