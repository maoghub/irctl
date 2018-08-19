#!/bin/bash

export GOPATH=/home/ostromart/go
#chmod 777 /dev/ttyACM0
cd ${GOPATH}/src/irctl/server
go run server.go -controller numato -port_name /dev/ttyACM0 -alsologtostderr -log_dir=${GOPATH}/src/irctl

