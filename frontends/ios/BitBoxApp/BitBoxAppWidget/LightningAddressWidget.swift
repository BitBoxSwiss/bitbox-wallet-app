import SwiftUI
import WidgetKit

struct LightningAddressEntry: TimelineEntry {
    let date: Date
    let address: String?
}

struct LightningAddressProvider: TimelineProvider {
    func placeholder(in context: Context) -> LightningAddressEntry {
        LightningAddressEntry(date: Date(), address: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (LightningAddressEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LightningAddressEntry>) -> Void) {
        completion(Timeline(entries: [entry()], policy: .never))
    }

    private func entry() -> LightningAddressEntry {
        LightningAddressEntry(
            date: Date(),
            address: WidgetAppGroupStore.sharedDefaults()?.string(forKey: WidgetShared.Keys.lightningAddress)
        )
    }
}

struct LightningAddressWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShared.lightningWidgetKind, provider: LightningAddressProvider()) { entry in
            LightningAddressWidgetView(entry: entry)
        }
        .configurationDisplayName("lightningWidget.name")
        .description("lightningWidget.description")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct LightningAddressWidgetView: View {
    let entry: LightningAddressEntry
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 12) {
            if let address = entry.address, let qrCode = LightningAddressQRCode.image(for: address) {
                Text(verbatim: address)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
                    .accessibilityLabel(Text("lightningWidget.address"))
                    .accessibilityValue(address)

                qrImage(qrCode)
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .accessibilityHidden(true)
            } else {
                Spacer(minLength: 0)
                Image(systemName: "qrcode")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                Text("lightningWidget.empty")
                    .font(.caption)
                    .multilineTextAlignment(.center)
                Spacer(minLength: 0)
            }

            Image("dbb_logo_light")
                .resizable()
                .scaledToFit()
                .frame(height: 18)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .containerBackground(colorScheme == .dark ? Color(hex: 0x1c1c1c) : Color(hex: 0xf2f2f7), for: .widget)
    }

    @ViewBuilder
    private func qrImage(_ image: CGImage) -> some View {
        if #available(iOS 18.0, *) {
            Image(decorative: image, scale: 1)
                .resizable()
                .interpolation(.none)
                .widgetAccentedRenderingMode(.fullColor)
        } else {
            Image(decorative: image, scale: 1)
                .resizable()
                .interpolation(.none)
        }
    }
}
