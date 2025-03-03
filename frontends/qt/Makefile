# Copyright 2018 Shift Devices AG
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

include ../../env.mk.inc

base:
	mkdir build
	./genassets.sh
clean:
	-rm -rf build
	cd server && $(MAKE) clean
linux:
	$(MAKE) clean
	cd server && $(MAKE) linux
	$(MAKE) base
	qmake -o build/Makefile
	cd build && $(MAKE)
	mkdir build/linux-tmp build/linux
	mv build/BitBox build/linux-tmp
	cp build/assets.rcc build/linux-tmp/
	cp server/libserver.so build/linux-tmp
	cd build/linux-tmp && /opt/linuxdeployqt-continuous-x86_64.AppImage BitBox \
		-bundle-non-qt-libs \
		-unsupported-allow-new-glibc \
		# Add Wayland libs so the app can run natively on Wayland too.
		# The linuxdeployqt maintainer unfortunately refuses to support it automatically: https://github.com/probonopd/linuxdeployqt/issues/189
		# The list of related plugins was found by: `find $(qmake -query QT_INSTALL_PLUGINS) | grep wayland`
		-extra-plugins=platforms/libqwayland-generic.so,platforms/libqwayland-egl.so,wayland-graphics-integration-client,wayland-decoration-client,wayland-shell-integration
	cp /usr/lib/x86_64-linux-gnu/nss/* build/linux-tmp/lib
	# See https://github.com/probonopd/linuxdeployqt/issues/554#issuecomment-1761834180
	cp "$(shell qmake -query QT_INSTALL_DATA)/resources/v8_context_snapshot.bin" build/linux-tmp/resources
	cp -aR resources/linux build/tmp-deb
	cp resources/linux/usr/share/applications/bitbox.desktop build/linux-tmp
	cp resources/linux/usr/share/icons/hicolor/128x128/apps/bitbox.png build/linux-tmp
	mkdir build/tmp-deb/opt/
	cp -aR build/linux-tmp build/tmp-deb/opt/bitbox
	cd build/linux && fpm --after-install ../../resources/deb-afterinstall.sh -s dir -t deb -n bitbox -v 4.47.0 -C ../tmp-deb/
	cd build/linux && fpm --after-install ../../resources/deb-afterinstall.sh -s dir -t rpm -n bitbox -v 4.47.0 -C ../tmp-deb/
	# create AppImage
	cd build/linux-tmp && /opt/linuxdeployqt-continuous-x86_64.AppImage BitBox -appimage -unsupported-allow-new-glibc
	mv build/linux-tmp/BitBoxApp-*-x86_64.AppImage build/linux/
osx:
	$(MAKE) clean
	cd server && $(MAKE) macosx
	$(MAKE) base
	qmake -set MACOS_MIN_VERSION $(MACOS_MIN_VERSION)
	# See https://stackoverflow.com/questions/77136519/qmake-failing-with-sdk-14-ventura-13-5-2
	qmake -early QMAKE_DEFAULT_LIBDIRS=$(shell xcrun -show-sdk-path)/usr/lib -o build/Makefile
	cd build && $(MAKE)
	mkdir build/osx
	mv build/BitBox.app build/osx/
	cp resources/MacOS/Info.plist build/osx/BitBox.app/Contents/
	mkdir -p build/osx/BitBox.app/Contents/Resources
	cp resources/MacOS/icon.icns build/osx/BitBox.app/Contents/Resources/
	cd build/osx/ && macdeployqt BitBox.app
	cp server/libserver.so build/osx/BitBox.app/Contents/Frameworks
	cp build/assets.rcc build/osx/BitBox.app/Contents/MacOS/
	install_name_tool -change libserver.so @executable_path/../Frameworks/libserver.so build/osx/BitBox.app/Contents/MacOS/BitBox
	cp -r resources/MacOS/Testnet.app build/osx/Testnet.app
windows:
	bash make_windows.sh
