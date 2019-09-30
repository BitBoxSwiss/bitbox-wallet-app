# go mod makes the Android build hang forever. Remove this once we move to go modules in a controlled fashion.
build:
	GO111MODULE=off ANDROID_HOME=${ANDROID_SDK_ROOT} gomobile bind -x -a -ldflags="-s -w" -target android .
clean:
	rm -f goserver.aar goserver-sources.jar
