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

    private let defaults: UserDefaults?
    private let backendCall: (Int, String) -> Void
    private let reload: () -> Void
    private var nextQueryID = 0
    private var pending: (id: Int, request: Request)?

    init(
        defaults: UserDefaults? = UserDefaults(suiteName: WidgetShared.appGroupID),
        backendCall: @escaping (Int, String) -> Void = { MobileserverBackendCall($0, $1) },
        reload: @escaping () -> Void = {
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetShared.lightningWidgetKind)
        }
    ) {
        self.defaults = defaults
        self.backendCall = backendCall
        self.reload = reload
    }

    func sync() {
        request(.account)
    }

    func handleEvent(_ message: String) {
        guard let event = try? JSONDecoder().decode(Event.self, from: Data(message.utf8)) else {
            return
        }
        switch event.subject {
        case "lightning/account":
            // Remove the previous wallet's QR immediately, including during wallet replacement.
            setAddress(nil)
            sync()
        case "lightning/address", "lightning/sdk-status":
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
                if account?.code != defaults?.string(forKey: WidgetShared.Keys.lightningAccount) {
                    setAddress(nil)
                }
                defaults?.set(account?.code, forKey: WidgetShared.Keys.lightningAccount)
                if account != nil {
                    request(.address)
                } else {
                    setAddress(nil)
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
        guard let defaults else { return }
        let address = address?.isEmpty == false ? address : nil
        guard defaults.string(forKey: WidgetShared.Keys.lightningAddress) != address else { return }
        defaults.set(address, forKey: WidgetShared.Keys.lightningAddress)
        reload()
    }
}
