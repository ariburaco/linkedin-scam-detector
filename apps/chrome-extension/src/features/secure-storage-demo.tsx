import { useEffect, useState } from "react";
import { SecureStorage } from "@plasmohq/storage/secure";

/**
 * Example component demonstrating the use of Plasmo's secure storage API
 */
export function SecureStorageDemo() {
  const [password, setPassword] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const secureStorage = new SecureStorage();

  const unlockStorage = async () => {
    try {
      await secureStorage.setPassword(password);
      setIsUnlocked(true);
      setStatus("Storage unlocked");

      // Try to load any existing secret
      try {
        const existingSecret = await secureStorage.get("secretKey");
        if (existingSecret) {
          setSecretKey(existingSecret);
        }

        const existingValue = await secureStorage.get("secretValue");
        if (existingValue) {
          setSecretValue(existingValue);
        }
      } catch (e) {
        // No existing data or incorrect password
      }
    } catch (error) {
      console.error("Error unlocking secure storage:", error);
      setStatus("Failed to unlock storage");
    }
  };

  const saveSecret = async () => {
    try {
      await secureStorage.set("secretKey", secretKey);
      await secureStorage.set("secretValue", secretValue);
      setStatus("Secret saved successfully!");
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error("Error saving to secure storage:", error);
      setStatus("Failed to save secret");
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="flex flex-col space-y-6 rounded-md bg-white p-6 shadow-md">
      <h2 className="text-xl font-bold text-gray-800">Secure Storage Demo</h2>

      {!isUnlocked ? (
        <div className="space-y-4">
          <p className="text-gray-600">
            Enter a password to unlock secure storage
          </p>
          <div className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-900"
              placeholder="Password"
            />
            <div className="flex justify-end">
              <button
                onClick={unlockStorage}
                disabled={!password}
                className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Secret Key
            </label>
            <input
              type="text"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-900"
              placeholder="Enter a key"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Secret Value
            </label>
            <input
              type="text"
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-900"
              placeholder="Enter a value"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveSecret}
              disabled={!secretKey || !secretValue}
              className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              Save Secret
            </button>
          </div>
        </div>
      )}

      {status && (
        <div
          className={`mt-4 rounded-md p-2 text-center ${
            status.includes("Failed")
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}
