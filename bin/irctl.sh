#!/bin/bash
set -e

# This is suitable for calling as a service, should be run as user not root.

export GOPATH=/home/ostromart/go
cd ${GOPATH}/src/irctl/server
/usr/local/go/bin/go run server.go -controller numato -port_name /dev/ttyACM0 -alsologtostderr -runloop -log_dir=${GOPATH}/src/irctl/logs
