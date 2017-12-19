/******************************************************************************
 * 
 *                           SCHEDULE TABLE 
 * 
 ******************************************************************************/

/*----------------------------------------------------------------------------*/
/**
 * @fn displayScheduleTable
 * @brief Display the schedule table.
 */
/*----------------------------------------------------------------------------*/

function displayScheduleTable() {
  showLayer("schedule");
  today = new Date();
  var d = new Date();

  var tableHTML = '';
  var dayStr;
  var i;
  numDays = DEFAULT_HISTORY_DAYS;

  // ---- Column group ----

  tableHTML += '<table id="schedule_table" > \r\n';
  tableHTML += '	<colgroup> \r\n';
  tableHTML += '	  <col style="width: 200px"/> \r\n';

  for (i = 0; i < numDays; i++) {
    tableHTML += '	  <col style="width: 40px"/> \r\n';
  }
  tableHTML += '	</colgroup> \r\n';

  // ---- Day ----

  tableHTML += '	  <thead> \r\n';
  tableHTML += '	    <tr data-table-row="day" class="day-row"> \r\n';
  tableHTML += '	      <td></td> \r\n';

  for (i = 0; i < numDays; i++) {
    d.setTime(g.toDate.getTime());
    d.setDate(g.toDate.getDate() - (numDays - 1) + i);

    dayStr = dayNameStr[d.getDay()];

    if (datesAreEqual(d, today)) {
      tableHTML += '	      <td data-table-col="' + i + '" class="day-label" style="background:#' + BG_COLOR_STR + ';">Today</td> \r\n';
    } else {
      tableHTML += '	      <td data-table-col="' + i + '" class="day-label">' + dayStr + '</td> \r\n';
    }
  }

  tableHTML += '	    </tr> \r\n';

  // ---- Weather ----

  tableHTML += ' 	   <tr data-table-row="weather" class="weather-row" height="50px"> \r\n';
  tableHTML += '	      <td></td> \r\n';

  for (i = 0; i < numDays; i++) {
    d.setTime(g.toDate.getTime());
    d.setDate(g.toDate.getDate() - (numDays - 1) + i);
    var dstr = DateString(d);
    var temp = Math.round(g.tempHistory[dstr]);

    tableHTML += ' <td background="img/weather/' + g.iconHistory[dstr] + '.png"' + 'width="60px"><div data-table-col="' + i + '" class="weather-icon" align="right"><b>' + temp + '</b></td> \r\n';
  }

  tableHTML += '	    </tr> \r\n';
  tableHTML += '	  </thead> \r\n';

  tableHTML += '	  <tbody> \r\n';

  // ---- Schedule ----

  for (z = 0; z < g.numZones; z++) {
    var oddStr = '';
    if (z % 2) {
      oddStr = 'class="odd"';
    }
    tableHTML += '	    <tr ' + oddStr + '> \r\n';
    tableHTML += '	      <td><div class="zone-name selectable" value="' + z.toString() + '">' + g.zoneConf[z].Name + '</div></td> \r\n';

    for (i = 0; i < numDays; i++) {
      d.setTime(g.toDate.getTime());
      d.setDate(g.toDate.getDate() - (numDays - 1) + i);
      var dstr = DateString(d);

      var runTime = Math.round(g.runtimeHistory[dstr][z]);

      tableHTML += '	      <td data-table-col="' + i + '" class="schedule-entry">' + runTime + '</td> \r\n';
    }

    tableHTML += '	    </tr> \r\n';
  }

  tableHTML += '	  </tbody> \r\n';
  tableHTML += '    </table> \r\n';

  // writeStatus('<xmp>'+tableHTML+'</xmp>');

  $("#schedule_table").remove();
  $("#schedule_table_div").append(tableHTML);

  $('.zone-name').click(function(event) {
    $('.zone-name').parent().removeClass("selected");
    var target = $(this);
    target.parent().addClass('selected');
    g.selectedZone = $(this).attr('value');
  });
}

/******************************************************************************
 * 
 *                              RUN TABLE 
 * 
 ******************************************************************************/

/*----------------------------------------------------------------------------*/
/**
 * @fn displayRunTable
 * @brief Generate the HTML for the run table.
 */
/*----------------------------------------------------------------------------*/
function displayRunTable() {
  $('#run_table_div').css('display', 'inline-block');
  $('#run_table_buttons_div').css('display', 'inline-block');

  var tableHTML = '';
  for (i = 0; i < g.scheduledRuntimeSlots; i++) {
    tableHTML += '      <tr> \r\n';
    tableHTML += '        <td>' + g.runTable[i].ZoneName + ' </td> \r\n';
    tableHTML += '        <td>' + g.runTable[i].RunMins + ' </td> \r\n';
    tableHTML += '        <td><button value="' + i.toString() + '" class="run-cancel-button text-button" style="width: 80px;">Cancel</button></td> \r\n';
    tableHTML += '      </tr> \r\n';
  }

  $("#run_table > tbody").html(tableHTML);

  $('.run-cancel-button').button();
  $('.run-cancel-button').click(onRunCancelButtonClick);
}

// Append zone with given runtime to the run table.
function appendRunTableEntry(zoneNumber, zoneName, runMins) {
  if (g.scheduledRuntimeSlots == MAX_RUNTIME_SLOTS) {
    alert("All run slots are full.");
    return;
  }
  ns = g.scheduledRuntimeSlots;

  g.runTable[ns] = {};
  g.runTable[ns].ZoneNumber = zoneNumber;
  g.runTable[ns].ZoneName = zoneName;
  g.runTable[ns].RunMins = runMins;

  g.scheduledRuntimeSlots++;

  displayRunTable();
}

// Remove zone with the given slotNum from run table.
function removeRunTableEntry(slotNum) {
  if (slotNum >= g.scheduledRuntimeSlots) {
    alert("Removing non-existent entry.");
    return;
  }

  g.runTable[i] = {};
  for (i = slotNum; i < g.scheduledRuntimeSlots - 1; i++) {
    g.runTable[i] = g.runTable[i + 1];
  }

  g.scheduledRuntimeSlots--;
  g.runTable[g.scheduledRuntimeSlots] = {};

  displayRunTable();
}

// Start running the next zone if one is scheduled.
function startNextIfScheduled() {
  if (g.scheduledRuntimeSlots == 0) {
    return;
  }
  zoneName = g.runTable[0].ZoneName;
  runMins = g.runTable[0].RunMins;
  removeRunTableEntry(0);
  runZone(zoneName, runMins);
}

// Run the given zone name for given number of minutes.
function runZone(zoneName, runMins) {
  $('#run_table_div thead tr > td').css('background-color', '#0a9b3b');
  $('#run_table_div thead tr > td').css('color', '#fff');
  $('#running_zone_name').html(zoneName);
  $('#running_zone_countdown').countdown({
      until: runMins + "M",
      compact: true,
      format: 'MS',
      description: '',
      onExpiry: onRunCountdownComplete
  });
  $('#run_cancel_button_running').css('display', 'inline-block');
  g.running = true;

}

/************************ Event handlers **************************************/

function onRunCountdownComplete() {
  $('#running_zone_countdown').countdown('destroy');

  if (g.scheduledRuntimeSlots == 0) {
    $('#running_zone_name').html("");
    $('#run_table_div thead tr > td').css('background-color', '#fff');
    $('#run_cancel_button_running').css('display', 'none');
    g.running = false;
    return;
  }
  startNextIfScheduled();
}

function onRunButtonClick() {
  if (g.selectedZone == -1) {
    alert("No zone selected.");
    return;
  }
  zoneName = g.zoneConf[g.selectedZone].Name;
  runMins = $('#runtime_mins_input').val();
  rm = parseInt(runMins);
  if (rm == 0 || isNaN(rm)) {
    alert("Enter number of minutes to run.");
    return;
  }
  if (!g.running) {
    runZone(zoneName, runMins);
    return;
  }

  appendRunTableEntry(g.selectedZone, zoneName, runMins);
}

function onRunCancelButtonRunningClick() {
  onRunCountdownComplete();
}

function onRunCancelButtonClick() {
  var target = $(this);
  slotNum = $(this).attr('value');
  removeRunTableEntry(parseInt(slotNum));
  displayRunTable();
}

/******************************************************************************
 * 
 *                           CONFIG TABLE 
 * 
 ******************************************************************************/

/*----------------------------------------------------------------------------*/
/**
 * @fn displayZoneConfigTable
 * @brief Generate the HTML for the zone config table and display it.
 */
/*----------------------------------------------------------------------------*/
function displayZoneConfigTable() {
  showLayer("config");
  $('#save_button').button("option", "disabled", true);

  var tableHTML = '';

  for (z = 0; z < g.numZones; z++) {
    var oddStr = '';
    if (z % 2) {
      oddStr = 'class="odd"';
    }
    tableHTML += '      <tr ' + oddStr + '> \r\n';
    tableHTML += '        <td>' + g.zoneConf[z].Name + '</td> \r\n';
    tableHTML += '        <td><input type="checkbox" class="run-checkbox"' + boolToChecked(g.zoneConf[z].Enabled) + '></td> \r\n';
    tableHTML += '        <td><input type="checkbox" class="rain-checkbox" ' + boolToChecked(g.zoneConf[z].GetsRain) + '></td> \r\n';
    tableHTML += '        <td><input type="text" class="etrate-input" value="' + g.zoneConf[z].ZoneETRate + '"></td> \r\n';
    tableHTML += '        <td><input type="text" class="runmult-input" value="' + g.zoneConf[z].RunTimeMultiplier + '"></td> \r\n';
    tableHTML += '        <td><input type="text" class="depthin-input" value="' + g.zoneConf[z].DepthIn + '"></td> \r\n';
    tableHTML += '        <td><input type="text" class="minvwc-input" value="' + g.zoneConf[z].MinVWC + '"></td> \r\n';
    tableHTML += '        <td><input type="text" class="maxvwc-input" value="' + g.zoneConf[z].MaxVWC + '"></td> \r\n';
    tableHTML += '      </tr> \r\n';
  }

  // Global settings.
  tableHTML += '      <tr class = "global-config-row" style="height: 40px; font-size: 1.2em;"> \r\n';
  tableHTML += '      <td></td> \r\n';
  tableHTML += '      <td colspan="4">Airport code<input type="text" id="airport_code" style="width: 80px;" value="' + g.airportCode + '"></td> \r\n';
  tableHTML += '      <td colspan="3">Run time<input type="text" id="runtime_input" style="width: 80px;" value="' + g.runTime + '"></td> \r\n';
  tableHTML += '      </tr> \r\n';

  // Algorithm.
  tableHTML += '      <tr class = "global-config-row" > \r\n';
  tableHTML += '      <td style="text-align: right">Algorithm</td> \r\n';
  tableHTML += makeAlgorithmTd(4, 0, g.algorithm[0]);
  tableHTML += makeAlgorithmTd(3, 1, g.algorithm[1]);
  tableHTML += '      </tr> \r\n';

  tableHTML += '      <tr class = "global-config-row" > \r\n';
  tableHTML += '      <td></td> \r\n';
  tableHTML += makeAlgorithmTd(4, 2, g.algorithm[2]);
  tableHTML += makeAlgorithmTd(3, 3, g.algorithm[3]);
  tableHTML += '      </tr> \r\n';

  $("#zone_config_table tbody").html(tableHTML);
  $('#zone_config_table tbody > tr > td > input').change(onValueChange);
  $('#zone_config_table tbody > tr > td > div > input').change(onValueChange);

  $('#runtime_input').timepicker({
      showPeriod: true,
      showLeadingZero: false
  });

}

// Create a table cell for algorithm range with the given colspan, algorithm
// slot number and algorithm array object.
function makeAlgorithmTd(colspan, num, alg) {
  if (alg == undefined) {
    return '<td></td> \r\n';
  }
  var fromVal = alg.from;
  var toVal = alg.to;
  var pctVal = alg.pct;
  var ns = num.toString();
  var outHtml = '';
  outHtml += '<td colspan=' + colspan.toString() + '> \r\n';
  outHtml += '<div> \r\n';
  outHtml += '  <input type="text" class="alg-from-value" data-rangenum="' + ns + '" style="width: 30px;" value="' + fromVal + '"/> to \r\n';
  outHtml += '  <input type="text" class="alg-to-value" data-rangenum="' + ns + '" style="width: 30px;" value="' + toVal + '"/> : \r\n';
  outHtml += '  <input type="text" class="alg-pct-value" data-rangenum="' + ns + '" style="width: 30px;" value="' + pctVal + '"/>% \r\n';
  outHtml += '</div> \r\n';
  outHtml += '</td> \r\n';

  return outHtml;
}

// Convert a bool value to "checked" or "".
function boolToChecked(boolVal) {
  return boolVal ? "checked" : "";
}

// Copy values from UI to globalConf.
function copyUIToConfig() {
  for (z = 0; z < g.numZones; z++) {
    zn = (z + 1).toString()
    g.zoneConf[z].Enabled = $('#zone_config_table tr:eq(' + zn + ') td input.run-checkbox').is(':checked');
    g.zoneConf[z].GetsRain = $('#zone_config_table tr:eq(' + zn + ') td input.rain-checkbox').is(':checked');
    g.zoneConf[z].ZoneETRate = parseFloat($('#zone_config_table tr:eq(' + zn + ') td input.etrate-input').val());
    g.zoneConf[z].RunTimeMultiplier = parseFloat($('#zone_config_table tr:eq(' + zn + ') td input.runmult-input').val());
    g.zoneConf[z].DepthIn = parseFloat($('#zone_config_table tr:eq(' + zn + ') td input.depthin-input').val());
    g.zoneConf[z].MinVWC = parseFloat($('#zone_config_table tr:eq(' + zn + ') td input.minvwc-input').val());
    g.zoneConf[z].MaxVWC = parseFloat($('#zone_config_table tr:eq(' + zn + ') td input.maxvwc-input').val());
  }

  g.globalConf.GlobalConfig.AirportCode = $('#airport_code').val();
  g.globalConf.GlobalConfig.RunTimeAM = "0000-01-01T" + $('#runtime_input').val() + "Z";
  g.globalConf.ZoneConfigs = g.zoneConf;

  populateAlgorithmValues();

  console.log(JSON.stringify(g.globalConf, null, 2));
}

// Copy UI values to g.algorithm to g.globalConf.
function populateAlgorithmValues() {
  for (i = 0; i < MAX_ALGORITHM_SLOTS; i++) {
    var ns = i.toString();
    g.algorithm[i].from = parseInt($('.alg-from-value[data-rangenum="' + ns + '"]').val());
    g.algorithm[i].to = parseInt($('.alg-to-value[data-rangenum="' + ns + '"]').val());
    g.algorithm[i].pct = parseInt($('.alg-pct-value[data-rangenum="' + ns + '"]').val());

    // "ETAlgorithmSimpleConfig":{"EtPctMap":{
    // "R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},

    rptr = g.globalConf.ETAlgorithmSimpleConfig.EtPctMap.R[i];
    rptr.X1 = g.algorithm[i].from;
    rptr.X2 = g.algorithm[i].to;
    rptr.Y = g.algorithm[i].pct;
  }
}

/************************ Event handlers **************************************/

function onDoneButtonClick() {
  displayScheduleTable();
}

function onSaveButtonClick() {
  copyUIToConfig();
  $('#save_button').button("option", "disabled", true);
}

function onValueChange() {
  $('#save_button').button("option", "disabled", false);
}

/******************************************************************************
 * 
 *                              UTILITY 
 * 
 ******************************************************************************/

function showLayer(layerName) {
  cl = $("[data-layer='" + g.currentLayer + "']");
  cl.css('display', 'none');
  nl = $("[data-layer='" + layerName + "']");
  nl.css('display', 'inline-block');
  g.currentLayer = layerName;
}