#!/bin/bash

# This is a convenience script to call `make ...` inside the docker co
# Run ./scripts/docker_dev.sh before to run the container first.

function docker_cleanup {
    docker exec $IMAGE bash -c "if [ -f $PIDFILE ]; then kill -TERM -\$(cat $PIDFILE); rm $PIDFILE; fi"
}

# See https://github.com/moby/moby/issues/9098#issuecomment-189743947.
function docker_exec {
    IMAGE=$1
    PIDFILE=/tmp/docker-exec-$$
    shift
    trap 'kill $PID; docker_cleanup $IMAGE $PIDFILE' TERM INT
    docker exec -i $IMAGE bash -c "echo \"\$\$\" > $PIDFILE; exec $*" &
    PID=$!
    wait $PID
    trap - TERM INT
    wait $PID
}

docker_exec godbb-dev make -C /opt/go/src/github.com/shiftdevices/godbb/ "$@"
