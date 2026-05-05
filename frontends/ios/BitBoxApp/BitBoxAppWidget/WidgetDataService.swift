import Foundation

struct WidgetDataService {
    private static let chartRangeSeconds = 24 * 3600

    private let defaults: UserDefaults?
    private let session: URLSession

    init(
        defaults: UserDefaults? = WidgetAppGroupStore.sharedDefaults(),
        session: URLSession = WidgetDataService.makeSession()
    ) {
        self.defaults = defaults
        self.session = session
    }

    func cachedFallback(for coinCode: String, currency: String) -> PriceData? {
        if let cached = loadFromCache(coinCode: coinCode, currency: currency) {
            return cached
        }
        if currency.uppercased() != WidgetShared.fallbackCurrency {
            return loadFromCache(coinCode: coinCode, currency: WidgetShared.fallbackCurrency)
        }
        return nil
    }

    private func loadFromCache(coinCode: String, currency: String) -> PriceData? {
        guard let defaults,
              let payload = defaults.data(forKey: WidgetShared.cacheKey(for: coinCode, currency: currency)),
              let record = try? JSONDecoder().decode(CachedPriceRecord.self, from: payload),
              Date().timeIntervalSince1970 - record.timestamp < WidgetShared.Cache.priceTTL else {
            return nil
        }

        return record.priceData
    }

    private func saveToCache(data: PriceData) {
        guard let defaults else {
            return
        }

        let normalized = PriceData(
            price: data.price,
            change24h: data.change24h,
            chartPrices: data.chartPrices,
            coinCode: WidgetShared.normalizeCoinCode(data.coinCode),
            currency: data.currency.uppercased()
        )
        let record = CachedPriceRecord(
            priceData: normalized,
            timestamp: Date().timeIntervalSince1970
        )

        guard let payload = try? JSONEncoder().encode(record) else {
            return
        }

        defaults.set(payload, forKey: WidgetShared.cacheKey(for: normalized.coinCode, currency: normalized.currency))
    }

    func fetchChartData(coinCode: String, currency: String) async -> PriceData? {
        guard let url = chartURL(for: coinCode, currency: currency) else {
            return nil
        }

        do {
            let (data, response) = try await session.data(from: url)
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            guard statusCode == 200 else {
                return nil
            }
            guard let decoded = try? JSONDecoder().decode(MarketChartResponse.self, from: data),
                  decoded.prices.count >= 2 else {
                return nil
            }

            let prices = decoded.prices.compactMap { rawPrice -> Double? in
                guard rawPrice.count >= 2, rawPrice[1].isFinite else {
                    return nil
                }
                return rawPrice[1]
            }
            guard prices.count >= 2 else {
                return nil
            }

            guard let currentPrice = prices.last,
                  let firstPrice = prices.first,
                  currentPrice.isFinite,
                  firstPrice.isFinite,
                  firstPrice != 0 else {
                return nil
            }
            let change = (currentPrice - firstPrice) / firstPrice * 100
            let result = PriceData(
                price: currentPrice,
                change24h: change,
                chartPrices: prices,
                coinCode: WidgetShared.normalizeCoinCode(coinCode),
                currency: currency.uppercased()
            )
            saveToCache(data: result)
            return result
        } catch {
            return nil
        }
    }

    private func chartURL(for coinCode: String, currency: String) -> URL? {
        let now = Int(Date().timeIntervalSince1970)
        let oneDayAgo = now - Self.chartRangeSeconds
        let geckoID = WidgetCoinMetadata.geckoID(for: coinCode)
        return URL(string: "https://exchangerates.shiftcrypto.io/api/v3/coins/\(geckoID)/market_chart/range?vs_currency=\(currency.lowercased())&from=\(oneDayAgo)&to=\(now)")
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10
        return URLSession(configuration: configuration)
    }
}
