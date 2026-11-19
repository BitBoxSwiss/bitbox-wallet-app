# go-bip39

A golang implementation of the BIP0039 spec for mnemonic seeds

## Example

```go
package main

import (
  "github.com/base/go-bip39"
  "fmt"
)

func main(){
  // Generate a mnemonic for memorization or user-friendly seeds
  entropy, _ := bip39.NewEntropy(256)
  mnemonic, _ := bip39.NewMnemonic(entropy)

  // Display mnemonic and keys
  fmt.Println("Mnemonic: ", mnemonic)
}
```

## Credits

Wordlists are from the [bip39 spec](https://github.com/bitcoin/bips/tree/master/bip-0039).

Test vectors are from the standard Python BIP0039 implementation from the
Trezor team: [https://github.com/trezor/python-mnemonic](https://github.com/trezor/python-mnemonic)
