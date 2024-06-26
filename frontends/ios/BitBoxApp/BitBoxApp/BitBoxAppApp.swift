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

class GoEnvironment: NSObject, MobileserverGoEnvironmentInterfaceProtocol {
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
        // Return an instance conforming to GoserverGoDeviceInfoInterface
        // Replace 'GoDeviceInfo' with your implementation
        return nil
    }

    func nativeLocale() -> String {
        return Locale.current.identifier
    }

    func notifyUser(_ p0: String?) {
    }

    func onAuthSettingChanged(_ p0: Bool) {
        // TODO: hide app window contents in app switcher, maybe always not just when auth is on.
    }

    func setDarkTheme(_ p0: Bool) {
    }

    func systemOpen(_ url: String?) throws {
        guard let url = URL(string: url!) else { return }
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
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
        let goEnvironment = GoEnvironment()
       
        MobileserverServe(appSupportDirectory.path, goEnvironment, goAPI)
    }
}
