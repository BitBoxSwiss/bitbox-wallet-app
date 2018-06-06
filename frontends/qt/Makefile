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
