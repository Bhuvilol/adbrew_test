import { useEffect, useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

export function App() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTodos();
  }, []);

  async function fetchTodos() {
    try {
      const response = await fetch(`${API_BASE_URL}/todos/`);
      if (!response.ok) {
        throw new Error('Failed to fetch todos');
      }
      setTodos(await response.json());
    } catch {
      setError('Could not load todos. Please try again later.');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const description = newTodo.trim();
    if (!description) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/todos/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      if (!response.ok) {
        throw new Error('Failed to create todo');
      }
      setNewTodo('');
      setError(null);
      await fetchTodos();
    } catch {
      setError('Could not add todo. Please try again.');
    }
  }

  return (
    <div className="App">
      <div>
        <h1>List of TODOs</h1>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>{todo.description}</li>
          ))}
        </ul>
      </div>
      <div>
        <h1>Create a ToDo</h1>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="todo">ToDo: </label>
            <input
              id="todo"
              type="text"
              value={newTodo}
              onChange={(event) => setNewTodo(event.target.value)}
            />
          </div>
          <div style={{"marginTop": "5px"}}>
            <button type="submit">Add ToDo!</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
