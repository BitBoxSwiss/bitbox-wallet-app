import Foundation
import WidgetKit

struct WidgetAppGroupSync {
    private struct ConfigFile: Decodable {
        struct Backend: Decodable {
            let mainFiat: String
        }

        let backend: Backend
    }

    private struct AccountsFile: Decodable {
        struct Account: Decodable {
            let inactive: Bool?
            let hiddenBecauseUnused: Bool?
            let coinCode: String?
        }

        let accounts: [Account]
    }

    func sync() {
        #if TARGET_TESTNET
        return
        #else
        let appSupportDirectory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        guard let defaults = UserDefaults(suiteName: WidgetShared.appGroupID) else {
            return
        }

        var changed = false

        let configURL = appSupportDirectory.appendingPathComponent("config.json")
        if let data = try? Data(contentsOf: configURL),
           let config = try? JSONDecoder().decode(ConfigFile.self, from: data) {
            let mainFiat = config.backend.mainFiat
            let currency = WidgetShared.invalidGeckoCurrencies.contains(mainFiat) ? WidgetShared.fallbackCurrency : mainFiat
            let previousRaw = defaults.string(forKey: WidgetShared.Keys.rawMainFiat)
            defaults.set(mainFiat, forKey: WidgetShared.Keys.rawMainFiat)
            defaults.set(currency, forKey: WidgetShared.Keys.sharedCurrency)
            if previousRaw != mainFiat {
                changed = true
            }
        }

        let accountsURL = appSupportDirectory.appendingPathComponent("accounts.json")
        let previous = defaults.stringArray(forKey: WidgetShared.Keys.sharedCoins)
        if let data = try? Data(contentsOf: accountsURL),
           let decoded = try? JSONDecoder().decode(AccountsFile.self, from: data) {
            var coinSet = Set<String>()
            for account in decoded.accounts {
                let inactive = account.inactive ?? false
                let hidden = account.hiddenBecauseUnused ?? false
                if inactive || hidden {
                    continue
                }
                if let code = account.coinCode {
                    let normalized = WidgetShared.normalizeCoinCode(code)
                    if WidgetShared.supportedCoinCodes.contains(normalized) {
                        coinSet.insert(normalized)
                    }
                }
            }

            let coins = Array(coinSet).sorted()
            defaults.set(coins, forKey: WidgetShared.Keys.sharedCoins)
            if previous != coins {
                changed = true
            }
        }

        if changed {
            WidgetCenter.shared.reloadAllTimelines()
        }
        #endif
    }
}
