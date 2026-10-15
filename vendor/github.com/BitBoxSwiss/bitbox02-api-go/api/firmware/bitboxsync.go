// SPDX-License-Identifier: Apache-2.0

package firmware

import (
	"crypto/ed25519"

	"github.com/BitBoxSwiss/bitbox02-api-go/api/firmware/messages"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/errp"
	"github.com/BitBoxSwiss/bitbox02-api-go/util/semver"
)

const (
	bitBoxSyncChallengeLength           = 32
	bitBoxSyncWrapPublicKeyLen          = 32
	bitBoxSyncNamespaceIDLen            = 16
	bitBoxSyncNamespaceDEKLen           = 32
	bitBoxSyncInviteIDLen               = 16
	bitBoxSyncInviteServerSecretHashLen = 32
	bitBoxSyncWrappedDEKLenV1           = 97
)

var bitBoxSyncMinVersion = semver.NewSemVer(9, 27, 0)

// BitBoxSyncIdentity contains the public keys of the hardware BitBoxSync identity.
type BitBoxSyncIdentity struct {
	AuthPublicKey ed25519.PublicKey
	WrapPublicKey []byte
}

func requireLen(name string, value []byte, expected int) error {
	if len(value) != expected {
		return errp.Newf("%s must be %d bytes", name, expected)
	}
	return nil
}

func (device *Device) queryBitBoxSync(request *messages.BitBoxSyncRequest) (*messages.BitBoxSyncResponse, error) {
	if !device.version.AtLeast(bitBoxSyncMinVersion) {
		return nil, UnsupportedError(bitBoxSyncMinVersion.String())
	}
	response, err := device.query(&messages.Request{
		Request: &messages.Request_BitboxSync{
			BitboxSync: request,
		},
	})
	if err != nil {
		return nil, err
	}
	bitBoxSyncResponse, ok := response.Response.(*messages.Response_BitboxSync)
	if !ok {
		return nil, errp.New("unexpected response")
	}
	return bitBoxSyncResponse.BitboxSync, nil
}

// BitBoxSyncIdentity returns the hardware BitBoxSync identity public keys.
func (device *Device) BitBoxSyncIdentity() (*BitBoxSyncIdentity, error) {
	response, err := device.queryBitBoxSync(&messages.BitBoxSyncRequest{
		Request: &messages.BitBoxSyncRequest_Identity{
			Identity: &messages.BitBoxSyncIdentityRequest{},
		},
	})
	if err != nil {
		return nil, err
	}
	identity := response.GetIdentity()
	if identity == nil {
		return nil, errp.New("unexpected response")
	}
	if err := requireLen("auth public key", identity.AuthPublicKey, ed25519.PublicKeySize); err != nil {
		return nil, err
	}
	if err := requireLen("wrap public key", identity.WrapPublicKey, bitBoxSyncWrapPublicKeyLen); err != nil {
		return nil, err
	}
	return &BitBoxSyncIdentity{
		AuthPublicKey: ed25519.PublicKey(identity.AuthPublicKey),
		WrapPublicKey: identity.WrapPublicKey,
	}, nil
}

func (device *Device) bitBoxSyncSignature(request *messages.BitBoxSyncRequest) ([]byte, error) {
	response, err := device.queryBitBoxSync(request)
	if err != nil {
		return nil, err
	}
	signature := response.GetSignature()
	if signature == nil {
		return nil, errp.New("unexpected response")
	}
	if err := requireLen("signature", signature.Signature, ed25519.SignatureSize); err != nil {
		return nil, err
	}
	return signature.Signature, nil
}

// BitBoxSyncSignLoginIntent signs the canonical BitBoxSync login intent.
func (device *Device) BitBoxSyncSignLoginIntent(challenge []byte) ([]byte, error) {
	if err := requireLen("challenge", challenge, bitBoxSyncChallengeLength); err != nil {
		return nil, err
	}
	return device.bitBoxSyncSignature(&messages.BitBoxSyncRequest{
		Request: &messages.BitBoxSyncRequest_SignLoginIntent{
			SignLoginIntent: &messages.BitBoxSyncSignLoginIntentRequest{
				Challenge: challenge,
			},
		},
	})
}

// BitBoxSyncSignRefreshIntent signs the canonical BitBoxSync refresh intent.
func (device *Device) BitBoxSyncSignRefreshIntent(challenge []byte) ([]byte, error) {
	if err := requireLen("challenge", challenge, bitBoxSyncChallengeLength); err != nil {
		return nil, err
	}
	return device.bitBoxSyncSignature(&messages.BitBoxSyncRequest{
		Request: &messages.BitBoxSyncRequest_SignRefreshIntent{
			SignRefreshIntent: &messages.BitBoxSyncSignRefreshIntentRequest{
				Challenge: challenge,
			},
		},
	})
}

// BitBoxSyncSignRevokeAllTokensIntent signs the canonical BitBoxSync revoke-all-tokens intent.
func (device *Device) BitBoxSyncSignRevokeAllTokensIntent(challenge []byte) ([]byte, error) {
	if err := requireLen("challenge", challenge, bitBoxSyncChallengeLength); err != nil {
		return nil, err
	}
	return device.bitBoxSyncSignature(&messages.BitBoxSyncRequest{
		Request: &messages.BitBoxSyncRequest_SignRevokeAllTokensIntent{
			SignRevokeAllTokensIntent: &messages.BitBoxSyncSignRevokeAllTokensIntentRequest{
				Challenge: challenge,
			},
		},
	})
}

// BitBoxSyncSignCreateNamespaceInviteIntent signs the canonical BitBoxSync create-namespace-invite intent.
func (device *Device) BitBoxSyncSignCreateNamespaceInviteIntent(
	challenge, namespaceID, inviteID, inviteServerSecretHash []byte,
	expiresAt uint64,
	maxAccepted uint32,
) ([]byte, error) {
	if err := requireLen("challenge", challenge, bitBoxSyncChallengeLength); err != nil {
		return nil, err
	}
	if err := requireLen("namespace ID", namespaceID, bitBoxSyncNamespaceIDLen); err != nil {
		return nil, err
	}
	if err := requireLen("invite ID", inviteID, bitBoxSyncInviteIDLen); err != nil {
		return nil, err
	}
	if err := requireLen("invite server secret hash", inviteServerSecretHash, bitBoxSyncInviteServerSecretHashLen); err != nil {
		return nil, err
	}
	return device.bitBoxSyncSignature(&messages.BitBoxSyncRequest{
		Request: &messages.BitBoxSyncRequest_SignCreateNamespaceInviteIntent{
			SignCreateNamespaceInviteIntent: &messages.BitBoxSyncSignCreateNamespaceInviteIntentRequest{
				Challenge:              challenge,
				NamespaceId:            namespaceID,
				InviteId:               inviteID,
				InviteServerSecretHash: inviteServerSecretHash,
				ExpiresAt:              expiresAt,
				MaxAccepted:            maxAccepted,
			},
		},
	})
}

// BitBoxSyncSignJoinRequestIntent signs the canonical BitBoxSync join-request payload.
func (device *Device) BitBoxSyncSignJoinRequestIntent(
	namespaceID, inviteID []byte,
	serverOrigin string,
	expiresAt uint64,
) ([]byte, error) {
	if err := requireLen("namespace ID", namespaceID, bitBoxSyncNamespaceIDLen); err != nil {
		return nil, err
	}
	if err := requireLen("invite ID", inviteID, bitBoxSyncInviteIDLen); err != nil {
		return nil, err
	}
	return device.bitBoxSyncSignature(&messages.BitBoxSyncRequest{
		Request: &messages.BitBoxSyncRequest_SignJoinRequestIntent{
			SignJoinRequestIntent: &messages.BitBoxSyncSignJoinRequestIntentRequest{
				NamespaceId:  namespaceID,
				InviteId:     inviteID,
				ServerOrigin: serverOrigin,
				ExpiresAt:    expiresAt,
			},
		},
	})
}

// BitBoxSyncUnwrapNamespaceDEK unwraps a namespace DEK with the hardware BitBoxSync identity.
func (device *Device) BitBoxSyncUnwrapNamespaceDEK(namespaceID, wrappedDEK []byte) ([]byte, error) {
	if err := requireLen("namespace ID", namespaceID, bitBoxSyncNamespaceIDLen); err != nil {
		return nil, err
	}
	if err := requireLen("wrapped DEK", wrappedDEK, bitBoxSyncWrappedDEKLenV1); err != nil {
		return nil, err
	}
	response, err := device.queryBitBoxSync(&messages.BitBoxSyncRequest{
		Request: &messages.BitBoxSyncRequest_UnwrapNamespaceDek{
			UnwrapNamespaceDek: &messages.BitBoxSyncUnwrapNamespaceDEKRequest{
				NamespaceId: namespaceID,
				WrappedDek:  wrappedDEK,
			},
		},
	})
	if err != nil {
		return nil, err
	}
	unwrapped := response.GetUnwrapNamespaceDek()
	if unwrapped == nil {
		return nil, errp.New("unexpected response")
	}
	if err := requireLen("namespace DEK", unwrapped.NamespaceDek, bitBoxSyncNamespaceDEKLen); err != nil {
		return nil, err
	}
	return unwrapped.NamespaceDek, nil
}
