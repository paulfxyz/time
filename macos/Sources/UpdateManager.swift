import AppKit
import Sparkle

final class UpdateManager: NSObject, SPUUpdaterDelegate {
    private(set) var controller: SPUStandardUpdaterController!
    private(set) var status = "Updates are verified with a pinned signing key."
    var onChange: (() -> Void)?
    var onWillRelaunch: (() -> Void)?
    private var observations: [NSKeyValueObservation] = []

    override init() {
        super.init()
        controller = SPUStandardUpdaterController(startingUpdater:false,updaterDelegate:self,userDriverDelegate:nil)
        observations = [
            controller.updater.observe(\.canCheckForUpdates) { [weak self] _,_ in
                DispatchQueue.main.async { self?.onChange?() }
            },
            controller.updater.observe(\.automaticallyChecksForUpdates) { [weak self] _,_ in
                DispatchQueue.main.async { self?.onChange?() }
            },
            controller.updater.observe(\.automaticallyDownloadsUpdates) { [weak self] _,_ in
                DispatchQueue.main.async { self?.onChange?() }
            }
        ]
    }
    var updater: SPUUpdater { controller.updater }
    func start() { controller.startUpdater() }
    func checkNow() {
        guard updater.canCheckForUpdates else { return }
        status = "Checking for updates…"
        onChange?()
        controller.checkForUpdates(nil)
    }
    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        status = "Version \(item.displayVersionString) is available."
        onChange?()
    }
    func updaterDidNotFindUpdate(_ updater: SPUUpdater) {
        status = "You're up to date."
        onChange?()
    }
    func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        status = "Could not check for updates. You can try again."
        onChange?()
    }
    func updaterWillRelaunchApplication(_ updater: SPUUpdater) { onWillRelaunch?() }

    func lastCheckedDescription() -> String {
        guard let date = updater.lastUpdateCheckDate else { return "Not checked yet." }
        return "Last checked \(DateFormatter.localizedString(from:date,dateStyle:.short,timeStyle:.short))."
    }
}
