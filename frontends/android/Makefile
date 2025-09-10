include ../../android-env.mk.inc

apk-debug:
	${MAKE} prepare-android
	cd BitBoxApp && ./gradlew assembleDebug
# Creates signed release .apk and .aab.
assemble-release:
	./assemble_release.sh
deploy-debug:
	adb install -r ./BitBoxApp/app/build/outputs/apk/debug/app-debug.apk
clean:
	cd BitBoxApp && ./gradlew clean
prepare-android:
	cd ../../ && ${MAKE} buildweb
	rm -rf BitBoxApp/app/src/main/assets/web
	mkdir -p BitBoxApp/app/src/main/assets/web
	cp -aR ../web/build/* BitBoxApp/app/src/main/assets/web/
	cd ../../backend/mobileserver && ${MAKE} build-android
	cp ../../backend/mobileserver/mobileserver.aar BitBoxApp/mobileserver/
logcat:
	adb logcat -s \
		GoLog \
		bitboxapp \
		ActivityManager \
		InputDispatcher \
		libprocessgroup \
		SurfaceFlinger \
		WindowManager \
		Zygote
