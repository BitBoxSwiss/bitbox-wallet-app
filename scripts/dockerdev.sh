#!/bin/bash -e

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
           -v $repo_path:/opt/go/src/github.com/shiftdevices/godbb \
           godbb bash

    # Call a second time to enter the container.
    dockerdev
}

dockerdev
