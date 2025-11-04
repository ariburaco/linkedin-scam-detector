import { useState } from "react";
import { useSession } from "@/hooks/useSession";

/**
 * Component that demonstrates session management
 */
export function SessionDemo() {
  const {
    session,
    cookies,
    isLoading,
    isAuthenticated,
    user,
    refreshSession,
    loadSession,
    logout,
  } = useSession();
  const [status, setStatus] = useState<string | null>(null);

  const handleRefresh = async () => {
    setStatus("Refreshing session...");
    await refreshSession();
    setStatus("Session refreshed");
    setTimeout(() => setStatus(null), 3000);
  };

  const handleRetry = async () => {
    setStatus("Retrying session load...");
    await loadSession();
    setStatus("Session load attempted");
    setTimeout(() => setStatus(null), 3000);
  };

  const handleLogout = async () => {
    setStatus("Logging out...");
    await logout();
    setStatus("Logged out successfully");
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="flex flex-col space-y-6 rounded-md bg-white p-6 shadow-md">
      <h2 className="text-xl font-bold text-gray-800">Session Management</h2>

      {isLoading ? (
        <div className="py-4 text-center text-gray-600">Loading session...</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-gray-200 p-4">
            <div className="mb-2 font-medium text-gray-700">
              Status: {isAuthenticated ? "Authenticated" : "Not authenticated"}
            </div>

            {isAuthenticated && user && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">User ID:</span> {user.id}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Name:</span>{" "}
                  {user.name || "N/A"}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Email:</span>{" "}
                  {user.email || "N/A"}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={handleRetry}
              className="rounded-md bg-blue-100 px-4 py-2 text-blue-700 transition-colors hover:bg-blue-200"
            >
              Retry Load
            </button>

            <button
              onClick={handleRefresh}
              className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
            >
              Refresh Session
            </button>

            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              >
                Logout
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500">
            <p>Session Object:</p>
            <pre className="mt-1 max-h-[100px] overflow-auto rounded-md bg-gray-100 p-2 text-xs">
              {JSON.stringify(session, null, 2) || "null"}
            </pre>
          </div>

          {status && (
            <div className="mt-4 rounded-md bg-blue-100 p-2 text-center text-blue-800">
              {status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
