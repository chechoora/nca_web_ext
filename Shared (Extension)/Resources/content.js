// Telegram Channel Blocker Content Script - Safari Compatible
// Blocks all channels except whitelisted ones

class TelegramChannelBlocker {
    constructor() {
        this.whitelistedChannels = [];
        this.isBlocking = true;
        this.init();
    }

    async init() {
        // Check if we're on a relevant page
        if (!this.isRelevantPage()) {
            console.log("Not on a Telegram page, skipping initialization");
            return;
        }

        // Load whitelist and blocking status from background
        await this.loadSettings();

        // Listen for messages from background script
        browser.runtime.onMessage.addListener((message) => {
            return this.handleMessage(message);
        });

        // Start monitoring for Telegram channels
        this.startChannelMonitoring();

        console.log("Telegram Channel Blocker initialized on:", window.location.href);
        console.log("Whitelisted channels:", this.whitelistedChannels);
        console.log("Blocking enabled:", this.isBlocking);
    }

    async loadSettings() {
        try {
            const whitelistResponse = await browser.runtime.sendMessage({ action: 'getWhitelist' });
            if (whitelistResponse && whitelistResponse.success) {
                this.whitelistedChannels = whitelistResponse.channels || [];
            }

            const statusResponse = await browser.runtime.sendMessage({ action: 'getBlockingStatus' });
            if (statusResponse && statusResponse.success) {
                this.isBlocking = statusResponse.isBlocking !== false;
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    }

    handleMessage(message) {
        if (message.action === 'whitelistUpdated') {
            this.whitelistedChannels = message.channels || [];
            console.log("Whitelist updated:", this.whitelistedChannels);

            // Remove overlay if current channel is now whitelisted
            const currentChannel = this.extractChannelName(location.href);
            if (currentChannel && this.isChannelWhitelisted(currentChannel)) {
                this.removeOverlay();
            } else {
                // Re-check the page
                this.checkCurrentPage();
            }
        } else if (message.action === 'blockingStatusChanged') {
            this.isBlocking = message.isBlocking;
            console.log("Blocking status changed:", this.isBlocking);

            if (!this.isBlocking) {
                this.removeOverlay();
            } else {
                this.checkCurrentPage();
            }
        }
    }

    isRelevantPage() {
        const relevantDomains = ['t.me', 'telegram.org', 'web.telegram.org'];
        return relevantDomains.some(domain => window.location.href.includes(domain));
    }

    startChannelMonitoring() {
        // Check immediately
        this.checkCurrentPage();

        // Set up observers for dynamic content
        const observer = new MutationObserver(() => {
            this.checkCurrentPage();
        });

        // Wait for body to be available
        const startObserving = () => {
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } else {
                setTimeout(startObserving, 100);
            }
        };
        startObserving();

        // Monitor for navigation changes
        let lastUrl = location.href;
        const checkUrl = () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                // Remove overlay when navigating away from blocked channel
                this.removeOverlay();
                this.checkCurrentPage();
            }
        };

        // Multiple monitoring approaches for SPA
        window.addEventListener('popstate', checkUrl);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(checkUrl, 100);
            }
        });

        // Periodic check
        setInterval(checkUrl, 2000);
    }

    checkCurrentPage() {
        // If blocking is disabled, don't block anything
        if (!this.isBlocking) {
            return;
        }

        const currentUrl = location.href;

        // Check if current page is a channel
        if (this.isChannel(currentUrl)) {
            const channelName = this.extractChannelName(currentUrl);

            // Only block if channel is NOT whitelisted
            if (channelName && !this.isChannelWhitelisted(channelName)) {
                this.blockCurrentChannel(channelName);
                return;
            }
        }

        // Block channel links and elements on the page
        this.blockChannelsInView();
    }

    isChannelWhitelisted(channelName) {
        // Normalize channel name for comparison
        const normalized = channelName.toLowerCase().replace(/^@/, '');
        return this.whitelistedChannels.includes(normalized);
    }

    extractChannelName(url) {
        // IMPORTANT: Check for numeric channel IDs FIRST (with -100 prefix for supergroups/channels)
        const numericPattern = /[#\/](-100\d+)/;
        const numericMatch = url.match(numericPattern);
        if (numericMatch && numericMatch[1]) {
            return numericMatch[1]; // Returns the full numeric ID including the minus sign
        }

        // Check for /c/ format numeric channels on t.me
        const cPattern = /t\.me\/c\/(\d+)/;
        const cMatch = url.match(cPattern);
        if (cMatch && cMatch[1]) {
            return cMatch[1];
        }

        // Named channels on web.telegram.org (after #)
        const webPattern = /web\.telegram\.org.*#@?([a-zA-Z0-9_][a-zA-Z0-9_]{4,31})/;
        const webMatch = url.match(webPattern);
        if (webMatch && webMatch[1]) {
            return webMatch[1];
        }

        // Named channels on t.me
        const tMePattern = /t\.me\/([a-zA-Z0-9_][a-zA-Z0-9_]{4,31})(?:\/|$|\?|#)/;
        const tMeMatch = url.match(tMePattern);
        if (tMeMatch && tMeMatch[1]) {
            return tMeMatch[1];
        }

        // Named channels on telegram.org
        const telegramOrgPattern = /telegram\.org\/([a-zA-Z0-9_][a-zA-Z0-9_]{4,31})(?:\/|$|\?|#)/;
        const telegramOrgMatch = url.match(telegramOrgPattern);
        if (telegramOrgMatch && telegramOrgMatch[1]) {
            return telegramOrgMatch[1];
        }

        return null;
    }

    isChannel(url) {
        // Exclude app URLs that are not channels
        // /a/ and /k/ are Telegram web app versions, not channels
        const appPatterns = [
            /web\.telegram\.org\/[ak]\/?$/,  // /a/ or /k/ (app versions)
            /web\.telegram\.org\/[ak]\/$/,
            /web\.telegram\.org\/[ak]#/,
            /web\.telegram\.org\/[ak]\?/,
            /^https?:\/\/(web\.)?telegram\.org\/?$/,  // Root domain
            /^https?:\/\/t\.me\/?$/  // Root t.me
        ];

        for (const pattern of appPatterns) {
            if (pattern.test(url)) {
                return false;
            }
        }

        // IMPORTANT: Check for private chats first (positive numbers) - these are NOT channels
        // Private chats look like: web.telegram.org/a/#373670494 (positive number)
        const privateChatPattern = /[#\/](\d+)(?:[?/]|$)/;
        const privateChatMatch = url.match(privateChatPattern);
        if (privateChatMatch) {
            const id = privateChatMatch[1];
            // If it's just a positive number (no minus sign), it's a private chat, not a channel
            if (!/^-/.test(id)) {
                return false;
            }
        }

        // Detect if this is a Telegram channel URL
        const channelPatterns = [
            // Numeric channel IDs - ONLY negative IDs starting with -100 (like -1001134948258)
            // These are supergroups/channels, not private chats
            /[#\/](-100\d+)/,
            // Public channels on t.me with /c/ prefix (these are numeric channel links)
            /t\.me\/c\/(\d+)/,
            // Named channels on web.telegram.org (after #)
            /web\.telegram\.org.*#@?([a-zA-Z0-9_][a-zA-Z0-9_]{4,31})/,
            // Named channels on t.me
            /t\.me\/([a-zA-Z0-9_][a-zA-Z0-9_]{4,31})(?:\/|$|\?|#)/,
            // Named channels on telegram.org
            /telegram\.org\/([a-zA-Z0-9_][a-zA-Z0-9_]{4,31})(?:\/|$|\?|#)/
        ];

        for (const pattern of channelPatterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return true;
            }
        }

        return false;
    }

    removeOverlay() {
        const overlay = document.getElementById('telegram-channel-blocker-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    blockCurrentChannel(channelName) {
        // Remove any existing overlay first
        this.removeOverlay();

        // Create blocking overlay
        const overlay = document.createElement('div');
        overlay.id = 'telegram-channel-blocker-overlay';
        overlay.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(0, 0, 0, 0.95);
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
            ">
                <h1 style="margin-bottom: 20px; font-size: 48px;">🚫</h1>
                <h2 style="margin-bottom: 20px; color: #ff4444; font-size: 28px;">Channel Blocked</h2>
                <p style="margin-bottom: 10px; font-size: 18px; max-width: 600px; line-height: 1.5;">
                    This channel is blocked by Telegram Channel Blocker.
                </p>
                <p style="margin-bottom: 30px; font-size: 16px; color: #aaa;">
                    Channel: <strong style="color: white;">${this.escapeHtml(channelName)}</strong>
                </p>
                <p style="margin-bottom: 30px; font-size: 14px; color: #888;">
                    Use the extension popup to manage whitelisted channels
                </p>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
                    <button id="go-back-btn" style="
                        padding: 12px 24px;
                        background-color: #666;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        transition: background-color 0.2s;
                    ">Go Back</button>
                </div>
            </div>
        `;

        document.documentElement.appendChild(overlay);

        // Add event listener for go back button
        const goBackBtn = document.getElementById('go-back-btn');
        if (goBackBtn) {
            goBackBtn.addEventListener('click', () => {
                window.history.back();
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    blockChannelsInView() {
        // Find and block channel links (only non-whitelisted ones)
        const links = document.querySelectorAll('a[href*="t.me"], a[href*="telegram.org"]');

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && this.isChannel(href)) {
                const channelName = this.extractChannelName(href);

                // Only block if NOT whitelisted
                if (channelName && !this.isChannelWhitelisted(channelName)) {
                    this.blockLink(link);
                } else {
                    // Remove blocking if it was previously blocked
                    this.unblockLink(link);
                }
            }
        });
    }

    blockLink(link) {
        if (link.classList.contains('telegram-blocked')) return;

        link.classList.add('telegram-blocked');
        link.style.opacity = '0.3';
        link.style.textDecoration = 'line-through';
        link.style.pointerEvents = 'none';
        link.title = 'This channel is blocked by Telegram Channel Blocker';

        // Prevent clicking
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showBlockedMessage();
        }, true);
    }

    unblockLink(link) {
        if (!link.classList.contains('telegram-blocked')) return;

        link.classList.remove('telegram-blocked');
        link.style.opacity = '';
        link.style.textDecoration = '';
        link.style.pointerEvents = '';
        link.title = '';
    }

    showBlockedMessage() {
        // Show a brief notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #ff4444;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 999998;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: opacity 0.3s;
        `;
        notification.textContent = 'This channel is blocked';

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// Initialize the blocker
const telegramChannelBlocker = new TelegramChannelBlocker();
