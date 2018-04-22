#!/bin/bash

set -e 

export GOROOT=/usr/local/go
export GOPATH=~/go

GHROOT=${GOROOT}/src/github.com

cd ${GHROOT}/irctl
#git rebase origin/master 

cd server
go get ./...

ln -fs ${GOROOT}/src/github.com/irctl/server/control ~/go/src/irctl/server/control

go build server.go

sudo cp server /usr/local/bin/irrigation_control
