//
//  BitBoxAppTests.swift
//  BitBoxAppTests
//
//  Created by dev on 05.12.23.
//

import XCTest
import Security
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
