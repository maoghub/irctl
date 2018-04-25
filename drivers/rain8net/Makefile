#
# Written by and Copyright (C) 2008 the SourceForge
# 		Rain8Net team. http://rain8net.sourceforge.net/
#
# This file is part of Rain8Net.
# 
# Rain8Net is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# Rain8Net is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with Rain8Net.  If not, see <http://www.gnu.org/licenses/>.
#

CC=g++
CFLAGS=-Wall
OBJS=serial.o Rain8Net.o rain8.o

all: Rain8Net

clean:
	rm -f $(OBJS)

distclean: clean
	rm -f Rain8Net

Rain8Net: serial.o Rain8Net.o rain8.o
	$(CC) $(OBJS) -o $@

.cpp.o:
	$(CC) $(CFLAGS) -c -o $@ $<
