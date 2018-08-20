#!/bin/bash

set -e 

# sudo apt-get install -q git
# NOTE: Must be recent version, ubuntu LTS is too old
# sudo apt-get install -q golang

export GOROOT=/usr/local/go
export GOPATH=~/go

mkdir -p ${GOROOT}/src

cd ${GOROOT}/src
if [ ! -d ./irctl ]; then  
  git clone https://github.com/maoghub/irctl.git
fi

cd irctl
git pull 

cd server
go get ./...

# For controlling the serial port 
cpan Device::SerialPort
sudo cpan Device::SerialPort

# Change USB serial port write perms every reboot.
sudo (crontab -l ; echo "@reboot chmod 777 /dev/ttyACM0")| crontab -

# Set up log files (delete older than 7 days).
sudo mkdir -p /var/log/irctl
sudo chown ${USER} /var/log/irctl
sudo (crontab -l ; echo "@daily root find /var/log/irctl/* -mtime +6 -type f -delete")| crontab -

# Configure irctl as a service. 
sudo cp ${GOROOT}/src/irctl/init/systemd/irctl.service /etc/systemd/system/.
sudo systemd start irctl
sudo systemd enable irctl

# Software watchdog
sudo apt-get install -q watchdog
sudo service watchdog start
sudo update-rc.d watchdog defaults
