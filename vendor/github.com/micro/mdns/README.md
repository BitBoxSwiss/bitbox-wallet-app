# MDNS [![GoDoc](https://godoc.org/github.com/micro/mdns?status.svg)](https://godoc.org/github.com/micro/mdns)

MDNS is a simple mdns client/server library by Hashicorp.

We maintain a fork with updates for PRs and issues they have not merged or addressed.

## Overview

MDNS or Multicast DNS can be used to discover services on the local network without the use of an authoritative
DNS server. This enables peer-to-peer discovery. It is important to note that many
networks restrict the use of multicasting, which prevents mDNS from functioning.
Notably, multicast cannot be used in any sort of cloud, or shared infrastructure
environment. However it works well in most office, home, or private infrastructure
environments.

## Usage

Using the library is very simple, here is an example of publishing a service entry:

```go
package main

import (
	"github.com/micro/mdns"
	"os"
)

func main() {

	// Setup our service export
	host, _ := os.Hostname()
	info := []string{"My awesome service"}
	service, _ := mdns.NewMDNSService(host, "_foobar._tcp", "", "", 8000, nil, info)

	// Create the mDNS server, defer shutdown
	server, _ := mdns.NewServer(&mdns.Config{Zone: service})

	defer server.Shutdown()
}
```

Doing a lookup for service providers is also very simple:

```go
package main

import (
	"fmt"
	"github.com/micro/mdns"
)

func main() {

	// Make a channel for results and start listening
	entriesCh := make(chan *mdns.ServiceEntry, 8)
	go func() {
		for entry := range entriesCh {
			fmt.Printf("Got new entry: %v\n", entry)
		}
	}()

	// Start the lookup
	err := mdns.Lookup("_foobar._tcp", entriesCh)
	if err != nil {
		fmt.Println(err)
	}

	close(entriesCh)
}
```
