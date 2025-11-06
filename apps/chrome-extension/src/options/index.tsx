import { FEATURE_FLAG_KEYS } from "@acme/shared";
import { Storage } from "@plasmohq/storage";
import {
  CheckCircle2,
  ExternalLink,
  Info,
  MessageSquare,
  Shield,
  X,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { TRPCReactProvider } from "@/trpc/react";

import "@/style.css";

interface Settings {
  notificationsEnabled: boolean;
  autoScanEnabled: boolean;
  showSafeBadges: boolean;
}

function OptionsPage() {
  const [settings, setSettings] = useState<Settings>({
    notificationsEnabled: true,
    autoScanEnabled: true,
    showSafeBadges: false,
  });
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
        const storedAutoScan = await storage.get<boolean>("autoScanEnabled");
        const storedShowSafeBadges =
          await storage.get<boolean>("showSafeBadges");

        setSettings({
          notificationsEnabled: storedNotifications ?? true,
          autoScanEnabled: storedAutoScan ?? true,
          showSafeBadges: storedShowSafeBadges ?? false,
        });
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = async <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await storage.set(key, value);

      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (error) {
      console.error("Error saving setting:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <TRPCReactProvider>
      <div className="bg-background min-h-screen">
        {/* Header */}
        <div className="border-b bg-gradient-to-r from-sky-500 to-sky-600">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Shield className="size-8 text-white" />
              </div>
              <div className="text-white">
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-sky-100">
                  Customize your LinkedIn Scam Detector experience
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Status Toast */}
        {saveStatus && (
          <div className="animate-in slide-in-from-top-2 fixed top-6 right-6 z-50">
            <Card
              className={`shadow-lg ${
                saveStatus === "success"
                  ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                  : "border-red-500 bg-red-50 dark:bg-red-950/20"
              }`}
            >
              <CardContent className="flex items-center gap-3 p-4">
                {saveStatus === "success" ? (
                  <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="size-5 text-red-600 dark:text-red-400" />
                )}
                <span className="text-sm font-medium">
                  {saveStatus === "success"
                    ? "Settings saved automatically"
                    : "Failed to save settings"}
                </span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <div className="container mx-auto px-6 py-8">
          <Tabs defaultValue="preferences" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Scanning Preferences</CardTitle>
                  <CardDescription>
                    Control how and when job postings are scanned for scams
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="auto-scan"
                        className="text-base font-medium"
                      >
                        Automatic Scanning
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Automatically scan job postings as you browse LinkedIn
                      </p>
                    </div>
                    <Switch
                      id="auto-scan"
                      checked={settings.autoScanEnabled}
                      onCheckedChange={(checked) =>
                        updateSetting("autoScanEnabled", checked)
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="show-safe"
                        className="text-base font-medium"
                      >
                        Show Safe Badges
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Display badges even for jobs that appear safe
                      </p>
                    </div>
                    <Switch
                      id="show-safe"
                      checked={settings.showSafeBadges}
                      onCheckedChange={(checked) =>
                        updateSetting("showSafeBadges", checked)
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Manage how you're notified about scam detections
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="notifications"
                        className="text-base font-medium"
                      >
                        Browser Notifications
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        Get notified when a high-risk job is detected
                      </p>
                    </div>
                    <Switch
                      id="notifications"
                      checked={settings.notificationsEnabled}
                      onCheckedChange={(checked) =>
                        updateSetting("notificationsEnabled", checked)
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <FeatureFlagsCard />
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy & Data</CardTitle>
                  <CardDescription>
                    Your privacy and data protection information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-sky-50 p-4 dark:bg-sky-950/20">
                    <div className="flex items-start gap-3">
                      <Info className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
                      <div className="space-y-2 text-sm">
                        <p className="font-medium text-sky-900 dark:text-sky-100">
                          We respect your privacy
                        </p>
                        <p className="text-sky-700 dark:text-sky-300">
                          Job posting data is analyzed locally and only sent to
                          our servers if you explicitly request an AI scan. We
                          never collect or store personal information.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        window.open("https://example.com/privacy", "_blank")
                      }
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Read Privacy Policy
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        window.open("https://example.com/terms", "_blank")
                      }
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Terms of Service
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* About Tab */}
            <TabsContent value="about" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>About LinkedIn Scam Detector</CardTitle>
                  <CardDescription>
                    Version 1.0.0 - Protecting job seekers from scams
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">What We Do</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      LinkedIn Scam Detector uses advanced AI and rule-based
                      detection to identify potentially fraudulent job postings
                      on LinkedIn, helping you stay safe during your job search.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        window.open(
                          "https://github.com/yourusername/linkedin-scam-detector/issues",
                          "_blank"
                        )
                      }
                    >
                      <MessageSquare className="mr-2 size-4" />
                      Report a Bug or Suggest a Feature
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() =>
                        window.open(
                          "https://github.com/yourusername/linkedin-scam-detector",
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="mr-2 size-4" />
                      View on GitHub
                    </Button>
                  </div>

                  <Separator />

                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="text-muted-foreground text-sm">
                      Made with care for job seekers everywhere
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      © 2024 LinkedIn Scam Detector. All rights reserved.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TRPCReactProvider>
  );
}

/**
 * Feature Flags Card Component
 * Allows users to override server-side feature flags locally
 */
function FeatureFlagsCard() {
  const {
    flags,
    serverFlags,
    localOverrides,
    isLoading,
    setOverride,
    removeOverride,
    clearOverrides,
  } = useFeatureFlags();

  const hasOverrides = localOverrides && Object.keys(localOverrides).length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="size-5" />
              Feature Flags
            </CardTitle>
            <CardDescription>
              Override server-side feature flags locally. Local settings take
              precedence.
            </CardDescription>
          </div>
          {hasOverrides && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearOverrides}
              className="text-xs"
            >
              Reset All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Job Extraction */}
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="flag-job-extraction"
                className="text-base font-medium"
              >
                Job Extraction
              </Label>
              {localOverrides?.job_extraction !== undefined && (
                <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs">
                  Overridden
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Extract structured data from job postings using AI
            </p>
            {serverFlags && (
              <p className="text-muted-foreground mt-1 text-xs">
                Server: {serverFlags.job_extraction ? "Enabled" : "Disabled"}
              </p>
            )}
          </div>
          <Switch
            id="flag-job-extraction"
            checked={flags?.job_extraction ?? false}
            onCheckedChange={(checked) => {
              if (serverFlags && checked === serverFlags.job_extraction) {
                // Revert to server default
                removeOverride(FEATURE_FLAG_KEYS.JOB_EXTRACTION);
              } else {
                // Set override
                setOverride(FEATURE_FLAG_KEYS.JOB_EXTRACTION, checked);
              }
            }}
          />
        </div>

        <Separator />

        {/* Job Embeddings */}
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="flag-job-embeddings"
                className="text-base font-medium"
              >
                Job Embeddings
              </Label>
              {localOverrides?.job_embeddings !== undefined && (
                <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs">
                  Overridden
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Generate embeddings for semantic job search and matching
            </p>
            {serverFlags && (
              <p className="text-muted-foreground mt-1 text-xs">
                Server: {serverFlags.job_embeddings ? "Enabled" : "Disabled"}
              </p>
            )}
          </div>
          <Switch
            id="flag-job-embeddings"
            checked={flags?.job_embeddings ?? false}
            onCheckedChange={(checked) => {
              if (serverFlags && checked === serverFlags.job_embeddings) {
                removeOverride(FEATURE_FLAG_KEYS.JOB_EMBEDDINGS);
              } else {
                setOverride(FEATURE_FLAG_KEYS.JOB_EMBEDDINGS, checked);
              }
            }}
          />
        </div>

        <Separator />

        {/* Job Discovery */}
        <div className="flex items-center justify-between">
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="flag-job-discovery"
                className="text-base font-medium"
              >
                Job Discovery
              </Label>
              {localOverrides?.job_discovery !== undefined && (
                <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs">
                  Overridden
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              Automatically discover and save jobs from LinkedIn search pages
            </p>
            {serverFlags && (
              <p className="text-muted-foreground mt-1 text-xs">
                Server: {serverFlags.job_discovery ? "Enabled" : "Disabled"}
              </p>
            )}
          </div>
          <Switch
            id="flag-job-discovery"
            checked={flags?.job_discovery ?? false}
            onCheckedChange={(checked) => {
              if (serverFlags && checked === serverFlags.job_discovery) {
                removeOverride(FEATURE_FLAG_KEYS.JOB_DISCOVERY);
              } else {
                setOverride(FEATURE_FLAG_KEYS.JOB_DISCOVERY, checked);
              }
            }}
          />
        </div>

        {hasOverrides && (
          <>
            <Separator />
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Local Overrides Active
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Your local settings override the server defaults. Changes
                    take effect immediately.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default OptionsPage;
