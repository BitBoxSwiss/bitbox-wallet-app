#!/bin/sh -ex
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


apt-get update
apt-get install -y --no-install-recommends curl ca-certificates

# add repository for node/npm
curl -sL https://deb.nodesource.com/setup_20.x | bash -

apt-get install -y --no-install-recommends \
    clang \
    gcc \
    libc6-dev \
    make \
    wget \
    git \
    sudo \
    less \
    net-tools \
    nodejs \
    g++ \
    dnsutils \
    gcc-mingw-w64-x86-64

# Deps required by Qt / linuxdeployqt:
apt-get install -y --no-install-recommends \
        file \
        libtiff-dev \
        libxkbcommon-x11-dev \
        libxrandr-dev \
        libxcb-xinerama0 \
        libxcb-xkb-dev \
        libxcb-render-util0 \
        libxcb-image0 \
        libxcb-keysyms1 \
        libxcb-icccm4 \
        libxcb-randr0 \
        libxcb-shape0 \
        libxcb-xinput0 \
        libcups2 \
        libgl1-mesa-dev \
        libegl1-mesa-dev \
        libfontconfig1-dev \
        libfreetype6-dev \
        libxi-dev \
        libxcursor-dev \
        libxrender-dev \
        libxss-dev \
        libxcomposite-dev \
        libasound2-dev \
        libxtst-dev \
        libxslt-dev \
        libnss3-dev \
        libicu-dev \
        libpcre2-16-0 \
        libxkbfile-dev

# Install Qt libs. python3-dev is needed to compile aqtinstall.
apt-get -y install --no-install-recommends python3-pip python3-dev
pip install -U pip && pip install aqtinstall
# Not sure why we need qtpositioning - app compilation fails without. Maybe the webengine depends on it.
# qtpositioning depends on qtserialport.
# qtwebechannel is for the JS/backend bridge.
# qtwebengine is for rendering the frontend.
aqt install-qt linux desktop 6.2.4 -m qtpositioning qtserialport qtwebchannel qtwebengine --outputdir /opt/qt6

npm install -g npm@10
npm install -g locize-cli

mkdir -p /opt/go_dist
curl https://dl.google.com/go/go1.22.4.linux-amd64.tar.gz | tar -xz -C /opt/go_dist

# fuse is needed to run the linuxdeployqt appimage.
apt-get install -y --no-install-recommends fuse
cd /opt && \
    wget https://github.com/BitBoxSwiss/linuxdeployqt/releases/download/bitbox-1/linuxdeployqt-continuous-x86_64.AppImage  && \
    echo "3850e767986be94cfb0818983df2da2d82bea6d8742aa373d810fba90eb5c65c /opt/linuxdeployqt-continuous-x86_64.AppImage" | sha256sum -c - && \
    chmod +x /opt/linuxdeployqt-continuous-x86_64.AppImage

# Install fpm to create deb/rpm packages
apt-get install -y --no-install-recommends \
        ruby ruby-dev build-essential rpm
# We need to explicitly specify the dotenv version to avoid conflicts with ruby
gem install dotenv -v 2.8.1
gem install --no-document fpm

# Needed for Android.
apt-get install -y --no-install-recommends openjdk-17-jdk
# Keep versions in sync with build.gradle and frontends/android/Makefile.
/opt/android-sdk/cmdline-tools/tools/bin/sdkmanager "ndk;21.2.6472646" "platforms;android-34" "build-tools;34.0.0" "platform-tools"
