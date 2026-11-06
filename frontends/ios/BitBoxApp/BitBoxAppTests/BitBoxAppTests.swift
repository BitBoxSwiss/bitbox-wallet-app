//
//  BitBoxAppTests.swift
//  BitBoxAppTests
//
//  Created by dev on 05.12.23.
//

import XCTest
import Security
import UIKit
import CoreImage
@testable import BitBoxApp

private final class InMemoryLightningKeychainClient: LightningKeychainClient {
    private var items: [String: Data] = [:]

    func update(query: [String: Any], attributes: [String: Any]) -> OSStatus {
        guard let key = itemKey(query: query), items[key] != nil else {
            return errSecItemNotFound
        }
        guard let data = attributes[kSecValueData as String] as? Data else {
            return errSecParam
        }
        items[key] = data
        return errSecSuccess
    }

    func add(query: [String: Any]) -> OSStatus {
        guard let key = itemKey(query: query), let data = query[kSecValueData as String] as? Data else {
            return errSecParam
        }
        guard items[key] == nil else {
            return errSecDuplicateItem
        }
        items[key] = data
        return errSecSuccess
    }

    func copyMatching(query: [String: Any]) -> (status: OSStatus, data: Data?) {
        guard let key = itemKey(query: query), let data = items[key] else {
            return (errSecItemNotFound, nil)
        }
        return (errSecSuccess, data)
    }

    func delete(query: [String: Any]) -> OSStatus {
        guard let key = itemKey(query: query), items.removeValue(forKey: key) != nil else {
            return errSecItemNotFound
        }
        return errSecSuccess
    }

    private func itemKey(query: [String: Any]) -> String? {
        guard
            let service = query[kSecAttrService as String] as? String,
            let account = query[kSecAttrAccount as String] as? String
        else {
            return nil
        }
        return "\(service):\(account)"
    }
}

final class LightningWidgetSyncTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!
    private var sync: LightningWidgetSync!
    private var requests: [(id: Int, query: String)] = []
    private var reloads = 0

    override func setUpWithError() throws {
        suiteName = "swiss.bitbox.BitBoxAppTests.widget.\(UUID().uuidString)"
        defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        sync = LightningWidgetSync(
            defaults: defaults,
            backendCall: { self.requests.append(($0, $1)) },
            reload: { self.reloads += 1 }
        )
    }

    override func tearDownWithError() throws {
        sync = nil
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
    }

    private func respond(_ response: String) throws {
        let request = try XCTUnwrap(requests.last)
        sync.handleResponse(queryID: request.id, response: response)
    }

    private func loadAddress() throws {
        sync.sync()
        try respond(#"{"code":"wallet-a"}"#)
        try respond(#"{"success":true,"data":"alice@bitbox.cash"}"#)
    }

    // Launch loads the address without opening Receive and leaves all price widget settings alone.
    func testInitialSyncPreservesPriceWidget() throws {
        defaults.set("CHF", forKey: WidgetShared.Keys.sharedCurrency)
        defaults.set(["btc", "eth"], forKey: WidgetShared.Keys.sharedCoins)
        defaults.set(1, forKey: WidgetShared.Keys.selectedCoinIndex)
        try loadAddress()
        try loadAddress()

        XCTAssertEqual(defaults.string(forKey: WidgetShared.Keys.lightningAddress), "alice@bitbox.cash")
        XCTAssertEqual(reloads, 1)
        XCTAssertTrue(requests.allSatisfy { $0.id < 0 })
        let query = try JSONDecoder().decode([String: String].self, from: Data(requests.last!.query.utf8))
        XCTAssertEqual(query, ["method": "GET", "endpoint": "lightning/address"])
        XCTAssertEqual(defaults.string(forKey: WidgetShared.Keys.sharedCurrency), "CHF")
        XCTAssertEqual(defaults.stringArray(forKey: WidgetShared.Keys.sharedCoins), ["btc", "eth"])
        XCTAssertEqual(defaults.integer(forKey: WidgetShared.Keys.selectedCoinIndex), 1)
    }

    // A rename invalidates the outstanding address read, even if it finishes after the new one.
    func testAddressChangeIgnoresStaleResponse() throws {
        try loadAddress()
        sync.sync()
        try respond(#"{"code":"wallet-a"}"#)
        let oldID = try XCTUnwrap(requests.last?.id)
        sync.handleEvent(#"{"subject":"lightning/address","action":"replace","object":"bob@bitbox.cash"}"#)
        try respond(#"{"code":"wallet-a"}"#)
        try respond(#"{"success":true,"data":"bob@bitbox.cash"}"#)
        sync.handleResponse(queryID: oldID, response: #"{"success":true,"data":"alice@bitbox.cash"}"#)

        XCTAssertEqual(defaults.string(forKey: WidgetShared.Keys.lightningAddress), "bob@bitbox.cash")
    }

    // Removing the wallet clears its QR immediately and a late response cannot restore it.
    func testAccountRemovalClearsAddress() throws {
        try loadAddress()
        sync.sync()
        try respond(#"{"code":"wallet-a"}"#)
        let oldID = try XCTUnwrap(requests.last?.id)
        sync.handleEvent(#"{"subject":"lightning/account","action":"reload"}"#)
        XCTAssertNil(defaults.string(forKey: WidgetShared.Keys.lightningAddress))
        try respond("null")
        sync.handleResponse(queryID: oldID, response: #"{"success":true,"data":"alice@bitbox.cash"}"#)

        XCTAssertNil(defaults.string(forKey: WidgetShared.Keys.lightningAddress))
        XCTAssertNil(defaults.string(forKey: WidgetShared.Keys.lightningAccount))
    }

    // A different wallet detected on launch must not inherit the previous wallet's cached QR.
    func testAccountReplacementClearsCachedAddress() throws {
        try loadAddress()
        sync.sync()
        try respond(#"{"code":"wallet-b"}"#)
        try respond(#"{"success":false,"errorMessage":"Lightning not initialized"}"#)

        XCTAssertNil(defaults.string(forKey: WidgetShared.Keys.lightningAddress))
        XCTAssertEqual(defaults.string(forKey: WidgetShared.Keys.lightningAccount), "wallet-b")
    }

    // Temporary SDK failures preserve an offline QR, but an authoritative null removes it.
    func testUnavailableSDKPreservesAddressUntilSuccessfulRefresh() throws {
        try loadAddress()
        sync.handleEvent(#"{"subject":"lightning/sdk-status","object":"failed"}"#)
        try respond(#"{"code":"wallet-a"}"#)
        try respond(#"{"success":false,"errorMessage":"Lightning not initialized"}"#)
        XCTAssertEqual(defaults.string(forKey: WidgetShared.Keys.lightningAddress), "alice@bitbox.cash")

        sync.handleEvent(#"{"subject":"lightning/sdk-status","object":"ready"}"#)
        try respond(#"{"code":"wallet-a"}"#)
        try respond(#"{"success":true,"data":null}"#)
        XCTAssertNil(defaults.string(forKey: WidgetShared.Keys.lightningAddress))
    }

    // Both typical and maximum-length addresses must round-trip through the actual QR encoder.
    func testQRCodeEncodesReceivingAddress() throws {
        let detector = try XCTUnwrap(CIDetector(ofType: CIDetectorTypeQRCode, context: CIContext(), options: [CIDetectorAccuracy: CIDetectorAccuracyHigh]))
        for address in ["alice@bitbox.cash", String(repeating: "a", count: 64) + "@bitbox.cash"] {
            let image = try XCTUnwrap(LightningAddressQRCode.image(for: address))
            let codes = detector.features(in: CIImage(cgImage: image)).compactMap { $0 as? CIQRCodeFeature }
            XCTAssertEqual(codes.map(\.messageString), [address])
        }
        XCTAssertNil(LightningAddressQRCode.image(for: ""))
    }
}

final class BitBoxAppTests: XCTestCase {
    private var helper: LightningEncryptionHelper!

    // Repeated lifecycle events must keep one opaque launch-screen cover above native sheets.
    @MainActor
    func testPrivacyScreenReusesLaunchScreenWithoutTakingFocus() throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let keyWindow = scene.windows.first(where: { $0.isKeyWindow })
        let privacy = AppPrivacyScreen()
        let center = NotificationCenter()
        privacy.startObserving(center: center)
        defer { center.post(name: UIScene.didDisconnectNotification, object: scene) }

        privacy.cover(scene)
        privacy.cover(scene)

        let covers = scene.windows.filter { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden }
        let cover = try XCTUnwrap(covers.first)
        XCTAssertEqual(covers.count, 1)
        XCTAssertFalse(cover.isKeyWindow)
        XCTAssertTrue(scene.windows.first(where: { $0.isKeyWindow }) === keyWindow)
        XCTAssertGreaterThan(cover.windowLevel, .alert)
        XCTAssertEqual(cover.bounds.size, scene.coordinateSpace.bounds.size)
        let view = try XCTUnwrap(cover.rootViewController?.view)
        XCTAssertTrue(view.isOpaque)
        XCTAssertEqual(view.backgroundColor, .systemBackground)
        let logo = try XCTUnwrap(view.subviews.first as? UIImageView)
        XCTAssertEqual(logo.bounds.size, CGSize(width: 68, height: 81))
        XCTAssertEqual(logo.center.x, view.bounds.midX, accuracy: 0.5)
        XCTAssertEqual(logo.center.y, view.bounds.midY, accuracy: 0.5)
    }

    // Returning from the background must not uncover the wallet before authentication completes.
    @MainActor
    func testPrivacyScreenWaitsForAuthenticationOnReturn() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        XCTAssertEqual(scene.activationState, .foregroundActive)
        let privacy = AppPrivacyScreen()
        let center = NotificationCenter()
        privacy.startObserving(center: center)
        defer { center.post(name: UIScene.didDisconnectNotification, object: scene) }

        center.post(name: UIScene.willEnterForegroundNotification, object: scene)
        center.post(name: UIScene.didActivateNotification, object: scene)
        XCTAssertTrue(scene.windows.contains { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden })

        privacy.authenticationStarted()
        privacy.authenticationFinished(success: true)
        await waitForPrivacyScreenToHide(in: scene)
        XCTAssertFalse(scene.windows.contains { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden })
    }

    // Cancellation leaves the web lock available for retry, including after another app switch.
    @MainActor
    func testPrivacyScreenAllowsRetryAfterCancelledAuthentication() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let privacy = AppPrivacyScreen()
        let center = NotificationCenter()
        privacy.startObserving(center: center)
        defer { center.post(name: UIScene.didDisconnectNotification, object: scene) }

        center.post(name: UIScene.willEnterForegroundNotification, object: scene)
        privacy.authenticationStarted()
        privacy.authenticationFinished(success: false)
        center.post(name: UIScene.willEnterForegroundNotification, object: scene)
        center.post(name: UIScene.didActivateNotification, object: scene)

        await waitForPrivacyScreenToHide(in: scene)
        XCTAssertFalse(scene.windows.contains { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden })
    }

    // Preview privacy applies even with app authentication disabled; activation restores the app.
    @MainActor
    func testPrivacyScreenCoversWithoutAuthentication() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let privacy = AppPrivacyScreen()
        privacy.authenticationEnabled = false
        let center = NotificationCenter()
        privacy.startObserving(center: center)
        defer { center.post(name: UIScene.didDisconnectNotification, object: scene) }

        center.post(name: UIScene.willDeactivateNotification, object: scene)
        center.post(name: UIScene.didEnterBackgroundNotification, object: scene)
        XCTAssertTrue(scene.windows.contains { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden })
        center.post(name: UIScene.willEnterForegroundNotification, object: scene)
        center.post(name: UIScene.didActivateNotification, object: scene)
        await waitForPrivacyScreenToHide(in: scene)
        XCTAssertFalse(scene.windows.contains { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden })
    }

    // Backgrounding during either fade must produce an opaque snapshot and cancel stale removal.
    @MainActor
    func testBackgroundingFinishesFadeAndCancelsPendingReveal() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let privacy = AppPrivacyScreen()
        privacy.authenticationEnabled = false
        let center = NotificationCenter()
        privacy.startObserving(center: center)
        defer { center.post(name: UIScene.didDisconnectNotification, object: scene) }

        center.post(name: UIScene.willDeactivateNotification, object: scene)
        let cover = try XCTUnwrap(scene.windows.first { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden })
        center.post(name: UIScene.didEnterBackgroundNotification, object: scene)
        XCTAssertEqual(cover.alpha, 1)
        XCTAssertTrue(cover.layer.animationKeys()?.isEmpty ?? true)

        center.post(name: UIScene.didActivateNotification, object: scene)
        XCTAssertEqual(cover.alpha, 0)
        center.post(name: UIScene.willDeactivateNotification, object: scene)
        center.post(name: UIScene.didEnterBackgroundNotification, object: scene)
        XCTAssertEqual(cover.alpha, 1)
        XCTAssertTrue(cover.layer.animationKeys()?.isEmpty ?? true)

        // Let the interrupted fade-out completion run, if UIKit delivers it.
        try await Task.sleep(for: .milliseconds(300))
        XCTAssertFalse(cover.isHidden)
        XCTAssertEqual(cover.alpha, 1)
    }

    @MainActor
    private func waitForPrivacyScreenToHide(in scene: UIWindowScene) async {
        let hidden = scene.windows
            .filter { $0.accessibilityIdentifier == "app-privacy-screen" && !$0.isHidden }
            .map { expectation(for: NSPredicate(format: "hidden == YES"), evaluatedWith: $0) }
        if !hidden.isEmpty {
            await fulfillment(of: hidden, timeout: 2)
        }
    }

    @MainActor
    func testAppRejectsKeyboardExtensions() {
        let application = UIApplication.shared
        XCTAssertEqual(
            application.delegate?.application?(application, shouldAllowExtensionPointIdentifier: .keyboard),
            false
        )
        XCTAssertEqual(
            application.delegate?.application?(
                application,
                shouldAllowExtensionPointIdentifier: UIApplication.ExtensionPointIdentifier(rawValue: "other-extension")
            ),
            true
        )
    }

    override func setUpWithError() throws {
        let service = "swiss.bitbox.BitBoxAppTests.lightning.encryption.\(UUID().uuidString)"
        helper = LightningEncryptionHelper(service: service, keychain: InMemoryLightningKeychainClient())
    }

    override func tearDownWithError() throws {
        try? helper?.deleteKey(accountCode: "v0-deadbeef-ln-0")
        helper = nil
    }

    func testStoreAndLoadLightningEncryptionKey() throws {
        try helper.storeKey(accountCode: "v0-deadbeef-ln-0", encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")

        XCTAssertEqual(
            try helper.loadKey(accountCode: "v0-deadbeef-ln-0"),
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        )
    }

    func testStoreUpdatesExistingLightningEncryptionKey() throws {
        try helper.storeKey(accountCode: "v0-deadbeef-ln-0", encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
        try helper.storeKey(accountCode: "v0-deadbeef-ln-0", encryptionKey: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")

        XCTAssertEqual(
            try helper.loadKey(accountCode: "v0-deadbeef-ln-0"),
            "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
        )
    }

    func testLoadMissingLightningEncryptionKeyFails() throws {
        XCTAssertThrowsError(try helper.loadKey(accountCode: "v0-deadbeef-ln-0")) { error in
            XCTAssertEqual((error as NSError).localizedDescription, LightningEncryptionHelper.missingKeyError)
        }
    }

    func testDeleteLightningEncryptionKey() throws {
        try helper.storeKey(accountCode: "v0-deadbeef-ln-0", encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
        try helper.deleteKey(accountCode: "v0-deadbeef-ln-0")

        XCTAssertThrowsError(try helper.loadKey(accountCode: "v0-deadbeef-ln-0")) { error in
            XCTAssertEqual((error as NSError).localizedDescription, LightningEncryptionHelper.missingKeyError)
        }
    }

    func testDeleteMissingLightningEncryptionKeySucceeds() throws {
        XCTAssertNoThrow(try helper.deleteKey(accountCode: "v0-deadbeef-ln-0"))
    }

    func testInvalidInputsFail() throws {
        XCTAssertThrowsError(try helper.storeKey(accountCode: nil, encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="))
        XCTAssertThrowsError(try helper.storeKey(accountCode: "", encryptionKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="))
        XCTAssertThrowsError(try helper.storeKey(accountCode: "v0-deadbeef-ln-0", encryptionKey: nil))
        XCTAssertThrowsError(try helper.storeKey(accountCode: "v0-deadbeef-ln-0", encryptionKey: ""))
    }
}
