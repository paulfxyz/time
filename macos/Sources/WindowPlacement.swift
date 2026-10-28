import AppKit
import CoreGraphics

struct DisplaySpace: Codable {
    let identifier: String
    let visible: CGRect
}

struct WindowPlacement: Codable {
    let frame: CGRect
    let display: DisplaySpace

    static func finite(_ rect: CGRect) -> Bool {
        [rect.minX,rect.minY,rect.width,rect.height].allSatisfy { $0.isFinite && abs($0) < 100_000 }
            && rect.width > 0 && rect.height > 0
    }
    static func constrained(_ frame: CGRect, to visible: CGRect) -> CGRect {
        let width = min(max(frame.width,420),visible.width)
        let height = min(max(frame.height,460),visible.height)
        return CGRect(x:min(max(frame.minX,visible.minX),visible.maxX-width),
                      y:min(max(frame.minY,visible.minY),visible.maxY-height),
                      width:width,height:height)
    }
    func restored(on displays: [DisplaySpace]) -> CGRect? {
        guard Self.finite(frame), Self.finite(display.visible), let primary = displays.first else { return nil }
        if let original = displays.first(where: { $0.identifier == display.identifier }) {
            let shifted = frame.offsetBy(dx:original.visible.minX-display.visible.minX,
                                         dy:original.visible.minY-display.visible.minY)
            return Self.constrained(shifted,to:original.visible)
        }
        // A removed monitor must not leave a window unreachable off-screen.
        let centered = CGRect(x:primary.visible.midX-frame.width/2,y:primary.visible.midY-frame.height/2,
                              width:frame.width,height:frame.height)
        return Self.constrained(centered,to:primary.visible)
    }
}

final class WindowPlacementStore {
    static let key = "savedWindowPlacement"
    let preferences: UserDefaults
    init(preferences: UserDefaults) { self.preferences = preferences }

    static func display(_ screen: NSScreen) -> DisplaySpace {
        var identifier = screen.localizedName
        if let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber {
            let displayID = CGDirectDisplayID(number.uint32Value)
            if let uuid = CGDisplayCreateUUIDFromDisplayID(displayID)?.takeRetainedValue() {
                identifier = CFUUIDCreateString(nil,uuid) as String
            } else { identifier += "-\(displayID)" }
        }
        return DisplaySpace(identifier:identifier,visible:screen.visibleFrame)
    }
    func save(frame: CGRect, screen: NSScreen?) {
        guard preferences.bool(forKey:"rememberWindowPosition"), WindowPlacement.finite(frame),
              let screen = screen,
              let data = try? JSONEncoder().encode(WindowPlacement(frame:frame,display:Self.display(screen))) else { return }
        preferences.set(data,forKey:Self.key)
    }
    func restore() -> CGRect? {
        guard preferences.bool(forKey:"rememberWindowPosition"),
              let data = preferences.data(forKey:Self.key),
              let saved = try? JSONDecoder().decode(WindowPlacement.self,from:data) else { return nil }
        return saved.restored(on:NSScreen.screens.map(Self.display))
    }
    func reset() { preferences.removeObject(forKey:Self.key) }
}
