// Telegram Channel Blocker Popup Script - Safari Compatible
// Whitelist management interface

class TelegramChannelBlockerPopup {
    constructor() {
        this.whitelistedChannels = [];
        this.currentChannel = null;
        this.isBlocking = true;
        this.isInitialized = false;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializePopup());
        } else {
            this.initializePopup();
        }

        // Safari-specific: Handle popup unload to prevent navigation issues
        window.addEventListener('beforeunload', () => {
            // Clean up any pending operations
            this.cleanup();
        });

        // Safari-specific: Prevent the popup from capturing back button presses
        window.addEventListener('popstate', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    cleanup() {
        // Mark as not initialized to prevent further operations
        this.isInitialized = false;
        console.log("Popup cleanup performed");
    }

    async initializePopup() {
        console.log("Telegram Channel Blocker popup initialized");

        try {
            // Load initial data with timeout to prevent hanging
            await Promise.race([
                Promise.all([
                    this.loadWhitelist(),
                    this.loadBlockingStatus(),
                    this.detectCurrentChannel()
                ]),
                this.timeout(5000) // 5 second timeout
            ]);

            // Set up event listeners
            this.setupEventListeners();

            // Render the UI
            this.render();

            // Mark as initialized
            this.isInitialized = true;
        } catch (error) {
            console.error("Error initializing popup:", error);
            // Still set up event listeners even if initialization fails
            this.setupEventListeners();
            this.render();
            this.isInitialized = true;
        }
    }

    timeout(ms) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), ms)
        );
    }

    setupEventListeners() {
        // Add channel button
        const addBtn = document.getElementById('add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addChannel());
        }

        // Channel input - add on Enter key
        const channelInput = document.getElementById('channel-input');
        if (channelInput) {
            channelInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addChannel();
                }
            });
        }

        // Whitelist current channel button
        const whitelistCurrentBtn = document.getElementById('whitelist-current-btn');
        if (whitelistCurrentBtn) {
            whitelistCurrentBtn.addEventListener('click', () => this.whitelistCurrentChannel());
        }

        // Blocking toggle
        const blockingToggle = document.getElementById('blocking-toggle');
        if (blockingToggle) {
            blockingToggle.addEventListener('change', () => this.toggleBlocking());
        }
    }

    async loadWhitelist() {
        try {
            const response = await Promise.race([
                browser.runtime.sendMessage({ action: 'getWhitelist' }),
                this.timeout(3000)
            ]);
            if (response && response.success) {
                this.whitelistedChannels = response.channels || [];
                console.log("Loaded whitelist:", this.whitelistedChannels);
            }
        } catch (error) {
            console.error("Failed to load whitelist:", error);
            this.whitelistedChannels = [];
        }
    }

    async loadBlockingStatus() {
        try {
            const response = await Promise.race([
                browser.runtime.sendMessage({ action: 'getBlockingStatus' }),
                this.timeout(3000)
            ]);
            if (response && response.success) {
                this.isBlocking = response.isBlocking !== false;

                // Update toggle UI
                const toggle = document.getElementById('blocking-toggle');
                if (toggle) {
                    toggle.checked = this.isBlocking;
                }
            }
        } catch (error) {
            console.error("Failed to load blocking status:", error);
            this.isBlocking = true; // Default to blocking enabled
        }
    }

    async detectCurrentChannel() {
        try {
            // Get the current active tab with timeout
            const tabs = await Promise.race([
                browser.tabs.query({ active: true, currentWindow: true }),
                this.timeout(3000)
            ]);
            if (!tabs || tabs.length === 0) return;

            const currentTab = tabs[0];
            const url = currentTab.url;

            // Check if we're on a Telegram page
            if (!url || (!url.includes('t.me') && !url.includes('telegram.org'))) {
                return;
            }

            // Extract channel name from URL
            this.currentChannel = this.extractChannelName(url);

            // Show current channel section if we found a channel
            const currentChannelSection = document.getElementById('current-channel-section');
            if (this.currentChannel && currentChannelSection) {
                currentChannelSection.style.display = 'block';

                // Update current channel display
                const currentChannelName = document.getElementById('current-channel-name');
                if (currentChannelName) {
                    currentChannelName.textContent = this.currentChannel;
                }

                // Update button text if already whitelisted
                const whitelistCurrentBtn = document.getElementById('whitelist-current-btn');
                if (whitelistCurrentBtn) {
                    const normalized = this.currentChannel.toLowerCase().replace(/^@/, '');
                    if (this.whitelistedChannels.includes(normalized)) {
                        whitelistCurrentBtn.textContent = 'Already Whitelisted';
                        whitelistCurrentBtn.disabled = true;
                        whitelistCurrentBtn.style.opacity = '0.6';
                        whitelistCurrentBtn.style.cursor = 'not-allowed';
                    }
                }
            }
        } catch (error) {
            console.error("Failed to detect current channel:", error);
        }
    }

    extractChannelName(url) {
        // IMPORTANT: Check for numeric channel IDs FIRST (with -100 prefix for supergroups/channels)
        const numericPattern = /[#\/](-100\d+)/;
        const numericMatch = url.match(numericPattern);
        if (numericMatch && numericMatch[1]) {
            return numericMatch[1];
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

    async addChannel() {
        if (!this.isInitialized) return;

        const input = document.getElementById('channel-input');
        if (!input) return;

        const channelName = input.value.trim();
        if (!channelName) {
            this.showMessage('Please enter a channel name or ID', 'error');
            return;
        }

        try {
            const response = await Promise.race([
                browser.runtime.sendMessage({
                    action: 'addToWhitelist',
                    channel: channelName
                }),
                this.timeout(3000)
            ]);

            if (response && response.success) {
                this.whitelistedChannels = response.channels || [];
                input.value = '';
                this.showMessage(`Added "${channelName}" to whitelist`, 'success');
                this.render();
            } else {
                this.showMessage('Failed to add channel', 'error');
            }
        } catch (error) {
            console.error("Failed to add channel:", error);
            this.showMessage('Error adding channel', 'error');
        }
    }

    async removeChannel(channelName) {
        if (!this.isInitialized) return;

        try {
            const response = await Promise.race([
                browser.runtime.sendMessage({
                    action: 'removeFromWhitelist',
                    channel: channelName
                }),
                this.timeout(3000)
            ]);

            if (response && response.success) {
                this.whitelistedChannels = response.channels || [];
                this.showMessage(`Removed "${channelName}" from whitelist`, 'success');
                this.render();

                // Update current channel button if needed
                if (this.currentChannel) {
                    const normalized = this.currentChannel.toLowerCase().replace(/^@/, '');
                    if (normalized === channelName.toLowerCase().replace(/^@/, '')) {
                        const whitelistCurrentBtn = document.getElementById('whitelist-current-btn');
                        if (whitelistCurrentBtn) {
                            whitelistCurrentBtn.textContent = 'Add Current to Whitelist';
                            whitelistCurrentBtn.disabled = false;
                            whitelistCurrentBtn.style.opacity = '1';
                            whitelistCurrentBtn.style.cursor = 'pointer';
                        }
                    }
                }
            } else {
                this.showMessage('Failed to remove channel', 'error');
            }
        } catch (error) {
            console.error("Failed to remove channel:", error);
            this.showMessage('Error removing channel', 'error');
        }
    }

    async whitelistCurrentChannel() {
        if (!this.currentChannel) return;

        const input = document.getElementById('channel-input');
        if (input) {
            input.value = this.currentChannel;
        }

        await this.addChannel();

        // Update button
        const whitelistCurrentBtn = document.getElementById('whitelist-current-btn');
        if (whitelistCurrentBtn) {
            whitelistCurrentBtn.textContent = 'Already Whitelisted';
            whitelistCurrentBtn.disabled = true;
            whitelistCurrentBtn.style.opacity = '0.6';
            whitelistCurrentBtn.style.cursor = 'not-allowed';
        }
    }

    async toggleBlocking() {
        if (!this.isInitialized) return;

        try {
            const response = await Promise.race([
                browser.runtime.sendMessage({ action: 'toggleBlocking' }),
                this.timeout(3000)
            ]);

            if (response && response.success) {
                this.isBlocking = response.isBlocking;
                console.log("Blocking status toggled:", this.isBlocking);

                // Update toggle to match actual state
                const toggle = document.getElementById('blocking-toggle');
                if (toggle) {
                    toggle.checked = this.isBlocking;
                }

                this.showMessage(
                    this.isBlocking ? 'Blocking enabled' : 'Blocking disabled',
                    'success'
                );
            }
        } catch (error) {
            console.error("Failed to toggle blocking:", error);
            this.showMessage('Error toggling blocking', 'error');
            // Revert toggle state on error
            const toggle = document.getElementById('blocking-toggle');
            if (toggle) {
                toggle.checked = this.isBlocking;
            }
        }
    }

    render() {
        const container = document.getElementById('whitelist-container');
        const countElement = document.getElementById('whitelist-count');

        if (!container) return;

        // Update count
        if (countElement) {
            countElement.textContent = this.whitelistedChannels.length;
        }

        // Clear container
        container.innerHTML = '';

        // Show empty state or list
        if (this.whitelistedChannels.length === 0) {
            container.innerHTML = '<div class="whitelist-empty">No whitelisted channels yet</div>';
        } else {
            // Render each channel
            this.whitelistedChannels.forEach(channel => {
                const item = document.createElement('div');
                item.className = 'whitelist-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'whitelist-item-name';
                nameSpan.textContent = channel;

                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn btn-danger btn-small';
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', () => this.removeChannel(channel));

                item.appendChild(nameSpan);
                item.appendChild(removeBtn);
                container.appendChild(item);
            });
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('message');
        if (!messageEl) return;

        messageEl.textContent = text;
        messageEl.className = `message ${type} show`;

        // Auto-hide after 3 seconds
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 3000);
    }
}

// Initialize popup
const popup = new TelegramChannelBlockerPopup();
