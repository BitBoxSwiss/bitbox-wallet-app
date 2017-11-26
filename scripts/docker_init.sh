#!/bin/bash

# If we are inside docker, this will be the IP of the host, so the
# container can access services on the host (e.g. electrumx).
export GODBB_HOST=$(netstat -nr | grep '^0\.0\.0\.0' | awk '{print $2}')

cd /opt/go/src/github.com/shiftdevices/godbb/
bash
