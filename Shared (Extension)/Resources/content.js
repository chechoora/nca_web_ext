// Telegram Channel Blocker Content Script

class TelegramChannelBlocker {
    constructor() {
        this.blockedChannels = new Set();
        this.isBlocking = false;
        this.init();
    }

    async init() {
        // Check if we're on a relevant page
        if (!this.isRelevantPage()) {
            console.log("Not on a Telegram page, skipping initialization");
            return;
        }

        // Load blocked channels from storage
        await this.loadBlockedChannels();
        
        // Start monitoring for Telegram channels
        this.startChannelMonitoring();
        
        // Listen for messages from popup/background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            return this.handleMessage(message, sender, sendResponse);
        });

        console.log("Telegram Channel Blocker initialized on:", window.location.href);
    }

    isRelevantPage() {
        const relevantDomains = ['t.me', 'telegram.org', 'web.telegram.org'];
        return relevantDomains.some(domain => window.location.href.includes(domain));
    }

    async loadBlockedChannels() {
        try {
            const result = await chrome.storage.local.get(['blockedChannels', 'isBlocking']);
            this.blockedChannels = new Set(result.blockedChannels || []);
            this.isBlocking = result.isBlocking !== false; // Default to true
            console.log("Loaded blocked channels:", Array.from(this.blockedChannels));
        } catch (error) {
            console.error("Error loading blocked channels:", error);
            // Fallback to empty state
            this.blockedChannels = new Set();
            this.isBlocking = true;
        }
    }

    async saveBlockedChannels() {
        try {
            await chrome.storage.local.set({
                blockedChannels: Array.from(this.blockedChannels),
                isBlocking: this.isBlocking
            });
            console.log("Saved settings:", {
                blockedChannels: Array.from(this.blockedChannels),
                isBlocking: this.isBlocking
            });
        } catch (error) {
            console.error("Error saving blocked channels:", error);
        }
    }

    startChannelMonitoring() {
        // Monitor for navigation changes (for single-page app behavior)
        let lastUrl = location.href;
        
        const checkForChannels = () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                this.checkCurrentPage();
            }
            
            // Also check for dynamically loaded content
            this.blockChannelsInView();
        };

        // Check immediately
        this.checkCurrentPage();

        // Set up observers for dynamic content
        const observer = new MutationObserver(() => {
            checkForChannels();
        });

        // Wait for body to be available (important for PWAs)
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

        // Enhanced monitoring for PWA navigation
        window.addEventListener('popstate', checkForChannels);
        window.addEventListener('pushstate', checkForChannels);
        window.addEventListener('replacestate', checkForChannels);
        
        // Also check periodically for good measure
        setInterval(checkForChannels, 2000);
        
        // PWA-specific: Monitor for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(checkForChannels, 100);
            }
        });
    }

    checkCurrentPage() {
        if (!this.isBlocking) return;

        const currentUrl = location.href;
        
        // Check if current page is a blocked channel
        if (this.isChannelBlocked(currentUrl)) {
            this.blockCurrentChannel();
            return;
        }

        // Block channel links and elements on the page
        this.blockChannelsInView();
    }

    isChannelBlocked(url) {
        const channelName = this.extractChannelName(url);
        if (!channelName) return false;

        return this.blockedChannels.has(channelName.toLowerCase());
    }

    extractChannelName(url) {
        // Extract channel name from various Telegram URL formats
        const patterns = [
            /t\.me\/([^\/\?]+)/,
            /telegram\.org\/([^\/\?]+)/,
            /web\.telegram\.org.*#@([^\/\?]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1].replace('@', '');
            }
        }

        return null;
    }

    blockCurrentChannel() {
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
                background-color: rgba(0, 0, 0, 0.9);
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
            ">
                <h1 style="margin-bottom: 20px; font-size: 48px;">🚫</h1>
                <h2 style="margin-bottom: 20px; color: #ff4444;">Channel Blocked</h2>
                <p style="margin-bottom: 30px; font-size: 18px; max-width: 600px; line-height: 1.5;">
                    This Telegram channel has been blocked by your extension.
                </p>
                <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
                    <button id="unblock-channel" style="
                        padding: 12px 24px;
                        background-color: #0088cc;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        transition: background-color 0.2s;
                    ">Unblock This Channel</button>
                    <button id="go-back" style="
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

        document.body.appendChild(overlay);

        // Add event listeners
        document.getElementById('unblock-channel').addEventListener('click', () => {
            const channelName = this.extractChannelName(location.href);
            if (channelName) {
                this.unblockChannel(channelName);
                overlay.remove();
            }
        });

        document.getElementById('go-back').addEventListener('click', () => {
            window.history.back();
        });
    }

    blockChannelsInView() {
        if (!this.isBlocking) return;

        // Find and block channel links
        const links = document.querySelectorAll('a[href*="t.me"], a[href*="telegram.org"]');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (this.isChannelBlocked(href)) {
                this.blockLink(link);
            }
        });

        // Also look for channel mentions in text
        this.blockChannelMentions();
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
        });
    }

    blockChannelMentions() {
        // Block @channel mentions in text
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        textNodes.forEach(textNode => {
            if (textNode.parentElement?.classList.contains('telegram-blocked')) return;

            const text = textNode.textContent;
            const mentionPattern = /@([a-zA-Z0-9_]+)/g;
            let match;
            let hasBlockedMention = false;

            while ((match = mentionPattern.exec(text)) !== null) {
                const channelName = match[1];
                if (this.blockedChannels.has(channelName.toLowerCase())) {
                    hasBlockedMention = true;
                    break;
                }
            }

            if (hasBlockedMention) {
                const span = document.createElement('span');
                span.classList.add('telegram-blocked');
                span.innerHTML = text.replace(mentionPattern, (match, channelName) => {
                    if (this.blockedChannels.has(channelName.toLowerCase())) {
                        return `<span style="opacity: 0.3; text-decoration: line-through;">@${channelName}</span>`;
                    }
                    return match;
                });
                textNode.parentNode.replaceChild(span, textNode);
            }
        });
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
            z-index: 10001;
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

    async blockChannel(channelName) {
        this.blockedChannels.add(channelName.toLowerCase());
        await this.saveBlockedChannels();
        this.checkCurrentPage();
        console.log("Blocked channel:", channelName);
    }

    async unblockChannel(channelName) {
        this.blockedChannels.delete(channelName.toLowerCase());
        await this.saveBlockedChannels();
        
        // Remove blocking elements
        document.querySelectorAll('.telegram-blocked').forEach(el => {
            el.style.opacity = '';
            el.style.textDecoration = '';
            el.style.pointerEvents = '';
            el.classList.remove('telegram-blocked');
        });
        
        console.log("Unblocked channel:", channelName);
    }

    async toggleBlocking() {
        this.isBlocking = !this.isBlocking;
        await this.saveBlockedChannels();
        
        if (this.isBlocking) {
            this.checkCurrentPage();
        } else {
            // Remove all blocking elements
            document.querySelectorAll('.telegram-blocked').forEach(el => {
                el.style.opacity = '';
                el.style.textDecoration = '';
                el.style.pointerEvents = '';
                el.classList.remove('telegram-blocked');
            });
            
            const overlay = document.getElementById('telegram-channel-blocker-overlay');
            if (overlay) overlay.remove();
        }
        
        return this.isBlocking;
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'blockChannel':
                this.blockChannel(message.channelName).then(() => {
                    sendResponse({ success: true });
                });
                return true;
                
            case 'unblockChannel':
                this.unblockChannel(message.channelName).then(() => {
                    sendResponse({ success: true });
                });
                return true;
                
            case 'getBlockedChannels':
                sendResponse({ 
                    blockedChannels: Array.from(this.blockedChannels),
                    isBlocking: this.isBlocking
                });
                break;
                
            case 'toggleBlocking':
                this.toggleBlocking().then((isBlocking) => {
                    sendResponse({ isBlocking });
                });
                return true;
                
            case 'getCurrentChannel':
                const channelName = this.extractChannelName(location.href);
                sendResponse({ 
                    channelName,
                    isBlocked: channelName ? this.blockedChannels.has(channelName.toLowerCase()) : false
                });
                break;
        }
    }

    // Debug function to test the extension manually
    debug() {
        console.log("=== Telegram Channel Blocker Debug Info ===");
        console.log("Current URL:", window.location.href);
        console.log("Is blocking enabled:", this.isBlocking);
        console.log("Blocked channels:", Array.from(this.blockedChannels));
        console.log("Current channel:", this.extractChannelName(window.location.href));
        console.log("Is current channel blocked:", this.isChannelBlocked(window.location.href));
        console.log("===========================================");
        
        // Test blocking a channel
        if (!this.blockedChannels.has('testchannel')) {
            console.log("Adding test channel for debugging...");
            this.blockChannel('testchannel');
        }
        
        return {
            url: window.location.href,
            isBlocking: this.isBlocking,
            blockedChannels: Array.from(this.blockedChannels),
            currentChannel: this.extractChannelName(window.location.href)
        };
    }
}

// Initialize the blocker
const telegramChannelBlocker = new TelegramChannelBlocker();

// Make debug function available globally for console testing
window.telegramChannelBlockerDebug = () => telegramChannelBlocker.debug();
