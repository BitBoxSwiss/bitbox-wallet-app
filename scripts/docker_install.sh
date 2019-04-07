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
curl -sL https://deb.nodesource.com/setup_10.x | bash -

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

npm install -g yarn
npm install -g locize-cli

mkdir -p /opt/go_dist
curl https://dl.google.com/go/go1.11.linux-amd64.tar.gz | tar -xz -C /opt/go_dist

# Needed for qt5. fuse is needed to run the linuxdeployqt appimage.
apt-get install -y --no-install-recommends fuse
cd /opt && \
    wget https://github.com/probonopd/linuxdeployqt/releases/download/5/linuxdeployqt-5-x86_64.AppImage && \
    echo "e5294433d97504a5081c354cdedfebe918dd50188c378d965f598576fcbbf5b4 /opt/linuxdeployqt-5-x86_64.AppImage" | sha256sum -c - && \
    chmod +x /opt/linuxdeployqt-5-x86_64.AppImage

# Install fpm to create deb/rpm packages
apt-get install -y --no-install-recommends \
        ruby ruby-dev build-essential rpm
gem install --no-ri --no-rdoc fpm
