var MAX_RUNTIME_SLOTS = 5;

var scheduledRuntimeSlots = 0;
var runTable = [];
var running = false;

/*
 * ======================================== SCHEDULE TABLE
 * =====================================================
 */

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn displayScheduleTable
 * @brief Display the schedule table. This table is dynamically generated, so
 *        there's no update function. It must be rebuilt every time.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displayScheduleTable() {
	today = new Date();
	var d = new Date();

	var tableHTML = '';
	var dayStr;
	var i;
	numDays = DEFAULT_HISTORY_DAYS;

	// ---- Column group ----

	tableHTML += '<table id="schedule_table" > \r\n';
	tableHTML += '	<colgroup> \r\n';
	tableHTML += '	  <col style="width: 355px"/> \r\n';

	for (i = 0; i < numDays; i++) {
		tableHTML += '	  <col style="width: 40px"/> \r\n';
	}
	tableHTML += '	</colgroup> \r\n';

	// ---- Day ----

	tableHTML += '	  <thead> \r\n';
	tableHTML += '	    <tr data-table-row="day" class="day-row"> \r\n';
	tableHTML += '	      <td></td> \r\n';

	for (i = 0; i < numDays; i++) {
		d.setTime(toDate.getTime());
		d.setDate(toDate.getDate() - (numDays - 1) + i);

		dayStr = dayNameStr[d.getDay()];

		if (datesAreEqual(d, today)) {
			tableHTML += '	      <td data-table-col="' + i
					+ '" class="day-label" style="background:#' + BG_COLOR_STR
					+ ';">Today</td> \r\n';
		} else {
			tableHTML += '	      <td data-table-col="' + i
					+ '" class="day-label">' + dayStr + '</td> \r\n';
		}
	}

	tableHTML += '	    </tr> \r\n';

	// ---- Weather ----

	tableHTML += ' 	   <tr data-table-row="weather" class="weather-row" height="50px"> \r\n';
	tableHTML += '	      <td></td> \r\n';

	for (i = 0; i < numDays; i++) {
		d.setTime(toDate.getTime());
		d.setDate(toDate.getDate() - (numDays - 1) + i);
		var dstr = DateString(d);
		var temp = Math.round(tempHistory[dstr]);

		tableHTML += ' <td background="img/weather/' + iconHistory[dstr]
				+ '.png"' + 'width="60px"><div data-table-col="' + i
				+ '" class="weather-icon" align="right"><b>' + temp
				+ '</b></td> \r\n';
	}

	tableHTML += '	    </tr> \r\n';
	tableHTML += '	  </thead> \r\n';

	tableHTML += '	  <tbody> \r\n';

	// ---- Schedule ----

	for (z = 0; z < numZones; z++) {
		var oddStr = '';
		if (z % 2) {
			oddStr = 'class="odd"';
		}
		tableHTML += '	    <tr ' + oddStr + '> \r\n';
		tableHTML += '	      <td><div class="zone-name selectable" value="'
				+ z.toString() + '">' + zoneConf[z].Name + '</div></td> \r\n';

		for (i = 0; i < numDays; i++) {
			d.setTime(toDate.getTime());
			d.setDate(toDate.getDate() - (numDays - 1) + i);
			var dstr = DateString(d);

			var runTime = Math.round(runtimeHistory[dstr][z]);

			tableHTML += '	      <td data-table-col="' + i
					+ '" class="schedule-entry">' + runTime + '</td> \r\n';
		}

		tableHTML += '	    </tr> \r\n';
	}

	tableHTML += '	  </tbody> \r\n';
	tableHTML += '    </table> \r\n';

	// writeStatus('<xmp>'+tableHTML+'</xmp>');

	$("#schedule_table").remove();
	$("#schedule_table_div").append(tableHTML);
}

/*
 * ======================================== CONFIG TABLE
 * =======================================================
 */

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn displayZoneConfigTable
 * @brief Generate the HTML for the zone config table and display it.
 */
/*-------------------------------------------------------------------------------------------------------------*/
function displayZoneConfigTable() {
	var tableHTML = '';

	for (z = 0; z < numZones; z++) {
		var oddStr = '';
		if (z % 2) {
			oddStr = 'class="odd"';
		}
		tableHTML += '      <tr ' + oddStr + '> \r\n';
		tableHTML += '        <td><input type="checkbox" class="cv run-checkbox"'
				+ boolToChecked(zoneConf[z].Enabled) + '></td> \r\n';
		tableHTML += '        <td><input type="checkbox" class="rain-checkbox" '
				+ boolToChecked(zoneConf[z].GetsRain) + '></td> \r\n';
		tableHTML += '        <td><input type="text" class="etrate-input" value="'
				+ zoneConf[z].ZoneETRate + '"></td> \r\n';
		tableHTML += '        <td><input type="text" class="runmult-input" value="'
				+ zoneConf[z].RunTimeMultiplier + '"></td> \r\n';
		tableHTML += '        <td><input type="text" class="depthin-input" value="'
				+ zoneConf[z].DepthIn + '"></td> \r\n';
		tableHTML += '        <td><input type="text" class="minvwc-input" value="'
				+ zoneConf[z].MinVWC + '"></td> \r\n';
		tableHTML += '        <td><input type="text" class="maxvwc-input" value="'
				+ zoneConf[z].MaxVWC + '"></td> \r\n';
		tableHTML += '      </tr> \r\n';
	}

	tableHTML += '      <tr style="height: 40px; font-size: 1.2em;"> \r\n';
	tableHTML += '      <td></td> \r\n';
	tableHTML += '      <td colspan="3">Airport code<input type="text" id="airport_code" style="width: 80px;" value="'
			+ airportCode + '"></td> \r\n';
	tableHTML += '      <td colspan="3">Run time<input type="text" id="runtime_input" style="width: 80px;" value="'
			+ runTime + '"></td> \r\n';
	tableHTML += '      </tr> \r\n';

	$("#zone_config_table > tbody").html(tableHTML);
	$('#zone_config_table_div').css('display', 'inline-block');
	$('#zone_config_table_buttons_div').css('display', 'inline-block');
	$('.cv').change(onValueChange);
	$('#zone_config_table > tr > td > input').change(onValueChange);
}

function boolToChecked(boolVal) {
	return boolVal ? "checked" : "";
}

function copyUIToConfig() {
	for (z = 0; z < numZones; z++) {
		zn = (z + 1).toString()
		zoneConf[z].Enabled = $(
				'#zone_config_table tr:eq(' + zn + ') td input.run-checkbox')
				.is(':checked');
		zoneConf[z].GetsRain = $(
				'#zone_config_table tr:eq(' + zn + ') td input.rain-checkbox')
				.is(':checked');
		zoneConf[z].ZoneETRate = parseFloat($(
				'#zone_config_table tr:eq(' + zn + ') td input.etrate-input')
				.val());
		zoneConf[z].RunTimeMultiplier = parseFloat($(
				'#zone_config_table tr:eq(' + zn + ') td input.runmult-input')
				.val());
		zoneConf[z].DepthIn = parseFloat($(
				'#zone_config_table tr:eq(' + zn + ') td input.depthin-input')
				.val());
		zoneConf[z].MinVWC = parseFloat($(
				'#zone_config_table tr:eq(' + zn + ') td input.minvwc-input')
				.val());
		zoneConf[z].MaxVWC = parseFloat($(
				'#zone_config_table tr:eq(' + zn + ') td input.maxvwc-input')
				.val());
	}

	globalConf.GlobalConfig.AirportCode = $('#airport_code').val();
	globalConf.GlobalConfig.RunTimeAM = "0000-01-01T"
			+ $('#runtime_input').val() + "Z";
	globalConf.ZoneConfigs = zoneConf;

	console.log(JSON.stringify(globalConf, null, 2));
}

// //////////////// Event handlers ///////////////////

function onDoneButtonClick() {
	$('#zone_config_table_div').css('display', 'none');
	$('#zone_config_table_buttons_div').css('display', 'none');
}

function onSaveButtonClick() {
	copyUIToConfig();
}

function onValueChange() {
	$('#save_button').button("option", "disabled", false);
}

/*
 * ======================================== RUN TABLE
 * ==========================================================
 */

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn displayRunTable
 * @brief Generate the HTML for the run table.
 */
/*-------------------------------------------------------------------------------------------------------------*/
function displayRunTable() {
	$('#run_table_div').css('display', 'inline-block');
	$('#run_table_buttons_div').css('display', 'inline-block');

	var tableHTML = '';
	for (i = 0; i < scheduledRuntimeSlots; i++) {
		tableHTML += '      <tr> \r\n';
		tableHTML += '        <td>' + runTable[i].ZoneName + ' </td> \r\n';
		tableHTML += '        <td>' + runTable[i].RunMins + ' </td> \r\n';
		tableHTML += '        <td><button value="'
				+ i.toString()
				+ '" class="run-cancel-button button text-button" style="width: 80px;">Cancel</button></td> \r\n';
		tableHTML += '      </tr> \r\n';
	}

	$("#run_table > tbody").html(tableHTML);

	$('.run-cancel-button').button();
	$('.run-cancel-button').click(onRunCancelButtonClick);

	$('.zone-name').click(function(event) {
		$('.zone-name').parent().removeClass("selected");
		var target = $(this);
		target.parent().addClass('selected');
		selectedZone = $(this).attr('value');
	});
}

// Append zone with given runtime to the run table.
function appendRunTableEntry(zoneNumber, zoneName, runMins) {
	if (scheduledRuntimeSlots == MAX_RUNTIME_SLOTS) {
		alert("All run slots are full.");
		return;
	}
	ns = scheduledRuntimeSlots;

	runTable[ns] = {};
	runTable[ns].ZoneNumber = zoneNumber;
	runTable[ns].ZoneName = zoneName;
	runTable[ns].RunMins = runMins;

	scheduledRuntimeSlots++;

	displayRunTable();
}

// Remove zone with the given slotNum from run table.
function removeRunTableEntry(slotNum) {
	if (slotNum >= scheduledRuntimeSlots) {
		alert("Removing non-existent entry.");
		return;
	}

	runTable[i] = {};
	for (i = slotNum; i < scheduledRuntimeSlots-1; i++) {
		runTable[i] = runTable[i + 1];
	}

	scheduledRuntimeSlots--;
	runTable[scheduledRuntimeSlots] = {};

	displayRunTable();
}

function startNextIfScheduled() {
	if (scheduledRuntimeSlots == 0) {
		return;
	}
	zoneName = runTable[0].ZoneName;
	runMins = runTable[0].RunMins;
	removeRunTableEntry(0);
	runZone(zoneName, runMins);
}

function runZone(zoneName, runMins) {
	$('#run_table_div thead tr > td').css('background-color', '#0a9b3b');
	$('#run_table_div thead tr > td').css('color', '#fff');
	$('#running_zone_name').html(zoneName);
	$('#running_zone_countdown').countdown({
		until : runMins + "M",
		compact : true,
		format : 'MS',
		description : '',
		onExpiry : onRunCountdownComplete
	});
	$('#run_cancel_button_running').css('display', 'inline-block');
	running = true;

}

// //////////////// Event handlers //////////////////////

function onRunCountdownComplete() {
	$('#running_zone_countdown').countdown('destroy');

	if (scheduledRuntimeSlots == 0) {
		$('#run_table_div thead tr > td').css('background-color', '#fff');
		return;
	}
	startNextIfScheduled();
}

function onRunButtonClick() {
	zoneName = zoneConf[selectedZone].Name;
	runMins = $('#runtime_mins_input').val();
	if (!running) {
		runZone(zoneName, runMins);
		return;
	}

	appendRunTableEntry(selectedZone, zoneName, runMins);
}

function onRunCancelButtonRunningClick() {
	$('#running_zone_name').html("");
	$('#run_cancel_button_running').css('display', 'none');
	$('#running_zone_countdown').countdown('destroy');
	running = false;
}

function onRunCancelButtonClick() {
	var target = $(this);
	slotNum = $(this).attr('value');
	removeRunTableEntry(parseInt(slotNum));
	displayRunTable();
}