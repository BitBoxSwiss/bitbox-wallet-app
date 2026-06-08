//
//  Bluetooth.swift
//  BitBoxApp
//
//  Created by dev on 14.01.2025.
//

import CoreBluetooth
import Mobileserver

struct ProductInfo: Codable {
    let product: String
    let version: String

    // map struct fields to json keys
    enum CodingKeys: String, CodingKey {
        case product = "p"
        case version = "v"
    }
}

enum ConnectionState: String, Codable {
    case discovered
    // from the moment we try to connect until after we are paired (or until either step fails).
    case connecting
    case connected
    // something went wrong, see connectionError.
    case error
}

struct State {
    var bluetoothAvailable: Bool
    var bluetoothUnauthorized: Bool
    var scanning: Bool
    var discoveredPeripherals: [UUID: PeripheralMetadata]
}

struct PeripheralMetadata {
    let peripheral: CBPeripheral
    let discoveredDate: Date
    var connectionState: ConnectionState
    var connectionError: String? = nil
}

private let pairedDevicesKey = "pairedDeviceIdentifiers"
var pairedDeviceIdentifiers: Set<String> {
    get {
        Set(UserDefaults.standard.stringArray(forKey: pairedDevicesKey) ?? [])
    }
    set {
        UserDefaults.standard.set(Array(newValue), forKey: pairedDevicesKey)
    }
}

class BLEConnectionContext {
    let identifier = UUID()
    let semaphore = DispatchSemaphore(value: 0)
    var readBuffer = Data()
    var readBufferLock = NSLock()
}

class BluetoothManager: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var state: State = State(
        bluetoothAvailable: false,
        bluetoothUnauthorized: false,
        scanning: false,
        discoveredPeripherals: [:]
    )

    var centralManager: CBCentralManager!
    var connectedPeripheral: CBPeripheral?
    var pWriter: CBCharacteristic?
    var pReader: CBCharacteristic?
    var pProduct: CBCharacteristic?

    private var isPaired: Bool = false

    // Peripherals in this set will not be auto-connected even if previously paired.
    // This is for failed connections to not enter an infinite connect loop.
    private var dontAutoConnectSet: Set<UUID> = []

    private var currentContext: BLEConnectionContext?
    // Locks access to the `currentContext` var only, not to its contents. This is important, as
    // one can't keep the context locked while waiting for the semaphore, which would lead to a
    // deadlock.
    private let currentContextLock = NSLock()

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
        state.bluetoothAvailable = centralManager.state == .poweredOn
        updateBackendState()
    }

    func isConnected() -> Bool {
        return isPaired && connectedPeripheral != nil && pReader != nil && pWriter != nil
    }

    func connect(to peripheralID: UUID) {
        guard var metadata = state.discoveredPeripherals[peripheralID] else { return }
        centralManager.stopScan()
        metadata.connectionError = nil
        metadata.connectionState = .connecting
        state.discoveredPeripherals[peripheralID] = metadata
        state.scanning = false
        updateBackendState()
        currentContextLock.lock()
        currentContext = BLEConnectionContext()
        currentContextLock.unlock()
        centralManager.connect(metadata.peripheral, options: nil)
    }

    private func restartScan() {
        guard centralManager.state == .poweredOn,
            !centralManager.isScanning,
            connectedPeripheral == nil
        else { return }
        state.discoveredPeripherals.removeAll()
        state.scanning = true
        updateBackendState()
        centralManager.scanForPeripherals(
            withServices: [CBUUID(string: "e1511a45-f3db-44c0-82b8-6c880790d1f1")],
            options: nil
        )
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        // .unauthorized means BT permission is denied (we can't see if BT hardware is on or off)
        // .poweredOn means BT is on AND we have permission
        // .poweredOff means BT hardware is off (and we have permission to know this)
        state.bluetoothUnauthorized = centralManager.state == .unauthorized
        state.bluetoothAvailable = centralManager.state == .poweredOn || centralManager.state == .unauthorized

        updateBackendState()

        switch central.state {
        case .poweredOn:
            print("BLE: on")
            restartScan()
        case .unauthorized:
            print("BLE: permission denied")
            handleDisconnect()
        case .poweredOff:
            print("BLE: powered off")
            handleDisconnect()
        case .unsupported, .resetting, .unknown:
            print("BLE: unavailable (\(central.state))")
            handleDisconnect()
        @unknown default:
            print("BLE: unknown state")
            handleDisconnect()
        }
    }

    func centralManager(
        _ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any], rssi RSSI: NSNumber
    ) {
        let identifier = peripheral.identifier
        print("BLE: discovered \(peripheral.name ?? "unknown device")")
        if state.discoveredPeripherals[identifier] == nil {
            state.discoveredPeripherals[identifier] = PeripheralMetadata(
                peripheral: peripheral,
                discoveredDate: Date(),
                connectionState: .discovered
            )
            if let data = advertisementData["kCBAdvDataManufacturerData"] as? Data {
                let data = data.advanced(by: 2)  // 2 bytes for manufacturer ID
                print("BLE: manufacturer data: \(data.hexEncodedString())")
            }

            // Auto-connect if previously paired.
            // Skip if previously failed, so we don't go into an infinite connect loop.
            if pairedDeviceIdentifiers.contains(identifier.uuidString) {
                if !dontAutoConnectSet.contains(identifier) {
                    print("BLE: found bonded device \(identifier.uuidString), connecting...")
                    connect(to: identifier)
                } else {
                    print("BLE: skip auto-connect for device \(identifier.uuidString)")
                }
            }
        }

        // We update the state for the frontend even if we had already registered the device as the name may have been updated.
        updateBackendState()
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        print("BLE: Connected to \(peripheral.name ?? "unknown device")")

        state.discoveredPeripherals[peripheral.identifier]?.connectionError = nil

        connectedPeripheral = peripheral
        peripheral.delegate = self
        peripheral.discoverServices(nil)
    }

    func peripheralDidUpdateName(_ peripheral: CBPeripheral) {
        print("BLE: didUpdateName, new name: \(peripheral.name ?? "unknown device")")
        // The peripheral is already in our state, so we just update the frontend to show
        // the new name.
        updateBackendState()
    }

    func centralManager(
        _ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?
    ) {
        let errorMessage = error?.localizedDescription ?? "unknown error"
        state.discoveredPeripherals[peripheral.identifier]?.connectionState = .error
        state.discoveredPeripherals[peripheral.identifier]?.connectionError = errorMessage
        updateBackendState()
        dontAutoConnectSet.insert(peripheral.identifier)
        print("BLE: connection failed to \(peripheral.name ?? "unknown device"): \(errorMessage)")
        restartScan()
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            print("BLE: Error discovering services: \(error.localizedDescription)")
            return
        }

        if let services = peripheral.services {
            for service in services {
                print("BLE: Discovered service: \(service.uuid)")
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?
    ) {
        if let error = error {
            print("BLE: Error discovering characteristics: \(error.localizedDescription)")
            return
        }
        if let characteristics = service.characteristics {
            for c in characteristics {
                print("BLE: Discovered characteristic: \(c.uuid)")
                if c.uuid == CBUUID(string: "799d485c-d354-4ed0-b577-f8ee79ec275a") {
                    pWriter = c
                    let max_len = peripheral.maximumWriteValueLength(
                        for: CBCharacteristicWriteType.withoutResponse)
                    print(
                        "BLE: Found writer service with max length \(max_len) - \(c.properties.contains(.write))"
                    )
                }
                if c.uuid == CBUUID(string: "419572a5-9f53-4eb1-8db7-61bcab928867") {
                    peripheral.setNotifyValue(true, for: c)
                    pReader = c
                }
                if c.uuid == CBUUID(string: "9d1c9a77-8b03-4e49-8053-3955cda7da93") {
                    print("BLE: Found product characteristic")
                    peripheral.setNotifyValue(true, for: c)
                    pProduct = c
                }
            }
        }
    }

    func peripheral(
        _ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?
    ) {
        if let error = error {
            print("BLE: Error writing data: \(error)")
            return
        }
        //print("BLE: write ok")
    }

    func peripheral(
        _ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error = error {
            print("BLE: Error receiving data: \(error)")
            return
        }

        currentContextLock.lock()
        guard let ctx = currentContext else {
            currentContextLock.unlock()
            return
        }
        currentContextLock.unlock()

        if characteristic == pReader, let data = characteristic.value {
            if data.count != 64 {
                print("BLE: ERROR, expected 64 bytes")
            }
            print("BLE: received data: \(data.hexEncodedString())")
            ctx.readBufferLock.lock()
            ctx.readBuffer.append(data)
            ctx.readBufferLock.unlock()

            // Signal the semaphore to unblock `readBlocking`
            ctx.semaphore.signal()
        }
        if characteristic == pProduct {
            print("BLE: product changed: \(String(describing: parseProduct()))")
            // We can only read the product characteristic when paired.
            if !isPaired {
                isPaired = true
                // Add to paired devices
                pairedDeviceIdentifiers.insert(peripheral.identifier.uuidString)
            }
            state.discoveredPeripherals[peripheral.identifier]?.connectionState = .connected
            updateBackendState()
            // Invoke device manager to scan now, which will make it detect the device being connected
            // (or disconnected, in case the product string indicates that) now instead of waiting for
            // the next scan.
            MobileserverUsbUpdate()
        }
    }

    func handleDisconnect() {
        connectedPeripheral = nil
        pReader = nil
        pWriter = nil
        pProduct = nil
        state.discoveredPeripherals.removeAll()
        isPaired = false
        updateBackendState()

        // Have the backend scan right away, which will make it detect that we disconnected.
        // Otherwise there would be up to a second of delay (the backend device manager scan interval).
        MobileserverUsbUpdate()

        // Unblock a pending readBlocking() call if there is one.
        currentContextLock.lock()
        currentContext?.semaphore.signal()
        currentContext = nil
        currentContextLock.unlock()

        restartScan()
    }

    // This method gets called if the peripheral disconnects
    func centralManager(
        _ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?
    ) {
        print("BLE: peripheral disconnected")
        handleDisconnect()
    }

    struct ReadError: Error {
        let message: String
    }

    func readBlocking(length: Int) throws -> Data {
        if !isConnected() {
            throw ReadError(message: "not connected")
        }
        print("BLE: wants to read \(length)")

        currentContextLock.lock()
        guard let ctx = currentContext else {
            currentContextLock.unlock()
            throw ReadError(message: "no connection context")
        }
        currentContextLock.unlock()

        let currentID = ctx.identifier

        var data = Data()

        // Loop until we've read the required amount of data
        while data.count < length {
            // Block until BLE reader callback notifies us or the peripheral is disconnected.
            ctx.semaphore.wait()

            if !isConnected() {
                throw ReadError(message: "the peripheral has disconnected while reading")
            }
            currentContextLock.lock()
            let exit = currentContext?.identifier != currentID
            currentContextLock.unlock()
            if exit {
                throw ReadError(message: "the peripheral has disconnected while reading")
            }

            ctx.readBufferLock.lock()
            data.append(ctx.readBuffer.prefix(64))
            ctx.readBuffer.removeSubrange(..<64)
            ctx.readBufferLock.unlock()
        }
        print("BLE: got \(data.count)")

        return data
    }

    func parseProduct() -> ProductInfo? {
        guard let pProduct = self.pProduct,
            let value = pProduct.value
        else {
            return nil
        }

        if value.isEmpty {
            return nil
        }

        do {
            let decoder = JSONDecoder()
            let productInfo = try decoder.decode(ProductInfo.self, from: value)
            return productInfo
        } catch {
            print("BLE: Failed to parse product JSON: \(error)")
            return nil
        }
    }

    // Encode the Bluetooth state as JSON so it can be sent to the backend-
    func toJSON() -> String? {
        // Create a mirror of the Go structure
        struct PeripheralJSON: Codable {
            let identifier: String
            let name: String
            let connectionState: ConnectionState
            let connectionError: String?
        }

        struct StateJSON: Codable {
            let bluetoothAvailable: Bool
            let bluetoothUnauthorized: Bool
            let scanning: Bool
            let peripherals: [PeripheralJSON]
        }

        // Convert discoveredPeripherals to the JSON structure
        let peripherals = Array(state.discoveredPeripherals.values).map { metadata in
            PeripheralJSON(
                identifier: metadata.peripheral.identifier.uuidString,
                name: metadata.peripheral.name ?? "BitBox",
                connectionState: metadata.connectionState,
                connectionError: metadata.connectionError
            )
        }

        let state = StateJSON(
            bluetoothAvailable: state.bluetoothAvailable,
            bluetoothUnauthorized: state.bluetoothUnauthorized,
            scanning: state.scanning,
            peripherals: peripherals
        )

        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let jsonData = try encoder.encode(state)
            return String(data: jsonData, encoding: .utf8)
        } catch {
            print("JSON encoding error: \(error)")
            return nil
        }
    }

    func updateBackendState() {
        guard let jsonStr = toJSON() else {
            return
        }
        var error: NSError?
        let success = MobileserverBluetoothSetState(jsonStr, &error)
        if !success {
            print(
                "Failed to set Bluetooth backend state: \(error?.localizedDescription ?? "Unknown error")"
            )
        }
    }
}

// The interface is currently geared towards USB. For now we pretend to be a USB BitBox02 device.
// TODO: change interface to be more generic, and use data from the characteristics to determine the
// product, version, etc.
class BluetoothDeviceInfo: NSObject, MobileserverGoDeviceInfoInterfaceProtocol {
    private let bluetoothManager: BluetoothManager
    private let productInfo: ProductInfo

    init(bluetoothManager: BluetoothManager, productInfo: ProductInfo) {
        self.bluetoothManager = bluetoothManager
        self.productInfo = productInfo
        super.init()

    }

    func identifier() -> String {
        guard let connectedPeripheral = bluetoothManager.connectedPeripheral else {
            return ""
        }

        return connectedPeripheral.identifier.uuidString + "-" + productInfo.product
    }

    func interface() -> Int {
        return 0
    }

    func open() throws -> MobileserverGoReadWriteCloserInterfaceProtocol {
        return BluetoothReadWriteCloser(bluetoothManager: bluetoothManager)
    }

    func isBluetooth() -> Bool {
        return true
    }

    func product() -> String {
        // The characteristic product string is kept short, we translate it to the USB descriptor
        // string here, which the Go backend uses to identify the product.
        switch productInfo.product {
        case "bb02p-multi": return "BitBox02 Nova Multi"
        case "bb02p-btconly": return "BitBox02 Nova BTC-only"
        case "bb02p-bl-multi": return "BitBox02 Nova Multi bl"
        case "bb02p-bl-btconly": return "BitBox02 Nova BTC-only bl"
        default: return productInfo.product
        }
    }

    func vendorID() -> Int {
        return 0x03eb
    }

    func productID() -> Int {
        return 0x2403
    }

    func serial() -> String {
        // BitBox delivers the version with the `v` prefix, and adding it manually here can be
        // dropped at some point. Only testing firmwares before the first release did not include
        // the prefix.
        return productInfo.version.hasPrefix("v") ? productInfo.version : "v" + productInfo.version
    }

    func usagePage() -> Int {
        return 0
    }
}

class BluetoothReadWriteCloser: NSObject, MobileserverGoReadWriteCloserInterfaceProtocol {
    private let bluetoothManager: BluetoothManager
    private var max_mtu_len: Int

    init(bluetoothManager: BluetoothManager) {
        self.bluetoothManager = bluetoothManager
        self.max_mtu_len = 64
        // Maximum number of bytes that fit based on MTU
        guard let p = bluetoothManager.connectedPeripheral else {
            return
        }
        self.max_mtu_len =
            ((p.maximumWriteValueLength(for: CBCharacteristicWriteType.withoutResponse)) / 64)
            * 64
    }

    func close() throws {
    }

    func read(_ n: Int) throws -> Data {
        try bluetoothManager.readBlocking(length: n)
    }

    func write(_ data: Data?, n: UnsafeMutablePointer<Int>?) throws {
        guard let data = data, let p = bluetoothManager.connectedPeripheral,
            let pWriter = bluetoothManager.pWriter
        else {
            n!.pointee = 0
            return
        }

        // This is the max char len according to BLE firmware
        // only multiples of 64 are allowed
        let max_char_len = 5 * 64

        let len = min(max_char_len, max_mtu_len, data.count)

        bluetoothManager.connectedPeripheral!.writeValue(
            data[..<len], for: pWriter, type: .withResponse)
        n!.pointee = len
        print("BLE: write data (\(len) bytes): \(data[..<8].hexEncodedString())...")
    }
}

extension Data {
    func hexEncodedString() -> String {
        return map { String(format: "%02x", $0) }.joined()
    }
}
