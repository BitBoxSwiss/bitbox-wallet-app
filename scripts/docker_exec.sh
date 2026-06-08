#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

if [ -n "$CONTAINER_RUNTIME" ]; then
  RUNTIME="$CONTAINER_RUNTIME"
elif command -v podman &>/dev/null; then
  RUNTIME=podman
else
  RUNTIME=docker
fi

function docker_cleanup {
    $RUNTIME exec $IMAGE bash -c "if [ -f $PIDFILE ]; then kill -TERM -\$(cat $PIDFILE); rm $PIDFILE; fi"
}

# See https://github.com/moby/moby/issues/9098#issuecomment-189743947.
function docker_exec {
    IMAGE=$1
    PIDFILE=/tmp/docker-exec-$$
    shift
    trap 'kill $PID; docker_cleanup $IMAGE $PIDFILE' TERM INT
    $RUNTIME exec -i $IMAGE bash -c "echo \"\$\$\" > $PIDFILE; exec $*" &
    PID=$!
    wait $PID
    trap - TERM INT
    wait $PID
}

docker_exec bitbox-wallet-dev make -C /opt/go/src/github.com/BitBoxSwiss/bitbox-wallet-app/ "$@"
