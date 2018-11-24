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

FROM ubuntu:16.04 as qt5base

ENV DEBIAN_FRONTEND noninteractive

Run apt-get update

# qt5 build deps and convenience tools.
RUN apt-get -y install --no-install-recommends \
    sudo \
    bash-completion \
    git \
    wget \
    build-essential \
    ccache \
    python \
    libfontconfig1-dev \
    libfreetype6-dev \
    libx11-dev \
    libxext-dev \
    libxfixes-dev \
    libxi-dev \
    libxrender-dev \
    libx11-xcb-dev \
    '^libxcb.*' \
    libx11-xcb-dev \
    libglu1-mesa-dev \
    libxrender-dev \
    libxi-dev \
    libatspi2.0-dev \
    libdbus-1-dev \
    flex \
    bison \
    gperf \
    libicu-dev \
    libxslt-dev \
    ruby \
    libssl-dev \
    libxcursor-dev \
    libxcomposite-dev \
    libxdamage-dev \
    libxrandr-dev \
    libfontconfig1-dev \
    libcap-dev \
    libbz2-dev \
    libgcrypt11-dev \
    libpci-dev \
    libnss3-dev \
    libxcursor-dev \
    libxcomposite-dev \
    libxdamage-dev \
    libxrandr-dev \
    libdrm-dev \
    libfontconfig1-dev \
    libxtst-dev \
    libasound2-dev \
    libcups2-dev \
    libpulse-dev \
    libudev-dev \
    libssl-dev \
    libegl1-mesa-dev \
    ninja-build \
    gyp \
    libxss-dev \
    libasound2-dev \
    libgstreamer0.10-dev \
    libgstreamer-plugins-base0.10-dev

# Get the source code
RUN cd /tmp && \
    wget https://download.qt.io/archive/qt/5.11/5.11.2/single/qt-everywhere-src-5.11.2.tar.xz && \
    tar -xf qt-everywhere-src-5.11.2.tar.xz && \
    mv qt-everywhere-src-5.11.2 qt5

RUN cd /tmp/qt5 && \
    ./configure \
      -prefix /opt/qt5 \
      -opensource \
      -confirm-license \
      -nomake tests \
      -nomake examples \
      -dbus \
      -xcb \
      -system-xcb \
      -qpa xcb \
      -release \
      -reduce-relocations \
      -optimized-qmake

RUN cd /tmp/qt5 && make -j1

RUN cd /tmp/qt5 && make install

FROM ubuntu:16.04

COPY --from=qt5base /opt/qt5 /opt/qt5

Run apt-get update

# This is needed for compiling apps depending on the qt5 libs.
RUN apt-get -y install --no-install-recommends libxcb-xinerama0 libxcb-xkb-dev libxcb-render-util0 libxcb-image0 libxcb-keysyms1 libxcb-icccm4 libcups2 libgl1-mesa-dev libegl1-mesa-dev libfontconfig1-dev libfreetype6-dev libxi-dev libxcursor-dev libxrender-dev libxss-dev libxcomposite-dev libasound2-dev libxtst-dev libxslt-dev libnss3-dev libicu-dev
