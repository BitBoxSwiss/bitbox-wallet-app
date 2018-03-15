#!/bin/sh -ex

apt-get update
apt-get install -y --no-install-recommends curl ca-certificates

# add repository for node/npm
curl -sL https://deb.nodesource.com/setup_9.x | bash -

apt-get install -y --no-install-recommends \
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
    qt5-default \
    libqt5webkit5-dev \
    dnsutils

npm install -g yarn

mkdir /opt/go_dist
curl https://storage.googleapis.com/golang/go1.9.2.linux-amd64.tar.gz | tar -xz -C /opt/go_dist
