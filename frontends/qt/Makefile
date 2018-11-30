base:
	mkdir build
	./genassets.sh
	qmake -o build/Makefile
	make -C build
clean:
	-rm -rf build
	make -C server clean
linux:
	make clean
	make -C server/ linux
	make base
	mkdir build/linux-tmp build/linux
	mv build/BitBox build/linux-tmp
	cp build/assets.rcc build/linux-tmp/
	cp server/libserver.so build/linux-tmp
	cd build/linux-tmp && /opt/linuxdeployqt-5-x86_64.AppImage BitBox -bundle-non-qt-libs
	cp /usr/lib/x86_64-linux-gnu/nss/* build/linux-tmp/lib
	cp -aR resources/linux build/tmp-deb
	mkdir build/tmp-deb/opt/
	cp -aR build/linux-tmp build/tmp-deb/opt/bitbox
	cd build/linux && fpm --after-install ../../resources/deb-afterinstall.sh -s dir -t deb -n bitbox -v 4.3.0 -C ../tmp-deb/
	cd build/linux && fpm --after-install ../../resources/deb-afterinstall.sh -s dir -t rpm -n bitbox -v 4.3.0 -C ../tmp-deb/
	# create AppImage
	sed 's+/usr/share/pixmaps/bitbox.svg+default+' resources/linux/usr/share/applications/bitbox.desktop > build/linux-tmp/bitbox.desktop
	cd build/linux-tmp && /opt/linuxdeployqt-5-x86_64.AppImage BitBox -appimage
	mv build/linux-tmp/BitBox-x86_64.AppImage build/linux/
	rm build/linux-tmp/libserver.so
osx:
	make clean
	make -C server/ macosx
	make base
	mkdir build/osx
	mv build/BitBox.app build/osx/
	cp resources/MacOS/Info.plist build/osx/BitBox.app/Contents/
	cp resources/MacOS/icon.icns build/osx/BitBox.app/Contents/Resources/
	macdeployqt build/osx/BitBox.app/
	cp server/libserver.so build/osx/BitBox.app/Contents/Frameworks
	cp build/assets.rcc build/osx/BitBox.app/Contents/MacOS/
	install_name_tool -change libserver.so @executable_path/../Frameworks/libserver.so build/osx/BitBox.app/Contents/MacOS/BitBox
	cp -r resources/MacOS/Testnet.app build/osx/Testnet.app
windows:
	@echo "Open the .pro file in QT Creator in Windows, switch to Release mode on the left, then do \"Build/run qmake\" and then \"Build/Build All\", then run \"make windows_post\"".
windows_post:
	sh ./windows_post.sh
