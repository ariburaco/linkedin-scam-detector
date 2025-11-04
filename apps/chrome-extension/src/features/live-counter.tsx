import type { RequestBody, ResponseBody } from "@/background/ports/counter";
import { useEffect, useState } from "react";
import { usePort } from "@plasmohq/messaging/hook";

export function LiveCounter() {
  const [error, setError] = useState<string | null>(null);
  const [incrementValue, setIncrementValue] = useState(1);

  // Use port hook to establish a connection with the background service worker
  const counterPort = usePort<RequestBody, ResponseBody>("counter");

  // Initialize the counter on component mount
  useEffect(() => {
    counterPort.send({
      action: "get",
    });
  }, []);

  // Handle increment
  const handleIncrement = () => {
    counterPort.send({
      action: "increment",
      value: incrementValue,
    });
  };

  // Handle decrement
  const handleDecrement = () => {
    counterPort.send({
      action: "decrement",
      value: incrementValue,
    });
  };

  // Handle reset
  const handleReset = () => {
    counterPort.send({
      action: "reset",
    });
  };

  // Display error if present
  useEffect(() => {
    if (counterPort.data?.error) {
      setError(counterPort.data.error);
      const timer = setTimeout(() => {
        setError(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [counterPort.data?.error]);

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold text-gray-800">Live Counter</h2>

      <div className="mb-6 flex items-center justify-between rounded-md bg-gray-50 p-4">
        <div>
          <span className="text-sm text-gray-500">Current count:</span>
          <p className="text-3xl font-bold text-gray-900">
            {counterPort.data?.count ?? 0}
          </p>
          {counterPort.data?.lastUpdate && (
            <p className="mt-1 text-xs text-gray-500">
              Updated:{" "}
              {new Date(counterPort.data.lastUpdate).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Increment by:</label>
            <input
              type="number"
              value={incrementValue}
              onChange={(e) => setIncrementValue(Number(e.target.value))}
              className="w-16 rounded border border-gray-300 p-1 text-center text-sm"
              min="1"
              max="100"
            />
          </div>

          <div className="flex space-x-1">
            <button
              onClick={handleDecrement}
              className="rounded bg-red-100 px-2 py-1 text-sm text-red-700 transition-colors hover:bg-red-200"
              title="Decrement"
            >
              -
            </button>
            <button
              onClick={handleIncrement}
              className="rounded bg-green-100 px-2 py-1 text-sm text-green-700 transition-colors hover:bg-green-200"
              title="Increment"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={handleReset}
          className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-300"
        >
          Reset Counter
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
