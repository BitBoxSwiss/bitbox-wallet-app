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
    dnsutils

npm install -g yarn

mkdir -p /opt/go_dist
curl https://dl.google.com/go/go1.10.1.linux-amd64.tar.gz | tar -xz -C /opt/go_dist
