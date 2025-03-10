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

struct State {
    var bluetoothAvailable: Bool
    var discoveredPeripherals: [UUID: PeripheralMetadata]
    var connecting: Bool
}

struct PeripheralMetadata {
    let peripheral: CBPeripheral
    let discoveredDate: Date
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

class BluetoothManager: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var state: State = State(bluetoothAvailable: false, discoveredPeripherals: [:], connecting: false)

    var centralManager: CBCentralManager!
    var connectedPeripheral: CBPeripheral?
    var pWriter: CBCharacteristic?
    var pReader: CBCharacteristic?
    var pProduct: CBCharacteristic?

    // Peripherals in this set will not be auto-connected even if previously paired.
    // This is for failed connections to not enter an infinite connect loop.
    private var dontAutoConnectSet: Set<UUID> = []

    private var readBuffer = Data()
    private let readBufferLock = NSLock()  // Ensure thread-safe buffer access
    private let semaphore = DispatchSemaphore(value: 0)

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
        state.bluetoothAvailable = centralManager.state == .poweredOn
        updateBackendState()
    }

    func isConnected() -> Bool {
        return connectedPeripheral != nil && pReader != nil && pWriter != nil;
    }

    func connect(to peripheralID: UUID) {
        guard let metadata = state.discoveredPeripherals[peripheralID] else { return }
        centralManager.stopScan()
        state.discoveredPeripherals[peripheralID]?.connectionError = nil
        state.connecting = true
        updateBackendState()
        centralManager.connect(metadata.peripheral, options: nil)
    }

    private func restartScan() {
        guard centralManager.state == .poweredOn,
              !centralManager.isScanning,
              connectedPeripheral == nil else { return }
        state.discoveredPeripherals.removeAll()
        updateBackendState()
        centralManager.scanForPeripherals(
          withServices: [CBUUID(string: "e1511a45-f3db-44c0-82b8-6c880790d1f1")],
          options: nil
        )
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        state.bluetoothAvailable = centralManager.state == .poweredOn
        updateBackendState()

        switch central.state {
        case .poweredOn:
            print("BLE: on")
            restartScan()
        case .poweredOff, .unauthorized, .unsupported, .resetting, .unknown:
            print("BLE: unavailable or not supported")
            connectedPeripheral = nil
            pReader = nil
            pWriter = nil
            pProduct = nil
            state.discoveredPeripherals.removeAll()
            state.connecting = false
            updateBackendState()
        @unknown default:
            print("BLE: Unknown Bluetooth state")
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let identifier = peripheral.identifier
        if state.discoveredPeripherals[identifier] == nil {
            state.discoveredPeripherals[identifier] = PeripheralMetadata(
                peripheral: peripheral,
                discoveredDate: Date()
            )
            print("BLE: discovered \(peripheral.name ?? "unknown device")")
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

            updateBackendState()
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        print("BLE: Connected to \(peripheral.name ?? "unknown device")")

        state.discoveredPeripherals[peripheral.identifier]?.connectionError = nil
        state.connecting = false
        updateBackendState()

        // Add to paired devices
        pairedDeviceIdentifiers.insert(peripheral.identifier.uuidString)

        connectedPeripheral = peripheral
        peripheral.delegate = self
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        let errorMessage = error?.localizedDescription ?? "unknown error"
        state.discoveredPeripherals[peripheral.identifier]?.connectionError = errorMessage
        state.connecting = false
        dontAutoConnectSet.insert(peripheral.identifier)
        updateBackendState()
        print("BLE: connection failed to \(peripheral.name ?? "unknown device"): \(errorMessage)")
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
        print("BLE: write ok")
    }

    func peripheral(
        _ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if let error = error {
            print("BLE: Error receiving data: \(error)")
            return
        }

        if characteristic == pReader, let data = characteristic.value {
            if data.count != 64 {
                print("BLE: ERROR, expected 64 bytes")
            }
            print("BLE: received data: \(data.hexEncodedString())")
            readBufferLock.lock()
            readBuffer.append(data)
            readBufferLock.unlock()

            // Signal the semaphore to unblock `readBlocking`
            semaphore.signal()
        }
        if characteristic == pProduct {
            print("BLE: product changed: \(String(describing: parseProduct()))")
            // Invoke device manager to scan now, which will make it detect the device being connected
            // (or disconnected, in case the product string indicates that) now instead of waiting for
            // the next scan.
            MobileserverUsbUpdate()
        }
    }

    // This method gets called if the peripheral disconnects
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        print("BLE: peripheral disconnected")
        connectedPeripheral = nil;
        pReader = nil;
        pWriter = nil;
        pProduct = nil;

        restartScan()
    }

    func readBlocking(length: Int) -> Data? {
        if !isConnected() {
            return nil
        }
        print("BLE: wants to read \(length)")

        var data = Data()

        // Loop until we've read the required amount of data
        while data.count < length {
            // Block until BLE reader callback notifies us
            semaphore.wait()
            readBufferLock.lock()
            data.append(readBuffer.prefix(64))
            readBuffer = readBuffer.advanced(by: 64)
            readBufferLock.unlock()
        }
        print("BLE: got \(data.count)")

        return data
    }

    func parseProduct() -> ProductInfo? {
        guard let pProduct = self.pProduct,
              let value = pProduct.value else {
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
            let connectionError: String?
        }

        struct StateJSON: Codable {
            let bluetoothAvailable: Bool
            let peripherals: [PeripheralJSON]
            let connecting: Bool
        }

        // Convert discoveredPeripherals to the JSON structure
        let peripherals = Array(state.discoveredPeripherals.values).map { metadata in
            PeripheralJSON(
                identifier: metadata.peripheral.identifier.uuidString,
                name: metadata.peripheral.name ?? "BitBox",
                connectionError: metadata.connectionError
            )
        }

        let state = StateJSON(bluetoothAvailable: state.bluetoothAvailable, peripherals: peripherals, connecting: state.connecting)

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
            print("Failed to set Bluetooth backend state: \(error?.localizedDescription ?? "Unknown error")")
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

    func product() -> String {
        // TODO: return bluetoothManager.productStr() and have the backend identify and handle it
        return productInfo.product
    }

    func vendorID() -> Int {
        return 0x03eb
    }

    func productID() -> Int {
        return 0x2403
    }

    func serial() -> String {
        return "v" + productInfo.version
    }

    func usagePage() -> Int {
        return 0
    }
}

class BluetoothReadWriteCloser: NSObject, MobileserverGoReadWriteCloserInterfaceProtocol {
    private let bluetoothManager: BluetoothManager

    init(bluetoothManager: BluetoothManager) {
        self.bluetoothManager = bluetoothManager
    }

    func close() throws {
    }

    func read(_ n: Int) throws -> Data {
        return bluetoothManager.readBlocking(length: n)!
    }

    func write(_ data: Data?, n: UnsafeMutablePointer<Int>?) throws {
        guard let pWriter = bluetoothManager.pWriter else {
            return
        }

        print("BLE: write data: \(data!.hexEncodedString())")

        bluetoothManager.connectedPeripheral!.writeValue(data!, for: pWriter, type: .withResponse)
        n!.pointee = data!.count
    }
}

extension Data {
    func hexEncodedString() -> String {
        return map { String(format: "%02x", $0) }.joined()
    }
}
