#!/bin/bash

set -e 

cd ${GOPATH}/src/irctl/server
go build server.go
sudo cp server /usr/local/bin/irrigation_control
