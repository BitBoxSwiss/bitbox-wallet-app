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

    static func selectedCoinCode() -> String {
        let coins = activeCoins()
        guard !coins.isEmpty else {
            return "btc"
        }
        let index = selectedCoinIndex() % coins.count
        return WidgetShared.normalizeCoinCode(coins[index])
    }
}
