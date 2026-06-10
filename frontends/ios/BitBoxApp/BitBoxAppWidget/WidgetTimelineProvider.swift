import Foundation
import WidgetKit

struct Provider: TimelineProvider {
    private static let refreshInterval: TimeInterval = 10 * 60
    private static let retryInterval: TimeInterval = 60

    private let dataService = WidgetDataService()

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            coinCode: "btc",
            price: 85_200,
            change24h: 1.68,
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
                    change24h: 1.68,
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
        let coinCode = WidgetAppGroupStore.selectedCoinCode()
        let currency = WidgetAppGroupStore.userCurrency()
        let forceFreshPriceReloadToken = WidgetAppGroupStore.forceFreshPriceReloadToken()
        let forceFreshPriceReload = forceFreshPriceReloadToken > 0

        let cached = dataService.cachedFallback(for: coinCode, currency: currency)
        let exactCacheHit = cached.flatMap { $0.currency.uppercased() == currency.uppercased() ? $0 : nil }

        if !forceFreshPriceReload, let exactCacheHit {
            let entry = resolvedEntry(for: coinCode, currency: currency, data: exactCacheHit)
            let nextUpdate = Date().addingTimeInterval(Self.refreshInterval)
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        } else {
            Task {
                let fetched = await dataService.fetchChartData(coinCode: coinCode, currency: currency)
                if fetched != nil || exactCacheHit != nil {
                    WidgetAppGroupStore.markForceFreshPriceReloadFulfilled(
                        forceFreshPriceReloadToken
                    )
                }
                let data = fetched ?? cached
                let entry = resolvedEntry(for: coinCode, currency: currency, data: data)
                let nextUpdate = Date().addingTimeInterval(
                    fetched == nil && exactCacheHit == nil ? Self.retryInterval : Self.refreshInterval
                )
                completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
            }
        }
    }

    private func resolvedEntry(for coinCode: String, currency: String, data: PriceData?) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            coinCode: data?.coinCode ?? coinCode,
            price: data?.price,
            change24h: data?.change24h,
            chartPrices: data?.chartPrices ?? [],
            currency: data?.currency ?? currency
        )
    }
}
