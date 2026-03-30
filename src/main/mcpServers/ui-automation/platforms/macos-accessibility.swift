#!/usr/bin/env swift

import Cocoa
import ApplicationServices

// MARK: - Data Structures

struct UIElementInfo: Codable {
    let id: Int
    let window: String
    let controlType: String
    let name: String
    let coords: [Int]
    let bounds: BoundingBox
    let metadata: Metadata

    struct BoundingBox: Codable {
        let x: Int
        let y: Int
        let width: Int
        let height: Int
    }

    struct Metadata: Codable {
        let hasFocused: Bool
        let isEnabled: Bool
        let isVisible: Bool
        let isClickable: Bool
        let role: String?
        let subrole: String?
        let value: String?
        let description: String?
    }
}

// MARK: - Accessibility Helper

class AccessibilityHelper {

    static func getUIElements() -> [UIElementInfo] {
        var elements: [UIElementInfo] = []
        var elementId = 1

        // Get frontmost application
        guard let frontApp = NSWorkspace.shared.frontmostApplication,
              let pid = frontApp.processIdentifier as pid_t? else {
            return elements
        }

        let appElement = AXUIElementCreateApplication(pid)

        // Get windows
        var windowsValue: CFTypeRef?
        let windowsResult = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsValue)

        guard windowsResult == .success,
              let windows = windowsValue as? [AXUIElement] else {
            return elements
        }

        // Process each window
        for window in windows {
            var titleValue: CFTypeRef?
            AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleValue)
            let windowTitle = (titleValue as? String) ?? "Untitled"

            // Traverse window elements
            traverseElement(window, windowTitle: windowTitle, elements: &elements, elementId: &elementId)
        }

        return elements
    }

    static func traverseElement(_ element: AXUIElement, windowTitle: String, elements: inout [UIElementInfo], elementId: inout Int, depth: Int = 0) {
        // Limit depth to prevent infinite recursion
        guard depth < 20 else { return }

        // Get element attributes
        var roleValue: CFTypeRef?
        var subroleValue: CFTypeRef?
        var titleValue: CFTypeRef?
        var valueValue: CFTypeRef?
        var descValue: CFTypeRef?
        var positionValue: CFTypeRef?
        var sizeValue: CFTypeRef?
        var enabledValue: CFTypeRef?
        var focusedValue: CFTypeRef?

        AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleValue)
        AXUIElementCopyAttributeValue(element, kAXSubroleAttribute as CFString, &subroleValue)
        AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleValue)
        AXUIElementCopyAttributeValue(element, kAXValueAttribute as CFString, &valueValue)
        AXUIElementCopyAttributeValue(element, kAXDescriptionAttribute as CFString, &descValue)
        AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionValue)
        AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeValue)
        AXUIElementCopyAttributeValue(element, kAXEnabledAttribute as CFString, &enabledValue)
        AXUIElementCopyAttributeValue(element, kAXFocusedAttribute as CFString, &focusedValue)

        let role = roleValue as? String ?? ""
        let subrole = subroleValue as? String
        let title = titleValue as? String ?? ""
        let value = valueValue as? String
        let desc = descValue as? String
        let enabled = (enabledValue as? Bool) ?? true
        let focused = (focusedValue as? Bool) ?? false

        // Extract position and size
        var x = 0, y = 0, width = 0, height = 0
        if let position = positionValue {
            var point = CGPoint.zero
            AXValueGetValue(position as! AXValue, .cgPoint, &point)
            x = Int(point.x)
            y = Int(point.y)
        }
        if let size = sizeValue {
            var cgSize = CGSize.zero
            AXValueGetValue(size as! AXValue, .cgSize, &cgSize)
            width = Int(cgSize.width)
            height = Int(cgSize.height)
        }

        // Check if element is interactive
        let isClickable = isInteractiveRole(role)

        // Only add interactive elements with valid bounds
        if isClickable && width > 0 && height > 0 {
            let centerX = x + width / 2
            let centerY = y + height / 2

            let elementInfo = UIElementInfo(
                id: elementId,
                window: windowTitle,
                controlType: mapRoleToControlType(role, subrole: subrole),
                name: title.isEmpty ? (desc ?? role) : title,
                coords: [centerX, centerY],
                bounds: UIElementInfo.BoundingBox(x: x, y: y, width: width, height: height),
                metadata: UIElementInfo.Metadata(
                    hasFocused: focused,
                    isEnabled: enabled,
                    isVisible: true,
                    isClickable: isClickable,
                    role: role,
                    subrole: subrole,
                    value: value,
                    description: desc
                )
            )

            elements.append(elementInfo)
            elementId += 1
        }

        // Traverse children
        var childrenValue: CFTypeRef?
        let childrenResult = AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &childrenValue)

        if childrenResult == .success, let children = childrenValue as? [AXUIElement] {
            for child in children {
                traverseElement(child, windowTitle: windowTitle, elements: &elements, elementId: &elementId, depth: depth + 1)
            }
        }
    }

    static func isInteractiveRole(_ role: String) -> Bool {
        let interactiveRoles = [
            "AXButton",
            "AXCheckBox",
            "AXRadioButton",
            "AXTextField",
            "AXTextArea",
            "AXComboBox",
            "AXPopUpButton",
            "AXMenuItem",
            "AXLink",
            "AXSlider",
            "AXIncrementor",
            "AXTabGroup",
            "AXTab",
            "AXList",
            "AXTable",
            "AXCell",
            "AXRow"
        ]
        return interactiveRoles.contains(role)
    }

    static func mapRoleToControlType(_ role: String, subrole: String?) -> String {
        switch role {
        case "AXButton": return "Button"
        case "AXCheckBox": return "CheckBox"
        case "AXRadioButton": return "RadioButton"
        case "AXTextField", "AXTextArea": return "Edit"
        case "AXComboBox": return "ComboBox"
        case "AXPopUpButton": return "PopupButton"
        case "AXMenuItem": return "MenuItem"
        case "AXLink": return "Link"
        case "AXSlider": return "Slider"
        case "AXTab": return "TabItem"
        case "AXList": return "List"
        case "AXTable": return "Table"
        default: return role.replacingOccurrences(of: "AX", with: "")
        }
    }
}

// MARK: - Main

let elements = AccessibilityHelper.getUIElements()

// Output as JSON
let encoder = JSONEncoder()
encoder.outputFormatting = .prettyPrinted

if let jsonData = try? encoder.encode(elements),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
} else {
    print("[]")
}
