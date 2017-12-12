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

		tableHTML += '	      <td background="img/weather/' + iconHistory[dstr]
				+ '.png" width="60px"><div data-table-col="' + i
				+ '" class="weather-icon" align="right"><b>' + temp
				+ '</b></td> \r\n';
	}

	tableHTML += '	    </tr> \r\n';
	tableHTML += '	  </thead> \r\n';

	tableHTML += '	  <tbody> \r\n';

	// ---- Schedule ----

	for (z = 0; z <= numZones; z++) {
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

	$(".zone-name").click(function(event) {
		var eventVal = event.target.attributes.value;
		selectedZone = parseInt(eventVal.value);
		updateZoneConfigTable();
		showMenu("zone_config_table");
		$('.zone-name').removeClass('selected');
		$('.zone-name[value="' + selectedZone + '"]').addClass('selected');
	});

}

// /////////////////////// System settings table
// /////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn displaySystemSettingsTable
 * @brief Generate and display the system settings table
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displaySystemSettingsTable() {
	$('.selectable').removeClass('selected');
	updateSystemSettingsTable();
	showMenu("system_settings_table");
}

function updateSystemSettingsTable() {
	$('#weather_station_text').val(globalConf.weatherStation);
	$("#watering_time_spinner").timespinner();
	$("#watering_time_spinner").timespinner('value', globalConf.runTime1);
}

// /////////////////////// Zone config table
// /////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn updateZoneConfigTable
 * @brief Generate the HTML for the zone config table, using the selected zone
 */
/*-------------------------------------------------------------------------------------------------------------*/
/*
 setDiv('.ZONE[data-object_name="soil_name"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "SoilConfig.Name"));
 setDiv('.ZONE[data-object_name="et_rate"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "ZoneETRate"));

 setEnabled('.ZONE[data-object_name="run"][data-array-index="' + num + '"]'), getPathOrLogErr(zconf, "Enabled")
 setEnabled('.ZONE[data-object_name="rain"][data-array-index="' + num + '"]'), getPathOrLogErr(zconf, "GetsRain")
 */

function displayZoneConfigTable() {
	//updateZoneConfigTable();
	$('#zone_config_table_div').css('display', 'inline-block');
}

function updateZoneConfigTable() {
	var zconf = zoneConf[selectedZone];

	$("#zone_name").html(zconf.Name);
	$("#zone_num").html('Valve &nbsp ' + zconf.Number);
	setEnabled("#zone_enabled", zconf.Enabled);
	setEnabled("#zone_gets_rain", zconf.GetsRain);

	$("#zone_depth").html(zconf.DepthIn);
	$("#zone_et_rate").html(zconf.ZoneETRate);
	$("#zone_runtime_multiplier").html(zconf.RunTimeMultiplier);

	$("#zone_soil_name").html(zconf.SoilConfig.Name);
	$("#zone_min_vwc").html(zconf.MinVWC);
	$("#zone_max_vwc").html(zconf.MaxVWC);

}

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// /////////////////////// Table generation functions
// ////////////////////////////////////////////////////////////
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn showMenu
 * @brief Given a menu id, hide all the other menus and show this menu. Handle
 *        highlighting.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function showMenu(_id) {
	displayedMenu = _id;

	if ($('#' + _id).hasClass('left-table')) {
		// we are asked to display a left menu, so
		// we must clear and unselect all left and right tables.
		$('.menu-table').css('display', 'none');
		$('#' + _id).css('display', 'inline-block');

		$('.left-menu-submenu').removeClass('selected');
		$('.second-level-menu-item').removeClass('selected');
		$('.third-level-menu-item').css('display', 'none');
		$('#cancel_button').css('display', 'inline-block');
		$('#save_button').css('display', 'inline-block');
	} else {
		// highlight the selected item in left menu
		$('.left-menu-submenu').removeClass('selected');
		$('#' + _id + '_select').addClass('selected');

		// show the menu
		$(".menu-table").filter(".right-table").css('display', 'none');
		$('#' + _id).css('display', 'inline-block');
	}
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn initSecondLevelMenus
 * @brief Setup click functions for the second level display menus (which cause
 *        children to be displayed) and third level, which will populate the
 *        parent with the selected value.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function initSecondLevelMenus() {
	$('.second-level-menu-item').each(function() {

		$(this).click(function(event) {
			$('.third-level-menu-item').css('display', 'none');
			var id = $(this).attr('id');
			$('[data-childof="' + id + '"]').css('display', 'inline-block');
		});
	});

	$('.third-level-menu-item').click(function(event) {
		$('.third-level-menu-item').css('display', 'none');
		var parent = $('#' + $(this).attr('data-childof'));
		parent.html(parent.attr('data-preText') + ' ' + $(this).attr('value'));
		parent.val($(this).attr('value'));
	});
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn selectOption
 * @brief Make the given option selected. Pass in the element ID and selected
 *        value text.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function selectOption(_select_id, _option_val) {
	$("select#" + _select_id + " option").filter(function() {
		return $(this).text() == _option_val;
	}).attr('selected', 'selected');
}
