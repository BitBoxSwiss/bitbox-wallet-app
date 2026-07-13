// SPDX-License-Identifier: Apache-2.0

package lightning

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/BitBoxSwiss/bitbox-wallet-app/backend/config"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/errp"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable"
	"github.com/BitBoxSwiss/bitbox-wallet-app/util/observable/action"
	"github.com/breez/breez-sdk-spark-go/breez_sdk_spark"
)

const (
	lightningAddressDescription       = "BitBoxApp Lightning wallet"
	lightningAddressNumberMax         = 10000
	maxLightningAddressAttempts       = 5
	maxLightningAddressUsernameLength = 64
	lightningAddressChangeCooldown    = 24 * time.Hour
)

const (
	errLightningAddressInvalidUsername     errp.ErrorCode = "lightningAddressInvalidUsername"
	errLightningAddressUsernameUnavailable errp.ErrorCode = "lightningAddressUsernameUnavailable"
	errLightningAddressChangeCooldown      errp.ErrorCode = "lightningAddressChangeCooldown"
)

var lightningAddressUsernameRegexp = regexp.MustCompile(`^[a-z0-9]+$`)
var lightningAddressNow = time.Now

// AddressAvailability describes whether a Lightning address username can be registered.
type AddressAvailability struct {
	GeneratedAddress
	Available bool `json:"available"`
}

// GeneratedAddress is an available Lightning address suggestion.
type GeneratedAddress struct {
	Username string `json:"username"`
	Address  string `json:"address"`
}

func lightningAddressString(info *breez_sdk_spark.LightningAddressInfo) *string {
	if info == nil {
		return nil
	}
	return &info.LightningAddress
}

func (lightning *Lightning) lightningAddressForUsername(username string) string {
	return username + "@" + lightning.lnurlDomain()
}

func normalizeLightningAddressUsername(username string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(username))
	if len(normalized) > maxLightningAddressUsernameLength ||
		!lightningAddressUsernameRegexp.MatchString(normalized) {
		return "", errLightningAddressInvalidUsername
	}
	return normalized, nil
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

func (lightning *Lightning) checkLightningAddressAvailable(username string) (bool, error) {
	available, err := lightning.sdkService.CheckLightningAddressAvailable(
		breez_sdk_spark.CheckLightningAddressRequest{
			Username: username,
		},
	)
	if err != nil {
		return false, errp.Wrap(err, "breez: check lightning address availability")
	}
	return available, nil
}

func (lightning *Lightning) generatedLightningAddressCandidate() (*GeneratedAddress, error) {
	username, err := generateLightningAddressUsername(rand.Reader)
	if err != nil {
		return nil, errp.Wrap(err, "generate lightning address username")
	}

	available, err := lightning.checkLightningAddressAvailable(username)
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, nil
	}

	return &GeneratedAddress{
		Username: username,
		Address:  lightning.lightningAddressForUsername(username),
	}, nil
}

// GenerateAddress returns an available Lightning address suggestion.
func (lightning *Lightning) GenerateAddress() (*GeneratedAddress, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}

	for attempt := 0; attempt < maxLightningAddressAttempts; attempt++ {
		generatedAddress, err := lightning.generatedLightningAddressCandidate()
		if err != nil {
			return nil, err
		}
		if generatedAddress == nil {
			continue
		}

		return generatedAddress, nil
	}

	return nil, errp.New("could not find an available lightning address username")
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
		generatedAddress, err := lightning.generatedLightningAddressCandidate()
		if err != nil {
			return nil, err
		}
		if generatedAddress == nil {
			continue
		}

		description := lightningAddressDescription
		registeredAddress, err := lightning.sdkService.RegisterLightningAddress(
			breez_sdk_spark.RegisterLightningAddressRequest{
				Username:    generatedAddress.Username,
				Description: &description,
			},
		)
		if err != nil {
			// The username can be claimed between the availability check and registration.
			available, checkErr := lightning.checkLightningAddressAvailable(generatedAddress.Username)
			if checkErr == nil && !available {
				continue
			}
			return nil, errp.Wrap(err, "breez: register lightning address")
		}
		address := lightningAddressString(&registeredAddress)
		lightning.Notify(observable.Event{
			Subject: "lightning/address",
			Action:  action.Replace,
			Object:  address,
		})
		return address, nil
	}

	return nil, errp.New("could not find an available lightning address username")
}

func (lightning *Lightning) lightningAddress() (*string, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}

	address, err := lightning.sdkService.GetLightningAddress()
	if err != nil {
		return nil, errp.Wrap(err, "breez: get lightning address")
	}
	return lightningAddressString(address), nil
}

// AddressDomain returns the configured LNURL domain for Lightning addresses.
func (lightning *Lightning) AddressDomain() string {
	return lightning.lnurlDomain()
}

// AddressAvailability checks whether a Lightning address username is available.
func (lightning *Lightning) AddressAvailability(username string) (*AddressAvailability, error) {
	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}

	normalizedUsername, err := normalizeLightningAddressUsername(username)
	if err != nil {
		return nil, err
	}

	available, err := lightning.checkLightningAddressAvailable(normalizedUsername)
	if err != nil {
		return nil, err
	}

	return &AddressAvailability{
		GeneratedAddress: GeneratedAddress{
			Username: normalizedUsername,
			Address:  lightning.lightningAddressForUsername(normalizedUsername),
		},
		Available: available,
	}, nil
}

func (lightning *Lightning) setLightningAddressLastChangedAt(changedAt time.Time) error {
	if err := lightning.backendConfig.ModifyLightningConfig(func(cfg *config.LightningConfig) error {
		if len(cfg.Accounts) == 0 {
			return errp.New("Lightning not initialized")
		}
		cfg.Accounts[0].LightningAddressLastChangedAt = &changedAt
		return nil
	}); err != nil {
		return errp.Wrap(err, "Error updating lightning address change timestamp")
	}
	return nil
}

// RegisterAddress registers the Lightning address for the given username.
func (lightning *Lightning) RegisterAddress(username string) (*string, error) {
	lightning.lightningAddressLock.Lock()
	defer lightning.lightningAddressLock.Unlock()

	if err := lightning.CheckActive(); err != nil {
		return nil, err
	}

	normalizedUsername, err := normalizeLightningAddressUsername(username)
	if err != nil {
		return nil, err
	}

	existingAddress, err := lightning.sdkService.GetLightningAddress()
	if err != nil {
		return nil, errp.Wrap(err, "breez: get lightning address")
	}
	if existingAddress != nil && existingAddress.Username == normalizedUsername {
		account := lightning.Account()
		if account != nil && account.LightningAddressLastChangedAt == nil {
			if err := lightning.setLightningAddressLastChangedAt(lightningAddressNow()); err != nil {
				lightning.log.WithError(err).Warn("Lightning address changed, but cooldown timestamp was not persisted")
			}
		}
		return lightningAddressString(existingAddress), nil
	}

	account := lightning.Account()
	if account == nil {
		return nil, errp.New("Lightning not initialized")
	}
	if account.LightningAddressLastChangedAt != nil &&
		lightningAddressNow().Sub(*account.LightningAddressLastChangedAt) < lightningAddressChangeCooldown {
		return nil, errLightningAddressChangeCooldown
	}

	available, err := lightning.checkLightningAddressAvailable(normalizedUsername)
	if err != nil {
		return nil, err
	}
	if !available {
		return nil, errLightningAddressUsernameUnavailable
	}

	description := lightningAddressDescription
	registeredAddress, err := lightning.sdkService.RegisterLightningAddress(
		breez_sdk_spark.RegisterLightningAddressRequest{
			Username:    normalizedUsername,
			Description: &description,
		},
	)
	if err != nil {
		available, checkErr := lightning.checkLightningAddressAvailable(normalizedUsername)
		if checkErr == nil && !available {
			return nil, errLightningAddressUsernameUnavailable
		}
		return nil, errp.Wrap(err, "breez: register lightning address")
	}

	address := lightningAddressString(&registeredAddress)
	if err := lightning.setLightningAddressLastChangedAt(lightningAddressNow()); err != nil {
		lightning.log.WithError(err).Warn("Lightning address changed, but cooldown timestamp was not persisted")
	}
	lightning.Notify(observable.Event{
		Subject: "lightning/address",
		Action:  action.Replace,
		Object:  address,
	})
	return address, nil
}

// LightningAddress returns the registered LNURL-pay lightning address.
func (lightning *Lightning) LightningAddress() (*string, error) {
	return lightning.lightningAddress()
}
