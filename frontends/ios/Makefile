prepare:
	cd ../../ && ${MAKE} buildweb
	rm -rf BitBoxApp/BitBoxApp/assets/web/
	mkdir -p BitBoxApp/BitBoxApp/assets/web/
	cp -aR ../web/build/* BitBoxApp/BitBoxApp/assets/web/
	# Build Mobileserver.xcframework. No need to copy it, the xcode project references it
	# directly from the mobileserver folder.
	cd ../../backend/mobileserver && ${MAKE} build-ios
