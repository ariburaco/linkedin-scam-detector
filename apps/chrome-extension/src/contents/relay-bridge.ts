import type { PlasmoCSConfig } from "plasmo";
import { relayMessage } from "@plasmohq/messaging";

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.netflix.com/*",
    "https://www.youtube.com/*",
    "https://*.primevideo.com/*",
    "https://play.max.com/*",
  ],
  run_at: "document_start",
};

// Forward chrome.runtime.onMessage to window.postMessage
chrome.runtime.onMessage.addListener((message) => {
  // console.log("[SyncFlix Relay] Received message from background:", message);

  // Check if message type is one of the SyncFlixRelayMessageType values
  const messageType = message.type;
  // const messageTypeValues = Object.values(SyncFlixRelayMessageType);

  // if (messageType && messageTypeValues.includes(messageType)) {
  //   window.postMessage(
  //     {
  //       ...message,
  //       source: "syncflix-relay",
  //     },
  //     "*",
  //   );
  // }
});

// Set up relays for background messaging
relayMessage({
  name: "syncflix" as any,
});

export {};
