#!/usr/bin/env swift

import Cocoa
import ApplicationServices

// MARK: - Window Manager

class WindowManager {

    // Focus window by process ID
    static func focusWindowByPID(_ pid: pid_t) -> Bool {
        let app = NSRunningApplication(processIdentifier: pid)
        if #available(macOS 14.0, *) {
            return app?.activate() ?? false
        } else {
            return app?.activate(options: .activateIgnoringOtherApps) ?? false
        }
    }

    // Focus window by window name (title)
    static func focusWindowByName(_ windowName: String) -> Bool {
        let workspace = NSWorkspace.shared
        let runningApps = workspace.runningApplications

        for app in runningApps {
            guard let pid = app.processIdentifier as pid_t? else { continue }
            let appElement = AXUIElementCreateApplication(pid)

            var windowsValue: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsValue)

            guard result == .success, let windows = windowsValue as? [AXUIElement] else {
                continue
            }

            for window in windows {
                var titleValue: CFTypeRef?
                AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleValue)

                if let title = titleValue as? String, title.contains(windowName) {
                    if #available(macOS 14.0, *) {
                        return app.activate()
                    } else {
                        return app.activate(options: .activateIgnoringOtherApps)
                    }
                }
            }
        }
        return false
    }

    // Perform window action (minimize, maximize, close, restore)
    static func performWindowAction(action: String, pid: pid_t?, windowName: String?) -> Bool {
        guard let targetWindow = findWindow(pid: pid, windowName: windowName) else {
            return false
        }

        switch action {
        case "minimize":
            return setWindowAttribute(targetWindow, attribute: kAXMinimizedAttribute as CFString, value: true as CFBoolean)
        case "maximize":
            // Click the zoom button to maximize
            var zoomButtonValue: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(targetWindow, "AXZoomButton" as CFString, &zoomButtonValue)
            if result == .success, let zoomButton = zoomButtonValue {
                return AXUIElementPerformAction(zoomButton as! AXUIElement, kAXPressAction as CFString) == .success
            }
            return false
        case "restore":
            let _ = setWindowAttribute(targetWindow, attribute: kAXMinimizedAttribute as CFString, value: false as CFBoolean)
            // For restore, we just unminimize - no need to toggle zoom
            return true
        case "close":
            var closeButtonValue: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(targetWindow, kAXCloseButtonAttribute as CFString, &closeButtonValue)
            if result == .success, let closeButton = closeButtonValue {
                return AXUIElementPerformAction(closeButton as! AXUIElement, kAXPressAction as CFString) == .success
            }
            return false
        default:
            return false
        }
    }

    // Helper: Find window by PID or name
    private static func findWindow(pid: pid_t?, windowName: String?) -> AXUIElement? {
        let workspace = NSWorkspace.shared
        let runningApps = workspace.runningApplications

        for app in runningApps {
            guard let appPid = app.processIdentifier as pid_t? else { continue }

            // If PID is specified, only check that app
            if let targetPid = pid, appPid != targetPid {
                continue
            }

            let appElement = AXUIElementCreateApplication(appPid)
            var windowsValue: CFTypeRef?
            let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsValue)

            guard result == .success, let windows = windowsValue as? [AXUIElement] else {
                continue
            }

            for window in windows {
                // If window name is specified, check title
                if let name = windowName {
                    var titleValue: CFTypeRef?
                    AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleValue)
                    if let title = titleValue as? String, title.contains(name) {
                        return window
                    }
                } else if pid != nil {
                    // If only PID is specified, return first window
                    return window
                }
            }
        }
        return nil
    }

    // Helper: Set window attribute
    private static func setWindowAttribute(_ window: AXUIElement, attribute: CFString, value: CFTypeRef) -> Bool {
        return AXUIElementSetAttributeValue(window, attribute, value) == .success
    }
}

// MARK: - Main

// Parse command line arguments
let args = CommandLine.arguments

guard args.count >= 2 else {
    print("{\"success\": false, \"message\": \"Missing command\"}")
    exit(1)
}

let command = args[1]
var success = false
var message = ""

switch command {
case "focus":
    if args.count >= 3 {
        let identifier = args[2]
        if let pid = pid_t(identifier) {
            success = WindowManager.focusWindowByPID(pid)
            message = success ? "Window focused" : "Failed to focus window"
        } else {
            success = WindowManager.focusWindowByName(identifier)
            message = success ? "Window focused" : "Window not found"
        }
    } else {
        message = "Missing window identifier"
    }

case "action":
    if args.count >= 4 {
        let actionType = args[2]
        let identifier = args[3]

        var pid: pid_t? = nil
        var windowName: String? = nil

        if let pidValue = pid_t(identifier) {
            pid = pidValue
        } else {
            windowName = identifier
        }

        success = WindowManager.performWindowAction(action: actionType, pid: pid, windowName: windowName)
        message = success ? "Action completed" : "Failed to perform action"
    } else {
        message = "Missing action or identifier"
    }

default:
    message = "Unknown command: \(command)"
}

// Output JSON result
let result = "{\"success\": \(success), \"message\": \"\(message)\"}"
print(result)
