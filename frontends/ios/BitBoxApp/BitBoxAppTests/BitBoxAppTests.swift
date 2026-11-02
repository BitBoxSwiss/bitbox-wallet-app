//
//  BitBoxAppTests.swift
//  BitBoxAppTests
//
//  Created by dev on 05.12.23.
//

import XCTest
import Security
import UIKit
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
