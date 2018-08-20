#!/bin/bash
set -e

# This is suitable for calling as a service, should be run as user not root.

export GOPATH=/home/ostromart/go
cd ${GOPATH}/src/irctl/server
# default log dir is /tmp/server.INFO etc.
/usr/local/go/bin/go run server.go -controller numato -port_name /dev/ttyACM0 -alsologtostderr -runloop 
