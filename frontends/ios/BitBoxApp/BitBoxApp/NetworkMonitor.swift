//
//  NetworkMonitor.swift
//  BitBoxApp
//
//  Created by Nikolas De Giorgis on 24/06/2025.
//

import Network
import Mobileserver

class NetworkMonitor {
	static let shared = NetworkMonitor()
	private let monitor = NWPathMonitor()
	private let queue = DispatchQueue(label: "NetworkMonitor")
	
	private init() {
		monitor.pathUpdateHandler = { path in
			let isOnline = path.status == .satisfied
			print("Network status changed: \(isOnline)")
			MobileserverOnlineStatusChanged(isOnline)
		}
		monitor.start(queue: queue)
	}
}
