#!/bin/bash

set -e 

# sudo apt-get install git
# NOTE: Must be recent version, ubuntu LTS is too old
# sudo apt-get install golang

export GOROOT=/usr/local/go
export GOPATH=~/go

mkdir -p ${GOROOT}/src/github.com

cd ${GOROOT}/src/github.com
if [ ! -d ./irctl ]; then  
  git clone https://github.com/maoghub/irctl.git
fi

cd irctl
git pull 

cd server
go get ./...

ln -fs ${GOROOT}/src/github.com/irctl/server/control ~/go/src/irctl/server/control

go build server.go

sudo cp server /usr/local/bin/irrigation_control
