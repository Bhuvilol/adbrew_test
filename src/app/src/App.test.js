import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

function mockFetchSequence(responses) {
  let call = 0;
  global.fetch = jest.fn(() => {
    const response = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
    });
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the todo list heading', async () => {
  mockFetchSequence([[]]);
  render(<App />);
  expect(await screen.findByText(/list of todos/i)).toBeInTheDocument();
});

test('renders todos fetched from the API', async () => {
  mockFetchSequence([[{ id: '1', description: 'Learn Docker' }]]);
  render(<App />);
  expect(await screen.findByText('Learn Docker')).toBeInTheDocument();
});

test('submitting the form posts a new todo and refreshes the list', async () => {
  mockFetchSequence([
    [],                                          // initial GET on mount
    { id: '2', description: 'Learn React' },     // POST response
    [{ id: '2', description: 'Learn React' }],   // GET after refresh
  ]);
  render(<App />);

  const input = screen.getByLabelText(/todo:/i);
  await userEvent.type(input, 'Learn React');
  await userEvent.click(screen.getByRole('button', { name: /add todo!/i }));

  expect(await screen.findByText('Learn React')).toBeInTheDocument();
  expect(input).toHaveValue('');
});
