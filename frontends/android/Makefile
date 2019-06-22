export ANDROID_SDK_ROOT := /opt/android-sdk
apk-debug:
	${MAKE} prepare-android
	cd BitBox && ./gradlew assemble
deploy-debug:
	adb install -r ./BitBox/app/build/outputs/apk/debug/app-debug.apk
clean:
	cd goserver && ${MAKE} clean
	cd BitBox && ./gradlew clean
prepare-android:
	mkdir -p BitBox/app/src/main/assets/web && cp -aR ../web/build/* BitBox/app/src/main/assets/web/
	cd goserver && ${MAKE} build
	cp goserver/goserver.aar BitBox/goserver/
