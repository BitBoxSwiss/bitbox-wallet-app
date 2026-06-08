import Foundation
import SwiftUI

enum WidgetFormatting {
    static let twoDecimalFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    static func formattedPrice(_ price: Double?) -> String {
        guard let price else {
            return "—"
        }
        return twoDecimalFormatter.string(from: NSNumber(value: price)) ?? "—"
    }

    static func formattedChange(_ change: Double?) -> String {
        guard let change else {
            return "—"
        }
        let prefix = change > 0 ? "+" : change < 0 ? "-" : ""
        let value = twoDecimalFormatter.string(from: NSNumber(value: abs(change))) ?? "0.00"
        return "\(prefix)\(value)%"
    }

    static func changeColor(_ change: Double?) -> Color {
        guard let change else {
            return .secondary
        }
        if change > 0 {
            return Color(red: 0, green: 0.643, blue: 0)
        }
        if change < 0 {
            return .red
        }
        return .secondary
    }
}
