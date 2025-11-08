// Telegram Channel Blocker Popup Script - Safari Compatible
// Simplified version - information only

class TelegramChannelBlockerPopup {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializePopup());
        } else {
            this.initializePopup();
        }
    }

    initializePopup() {
        console.log("Telegram Channel Blocker popup initialized - all channels are blocked");
    }
}

// Initialize popup
const popup = new TelegramChannelBlockerPopup();
