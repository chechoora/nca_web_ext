// Telegram Channel Blocker Background Script
// Manages whitelist - blocks all channels except whitelisted ones

class TelegramChannelBlockerBackground {
    constructor() {
        this.init();
    }

    async init() {
        console.log("Telegram Channel Blocker background script initialized");

        // Initialize storage if needed
        await this.initializeStorage();

        // Listen for messages from popup and content scripts
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            return this.handleMessage(message, sender, sendResponse);
        });
    }

    async initializeStorage() {
        try {
            const result = await browser.storage.local.get(['whitelistedChannels', 'isBlocking']);

            if (!result.whitelistedChannels) {
                await browser.storage.local.set({ whitelistedChannels: [] });
            }

            if (result.isBlocking === undefined) {
                await browser.storage.local.set({ isBlocking: true });
            }

            console.log("Storage initialized:", result);
        } catch (error) {
            console.error("Failed to initialize storage:", error);
        }
    }

    async handleMessage(message) {
        console.log("Received message:", message);

        try {
            switch (message.action) {
                case 'getWhitelist':
                    return this.getWhitelist();

                case 'addToWhitelist':
                    return this.addToWhitelist(message.channel);

                case 'removeFromWhitelist':
                    return this.removeFromWhitelist(message.channel);

                case 'isChannelWhitelisted':
                    return this.isChannelWhitelisted(message.channel);

                case 'toggleBlocking':
                    return this.toggleBlocking();

                case 'getBlockingStatus':
                    return this.getBlockingStatus();

                default:
                    return { success: false, error: 'Unknown action' };
            }
        } catch (error) {
            console.error("Error handling message:", error);
            return { success: false, error: error.message };
        }
    }

    async getWhitelist() {
        const result = await browser.storage.local.get('whitelistedChannels');
        return { success: true, channels: result.whitelistedChannels || [] };
    }

    async addToWhitelist(channel) {
        if (!channel) {
            return { success: false, error: 'No channel specified' };
        }

        // Normalize channel name (lowercase, remove @ prefix)
        const normalizedChannel = channel.toLowerCase().replace(/^@/, '');

        const result = await browser.storage.local.get('whitelistedChannels');
        const whitelist = result.whitelistedChannels || [];

        if (!whitelist.includes(normalizedChannel)) {
            whitelist.push(normalizedChannel);
            await browser.storage.local.set({ whitelistedChannels: whitelist });

            // Notify all tabs about the whitelist change
            this.notifyAllTabs({ action: 'whitelistUpdated', channels: whitelist });
        }

        return { success: true, channels: whitelist };
    }

    async removeFromWhitelist(channel) {
        if (!channel) {
            return { success: false, error: 'No channel specified' };
        }

        // Normalize channel name
        const normalizedChannel = channel.toLowerCase().replace(/^@/, '');

        const result = await browser.storage.local.get('whitelistedChannels');
        const whitelist = result.whitelistedChannels || [];

        const index = whitelist.indexOf(normalizedChannel);
        if (index > -1) {
            whitelist.splice(index, 1);
            await browser.storage.local.set({ whitelistedChannels: whitelist });

            // Notify all tabs about the whitelist change
            this.notifyAllTabs({ action: 'whitelistUpdated', channels: whitelist });
        }

        return { success: true, channels: whitelist };
    }

    async isChannelWhitelisted(channel) {
        if (!channel) {
            return { success: false, whitelisted: false };
        }

        // Normalize channel name
        const normalizedChannel = channel.toLowerCase().replace(/^@/, '');

        const result = await browser.storage.local.get('whitelistedChannels');
        const whitelist = result.whitelistedChannels || [];

        return { success: true, whitelisted: whitelist.includes(normalizedChannel) };
    }

    async toggleBlocking() {
        const result = await browser.storage.local.get('isBlocking');
        const newStatus = !result.isBlocking;

        await browser.storage.local.set({ isBlocking: newStatus });

        // Notify all tabs about the blocking status change
        this.notifyAllTabs({ action: 'blockingStatusChanged', isBlocking: newStatus });

        return { success: true, isBlocking: newStatus };
    }

    async getBlockingStatus() {
        const result = await browser.storage.local.get('isBlocking');
        return { success: true, isBlocking: result.isBlocking !== false };
    }

    async notifyAllTabs(message) {
        try {
            const tabs = await browser.tabs.query({});
            for (const tab of tabs) {
                if (tab.url && (tab.url.includes('t.me') || tab.url.includes('telegram.org'))) {
                    browser.tabs.sendMessage(tab.id, message).catch(err => {
                        // Tab might not have content script loaded, ignore
                        console.log("Could not send message to tab:", tab.id, err);
                    });
                }
            }
        } catch (error) {
            console.error("Error notifying tabs:", error);
        }
    }
}

// Initialize the background script
const telegramChannelBlockerBackground = new TelegramChannelBlockerBackground();
