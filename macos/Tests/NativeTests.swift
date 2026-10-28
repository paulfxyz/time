import Foundation

@main
struct NativeTests {
    static func main() throws {
        var count = 0
        func check(_ value: @autoclosure () -> Bool, _ name: String) {
            precondition(value(), name)
            count += 1
        }
        check(NativePolicy.trusted(NativePolicy.liveURL), "Live origin")
        check(NativePolicy.trusted(NativePolicy.bundleURL), "Bundled origin")
        for url in [
            "http://time.paulfleury.com/", "https://time.paulfleury.com.evil.example/",
            "https://time.paulfleury.com:444/", "file:///etc/passwd",
            "https://evil.example/", "timescreen://evil/index.html",
            "https://evil@time.paulfleury.com/", "javascript:alert(1)"
        ] { check(!NativePolicy.trusted(URL(string:url)), "Reject origin \(url)") }
        check(NativePolicy.external(URL(string:"https://github.com/paulfxyz/timescreen")!), "External HTTPS")
        check(!NativePolicy.external(URL(string:"file:///Applications")!), "Reject external file")
        check(!NativePolicy.external(URL(string:"x-apple.systempreferences:")!), "Reject arbitrary schemes")
        check(NativePolicy.validSetup("scene=matrix&theme=terminal&accent=%2300ff00"), "Valid setup")
        check(!NativePolicy.validSetup("evil=value"), "Unknown setup key")
        check(!NativePolicy.validSetup("theme="+String(repeating:"x",count:5000)), "Bound setup size")
        check(!NativePolicy.validSetup("theme=abc\n"), "No control characters")
        let root = URL(fileURLWithPath:"/tmp/timescreen-test-root", isDirectory:true)
        check(NativePolicy.resource(for:NativePolicy.bundleURL,root:root)?.lastPathComponent == "index.html", "Index path")
        for path in ["../secret","%2e%2e/secret","%252e%252e/secret","assets/../../secret","assets%5c..%5csecret"] {
            let url = URL(string:"timescreen://app/\(path)")!
            check(NativePolicy.resource(for:url,root:root) == nil, "Block traversal \(path)")
        }
        check(NativePolicy.resource(for:URL(string:"timescreen://app/assets/earth-day.webp")!,root:root)?.path == root.path+"/assets/earth-day.webp", "Nested asset")
        let fixture = "\"'); alert(1); //\u{2028}"
        let encoded = NativePolicy.json(fixture)
        let decoded = try JSONSerialization.jsonObject(with:Data(encoded.utf8), options:.fragmentsAllowed) as? String
        check(decoded == fixture, "JSON safely round trips script characters")
        print("\(count) native policy checks passed.")
    }
}
