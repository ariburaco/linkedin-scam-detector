// Import types directly from the message handler
import { sendToBackground } from "@plasmohq/messaging";
import { useEffect, useState } from "react";

import type { RequestBody, ResponseBody } from "@/background/messages/count";
import { CountButton } from "@/features/count-button";
import { SecureStorageDemo } from "@/features/secure-storage-demo";
import { StorageDemo } from "@/features/storage-demo";
import { UpdateChecker } from "@/features/update-checker";

import "@/style.css";

import { LiveCounter } from "@/features/live-counter";

function DashboardPage() {
  const [backgroundCount, setBackgroundCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("overview");

  useEffect(() => {
    const fetchCount = async () => {
      try {
        setIsLoading(true);

        // Use the properly typed message handler
        const result = await sendToBackground({
          name: "count",
          body: {
            action: "get",
          },
        });

        setBackgroundCount(result.count);
      } catch (error) {
        console.error("Error fetching count:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCount();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-800">
          Extension Dashboard
        </h1>

        <div className="mb-8 flex space-x-2">
          <button
            onClick={() => setActiveSection("overview")}
            className={`rounded-md px-4 py-2 ${
              activeSection === "overview"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveSection("storage")}
            className={`rounded-md px-4 py-2 ${
              activeSection === "storage"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Storage Demo
          </button>
          <button
            onClick={() => setActiveSection("secure")}
            className={`rounded-md px-4 py-2 ${
              activeSection === "secure"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Secure Storage
          </button>
        </div>

        {activeSection === "overview" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-gray-800">
                Background Count
              </h2>
              {isLoading ? (
                <p className="text-gray-500">Loading...</p>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900">
                    {backgroundCount}
                  </span>
                  <CountButton />
                </div>
              )}
            </div>

            <UpdateChecker currentVersion="0.0.1" />
            <LiveCounter />
          </div>
        )}

        {activeSection === "storage" && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <StorageDemo />
          </div>
        )}

        {activeSection === "secure" && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <SecureStorageDemo />
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
