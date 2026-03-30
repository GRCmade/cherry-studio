# Windows UI Automation Script
# Extracts UI elements from the foreground window using Windows UI Automation API

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-UIElements {
    $elements = @()
    $elementId = 1

    try {
        # Create UI Automation instance
        $automation = New-Object System.Windows.Automation.AutomationElement

        # Get foreground window
        $foregroundWindow = [System.Windows.Automation.AutomationElement]::FocusedElement
        if ($null -eq $foregroundWindow) {
            $foregroundWindow = [System.Windows.Automation.AutomationElement]::RootElement
        }

        # Get window title
        $windowTitle = $foregroundWindow.Current.Name
        if ([string]::IsNullOrEmpty($windowTitle)) {
            $windowTitle = "Untitled"
        }

        # Traverse UI tree
        $script:elements = @()
        $script:elementId = 1
        Traverse-Element -element $foregroundWindow -windowTitle $windowTitle -depth 0

        return $script:elements
    }
    catch {
        Write-Error "Failed to get UI elements: $_"
        return @()
    }
}

function Traverse-Element {
    param(
        [System.Windows.Automation.AutomationElement]$element,
        [string]$windowTitle,
        [int]$depth
    )

    # Limit depth to prevent infinite recursion
    if ($depth -gt 20) { return }

    try {
        # Get element properties
        $current = $element.Current
        $controlType = $current.ControlType.ProgrammaticName -replace 'ControlType.', ''
        $name = $current.Name
        $bounds = $current.BoundingRectangle
        $isEnabled = $current.IsEnabled
        $hasFocus = $current.HasKeyboardFocus
        $isOffscreen = $current.IsOffscreen

        # Check if element is interactive
        $isClickable = Test-InteractiveControlType -controlType $controlType

        # Only add interactive elements with valid bounds
        if ($isClickable -and $bounds.Width -gt 0 -and $bounds.Height -gt 0 -and -not $isOffscreen) {
            $centerX = [int]($bounds.X + $bounds.Width / 2)
            $centerY = [int]($bounds.Y + $bounds.Height / 2)

            $elementInfo = @{
                id = $script:elementId
                window = $windowTitle
                controlType = $controlType
                name = if ([string]::IsNullOrEmpty($name)) { $controlType } else { $name }
                coords = @($centerX, $centerY)
                bounds = @{
                    x = [int]$bounds.X
                    y = [int]$bounds.Y
                    width = [int]$bounds.Width
                    height = [int]$bounds.Height
                }
                metadata = @{
                    hasFocused = $hasFocus
                    isEnabled = $isEnabled
                    isVisible = -not $isOffscreen
                    isClickable = $isClickable
                    automationId = $current.AutomationId
                    className = $current.ClassName
                }
            }

            $script:elements += $elementInfo
            $script:elementId++
        }

        # Traverse children
        $children = $element.FindAll(
            [System.Windows.Automation.TreeScope]::Children,
            [System.Windows.Automation.Condition]::TrueCondition
        )

        foreach ($child in $children) {
            Traverse-Element -element $child -windowTitle $windowTitle -depth ($depth + 1)
        }
    }
    catch {
        # Silently skip elements that fail
    }
}

function Test-InteractiveControlType {
    param([string]$controlType)

    $interactiveTypes = @(
        'Button',
        'CheckBox',
        'RadioButton',
        'Edit',
        'ComboBox',
        'ListItem',
        'MenuItem',
        'Hyperlink',
        'TabItem',
        'Slider',
        'Spinner',
        'DataItem',
        'TreeItem'
    )

    return $interactiveTypes -contains $controlType
}

# Main execution
$elements = Get-UIElements

# Output as JSON
$elements | ConvertTo-Json -Depth 10 -Compress
