import Foundation
import WidgetKit

struct Provider: TimelineProvider {
    private let dataService = WidgetDataService()

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            coinCode: "btc",
            price: 85_200,
            change7d: 1.68,
            chartPrices: SimpleEntry.sampleChartData,
            currency: WidgetAppGroupStore.userCurrency()
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        let coinCode = WidgetAppGroupStore.selectedCoinCode()
        let currency = WidgetAppGroupStore.userCurrency()

        if context.isPreview {
            completion(
                SimpleEntry(
                    date: Date(),
                    coinCode: coinCode,
                    price: 85_200,
                    change7d: 1.68,
                    chartPrices: SimpleEntry.sampleChartData,
                    currency: currency
                )
            )
            return
        }

        Task {
            let data = await dataService.fetchChartData(coinCode: coinCode, currency: currency)
            completion(resolvedEntry(for: coinCode, currency: currency, data: data ?? dataService.cachedFallback(for: coinCode, currency: currency)))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let coins = WidgetAppGroupStore.activeCoins()
        let coinCode = WidgetAppGroupStore.selectedCoinCode()
        let currency = WidgetAppGroupStore.userCurrency()

        let cached = dataService.cachedFallback(for: coinCode, currency: currency)
        let exactCacheHit = cached.flatMap { $0.currency.uppercased() == currency.uppercased() ? $0 : nil }

        if let exactCacheHit {
            let entry = resolvedEntry(for: coinCode, currency: currency, data: exactCacheHit)
            let nextUpdate = Date().addingTimeInterval(15 * 60)
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
            Task.detached(priority: .utility) {
                _ = await dataService.fetchChartData(coinCode: coinCode, currency: currency)
            }
            triggerPrefetchIfNeeded(coins: coins, excluding: coinCode, currency: currency)
        } else {
            Task {
                let fetched = await dataService.fetchChartData(coinCode: coinCode, currency: currency)
                let data = fetched ?? dataService.cachedFallback(for: coinCode, currency: currency)
                let entry = resolvedEntry(for: coinCode, currency: currency, data: data)
                let retryMinutes = fetched == nil ? 1 : 15
                let nextUpdate = Date().addingTimeInterval(TimeInterval(retryMinutes * 60))
                completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
                triggerPrefetchIfNeeded(coins: coins, excluding: coinCode, currency: currency)
            }
        }
    }

    private func triggerPrefetchIfNeeded(coins: [String], excluding coinCode: String, currency: String) {
        guard shouldPrefetch(coins: coins),
              let defaults = WidgetAppGroupStore.sharedDefaults() else {
            return
        }
        defaults.set(Date().timeIntervalSince1970, forKey: WidgetShared.Keys.lastPrefetchTimestamp)
        Task.detached(priority: .utility) {
            await prefetchAdditionalCoins(coins: coins, excluding: coinCode, currency: currency)
        }
    }

    private func shouldPrefetch(coins: [String]) -> Bool {
        guard coins.count > 1, let defaults = WidgetAppGroupStore.sharedDefaults() else {
            return false
        }
        let last = defaults.double(forKey: WidgetShared.Keys.lastPrefetchTimestamp)
        return Date().timeIntervalSince1970 - last >= WidgetShared.Cache.prefetchTTL
    }

    private func prefetchAdditionalCoins(coins: [String], excluding selectedCoin: String, currency: String) async {
        for coin in coins where coin != selectedCoin {
            _ = await dataService.fetchChartData(coinCode: coin, currency: currency)
        }
    }

    private func resolvedEntry(for coinCode: String, currency: String, data: PriceData?) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            coinCode: data?.coinCode ?? coinCode,
            price: data?.price,
            change7d: data?.change7d,
            chartPrices: data?.chartPrices ?? [],
            currency: data?.currency ?? currency
        )
    }
}
