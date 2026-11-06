//
//  BitBoxAppApp.swift
//  BitBoxApp
//
//  Created by dev on 05.12.23.
//

import SwiftUI
import Foundation
import UIKit
import Mobileserver
import LocalAuthentication
import Network

protocol MessageHandlersProtocol {
    func callResponseHandler(queryID: Int, response: String)
    func pushNotificationHandler(msg: String)
}

protocol SetMessageHandlersProtocol {
    func setMessageHandlers(handlers: MessageHandlersProtocol)
}

class GoEnvironment: NSObject, MobileserverGoEnvironmentInterfaceProtocol, UIDocumentInteractionControllerDelegate {
    private let bluetoothManager: BluetoothManager
    private let lightningEncryptionHelper = LightningEncryptionHelper()

    init(bluetoothManager: BluetoothManager) {
        self.bluetoothManager = bluetoothManager
    }

    func getSaveFilename(_ fileName: String?) -> String {
        let tempDirectory = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        // fileName cannot be nil this is called by Go and Go strings cannot be nil/null.
        let fileURL = tempDirectory.appendingPathComponent(fileName!)
        return fileURL.path
    }

    func auth() {
        DispatchQueue.main.async {
            AppPrivacyScreen.shared.authenticationStarted()
        }
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
            // TODO: localize the reason string.
            let reason = "Authentication required"
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authenticationError in
                DispatchQueue.main.async {
                    if success {
                        MobileserverAuthResult(MobileserverAuthResultOk);
                    } else {
                        if let laError = authenticationError as? LAError,
                           laError.code == .userCancel {
                            MobileserverAuthResult(MobileserverAuthResultCancel);
                        } else {
                            MobileserverAuthResult(MobileserverAuthResultErr);
                        }
                    }
                    AppPrivacyScreen.shared.authenticationFinished(success: success)
                }
            }
        } else {
            // Biometric authentication not available
            DispatchQueue.main.async {
                MobileserverAuthResult(MobileserverAuthResultMissing);
                AppPrivacyScreen.shared.authenticationFinished(success: false)
            }
        }
    }

    func detectDarkTheme() -> Bool {
        return UIScreen.main.traitCollection.userInterfaceStyle == .dark
    }

    func deviceInfo() -> MobileserverGoDeviceInfoInterfaceProtocol? {
        if !bluetoothManager.isConnected() {
            return nil
        }

        let productInfo = bluetoothManager.parseProduct();
        guard let productInfo = productInfo else {
            // Not ready or explicitly not connected (waiting for the device to enter
            // firmware or bootloader)
            return nil
        }
        return BluetoothDeviceInfo(bluetoothManager: bluetoothManager, productInfo: productInfo)
    }

    func nativeLocale() -> String {
        return Locale.current.identifier
    }

    func userAgentPlatform() -> String {
        switch UIDevice.current.userInterfaceIdiom {
        case .phone:
            return "iphone"
        case .pad:
            return "ipad"
        default:
            return "ios"
        }
    }

    func notifyUser(_ p0: String?) {
    }

    func onAuthSettingChanged(_ enabled: Bool) {
        DispatchQueue.main.async {
            AppPrivacyScreen.shared.authenticationEnabled = enabled
        }
    }

    func canEncryptLightningMnemonic() -> Bool {
        true
    }

    func storeLightningEncryptionKey(_ accountCode: String?, p1 encryptionKey: String?) throws {
        try lightningEncryptionHelper.storeKey(accountCode: accountCode, encryptionKey: encryptionKey)
    }

    func loadLightningEncryptionKey(_ accountCode: String?, error: NSErrorPointer) -> String {
        do {
            return try lightningEncryptionHelper.loadKey(accountCode: accountCode)
        } catch let loadError as NSError {
            error?.pointee = loadError
            return ""
        }
    }

    func deleteLightningEncryptionKey(_ accountCode: String?) throws {
        try lightningEncryptionHelper.deleteKey(accountCode: accountCode)
    }

    func bluetoothConnect(_ identifier: String?) {
        guard let identifier = identifier else {
            return
        }
        guard let uuid = UUID(uuidString: identifier) else {
            return
        }
        bluetoothManager.connect(to: uuid)
    }

    func setDarkTheme(_ p0: Bool) {
        DispatchQueue.main.async {
            AppTheme.shared.isDark = p0
        }
    }

    // Helper method to get the root view controller
    private func getRootViewController() -> UIViewController? {
        guard let scene = UIApplication.shared.connectedScenes
                .filter({ $0.activationState == .foregroundActive })
                .first as? UIWindowScene else {
            return nil
        }

        return scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
    }

    func systemOpen(_ urlString: String?) throws {
        guard let urlString = urlString else { return }
        // Check if it's a local file path (not a URL)
        var url: URL
        if urlString.hasPrefix("/") {
            // This is a local file path, construct a file URL
            url = URL(fileURLWithPath: urlString)
        } else if let potentialURL = URL(string: urlString), potentialURL.scheme != nil {
            // This is already a valid URL with a scheme
            url = potentialURL
        } else {
            // Invalid URL or path
            return
        }
        // Ensure we run on the main thread
        DispatchQueue.main.async {
            if urlString == "app-settings:" {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    // opens app settings page in the system settings
                    UIApplication.shared.open(url)
                }
                return
            }

            if url.isFileURL {
                // Local file path, use UIDocumentInteractionController
                if let rootViewController = self.getRootViewController() {
                    let activityViewController = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                    if let popover = activityViewController.popoverPresentationController {
                        popover.sourceView = rootViewController.view
                        popover.sourceRect = CGRect(x: rootViewController.view.bounds.midX, y: rootViewController.view.bounds.midY, width: 0, height: 0)
                        popover.permittedArrowDirections = []
                    }
                    rootViewController.present(activityViewController, animated: true, completion: nil)
                }
            } else {
                if UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url)
                }
            }
        }
    }

    func usingMobileData() -> Bool {
        // Implement logic to check if using mobile data
        // Example: return a dummy value
        return false // Replace with actual logic
    }
}

class GoAPI: NSObject, ObservableObject, MobileserverGoAPIInterfaceProtocol, SetMessageHandlersProtocol {
    var handlers: MessageHandlersProtocol?
    #if !TARGET_TESTNET
    private let lightningWidgetSync = LightningWidgetSync()
    #endif

    func pushNotify(_ msg: String?) {
        #if !TARGET_TESTNET
        if let msg {
            DispatchQueue.main.async {
                self.lightningWidgetSync.handleEvent(msg)
            }
        }
        #endif
        self.handlers?.pushNotificationHandler(msg: msg!)
    }

    func respond(_ queryID: Int, response: String?) {
        #if !TARGET_TESTNET
        // Native widget requests use negative IDs; web requests start at 1.
        if queryID < 0 {
            if let response {
                DispatchQueue.main.async {
                    self.lightningWidgetSync.handleResponse(queryID: queryID, response: response)
                }
            }
            return
        }
        #endif
        self.handlers?.callResponseHandler(queryID: queryID, response: response!)
    }

    func syncLightningWidget() {
        #if !TARGET_TESTNET
        DispatchQueue.main.async {
            self.lightningWidgetSync.sync()
        }
        #endif
    }

    func setMessageHandlers(handlers: MessageHandlersProtocol) {
        self.handlers = handlers
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        AppPrivacyScreen.shared.startObserving()
        return true
    }

    func application(
        _ application: UIApplication,
        shouldAllowExtensionPointIdentifier extensionPointIdentifier: UIApplication.ExtensionPointIdentifier
    ) -> Bool {
        // Revealed passwords use text inputs, which otherwise allow third-party keyboards.
        extensionPointIdentifier != .keyboard
    }
}

/// Covers the entire scene, including presented sheets, before iOS captures its preview.
@MainActor
final class AppPrivacyScreen: NSObject {
    static let shared = AppPrivacyScreen()

    var authenticationEnabled = true {
        didSet {
            if !authenticationEnabled {
                authenticationFinished(success: true)
            }
        }
    }
    private var waitingForAuthentication = false
    private var authenticationScreenVisible = false
    private var windows: [UIWindowScene: UIWindow] = [:]

    func startObserving(center: NotificationCenter = .default) {
        center.addObserver(self, selector: #selector(sceneWillDeactivate), name: UIScene.willDeactivateNotification, object: nil)
        center.addObserver(self, selector: #selector(sceneDidEnterBackground), name: UIScene.didEnterBackgroundNotification, object: nil)
        center.addObserver(self, selector: #selector(sceneWillEnterForeground), name: UIScene.willEnterForegroundNotification, object: nil)
        center.addObserver(self, selector: #selector(sceneDidActivate), name: UIScene.didActivateNotification, object: nil)
        center.addObserver(self, selector: #selector(sceneDidDisconnect), name: UIScene.didDisconnectNotification, object: nil)
    }

    @objc private func sceneWillDeactivate(_ notification: Notification) {
        guard let scene = notification.object as? UIWindowScene else { return }
        cover(scene, animated: true)
    }

    @objc private func sceneDidEnterBackground(_ notification: Notification) {
        guard let scene = notification.object as? UIWindowScene else { return }
        // iOS captures the preview immediately: finish any fade before returning.
        cover(scene)
    }

    @objc private func sceneWillEnterForeground(_ notification: Notification) {
        guard let scene = notification.object as? UIWindowScene else { return }
        // A cancelled authentication leaves the web lock visible with a retry button.
        waitingForAuthentication = authenticationEnabled && !authenticationScreenVisible
        cover(scene)
    }

    @objc private func sceneDidActivate(_ notification: Notification) {
        guard let scene = notification.object as? UIWindowScene else { return }
        revealIfReady(scene)
    }

    @objc private func sceneDidDisconnect(_ notification: Notification) {
        guard let scene = notification.object as? UIWindowScene else { return }
        windows.removeValue(forKey: scene)?.isHidden = true
    }

    func cover(_ scene: UIWindowScene, animated: Bool = false) {
        let shouldAnimate = animated && !UIAccessibility.isReduceMotionEnabled
        let window: UIWindow
        if let existing = windows[scene] {
            window = existing
        } else {
            window = UIWindow(windowScene: scene)
            window.windowLevel = .alert + 1
            // Reuse the launch storyboard so the logo, colors and layout stay identical.
            window.rootViewController = UIStoryboard(name: "Launch Screen", bundle: nil).instantiateInitialViewController()
            window.backgroundColor = .systemBackground
            window.accessibilityIdentifier = "app-privacy-screen"
            window.alpha = shouldAnimate ? 0 : 1
            windows[scene] = window
            // Do not make this window key: system authentication must retain its focus.
            window.isHidden = false
            window.layoutIfNeeded()
        }
        if shouldAnimate {
            UIView.animate(withDuration: 0.15, delay: 0, options: [.beginFromCurrentState, .curveEaseInOut, .allowUserInteraction]) {
                window.alpha = 1
            }
        } else {
            UIView.performWithoutAnimation {
                window.alpha = 1
                window.layer.removeAllAnimations()
            }
        }
    }

    func authenticationStarted() {
        authenticationScreenVisible = true
    }

    func authenticationFinished(success: Bool) {
        authenticationScreenVisible = !success
        waitingForAuthentication = false
        for scene in Array(windows.keys) {
            revealIfReady(scene)
        }
    }

    private func revealIfReady(_ scene: UIWindowScene) {
        guard scene.activationState == .foregroundActive, !waitingForAuthentication,
              let window = windows[scene], window.alpha != 0 else { return }
        // On failure or cancellation the existing web authentication screen provides retry.
        UIView.animate(
            withDuration: UIAccessibility.isReduceMotionEnabled ? 0 : 0.2,
            delay: 0,
            options: [.beginFromCurrentState, .curveEaseInOut, .allowUserInteraction]
        ) {
            window.alpha = 0
        } completion: { [weak self] finished in
            // A new background transition can interrupt this fade and reuse the same cover.
            guard let self, finished, window.alpha == 0,
                  scene.activationState == .foregroundActive, !self.waitingForAuthentication,
                  self.windows[scene] === window else { return }
            self.windows.removeValue(forKey: scene)?.isHidden = true
        }
    }
}

@main
struct BitBoxAppApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var bluetoothManager = BluetoothManager()
    @StateObject private var goAPI = GoAPI()
    private let widgetSync = WidgetAppGroupSync()

    var body: some Scene {
        WindowGroup {
            GridLayout(alignment: .leading) {
                ZStack(alignment: .top) {
                WebView(setHandlers: goAPI)
                    .edgesIgnoringSafeArea(.all)
                    .onAppear {
                        setupGoAPI(goAPI: goAPI)
                        goAPI.syncLightningWidget()
                        MobileserverSetOnline(NetworkMonitor.shared.isOnline())
                        Task.detached(priority: .utility) {
                            widgetSync.sync(forceReload: true)
                        }
                    }
                    .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                        MobileserverManualReconnect()
                        MobileserverTriggerAuth()
                        goAPI.syncLightningWidget()
                        Task.detached(priority: .utility) {
                            widgetSync.sync(forceReload: true)
                        }
                    }
                    .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                        var bgTask: UIBackgroundTaskIdentifier = .invalid
                        bgTask = UIApplication.shared.beginBackgroundTask(withName: "WidgetSync") {
                            if bgTask != .invalid {
                                UIApplication.shared.endBackgroundTask(bgTask)
                                bgTask = .invalid
                            }
                        }
                        Task.detached(priority: .userInitiated) {
                            widgetSync.sync(forceReload: true)
                            await MainActor.run {
                                if bgTask != .invalid {
                                    UIApplication.shared.endBackgroundTask(bgTask)
                                    bgTask = .invalid
                                }
                            }
                        }
                    }
                StatusBarCover()
                }
            }
            .onOpenURL { url in
                MobileserverHandleURI(url.absoluteString)
            }
        }
    }

    func setupGoAPI(goAPI: MobileserverGoAPIInterfaceProtocol) {
        let appSupportDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        do {
            try FileManager.default.createDirectory(at: appSupportDirectory, withIntermediateDirectories: true)
        } catch {
            print("Could not create Application Support directory: \(error)")
        }
        let goEnvironment = GoEnvironment(bluetoothManager: bluetoothManager)
        #if TARGET_TESTNET
        let testnet = true;
        #else
        let testnet = false;
        #endif
        MobileserverServe(appSupportDirectory.path, testnet, goEnvironment, goAPI)
        // Re-apply this on every backend start, as these paths may be created
        // or replaced by the backend after a previous backup exclusion.
        excludeBackendPathsFromBackup(in: appSupportDirectory)
    }

    private func excludeBackendPathsFromBackup(in appSupportDirectory: URL) {
        excludeFromBackup(appSupportDirectory.appendingPathComponent("lightning.json"))
        excludeFromBackup(appSupportDirectory.appendingPathComponent("lightning", isDirectory: true))
        excludeFromBackup(appSupportDirectory.appendingPathComponent("cache", isDirectory: true))
    }

    private func excludeFromBackup(_ url: URL) {
        do {
            try (url as NSURL).setResourceValue(true, forKey: URLResourceKey.isExcludedFromBackupKey)
        } catch {
            print("Could not exclude \(url.lastPathComponent) from backup: \(error)")
        }
    }
}

/// only visible while the keyboard is on screen.
private struct StatusBarCover: View {
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var keyboard = KeyboardObserver()
    @ObservedObject private var theme = AppTheme.shared

    // app settings win, OS fallback.
    private var useDark: Bool {
        theme.isDark ?? (colorScheme == .dark)
    }

    var body: some View {
        GeometryReader { geometry in
            if keyboard.isVisible && geometry.size.width < 1200 {
                let safeTop = geometry.safeAreaInsets.top
                Color(uiColor: useDark
                      ? UIColor(red: 0x1D/255, green: 0x1D/255, blue: 0x1B/255, alpha: 1)  // #1D1D1B
                      : UIColor(red: 0xF5/255, green: 0xF5/255, blue: 0xF5/255, alpha: 1)) // #F5F5F5
                    .frame(width: geometry.size.width, height: safeTop)
                    .ignoresSafeArea(edges: .top)
            }
        }
        .allowsHitTesting(false)
    }
}

/// Dark-mode flag comes from web. 
// `nil` until set, then fallbacks to OS.
final class AppTheme: ObservableObject {
    static let shared = AppTheme()
    @Published var isDark: Bool? = nil
}

private final class KeyboardObserver: ObservableObject {
    @Published var isVisible = false

    private var tokens: [NSObjectProtocol] = []

    init() {
        let nc = NotificationCenter.default
        tokens.append(nc.addObserver(
            forName: UIResponder.keyboardWillShowNotification,
            object: nil, queue: .main
        ) { [weak self] _ in self?.isVisible = true })

        tokens.append(nc.addObserver(
            forName: UIResponder.keyboardWillHideNotification,
            object: nil, queue: .main
        ) { [weak self] _ in self?.isVisible = false })
    }

    deinit {
        tokens.forEach { NotificationCenter.default.removeObserver($0) }
    }
}
