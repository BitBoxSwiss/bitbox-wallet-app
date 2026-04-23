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
        let coinCode = WidgetAppGroupStore.selectedCoinCode()
        let currency = WidgetAppGroupStore.userCurrency()

        let cached = dataService.cachedFallback(for: coinCode, currency: currency)
        let exactCacheHit = cached.flatMap { $0.currency.uppercased() == currency.uppercased() ? $0 : nil }

        if let exactCacheHit {
            let entry = resolvedEntry(for: coinCode, currency: currency, data: exactCacheHit)
            let nextUpdate = Date().addingTimeInterval(15 * 60)
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        } else {
            Task {
                let fetched = await dataService.fetchChartData(coinCode: coinCode, currency: currency)
                let data = fetched ?? dataService.cachedFallback(for: coinCode, currency: currency)
                let entry = resolvedEntry(for: coinCode, currency: currency, data: data)
                let retryMinutes = fetched == nil ? 1 : 15
                let nextUpdate = Date().addingTimeInterval(TimeInterval(retryMinutes * 60))
                completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
            }
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
