// Telegram Channel Blocker Background Script

class TelegramChannelBlockerBackground {
    constructor() {
        this.init();
    }

    init() {
        // Listen for messages from content script and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ error: error.message }));
            return true; // Will respond asynchronously
        });

        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        console.log("Telegram Channel Blocker background script initialized");
    }

    async handleInstallation(details) {
        if (details.reason === 'install') {
            // Set up default settings
            await chrome.storage.local.set({
                blockedChannels: [],
                isBlocking: true,
                blockingEnabled: true
            });
            console.log("Extension installed with default settings");
        }
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'getSettings':
                return this.getSettings();
                
            case 'updateSettings':
                return this.updateSettings(message.settings);
                
            case 'addBlockedChannel':
                return this.addBlockedChannel(message.channelName);
                
            case 'removeBlockedChannel':
                return this.removeBlockedChannel(message.channelName);
                
            case 'getBlockedChannels':
                return this.getBlockedChannels();
                
            case 'toggleBlocking':
                return this.toggleBlocking();
                
            case 'exportSettings':
                return this.exportSettings();
                
            case 'importSettings':
                return this.importSettings(message.settings);

            default:
                console.log("Unknown action:", message.action);
                return Promise.resolve({ error: "Unknown action" });
        }
    }

    async getSettings() {
        try {
            const result = await browser.storage.local.get([
                'blockedChannels', 
                'isBlocking', 
                'blockingEnabled'
            ]);
            
            return {
                blockedChannels: result.blockedChannels || [],
                isBlocking: result.isBlocking !== false,
                blockingEnabled: result.blockingEnabled !== false
            };
        } catch (error) {
            console.error("Error getting settings:", error);
            return { error: error.message };
        }
    }

    async updateSettings(settings) {
        try {
            await browser.storage.local.set(settings);
            
            // Notify all content scripts about the update
            this.notifyAllTabs('settingsUpdated', settings);
            
            return { success: true };
        } catch (error) {
            console.error("Error updating settings:", error);
            return { error: error.message };
        }
    }

    async addBlockedChannel(channelName) {
        try {
            const result = await browser.storage.local.get(['blockedChannels']);
            const blockedChannels = result.blockedChannels || [];
            
            const normalizedChannelName = channelName.toLowerCase().replace('@', '');
            
            if (!blockedChannels.includes(normalizedChannelName)) {
                blockedChannels.push(normalizedChannelName);
                await browser.storage.local.set({ blockedChannels });
                
                // Notify all content scripts
                this.notifyAllTabs('channelBlocked', { channelName: normalizedChannelName });
                
                console.log("Added blocked channel:", normalizedChannelName);
            }
            
            return { success: true, blockedChannels };
        } catch (error) {
            console.error("Error adding blocked channel:", error);
            return { error: error.message };
        }
    }

    async removeBlockedChannel(channelName) {
        try {
            const result = await browser.storage.local.get(['blockedChannels']);
            const blockedChannels = result.blockedChannels || [];
            
            const normalizedChannelName = channelName.toLowerCase().replace('@', '');
            const index = blockedChannels.indexOf(normalizedChannelName);
            
            if (index > -1) {
                blockedChannels.splice(index, 1);
                await browser.storage.local.set({ blockedChannels });
                
                // Notify all content scripts
                this.notifyAllTabs('channelUnblocked', { channelName: normalizedChannelName });
                
                console.log("Removed blocked channel:", normalizedChannelName);
            }
            
            return { success: true, blockedChannels };
        } catch (error) {
            console.error("Error removing blocked channel:", error);
            return { error: error.message };
        }
    }

    async getBlockedChannels() {
        try {
            const result = await browser.storage.local.get(['blockedChannels']);
            return { 
                success: true, 
                blockedChannels: result.blockedChannels || [] 
            };
        } catch (error) {
            console.error("Error getting blocked channels:", error);
            return { error: error.message };
        }
    }

    async toggleBlocking() {
        try {
            const result = await browser.storage.local.get(['isBlocking']);
            const newBlockingState = !result.isBlocking;
            
            await browser.storage.local.set({ isBlocking: newBlockingState });
            
            // Notify all content scripts
            this.notifyAllTabs('blockingToggled', { isBlocking: newBlockingState });
            
            return { success: true, isBlocking: newBlockingState };
        } catch (error) {
            console.error("Error toggling blocking:", error);
            return { error: error.message };
        }
    }

    async exportSettings() {
        try {
            const settings = await this.getSettings();
            const exportData = {
                version: "1.0",
                exportDate: new Date().toISOString(),
                settings: settings
            };
            
            return { success: true, data: exportData };
        } catch (error) {
            console.error("Error exporting settings:", error);
            return { error: error.message };
        }
    }

    async importSettings(importData) {
        try {
            if (!importData.settings) {
                throw new Error("Invalid import data");
            }
            
            await this.updateSettings(importData.settings);
            
            return { success: true };
        } catch (error) {
            console.error("Error importing settings:", error);
            return { error: error.message };
        }
    }

    async notifyAllTabs(action, data) {
        try {
            const tabs = await browser.tabs.query({});
            
            for (const tab of tabs) {
                // Only notify tabs that match our content script patterns
                if (this.isTabRelevant(tab.url)) {
                    browser.tabs.sendMessage(tab.id, { action, ...data }).catch((error) => {
                        // Tab might not have our content script, ignore errors
                        console.log("Could not notify tab:", tab.id, error.message);
                    });
                }
            }
        } catch (error) {
            console.error("Error notifying tabs:", error);
        }
    }

    isTabRelevant(url) {
        if (!url) return false;
        
        const relevantDomains = [
            'telegram.org',
            'web.telegram.org',
            't.me'
        ];
        
        return relevantDomains.some(domain => url.includes(domain));
    }
}

// Initialize the background script
const telegramChannelBlockerBackground = new TelegramChannelBlockerBackground();
