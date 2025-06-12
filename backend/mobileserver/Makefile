include ../../android-env.mk.inc

# Set -glflags to fix the vendor issue with gomobile, see: https://github.com/golang/go/issues/67927#issuecomment-2241523694
build-android:
	ANDROID_HOME=${ANDROID_SDK_ROOT} gomobile bind -x -a -glflags="-mod=readonly" -ldflags="-s -w" -target android .
build-ios:
	gomobile bind -x -a -glflags="-mod=readonly" -ldflags="-s -w" -target ios,iossimulator .
clean:
	rm -f mobileserver.aar mobileserver-sources.jar
