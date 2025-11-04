import { useReducer } from "react";

export const CountButton = () => {
  const [count, increase] = useReducer((c) => c + 1, 0);

  return (
    <button
      onClick={() => increase()}
      className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
    >
      Count:
      <span className="ml-2 inline-flex h-4 w-8 items-center justify-center rounded-full text-xs font-semibold">
        {count}
      </span>
    </button>
  );
};
