//
//  BitBoxAppApp.swift
//  BitBoxApp
//
//  Created by dev on 05.12.23.
//

import SwiftUI
import Mobileserver
import LocalAuthentication

func authenticateUser(completion: @escaping (Bool) -> Void) {
    let context = LAContext()
    var error: NSError?

    if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
        // TODO: localize the reason string.
        let reason = "Authentication required"
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authenticationError in
            DispatchQueue.main.async {
                completion(success)
            }
        }
    } else {
        // Biometric authentication not available
        DispatchQueue.main.async {
            completion(false)
        }
    }
}

protocol MessageHandlersProtocol {
    func callResponseHandler(queryID: Int, response: String)
    func pushNotificationHandler(msg: String)
}

protocol SetMessageHandlersProtocol {
    func setMessageHandlers(handlers: MessageHandlersProtocol)
}

class GoEnvironment: NSObject, MobileserverGoEnvironmentInterfaceProtocol, UIDocumentInteractionControllerDelegate {
    private let bluetoothManager: BluetoothManager

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
        authenticateUser { success in
            // TODO: enabling auth but entering wrong passcode does not remove auth screen
            MobileserverAuthResult(success)
        }
    }

    func detectDarkTheme() -> Bool {
        return UIScreen.main.traitCollection.userInterfaceStyle == .dark
    }

    func deviceInfo() -> MobileserverGoDeviceInfoInterfaceProtocol? {
        if !bluetoothManager.isConnected() {
            return nil
        }
       
        let productStr = bluetoothManager.productStr();
        if productStr == "" || productStr == "no connection" {
            // Not ready or explicitly not connected (waiting for the device to enter
            // firmware or bootloader)
            return nil
        }
        return BluetoothDeviceInfo(bluetoothManager: bluetoothManager)
    }

    func nativeLocale() -> String {
        return Locale.current.identifier
    }

    func notifyUser(_ p0: String?) {
    }

    func onAuthSettingChanged(_ p0: Bool) {
        // TODO: hide app window contents in app switcher, maybe always not just when auth is on.
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
            if url.isFileURL {
                // Local file path, use UIDocumentInteractionController
                if let rootViewController = self.getRootViewController() {
                    let activityViewController = UIActivityViewController(activityItems: [url], applicationActivities: nil)
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

class GoAPI: NSObject, MobileserverGoAPIInterfaceProtocol, SetMessageHandlersProtocol {
    var handlers: MessageHandlersProtocol?

    func pushNotify(_ msg: String?) {
        self.handlers?.pushNotificationHandler(msg: msg!)
    }

    func respond(_ queryID: Int, response: String?) {
        self.handlers?.callResponseHandler(queryID: queryID, response: response!)
    }

    func setMessageHandlers(handlers: MessageHandlersProtocol) {
        self.handlers = handlers
    }
}

@main
struct BitBoxAppApp: App {
    @StateObject private var bluetoothManager = BluetoothManager()

    var body: some Scene {
        WindowGroup {
            GridLayout(alignment: .leading) {
                let goAPI = GoAPI()
                WebView(setHandlers: goAPI)
                    .edgesIgnoringSafeArea(.all)
                    .onAppear {
                        setupGoAPI(goAPI: goAPI)
                    }
                    .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                        MobileserverManualReconnect()
                        MobileserverTriggerAuth()
                    }
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
    }
}
