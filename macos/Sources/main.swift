import AppKit
import WebKit
import ServiceManagement
import IOKit.pwr_mgt

final class TimescreenWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override func cancelOperation(_ sender: Any?) {
        if styleMask.contains(.fullScreen) { toggleFullScreen(sender) }
        else { super.cancelOperation(sender) }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate,
                         WKUIDelegate, WKScriptMessageHandler, NSMenuDelegate {
    var window: TimescreenWindow!
    var web: WKWebView!
    var statusItem: NSStatusItem?
    var settingsWindow: NSWindow?
    var sourceItem: NSMenuItem!
    var displayMenu: NSMenu!
    var loading: NSVisualEffectView!
    var loadingLabel: NSTextField!
    var spinner: NSProgressIndicator!
    var timeout: DispatchWorkItem?
    var assertion: IOPMAssertionID = 0
    var hasAssertion = false
    var source = "live"
    var ready = false
    var pendingScreen: NSScreen?
    var restoreFullscreenAfterMove = false
    var fullscreenTransition = false
    var qaStarted = false
    var qaFailures: [String] = []
    var sourceReason = ""
    let smokeDirectory: String?
    let prefs: UserDefaults
    var isFullscreen: Bool { window?.styleMask.contains(.fullScreen) ?? false }

    override init() {
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "--smoke-test"), args.indices.contains(i + 1) {
            smokeDirectory = args[i + 1]
            prefs = UserDefaults(suiteName: "com.paulfleury.timescreen.smoke.\(UUID().uuidString)")!
        } else {
            smokeDirectory = nil
            prefs = .standard
        }
        super.init()
        prefs.register(defaults: ["showMenuBar":true, "fullscreenOnLaunch":false, "alwaysOnTop":false, "keepAwake":false])
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildMenus()
        buildWindow()
        configureStatusItem()
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(willSleep),
            name: NSWorkspace.willSleepNotification, object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(didWake),
            name: NSWorkspace.didWakeNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification, object: nil)
        showWindow(nil)
        if smokeDirectory != nil {
            if CommandLine.arguments.contains("--live-site") { loadLive(nil) }
            else { loadBundled("Native verification") }
            DispatchQueue.main.asyncAfter(deadline: .now() + 85) { [weak self] in
                guard let self = self else { return }
                self.finishQA(["Native test timed out"])
            }
        } else {
            loadLive(nil)
            if prefs.bool(forKey: "fullscreenOnLaunch") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in self?.toggleFullscreen(nil) }
            }
        }
    }

    func buildWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = smokeDirectory == nil ? .default() : .nonPersistent()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let script = """
        Object.defineProperty(window, 'timescreenNative', {
          value: Object.freeze({available:true, version:\(NativePolicy.json(NativePolicy.version))}),
          writable:false, configurable:false
        });
        """
        configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.add(self, name: "timescreen")
        let resources = Bundle.main.resourceURL!.appendingPathComponent("Web")
        configuration.setURLSchemeHandler(BundleScheme(root: resources), forURLScheme: "timescreen")
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.setValue(false, forKey: "drawsBackground")
        if #available(macOS 13.3, *) { web.isInspectable = smokeDirectory != nil }

        window = TimescreenWindow(contentRect: NSRect(x:0, y:0, width:1120, height:760),
            styleMask:[.titled,.closable,.miniaturizable,.resizable], backing:.buffered, defer:false)
        window.title = "Timescreen"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(calibratedRed:0.031, green:0.051, blue:0.075, alpha:1)
        window.minSize = NSSize(width:420, height:460)
        window.collectionBehavior = [.fullScreenPrimary]
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.contentView = NSView()
        window.contentView?.addSubview(web)
        web.translatesAutoresizingMaskIntoConstraints = false
        let content = window.contentView!
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo:content.leadingAnchor),
            web.trailingAnchor.constraint(equalTo:content.trailingAnchor),
            web.topAnchor.constraint(equalTo:content.topAnchor),
            web.bottomAnchor.constraint(equalTo:content.bottomAnchor)
        ])
        loading = NSVisualEffectView()
        loading.material = .underWindowBackground
        loading.blendingMode = .withinWindow
        loading.state = .active
        loading.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(loading)
        NSLayoutConstraint.activate([
            loading.leadingAnchor.constraint(equalTo:content.leadingAnchor),
            loading.trailingAnchor.constraint(equalTo:content.trailingAnchor),
            loading.topAnchor.constraint(equalTo:content.topAnchor),
            loading.bottomAnchor.constraint(equalTo:content.bottomAnchor)
        ])
        spinner = NSProgressIndicator()
        spinner.style = .spinning
        spinner.startAnimation(nil)
        loadingLabel = NSTextField(labelWithString:"Opening your moment…")
        loadingLabel.font = .systemFont(ofSize:15, weight:.medium)
        let stack = NSStackView(views:[spinner, loadingLabel])
        stack.orientation = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        loading.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo:loading.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo:loading.centerYAnchor)
        ])
        window.center()
        if smokeDirectory == nil { _ = window.setFrameAutosaveName("TimescreenWindow") }
        screensChanged()
        applyWindowPreferences()
    }

    func item(_ title: String, _ action: Selector?, _ key: String = "", modifiers: NSEvent.ModifierFlags = .command) -> NSMenuItem {
        let value = NSMenuItem(title:title, action:action, keyEquivalent:key)
        value.target = self
        value.keyEquivalentModifierMask = modifiers
        return value
    }

    func buildMenus() {
        let main = NSMenu()
        let application = NSMenu(title:"Timescreen")
        application.addItem(item("About Timescreen", #selector(about)))
        application.addItem(item("Settings…", #selector(showSettings), ","))
        application.addItem(.separator())
        application.addItem(item("Check for Updates…", #selector(checkUpdates)))
        application.addItem(.separator())
        application.addItem(item("Hide Timescreen", #selector(NSApplication.hide(_:)), "h"))
        application.items.last?.target = NSApp
        application.addItem(item("Quit Timescreen", #selector(NSApplication.terminate(_:)), "q"))
        application.items.last?.target = NSApp
        let appItem = NSMenuItem(); appItem.submenu = application; main.addItem(appItem)

        let edit = NSMenu(title:"Edit")
        for (title, action, key) in [
            ("Undo","undo:","z"), ("Redo","redo:","Z"), ("Cut","cut:","x"),
            ("Copy","copy:","c"), ("Paste","paste:","v"), ("Select All","selectAll:","a")
        ] {
            let i = NSMenuItem(title:title, action:NSSelectorFromString(action), keyEquivalent:key)
            edit.addItem(i)
        }
        let editItem = NSMenuItem(title:"Edit", action:nil, keyEquivalent:""); editItem.submenu = edit; main.addItem(editItem)

        let view = NSMenu(title:"View")
        view.addItem(item("Appearance…", #selector(appearance), "t"))
        view.addItem(item("Picture Controls…", #selector(picture), "b"))
        view.addItem(item("Quiet Mode", #selector(quiet), "k"))
        view.addItem(.separator())
        view.addItem(item("Next Style", #selector(nextStyle), "]"))
        view.addItem(item("Previous Style", #selector(previousStyle), "["))
        view.addItem(.separator())
        view.addItem(item("Enter Full Screen", #selector(toggleFullscreen), "f", modifiers:[.control,.command]))
        view.addItem(item("Always on Top", #selector(toggleOnTop)))
        view.addItem(item("Keep Screen Awake", #selector(toggleAwake)))
        view.addItem(.separator())
        sourceItem = item("Live · time.paulfleury.com", nil); view.addItem(sourceItem)
        view.addItem(item("Reload Live Site", #selector(loadLive), "r"))
        view.addItem(item("Use Built-in Offline Version", #selector(useBundled)))
        let viewItem = NSMenuItem(title:"View", action:nil, keyEquivalent:""); viewItem.submenu = view; main.addItem(viewItem)

        let windows = NSMenu(title:"Window")
        windows.addItem(item("Show Timescreen", #selector(showWindow), "0"))
        windows.addItem(item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"))
        windows.items.last?.target = nil
        windows.addItem(item("Close Window", #selector(NSWindow.performClose(_:)), "w"))
        windows.items.last?.target = nil
        let move = item("Move to Display", nil)
        displayMenu = NSMenu(title:"Move to Display"); displayMenu.delegate = self; move.submenu = displayMenu
        windows.addItem(move)
        let windowItem = NSMenuItem(title:"Window", action:nil, keyEquivalent:""); windowItem.submenu = windows; main.addItem(windowItem)
        NSApp.windowsMenu = windows

        let help = NSMenu(title:"Help")
        help.addItem(item("Timescreen on GitHub", #selector(openRepository)))
        help.addItem(item("Open Website in Browser", #selector(openWebsite)))
        let helpItem = NSMenuItem(title:"Help", action:nil, keyEquivalent:""); helpItem.submenu = help; main.addItem(helpItem)
        NSApp.helpMenu = help
        NSApp.mainMenu = main
    }

    func configureStatusItem() {
        if let existing = statusItem { NSStatusBar.system.removeStatusItem(existing); statusItem = nil }
        guard prefs.bool(forKey:"showMenuBar") else { return }
        let status = NSStatusBar.system.statusItem(withLength:NSStatusItem.squareLength)
        let image = NSImage(systemSymbolName:"clock", accessibilityDescription:"Timescreen")
        image?.isTemplate = true
        status.button?.image = image
        status.button?.toolTip = "Timescreen"
        let menu = NSMenu()
        menu.addItem(item("Show Timescreen", #selector(showWindow)))
        menu.addItem(item("Enter Full Screen", #selector(toggleFullscreen)))
        menu.addItem(.separator())
        menu.addItem(item("Appearance…", #selector(appearance)))
        menu.addItem(item("Next Style", #selector(nextStyle)))
        menu.addItem(item("Always on Top", #selector(toggleOnTop)))
        menu.addItem(item("Keep Screen Awake", #selector(toggleAwake)))
        menu.addItem(.separator())
        menu.addItem(item("Settings…", #selector(showSettings)))
        menu.addItem(item("Quit Timescreen", #selector(quit)))
        status.menu = menu; statusItem = status
    }

    @objc func quit() { NSApp.terminate(nil) }
    @objc func showWindow(_ sender: Any?) {
        NSApp.activate(ignoringOtherApps:true)
        if window.isMiniaturized { window.deminiaturize(nil) }
        window.makeKeyAndOrderFront(nil)
        updateAwake()
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow(nil); return true
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func load(_ url: URL, source newSource: String, reason: String) {
        timeout?.cancel()
        ready = false; source = newSource; sourceReason = reason
        loading.isHidden = false; spinner.startAnimation(nil)
        loadingLabel.stringValue = newSource == "live" ? "Opening time.paulfleury.com…" : "Opening the built-in clock…"
        var components = URLComponents(url:url, resolvingAgainstBaseURL:false)!
        if let saved = prefs.string(forKey:"setup"), NativePolicy.validSetup(saved) { components.fragment = saved.removingPercentEncoding }
        var request = URLRequest(url:components.url!, cachePolicy:.reloadIgnoringLocalCacheData, timeoutInterval:10)
        request.setValue("Timescreen/\(NativePolicy.version) macOS", forHTTPHeaderField:"X-Timescreen-App")
        web.load(request)
        sourceItem.title = newSource == "live" ? "Live · time.paulfleury.com" : "Built-in · \(reason)"
        let deadline = DispatchWorkItem { [weak self] in
            guard let self = self, !self.ready else { return }
            if self.source == "live" { self.loadBundled("Website unavailable") }
            else {
                self.loadingLabel.stringValue = "Unable to open the clock. Use View → Reload Live Site to retry."
                self.spinner.stopAnimation(nil)
                if self.smokeDirectory != nil { self.finishQA(["Bundled clock failed to load"]) }
            }
        }
        timeout = deadline
        DispatchQueue.main.asyncAfter(deadline:.now() + (newSource == "live" ? 10 : 15), execute:deadline)
    }
    @objc func loadLive(_ sender: Any?) { load(NativePolicy.liveURL, source:"live", reason:"") }
    func loadBundled(_ reason: String) { web.stopLoading(); load(NativePolicy.bundleURL, source:"bundle", reason:reason) }
    @objc func useBundled() { loadBundled("Offline version") }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard NativePolicy.trusted(webView.url) else { return }
        webView.evaluateJavaScript("window.timescreen?.version || null") { [weak self] result, _ in
            guard let self = self else { return }
            if let version = result as? String, version.compare(NativePolicy.version, options:.numeric) != .orderedAscending {
                self.markReady()
            } else if self.source == "live" {
                self.loadBundled("Newer styles included in this app")
            }
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func navigationFailed(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        if source == "live" { loadBundled("Website unavailable") }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadBundled("Recovered after renderer restart")
    }
    func markReady() {
        let first = !ready
        ready = true; timeout?.cancel()
        loading.isHidden = true; spinner.stopAnimation(nil)
        sendNativeState()
        if first { window.makeFirstResponder(web) }
        if smokeDirectory != nil && !qaStarted { qaStarted = true; startQA() }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.targetFrame?.isMainFrame == false { decisionHandler(.cancel); return }
        if NativePolicy.trusted(url) && navigationAction.targetFrame != nil {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated && NativePolicy.external(url) {
                NSWorkspace.shared.open(url)
            }
        }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url,
           NativePolicy.external(url) { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if let response = navigationResponse.response as? HTTPURLResponse, response.statusCode >= 400 {
            decisionHandler(.cancel)
            if source == "live" { loadBundled("Website unavailable") }
        } else { decisionHandler(.allow) }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, NativePolicy.trusted(message.frameInfo.request.url),
              NativePolicy.trusted(web.url), let body = message.body as? [String:Any],
              let command = body["command"] as? String else { return }
        switch command {
        case "ready":
            if let value = body["value"] as? [String:Any], let version = value["version"] as? String,
               version.compare(NativePolicy.version, options:.numeric) != .orderedAscending {
                if let setup = value["setup"] as? String, NativePolicy.validSetup(setup) { prefs.set(setup, forKey:"setup") }
                markReady()
            }
        case "saveSetup":
            if let setup = body["value"] as? String, NativePolicy.validSetup(setup) { prefs.set(setup, forKey:"setup") }
        case "fullscreen": toggleFullscreen(nil)
        case "keepAwake":
            if let enabled = body["value"] as? Bool { prefs.set(enabled, forKey:"keepAwake"); updateAwake(); sendNativeState() }
        case "copySetup":
            if let code = body["value"] as? String, code.hasPrefix("time:v2:"),
               NativePolicy.validSetup(String(code.dropFirst(8))) {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(code, forType:.string)
            }
        default: break
        }
    }

    func sendCommand(_ command: String) {
        showWindow(nil)
        guard ready else { return }
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('timescreen:command',{detail:\(NativePolicy.json(command))}))", completionHandler:nil)
    }
    func sendNativeState() {
        guard ready else { return }
        let state: [String:Any] = ["fullscreen":isFullscreen, "keepAwake":prefs.bool(forKey:"keepAwake"), "awakeActive":hasAssertion]
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('timescreen:native-state',{detail:\(NativePolicy.json(state))}))", completionHandler:nil)
    }
    @objc func appearance() { sendCommand("appearance") }
    @objc func picture() { sendCommand("picture") }
    @objc func quiet() { sendCommand("quiet") }
    @objc func nextStyle() { sendCommand("next") }
    @objc func previousStyle() { sendCommand("previous") }
    @objc func toggleFullscreen(_ sender: Any?) {
        guard !fullscreenTransition else { return }
        showWindow(nil)
        fullscreenTransition = true
        window.toggleFullScreen(sender)
    }
    @objc func toggleOnTop() { prefs.set(!prefs.bool(forKey:"alwaysOnTop"), forKey:"alwaysOnTop"); applyWindowPreferences() }
    @objc func toggleAwake() { prefs.set(!prefs.bool(forKey:"keepAwake"), forKey:"keepAwake"); updateAwake(); sendNativeState() }
    func applyWindowPreferences() { window.level = prefs.bool(forKey:"alwaysOnTop") && !isFullscreen ? .floating : .normal }

    func updateAwake() {
        let wanted = prefs.bool(forKey:"keepAwake") && window.isVisible && !window.isMiniaturized
            && window.occlusionState.contains(.visible)
        if wanted && !hasAssertion {
            let result = IOPMAssertionCreateWithName(kIOPMAssertionTypePreventUserIdleDisplaySleep as CFString,
                IOPMAssertionLevel(kIOPMAssertionLevelOn), "Timescreen visible clock" as CFString, &assertion)
            hasAssertion = result == kIOReturnSuccess
        } else if !wanted { releaseAwake() }
        sendNativeState()
    }
    func releaseAwake() { if hasAssertion { IOPMAssertionRelease(assertion); hasAssertion = false } }
    @objc func willSleep() { releaseAwake() }
    @objc func didWake() { updateAwake(); sendNativeState() }
    func windowDidChangeOcclusionState(_ notification: Notification) { updateAwake() }
    func windowDidMiniaturize(_ notification: Notification) { releaseAwake(); sendNativeState() }
    func windowDidDeminiaturize(_ notification: Notification) { updateAwake() }
    func windowWillClose(_ notification: Notification) { releaseAwake() }
    func windowWillEnterFullScreen(_ notification: Notification) { fullscreenTransition = true }
    func windowWillExitFullScreen(_ notification: Notification) { fullscreenTransition = true }
    func windowDidFailToEnterFullScreen(_ window: NSWindow) { fullscreenTransition = false; sendNativeState() }
    func windowDidFailToExitFullScreen(_ window: NSWindow) { fullscreenTransition = false; sendNativeState() }
    func windowDidEnterFullScreen(_ notification: Notification) {
        fullscreenTransition = false; applyWindowPreferences(); sendNativeState(); updateAwake()
    }
    func windowDidExitFullScreen(_ notification: Notification) {
        fullscreenTransition = false
        applyWindowPreferences(); sendNativeState()
        if let screen = pendingScreen {
            pendingScreen = nil
            position(on:screen)
            if restoreFullscreenAfterMove {
                restoreFullscreenAfterMove = false
                DispatchQueue.main.async { self.window.toggleFullScreen(nil) }
            }
        }
    }
    @objc func screensChanged() {
        guard let window = window, !isFullscreen else { return }
        if !NSScreen.screens.contains(where: { $0.visibleFrame.intersection(window.frame).width > 100 && $0.visibleFrame.intersection(window.frame).height > 100 }),
           let screen = NSScreen.main { position(on:screen) }
    }
    func position(on screen: NSScreen) {
        let bounds = screen.visibleFrame
        let size = NSSize(width:min(window.frame.width, bounds.width), height:min(window.frame.height, bounds.height))
        window.setFrame(NSRect(x:bounds.midX-size.width/2, y:bounds.midY-size.height/2, width:size.width, height:size.height), display:true)
    }
    func menuNeedsUpdate(_ menu: NSMenu) {
        guard menu == displayMenu else { return }
        menu.removeAllItems()
        for (index, screen) in NSScreen.screens.enumerated() {
            let choice = item(screen.localizedName, #selector(moveToDisplay(_:)))
            choice.tag = index; choice.state = window.screen == screen ? .on : .off
            menu.addItem(choice)
        }
    }
    @objc func moveToDisplay(_ sender: NSMenuItem) {
        guard NSScreen.screens.indices.contains(sender.tag) else { return }
        let target = NSScreen.screens[sender.tag]
        if isFullscreen { pendingScreen = target; restoreFullscreenAfterMove = true; window.toggleFullScreen(nil) }
        else { position(on:target); showWindow(nil) }
    }
    @objc func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if menuItem.action == #selector(toggleFullscreen(_:)) { menuItem.title = isFullscreen ? "Exit Full Screen" : "Enter Full Screen" }
        if menuItem.action == #selector(toggleOnTop) { menuItem.state = prefs.bool(forKey:"alwaysOnTop") ? .on : .off }
        if menuItem.action == #selector(toggleAwake) { menuItem.state = prefs.bool(forKey:"keepAwake") ? .on : .off }
        return true
    }

    @objc func showSettings() {
        if let previous = settingsWindow { previous.close() }
        let settings = NSWindow(contentRect:NSRect(x:0,y:0,width:480,height:390),
            styleMask:[.titled,.closable], backing:.buffered, defer:false)
        settings.title = "Timescreen Settings"
        settings.isReleasedWhenClosed = false
        let headline = NSTextField(labelWithString:"A home for your spare screen.")
        headline.font = .systemFont(ofSize:20, weight:.semibold)
        let detail = NSTextField(wrappingLabelWithString:"Your style and window position are saved automatically. Closing the window keeps Timescreen available from the Dock and menu bar.")
        detail.font = .systemFont(ofSize:13)
        detail.textColor = .secondaryLabelColor
        let stack = NSStackView()
        stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 16
        stack.addArrangedSubview(headline); stack.addArrangedSubview(detail)
        for (key, title) in [
            ("fullscreenOnLaunch","Open in full screen"),
            ("showMenuBar","Show the menu-bar launcher"),
            ("alwaysOnTop","Keep the window above other windows"),
            ("keepAwake","Keep the display awake while Timescreen is visible"),
            ("login","Open Timescreen at login")
        ] {
            let button = NSButton(checkboxWithTitle:title, target:self, action:#selector(preferenceChanged(_:)))
            button.identifier = NSUserInterfaceItemIdentifier(key)
            button.state = (key == "login" ? SMAppService.mainApp.status == .enabled : prefs.bool(forKey:key)) ? .on : .off
            stack.addArrangedSubview(button)
        }
        let note = NSTextField(wrappingLabelWithString:"Keep awake never prevents manual sleep or closing your Mac. Login launch is optional and may require approval in System Settings.")
        note.font = .systemFont(ofSize:12); note.textColor = .secondaryLabelColor
        stack.addArrangedSubview(note)
        stack.translatesAutoresizingMaskIntoConstraints = false
        settings.contentView?.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo:settings.contentView!.leadingAnchor, constant:28),
            stack.trailingAnchor.constraint(equalTo:settings.contentView!.trailingAnchor, constant:-28),
            stack.topAnchor.constraint(equalTo:settings.contentView!.topAnchor, constant:28)
        ])
        settings.center(); settings.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps:true)
        settingsWindow = settings
    }
    @objc func preferenceChanged(_ sender: NSButton) {
        let key = sender.identifier!.rawValue, enabled = sender.state == .on
        if key == "login" {
            do {
                if enabled { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                if SMAppService.mainApp.status == .requiresApproval { SMAppService.openSystemSettingsLoginItems() }
            } catch {
                sender.state = SMAppService.mainApp.status == .enabled ? .on : .off
                let alert = NSAlert()
                alert.messageText = "Login launch needs your attention"
                alert.informativeText = "Move Timescreen to Applications first, then try again. You can also add it in System Settings → General → Login Items."
                alert.runModal()
            }
        } else {
            prefs.set(enabled, forKey:key)
            if key == "showMenuBar" { configureStatusItem() }
            applyWindowPreferences(); updateAwake()
        }
    }
    @objc func about() {
        NSApp.orderFrontStandardAboutPanel(options:[
            .applicationName:"Timescreen", .applicationVersion:NativePolicy.version,
            .credits:NSAttributedString(string:"28 styles. 60 palettes. One planet.\nBuilt by Paul Fleury · MIT\nNative AppKit + WebKit · No account or analytics.\nAd-hoc signed; not Apple-notarized.")
        ])
    }
    @objc func openRepository() { NSWorkspace.shared.open(URL(string:"https://github.com/paulfxyz/timescreen")!) }
    @objc func openWebsite() { NSWorkspace.shared.open(NativePolicy.liveURL) }
    @objc func checkUpdates() {
        // Browser-mediated updates avoid silently executing a downloaded binary.
        NSWorkspace.shared.open(URL(string:"https://github.com/paulfxyz/timescreen/releases/latest")!)
    }
    func applicationWillTerminate(_ notification: Notification) {
        timeout?.cancel()
        releaseAwake()
        web?.configuration.userContentController.removeScriptMessageHandler(forName:"timescreen")
    }

    // CI runs the real WKWebView and native window, not a browser mock.
    func startQA() {
        DispatchQueue.main.asyncAfter(deadline:.now()+1.5) { [weak self] in self?.qaScene(0) }
    }
    func qaScene(_ index: Int) {
        let scenes = ["matrix","cupertino","spectrum"]
        guard index < scenes.count else { qaFullscreen(); return }
        let id = scenes[index]
        web.evaluateJavaScript("""
          document.querySelector('[data-testid="scene-\(id)"]').click();
          JSON.stringify({version:window.timescreen.version,count:document.querySelectorAll('.scene-card').length,
            scene:window.timescreen.getState().scene,clock:document.querySelector('.clock').textContent.trim(),
            native:window.timescreenNative.available,ready:window.timescreen.getState().ready});
          """) { [weak self] value, error in
            guard let self = self else { return }
            if error != nil { self.qaFailures.append("WKWebView JavaScript failed for \(id)") }
            if let raw = value as? String, let data = raw.data(using:.utf8),
               let result = try? JSONSerialization.jsonObject(with:data) as? [String:Any] {
                if result["scene"] as? String != id || result["count"] as? Int != 28 || result["native"] as? Bool != true {
                    self.qaFailures.append("Unexpected render state for \(id)")
                }
            } else { self.qaFailures.append("Missing render result for \(id)") }
            DispatchQueue.main.asyncAfter(deadline:.now()+0.7) {
                self.web.takeSnapshot(with:nil) { image, error in
                    if let image = image, let tiff = image.tiffRepresentation,
                       let bitmap = NSBitmapImageRep(data:tiff),
                       let png = bitmap.representation(using:.png, properties:[:]) {
                        let path = URL(fileURLWithPath:self.smokeDirectory!).appendingPathComponent("native-\(id).png")
                        try? FileManager.default.createDirectory(at:path.deletingLastPathComponent(), withIntermediateDirectories:true)
                        try? png.write(to:path)
                    } else { self.qaFailures.append("Snapshot failed for \(id)") }
                    self.qaScene(index+1)
                }
            }
        }
    }
    func qaFullscreen() {
        // Exercise the webpage control and the native state acknowledgement.
        web.evaluateJavaScript("document.getElementById('fullscreen-button').click()", completionHandler:nil)
        qaWaitForFullscreen(true, attempts:30) { [weak self] in
            guard let self = self else { return }
            self.web.evaluateJavaScript("window.timescreen.getState().fullscreen") { value, _ in
                if value as? Bool != true { self.qaFailures.append("Web/native fullscreen state mismatch") }
                self.window.toggleFullScreen(nil)
                self.qaWaitForFullscreen(false, attempts:30) {
                    let saved = self.prefs.string(forKey:"setup") ?? ""
                    if !saved.contains("scene=spectrum") { self.qaFailures.append("Native setup persistence failed") }
                    self.finishQA([])
                }
            }
        }
    }
    func qaWaitForFullscreen(_ expected: Bool, attempts: Int, done: @escaping () -> Void) {
        if !fullscreenTransition && isFullscreen == expected { done(); return }
        guard attempts > 0 else { qaFailures.append("Native fullscreen transition failed"); finishQA([]); return }
        DispatchQueue.main.asyncAfter(deadline:.now()+0.2) { self.qaWaitForFullscreen(expected, attempts:attempts-1, done:done) }
    }
    func finishQA(_ extra: [String]) {
        guard let directory = smokeDirectory else { return }
        let failures = qaFailures + extra
        let report: [String:Any] = ["version":NativePolicy.version, "passed":failures.isEmpty,
            "failures":failures, "source":source, "sourceReason":sourceReason, "engine":"real macOS WKWebView",
            "checks":["bundled offline load","28 style cards","3 style renders","native bridge","setup persistence","native fullscreen round trip"]]
        try? FileManager.default.createDirectory(atPath:directory, withIntermediateDirectories:true)
        try? NativePolicy.json(report).write(toFile:directory+"/native-smoke.json", atomically:true, encoding:.utf8)
        print(NativePolicy.json(report))
        releaseAwake()
        fflush(stdout)
        exit(failures.isEmpty ? 0 : 1)
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.run()
