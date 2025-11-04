import { useStorage } from "@plasmohq/storage/hook";

/**
 * Example component demonstrating the use of Plasmo's storage hook API
 */
export function StorageDemo() {
  // Basic usage with automatic state syncing across components
  const [counter, setCounter] = useStorage("counter", 0);

  // Advanced usage with separate render and store values
  const [inputValue, setInputValue, { setRenderValue, setStoreValue }] =
    useStorage("inputValue", "");

  // Using a function for initial value (persists the initial value)
  const [lastVisit, setLastVisit] = useStorage("lastVisit", (v) =>
    v === undefined ? new Date().toISOString() : v
  );

  // Update the last visit timestamp
  const updateLastVisit = () => {
    setLastVisit(new Date().toISOString());
  };

  return (
    <div className="flex flex-col space-y-6 rounded-md bg-white p-6 shadow-md">
      <h2 className="text-xl font-bold text-gray-800">Storage API Demo</h2>

      {/* Counter demo */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-700">Counter</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCounter(counter - 1)}
            className="rounded-md bg-red-100 px-3 py-1 text-red-700 transition-colors hover:bg-red-200"
          >
            -
          </button>
          <span className="w-10 text-center text-lg font-medium">
            {counter}
          </span>
          <button
            onClick={() => setCounter(counter + 1)}
            className="rounded-md bg-green-100 px-3 py-1 text-green-700 transition-colors hover:bg-green-200"
          >
            +
          </button>
        </div>
        <p className="text-sm text-gray-500">
          This value will sync across all instances
        </p>
      </div>

      {/* Input with deferred saving */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-700">Form Input</h3>
        <div className="space-y-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setRenderValue(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 text-gray-900"
            placeholder="Type something..."
          />
          <div className="flex justify-end">
            <button
              onClick={() => setStoreValue(inputValue)}
              className="rounded-md bg-blue-600 px-3 py-1 text-white transition-colors hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Only saved to storage when you click Save
        </p>
      </div>

      {/* Last visit timestamp */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-gray-700">Last Visit</h3>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">{lastVisit}</span>
          <button
            onClick={updateLastVisit}
            className="rounded-md bg-blue-100 px-3 py-1 text-blue-700 transition-colors hover:bg-blue-200"
          >
            Update
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Initialized and persisted on first render
        </p>
      </div>
    </div>
  );
}
