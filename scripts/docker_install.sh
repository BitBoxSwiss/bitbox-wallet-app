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
        libxrandr-dev

npm install -g npm@10
npm install -g locize-cli

mkdir -p /opt/go_dist
curl https://dl.google.com/go/go1.22.4.linux-amd64.tar.gz | tar -xz -C /opt/go_dist

# Needed for qt5. fuse is needed to run the linuxdeployqt appimage.
apt-get install -y --no-install-recommends fuse
cd /opt && \
    wget https://github.com/probonopd/linuxdeployqt/releases/download/7/linuxdeployqt-7-x86_64.AppImage && \
    echo "645276306a801d7154d59e5b4b3c2fac3d34e09be57ec31f6d9a09814c6c162a /opt/linuxdeployqt-7-x86_64.AppImage" | sha256sum -c - && \
    chmod +x /opt/linuxdeployqt-7-x86_64.AppImage

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
