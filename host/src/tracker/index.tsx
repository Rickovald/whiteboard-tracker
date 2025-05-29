import { createSignal } from 'solid-js'
import "../styles/global.css";

function App() {
  const [count, setCount] = createSignal(0)
  return (
    <div class='bg-zinc-400 rounded-lg shadow-md p-6 w-80'>
      <h1>Vite + Solid</h1>
      <div class="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count()}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p class="read-the-docs">
        Click on the Vite and Solid logos to learn more
      </p>
      <h2>Name:</h2>
      {/* Luke Skywalker */}
      {/* <div>{name()}</div> */}
    </div>
  )
}

export default App
