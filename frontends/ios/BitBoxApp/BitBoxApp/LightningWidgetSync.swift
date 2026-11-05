import Foundation
import Mobileserver
import WidgetKit

// GoAPI serializes access on the main queue. Only public receiving information is shared
// with the widget; it never needs the Lightning SDK, wallet files or encryption keys.
final class LightningWidgetSync {
    private struct Account: Decodable {
        let code: String
    }

    private struct AddressResponse: Decodable {
        let success: Bool
        let data: String?
    }

    private struct Event: Decodable {
        let subject: String
    }

    private enum Request: String {
        case account = "lightning/account"
        case address = "lightning/address"
    }

    private let store: LightningWidgetStore
    private let backendCall: (Int, String) -> Void
    private let reload: () -> Void
    private var nextQueryID = 0
    private var pending: (id: Int, request: Request)?

    init(
        store: LightningWidgetStore = LightningWidgetStore(),
        backendCall: @escaping (Int, String) -> Void = { MobileserverBackendCall($0, $1) },
        reload: @escaping () -> Void = {
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetShared.lightningWidgetKind)
        }
    ) {
        self.store = store
        self.backendCall = backendCall
        self.reload = reload
        if store.removedLegacyAddress {
            reload()
        }
    }

    func sync() {
        request(.account)
    }

    func handleEvent(_ message: String) {
        guard let event = try? JSONDecoder().decode(Event.self, from: Data(message.utf8)) else {
            return
        }
        switch event.subject {
        case "lightning/account", "lightning/address":
            // Remove the superseded QR immediately when the wallet or address changes.
            setAddress(nil)
            sync()
        case "lightning/sdk-status":
            sync()
        default:
            break
        }
    }

    func handleResponse(queryID: Int, response: String) {
        // A newer event invalidates in-flight reads, so an old response cannot restore a stale QR.
        guard let pending, pending.id == queryID else {
            return
        }
        self.pending = nil
        let data = Data(response.utf8)
        switch pending.request {
        case .account:
            do {
                let account = try JSONDecoder().decode(Account?.self, from: data)
                var cache = store.read()
                if account?.code != cache.account || account == nil {
                    cache.address = nil
                }
                cache.account = account?.code
                setCache(cache)
                if account != nil {
                    request(.address)
                }
            } catch {
                // Keep the cached address if the backend is temporarily unavailable.
            }
        case .address:
            guard let result = try? JSONDecoder().decode(AddressResponse.self, from: data), result.success else {
                return
            }
            setAddress(result.data)
        }
    }

    private func request(_ request: Request) {
        nextQueryID -= 1
        pending = (nextQueryID, request)
        backendCall(nextQueryID, "{\"method\":\"GET\",\"endpoint\":\"\(request.rawValue)\"}")
    }

    private func setAddress(_ address: String?) {
        var cache = store.read()
        cache.address = address?.isEmpty == false ? address : nil
        setCache(cache)
    }

    private func setCache(_ cache: LightningWidgetStore.Cache) {
        let previous = store.read()
        guard previous != cache else { return }
        do {
            try store.write(cache)
            if previous.address != cache.address {
                reload()
            }
        } catch {
            print("Could not update Lightning widget cache: \(error)")
        }
    }
}
