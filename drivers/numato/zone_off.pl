#!/usr/bin/perl
# Install Perl and then install Device::SerialPort perl modules from the following link
#    Device::SerialPort (For Linux) - http://search.cpan.org/dist/Device-SerialPort/SerialPort.pm

use Device::SerialPort;

my ($portName, $zoneNumber) = @ARGV;

$serPort = new Device::SerialPort($portName, quiet) || die "Could not open the port specified";

# Configure the port	   
$serPort->baudrate(9600);
$serPort->parity("none");
$serPort->databits(8);
$serPort->stopbits(1);
$serPort->handshake("none"); #Most important
$serPort->buffers(4096, 4096); 
$serPort->lookclear();
$serPort->purge_all;

$serPort->write("gpio clear ".$zoneNumber. "\r");
$serPort->purge_all;