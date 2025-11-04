import {
  AlertTriangle,
  CheckCircle2,
  Search,
  Settings,
  Shield,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getStats } from "@/lib/utils/stats";

import "./style.css";

interface PopupStats {
  scannedToday: number;
  threatsBlocked: number;
  safetyScore: number;
}

const Popup = () => {
  const [stats, setStats] = useState<PopupStats>({
    scannedToday: 0,
    threatsBlocked: 0,
    safetyScore: 100,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const statsData = await getStats();
        setStats(statsData);
      } catch (error) {
        console.error("[Popup] Error loading stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();

    // Refresh stats every 5 seconds if popup stays open
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-[380px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-sky-600 p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <Shield className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">LinkedIn Scam Detector</h1>
            <p className="text-sm text-sky-100">Stay safe while job hunting</p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="space-y-4 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground text-sm">
              Loading stats...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {/* Scanned Today */}
            <Card className="border-sky-100 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20">
              <CardContent className="p-4 text-center">
                <div className="mb-2 flex items-center justify-center">
                  <Search className="size-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                  {stats.scannedToday}
                </div>
                <div className="text-muted-foreground text-xs">
                  Scanned Today
                </div>
              </CardContent>
            </Card>

            {/* Threats Blocked */}
            <Card className="border-red-100 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <CardContent className="p-4 text-center">
                <div className="mb-2 flex items-center justify-center">
                  <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {stats.threatsBlocked}
                </div>
                <div className="text-muted-foreground text-xs">
                  Threats Blocked
                </div>
              </CardContent>
            </Card>

            {/* Safety Score */}
            <Card className="border-green-100 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
              <CardContent className="p-4 text-center">
                <div className="mb-2 flex items-center justify-center">
                  <TrendingUp className="size-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.safetyScore}%
                </div>
                <div className="text-muted-foreground text-xs">
                  Safety Score
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* Status Card */}
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-6 shrink-0 text-green-600 dark:text-green-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                Protection Active
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                All LinkedIn job postings are being scanned automatically
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Quick Actions */}
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Quick Actions
          </h3>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={openOptions}
            >
              <Settings className="mr-2 size-4" />
              Settings & Preferences
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() =>
                window.open("https://www.linkedin.com/jobs", "_blank")
              }
            >
              <Search className="mr-2 size-4" />
              Browse LinkedIn Jobs
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 text-center">
          <p className="text-muted-foreground text-xs">
            Powered by AI-driven scam detection
          </p>
        </div>
      </div>
    </div>
  );
};

export default Popup;
