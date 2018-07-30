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
    local container_name=godbb-dev

    # If already running, enter the container.
    if docker ps | grep -q $container_name; then
        docker exec -it $container_name /opt/go/src/github.com/shiftdevices/godbb/scripts/docker_init.sh
        return
    fi

    if docker ps -a | grep -q $container_name; then
        docker rm $container_name
    fi

    local repo_path="${GOPATH%%:*}/src/github.com/shiftdevices/godbb"
    docker run \
           --detach \
           --privileged -v /dev/bus/usb:/dev/bus/usb \
           --interactive --tty \
           --name=$container_name -p 8080:8080 -p 8082:8082 \
           --add-host="dev.shiftcrypto.ch:176.9.28.202" \
           --add-host="dev1.shiftcrypto.ch:176.9.28.155" \
           --add-host="dev2.shiftcrypto.ch:176.9.28.156" \
           -v $repo_path:/opt/go/src/github.com/shiftdevices/godbb \
           godbb bash

    # Call a second time to enter the container.
    dockerdev
}

dockerdev
