#!/bin/bash

set -e 

apt-get install git
apt-get install golang

export GOROOT=/usr/local/go
export GOPATH=~/go

mkdir -p ~/github
mkdir -p ~/go/src/irctl/server

cd ~/github
if [ ! -d ./irctl ]; then  
  git clone https://github.com/maoghub/irctl.git
fi

cd irctl
git pull 

cd server
go get ./...

ln -fs ~/github/irctl/server/control ~/go/src/irctl/server/control

go build server.go
