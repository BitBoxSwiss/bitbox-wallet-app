export ANDROID_SDK_ROOT := /opt/android-sdk
export ANDROID_NDK_HOME := /opt/android-sdk/ndk/21.2.6472646
apk-debug:
	${MAKE} prepare-android
	cd BitBoxApp && ./gradlew assemble
deploy-debug:
	adb install -r ./BitBoxApp/app/build/outputs/apk/debug/app-debug.apk
clean:
	cd goserver && ${MAKE} clean
	cd BitBoxApp && ./gradlew clean
prepare-android:
	rm -rf BitBoxApp/app/src/main/assets/web
	mkdir -p BitBoxApp/app/src/main/assets/web
	cp -aR ../web/build/* BitBoxApp/app/src/main/assets/web/
	cd goserver && ${MAKE} build
	cp goserver/goserver.aar BitBoxApp/goserver/
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
