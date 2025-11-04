import { useEffect, useState } from "react";

interface UpdateCheckerProps {
  currentVersion: string;
}

/**
 * Component for checking if an update is available for the extension
 */
export function UpdateChecker({ currentVersion }: UpdateCheckerProps) {
  const [latestVersion, setLatestVersion] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      setError(null);

      // This is just a demo - in a real extension, you would fetch
      // the latest version from your server
      const response = await fetch("https://api.example.com/version");
      const data = await response.json();

      setLatestVersion(data.version);
    } catch (err) {
      console.error("Error checking for updates:", err);
      setError("Failed to check for updates");

      // For demo purposes, set a fake version
      setLatestVersion("0.0.2");
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check for updates when the component mounts
    checkForUpdates();

    // Set up a periodic check every 24 hours
    const checkInterval = setInterval(checkForUpdates, 24 * 60 * 60 * 1000);

    return () => {
      clearInterval(checkInterval);
    };
  }, []);

  const hasUpdate = latestVersion && latestVersion !== currentVersion;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-medium text-gray-800">Extension Updates</h3>

      <div className="mt-2 space-y-2">
        <div className="text-sm text-gray-600">
          Current version: <span className="font-medium">{currentVersion}</span>
        </div>

        {latestVersion && (
          <div className="text-sm text-gray-600">
            Latest version: <span className="font-medium">{latestVersion}</span>
          </div>
        )}

        {hasUpdate && (
          <div className="rounded-md bg-blue-50 p-2 text-sm text-blue-800">
            An update is available! Please update your extension.
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={checkForUpdates}
            disabled={isChecking}
            className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-800 transition-colors hover:bg-gray-300 disabled:opacity-50"
          >
            {isChecking ? "Checking..." : "Check for Updates"}
          </button>
        </div>
      </div>
    </div>
  );
}
