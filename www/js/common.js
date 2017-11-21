///////////////////////// Defines ///////////////////////////////////////////////////////////////////////////////

var NUM_ZONES		= 8;
var NUM_SENSORS		= 8;

var NUM_ZONE_QUEUE_SLOTS = NUM_ZONES;
var DEFAULT_HISTORY_DAYS = 7;
var MS_1_HR		= 60*60*1000;
var MS_1_DAY		= 24*MS_1_HR;
var conf_filename	= "conf/irrigation_scheduler.conf";

///////////////////////// Global variables //////////////////////////////////////////////////////////////////////

var statusArea;
var server_ip		= location.host;
var servletPath		= "/irr";
var userName		= "demo1";
var g_conf              = {};
var g_plantList		= {};
var g_plantLabels	= [];
var useMetric		= 0;

var zoneConf		= [];
var zoneQueueSlotsUsed	= 0;
var zoneQueueSlot	= [];
var zoneRunning		= 0;
var numZones		= 0;
var selectedZone	= 1;

var today		= new Date();
var toDate		= new Date();
var historyStart	= new Date();
var historyEnd		= new Date();

var initializedFromDate= false;
var initializedToDate= false;

var tempHistory		= {};
var humidityHistory	= {};
var windSpeedHistory	= {};
var rainHistory		= {};
var iconHistory		= {};
var zoneRuntimeHistory  = {}; 

var mustSave		= false;

var clearingAlarms=0;
var stoppingRunCommand=0;

///////////////////////// Member functions //////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     ready
 *
 * @brief  Page onload entry point. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

$(document).ready(function(){
	initAll();
});

$.widget( "ui.timespinner", $.ui.spinner, {
	options: {
		// seconds
		step: 600 * 1000,
		// hours
		page: 60
	},
	_parse: function( value ) {
		if ( typeof value === "string" ) {
			// already a timestamp
			if ( Number( value ) == value ) {
				return Number( value );
			}
			return +Globalize.parseDate( value );
		}
		return value;
	},
	_format: function( value ) {
		return Globalize.format( new Date(value), "t" );
	}
});

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     initAll
 *
 * @brief  Handle common initialization. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function initAll()
{
	toDate = dateAddDays(today, 1); // Start with tomorrow as the rightmost day

	if(parent.bottom)
	{
		statusArea = parent.bottom.document.getElementById("statusArea");
	}

	for(i=0; i<NUM_ZONE_QUEUE_SLOTS; i++)
	{
		zoneQueueSlot[i] = new Object();
	}

	initHoverHelp();

	$('#login_button').click(function(event) {
		tryLogin();
	});

	$('#forgot_password_button').click(function(event) {
		forgotPassword();
	});

	$('#left_arrow_button').click(function(event) {
		toDate.setDate(toDate.getDate() - 1);
		displayScheduleTable();
	});

	$('#right_arrow_button').click(function(event) {
		toDate.setDate(toDate.getDate() + 1);
		displayScheduleTable();
	});

	$('#save_button').button({disabled:false}).click(function(event) {
		postSave();
	});

	$('#cancel_button').button({disabled:true}).click(function(event) {
		postSave();
	});

	$('#run_chart_totals_select').buttonset();

	$('#close_graphs_button').button({
		icons: {
			primary: "ui-icon-closethick"
		} 
	}).click(function( event ) {
		$('#run_totals_totals_div').hide("slide", { direction : "up" }, 300);
		$('#zone_run_chart_select').hide("slide", { direction : "up" }, 300 );
	});

	getConf();

	/*pollServerAlarms();*/
}

function initHoverHelp()
{
	// initialize help on hover
	$('.has-help').hover( function(event) {
		var id       = $(this).attr('id');
		var isButton = $(this).hasClass('button');
		var imgSrc   = $(this).attr('src')

		if (event.type =='mouseenter')
		{
			$('#help_box').css('display', 'inline-block');
			$('#help_box').css('border-color', '#b0b0b0');
			$('#help_box').html(helpText[id]);
			if (isButton)
			{
				if (imgSrc.search('_o') == -1)
				{
					$(this).attr('src', imgSrc.replace('.','_o.'));
				}
			}
		}
		else if (event.type =='mouseleave')
		{
			$('#help_box').css('display', 'none');
			$('#help_box').css('border-color', '#ffffff');

			if (isButton)
			{
				$(this).attr('src', imgSrc.replace('_o.', '.'));
			}
		}
	});

}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     onConfGetComplete
 *
 * @brief  We've received 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function onConfGetComplete()
{
	if (!initializedFromDate)
	{
		var fDate = fromDate();
		getLog(fDate.getMonth()+1, fDate.getFullYear()); 
		initializedFromDate= true;
	}
	else
	{
		// since we aren't updating the logs, trigger schedule table refresh here
		//displayScheduleTable();
		displayScheduleTable();
	}
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     onLogRequestComplete
 *
 * @brief  completion signal for log request
 */
/*-------------------------------------------------------------------------------------------------------------*/

function onLogRequestComplete()
{
	var fDate = fromDate();

	if (toDate.getMonth() == fDate.getMonth() && toDate.getFullYear() == fDate.getFullYear())
	{
		// If to date is same month/year as from, skip fetching the data
		// because it will be the same.
		initializedToDate= true;		
	}
	
	if (!initializedToDate)
	{
		getLog(toDate.getMonth()+1, toDate.getYear()); 
		initializedToDate= true;
	}
	else
	{
		onFullLogRequestComplete();
	}
}

function onFullLogRequestComplete()
{
	displayScheduleTable();

	for (i in zoneSeriesConfig)
	{
		s = Number(i) + 1;
		zoneSeriesConfig[i].chartRunTimeSeries.label         = "Zone "+s;
		zoneSeriesConfig[i].chartRunTimeSeries.showMarker    = false;
		zoneSeriesConfig[i].chartRunTimeSeries.pointLabels   = tptObj;
		zoneSeriesConfig[i].chartRunTimeSeries.color         = zoneColors[i];
	}	

}


/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     writeStatus
 *
 * @brief  Display in the status area.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function writeStatus(str) {
	if(statusArea)
		statusArea.innerHTML += str + "<br />";
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     fromDate, dateAddDays, firstDate, lastDate, displayDateStr, to24hrStr
 *
 * @brief  Date utility functions
 */
/*-------------------------------------------------------------------------------------------------------------*/

function fromDate()
{
	var d = new Date(toDate);
	d.setDate(toDate.getDate() - g_conf.historyDays);
	return d;
}

function dateAddDays(_date, _days)
{
	var newDate = new Date(_date);
	newDate.setDate(_date.getDate() + _days);
	return newDate;
}

function dateSubDays(_date, _days)
{
	return new Date(toDate.getDate() - _days);
}


function firstDate(_date1, _date2)
{
	return (_date1 > _date2) ? _date2 : _date1;
}

function lastDate(_date1, _date2)
{
	return (_date1 > _date2) ? _date1 : _date2;
}

function datesAreEqual(_date1, _date2)
{
	return (_date1.getFullYear()  == _date2.getFullYear() && 
			_date1.getMonth() == _date2.getMonth() && 
			_date1.getDate()   == _date2.getDate() );
}

function dateIsAfter(_date1, _date2)
{
    if (_date1.getFullYear()  > _date2.getFullYear())
    {
	return true;
    }
    else if (_date1.getFullYear()  < _date2.getFullYear())
    {
	return false;
    }
    
    // years are equal
    if (_date1.getMonth() > _date2.getMonth())
    {
	return true;
    }
    else if (_date1.getMonth() < _date2.getMonth())
    {
	return false;
    }
		
    // month and year are equal.
    return (_date1.getDate() > _date2.getDate());
}

function displayDateStr(ds)
{
	var month = Number(ds.getMonth())+1;
	return useMetric ? ds.getDate().toString()+"/"+month+"/"+ds.getFullYear():
		month+"/"+ds.getDate().toString()+"/"+ds.getFullYear().toString();
}

function getDateString(mydate)
{
	return (mydate.getMonth()+1)+"-"+mydate.getDate()+"-"+mydate.getFullYear();
}

function to24hrStr(hr, min, am_pm)
{
	var hr_val = hr;
	var min_val = min;

	if(am_pm == "PM")
	{
		hr_val = Number(12) + Number(hr_val);
	}

	return hr_val+":"+min_val;
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     validInt
 *
 * @brief  Given an int, turn it to 0 if it is undefined.
 */
/*-------------------------------------------------------------------------------------------------------------*/


function validInt(_myInt)
{
	return _myInt == 'NaN' ? 0 : _myInt;
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     dateHashStr etc
 *
 * @brief  Build a hash string out of dates for storing in a sparse array.
 */
/*-------------------------------------------------------------------------------------------------------------*/


function dateHashStr(_date)
{
	var h = hashStr( _date.getFullYear().toString(), (_date.getMonth()+1).toString(),  _date.getDate().toString());
	return h;
}

function numDateHashStr(_num, _date)
{
	var h = hashStr( _num.toString(), _date.getFullYear().toString(), (_date.getMonth()+1).toString(),  _date.getDate().toString());
	return h;
}

function hashStr () 
{
	var h='';
	for (i=0; i<arguments.length; i++)
	{
		h += arguments[i]+'-';
	}

	return h;
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     trim etc.
 *
 * @brief  For trimming whitespace
 */
/*-------------------------------------------------------------------------------------------------------------*/

function trim () 
{
	return this.replace(/^\s+|\s+$/g, '');
};

function ltrim()
{
	return this.replace(/^\s+/,'');
};

function rtrim()
{
	return this.replace(/\s+$/,'');
};

function fulltrim()
{
	return this.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ');
};

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     needSave
 *
 * @brief  Enable save buttons when values change
 */
/*-------------------------------------------------------------------------------------------------------------*/

function needSave()
{
	$('.save_button').button({'disabled':'false'});
}

function isUndefined(_var)
{
    return (typeof _var == 'undefined');
}
