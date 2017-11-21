///////////////////////// Member functions //////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     displayScheduleTable
 *
 * @brief  Display the schedule table. This table is dynamically generated, so there's no update function.
 *         It must be rebuilt every time.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displayScheduleTable()
{
    today = new Date();
    var d = new Date();

    var tableHTML ='';
    var dayStr;
    var i;

    // ---- Column group ----

    tableHTML += '<table id="schedule_table" > \r\n';
    tableHTML += '	<colgroup> \r\n';
    tableHTML += '	  <col style="width: 255px"/> \r\n';

    for (i=0; i<globalConf.historyDays; i++)
    {
	tableHTML += '	  <col style="width: 40px"/> \r\n';
    }
    tableHTML += '	</colgroup> \r\n';

    // ---- Day ----

    tableHTML += '	  <thead> \r\n';
    tableHTML += '	    <tr data-table-row="day" class="day-row"> \r\n';
    tableHTML += '	      <td></td> \r\n';

    for (i=0; i<globalConf.historyDays; i++)
    {
	d.setTime(toDate.getTime());
	d.setDate(toDate.getDate() - (globalConf.historyDays-1) + i);

	dayStr = dateStr[d.getDay()];
	
	if (datesAreEqual(d,today))
	{
	    tableHTML += '	      <td data-table-col="' + i + '" class="day-label" style="background:#' + BG_COLOR_STR + ';">Today</td> \r\n';
	}
	else
	{
	    tableHTML += '	      <td data-table-col="' + i + '" class="day-label">' + dayStr +'</td> \r\n';
	}
    }
    
    tableHTML += '	    </tr> \r\n';

    // ---- Weather ----

    tableHTML += ' 	   <tr data-table-row="weather" class="weather-row" height="50px"> \r\n';
    tableHTML += '	      <td></td> \r\n';

    for (i=0; i<globalConf.historyDays; i++)
    {
	d.setTime(toDate.getTime());
	d.setDate(toDate.getDate() - (globalConf.historyDays-1) + i);
	var hashDate = dateHashStr(d);

	var weatherIcon = iconHistory[hashDate]
	var tempFull  = tempHistory[dateHashStr(d)];
	var temp      = Math.round(parseFloat(tempFull));

	tableHTML += '	      <td background="images/weather/' + iconHistory[dateHashStr(d)] + 
	    '.png" width="60px"><div data-table-col="'+ i +
	    '" class="weather-icon" align="right">'+ temp +'</td> \r\n';
    }

    tableHTML += '	    </tr> \r\n';
    tableHTML += '	  </thead> \r\n';

    tableHTML += '	  <tbody> \r\n';

    // ---- Schedule ----

    for (z=0; z<numZones; z++)
    {
	var oddStr='';
	if (z%2)
	{
	    oddStr='class="odd"';
	}
	tableHTML += '	    <tr '+ oddStr +'> \r\n';
	tableHTML += '	      <td><div class="zone-name selectable" value="'+ z.toString() +'">'+ zoneConf[z].name +'</div></td> \r\n';

	for (i=0; i<globalConf.historyDays; i++)
	{
	    d.setTime(toDate.getTime());

	    d.setDate(toDate.getDate() - (globalConf.historyDays-1) + i);
  
	    var hashDate = numDateHashStr(z, d);
	    var runTime  = parseInt(zoneRuntimeHistory[hashDate]);

	    var imageSrcStr = '<img src="images/drops/'+ getAmountImgStr(runTime) +'.png">';

	    tableHTML += '	      <td data-table-col="'+ i +'" class="schedule-entry">'+ imageSrcStr +'</td> \r\n';
	}

	tableHTML += '	    </tr> \r\n';
    }

    tableHTML += '	  </tbody> \r\n';
    tableHTML += '    </table> \r\n';

    //writeStatus('<xmp>'+tableHTML+'</xmp>');

    $("#schedule_table").remove();
    $("#schedule_table_div").append(tableHTML);   

    $( ".zone-name" ).click(function(event) {
	var eventVal = event.target.attributes.value;
	selectedZone = parseInt(eventVal.value);
	updateZoneConfigTable();
	showMenu("zone_config_table");
	$('.zone-name').removeClass('selected');
	$('.zone-name[value="'+selectedZone+'"]').addClass('selected');
    });

}

///////////////////////// System settings table /////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     displaySystemSettingsTable
 *
 * @brief  Generate and display the system settings table
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displaySystemSettingsTable()
{
    $('.selectable').removeClass('selected');
    updateSystemSettingsTable();
    showMenu("system_settings_table");
}

function updateSystemSettingsTable()
{
    $('#climate_zone_text').val(globalConf.climateZone);
    $('#weather_station_text').val(globalConf.weatherStation);
    
    $("#watering_time_spinner").timespinner();
    $("#watering_time_spinner").timespinner('value', globalConf.runTime1);

    $('#email_settings_table_select').click(function(event) {
	updateEmailSettingsTable();
	showMenu("email_settings_table");
    });

    $('#display_settings_table_select').click(function(event) {
	updateDisplaySettingsTable();
	showMenu("display_settings_table");
    });
}

///////////////////////// Email settings table //////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     updateEmailSettingsTable
 *
 * @brief  Populate updated values into email settings table
 */
/*-------------------------------------------------------------------------------------------------------------*/

function updateEmailSettingsTable()
{
    $('#email_address_text').val(globalConf.email);
    $('#send_summary_text').html("Send summary: " + globalConf.sendSummary);

    initSecondLevelMenus();
}


///////////////////////// Display settings table ////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     updateDisplaySettingsTable
 *
 * @brief  Populate updated values into display settings table
 */
/*-------------------------------------------------------------------------------------------------------------*/

function updateDisplaySettingsTable()
{
    initSecondLevelMenus();
}

///////////////////////// Zone config table /////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     updateZoneConfigTable
 *
 * @brief  Generate the HTML for the zone config table, using the selected zone
 */
/*-------------------------------------------------------------------------------------------------------------*/

function updateZoneConfigTable()
{
    var z = selectedZone;

    $("#zone_config_name").html(zoneConf[z].name);
    $("#zone_config_valve_num").html('Valve &nbsp ' + zoneConf[z].valveNum);
    $("#zone_config_table").css('display', 'inline-block');
    $("#wetness_value").html(zoneConf[z].wetnessPct + '%');

    updatePlantTypesTable();
    updateEnvironmentTable();

    $('#plant_table_select').click(function(event) {
	showMenu("plants_table");
    });

    $('#environment_table_select').click(function(event) {
	showMenu("environment_table");
    });
}

///////////////////////// Environmant table /////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     updateEnvironmentTable
 *
 * @brief  Update the menu for the environment table
 */
/*-------------------------------------------------------------------------------------------------------------*/


function updateEnvironmentTable()
{
    var wetnessPct   = parseInt(zoneConf[selectedZone].environment.wetness, 10);
    var plantedIn    = (zoneConf[selectedZone].environment.inPots == '1') ? 'pots' : 'the ground';
    var receivesRain = (zoneConf[selectedZone].environment.getRain == '1') ? 'Receives rain' : 'Covered from rain';

    $("#wetness_value1").html(dryVal(wetnessPct));
    $("#wetness_value2").html(wetVal(wetnessPct));

    $("#exposure_select").html($("#exposure_select").attr('data-preText') + zoneConf[selectedZone].environment.light);
    $("#planted_in_select").html($("#planted_in_select").attr('data-preText') + plantedIn);
    $("#soil_type_select").html($("#soil_type_select").attr('data-preText') + zoneConf[selectedZone].environment.soil);
    $("#receives_rain_select").html(receivesRain);

    $("#wetness_slider_div").slider({
	min:-100,
	max: 100,
	step: 10,
	value: wetnessPct,
	slide: function( event, ui ) {
	    var chVal = parseInt(ui.value,10);
	    $("#wetness_value1").html(dryVal(chVal));
	    $("#wetness_value2").html(wetVal(chVal));
	    mustSave();
	}
    });

    initSecondLevelMenus();
}

function wetVal(_pct)
{
    return (_pct > 0) ? ('+' + _pct + '%') : '';
}

function dryVal(_pct)
{
    return (_pct < 0) ? (_pct + '%') : '';
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////// Table generation functions ////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     showMenu
 *
 * @brief  Given a menu id, hide all the other menus and show this menu. Handle highlighting. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function showMenu(_id)
{
    displayedMenu = _id;

    if ($('#'+_id).hasClass('left-table'))
    {
	// we are asked to display a left menu, so 
	// we must clear and unselect all left and right tables.
	$('.menu-table').css('display', 'none');
	$('#'+_id).css('display', 'inline-block');
	
	$('.left-menu-submenu').removeClass('selected');
	$('.second-level-menu-item').removeClass('selected');
	$('.third-level-menu-item').css('display', 'none');
	$('#cancel_button').css('display', 'inline-block');
	$('#save_button').css('display', 'inline-block');
    }
    else
    {
	// highlight the selected item in left menu
	$('.left-menu-submenu').removeClass('selected');
	$('#'+_id+'_select').addClass('selected');
	
	// show the menu
	$(".menu-table").filter(".right-table").css('display', 'none');
	$('#'+_id).css('display', 'inline-block');
    }
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     initSecondLevelMenus
 *
 * @brief  Setup click functions for the second level display menus (which cause children to be displayed) 
 *	   and third level, which will populate the parent with the selected value. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function initSecondLevelMenus()
{
    $('.second-level-menu-item').each( function() {

	$(this).click(function(event) {
	    $('.third-level-menu-item').css('display', 'none');
	    var id = $(this).attr('id');
	    $('[data-childof="'+ id +'"]').css('display', 'inline-block');
	});
    });

    $('.third-level-menu-item').click(function(event) {
	$('.third-level-menu-item').css('display', 'none');
	var parent = $('#'+$(this).attr('data-childof'));
	parent.html(parent.attr('data-preText')+ ' ' +$(this).attr('value'));
	parent.val($(this).attr('value'));
    });
}


/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     selectOption
 *
 * @brief  Make the given option selected. Pass in the element ID and selected value text.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function selectOption(_select_id, _option_val)
{
    $("select#"+ _select_id +" option").filter(function() {
	    return $(this).text() == _option_val; 
    }).attr('selected', 'selected');
}
             
