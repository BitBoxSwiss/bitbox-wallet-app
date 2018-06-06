FROM ubuntu:14.04 as qt5base

ENV DEBIAN_FRONTEND noninteractive

# Update
Run apt-get update

RUN apt-get -y install --no-install-recommends \
    sudo \
    bash-completion \
    git \
    wget \
    build-essential \
    ccache \
    python

RUN apt-get -y install --no-install-recommends \
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
    wget https://download.qt.io/archive/qt/5.8/5.8.0/single/qt-everywhere-opensource-src-5.8.0.tar.gz && \
    tar -xf qt-everywhere-opensource-src-5.8.0.tar.gz && \
    mv qt-everywhere-opensource-src-5.8.0 qt5

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

FROM ubuntu:14.04

COPY --from=qt5base /opt/qt5 /opt/qt5
