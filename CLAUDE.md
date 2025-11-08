# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Safari browser extension for iOS and macOS that blocks Telegram channels. The extension is built using Safari's Web Extension API with a native Swift wrapper that allows it to run on both platforms.

**Extension Name:** Telegram Channel Blocker
**Bundle Identifier:** org.95c3060aaef2211b.NCA.Extension

## Architecture

### Multi-Platform Safari Extension Structure

The project uses Xcode's shared target architecture for cross-platform development:

- **Shared (App)**: Native Swift app container used to install/manage the extension
  - `ViewController.swift`: Main controller that loads a WebView for extension management UI
  - Contains platform-specific logic for iOS and macOS using `#if os(iOS)` / `#elseif os(macOS)` conditionals

- **Shared (Extension)**: The web extension code shared across platforms
  - `SafariWebExtensionHandler.swift`: Native message handler bridging JavaScript and Swift
  - `Resources/`: Contains the actual extension code (JavaScript, HTML, CSS, manifest)

- **iOS (App)** / **macOS (App)**: Platform-specific app entry points and configurations

- **iOS (Extension)** / **macOS (Extension)**: Platform-specific extension configurations

### Web Extension Components

The extension follows a standard browser extension architecture with three main components:

1. **Background Script** (`background.js`)
   - Class: `TelegramChannelBlockerBackground`
   - Manages extension state and storage using `browser.storage.local`
   - Handles messages from content scripts and popup
   - Actions: `getSettings`, `updateSettings`, `addBlockedChannel`, `removeBlockedChannel`, `getBlockedChannels`, `toggleBlocking`, `exportSettings`, `importSettings`
   - Notifies all relevant tabs when settings change

2. **Content Script** (`content.js`)
   - Class: `TelegramChannelBlocker`
   - Injected into Telegram web pages (t.me, telegram.org, web.telegram.org)
   - Monitors page for blocked channels using MutationObserver and URL polling
   - Blocks channel access by showing an overlay or blocking links
   - **Important**: Channel name extraction supports both named channels (e.g., @channelname) and numeric channel IDs (e.g., -1001134948258). Numeric patterns are checked FIRST in `extractChannelName()` method.

3. **Popup UI** (`popup 2.html`, `popup 2.js`)
   - Class: `TelegramChannelBlockerPopup`
   - Provides user interface for managing blocked channels
   - Shows current channel when on a Telegram page
   - Allows adding/removing channels from block list

### Message Passing Architecture

- **Background ↔ Content Script**: Messages sent via `browser.runtime.sendMessage()` and `browser.tabs.sendMessage()`
- **Popup ↔ Background**: Messages sent via `browser.runtime.sendMessage()`
- **Extension ↔ Native**: Native messages handled by `SafariWebExtensionHandler.swift` (currently supports ping, getAppVersion, getSystemInfo)

### Storage Schema

Stored in `browser.storage.local`:
- `blockedChannels`: Array of lowercase channel names/IDs (without @ prefix)
- `isBlocking`: Boolean indicating if blocking is enabled
- `blockingEnabled`: Boolean indicating global enable state

## Building and Development

### Building the Extension

```bash
# Build for macOS
xcodebuild -scheme "NCA (macOS)" -configuration Debug build

# Build for iOS
xcodebuild -scheme "NCA (iOS)" -configuration Debug build -sdk iphoneos
```

### Running the Extension

1. Open `NCA.xcodeproj` in Xcode
2. Select either "NCA (iOS)" or "NCA (macOS)" scheme
3. Run the project (Cmd+R)
4. The app will launch and prompt you to enable the extension in Safari settings

### Testing

To test the extension:
1. Navigate to a Telegram web page (web.telegram.org or t.me)
2. Open the extension popup
3. Add a channel to the block list by name (e.g., "channelname" or "@channelname") or numeric ID (e.g., "-1001134948258")
4. Navigate to that channel - it should be blocked with an overlay

### Debugging

- **Background Script**: Debug in Safari → Develop → Web Extension Background Pages
- **Content Script**: Debug in Safari → Develop → Show Web Inspector
- **Native Swift**: Use Xcode debugger with breakpoints in `SafariWebExtensionHandler.swift`

## Key Implementation Details

### PWA (Progressive Web App) Limitations

**IMPORTANT**: Safari browser extensions have limited functionality with Progressive Web Apps (PWAs). When Telegram is installed as a PWA on iOS/macOS:

- The extension popup may not appear in the PWA context
- Content scripts may not inject properly into PWA windows
- The extension works best when Telegram is accessed through Safari as a regular website

**Workaround**: Users should access Telegram through Safari's regular browser interface (web.telegram.org) rather than installing it as a PWA for full extension functionality.

The manifest has been configured with:
- `"all_frames": true` to attempt injection into iframes and PWA contexts
- Wildcard subdomain matching (`*://*.telegram.org/*`) to catch various Telegram domains
- Extended URL pattern recognition in both content and popup scripts

### Channel Name Normalization

Channel names are always normalized to lowercase and stripped of the @ prefix before storage. This ensures consistent matching regardless of how users input the channel name.

### Manifest Version

Uses Manifest V3 with non-persistent background page (`"persistent": false`).

### Platform Compatibility

The Swift code uses availability checks (`#available`) and platform conditionals to support:
- iOS 15+ / macOS 11+ (for SFExtensionMessageKey)
- iOS 17+ / macOS 14+ (for SFExtensionProfileKey)

### Browser API Compatibility

The extension uses the `browser` namespace (WebExtension standard) which Safari supports. All async operations use promises rather than callbacks.
