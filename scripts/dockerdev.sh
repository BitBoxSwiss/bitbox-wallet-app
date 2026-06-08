#!/bin/bash -e
# SPDX-License-Identifier: Apache-2.0

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
CONTAINER_VERSION="$(cat $DIR/../.containerversion)"

if [ -n "$CONTAINER_RUNTIME" ]; then
  RUNTIME="$CONTAINER_RUNTIME"
elif command -v podman &>/dev/null; then
  RUNTIME=podman
else
  RUNTIME=docker
fi

dockerdev () {
    local container_name=bitbox-wallet-dev
    local image_name=shiftcrypto/bitbox-wallet-app

    USERFLAG=""
    if [ "$RUNTIME" = "docker" ] ; then
        # Only needed for docker - see the comment below.
        USERFLAG="--user=dockeruser"
    fi

    # If already running, enter the container.
    if $RUNTIME ps | grep $image_name:$CONTAINER_VERSION | grep -q $container_name; then
        $RUNTIME exec $USERFLAG -it $container_name /opt/go/src/github.com/BitBoxSwiss/bitbox-wallet-app/scripts/docker_init.sh
        return
    fi

    # A container based on a different image version is running. Let's stop and remove it.
    if $RUNTIME ps -a | grep -q $container_name; then
      $RUNTIME stop $container_name
      $RUNTIME rm $container_name
    fi

    local repo_path="$DIR/.."
    $RUNTIME run \
           --detach \
           --platform "linux/amd64" \
           --privileged -v /dev/bus/usb:/dev/bus/usb \
           --interactive --tty \
           --name=$container_name -p 8080:8080 -p 8082:8082 \
           --add-host="dev.shiftcrypto.ch:176.9.28.202" \
           --add-host="dev1.shiftcrypto.ch:176.9.28.155" \
           --add-host="dev2.shiftcrypto.ch:176.9.28.156" \
           -v "$repo_path":/opt/go/src/github.com/BitBoxSwiss/bitbox-wallet-app \
           $image_name:$CONTAINER_VERSION bash

    if [ "$RUNTIME" = "docker" ] ; then
        # Use same user/group id as on the host, so that files are not created as root in the
        # mounted volume. Only needed for Docker. On rootless podman, the host user maps to the
        # container root user.
        $RUNTIME exec -it "$container_name" groupadd -o -g "$(id -g)" dockergroup
        $RUNTIME exec -it "$container_name" useradd -u "$(id -u)" -m -g dockergroup dockeruser
    fi

    # Call a second time to enter the container.
    dockerdev
}

dockerdev
