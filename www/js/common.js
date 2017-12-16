// /////////////////////// Defines
// ///////////////////////////////////////////////////////////////////////////////

var NUM_ZONES = 8;
var NUM_SENSORS = 8;

var NUM_ZONE_QUEUE_SLOTS = NUM_ZONES;
var DEFAULT_HISTORY_DAYS = 7;
var MS_1_HR = 60 * 60 * 1000;
var MS_1_DAY = 24 * MS_1_HR;

// /////////////////////// Global variables
// //////////////////////////////////////////////////////////////////////

var statusArea;
var server_ip = location.host;
var confFilename = "conf/irctl_conf.json"

var globalConf = new Object();
var zoneConf = [];
var airportCode = "";
var runTime = "";

var zoneQueueSlotsUsed = 0;
var zoneQueueSlot = [];
var zoneRunning = 0;
var numZones = 0;
var selectedZone = 1;

var today = new Date();
var toDate = new Date();
var historyStart = new Date();
var historyEnd = new Date();

var initializedHistory = false;

var tempHistory = {};
var precipHistory = {};
var iconHistory = {};
var runtimeHistory = {};

var selectedZone = -1;

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

$.widget("ui.timespinner", $.ui.spinner, {
    options: {
        // seconds
        step: 600 * 1000,
        // hours
        page: 60
    },
    _parse: function(value) {
      if (typeof value === "string") {
        // already a timestamp
        if (Number(value) == value) {
          return Number(value);
        }
        return +Globalize.parseDate(value);
      }
      return value;
    },
    _format: function(value) {
      return Globalize.format(new Date(value), "t");
    }
});

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn initAll
 * @brief Handle common initialization.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function initAll() {
  toDate = dateAddDays(today, 1); // Start with tomorrow as the rightmost day

  if (parent.bottom) {
    statusArea = parent.bottom.document.getElementById("statusArea");
  }

  for (i = 0; i < NUM_ZONE_QUEUE_SLOTS; i++) {
    zoneQueueSlot[i] = new Object();
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
    disabled: true
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

 $('#runtime_input').timepicker({
      showPeriod: true,
      showLeadingZero: false
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
    // since we aren't updating the logs, trigger schedule table refresh here
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
  return (_date1.getFullYear() == _date2.getFullYear() && _date1.getMonth() == _date2.getMonth() && _date1.getDay() == _date2.getDay());
}

function displayDateStr(ds) {
  var month = Number(ds.getMonth()) + 1;
  return useMetric ? ds.getDate().toString() + "/" + month + "/" + ds.getFullYear() : month + "/" + ds.getDate().toString() + "/" + ds.getFullYear().toString();
}

function DateString(mydate) {
  return (mydate.getMonth() + 1) + "-" + mydate.getDate() + "-" + mydate.getFullYear();
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
 * @fn dateHashStr etc
 * @brief Build a hash string out of dates for storing in a sparse array.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function dateHashStr(_date) {
  var h = hashStr(_date.getFullYear().toString(), (_date.getMonth() + 1).toString(), _date.getDate().toString());
  return h;
}

function numDateHashStr(_num, _date) {
  var h = hashStr(_num.toString(), _date.getFullYear().toString(), (_date.getMonth() + 1).toString(), _date.getDate().toString());
  return h;
}

function hashStr() {
  var h = '';
  for (i = 0; i < arguments.length; i++) {
    h += arguments[i] + '-';
  }

  return h;
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
  return this.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, '').replace(/\s+/g, ' ');
};

