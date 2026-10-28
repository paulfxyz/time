import AppKit

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
        let primary = DisplaySpace(identifier:"main",visible:CGRect(x:0,y:30,width:1440,height:870))
        let secondary = DisplaySpace(identifier:"external",visible:CGRect(x:-1920,y:0,width:1920,height:1080))
        let original = CGRect(x:94,y:88,width:730,height:540)
        let placement = WindowPlacement(frame:original,display:primary)
        check(placement.restored(on:[primary]) == original, "Restore the exact saved position and size")
        let shiftedPrimary = DisplaySpace(identifier:"main",visible:primary.visible.offsetBy(dx:1920,dy:0))
        check(placement.restored(on:[shiftedPrimary]) == original.offsetBy(dx:1920,dy:0), "Follow the same physical display after rearrangement")
        let externalFrame = CGRect(x:-1800,y:150,width:1120,height:760)
        let missing = WindowPlacement(frame:externalFrame,display:secondary).restored(on:[primary])!
        check(primary.visible.contains(missing), "Recover on an available display after disconnect")
        let small = DisplaySpace(identifier:"main",visible:CGRect(x:0,y:0,width:800,height:600))
        check(small.visible.contains(WindowPlacement(frame:CGRect(x:1200,y:800,width:1400,height:1000),display:primary).restored(on:[small])!), "Clamp oversized frames after resolution change")
        check(placement.restored(on:[]) == nil, "Handle no display")
        check(!WindowPlacement.finite(CGRect(x:CGFloat.nan,y:0,width:800,height:600)), "Reject corrupt geometry")
        check(WindowPlacement(frame:CGRect(x:0,y:0,width:0,height:600),display:primary).restored(on:[primary]) == nil, "Reject zero-sized saved frame")
        let suite = UserDefaults(suiteName:"com.paulfleury.timescreen.qa.policy.\(UUID().uuidString)")!
        suite.set(false,forKey:"rememberWindowPosition")
        let store = WindowPlacementStore(preferences:suite)
        store.save(frame:original,screen:NSScreen.main)
        check(suite.data(forKey:WindowPlacementStore.key) == nil, "Disabled window memory writes nothing")
        check(!NativePolicy.validSetup("automaticUpdates=1"), "Web content cannot change native updater preferences")
        print("\(count) native policy checks passed.")
    }
}
