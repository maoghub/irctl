/*
 * Written by and Copyright (C) 2008 the SourceForge
 * 	Rain8Net team. http://rain8net.sourceforge.net/
 *
 * This file is part of Rain8Net.
 * 
 * Rain8Net is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Rain8Net is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Rain8Net.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <cerrno>
#include <string>
#include <getopt.h>
#include <strings.h>
#include <string.h>

#include "rain8.h"

using namespace std;
#define	R8ON			1
#define	R8OFF			2
#define	R8ALLOFF		3
#define	R8STATUS		4
#define	R8GALLOFF	5
#define	R8COMCHECK	6
#define	R8GETTIMERS	7
#define	R8SETTIMERS	8
#define	R8MAXCMD		R8SETTIMERS

string			Device = "/dev/ttyUSB0";
int				Command = 0;
int				Zone = 0;
int				Unit = 0;
bool				Verbose = false;
unsigned char	gCurrentTimers[8];

void Usage(void)
{
	cout << "Usage: Rain8Net -v -d <device> -c <command> -u <unit> -z <zone> -t <timer,timer,timer,timer,timer,timer,timer,timer>" << endl
		<< "\twhere:" << endl
		<< "\t\t-v\t\tTurn on messages" << endl
		<< "\t\t-d <device>\tdevice the Rain8Net is connected to. Default: \"/dev/ttyUSB0\"" << endl
		<< "\t\t-c <command>\tis one of:  on, off, alloff, status galloff comcheck gettimers settimers" << endl
		<< "\t\t-u <unit>\tis a valid unit number (1-254)" << endl
		<< "\t\t\t Required by on, off, alloff, status, gettimers, settimers" << endl
		<< "\t\t-z <zone>\tis a valid zone number (1-8)" << endl
		<< "\t\t\t Required by on, off" << endl
		<< "\t\t-t <timer,timer,timer,timer,timer,timer,timer,timer>\tvalid timer numbers (1-255)" << endl
		<< "\t\t\t Required by settimers" << endl
		<< "\t\t\t All 8 timer values are required" << endl << endl
		<< "\treturns\t0 or errno for commands ON / OFF" << endl
		<< "\t\t0 (off) or 1 (on) for STATUS" << endl;
}

bool parseArgs(int argc, char ** argv)
{
	bool bTimersGiven = false;

	while(1)
	{
		int c = getopt(argc, argv, "d:c:z:u:vt:");
		if (-1 == c)
			break;
			
		switch(c)
		{
			case	'd':
				Device = optarg;
				break;
			case	'c':
				if (0 == strcasecmp(optarg, "on"))
					Command = R8ON;
				else
				if (0 == strcasecmp(optarg, "off"))
					Command = R8OFF;
				else
				if (0 == strcasecmp(optarg, "alloff"))
					Command = R8ALLOFF;
				else
				if (0 == strcasecmp(optarg, "status"))
					Command = R8STATUS;
				else
				if (0 == strcasecmp(optarg, "galloff"))
					Command = R8GALLOFF;
				else
				if (0 == strcasecmp(optarg, "comcheck"))
					Command = R8COMCHECK;
				else
				if (0 == strcasecmp(optarg, "gettimers"))
					Command = R8GETTIMERS;
				else
				if (0 == strcasecmp(optarg, "settimers"))
					Command = R8SETTIMERS;
				break;
			case	'z':
				Zone = atoi(optarg);
				break;
			case	'u':
				Unit = atoi(optarg);
				break;
			case	'v':
				Verbose = true;
				break;
			case 't':
				{
					int iIndex = 0;
					string sTempStr = optarg;
					char *lpStr = const_cast<char *>(sTempStr.c_str());
					char *lpPtr = lpStr;
					while (1)
					{
						if ((lpPtr == 0) || ((*lpPtr) == 0))
						{
							break;
						}
						else if ((*lpPtr) == ',')
						{
							(*lpPtr) = 0;
							gCurrentTimers[iIndex] = static_cast<unsigned char>(strtoul(lpStr, 0, 10));
							if (gCurrentTimers[iIndex] == 0)
							{
								return false;
							}
							iIndex++;
							lpPtr++;
							lpStr = lpPtr;
						}
						else if (!isdigit((*lpPtr)))
						{
							return false;
						}
						else
						{
							lpPtr++;
						}
					}
					if (lpStr != lpPtr)
					{
						gCurrentTimers[iIndex] = static_cast<unsigned char>(strtoul(lpStr, 0, 10));
						iIndex++;
					}
					if (iIndex != 8)
					{
						return false;
					}

					bTimersGiven = true;
				}
				break;
			default:
				cout << "Unknown option specified: [" << c << "]" << endl;
				return false;
		}
	}

	/* Make sure the Command value is valid.  If it isn't, there is a serious bug above. */
	if ((1 > Command) || (R8MAXCMD < Command))
		return false;

	/* Only some commands require a unit. */
	switch (Command)
	{
		case R8ON:
		case R8OFF:
		case R8ALLOFF:
		case R8STATUS:
		case R8GETTIMERS:
		case R8SETTIMERS:
			if ((1 > Unit) || (254 < Unit))
				return false;
			break;
	}

	/* Only some commands require a zone. */
	switch (Command)
	{
		case R8ON:
		case R8OFF:
			if ((1 > Zone) || (8 < Zone))
				return false;
			break;
	}

	if (R8SETTIMERS == Command)
	{
		if (!bTimersGiven)
		{
			return false;
		}
	}

	return true; 
}

int main(int argc, char ** argv)
{
	
	if (!parseArgs(argc, argv))
	{
		Usage();
		return -1;
	}

	rain8net rain8;

	int rc = rain8.init(Device.c_str());

	if (0 != rc)
	{
		if (Verbose)
			cout << "Failed to initialize Rain8Net device.  rc:[" << strerror(errno) << "]" << endl;
		return rc;
	}
	if (Verbose)
		cout << "Opened Rain8Net device:[" << Device << "] successfully." << endl;
		
	switch(Command)
	{
		case	R8ON:
			if (Verbose)
				cout << "ON -- Unit:[" << Unit << "] Zone:[" << Zone << "]" << endl;
			rc = rain8.zoneOn(Unit, Zone);
			break;
			
		case	R8OFF:
			if (Verbose)
				cout << "OFF -- Unit:[" << Unit << "] Zone:[" << Zone << "]" << endl;
			rc = rain8.zoneOff(Unit, Zone);
			break;
			
		case	R8ALLOFF:
			if (Verbose)
				cout << "ALLOFF -- Unit:[" << Unit << "]" << endl;
			rc = rain8.allOff(Unit);
			break;
			
		case	R8STATUS:
			{
				if (Verbose)
					cout << "STATUS -- Unit:[" << Unit << "]" << endl;
				unsigned char status = 0;
				rc = rain8.getStatus(Unit, status);
				if (RAIN8_COMMAND_SUCCESS == rc)
				{
					cout << "getStatus returned success" << endl;
					rc = (status & (1 << (Zone - 1)) ? 1 : 0);
				}
				else
				{
					cout << "getStatus failed." << endl;
				}
			}
			break;

		case	R8GALLOFF:
			if (Verbose)
				cout << "GALLOFF -- Unit:[All] Zone:[All]" << endl;
			rc = rain8.globalAllOff();
			break;

		case R8COMCHECK:
			if (Verbose)
				cout  << "COMCHECK" << endl;
			rc = rain8.comCheck();
			if (0 == rc)
			{
				if (Verbose)
				{
					cout << "At least 1 unit is online." << endl;
				}
			}
			break;

		case R8GETTIMERS:
			if (Verbose)
				cout << "GETTIMERS -- Unit:[" << Unit << "]" << endl;
			rc = rain8.getZoneTimers(Unit, gCurrentTimers);
			if (0 == rc)
			{
				if (Verbose)
				{
					for (int i = 0; i < 8; i++)
					{
						cout << "\tZone:[" << i << "] -- Timer:[" << static_cast<unsigned int>(gCurrentTimers[i]) << "]" << endl;
					}
				}
			}
			break;

		case R8SETTIMERS:
			if (Verbose)
				cout << "SETTIMERS -- Unit:[" << Unit << "]" << endl;
			rc = rain8.setZoneTimers(Unit, gCurrentTimers);
			break;

		default:
			Usage();
			rc = -1;
			break;
	}

	char rcstr[128];

	sprintf(rcstr,"\n%s\n", (rc==-2)?"SUCCESS":"FAIL");
	if (Verbose)
		cout << rcstr << endl;
	
	return rc;
}

