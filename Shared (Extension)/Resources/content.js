// Telegram Channel Blocker Content Script - Safari Compatible
// Simplified version - blocks ALL channels

class TelegramChannelBlocker {
    constructor() {
        this.init();
    }

    async init() {
        // Check if we're on a relevant page
        if (!this.isRelevantPage()) {
            console.log("Not on a Telegram page, skipping initialization");
            return;
        }

        // Start monitoring for Telegram channels
        this.startChannelMonitoring();

        console.log("Telegram Channel Blocker initialized - blocking ALL channels on:", window.location.href);
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
        const currentUrl = location.href;

        // Check if current page is a channel - block it if it is
        if (this.isChannel(currentUrl)) {
            this.blockCurrentChannel();
            return;
        }

        // Block channel links and elements on the page
        this.blockChannelsInView();
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

    blockCurrentChannel() {
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
                <p style="margin-bottom: 30px; font-size: 18px; max-width: 600px; line-height: 1.5;">
                    All Telegram channels are blocked by this extension.
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

    blockChannelsInView() {
        // Find and block channel links
        const links = document.querySelectorAll('a[href*="t.me"], a[href*="telegram.org"]');

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && this.isChannel(href)) {
                this.blockLink(link);
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
        notification.textContent = 'All channels are blocked';

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// Initialize the blocker
const telegramChannelBlocker = new TelegramChannelBlocker();
