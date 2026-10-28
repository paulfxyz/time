import Foundation

enum NativePolicy {
    static let version = "2.0.0"
    static let liveURL = URL(string: "https://time.paulfleury.com/")!
    static let bundleURL = URL(string: "timescreen://app/index.html")!

    static func trusted(_ url: URL?) -> Bool {
        guard let url = url, url.user == nil, url.password == nil else { return false }
        if url.scheme?.lowercased() == "https" {
            return url.host?.lowercased() == "time.paulfleury.com"
                && (url.port == nil || url.port == 443)
        }
        return url.scheme == "timescreen" && url.host == "app" && url.port == nil
    }

    static func external(_ url: URL) -> Bool {
        return ["https", "http"].contains(url.scheme?.lowercased() ?? "")
            && url.host != nil && url.user == nil && url.password == nil
    }

    static func validSetup(_ value: String) -> Bool {
        guard value.utf8.count <= 4096, !value.contains("\n"), !value.contains("\r") else { return false }
        let allowed: Set<String> = [
            "scene", "theme", "mode", "pattern", "finish", "rotation", "format",
            "layout", "city", "zone", "seconds", "labels", "lights", "grid",
            "world", "effects", "accent", "brightness", "contrast", "saturation", "temperature"
        ]
        guard value.removingPercentEncoding != nil else { return false }
        let keys = value.split(separator: "&").map { String($0.split(separator: "=", maxSplits: 1).first ?? "") }
        return !keys.isEmpty && keys.allSatisfy { allowed.contains($0) }
    }

    static func resource(for url: URL, root: URL) -> URL? {
        guard url.scheme == "timescreen", url.host == "app", url.port == nil else { return nil }
        let path = url.path.removingPercentEncoding ?? url.path
        let segments = path.split(separator: "/", omittingEmptySubsequences: true)
        guard !segments.contains(".."), !segments.contains("."),
              !path.contains("\\"), !path.contains("\0") else { return nil }
        let relative = segments.isEmpty ? "index.html" : segments.joined(separator: "/")
        let base = root.resolvingSymlinksInPath().standardizedFileURL
        let candidate = base.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
        guard candidate.path.hasPrefix(base.path + "/") else { return nil }
        return candidate
    }

    static func json(_ object: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.fragmentsAllowed]),
              let text = String(data: data, encoding: .utf8) else { return "null" }
        return text.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
            .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
    }
}
