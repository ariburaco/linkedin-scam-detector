import { Storage } from "@plasmohq/storage";
import { useEffect, useState } from "react";

import "@/style.css";

function OptionsPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [themeColor, setThemeColor] = useState("#4285F4");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<null | "success" | "error">(
    null
  );

  const storage = new Storage({ area: "sync" });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedNotifications = await storage.get<boolean>(
          "notificationsEnabled"
        );
        const storedThemeColor = await storage.get<string>("themeColor");

        if (storedNotifications !== undefined) {
          setNotificationsEnabled(storedNotifications);
        }

        if (storedThemeColor !== undefined) {
          setThemeColor(storedThemeColor);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setSaveStatus(null);

      await storage.set("notificationsEnabled", notificationsEnabled);
      await storage.set("themeColor", themeColor);

      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-8">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Extension Options
        </h1>

        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="notifications"
              className="text-lg font-medium text-gray-700"
            >
              Enable Notifications
            </label>
            <input
              id="notifications"
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="themeColor"
              className="block text-lg font-medium text-gray-700"
            >
              Theme Color
            </label>
            <div className="flex items-center space-x-2">
              <input
                id="themeColor"
                type="color"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-10 w-10 rounded border-gray-300"
              />
              <span className="text-gray-600">{themeColor}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>

          {saveStatus === "success" && (
            <p className="mt-2 text-sm text-green-600">
              Settings saved successfully!
            </p>
          )}

          {saveStatus === "error" && (
            <p className="mt-2 text-sm text-red-600">
              Error saving settings. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default OptionsPage;
