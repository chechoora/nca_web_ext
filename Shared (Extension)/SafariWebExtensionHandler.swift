//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Kyrylo Kharchenko on 06.11.2025.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        // Handle Telegram Channel Blocker specific messages
        let response = handleTelegramBlockerMessage(message)

        let responseItem = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            responseItem.userInfo = [ SFExtensionMessageKey: response ]
        } else {
            responseItem.userInfo = [ "message": response ]
        }

        context.completeRequest(returningItems: [ responseItem ], completionHandler: nil)
    }
    
    private func handleTelegramBlockerMessage(_ message: Any?) -> [String: Any] {
        guard let messageDict = message as? [String: Any],
              let action = messageDict["action"] as? String else {
            return ["error": "Invalid message format"]
        }
        
        switch action {
        case "getAppVersion":
            return [
                "success": true,
                "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0",
                "buildVersion": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
            ]
            
        case "getSystemInfo":
            return [
                "success": true,
                "systemInfo": [
                    "platform": "Safari",
                    "os": ProcessInfo.processInfo.operatingSystemVersionString
                ]
            ]
            
        case "ping":
            return [
                "success": true,
                "pong": true,
                "timestamp": Date().timeIntervalSince1970
            ]
            
        default:
            os_log(.default, "Unknown action: %@", action)
            return ["error": "Unknown action: \(action)"]
        }
    }
}
