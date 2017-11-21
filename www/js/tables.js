var runTable = [
    {'running':0,'scheduledMins':0}, 
    {'running':0,'scheduledMins':0}, 
    {'running':0,'scheduledMins':0}, 
    {'running':0,'scheduledMins':0}, 
    {'running':0,'scheduledMins':0}, 
    {'running':0,'scheduledMins':0}, 
    {'running':0,'scheduledMins':0}, 
    {'running':0,'scheduledMins':0}, 
];

var runningZone = -1;
var runTimeLeftSeconds = 120;
var runTimer;

///////////////////////// Member functions //////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     ...ScheduleTable
 *
 * @brief  Display the schedule table. This table is dynamically generated, so there's no update function.
 *         It must be rebuilt every time.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displayScheduleTable()
{
    buildScheduleTable();
}


function closeScheduleTable()
{
    $('#schedule_table_div').css('display','none');
    $("#left_arrow_button").css('display','none');
    $("#right_arrow_button").css('display','none');
}

function buildScheduleTable()
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

    for (i=0; i<historyDays; i++)
    {
	tableHTML += '	  <col style="width: 40px"/> \r\n';
    }
    tableHTML += '	</colgroup> \r\n';

    // ---- Day ----

    tableHTML += '	  <thead> \r\n';
    tableHTML += '	    <tr data-table-row="day" class="day-row"> \r\n';
    tableHTML += '	      <td></td> \r\n';

    for (i=0; i<historyDays; i++)
    {
	d.setTime(toDate.getTime());
	d.setDate(toDate.getDate() - (historyDays-1) + i);

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

    for (i=0; i<historyDays; i++)
    {
	d.setTime(toDate.getTime());
	d.setDate(toDate.getDate() - (historyDays-1) + i);
	var hashDate = dateHashStr(d);

	var weatherIcon = iconHistory[hashDate]
	var tempFull  = tempHistory[dateHashStr(d)];
	var temp      = (tempFull==null) ? '' :  Math.round(parseFloat(tempFull));

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
	tableHTML += '	      <td class="zone-name selectable" value="'+ z.toString() +'">'+ g_conf.zones[z].name +'</div></td> \r\n';

	for (i=0; i<historyDays; i++)
	{
	    d.setTime(toDate.getTime());

	    d.setDate(toDate.getDate() - (historyDays-1) + i);
  
	    var hashDate = numDateHashStr(z, d);
	    var runTime  = parseInt(zoneRuntimeHistory[hashDate]);

	    var imageSrcStr = '<img src="images/drops/'+ getAmountImgStr(runTime) +'.png">';
	    
	    var bgStyleStr = dateIsAfter(d, today) ? 'style="opacity: 0.5"' : '';
	    
	    tableHTML += '	      <td data-table-col="'+ i +'" class="schedule-entry" '+ bgStyleStr +'>'+ imageSrcStr +' </td> \r\n';
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
	displayZoneConfigTable();
    });


}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     ...ZoneConfigTable
 *
 * @brief  This table is dynamically generated, so there's no update function.
 *         It must be rebuilt every time. Note that we keep the schedule table open underneath.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displayZoneConfigTable()
{
    // This table overlays the schedule table, so don't destroy that one, just 
    // hide parts of it.

    showDateScrollArrows(false);
    buildZoneConfigTable();
    slideShow('zone_config_table_div');
}

function buildZoneConfigTable()
{
    $('#zone_config_table_zone_name').html(g_conf.zones[selectedZone].name);
    $('#zone_config_table_soil_type').val(g_conf.zones[selectedZone].sprinklers[0].container.soilTypeName);

    $("#plant_properties_qty_spinner").spinner();
    $("#plant_properties_gal_spinner").spinner();
    $("#plant_properties_height_spinner").spinner();
    $("#plant_properties_width_spinner").spinner();

    $("#add_plant_button").button().click(function( event ) {
	displayPlantSearchTable();
    });

    $(".plant-table-button").button();
    $("#close_plant_list_button").button({
	icons: {
	    primary: "ui-icon-closethick"
	} 
    }).click(function( event ) {
	closeZoneConfigTable();
    });

    var lightNum = g_conf.zones[selectedZone].sprinklers[0].container.plants[0].monthlySun[0];
    $('.light_amount').slider({
	min: 0,
	max: 4,
	step: 1,
	value: lightNum,
	slide: function(event, ui) {
	    
	    var i = $('.light_amount > .ui-slider-handle').css('background-image', 'url("../images/'+lightAmountImage[ui.value]+'")');
	}
    });

    $('.light_amount > .ui-slider-handle').css('background-image', 'url("../images/'+lightAmountImage[lightNum]+'")');
    
    /* $('.water_less_more').slider({
	min:-100,
	max: 100,
	step: 10,
	value: 0, //zoneConf[0].waterAdjust,
	slide: function(event, ui) {
	    ui.handle.innerHTML = ui.value;
	}
    });
    
    $('.water_less_more > .ui-slider-handle').html(zoneConf[0].waterAdjust);
    */


    var html='';

    var plants = g_conf.zones[selectedZone].sprinklers[0].container.plants;

    for (var i=0; i<plants.length; i++)
    {
	var plantNumStr = isUndefined(plants[i].number) ? '' : plants[i].number;

	html += '	    <tr>';
	html += '	      <td><input type="checkbox"></td><td class="plant-list-row" data-index="'+ i +'">'+ plants[i].name +'</td><td>'+ plantNumStr +'</td><td>Perfect</td>';
	html += '	    </tr>';
    }

    $('#plant_list_body').html(html);
    $('.plant-list-row').click(function(event) {
	var index = parseInt($(this).attr('data-index'),10);

	g_zoneListSelectedPlantIndex = index;

	slideShow('plant_property_table_div');
	$('#plant_property_table_name_input').val(g_conf.zones[selectedZone].sprinklers[0].container.plants[index].name);
	setPlantPropertyValues(index);
    });

    $("#plant_info_button").button().click(function( event ) {

	var searchTemplate = { 
	    plantLabel : g_conf.zones[selectedZone].sprinklers[0].container.plants[g_zoneListSelectedPlantIndex].databaseTag
	};

	searchPlantType(searchTemplate, searchPlantTypeCompleteShowDetailProperties);
    });

    $('#move_to_zone_select_div').html(getZoneSelectHtml('move_to_zone_select'));
    var i=0;
}

function closeZoneConfigTable()
{
    $('#close_zone_config_button').remove();
    $('.edit_plant_list').remove();
    $('.light_amount').remove();
    $('.water_less_more').remove();
    $('#zone_config_table_div').css('display', 'none');
    $('#plant_property_table_div').css('display', 'none');
    $('#plant_table_property_div').css('display', 'none');
    showDateScrollArrows(true);
}


function searchPlantTypeCompleteShowDetailProperties(data)
{
    plantSearchArr = JSON.parse(data.responseText);

    if (plantSearchArr.length != 1)
    {
	alert("Expected one result, got " + plantSearchArr.length);
	return;
    }

    g_plantSearchArrSelectedIndex = 0;
    showPlantDetailPropertyTable();
}

var g_zoneListSelectedPlantIndex = 0;

function setPlantPropertyValues(_plantIndex)
{
    var plantObj = g_conf.zones[selectedZone].sprinklers[0].container.plants[_plantIndex];
    $('#zone_plant_list_property_name').html(plantObj.databaseTag);
    $('#plant_properties_height_spinner').spinner('value', plantObj.height);
    $('#plant_properties_width_spinner').spinner('value', plantObj.width);

    $('#plant_properties_qty_spinner').spinner('value', plantObj.qty);

    $('#plant_properties_covered_checkbox').prop('checked', !plantObj.getsRain);
    $('#plant_properties_in_pots_checkbox').prop('checked', plantObj.inPots);
    if (plantObj.inPots)
    {
	$('#plant_properties_gal_spinner').spinner('value', plantObj.potSize);
    }
}

function getZoneSelectHtml(_divId)
{
    var html='';
    html +='	<div class="styled-select" style="width: 200px"> \r\n';
    html +='	    <select id="'+ _divId +'" style="width: 222px"> \r\n';
    
    for (z=0; z<numZones; z++)
    {
	html +='	      <option value="'+g_conf.zones[z].name+'">'+g_conf.zones[z].name+'</option> \r\n';
    }

    html +='	    </select> \r\n';
    html +='	</div> \r\n';
    
    return html;
}


/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     ...RunNowTable
 *
 * @brief  This table is dynamically generated, so there's no update function.
 *         It must be rebuilt every time.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displayRunNowTable()
{
    // This table overlays the schedule table, so don't destroy that one, just 
    // hide parts of it.

    showDateScrollArrows(false);
    buildRunNowTable();
    slideShow('run_now_table_div');

}

function closeRunNowTable()
{
    $('#run_now_table_div').hide("slide", { direction : "up" }, 300, null );
    cleanupRunNowTable();
    showDateScrollArrows(true);
}

function cleanupRunNowTable()
{
    $("#run_now_table").remove();
    $('#close_run_now_button').remove();
    $('#run_now_stop_button').remove();
    $('.run-now-cancel-schedule-button').remove();
    $('.run-now-schedule-button').remove();
    $(".run-now-spinner").remove();
}

function buildRunNowTable()
{
    var tableHTML ='';
    var i;

    cleanupRunNowTable();

    // ---- Column group ----

    tableHTML += '<button class="large-del-button" id="close_run_now_button" style="margin-left: 395px; top: 53px; width: 25px; height:25px"/> \r\n'; 
    tableHTML += '<table id="run_now_table" style="margin-top: 55px"> \r\n';
	
    tableHTML += '	<colgroup>  \r\n';
    tableHTML += '	  <col style="width: 120px"/>  \r\n';
    tableHTML += '	  <col style="width: 30px"/>  \r\n';
    tableHTML += '	  <col style="width: 70px"/>  \r\n';
    tableHTML += '	  <col style="width: 200px"/>  \r\n';
    tableHTML += '	</colgroup>  \r\n';
	  
    tableHTML += '	<tbody id="run_now_body"> \r\n';
	    
    for (z=0; z<numZones; z++)
    {
	var oddStr='';
	if (z%2)
	{
	    oddStr='class="odd"';
	}

	tableHTML += '	    <tr '+ oddStr +'> \r\n';

	if (runTable[z].running)
	{
	    tableHTML += '	    <td colspan="3"><div style="display: inline-block"> \r\n'; 
	    tableHTML += '	       <div class="run-now-table-col2" style="margin-left:5px; display: inline-block; color: green; text-decoration: blink"> \r\n'; 
	    tableHTML += '	       <b>Running</b> </div> <div style="display: inline-block">for another</div>\r\n'; 
	    tableHTML += '	       <div id="run_now_time_left" style="display: inline-block"></div></div></td> \r\n';    
	    tableHTML += '	    <td><button id="run_now_stop_button" class="run-now-button" style="width: 70px">Stop</button></td> \r\n'; 
	}
	else if (runTable[z].scheduledMins > 0)
	{
	    tableHTML += '	    <td colspan="3"><div class="run-now-table-col2" style="margin-left:5px">Scheduled to run for '+  runTable[z].scheduledMins +
					' mins.</div></td> \r\n';    
	    tableHTML += '	    <td><button class="run-now-button run-now-cancel-schedule-button" value="'+ z +'" style="width: 70px">Cancel</button></td> \r\n';    
	}
	else
	{
	    tableHTML += '	    <td><button class="run-now-button run-now-schedule-button" value="'+ z +'"">Water now</button></td> \r\n';
	    tableHTML += '	    <td style="margin-left: 10px">for</td> \r\n';
	    tableHTML += '	    <td><input class="run-now-spinner" data-zone-num="'+ z +'" value="10"></td> \r\n';
	    tableHTML += '	    <td>mins.</td> \r\n';
	}

	tableHTML += '	  </tr> \r\n';
    }

    tableHTML += '	</tbody> \r\n';
    tableHTML += '      </table> \r\n';
 
    $("#run_now_table_div").html(tableHTML);   

    $('#close_run_now_button').button({
	icons: {
	    primary: "ui-icon-closethick"
	} 
    }).click(function( event ) {
	closeRunNowTable();
    });

    $('#run_now_stop_button').button().click(function( event ) {
	runTable[runningZone].running = 0;
	runningZone = -1;
	clearInterval(runTimer);
	runNextScheduledZone();
	buildRunNowTable();
    });

    $('.run-now-cancel-schedule-button').button().click(function( event ) {
	var zone = event.target.value;
	runTable[zone].scheduledMins = 0;
	buildRunNowTable();
    });

    $('.run-now-schedule-button').button().click(function( event ) {
	var zone = event.target.value;
	var runMins = parseInt($('.run-now-spinner[data-zone-num="'+ zone +'"]').val(),10);

	if (runningZone == -1)
	{
	    // nothing running, start zone right away
	    runZoneNow(zone, runMins);
	    return;
	}

	runTable[zone].scheduledMins = runMins;
	buildRunNowTable();
    });

    $(".run-now-spinner").spinner();

    initHoverHelp();
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
    closeRunNowTable();
    closeZoneConfigTable();
}

function updateSystemSettingsTable()
{
    $('#config_tabs').tabs();
    $('#climate_zone_text').val(g_conf.climateZone);
    $('#weather_station_text').val(g_conf.weatherStation);
    
    $("#watering_time_spinner").timespinner();
    $("#watering_time_spinner").timespinner('value', g_conf.runTime1);

    $('.large-del-button2').button({
	icons: {
	    primary: "ui-icon-closethick"
	} 
    }).click(function( event ) {
	closeSystemSettingsTable();
    });

}

function closeSystemSettingsTable()
{
    $('#system_settings_table').hide("slide", { direction : "up" }, 300, null );
    cleanupSystemSettingsTable();
}

function cleanupSystemSettingsTable()
{
    $('#config_tabs').remove();
    $("#watering_time_spinner").remove();
    $("#watering_time_spinner").remove();
    $('.large-del-button2').remove();
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////// Timer functions ///////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function runNowTimer()
{
    runTimeLeftSeconds--;

    if (runTimeLeftSeconds == 0)
    {
	runTable[runningZone].running = 0;
	runningZone = -1;
	clearInterval(runTimer);
	runNextScheduledZone();
	buildRunNowTable();
	return;
    }

    $('#run_now_time_left').html(Math.floor(runTimeLeftSeconds/60) + ":" + runTimeLeftSeconds%60);
}

function runNextScheduledZone()
{
    for (z=0; z<numZones; z++)
    {
	if (runTable[z].scheduledMins != 0)
	{
	    runZoneNow(z, runTable[z].scheduledMins);
	    return;
	}
    }
}

function runZoneNow (zone, runMins)
{
    runningZone = zone;
    runTable[zone].running = 1;
    runTable[z].scheduledMins = 0;
    runTimeLeftSeconds = runMins * 60;
    runTimer = setInterval(function(){runNowTimer()},1000);
    buildRunNowTable();
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////// Table generation functions ////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     showDateScrollArrows
 *
 * @brief  Show or hide date scroll arrows
 */
/*-------------------------------------------------------------------------------------------------------------*/

function showDateScrollArrows(_show)
{
    $("#left_arrow_button").css('display', _show ? 'inline-block' : 'none');
    $("#right_arrow_button").css('display', _show ? 'inline-block' : 'none');
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     slideShow
 *
 * @brief  slide down the given div
 */
/*-------------------------------------------------------------------------------------------------------------*/

function slideShow(_div)
{
    $('#' + _div).hide("slide", { direction : "up" }, 10 );
    $('#' + _div).show("slide", { direction : "up" }, 300, null );
}

function slideShowRight(_div)
{
    $('#' + _div).hide("slide", { direction : "left" }, 10 );
    $('#' + _div).show("slide", { direction : "left" }, 300, null );
}

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
	$('#'+_id).show("slide", { direction : "up" }, 300, null );
	$('#'+_id).css('display', 'inline-block');

	
	$('.left-menu-submenu').removeClass('selected');
	$('.second-level-menu-item').removeClass('selected');
	$('.third-level-menu-item').css('display', 'none');
    }
    else
    {
	// highlight the selected item in left menu
	$('.left-menu-submenu').removeClass('selected');
	$('#'+_id+'_select').addClass('selected');
	
	// show the menu
	$(".menu-table").filter(".right-table").css('display', 'none');
	$('#'+_id).show("slide", { direction : "left" }, 300, null );
	$('#'+_id).css('display', 'inline-block');
	$('#cancel_button').css('display', 'inline-block');
	$('#save_button').css('display', 'inline-block');
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

/* 
function buildZoneConfigTable()
{
    var tableHTML ='';
    var i;

    // ---- Column group ----

    tableHTML += '<button class="large-del-button" id="close_zone_config_button" style="margin-left: 525px; top: 5px; width: 25px; height:25px"/> \r\n'; 
    tableHTML += '<table id="zone_config_table" style="margin-top: -25px"> \r\n';
	
    tableHTML += '	<colgroup>  \r\n';
    tableHTML += '	  <col style="width: 70px"/>  \r\n';
    tableHTML += '	  <col style="width: 95px"/>  \r\n';
    tableHTML += '	  <col style="width: 150px"/>  \r\n';
    tableHTML += '	  <col style="width: 70px"/>  \r\n';
    tableHTML += '	  <col style="width: 30px"/>  \r\n';
    tableHTML += '	  <col style="width: 100px"/>  \r\n';
    tableHTML += '	</colgroup>  \r\n';
    tableHTML += '	<thead> \r\n';
    tableHTML += '	  <tr style="border-right: 1px solid white !important; height:40px; background-color: white"><td style="background-color: white" colspan="6"></td></tr> \r\n';
    tableHTML += '	  <tr> \r\n';
    tableHTML += '	    <td>Plants</td><td>Light</td><td>Water +/- %</td><td>Planted</td><td>Rain?</td><td>Soil type</td> \r\n';
    tableHTML += '	  </tr> \r\n';
    tableHTML += '	</thead> \r\n';
	  
    tableHTML += '	<tbody id="plant_list_body"> \r\n';
	    
    for (z=0; z<numZones; z++)
    {
	var oddStr='';
	if (z%2)
	{
	    oddStr='class="odd"';
	}

	tableHTML += '	    <tr '+ oddStr +'> \r\n';
	tableHTML += '	    <td><button class="edit-plant-list" style="margin-left:5px" data-zone-num="'+z+'">List</button></td> \r\n';

	tableHTML += '	    <td id="light_amount_div" class="has-help"><div class="light_amount" data-zone-num="'+z+'" style="margin-top:-15px;"></div></td> \r\n';

	tableHTML += '	    <td id="water_less_more_div" class="has-help"><div class="water_less_more" data-zone-num="'+z+'" style="margin-top:-15px;"></div></td> \r\n';

	tableHTML += '	    <td id="planted_in_div" class="has-help"> \r\n';
	tableHTML += '              <ul class="nav" role="navigation" style="height: 0px" > \r\n';
	tableHTML += '                <li class="dropdown"> \r\n';
	tableHTML += '                  <a id="drop1" href="#" role="button" class="dropdown-toggle"  data-zone-num="'+z
	    +'"data-toggle="dropdown" style="font-size:1.2em; margin-top:5px; margin-left:5px"> \r\n';
	tableHTML += '		    '+ demoZoneConf[z].plantedIn +'<b class="caret"></b></a> \r\n';
	tableHTML += '                  <ul class="dropdown-menu" role="menu" aria-labelledby="drop1"> \r\n';
	tableHTML += '                    <li role="presentation"><a role="menuitem" tabindex="-1" href="#">Pots</a></li> \r\n';
	tableHTML += '                    <li role="presentation"><a role="menuitem" tabindex="-1" href="#">Ground</a></li> \r\n';
	tableHTML += '                  </ul> \r\n';
	tableHTML += '                </li> \r\n';
	tableHTML += '              </ul> \r\n';
	tableHTML += '	    </td> \r\n';

	tableHTML += '	    <td id="gets_rain_div" class="has-help"> \r\n';
	tableHTML += '              <ul class="nav" role="navigation" style="height: 0px" > \r\n';
	tableHTML += '                <li class="dropdown"> \r\n';
	tableHTML += '                  <a id="drop1" href="#" role="button" class="dropdown-toggle"  data-zone-num="'+z
	    +'"data-toggle="dropdown" style="font-size:1.2em; margin-top:5px; margin-left:5px"> \r\n';
	tableHTML += '		    '+ demoZoneConf[z].getsRain +'<b class="caret"></b></a> \r\n';
	tableHTML += '                  <ul class="dropdown-menu" role="menu" aria-labelledby="drop1"> \r\n';
	tableHTML += '                    <li role="presentation"><a role="menuitem" tabindex="-1" href="#">Yes</a></li> \r\n';
	tableHTML += '                    <li role="presentation"><a role="menuitem" tabindex="-1" href="#">No</a></li> \r\n';
	tableHTML += '                  </ul> \r\n';
	tableHTML += '                </li> \r\n';
	tableHTML += '	      </ul> \r\n';
	tableHTML += '              <!--div class="btn-group"> \r\n';
	tableHTML += '                <button class="btn dropdown-toggle" data-toggle="dropdown" data-zone-num="'+z+'">Yes<span class="caret"></span></button> \r\n';
	tableHTML += '                <ul class="dropdown-menu" style="width: 30px"> \r\n';
	tableHTML += '                  <li><a href="#">Yes</a></li> \r\n';
	tableHTML += '                  <li><a href="#">No</a></li> \r\n';
	tableHTML += '                </ul> \r\n';
	tableHTML += '              </div--> \r\n';
	tableHTML += '	    </td> \r\n';

	tableHTML += '	    <td id="soil_type_div" class="has-help"> \r\n';
	tableHTML += '              <ul class="nav" role="navigation" style="height: 0px" > \r\n';
	tableHTML += '                <li class="dropdown"> \r\n';
	tableHTML += '                  <a id="drop1" href="#" role="button" class="dropdown-toggle" data-toggle="dropdown"  data-zone-num="'+z
	    +'"style="font-size:1.2em; margin-top:5px; margin-left:5px"> \r\n';
	tableHTML += '		    '+ demoZoneConf[z].soilType +'<b class="caret"></b></a> \r\n';
	tableHTML += '                  <ul class="dropdown-menu" role="menu" aria-labelledby="drop1"> \r\n';
	tableHTML += '                    <li role="presentation"><a role="menuitem" tabindex="-1" href="#">Clay</a></li> \r\n';
	tableHTML += '                    <li role="presentation"><a role="menuitem" tabindex="-1" href="#">Loam</a></li> \r\n';
	tableHTML += '                  </ul> \r\n';
	tableHTML += '                </li> \r\n';
	tableHTML += '	      </ul> \r\n';
	tableHTML += '	    </td> \r\n';
	tableHTML += '	  </tr> \r\n';
    }

    tableHTML += '	</tbody> \r\n';

    tableHTML += '      </table> \r\n';
 
    $("#zone_config_table").remove();
    $("#zone_config_table_div").html(tableHTML);   

    var availableTags = [];

    $('#close_zone_config_button').button({
	icons: {
	    primary: "ui-icon-closethick"
	} 
    }).click(function( event ) {
	$('#zone_config_table_div').hide("slide", { direction : "up" }, 300, null );
	$('#schedule_table_div').show("slide", { direction : "up" }, 300, null );
	$('#schedule_table_div').css('display', 'block');
    });

    $('.edit-plant-list').button().click(function( event ) {
	displayPlantListTable();
    });

    for (z=0; z<numZones; z++)
    {
	$('.light_amount[data-zone-num="'+z+'"]').slider({
	    min: 0,
	    max: 4,
	    step: 1,
	    value: demoZoneConf[z].lightAmount,
	    slide: function(event, ui) {
		
		var z = $(this).attr('data-zone-num');
		var i = $('.light_amount[data-zone-num="'+z+'"] > .ui-slider-handle').css('background-image', 'url("../images/'+lightAmountImage[ui.value]+'")');
		var v;
		// ui.handle.properties.style.background-image = '';
		needSave();
	    }
	});
	$('.light_amount[data-zone-num="'+z+'"] > .ui-slider-handle').css('background-image', 'url("../images/'+lightAmountImage[demoZoneConf[z].lightAmount]+'")');
	
	$('.water_less_more[data-zone-num="'+z+'"]').slider({
	    min:-100,
	    max: 100,
	    step: 10,
	    value: demoZoneConf[z].waterAdjust,
	    slide: function(event, ui) {
		
		ui.handle.innerHTML = ui.value;
		needSave();
	    }
	});
	$('.water_less_more[data-zone-num="'+z+'"] > .ui-slider-handle').html(demoZoneConf[z].waterAdjust);
    }
   
    initHoverHelp();
}
*/
