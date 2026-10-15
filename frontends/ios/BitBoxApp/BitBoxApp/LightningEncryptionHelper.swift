//
//  LightningEncryptionHelper.swift
//  BitBoxApp
//

import Foundation
import Security

protocol LightningKeychainClient {
    func update(query: [String: Any], attributes: [String: Any]) -> OSStatus
    func add(query: [String: Any]) -> OSStatus
    func copyMatching(query: [String: Any]) -> (status: OSStatus, data: Data?)
    func delete(query: [String: Any]) -> OSStatus
}

final class SecItemLightningKeychainClient: LightningKeychainClient {
    func update(query: [String: Any], attributes: [String: Any]) -> OSStatus {
        SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    }

    func add(query: [String: Any]) -> OSStatus {
        SecItemAdd(query as CFDictionary, nil)
    }

    func copyMatching(query: [String: Any]) -> (status: OSStatus, data: Data?) {
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        return (status, item as? Data)
    }

    func delete(query: [String: Any]) -> OSStatus {
        SecItemDelete(query as CFDictionary)
    }
}

final class LightningEncryptionHelper {
    static let missingKeyError = "lightning-key-missing"

    private static let defaultService = "swiss.bitbox.BitBoxApp.lightning.encryption"
    private let service: String
    private let keychain: LightningKeychainClient

    init(
        service: String = LightningEncryptionHelper.defaultService,
        keychain: LightningKeychainClient = SecItemLightningKeychainClient()
    ) {
        self.service = service
        self.keychain = keychain
    }

    func storeKey(accountCode: String?, encryptionKey: String?) throws {
        let account = try keychainAccount(accountCode: accountCode)
        guard let encryptionKey, !encryptionKey.isEmpty else {
            throw error("lightning-key-invalid")
        }
        guard let keyData = encryptionKey.data(using: .utf8) else {
            throw error("lightning-key-invalid")
        }

        let query = baseQuery(account: account)
        let attributes: [String: Any] = [
            kSecValueData as String: keyData,
        ]

        let updateStatus = keychain.update(query: query, attributes: attributes)
        if updateStatus == errSecSuccess {
            return
        }
        if updateStatus != errSecItemNotFound {
            throw statusError(updateStatus)
        }

        var addQuery = query
        attributes.forEach { addQuery[$0.key] = $0.value }
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let addStatus = keychain.add(query: addQuery)
        if addStatus == errSecDuplicateItem {
            // Another activation may have inserted the item after the update missed it.
            // Store this caller's key so the persisted mnemonic and key stay in sync.
            let retryUpdateStatus = keychain.update(query: query, attributes: attributes)
            guard retryUpdateStatus == errSecSuccess else {
                throw statusError(retryUpdateStatus)
            }
            return
        }
        guard addStatus == errSecSuccess else {
            throw statusError(addStatus)
        }
    }

    func loadKey(accountCode: String?) throws -> String {
        let account = try keychainAccount(accountCode: accountCode)
        var query = baseQuery(account: account)
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecReturnData as String] = true

        let result = keychain.copyMatching(query: query)
        let status = result.status
        if status == errSecItemNotFound {
            throw error(Self.missingKeyError)
        }
        guard status == errSecSuccess else {
            throw statusError(status)
        }
        guard let data = result.data, let key = String(data: data, encoding: .utf8), !key.isEmpty else {
            throw error("lightning-key-invalid")
        }
        return key
    }

    func deleteKey(accountCode: String?) throws {
        let account = try keychainAccount(accountCode: accountCode)
        let status = keychain.delete(query: baseQuery(account: account))
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw statusError(status)
        }
    }

    private func keychainAccount(accountCode: String?) throws -> String {
        guard let accountCode, !accountCode.isEmpty else {
            throw error("lightning-account-invalid")
        }
        return "bitboxapp.lightning.seed.\(accountCode).v1"
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private func statusError(_ status: OSStatus) -> NSError {
        error("lightning-keychain-error", status: status)
    }

    private func error(_ message: String, status: OSStatus? = nil) -> NSError {
        var userInfo: [String: Any] = [NSLocalizedDescriptionKey: message]
        if let status {
            userInfo["OSStatus"] = status
        }
        return NSError(domain: "swiss.bitbox.BitBoxApp.lightning.encryption", code: Int(status ?? -1), userInfo: userInfo)
    }
}
