base:
	make -C server/
	rm -rf build/
	mkdir build
	./genassets.sh
	qmake -o build/Makefile
	make -C build
linux:
	make base
	mkdir build/linux-tmp build/linux
	mv build/BitBox build/linux-tmp
	cp build/assets.rcc build/linux-tmp/
	cp server/libserver.so build/linux-tmp
	cd build/linux-tmp && /opt/linuxdeployqt-continuous-x86_64.AppImage BitBox
	cp /usr/lib/x86_64-linux-gnu/nss/* build/linux-tmp/lib
	cd build/linux-tmp && /opt/linuxdeployqt-continuous-x86_64.AppImage BitBox -appimage
	rm build/linux-tmp/libserver.so
	mv build/linux-tmp/Application-x86_64.AppImage build/linux/BitBox-x86_64.AppImage
	cp -aR resources/linux build/tmp-deb/
	cp -aR build/linux-tmp build/tmp-deb/opt/bitbox
	# fpm -s dir -t deb -n bitbox -v 0.0.1 -C build/tmp-deb/ && mv bitbox_0.0.1_amd64.deb build/linux/
osx:
	make base
	mkdir build/osx
	mv build/BitBox.app build/osx/
	cp resources/MacOS/Info.plist build/osx/BitBox.app/Contents/
	cp resources/MacOS/icon.icns build/osx/BitBox.app/Contents/Resources/
	macdeployqt build/osx/BitBox.app/
	cp server/libserver.so build/osx/BitBox.app/Contents/Frameworks
	cp build/assets.rcc build/osx/BitBox.app/Contents/MacOS/
	install_name_tool -change libserver.so @executable_path/../Frameworks/libserver.so build/osx/BitBox.app/Contents/MacOS/BitBox
	macdeployqt build/osx/BitBox.app/ -dmg
	cp -r resources/MacOS/Testnet.app build/osx/Testnet.app
windows:
	@echo "Open the .pro file in QT Creator in Windows, switch to Release mode on the left, then do \"Build/run qmake\" and then \"Build/Build All\", then run \"make windows_post\"".
windows_post:
	sh ./windows_post.sh
