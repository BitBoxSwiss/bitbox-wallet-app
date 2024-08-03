include ../../android-env.mk.inc

# GOMODCACHE to /tmp directory, because gomobile needs to write pkgs.
# Also set -glflags to fix the vendor issue with gomobile, see: https://github.com/golang/go/issues/67927#issuecomment-2241523694
build-android:
	GOMODCACHE=${GOMODCACHE_ROOT} ANDROID_HOME=${ANDROID_SDK_ROOT} gomobile bind -x -a -glflags="-mod=readonly" -ldflags="-s -w" -target android .
build-ios:
	GOMODCACHE=${GOMODCACHE_ROOT} gomobile bind -x -a -glflags="-mod=readonly" -ldflags="-s -w" -target ios,iossimulator .
clean:
	rm -f mobileserver.aar mobileserver-sources.jar
