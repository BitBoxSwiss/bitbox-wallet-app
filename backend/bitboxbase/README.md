# BitBox Base Integration

The code in this directory contains the logic needed for integration of the desktop app with the BitBox Base. There are two ways to connect with a BitBox Base.
- By connecting directly with the network address of the base
- Automatically by mdns

The package mdns implements these two connection variants. Both variants attempt a connection with the `TryMakeNewBase` function, given an ip. `TryMakeNewBase` will attempt to create a new `BitBoxBase` instance with `NewBitBoxBase`, given a valid ip. `NewBitBoxBase` calls the `Connect` function from the rpcclient package. Here, the connection is first checked with an initial get request. Subsequently a websocket connection is spawned. A noise 'XX' three part handshake is performed through the websocket connection with the base. Once the noise handshake is done, the base checks if user verification of the noise channel's binding hash has to be done. If yes, an event is emitted containing the pairing channel hash that the user can then compare with the base. All traffic from and to the base should be noise encrypted hereafter. The websocket is then passed to a separate goroutine where it listens indefinitely and emits events when receiving data.

To orchestrate between multiple connections, the backend keeps a map of connected BitBox Bases, by mapping from a unique ID assigned to each Base on connection to their instantiation. It also creates a `NewDetector` and gives it function callbacks to register and deregister BitBox Bases. This detector instance listens for new BitBox Bases on the local network indefinitely. When a new one is found, it calls `TryMakeNewBase`, and the passed-in register callback. The callback then triggers an event letting the frontend know that a new BitBox Base is registered. The frontend then gets all the registered BitBox Bases's IDs and starts listening for events. The callback also subscribes the backend to any events that the websocket connection with the Base emits and passes these to the websocket in the handlers package.

The handler also exposes a http POST endpoint that allows for direct connection with the base. For this, it passes an ip to the backend's detector instance that then subsequently calls `TryMakeNewBase`. 

When a detector, or bitboxbase is instantiated, a pointer to the backend's config is passed to them. This allows them to write new configurations to connect to the electrs server on the base. For this the handler exposes a 'connectelectrum' POST endpoint.

The communication between the BitBox Base and the wallet app is done with go's rpc package. Responses from rpc calls are written into data structures as defined in `rpcclient.go`. The rpcclient is also capable of receiving notifications. To this end a special notification byte is sent to the rpcclient's websocket and on receival triggers a corresponding rpc call.
