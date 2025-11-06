// Telegram Channel Blocker Popup Script

class TelegramChannelBlockerPopup {
    constructor() {
        this.elements = {};
        this.currentChannel = null;
        this.isCurrentChannelBlocked = false;
        this.init();
    }

    init() {
        this.initializeElements();
        this.attachEventListeners();
        this.loadSettings();
        this.checkCurrentPage();
        this.updateStatus("Ready");
    }

    initializeElements() {
        this.elements = {
            blockingToggle: document.getElementById('blocking-toggle'),
            currentPageSection: document.getElementById('current-page-section'),
            currentPageInfo: document.getElementById('current-page-info'),
            quickActionButton: document.getElementById('quick-action-button'),
            channelInput: document.getElementById('channel-input'),
            addButton: document.getElementById('add-button'),
            messageContainer: document.getElementById('message-container'),
            blockedChannelsList: document.getElementById('blocked-channels-list'),
            channelCount: document.getElementById('channel-count'),
            statusText: document.getElementById('status-text')
        };
    }

    attachEventListeners() {
        // Toggle blocking
        this.elements.blockingToggle.addEventListener('click', () => {
            this.toggleBlocking();
        });

        // Add channel
        this.elements.addButton.addEventListener('click', () => {
            this.addChannel();
        });

        // Add channel with Enter key
        this.elements.channelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addChannel();
            }
        });

        // Quick action for current page
        this.elements.quickActionButton.addEventListener('click', () => {
            this.handleQuickAction();
        });

        // Input validation
        this.elements.channelInput.addEventListener('input', () => {
            this.validateInput();
        });
    }

    async loadSettings() {
        try {
            const response = await browser.runtime.sendMessage({ action: 'getSettings' });
            
            if (response.error) {
                throw new Error(response.error);
            }

            // Update blocking toggle
            this.updateBlockingToggle(response.isBlocking);
            
            // Update blocked channels list
            this.updateBlockedChannelsList(response.blockedChannels);
            
            this.updateStatus("Settings loaded");
        } catch (error) {
            console.error("Error loading settings:", error);
            this.showMessage("Error loading settings", "error");
        }
    }

    async checkCurrentPage() {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (!activeTab || !this.isRelevantTab(activeTab.url)) {
                return;
            }

            // Get current channel information from content script
            const response = await browser.tabs.sendMessage(activeTab.id, { 
                action: 'getCurrentChannel' 
            });

            if (response && response.channelName) {
                this.currentChannel = response.channelName;
                this.isCurrentChannelBlocked = response.isBlocked;
                this.showCurrentPageSection();
            }
        } catch (error) {
            console.log("Could not check current page:", error.message);
            // This is expected if we're not on a Telegram page
        }
    }

    isRelevantTab(url) {
        if (!url) return false;
        const relevantDomains = ['telegram.org', 'web.telegram.org', 't.me'];
        return relevantDomains.some(domain => url.includes(domain));
    }

    showCurrentPageSection() {
        if (!this.currentChannel) return;

        this.elements.currentPageSection.style.display = 'block';
        this.elements.currentPageInfo.textContent = `Channel: @${this.currentChannel}`;
        
        if (this.isCurrentChannelBlocked) {
            this.elements.quickActionButton.textContent = 'Unblock This Channel';
            this.elements.quickActionButton.classList.add('unblock');
        } else {
            this.elements.quickActionButton.textContent = 'Block This Channel';
            this.elements.quickActionButton.classList.remove('unblock');
        }
    }

    updateBlockingToggle(isBlocking) {
        if (isBlocking) {
            this.elements.blockingToggle.classList.add('active');
        } else {
            this.elements.blockingToggle.classList.remove('active');
        }
    }

    async toggleBlocking() {
        try {
            const response = await browser.runtime.sendMessage({ action: 'toggleBlocking' });
            
            if (response.error) {
                throw new Error(response.error);
            }

            this.updateBlockingToggle(response.isBlocking);
            this.showMessage(
                response.isBlocking ? "Blocking enabled" : "Blocking disabled", 
                "success"
            );
            
            this.updateStatus(response.isBlocking ? "Blocking enabled" : "Blocking disabled");
        } catch (error) {
            console.error("Error toggling blocking:", error);
            this.showMessage("Error toggling blocking", "error");
        }
    }

    validateInput() {
        const channelName = this.elements.channelInput.value.trim();
        const isValid = channelName.length > 0;
        
        this.elements.addButton.disabled = !isValid;
    }

    async addChannel() {
        const channelName = this.elements.channelInput.value.trim();
        
        if (!channelName) {
            this.showMessage("Please enter a channel name", "error");
            return;
        }

        // Normalize channel name
        const normalizedName = channelName.replace('@', '');
        
        try {
            const response = await browser.runtime.sendMessage({ 
                action: 'addBlockedChannel', 
                channelName: normalizedName 
            });
            
            if (response.error) {
                throw new Error(response.error);
            }

            this.updateBlockedChannelsList(response.blockedChannels);
            this.elements.channelInput.value = '';
            this.validateInput();
            this.showMessage(`Channel @${normalizedName} blocked successfully`, "success");
            this.updateStatus(`Blocked @${normalizedName}`);
            
            // Update current page section if needed
            if (this.currentChannel === normalizedName) {
                this.isCurrentChannelBlocked = true;
                this.showCurrentPageSection();
            }
        } catch (error) {
            console.error("Error adding channel:", error);
            this.showMessage("Error blocking channel", "error");
        }
    }

    async removeChannel(channelName) {
        try {
            const response = await browser.runtime.sendMessage({ 
                action: 'removeBlockedChannel', 
                channelName 
            });
            
            if (response.error) {
                throw new Error(response.error);
            }

            this.updateBlockedChannelsList(response.blockedChannels);
            this.showMessage(`Channel @${channelName} unblocked successfully`, "success");
            this.updateStatus(`Unblocked @${channelName}`);
            
            // Update current page section if needed
            if (this.currentChannel === channelName) {
                this.isCurrentChannelBlocked = false;
                this.showCurrentPageSection();
            }
        } catch (error) {
            console.error("Error removing channel:", error);
            this.showMessage("Error unblocking channel", "error");
        }
    }

    async handleQuickAction() {
        if (!this.currentChannel) return;

        if (this.isCurrentChannelBlocked) {
            await this.removeChannel(this.currentChannel);
        } else {
            // Add current channel to blocked list
            try {
                const response = await browser.runtime.sendMessage({ 
                    action: 'addBlockedChannel', 
                    channelName: this.currentChannel 
                });
                
                if (response.error) {
                    throw new Error(response.error);
                }

                this.updateBlockedChannelsList(response.blockedChannels);
                this.isCurrentChannelBlocked = true;
                this.showCurrentPageSection();
                this.showMessage(`Channel @${this.currentChannel} blocked successfully`, "success");
                this.updateStatus(`Blocked @${this.currentChannel}`);
            } catch (error) {
                console.error("Error blocking current channel:", error);
                this.showMessage("Error blocking channel", "error");
            }
        }
    }

    updateBlockedChannelsList(blockedChannels) {
        this.elements.channelCount.textContent = blockedChannels.length;
        
        if (blockedChannels.length === 0) {
            this.elements.blockedChannelsList.innerHTML = 
                '<div class="empty-state">No channels blocked yet</div>';
            return;
        }

        const channelsHtml = blockedChannels
            .sort()
            .map(channel => `
                <div class="channel-item">
                    <span class="channel-name">@${channel}</span>
                    <button class="remove-button" onclick="popup.removeChannel('${channel}')">
                        Remove
                    </button>
                </div>
            `).join('');

        this.elements.blockedChannelsList.innerHTML = channelsHtml;
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        
        this.elements.messageContainer.innerHTML = '';
        this.elements.messageContainer.appendChild(messageDiv);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    updateStatus(status) {
        this.elements.statusText.textContent = status;
    }
}

// Initialize popup
const popup = new TelegramChannelBlockerPopup();