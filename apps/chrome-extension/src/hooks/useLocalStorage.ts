import { useEffect, useState } from "react";

import { LocalStorage } from "@/utils/localStorage";

export function useLocalStorage<T>(
  key: string,
  defaultValue?: T
): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(() =>
    LocalStorage.getItem<T>(key, defaultValue)
  );

  useEffect(() => {
    if (value !== null) {
      LocalStorage.setItem(key, value);
    }
  }, [key, value]);

  return [value, setValue];
}
