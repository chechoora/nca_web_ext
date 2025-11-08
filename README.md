# Telegram Channel Blocker

A Safari browser extension for iOS and macOS that allows you to block access to specific Telegram channels when using Telegram Web.

## Features

- Block Telegram channels by name or numeric ID
- Works on all Telegram web platforms (web.telegram.org, t.me)
- Simple popup interface for managing blocked channels
- Export/import settings for backup and sharing
- Cross-platform support (iOS and macOS)
- Real-time blocking with visual overlay

## Installation

### macOS

1. Open the project in Xcode
2. Select the "NCA (macOS)" scheme
3. Build and run (⌘R)
4. Open Safari → Preferences → Extensions
5. Enable "Telegram Channel Blocker"

### iOS

1. Open the project in Xcode
2. Select the "NCA (iOS)" scheme
3. Build and run (⌘R) on your device
4. Open Settings → Safari → Extensions
5. Enable "Telegram Channel Blocker"

## Usage

### Blocking a Channel

1. Navigate to a Telegram channel on web.telegram.org or t.me
2. Click the extension icon in Safari's toolbar
3. The current channel will be displayed
4. Click "Block This Channel" to add it to your block list

You can also manually add channels:
- By username: Enter `channelname` or `@channelname`
- By numeric ID: Enter the channel ID (e.g., `-1001134948258`)

### Managing Blocked Channels

- View all blocked channels in the extension popup
- Click the "×" button next to any channel to unblock it
- Use the toggle switch to temporarily disable/enable blocking
- Export your settings for backup or sharing with others
- Import settings to restore or sync across devices

### How Blocking Works

When you visit a blocked channel:
- An overlay appears preventing access to the channel content
- A message indicates the channel is blocked
- Navigation to blocked channels is prevented automatically

## Building from Source

### Requirements

- Xcode 14.0 or later
- macOS 11.0+ (for macOS extension)
- iOS 15.0+ (for iOS extension)

### Build Commands

```bash
# Build for macOS
xcodebuild -scheme "NCA (macOS)" -configuration Debug build

# Build for iOS
xcodebuild -scheme "NCA (iOS)" -configuration Debug build -sdk iphoneos
```

## Development

### Project Structure

```
NCA.xcodeproj/
├── Shared (App)/              # Native Swift app container
│   └── ViewController.swift   # Main app UI controller
├── Shared (Extension)/        # Web extension code
│   ├── SafariWebExtensionHandler.swift
│   └── Resources/
│       ├── manifest.json      # Extension manifest
│       ├── background.js      # Background script
│       ├── content.js         # Content script (injected into pages)
│       ├── popup 2.html       # Extension popup UI
│       └── popup 2.js         # Popup logic
├── iOS (App)/                 # iOS-specific app code
├── iOS (Extension)/           # iOS-specific extension config
├── macOS (App)/               # macOS-specific app code
└── macOS (Extension)/         # macOS-specific extension config
```

### Architecture

The extension consists of three main components:

1. **Background Script** (`background.js`)
   - Manages extension state and storage
   - Handles messages between components
   - Stores blocked channels list

2. **Content Script** (`content.js`)
   - Injected into Telegram web pages
   - Monitors for blocked channels
   - Displays blocking overlay

3. **Popup UI** (`popup 2.html`, `popup 2.js`)
   - User interface for managing settings
   - Add/remove channels from block list
   - Export/import functionality

### Debugging

- **Background Script**: Safari → Develop → Web Extension Background Pages
- **Content Script**: Safari → Develop → Show Web Inspector (on the Telegram page)
- **Native Code**: Use Xcode debugger with breakpoints

## Known Limitations

### Progressive Web App (PWA) Support

Safari extensions have limited functionality with PWAs. For best results:
- Use Telegram through Safari's regular browser (web.telegram.org)
- Avoid installing Telegram as a PWA on iOS/macOS
- The extension may not work properly in PWA contexts

## Technical Details

- **Extension Type**: Safari Web Extension (Manifest V3)
- **Storage**: `browser.storage.local` API
- **Permissions**: Access to Telegram domains only
- **Bundle ID**: `org.95c3060aaef2211b.NCA.Extension`

## Privacy

This extension:
- Only accesses Telegram web pages
- Stores data locally on your device
- Does not send any data to external servers
- Does not track your browsing activity

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Support

For issues or feature requests, please [open an issue](https://github.com/yourusername/telegram-channel-blocker/issues).
