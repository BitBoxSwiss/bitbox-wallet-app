base:
	make -C server/
	mkdir -p build
	qmake -o build/Makefile
	make -C build
	@echo "Base binary: `pwd`/build/dbb"
linux:
	make base
	mkdir -p build/linux
	mv build/dbb build/linux
	cp server/libserver.so build/linux
	cd build/linux && /opt/linuxdeployqt-continuous-x86_64.AppImage dbb
	cp /usr/lib/x86_64-linux-gnu/nss/* build/linux/lib
	cd build/linux && /opt/linuxdeployqt-continuous-x86_64.AppImage dbb -appimage
	rm build/linux/libserver.so
osx:
	make base
	mkdir -p build/osx
	mv build/dbb.app build/osx/dbb.app
	macdeployqt build/osx/dbb.app/
	cp server/libserver.so build/osx/dbb.app/Contents/Frameworks
	install_name_tool -change libserver.so @executable_path/../Frameworks/libserver.so build/osx/dbb.app/Contents/MacOS/dbb
	macdeployqt build/osx/dbb.app/ -dmg
