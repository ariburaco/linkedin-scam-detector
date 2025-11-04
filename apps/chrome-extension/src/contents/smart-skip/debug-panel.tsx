import { useEffect, useState } from "react";
import { extensionLoggerContent } from "@/shared/loggers";

// Debug Panel Component
function DebugPanel({
  videoElement,
  currentTime,
  duration,
  features,
  actions,
}: {
  videoElement: HTMLVideoElement | null;
  currentTime: number;
  duration: number;
  features: {
    skipIntro: boolean;
    skipRecap: boolean;
    nextEpisode: boolean;
    seek10SecondsForward: boolean;
    seek10SecondsBackward: boolean;
    seekToPercentage: boolean;
    togglePlay: boolean;
  };
  actions: {
    skipIntro: () => boolean;
    skipRecap: () => boolean;
    nextEpisode: () => boolean;
    seek10SecondsForward: () => boolean;
    seek10SecondsBackward: () => boolean;
    togglePlay: () => boolean;
    seekTo: (time: number) => boolean;
    seekToPercentage: (percentage: number) => boolean;
  };
}) {
  const [showPanel, setShowPanel] = useState(true);
  const [seekTime, setSeekTime] = useState("0");
  const [lastActionResult, setLastActionResult] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

  // Helper to format time in MM:SS format
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds)) return "00:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Execute action and show result
  const executeAction = (name: string, action: () => boolean) => {
    extensionLoggerContent.info(`DEBUG-PANEL: Executing action: ${name}`);

    try {
      // Check video element state before action
      if (videoElement) {
        extensionLoggerContent.info(`DEBUG-PANEL: Video before ${name}:`, {
          currentTime: videoElement.currentTime,
          duration: videoElement.duration,
          paused: videoElement.paused,
          readyState: videoElement.readyState,
          seeking: videoElement.seeking,
        });
      }

      const result = action();

      // Check video element state after action
      if (videoElement) {
        extensionLoggerContent.info(`DEBUG-PANEL: Video after ${name}:`, {
          currentTime: videoElement.currentTime,
          duration: videoElement.duration,
          paused: videoElement.paused,
          readyState: videoElement.readyState,
          seeking: videoElement.seeking,
        });
      }

      setLastActionResult(`${name}: ${result ? "Success" : "Failed"}`);
      extensionLoggerContent.info(`DEBUG-PANEL: Action result: ${name}`, {
        success: result,
      });
      setLastError(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setLastError(`Error in ${name}: ${errorMsg}`);
      extensionLoggerContent.error(`DEBUG-PANEL: Error executing ${name}`, {
        error,
      });
      setLastActionResult(`${name}: Failed (error)`);
    }

    setTimeout(() => setLastActionResult(""), 3000);
  };

  // Function to handle percentage seeking (0-9)
  const handlePercentageSeek = (percentage: number) => {
    extensionLoggerContent.info(
      `DEBUG-PANEL: Seeking to ${percentage}0% of video`
    );
    try {
      const result = actions.seekToPercentage(percentage);
      setLastActionResult(
        `Seek to ${percentage}0%: ${result ? "Success" : "Failed"}`
      );
      extensionLoggerContent.info(`DEBUG-PANEL: Percentage seek result:`, {
        percentage,
        success: result,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setLastError(`Error in percentage seek: ${errorMsg}`);
      extensionLoggerContent.error(`DEBUG-PANEL: Error in percentage seek`, {
        error,
      });
    }
  };

  // Special function for forward seeking since it's having issues
  const handleForwardSeek = () => {
    extensionLoggerContent.info("DEBUG-PANEL: Testing direct +10s seek");

    try {
      if (videoElement) {
        // Get current state
        const oldTime = videoElement.currentTime;
        extensionLoggerContent.info(
          "DEBUG-PANEL: Current video state before direct seek",
          {
            currentTime: oldTime,
            duration: videoElement.duration,
            readyState: videoElement.readyState,
          }
        );

        // Try direct manipulation of the video element
        const newTime = oldTime + 10;
        videoElement.currentTime = newTime;

        // Check if it worked
        setTimeout(() => {
          if (videoElement) {
            extensionLoggerContent.info(
              "DEBUG-PANEL: Video state after direct seek",
              {
                requestedTime: newTime,
                actualTime: videoElement.currentTime,
                didItWork: Math.abs(videoElement.currentTime - newTime) < 1,
              }
            );
          }
        }, 100);

        return true;
      }
      return false;
    } catch (error) {
      extensionLoggerContent.error("DEBUG-PANEL: Error in direct seek", {
        error,
      });
      return false;
    } finally {
      // Still try the normal method as well
      executeAction("Forward 10s", actions.seek10SecondsForward);
    }
  };

  // Handle seek to specific time
  const handleSeek = () => {
    const time = parseFloat(seekTime);
    if (!isNaN(time)) {
      extensionLoggerContent.info(`DEBUG-PANEL: Seeking to time: ${time}s`);
      const result = actions.seekTo(time);
      setLastActionResult(`Seek to ${time}s: ${result ? "Success" : "Failed"}`);
      extensionLoggerContent.info(`DEBUG-PANEL: Seek result:`, {
        time,
        success: result,
      });
    }
  };

  useEffect(() => {
    if (videoElement) {
      extensionLoggerContent.info(
        "DEBUG-PANEL: Debug panel initialized with video element",
        {
          duration,
          currentTime,
          paused: videoElement.paused,
          src: videoElement.src,
          readyState: videoElement.readyState,
        }
      );
    }
  }, [videoElement]);

  if (!videoElement || !showPanel) {
    // Render just a toggle button if panel is hidden
    return (
      <div className="fixed right-2 bottom-2 z-50">
        {!showPanel && (
          <button
            onClick={() => setShowPanel(true)}
            className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            Show Debug
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-opacity-80 fixed right-5 bottom-5 z-50 w-[300px] rounded-lg bg-black p-3 font-sans text-xs text-white shadow-lg">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold">StreamSense Debug</h3>
        <button
          onClick={() => setShowPanel(false)}
          className="cursor-pointer border-none bg-transparent text-sm text-white hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      <div className="mb-2.5 space-y-1">
        <div>
          Current Time: {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div>Video Status: {videoElement?.paused ? "Paused" : "Playing"}</div>
        <div className="text-[10px] text-gray-300">
          ReadyState: {videoElement?.readyState}, Seekable:{" "}
          {videoElement?.seekable?.length > 0 ? "Yes" : "No"}
        </div>
      </div>

      <div className="mb-2.5 grid grid-cols-2 gap-2">
        {features.skipIntro && (
          <button
            onClick={() => executeAction("Skip Intro", actions.skipIntro)}
            className="cursor-pointer rounded border-none bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
          >
            Skip Intro
          </button>
        )}
        {features.skipRecap && (
          <button
            onClick={() => executeAction("Skip Recap", actions.skipRecap)}
            className="cursor-pointer rounded border-none bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
          >
            Skip Recap
          </button>
        )}
        {features.nextEpisode && (
          <button
            onClick={() => executeAction("Next Episode", actions.nextEpisode)}
            className="cursor-pointer rounded border-none bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
          >
            Next Episode
          </button>
        )}
        {features.togglePlay && (
          <button
            onClick={() => executeAction("Toggle Play", actions.togglePlay)}
            className="cursor-pointer rounded border-none bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
          >
            Play/Pause
          </button>
        )}
        {features.seek10SecondsForward && (
          <button
            onClick={handleForwardSeek}
            className="cursor-pointer rounded border-none bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
          >
            +10s
          </button>
        )}
        {features.seek10SecondsBackward && (
          <button
            onClick={() =>
              executeAction("Backward 10s", actions.seek10SecondsBackward)
            }
            className="cursor-pointer rounded border-none bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
          >
            -10s
          </button>
        )}
      </div>

      <div className="mb-2.5 flex">
        <input
          type="text"
          value={seekTime}
          onChange={(e) => setSeekTime(e.target.value)}
          placeholder="Time in seconds"
          className="mr-2 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-white"
        />
        <button
          onClick={handleSeek}
          className="cursor-pointer rounded border-none bg-blue-600 px-2 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
        >
          Seek
        </button>
      </div>

      <div className="mb-2.5">
        <div className="mb-1 text-xs">Seek to percentage:</div>
        <div className="grid grid-cols-10 gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handlePercentageSeek(num)}
              className="cursor-pointer rounded border-none bg-gray-700 px-1 py-1 text-xs text-white transition-colors hover:bg-gray-600"
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[60px]">
        {lastActionResult && (
          <div className="bg-opacity-10 mt-2.5 rounded bg-white p-1.5 text-xs">
            {lastActionResult}
          </div>
        )}
        {lastError && (
          <div className="bg-opacity-50 mt-2.5 rounded bg-red-900 p-1.5 text-xs text-white">
            {lastError}
          </div>
        )}
      </div>

      <div className="mt-2.5 space-y-0.5 text-[10px] opacity-70">
        <div>Keyboard Shortcuts:</div>
        <div>s: Skip Intro/Recap, n: Next Episode</div>
        <div>p: +10s, o: -10s, Shift+D: Toggle Debug</div>
        <div>0-9: Seek to 0%-90% of video</div>
      </div>
    </div>
  );
}

export default DebugPanel;
