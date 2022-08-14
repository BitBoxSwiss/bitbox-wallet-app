#!/bin/sh -e

DIR="$( cd "$( dirname "$0" )" && pwd )"

FILES=${DIR}/*.proto

OPTS=""
for f in $FILES
do
    OPTS="${OPTS} --go_opt=M$(basename ${f})=github.com/digitalbitbox/bitbox02-api-go/api/firmware/messages"
done
protoc --proto_path=${DIR} \
       ${OPTS} \
       --go_out="paths=source_relative:${DIR}" \
       $FILES
