// /////////////////////// Global variables
// //////////////////////////////////////////////////////////////////////

var MAX_RUNTIME_SLOTS = 8;
var MAX_ALGORITHM_SLOTS = 4;
var DEFAULT_HISTORY_DAYS = 7;

var g = {
	globalConf : {},
	airportCode : "",
	runTime : "",
	algorithm: [],
	zoneConf : [],
	numZones : 0,
	tempHistory : {},
	precipHistory : {},
	iconHistory : {},
	runtimeHistory : {},
	toDate : new Date(),
	scheduledRuntimeSlots : 0,
	selectedZone: -1,
	runTable : [],
	running : false,
	currentLayer : "schedule"
};

var statusArea;
var server_ip = location.host;
var confFilename = "conf/irctl_conf.json"

// /////////////////////// Member functions
// //////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn ready
 * @brief Page onload entry point.
 */
/*-------------------------------------------------------------------------------------------------------------*/

$(document).ready(function() {
	runTests();
	// initAll();
});

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn initAll
 * @brief Handle common initialization.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function initAll() {
	//g.toDate = dateAddDays(Date(), 1); // Start with tomorrow as the rightmost day

	if (parent.bottom) {
		statusArea = parent.bottom.document.getElementById("statusArea");
	}

	// initialize help on hover
	$('.has-help').hover(function(event) {
		var id = $(this).attr('id');
		var isButton = $(this).hasClass('button');
		var imgSrc = $(this).attr('src')

		if (event.type == 'mouseenter') {
			$('#help_box').css('display', 'inline-block');
			$('#help_box').css('border-color', '#b0b0b0');
			$('#help_box').html(helpText[id]);
			if (isButton) {
				$(this).attr('src', imgSrc.replace('.', '_o.'));
				// $(this).css('box-shadow','0px 0px 5px 5px #EDCAA1',
				// 'border-radius','3px');
			}
		} else if (event.type == 'mouseleave') {
			$('#help_box').css('display', 'none');
			$('#help_box').css('border-color', '#ffffff');

			if (isButton) {
				$(this).attr('src', imgSrc.replace('_o.', '.'));
			}
		}
	});

	$('#left_arrow_button').click(function(event) {
		toDate.setDate(toDate.getDate() - 1);
		displayScheduleTable();
	});

	$('#right_arrow_button').click(function(event) {
		toDate.setDate(toDate.getDate() + 1);
		displayScheduleTable();
	});

	$('#done_button').button();
	$('#save_button').button({
		disabled : true
	});

	$('#done_button').click(function(event) {
		onDoneButtonClick();
	});

	$('#save_button').click(function(event) {
		onSaveButtonClick();
	});

	$('#run_button').click(function(event) {
		onRunButtonClick();
	});

	$('#run_exit_button').click(function(event) {
		onRunExitButtonClick();
	});

	$('#run_cancel_button_running').click(function(event) {
		onRunCancelButtonRunningClick();
	});

	/*
	 * getConfFile(); pollServerAlarms();
	 */
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn onConfFileGetComplete
 * @brief We've received
 */
/*-------------------------------------------------------------------------------------------------------------*/

function onConfFileGetComplete() {
	if (!initializedHistory) {
		getServerLogData(dateSubDays(toDate, 31), toDate); // grab history from
		// server and refresh
		// schedule
		initializedHistory = true;
	} else {
		// since we aren't updating the logs, trigger schedule table refresh
		// here
		displayScheduleTable();
	}
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn onServerLogRequestComplete
 * @brief We received and pared
 */
/*-------------------------------------------------------------------------------------------------------------*/

function onServerLogRequestComplete() {
	historyStart = newHistoryStart;
	historyEnd = newHistoryEnd;

	displayScheduleTable();
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn writeStatus
 * @brief Display in the status area.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function writeStatus(str) {
	if (statusArea)
		statusArea.innerHTML += str + "<br />";
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn fromDate, dateAddDays, firstDate, lastDate, displayDateStr, to24hrStr
 * @brief Date utility functions
 */
/*-------------------------------------------------------------------------------------------------------------*/

function fromDate() {
	return new Date(toDate.getDate() - historyDays);
}

function dateAddDays(_date, _days) {
	var newDate = new Date(_date);
	newDate.setDate(_date.getDate() + _days);
	return newDate;
}

function dateSubDays(_date, _days) {
	return new Date(toDate.getDate() - _days);
}

function firstDate(_date1, _date2) {
	return (_date1 > _date2) ? _date2 : _date1;
}

function lastDate(_date1, _date2) {
	return (_date1 > _date2) ? _date1 : _date2;
}

function datesAreEqual(_date1, _date2) {
	return (_date1.getFullYear() == _date2.getFullYear()
			&& _date1.getMonth() == _date2.getMonth() && _date1.getDay() == _date2
			.getDay());
}

function displayDateStr(ds) {
	var month = Number(ds.getMonth()) + 1;
	return useMetric ? ds.getDate().toString() + "/" + month + "/"
			+ ds.getFullYear() : month + "/" + ds.getDate().toString() + "/"
			+ ds.getFullYear().toString();
}

function DateString(mydate) {
	return (mydate.getMonth() + 1) + "-" + mydate.getDate() + "-"
			+ mydate.getFullYear();
}

function to24hrStr(hr, min, am_pm) {
	var hr_val = hr;
	var min_val = min;

	if (am_pm == "PM") {
		hr_val = Number(12) + Number(hr_val);
	}

	return hr_val + ":" + min_val;
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn validInt
 * @brief Given an int, turn it to 0 if it is undefined.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function validInt(_myInt) {
	return _myInt == 'NaN' ? 0 : _myInt;
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn trim etc.
 * @brief For trimming whitespace
 */
/*-------------------------------------------------------------------------------------------------------------*/

function trim() {
	return this.replace(/^\s+|\s+$/g, '');
};

function ltrim() {
	return this.replace(/^\s+/, '');
};

function rtrim() {
	return this.replace(/\s+$/, '');
};

function fulltrim() {
	return this.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, '')
			.replace(/\s+/g, ' ');
};

function Debug(text) {
  console.log(text);
} 