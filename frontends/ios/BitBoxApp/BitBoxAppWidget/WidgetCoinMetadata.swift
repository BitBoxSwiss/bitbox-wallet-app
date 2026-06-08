import SwiftUI

enum WidgetCoinMetadata {
    private struct Entry {
        let geckoID: String
        let logoAssetName: String?
        let iconSystemName: String
        let iconColor: Color
    }

    private static let table: [String: Entry] = [
        "btc": Entry(
            geckoID: "bitcoin",
            logoAssetName: "coin_btc",
            iconSystemName: "bitcoinsign.circle.fill",
            iconColor: .orange
        ),
        "ltc": Entry(
            geckoID: "litecoin",
            logoAssetName: "coin_ltc",
            iconSystemName: "l.circle.fill",
            iconColor: Color(hex: 0xBFBBB6)
        ),
        "eth": Entry(
            geckoID: "ethereum",
            logoAssetName: "coin_eth",
            iconSystemName: "e.circle.fill",
            iconColor: Color(hex: 0x627EEA)
        )
    ]

    static func geckoID(for coinCode: String) -> String {
        let code = WidgetShared.normalizeCoinCode(coinCode)
        return table[code]?.geckoID ?? code
    }

    static func ticker(for coinCode: String) -> String {
        WidgetShared.normalizeCoinCode(coinCode).uppercased()
    }

    static func logoAssetName(for coinCode: String) -> String? {
        table[WidgetShared.normalizeCoinCode(coinCode)]?.logoAssetName
    }

    static func iconSystemName(for coinCode: String) -> String {
        let code = WidgetShared.normalizeCoinCode(coinCode)
        if let entry = table[code] {
            return entry.iconSystemName
        }
        guard let safeChar = code.unicodeScalars.first(where: { CharacterSet.alphanumerics.contains($0) }) else {
            return "questionmark.circle.fill"
        }
        return "\(Character(safeChar)).circle.fill"
    }

    static func iconColor(for coinCode: String) -> Color {
        table[WidgetShared.normalizeCoinCode(coinCode)]?.iconColor ?? .gray
    }
}
