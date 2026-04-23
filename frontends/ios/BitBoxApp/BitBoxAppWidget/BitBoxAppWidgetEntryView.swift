import SwiftUI
import WidgetKit

enum WidgetStrings {
    static let displayName = "BitBoxApp Widget"
    static let description = "Live token price with 7-day chart."
    static let unavailable = "Unavailable"
}

extension Color {
    init(hex: UInt, opacity: Double = 1.0) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

struct BitBoxAppWidgetEntryView: View {
    let entry: SimpleEntry

    var body: some View {
        smallView
            .containerBackground(.fill.tertiary, for: .widget)
    }

    private var formattedPrice: String {
        WidgetFormatting.formattedPrice(entry.price)
    }

    private var changeText: String {
        WidgetFormatting.formattedChange(entry.change7d)
    }

    private var changeColor: Color {
        WidgetFormatting.changeColor(entry.change7d)
    }

    private var currencyLabel: String {
        "\(WidgetCoinMetadata.ticker(for: entry.coinCode))/\(entry.currency.uppercased())"
    }

    @ViewBuilder
    private var smallView: some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 4) {
                    if let logoName = WidgetCoinMetadata.logoAssetName(for: entry.coinCode) {
                        if #available(iOS 18.0, *) {
                            Image(logoName)
                                .resizable()
                                .widgetAccentedRenderingMode(.desaturated)
                                .scaledToFit()
                                .frame(width: 16, height: 16)
                        } else {
                            Image(logoName)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 16, height: 16)
                        }
                    } else {
                        Image(systemName: WidgetCoinMetadata.iconSystemName(for: entry.coinCode))
                            .font(.subheadline)
                            .foregroundStyle(WidgetCoinMetadata.iconColor(for: entry.coinCode))
                    }
                    Text(currencyLabel)
                        .font(.caption)
                        .foregroundStyle(Color(hex: 0x939393))
                }

                Spacer()

                Text(changeText)
                    .font(.caption)
                    .foregroundStyle(changeColor)
            }
            .padding(.horizontal)
            .padding(.top)

            Spacer()

            if entry.price != nil {
                Text(formattedPrice)
                    .font(formattedPrice.count > 10 ? .title2.bold() : .title.bold())
                    .minimumScaleFactor(0.05)
                    .lineLimit(1)
            } else {
                Text(WidgetStrings.unavailable)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if !entry.chartPrices.isEmpty {
                SparklineView(prices: entry.chartPrices, lineColor: changeColor)
                    .frame(height: 32)
            }

            Spacer()

            logoBar(height: 24)
                .padding(.bottom, 12)
        }
    }

    private func logoBar(height: CGFloat) -> some View {
        let showNav = WidgetAppGroupStore.activeCoins().count > 1
        return HStack {
            if showNav {
                Button(intent: PreviousCoinIntent()) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: height * 0.8, weight: .semibold))
                        .foregroundStyle(Color(hex: 0x939393))
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Spacer(minLength: 0)
            }

            Image("dbb_logo_light")
                .resizable()
                .scaledToFit()
                .frame(height: height)

            if showNav {
                Spacer(minLength: 0)

                Button(intent: NextCoinIntent()) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: height * 0.8, weight: .semibold))
                        .foregroundStyle(Color(hex: 0x939393))
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
    }
}
