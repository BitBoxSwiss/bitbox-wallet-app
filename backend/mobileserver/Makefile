include ../../android-env.mk.inc

# go mod makes the Android build hang forever. Remove this once we move to go modules in a controlled fashion.
# Probably a variation of https://github.com/golang/go/issues/27234 - solution is to build it using vendored deps
# by turning off GO111MODULE. See also: https://github.com/golang/go/issues/34181#issuecomment-640260162
build-android:
	GO111MODULE=off ANDROID_HOME=${ANDROID_SDK_ROOT} gomobile bind -x -a -ldflags="-s -w" -target android .
build-ios:
	GO111MODULE=off gomobile bind -x -a -ldflags="-s -w" -target ios,iossimulator .
clean:
	rm -f mobileserver.aar mobileserver-sources.jar
