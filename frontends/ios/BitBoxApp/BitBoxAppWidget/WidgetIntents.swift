import AppIntents
import WidgetKit

struct NextCoinIntent: AppIntent {
    static var title: LocalizedStringResource = "Next Coin"

    func perform() async throws -> some IntentResult {
        let coins = WidgetAppGroupStore.activeCoins()
        guard coins.count > 1 else {
            return .result()
        }
        let current = WidgetAppGroupStore.selectedCoinIndex()
        WidgetAppGroupStore.setSelectedCoinIndex((current + 1) % coins.count)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetShared.widgetKind)
        return .result()
    }
}

struct PreviousCoinIntent: AppIntent {
    static var title: LocalizedStringResource = "Previous Coin"

    func perform() async throws -> some IntentResult {
        let coins = WidgetAppGroupStore.activeCoins()
        guard coins.count > 1 else {
            return .result()
        }
        let current = WidgetAppGroupStore.selectedCoinIndex()
        WidgetAppGroupStore.setSelectedCoinIndex((current - 1 + coins.count) % coins.count)
        WidgetCenter.shared.reloadTimelines(ofKind: WidgetShared.widgetKind)
        return .result()
    }
}
