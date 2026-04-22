import SwiftUI

enum WidgetCoinMetadata {
    static func geckoID(for coinCode: String) -> String {
        let code = WidgetShared.normalizeCoinCode(coinCode)
        switch code {
        case "btc":
            return "bitcoin"
        case "ltc":
            return "litecoin"
        case "eth":
            return "ethereum"
        default:
            return code
        }
    }

    static func ticker(for coinCode: String) -> String {
        WidgetShared.normalizeCoinCode(coinCode).uppercased()
    }

    static func logoAssetName(for coinCode: String) -> String? {
        switch WidgetShared.normalizeCoinCode(coinCode) {
        case "btc":
            return "coin_btc"
        case "ltc":
            return "coin_ltc"
        case "eth":
            return "coin_eth"
        default:
            return nil
        }
    }

    static func iconSystemName(for coinCode: String) -> String {
        let code = WidgetShared.normalizeCoinCode(coinCode)
        switch code {
        case "btc":
            return "bitcoinsign.circle.fill"
        case "eth":
            return "e.circle.fill"
        case "ltc":
            return "l.circle.fill"
        default:
            return "\(code.prefix(1)).circle.fill"
        }
    }

    static func iconColor(for coinCode: String) -> Color {
        switch WidgetShared.normalizeCoinCode(coinCode) {
        case "btc":
            return .orange
        case "eth":
            return Color(hex: 0x627EEA)
        case "ltc":
            return Color(hex: 0xBFBBB6)
        default:
            return .gray
        }
    }
}
