import SwiftUI
import WidgetKit

@main
struct BitBoxAppWidgets: WidgetBundle {
    var body: some Widget {
        BitBoxAppWidget()
        LightningAddressWidget()
    }
}

struct BitBoxAppWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WidgetShared.widgetKind, provider: Provider()) { entry in
            BitBoxAppWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(WidgetStrings.displayName)
        .description(WidgetStrings.description)
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}
