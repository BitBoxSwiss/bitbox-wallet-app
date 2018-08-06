#!/bin/bash -e
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


dockerdev () {
    local container_name=bitbox-wallet-dev

    if ! docker images | grep -q bitbox-wallet; then
        echo "No bitbox-wallet docker image found! Maybe you need to run 'make dockerinit'?" >&2
        exit 1
    fi

    # If already running, enter the container.
    if docker ps | grep -q $container_name; then
        docker exec -it $container_name /opt/go/src/github.com/digitalbitbox/bitbox-wallet-app/scripts/docker_init.sh
        return
    fi

    if docker ps -a | grep -q $container_name; then
        docker rm $container_name
    fi

    local repo_path="${GOPATH%%:*}/src/github.com/digitalbitbox/bitbox-wallet-app"
    docker run \
           --detach \
           --privileged -v /dev/bus/usb:/dev/bus/usb \
           --interactive --tty \
           --name=$container_name -p 8080:8080 -p 8082:8082 \
           --add-host="dev.shiftcrypto.ch:176.9.28.202" \
           --add-host="dev1.shiftcrypto.ch:176.9.28.155" \
           --add-host="dev2.shiftcrypto.ch:176.9.28.156" \
           -v $repo_path:/opt/go/src/github.com/digitalbitbox/bitbox-wallet-app \
           bitbox-wallet bash

    # Call a second time to enter the container.
    dockerdev
}

dockerdev
