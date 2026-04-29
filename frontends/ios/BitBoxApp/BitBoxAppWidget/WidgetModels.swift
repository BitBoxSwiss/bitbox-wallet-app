import Foundation
import WidgetKit

struct PriceData: Codable {
    let price: Double
    let change24h: Double
    let chartPrices: [Double]
    let coinCode: String
    let currency: String
}

struct CachedPriceRecord: Codable {
    let priceData: PriceData
    let timestamp: TimeInterval
}

struct MarketChartResponse: Decodable {
    let prices: [[Double]]
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let coinCode: String
    let price: Double?
    let change24h: Double?
    let chartPrices: [Double]
    let currency: String

    static let sampleChartData: [Double] = [82_000, 83_500, 82_800, 84_200, 83_900, 85_000, 84_500, 85_200]
}
