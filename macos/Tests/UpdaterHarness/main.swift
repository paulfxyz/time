// CI-only host for a real Sparkle download/extract/replace cycle. This binary is
// never included in Timescreen. It can update only its disposable fixture bundle.
import AppKit
import Sparkle

final class Driver: NSObject, SPUUserDriver {
    let events: URL
    init(events: URL) { self.events = events }
    func log(_ event: String) {
        let previous = (try? String(contentsOf:events)) ?? ""
        try? (previous+event+"\n").write(to:events,atomically:true,encoding:.utf8)
        print(event); fflush(stdout)
    }
    func show(_ error: Error) {
        let value = error as NSError
        log("error:\(value.domain):\(value.code):\(value.localizedDescription)")
        DispatchQueue.main.asyncAfter(deadline:.now()+0.1) { exit(2) }
    }
    func showUpdatePermissionRequest(_ request: SPUUpdatePermissionRequest, reply: @escaping (SUUpdatePermissionResponse) -> Void) {
        reply(SUUpdatePermissionResponse(automaticUpdateChecks:false,sendSystemProfile:false))
    }
    func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) { log("checking") }
    func showUpdateFound(with appcastItem: SUAppcastItem, state: SPUUserUpdateState,
                         reply: @escaping (SPUUserUpdateChoice) -> Void) {
        log("found:\(appcastItem.versionString)"); reply(.install)
    }
    func showUpdateReleaseNotes(with downloadData: SPUDownloadData) {}
    func showUpdateReleaseNotesFailedToDownloadWithError(_ error: Error) { show(error) }
    func showUpdateNotFoundWithError(_ error: Error, acknowledgement: @escaping () -> Void) {
        log("not-found"); acknowledgement(); DispatchQueue.main.async { exit(0) }
    }
    func showUpdaterError(_ error: Error, acknowledgement: @escaping () -> Void) { acknowledgement(); show(error) }
    func showDownloadInitiated(cancellation: @escaping () -> Void) { log("download-started") }
    func showDownloadDidReceiveExpectedContentLength(_ expectedContentLength: UInt64) {}
    func showDownloadDidReceiveData(ofLength length: UInt64) {}
    func showDownloadDidStartExtractingUpdate() { log("extracting") }
    func showExtractionReceivedProgress(_ progress: Double) {}
    func showReady(toInstallAndRelaunch reply: @escaping (SPUUserUpdateChoice) -> Void) {
        log("ready-to-install"); reply(.install)
    }
    func showInstallingUpdate(withApplicationTerminated applicationTerminated: Bool,
                              retryTerminatingApplication: @escaping () -> Void) { log("installing") }
    func showUpdateInstalledAndRelaunched(_ relaunched: Bool, acknowledgement: @escaping () -> Void) {
        log("installed"); acknowledgement()
    }
    func dismissUpdateInstallation() {}
}

final class Harness: NSObject, NSApplicationDelegate, SPUUpdaterDelegate {
    var updater: SPUUpdater!
    var driver: Driver!
    let root = Bundle.main.bundleURL.deletingLastPathComponent()
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        driver = Driver(events:root.appendingPathComponent("events.txt"))
        let version = Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") as? String ?? ""
        if version == "2" {
            try? "updated-and-relaunched".write(to:root.appendingPathComponent("installed.txt"),atomically:true,encoding:.utf8)
            exit(0)
        }
        updater = SPUUpdater(hostBundle:.main,applicationBundle:.main,userDriver:driver,delegate:self)
        do { try updater.start(); updater.checkForUpdates() }
        catch { driver.show(error) }
        DispatchQueue.main.asyncAfter(deadline:.now()+65) { [weak self] in self?.driver.log("timeout"); exit(3) }
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply { .terminateNow }
}
let app = NSApplication.shared
let delegate = Harness()
app.delegate = delegate
app.run()
