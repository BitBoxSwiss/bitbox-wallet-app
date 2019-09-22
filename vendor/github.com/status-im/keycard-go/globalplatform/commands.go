package globalplatform

import (
	"github.com/status-im/keycard-go/apdu"
	"github.com/status-im/keycard-go/globalplatform/crypto"
)

// Constants used in apdu commands and responses as defined by iso7816 and globalplatform.
const (
	ClaISO7816 = 0x00
	ClaGp      = 0x80
	ClaMac     = 0x84

	InsSelect               = 0xA4
	InsInitializeUpdate     = 0x50
	InsExternalAuthenticate = 0x82
	InsGetResponse          = 0xC0
	InsDelete               = 0xE4
	InsLoad                 = 0xE8
	InsInstall              = 0xE6
	InsGetStatus            = 0xF2

	P1ExternalAuthenticateCMAC         = 0x01
	P1InstallForLoad                   = 0x02
	P1InstallForInstall                = 0x04
	P1InstallForMakeSelectable         = 0x08
	P1LoadMoreBlocks                   = 0x00
	P1LoadLastBlock                    = 0x80
	P1GetStatusIssuerSecurityDomain    = 0x80
	P1GetStatusApplications            = 0x40
	P1GetStatusExecLoadFiles           = 0x20
	P1GetStatusExecLoadFilesAndModules = 0x10

	P2GetStatusTLVData = 0x02

	Sw1ResponseDataIncomplete = 0x61

	SwOK                            = 0x9000
	SwFileNotFound                  = 0x6A82
	SwReferencedDataNotFound        = 0x6A88
	SwSecurityConditionNotSatisfied = 0x6982
	SwAuthenticationMethodBlocked   = 0x6983

	tagDeleteAID         = 0x4F
	tagLoadFileDataBlock = 0xC4
	tagGetStatusAID      = 0x4F
)

// NewCommandSelect returns a Select command as defined in the globalplatform specifications.
func NewCommandSelect(aid []byte) *apdu.Command {
	c := apdu.NewCommand(
		ClaISO7816,
		InsSelect,
		0x04,
		0,
		aid,
	)

	return c
}

// NewCommandInitializeUpdate returns an Initialize Update command as defined in the globalplatform specifications.
func NewCommandInitializeUpdate(challenge []byte) *apdu.Command {
	c := apdu.NewCommand(
		ClaGp,
		InsInitializeUpdate,
		0,
		0,
		challenge,
	)

	// with T=0 we can both set or not the Le value
	// with T=1 it works only if Le is set
	c.SetLe(0x00)

	return c
}

// NewCommandExternalAuthenticate returns an External Authenticate command as defined in the globalplatform specifications.
func NewCommandExternalAuthenticate(encKey, cardChallenge, hostChallenge []byte) (*apdu.Command, error) {
	hostCryptogram, err := calculateHostCryptogram(encKey, cardChallenge, hostChallenge)
	if err != nil {
		return nil, err
	}

	return apdu.NewCommand(
		ClaMac,
		InsExternalAuthenticate,
		P1ExternalAuthenticateCMAC,
		0,
		hostCryptogram,
	), nil
}

// NewCommandGetResponse returns a Get Response command as defined in the globalplatform specifications.
func NewCommandGetResponse(length uint8) *apdu.Command {
	c := apdu.NewCommand(
		ClaISO7816,
		InsGetResponse,
		0,
		0,
		nil,
	)

	c.SetLe(length)

	return c
}

// NewCommandDelete returns a Delete command as defined in the globalplatform specifications.
func NewCommandDelete(aid []byte) *apdu.Command {
	data := []byte{tagDeleteAID, byte(len(aid))}
	data = append(data, aid...)

	return apdu.NewCommand(
		ClaGp,
		InsDelete,
		0,
		0,
		data,
	)
}

// NewCommandInstallForLoad returns an Install command with the install-for-load parameter as defined in the globalplatform specifications.
func NewCommandInstallForLoad(aid, sdaid []byte) *apdu.Command {
	data := []byte{byte(len(aid))}
	data = append(data, aid...)
	data = append(data, byte(len(sdaid)))
	data = append(data, sdaid...)
	// empty hash length and hash
	data = append(data, []byte{0x00, 0x00, 0x00}...)

	return apdu.NewCommand(
		ClaGp,
		InsInstall,
		P1InstallForLoad,
		0,
		data,
	)
}

// NewCommandInstallForInstall returns an Install command with the install-for-instalp parameter as defined in the globalplatform specifications.
func NewCommandInstallForInstall(pkgAID, appletAID, instanceAID, params []byte) *apdu.Command {
	data := []byte{byte(len(pkgAID))}
	data = append(data, pkgAID...)
	data = append(data, byte(len(appletAID)))
	data = append(data, appletAID...)
	data = append(data, byte(len(instanceAID)))
	data = append(data, instanceAID...)

	// privileges
	priv := []byte{0x00}
	data = append(data, byte(len(priv)))
	data = append(data, priv...)

	// params
	fullParams := []byte{byte(0xC9), byte(len(params))}
	fullParams = append(fullParams, params...)

	data = append(data, byte(len(fullParams)))
	data = append(data, fullParams...)

	// empty perform token
	data = append(data, byte(0x00))

	return apdu.NewCommand(
		ClaGp,
		InsInstall,
		P1InstallForInstall|P1InstallForMakeSelectable,
		0,
		data,
	)
}

// NewCommandGetStatus returns a Get Status command as defined in the globalplatform specifications.
func NewCommandGetStatus(aid []byte, p1 uint8) *apdu.Command {
	data := []byte{tagGetStatusAID}
	data = append(data, byte(len(aid)))
	data = append(data, aid...)

	return apdu.NewCommand(
		ClaGp,
		InsGetStatus,
		p1,
		P2GetStatusTLVData,
		data,
	)
}

func calculateHostCryptogram(encKey, cardChallenge, hostChallenge []byte) ([]byte, error) {
	var data []byte
	data = append(data, cardChallenge...)
	data = append(data, hostChallenge...)
	data = crypto.AppendDESPadding(data)

	return crypto.Mac3DES(encKey, data, crypto.NullBytes8)
}
