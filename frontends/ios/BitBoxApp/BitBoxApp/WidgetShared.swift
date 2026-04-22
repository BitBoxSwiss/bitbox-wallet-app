import Foundation

enum WidgetShared {
    static let appGroupID = "group.swiss.bitbox.BitBoxApp"
    static let widgetKind = "BitBoxAppWidget"
    static let fallbackCurrency = "USD"

    static let invalidGeckoCurrencies: Set<String> = ["BTC", "sat"]

    enum Keys {
        static let sharedCurrency = "mainFiat"
        static let rawMainFiat = "rawMainFiat"
        static let sharedCoins = "activeCoins"
        static let selectedCoinIndex = "selectedCoinIndex"
        static let lastPrefetchTimestamp = "lastWidgetPrefetchTimestamp"
    }

    enum Cache {
        static let priceDataPrefix = "cachedPriceData"
        static let priceTTL: TimeInterval = 3600
        static let prefetchTTL: TimeInterval = 15 * 60
    }

    static func normalizeCoinCode(_ code: String) -> String {
        switch code.lowercased() {
        case "tbtc", "rbtc":
            return "btc"
        case "tltc":
            return "ltc"
        case "sepeth":
            return "eth"
        default:
            return code.lowercased()
        }
    }

    static func cacheKey(for coinCode: String, currency: String) -> String {
        "\(Cache.priceDataPrefix)_\(normalizeCoinCode(coinCode))_\(currency.uppercased())"
    }
}
