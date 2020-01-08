package rpcmessages

// ErrorCode is a unique and short string code represeting an Error
type ErrorCode string

// JSONWebTokenInvalid is thrown when the authentication with the provided token has failed. This can happen for both an expired token and
// if the token is invalid.
const JSONWebTokenInvalid ErrorCode = "JSONWEBTOKEN_INVALID"

const (

	// ExecutableNotFound is thrown when a executable is not found.
	// This can for example be a script (e.g. bbb-cmd.sh or bbb-config.sh) or a executable like `reboot`
	ExecutableNotFound ErrorCode = "EXECUTABLE_NOT_FOUND"

	// ErrorScriptNotSuperuser is thrown if a run scripts need to be run as superuser.
	ErrorScriptNotSuperuser ErrorCode = "SCRIPT_NOT_RUN_AS_SUPERUSER"

	// ErrorScriptIncludesNotFound is thrown when a script includes other bash functions, but the inclusion path (in the script) is invalid.
	ErrorScriptIncludesNotFound = "SCRIPT_INCLUDES_NOT_FOUND"

	// ErrorRedisError is a general Redis related error.
	// There is no differentiation of Redis errors because the front-end most likely handles them similar.
	ErrorRedisError ErrorCode = "REDIS_ERROR"

	// ErrorPrometheusError is a general Prometheus related error.
	// There is no differentiation of Prometheus errors because the front-end most likely handles them similar.
	ErrorPrometheusError ErrorCode = "PROMETHEUS_ERROR"

	// ErrorUnexpected is thrown when a a unknown/unhandled/unexpected error occurs.
	// It's a catch-all error.
	ErrorUnexpected ErrorCode = "UNEXPECTED_ERROR"
)

const (

	// ErrorCmdScriptInvalidArg is thrown if the argument for the bbb-cmd.sh script is not known.
	// Not to be confused with ErrorConfigScriptInvalidArg which is for the bbb-config.sh.
	ErrorCmdScriptInvalidArg ErrorCode = "CMD_SCRIPT_INVALID_ARG"

	/* bbb-cmd.sh flashdrive check
	-------------------------------*/

	// ErrorFlashdriveCheckMultiple is thrown if multiple USB flashdrives are found. Needs exactly one.
	ErrorFlashdriveCheckMultiple ErrorCode = "FLASHDRIVE_CHECK_MULTI"
	// ErrorFlashdriveCheckNone is thrown if no USB flashdrive is found.
	ErrorFlashdriveCheckNone ErrorCode = "FLASHDRIVE_CHECK_NONE"

	/* bbb-cmd.sh flashdrive mount <path>
	-------------------------------------*/

	// ErrorFlashdriveMountNotFound is thrown if no flashdrive found on the passed <path>.
	ErrorFlashdriveMountNotFound ErrorCode = "FLASHDRIVE_MOUNT_NOT_FOUND"
	// ErrorFlashdriveMountNotUnique is thrown if the passed <path> does not uniquely identify a flashdrive.
	ErrorFlashdriveMountNotUnique ErrorCode = "FLASHDRIVE_MOUNT_NOT_UNIQUE"
	// ErrorFlashdriveMountNotSupported is thrown if the flashdrive is either bigger than 64GB or the filesystem is not supported.
	ErrorFlashdriveMountNotSupported ErrorCode = "FLASHDRIVE_MOUNT_NOT_SUPPORTED"

	/* bbb-cmd.sh flashdrive unmount
	---------------------------------*/

	// ErrorFlashdriveUnmountNotMounted is thrown if there is no flashdrive to unmount at /mnt/backup.
	ErrorFlashdriveUnmountNotMounted ErrorCode = "FLASHDRIVE_UNMOUNT_NOT_MOUNTED"

	/* bbb-cmd.sh backup sysconfig
	-------------------------------*/

	// ErrorBackupSysconfigNotAMountpoint is thrown if /mnt/backup is no mountpoint. It's needed to backup the sysconfig.
	ErrorBackupSysconfigNotAMountpoint ErrorCode = "BACKUP_SYSCONFIG_NOT_A_MOUNTPOINT"

	/* bbb-cmd.sh restore sysconfig
	--------------------------------*/

	// ErrorRestoreSysconfigBackupNotFound is thrown if the backup file /mnt/backup/bbb-backup.rdb is not found.
	ErrorRestoreSysconfigBackupNotFound ErrorCode = "RESTORE_SYSCONFIG_BACKUP_NOT_FOUND"

	/* bbb-cmd.sh mender-update
	----------------------------*/

	// ErrorMenderUpdateImageNotMenderEnabled is thrown if the image is not mender enabled.
	ErrorMenderUpdateImageNotMenderEnabled ErrorCode = "MENDER_UPDATE_IMAGE_NOT_MENDER_ENABLED"

	/* bbb-cmd.sh mender-update install <version>
	------------------------------------*/

	// ErrorMenderUpdateInstallFailed is thrown if `mender -install` failed.
	ErrorMenderUpdateInstallFailed ErrorCode = "MENDER_UPDATE_INSTALL_FAILED"

	// ErrorMenderUpdateNoVersion thrown if no Base image version passed to the script.
	ErrorMenderUpdateNoVersion ErrorCode = "MENDER_UPDATE_NO_VERSION"

	// ErrorMenderUpdateInvalidVersion is thrown if an invalid Base image version passed to the script.
	ErrorMenderUpdateInvalidVersion ErrorCode = "MENDER_UPDATE_INVALID_VERSION"

	// ErrorMenderUpdateAlreadyInProgress is thrown by the middleware, if an update is already in progress.
	ErrorMenderUpdateAlreadyInProgress ErrorCode = "MENDER_UPDATE_ALREADY_IN_PROGRESS"

	/* bbb-cmd.sh mender-update commit
	-----------------------------------*/

	// ErrorMenderUpdateCommitFailed is thrown if `mender -commit` failed.
	ErrorMenderUpdateCommitFailed ErrorCode = "MENDER_UPDATE_COMMIT_FAILED"
)

const (

	// ErrorConfigScriptInvalidArg is thrown if the argument for the bbb-config.sh script is not known.
	// Not to be confused with ErrorCmdScriptInvalidArg for the bbb-cmd script.
	ErrorConfigScriptInvalidArg ErrorCode = "CONFIG_SCRIPT_INVALID_ARG"

	/* bbb-config.sh set <key> <value>
	-----------------------------------*/

	// ErrorSetNeedsTwoArguments is thrown if `bbb-config.sh set <key> <value>` is thrown with not exactly two arguments.
	ErrorSetNeedsTwoArguments ErrorCode = "SET_NEEDS_TWO_ARGUMENTS"

	/* bbb-config.sh set bitcoin_network <value>
	--------------------------------------------*/

	// ErrorSetBitcoinNetworkInvalidValue is thrown if the set <value> is not "testnet" or "mainnet".
	ErrorSetBitcoinNetworkInvalidValue ErrorCode = "SET_BITCOINETWORK_INVALID_VALUE"

	/* bbb-config.sh set bitcoin_dbcache <value>
	---------------------------------------------*/

	// ErrorSetBitcoinDBCacheInvalidValue is thrown if the <value> is not an integer in MB between 50 and 3000.
	ErrorSetBitcoinDBCacheInvalidValue ErrorCode = "SET_BITCOINDBCACHE_INVALID_VALUE"

	/* bbb-config.sh set hostname <value>
	---------------------------------------*/

	// ErrorSetHostnameInvalidValue is thrown if the <value> is an invalid hostname according to this regex '^[a-z][a-z0-9-]{0,22}[a-z0-9]$'.
	ErrorSetHostnameInvalidValue ErrorCode = "SET_HOSTNAME_INVALID_VALUE"
)

const (

	/* bbb-systemctl.sh start-bitcoin-services
	---------------------------------------*/

	// ErrorSystemdServiceStartFailed is thrown when a systemd service cannot be
	// started.
	ErrorSystemdServiceStartFailed ErrorCode = "SYSTEMD_SERVICESTART_FAILED"
)

const (
	// ErrorInitialAuthenticationNotSuccessful is thrown if the initial authentication with default username and password is not successful.
	ErrorInitialAuthenticationNotSuccessful ErrorCode = "INITIAL_AUTHENTICATION_NOT_SUCCESSFUL"

	// ErrorAuthenticationPasswordIncorrect is thrown if the authentication is not successful.
	ErrorAuthenticationPasswordIncorrect ErrorCode = "AUTHENTICATION_PASSWORD_INCORRECT"

	// ErrorAuthenticationFailed is thrown if the authentication is not successful, because of a generic error
	ErrorAuthenticationFailed ErrorCode = "AUTHENTICATION_FAILED"

	// ErrorAuthenticationUsernameNotFound is thrown if the given username does not exist.
	ErrorAuthenticationUsernameNotFound ErrorCode = "AUTHENTICATION_USERNAME_NOEXIST"
)

const (
	// ErrorPasswordTooShort is thrown if the provided password is too short.
	ErrorPasswordTooShort ErrorCode = "CHANGEPASSWORD_TOO_SHORT"

	// ErrorPasswordChangeFailed is thrown if the there is an internal system error with e.g. redis or json parsing
	ErrorPasswordChangeFailed ErrorCode = "CHANGEPASSWORD_FAILED"

	// ErrorPasswordChangeUsernameNotExist is thrown if the given username does not exist
	ErrorPasswordChangeUsernameNotExist ErrorCode = "CHANGEPASSWORD_USERNAME_NOEXIST"

	// ErrorPasswordChangePasswordIncorrect is thrown is the given password does not match the bcrypted password from redis
	ErrorPasswordChangePasswordIncorrect ErrorCode = "CHANGEPASSWORD_PASSWORD_INCORRECT"
)

const (
	// ErrorSetLoginPasswordTooShort is thrown if the provided root password is too short.
	ErrorSetLoginPasswordTooShort ErrorCode = "SET_LOGINPASSWORD_PASSWORD_TOO_SHORT"
)
