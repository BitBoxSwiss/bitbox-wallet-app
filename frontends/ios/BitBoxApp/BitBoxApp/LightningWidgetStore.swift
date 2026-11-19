import Foundation

struct LightningWidgetStore {
    struct Cache: Codable, Equatable {
        var account: String?
        var address: String?
    }

    private let directory: URL?
    let removedLegacyAddress: Bool

    init(
        directory: URL? = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: WidgetShared.appGroupID
        )?.appendingPathComponent("Library/Application Support/LightningWidget", isDirectory: true),
        defaults: UserDefaults? = UserDefaults(suiteName: WidgetShared.appGroupID)
    ) {
        self.directory = directory
        // Defaults can be restored without the wallet. Only the backend may repopulate this cache.
        removedLegacyAddress = defaults?.object(forKey: WidgetShared.Keys.lightningAddress) != nil
        defaults?.removeObject(forKey: WidgetShared.Keys.lightningAccount)
        defaults?.removeObject(forKey: WidgetShared.Keys.lightningAddress)
    }

    func read() -> Cache {
        guard let directory,
              let data = try? Data(contentsOf: directory.appendingPathComponent("address.json")),
              let cache = try? JSONDecoder().decode(Cache.self, from: data) else {
            return Cache()
        }
        return cache
    }

    func write(_ cache: Cache) throws {
        guard var directory else { throw CocoaError(.fileNoSuchFile) }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        // Exclude the directory before writing, so atomic file replacements remain excluded too.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        try JSONEncoder().encode(cache).write(to: directory.appendingPathComponent("address.json"), options: .atomic)
    }
}
