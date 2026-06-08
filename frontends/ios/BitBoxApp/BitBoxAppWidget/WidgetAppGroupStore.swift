import Foundation

enum WidgetAppGroupStore {
    private static let defaults = UserDefaults(suiteName: WidgetShared.appGroupID)

    static func sharedDefaults() -> UserDefaults? {
        defaults
    }

    static func userCurrency() -> String {
        defaults?.string(forKey: WidgetShared.Keys.sharedCurrency) ?? WidgetShared.fallbackCurrency
    }

    static func activeCoins() -> [String] {
        defaults?.stringArray(forKey: WidgetShared.Keys.sharedCoins) ?? []
    }

    static func selectedCoinIndex() -> Int {
        defaults?.integer(forKey: WidgetShared.Keys.selectedCoinIndex) ?? 0
    }

    static func setSelectedCoinIndex(_ index: Int) {
        defaults?.set(index, forKey: WidgetShared.Keys.selectedCoinIndex)
    }

    static func forceFreshPriceReloadToken() -> Int {
        let requested = defaults?.integer(
            forKey: WidgetShared.Keys.freshPriceReloadRequestedToken
        ) ?? 0
        guard requested > 0 else {
            return 0
        }
        let fulfilled = defaults?.bool(
            forKey: WidgetShared.freshPriceReloadFulfilledKey(for: requested)
        ) == true
        return fulfilled ? 0 : requested
    }

    static func markForceFreshPriceReloadFulfilled(_ token: Int) {
        guard token > 0 else {
            return
        }
        let requested = defaults?.integer(
            forKey: WidgetShared.Keys.freshPriceReloadRequestedToken
        ) ?? 0
        guard requested == token else {
            return
        }
        defaults?.set(true, forKey: WidgetShared.freshPriceReloadFulfilledKey(for: token))
    }

    static func selectedCoinCode() -> String {
        let coins = activeCoins()
        guard !coins.isEmpty else {
            return "btc"
        }
        let index = normalizedIndex(selectedCoinIndex(), count: coins.count)
        return WidgetShared.normalizeCoinCode(coins[index])
    }

    static func normalizedIndex(_ raw: Int, count: Int) -> Int {
        guard count > 0 else { return 0 }
        return ((raw % count) + count) % count
    }
}
