//
//  Bluetooth.swift
//  BitBoxApp
//
//  Created by dev on 14.01.2025.
//

import CoreBluetooth
import Mobileserver


class BluetoothManager: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    var centralManager: CBCentralManager!
    var discoveredPeripheral: CBPeripheral?
    var pWriter: CBCharacteristic?
    var pReader: CBCharacteristic?
    var pProduct: CBCharacteristic?

    private var readBuffer = Data()
    private let readBufferLock = NSLock() // Ensure thread-safe buffer access
    private let semaphore = DispatchSemaphore(value: 0)

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }

    func isConnected() -> Bool {
        return discoveredPeripheral != nil && pReader != nil && pWriter != nil;
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            print("Bluetooth on")
            centralManager.scanForPeripherals(
                withServices: [CBUUID(string: "e1511a45-f3db-44c0-82b8-6c880790d1f1")],
                options: nil)
        case .poweredOff, .unauthorized, .unsupported, .resetting, .unknown:
            print("Bluetooth unavailable or not supported")
            discoveredPeripheral = nil
            pReader = nil
            pWriter = nil
        @unknown default:
            print("Unknown Bluetooth state")
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        print("Bluetooth: discovered \(peripheral.name ?? "unknown device")")
        discoveredPeripheral = peripheral
        centralManager.stopScan()
        centralManager.connect(peripheral, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        print("Connected to \(peripheral.name ?? "unknown device")")

        peripheral.delegate = self
        peripheral.discoverServices(nil)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            print("Error discovering services: \(error.localizedDescription)")
            return
        }

        if let services = peripheral.services {
            for service in services {
                print("Discovered service: \(service.uuid)")
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error = error {
            print("Error discovering characteristics: \(error.localizedDescription)")
            return
        }
        if let characteristics = service.characteristics {
            for c in characteristics {
                print("Discovered characteristic: \(c.uuid)")
                if c.uuid == CBUUID(string: "0001") {
                    pWriter = c
                    let max_len = peripheral.maximumWriteValueLength(for: CBCharacteristicWriteType.withoutResponse)
                    print("Found writer service with max length \(max_len) - \(c.properties.contains(.write))")
                }
                if c.uuid == CBUUID(string: "0002") {
                    pReader = c
                }
                if c.uuid == CBUUID(string: "0003") {
                    print("Found product characteristic")
                    peripheral.setNotifyValue(true, for: c)
                    pProduct = c
                }
            }
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            print("Bluetooth error writing data: \(error)")
            return
        }
        print("Blluetooth write ok")
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            print("Error receiving data: \(error)")
            return
        }

        if characteristic == pReader, let data = characteristic.value {
            print("Bluetooth received data: \(data.hexEncodedString())")
            readBufferLock.lock()
            readBuffer.append(data)
            readBufferLock.unlock()

            // Signal the semaphore to unblock `readBlocking`
            semaphore.signal()
        }
        if characteristic == pProduct, let val = characteristic.value {
            print("Bluetooth product changed: \(val)")
            // Invoke device manager to scan now, which will make it detect the device being connected
            // (or disconnected, in case the product string indicates that) now instead of waiting for
            // the next scan.
            MobileserverUsbUpdate()
        }
    }

    // This method gets called if the peripheral disconnects
    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        print("Bluetooth disconnected")
        discoveredPeripheral = nil;
        pReader = nil;
        pWriter = nil;

        // TODO: start scanning again.
    }

    func readBlocking(length: Int) -> Data? {
        guard let pReader = pReader else {
            print("pReader is not set")
            return nil
        }
        guard let peripheral = discoveredPeripheral else {
            print("discoveredPeripheral is not set")
            return nil
        }
        print("Bluetooth wants to read \(length)")
        readBufferLock.lock()
        readBuffer.removeAll() // Clear buffer before starting
        readBufferLock.unlock()

        // Loop until we've read the required amount of data
        while readBuffer.count < length {
            // Trigger a read request
            peripheral.readValue(for: pReader)
            // Block until the delegate signals
            semaphore.wait()
        }
        print("Bluetooth read: need \(length), got \(readBuffer.count)")
        readBufferLock.lock()
        let data = readBuffer.prefix(length)
        readBufferLock.unlock()

        return data
    }
    
    func productStr() -> String {
        guard let pProduct = self.pProduct else {
            return ""
        }
        guard let value = pProduct.value else {
            return ""
        }
        return String(data: value, encoding: .utf8) ?? ""
    }
}

// The interface is currently geared towards USB. For now we pretend to be a USB BitBox02 device.
// TODO: change interface to be more generic, and use data from the characteristics to determine the
// product, version, etc.
class BluetoothDeviceInfo: NSObject, MobileserverGoDeviceInfoInterfaceProtocol {
    private let bluetoothManager: BluetoothManager

    init(bluetoothManager: BluetoothManager) {
        self.bluetoothManager = bluetoothManager
        super.init()

    }

    func identifier() -> String {
        guard let discoveredPeripheral = bluetoothManager.discoveredPeripheral else {
            return ""
        }

        return discoveredPeripheral.identifier.uuidString
    }

    func interface() -> Int {
        return 0
    }

    func open() throws -> MobileserverGoReadWriteCloserInterfaceProtocol {
       return BluetoothReadWriteCloser(bluetoothManager: bluetoothManager)
    }

    func product() -> String {
        // TODO: return bluetoothManager.productStr() and have the backend identify and handle it
        return "BitBox02BTC"
    }

    func vendorID() -> Int {
        return 0x03eb
    }

    func productID() -> Int {
        return 0x2403
    }

    func serial() -> String {
        return "v9.21.0"
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

        print("Bluetooth write data: \(data!.hexEncodedString())")

        bluetoothManager.discoveredPeripheral!.writeValue(data!, for: pWriter, type: .withResponse)
        n!.pointee = data!.count;
    }
}

extension Data {
    func hexEncodedString() -> String {
        return map { String(format: "%02x", $0) }.joined()
    }
}
