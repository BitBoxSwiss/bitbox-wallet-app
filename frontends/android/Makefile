include ../../android-env.mk.inc

apk-debug:
	${MAKE} prepare-android
	cd BitBoxApp && ./gradlew assemble
deploy-debug:
	adb install -r ./BitBoxApp/app/build/outputs/apk/debug/app-debug.apk
clean:
	cd BitBoxApp && ./gradlew clean
prepare-android:
	rm -rf BitBoxApp/app/src/main/assets/web
	mkdir -p BitBoxApp/app/src/main/assets/web
	cp -aR ../web/build/* BitBoxApp/app/src/main/assets/web/
	mkdir -p BitBoxApp/app/src/main/jniLibs/arm64-v8a
	mkdir -p BitBoxApp/app/src/main/jniLibs/armeabi-v7a
	mkdir -p BitBoxApp/app/src/main/jniLibs/x86
	mkdir -p BitBoxApp/app/src/main/jniLibs/x86_64
	cp ../../vendor/github.com/breez/breez-sdk-go/breez_sdk/lib/android-386/*.so BitBoxApp/app/src/main/jniLibs/x86/
	cp ../../vendor/github.com/breez/breez-sdk-go/breez_sdk/lib/android-aarch/*.so BitBoxApp/app/src/main/jniLibs/armeabi-v7a/
	cp ../../vendor/github.com/breez/breez-sdk-go/breez_sdk/lib/android-aarch64/*.so BitBoxApp/app/src/main/jniLibs/arm64-v8a/
	cp ../../vendor/github.com/breez/breez-sdk-go/breez_sdk/lib/android-amd64/*.so BitBoxApp/app/src/main/jniLibs/x86_64/
	cd ../../backend/mobileserver && ${MAKE} build-android
	cp ../../backend/mobileserver/mobileserver.aar BitBoxApp/mobileserver/
logcat:
	adb logcat -s \
		GoLog \
		ch.shiftcrypto.bitboxapp \
		ActivityManager \
		InputDispatcher \
		libprocessgroup \
		SurfaceFlinger \
		WindowManager \
		Zygote
