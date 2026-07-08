// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"

	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

const (
	lightningAddressDescription = "BitBoxApp Lightning wallet"
	lightningAddressNumberMax   = 10000
	maxLightningAddressAttempts = 5
)

func lightningAddressString(info *breez_sdk_spark.LightningAddressInfo) *string {
	if info == nil {
		return nil
	}
	return &info.LightningAddress
}

func generateLightningAddressUsername(random io.Reader) (string, error) {
	adjective, err := randomElement(random, lightningAddressAdjectives)
	if err != nil {
		return "", err
	}
	noun, err := randomElement(random, lightningAddressNouns)
	if err != nil {
		return "", err
	}
	number, err := rand.Int(random, big.NewInt(lightningAddressNumberMax))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s%s%04d", adjective, noun, number.Int64()), nil
}

func randomElement(random io.Reader, values []string) (string, error) {
	index, err := rand.Int(random, big.NewInt(int64(len(values))))
	if err != nil {
		return "", err
	}
	return values[index.Int64()], nil
}

func (lightning *Lightning) ensureLightningAddress() (*string, error) {
	lightning.lightningAddressLock.Lock()
	defer lightning.lightningAddressLock.Unlock()

	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}

	existingAddress, err := lightning.sdkService.GetLightningAddress()
	if err != nil {
		return nil, errp.Wrap(err, "breez: get lightning address")
	}
	if existingAddress != nil {
		return lightningAddressString(existingAddress), nil
	}

	for attempt := 0; attempt < maxLightningAddressAttempts; attempt++ {
		username, err := generateLightningAddressUsername(rand.Reader)
		if err != nil {
			return nil, errp.Wrap(err, "generate lightning address username")
		}

		available, err := lightning.sdkService.CheckLightningAddressAvailable(
			breez_sdk_spark.CheckLightningAddressRequest{
				Username: username,
			},
		)
		if err != nil {
			return nil, errp.Wrap(err, "breez: check lightning address availability")
		}
		if !available {
			continue
		}

		description := lightningAddressDescription
		registeredAddress, err := lightning.sdkService.RegisterLightningAddress(
			breez_sdk_spark.RegisterLightningAddressRequest{
				Username:    username,
				Description: &description,
			},
		)
		if err != nil {
			// The username can be claimed between the availability check and registration.
			available, checkErr := lightning.sdkService.CheckLightningAddressAvailable(
				breez_sdk_spark.CheckLightningAddressRequest{
					Username: username,
				},
			)
			if checkErr == nil && !available {
				continue
			}
			return nil, errp.Wrap(err, "breez: register lightning address")
		}
		return lightningAddressString(&registeredAddress), nil
	}

	return nil, errp.New("could not find an available lightning address username")
}

// LightningAddress returns the registered LNURL-pay lightning address, registering one if needed.
func (lightning *Lightning) LightningAddress() (*string, error) {
	return lightning.ensureLightningAddress()
}
