# LinkedIn Scam Detector - Chrome Extension

A Chrome extension that helps job seekers identify potentially fraudulent job postings on LinkedIn using AI-powered detection and rule-based analysis.

## Features

- 🛡️ **Instant Scam Detection** - Automatically scans job postings as you browse LinkedIn
- 🤖 **AI-Powered Analysis** - Uses Google Gemini AI for sophisticated pattern detection
- ⚡ **Fast Local Rules** - Client-side detection in <100ms for common patterns
- 📊 **Detailed Risk Reports** - Click badges to see comprehensive analysis
- 🔒 **Privacy-First** - No account required, minimal data collection
- 📈 **Statistics Dashboard** - Track jobs scanned and threats blocked

## Installation

### From Chrome Web Store (Coming Soon)

[Install from Chrome Web Store](https://chrome.google.com/webstore) - *Link will be available after publication*

### Development Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/[your-username]/linkedin-scam-detector.git
   cd linkedin-scam-detector
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build the extension:
   ```bash
   cd apps/chrome-extension
   bun run build
   ```

4. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` directory

## Development

### Prerequisites

- Node.js 18+ or Bun
- Chrome browser for testing

### Scripts

```bash
# Development mode with hot reload
bun run dev

# Production build
bun run build

# Package for distribution
bun run package

# Type checking
bun run typecheck

# Linting
bun run lint
bun run lint:fix
```

### Project Structure

```
apps/chrome-extension/
├── src/
│   ├── background/          # Background service worker
│   ├── components/          # React components
│   ├── contents/            # Content scripts
│   ├── lib/                 # Utilities and libraries
│   │   ├── linkedin-dom/    # LinkedIn DOM utilities
│   │   ├── local-rules/     # Client-side detection rules
│   │   └── utils/           # Helper functions
│   ├── options/             # Options page
│   └── popup.tsx            # Extension popup
├── assets/                  # Static assets
└── build/                   # Build output
```

## How It Works

1. **Content Script** detects job postings on LinkedIn pages
2. **Local Rules Engine** provides instant preliminary analysis (<100ms)
3. **Background Worker** sends job data to AI service for full analysis
4. **Risk Badges** display on job cards with color-coded risk levels
5. **Risk Reports** provide detailed analysis when badges are clicked

## Privacy

- No account or login required
- Job descriptions processed locally when possible
- AI analysis uses ephemeral data (not stored by Google)
- Anonymous feedback submissions only
- All settings stored locally on your device

See [Privacy Policy](../docs/PRIVACY_POLICY.md) for complete details.

## Permissions

- `storage` - Store extension settings and statistics locally
- `tabs` - Access to active tab for content script injection
- `https://www.linkedin.com/*` - Host permission for LinkedIn pages

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](../CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Reporting Issues

Found a bug or have a feature request? Please open an issue on [GitHub Issues](https://github.com/[your-username]/linkedin-scam-detector/issues).

## License

[Add your license here]

## Disclaimer

LinkedIn Scam Detector is an independent tool and is not affiliated with, endorsed by, or connected to LinkedIn Corporation. "LinkedIn" is a registered trademark of LinkedIn Corporation.

This tool is a detection aid, not a guarantee. Always use your judgment when evaluating job opportunities.
