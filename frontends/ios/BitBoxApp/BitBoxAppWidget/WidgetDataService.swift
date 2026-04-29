import Foundation

struct WidgetDataService {
    private let defaults: UserDefaults?
    private let session: URLSession

    private static let chartPeriodSeconds: TimeInterval = 24 * 3600
    private static let chartPointIntervalSeconds: TimeInterval = 10 * 60

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
            change7d: data.change7d,
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

            let rawPoints: [(timestamp: TimeInterval, price: Double)] = decoded.prices.compactMap { point in
                guard point.count >= 2 else {
                    return nil
                }
                let timestamp = point[0] / 1000
                let price = point[1]
                guard timestamp.isFinite, price.isFinite else {
                    return nil
                }
                return (timestamp, price)
            }
            guard rawPoints.count >= 2 else {
                return nil
            }

            let end = Date().timeIntervalSince1970
            let start = end - Self.chartPeriodSeconds
            let prices = resampledPrices(
                from: rawPoints,
                start: start,
                end: end,
                interval: Self.chartPointIntervalSeconds
            )
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
                change7d: change,
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

    private func resampledPrices(
        from points: [(timestamp: TimeInterval, price: Double)],
        start: TimeInterval,
        end: TimeInterval,
        interval: TimeInterval
    ) -> [Double] {
        guard interval > 0, end > start else {
            return []
        }

        let sorted = points.sorted { $0.timestamp < $1.timestamp }
        guard sorted.count >= 2 else {
            return []
        }

        let steps = Int((end - start) / interval)
        var result: [Double] = []
        var index = 0

        for step in 0...steps {
            let time = start + (Double(step) * interval)
            while index + 1 < sorted.count && sorted[index + 1].timestamp < time {
                index += 1
            }

            if index + 1 >= sorted.count {
                result.append(sorted[index].price)
                continue
            }

            let left = sorted[index]
            let right = sorted[index + 1]

            if right.timestamp == left.timestamp {
                result.append(right.price)
            } else if time <= left.timestamp {
                result.append(left.price)
            } else {
                let ratio = (time - left.timestamp) / (right.timestamp - left.timestamp)
                let interpolated = left.price + ratio * (right.price - left.price)
                result.append(interpolated)
            }
        }

        if result.count < 2 {
            return []
        }

        return result
    }

    private func chartURL(for coinCode: String, currency: String) -> URL? {
        let now = Int(Date().timeIntervalSince1970)
        let oneDayAgo = now - Int(Self.chartPeriodSeconds)
        let geckoID = WidgetCoinMetadata.geckoID(for: coinCode)
        return URL(string: "https://exchangerates.shiftcrypto.io/api/v3/coins/\(geckoID)/market_chart/range?vs_currency=\(currency.lowercased())&from=\(oneDayAgo)&to=\(now)")
    }

    private static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10
        return URLSession(configuration: configuration)
    }
}
