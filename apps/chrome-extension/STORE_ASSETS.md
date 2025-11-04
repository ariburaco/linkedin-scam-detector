# Chrome Web Store Assets Checklist

## Required Assets

### Icons

- [x] 16x16 px - Generated automatically by Plasmo
- [x] 32x32 px - Generated automatically by Plasmo
- [x] 48x48 px - Generated automatically by Plasmo
- [x] 128x128 px - Generated automatically by Plasmo

**Location:** `build/chrome-mv3-prod/icon*.png` (after production build)

**Note:** Icons are automatically generated from `assets/icon.png` during build process.

### Screenshots (Minimum 1, Recommended 3-5)

1. **Main Feature Screenshot**
   - Show LinkedIn job search page with risk badges visible
   - Highlight different risk levels (safe, caution, danger)
   - File: `store-assets/screenshot-main.png`
   - Size: 1280x800 px minimum

2. **Risk Report Modal**
   - Show detailed risk analysis modal open
   - Display flags and confidence levels
   - File: `store-assets/screenshot-report.png`
   - Size: 1280x800 px minimum

3. **Extension Popup**
   - Show popup with statistics dashboard
   - Display scanned jobs, threats blocked, safety score
   - File: `store-assets/screenshot-popup.png`
   - Size: 400x600 px (popup size)

4. **Settings Page**
   - Show options page with all tabs visible
   - Display preferences, privacy, about sections
   - File: `store-assets/screenshot-settings.png`
   - Size: 1280x800 px minimum

5. **Feedback Modal** (Optional)
   - Show feedback submission interface
   - File: `store-assets/screenshot-feedback.png`
   - Size: 600x400 px minimum

### Promotional Images (Optional but Recommended)

- Small promotional tile: 440x280 px
- Large promotional tile: 920x680 px
- Marquee promotional tile: 1400x560 px

## Instructions for Creating Screenshots

1. **Build the extension for production:**

   ```bash
   cd apps/chrome-extension
   bun run build
   ```

2. **Load the extension in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-prod` directory

3. **Take screenshots:**
   - Navigate to LinkedIn job pages
   - Capture screenshots showing the extension in action
   - Use Chrome's built-in screenshot tool or a tool like Lightshot

4. **Optimize images:**
   - Compress images to reduce file size (< 1 MB each)
   - Ensure high quality and readability
   - Use PNG format for screenshots with UI elements

## Store Listing Text

See `docs/CHROME_WEB_STORE_LISTING.md` for:

- Short description
- Detailed description
- Category and tags
- Feature highlights

## Privacy Policy

See `docs/PRIVACY_POLICY.md` for the complete privacy policy.

**Privacy Policy URL:** (To be hosted publicly, e.g., GitHub Pages or your website)

## Support URL

**GitHub Issues:** https://github.com/[your-username]/linkedin-scam-detector/issues

## Homepage URL

**GitHub Repository:** https://github.com/[your-username]/linkedin-scam-detector

## Additional Information Required

- [ ] Developer email address
- [ ] Support email address
- [ ] Hosted privacy policy URL
- [ ] Screenshots created and optimized
- [ ] Description reviewed and finalized
- [ ] Permissions reviewed and minimized
- [ ] Version number set (currently 0.0.1 - update to 1.0.0 for launch)

## Pre-Launch Checklist

- [ ] All required assets created
- [ ] Privacy policy written and hosted
- [ ] Extension tested on Windows, macOS, and Linux
- [ ] All features tested end-to-end
- [ ] No console errors in production build
- [ ] Permissions are minimal and justified
- [ ] Description is clear and accurate
- [ ] Screenshots are high quality and representative
- [ ] Version number updated
- [ ] Build package created (`bun run package`)
