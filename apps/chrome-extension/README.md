# Chrome Extension Demo

This is a demo Chrome extension built with [Plasmo](https://docs.plasmo.com/), showcasing various extension features and components.

## Features

This extension demonstrates various Chrome extension capabilities:

- **Popup UI** - A multi-tabbed popup interface
- **Content Scripts** - Scripts that run on web pages
- **Background Service Worker** - Handles background tasks and messaging
- **Options Page** - Configure extension settings
- **Tab Pages** - Full extension pages accessible via direct URLs
- **Storage API** - Persistent data storage with sync capabilities
- **Secure Storage** - Encrypted storage for sensitive data
- **Messaging System** - Communication between different parts of the extension
  - **One-time Messages** - Request/response messaging with background
  - **Ports** - Long-lived connections for continuous communication
  - **Relay Messaging** - Communication from webpage to extension

## Project Structure

- **Popup UI** (`src/popup.tsx`): The extension's main popup interface
- **Background Script** (`src/background/index.ts`): Handles background tasks
- **Message Handlers**:
  - `src/background/messages/count.ts`: Simple counter handler
- **Port Handlers**:
  - `src/background/ports/counter.ts`: Real-time counter handler
- **Content Scripts**:
  - `src/content.tsx`: Main content script that injects UI into web pages
  - `src/contents/analytics.ts`: Analytics tracking content script
  - `src/contents/relay-example.ts`: Demonstrates relay messaging
  - `src/contents/toolbar-injector.tsx`: Injects a floating toolbar on pages
- **Options Page** (`src/options.tsx`): Extension settings configuration
- **Tab Pages** (`src/tabs/dashboard.tsx`): Full-page dashboard UI
- **Features**:
  - `src/features/count-button.tsx`: Reusable counter button component
  - `src/features/storage-demo.tsx`: Demo of the storage API
  - `src/features/secure-storage-demo.tsx`: Demo of the secure storage API
  - `src/features/update-checker.tsx`: Example update notification system
  - `src/features/live-counter.tsx`: Real-time counter with port messaging

## Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Package extension for distribution
pnpm package
```

## Technical Details

This extension is built using:

- [Plasmo Framework](https://docs.plasmo.com/) - Framework for building browser extensions
- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## Storage Usage

The extension uses Plasmo's storage API for data persistence:

```typescript
// Basic storage
import { Storage } from "@plasmohq/storage";
// React hook storage
import { useStorage } from "@plasmohq/storage/hook";
// Secure storage
import { SecureStorage } from "@plasmohq/storage/secure";

const storage = new Storage();
await storage.set("key", "value");
const data = await storage.get("key");

const secureStorage = new SecureStorage();
await secureStorage.setPassword("password");
await secureStorage.set("secretKey", "secretValue");

const [value, setValue] = useStorage("key", initialValue);
```

## Messaging System

Communication between content scripts, popup, and background:

```typescript
// ONE-TIME MESSAGING

// Send message from popup/content script to background
import { sendToBackground } from "@plasmohq/messaging";
const response = await sendToBackground({
  name: "count",
  body: { action: "get" },
});

// Handler in background script (src/background/messages/count.ts)
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { action } = req.body;
  // Handle different actions
  res.send({ result: "success" });
};

// PORT MESSAGING

// In popup/content script - connect to port
import { usePort } from "@plasmohq/messaging/hook";
const counterPort = usePort("counter");
counterPort.send({ action: "increment" });

// In background (src/background/ports/counter.ts)
const handler: PlasmoMessaging.PortHandler = async (req, res) => {
  // Handle port message
  res.send({ result: "success" });
};

// RELAY MESSAGING

// Set up relay in content script
import { relayMessage } from "@plasmohq/messaging";
relayMessage({ name: "count" });

// Send from webpage to background via content script
window.postMessage(
  {
    plasmoRelay: true,
    name: "count",
    body: { action: "get" },
  },
  "*"
);
```

## Browser Compatibility

This extension works with:

- Google Chrome
- Microsoft Edge
- Firefox (with the added `browser_specific_settings`)
