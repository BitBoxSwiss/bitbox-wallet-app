base:
	make -C server/
	rm -rf build/
	mkdir build
	./genassets.sh
	qmake -o build/Makefile
	make -C build
	@echo "Base binary: `pwd`/build/BitBox"
linux:
	make base
	mkdir build/linux
	mv build/BitBox build/linux
	cp build/assets.rcc build/linux/
	cp server/libserver.so build/linux
	cd build/linux && /opt/linuxdeployqt-continuous-x86_64.AppImage BitBox
	cp /usr/lib/x86_64-linux-gnu/nss/* build/linux/lib
	cd build/linux && /opt/linuxdeployqt-continuous-x86_64.AppImage BitBox -appimage
	rm build/linux/libserver.so
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
