import AppKit
import ServiceManagement

private final class SettingsDocument: NSView { override var isFlipped: Bool { true } }

extension AppDelegate {
    @objc func showSettings() {
        if let existing = settingsWindow, existing.isVisible {
            existing.makeKeyAndOrderFront(nil); refreshSettings(); return
        }
        settingsControls.removeAll()
        let height = min(670,(NSScreen.main?.visibleFrame.height ?? 760)-70)
        let settings = NSWindow(contentRect:NSRect(x:0,y:0,width:530,height:height),
            styleMask:[.titled,.closable,.resizable],backing:.buffered,defer:false)
        settings.title = "Timescreen Settings"
        settings.minSize = NSSize(width:460,height:430)
        settings.isReleasedWhenClosed = false
        let scroll = NSScrollView()
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.drawsBackground = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        settings.contentView!.addSubview(scroll)
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo:settings.contentView!.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo:settings.contentView!.trailingAnchor),
            scroll.topAnchor.constraint(equalTo:settings.contentView!.topAnchor),
            scroll.bottomAnchor.constraint(equalTo:settings.contentView!.bottomAnchor)
        ])
        let document = SettingsDocument()
        document.translatesAutoresizingMaskIntoConstraints = false
        scroll.documentView = document
        document.widthAnchor.constraint(equalTo:scroll.contentView.widthAnchor).isActive = true
        let stack = NSStackView()
        stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        document.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo:document.leadingAnchor,constant:26),
            stack.trailingAnchor.constraint(equalTo:document.trailingAnchor,constant:-26),
            stack.topAnchor.constraint(equalTo:document.topAnchor,constant:24),
            stack.bottomAnchor.constraint(equalTo:document.bottomAnchor,constant:-24)
        ])
        func label(_ text: String, size: CGFloat = 12, weight: NSFont.Weight = .regular) -> NSTextField {
            let label = NSTextField(wrappingLabelWithString:text)
            label.font = .systemFont(ofSize:size,weight:weight)
            label.textColor = size > 12 ? .labelColor : .secondaryLabelColor
            return label
        }
        func heading(_ text: String) {
            let line = NSBox(); line.boxType = .separator
            stack.addArrangedSubview(line)
            line.widthAnchor.constraint(equalTo:stack.widthAnchor).isActive = true
            stack.addArrangedSubview(label(text,size:13,weight:.semibold))
        }
        func toggle(_ key: String, _ title: String) {
            let button = NSButton(checkboxWithTitle:title,target:self,action:#selector(preferenceChanged(_:)))
            button.identifier = NSUserInterfaceItemIdentifier(key)
            settingsControls[key] = button; stack.addArrangedSubview(button)
        }
        stack.addArrangedSubview(label("Timescreen \(NativePolicy.version)",size:22,weight:.semibold))
        stack.addArrangedSubview(label("Your clock, kept current and right where you left it."))
        heading("Updates")
        let check = NSButton(title:"Check for Updates…",target:self,action:#selector(checkUpdates))
        check.bezelStyle = .rounded; updateCheckButton = check
        stack.addArrangedSubview(check)
        toggle("automaticChecks","Automatically check for updates")
        toggle("automaticUpdates","Automatically download and install updates")
        stack.addArrangedSubview(label("Automatic installs finish when Timescreen quits. You can also install and relaunch from the update window."))
        updateStatusLabel = label("")
        stack.addArrangedSubview(updateStatusLabel!)
        heading("Startup and window")
        toggle("login","Launch Timescreen when I log in")
        loginStatusLabel = label("")
        stack.addArrangedSubview(loginStatusLabel!)
        toggle("rememberWindowPosition","Remember window position, size and display")
        toggle("fullscreenOnLaunch","Open in full screen")
        let reset = NSButton(title:"Reset saved window position",target:self,action:#selector(resetWindowPosition))
        reset.bezelStyle = .rounded; stack.addArrangedSubview(reset)
        stack.addArrangedSubview(label("Your previous position is restored on the same display. If that display is disconnected, the window comes back safely on an available screen."))
        heading("Display and access")
        toggle("showMenuBar","Show the menu-bar launcher")
        toggle("alwaysOnTop","Keep the window above other windows")
        toggle("keepAwake","Keep the display awake while Timescreen is visible")
        stack.addArrangedSubview(label("Closing the window keeps the launcher running. Command-Q quits. Keep awake does not prevent manual sleep or closing your Mac."))
        for view in stack.arrangedSubviews where view is NSTextField {
            view.widthAnchor.constraint(equalTo:stack.widthAnchor).isActive = true
        }
        settingsWindow = settings
        refreshSettings()
        settings.center(); settings.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps:true)
    }

    func refreshSettings() {
        guard let updates = updates else { return }
        for (key, button) in settingsControls {
            switch key {
            case "automaticChecks": button.state = updates.updater.automaticallyChecksForUpdates ? .on : .off
            case "automaticUpdates":
                button.state = updates.updater.automaticallyDownloadsUpdates ? .on : .off
                button.isEnabled = updates.updater.automaticallyChecksForUpdates
            case "login":
                let status = SMAppService.mainApp.status
                button.state = status == .enabled || status == .requiresApproval ? .on : .off
            default: button.state = prefs.bool(forKey:key) ? .on : .off
            }
        }
        updateCheckButton?.isEnabled = updates.updater.canCheckForUpdates
        updateStatusLabel?.stringValue = updates.status + "\n" + updates.lastCheckedDescription()
        switch SMAppService.mainApp.status {
        case .enabled: loginStatusLabel?.stringValue = "Enabled in macOS Login Items."
        case .requiresApproval: loginStatusLabel?.stringValue = "Waiting for your approval in System Settings → General → Login Items."
        case .notRegistered: loginStatusLabel?.stringValue = "Off. Move Timescreen into Applications before enabling this."
        case .notFound: loginStatusLabel?.stringValue = "Install Timescreen in Applications, then enable launch at login."
        @unknown default: loginStatusLabel?.stringValue = "You can manage this in System Settings → General → Login Items."
        }
    }

    @objc func preferenceChanged(_ sender: NSButton) {
        guard let key = sender.identifier?.rawValue else { return }
        let enabled = sender.state == .on
        switch key {
        case "automaticChecks": updates.updater.automaticallyChecksForUpdates = enabled
        case "automaticUpdates": updates.updater.automaticallyDownloadsUpdates = enabled
        case "login":
            do {
                if enabled { try SMAppService.mainApp.register() }
                else { try SMAppService.mainApp.unregister() }
                if SMAppService.mainApp.status == .requiresApproval { SMAppService.openSystemSettingsLoginItems() }
            } catch {
                let alert = NSAlert()
                alert.messageText = "Login launch needs your attention"
                alert.informativeText = "Install Timescreen in Applications first, then try again. You can also manage it in System Settings → General → Login Items."
                alert.runModal()
            }
        default:
            prefs.set(enabled,forKey:key)
            if key == "showMenuBar" { configureStatusItem() }
            if key == "rememberWindowPosition", enabled { saveWindowPosition() }
            applyWindowPreferences(); updateAwake()
        }
        refreshSettings()
    }

    @objc func resetWindowPosition() {
        placementStore.reset()
        if !isFullscreen, let screen = NSScreen.main {
            let size = NSSize(width:1120,height:760)
            let frame = WindowPlacement.constrained(CGRect(x:screen.visibleFrame.midX-size.width/2,
                y:screen.visibleFrame.midY-size.height/2,width:size.width,height:size.height),to:screen.visibleFrame)
            window.setFrame(frame,display:true)
            saveWindowPosition()
        }
    }
}
