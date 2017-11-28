/*==================================== SERVER VARS, COMMANDS ==================================================*/

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn sendServerCmd
 * 
 * @brief Send a command to the server
 */
/*-------------------------------------------------------------------------------------------------------------*/

function sendServerCmd(cmdName)
{
	var postParams = { cmd_name: cmdName};
	var posturl = "http://"+server_ip+"/cgi-bin/send_cmd.cgi";
	var str;

	$.ajaxSetup({ 
		cache: false,
		timeout: 1000, 
	});

	str = jQuery.param(postParams);
	writeStatus("Posting to "+posturl+"?"+str);

	$.post(posturl, postParams, function(data){ serverCmdResponse(data);});
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn serverCmdResponse
 * 
 * @brief Handler for sendServerCmd completion
 */
/*-------------------------------------------------------------------------------------------------------------*/

function serverCmdResponse(data)
{
	if(data.match(/OK/))
	{
		writeStatus("Server cmd OK\n");
	}
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn getConfFile
 * 
 * @brief Get config file from server
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getConfFile()
{
	var url = "http://"+server_ip+"/"+confFilename;

	writeStatus("Sending request for " + url);

	$.ajaxSetup({ 
		cache: true,
		timeout: 1000, 
	});

	$.ajax({url: url,
		dataType: "text",
		success:  function(data){
			processConfFileResponse(data);
		}});
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn processConfFile
 * 
 * @brief Handler for getConfFile
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processConfFile(data) {

	confStr = data;
	conf = JSON.parse(confStr);

	ret = getPathValue(conf, "GlobalConfig.AirportCode")
	if (ret.err) {
		return ret.err
	}
	setDiv("airport_code", ret.val)

	runtimePath = "GlobalConfig.RunTimeAM"
		ret = getPathValue(conf, runtimePath)
		if (ret.err) {
			return ret.err
		}

	// expect format "0000-01-01T16:00:00Z"
	tv = ret.val.split(":")
	if (tv.length != 3) {
		return "bad time string for " + runtimePath + ":" + ret.val
	}
	hrv = tv[0].split("T")
	if (tv.length != 3) {
		return "bad time string for " + runtimePath + ":" + ret.val
	}

	setDiv("run_time_hr", hrv[1])
	setDiv("run_time_min", tv[1])

	err = parseZoneConfigs(conf)
	if (err) {
		return err
	}
	err = parseAlgorithm(conf)
	if (err) {
		return err
	}

}

function parseZoneConfigs(tree) {
	ret = getPathValue(tree, "ZoneConfigs")
	if (ret.err) {
		return ret.err
	}

	zconfs = ret.val

	for ( var num in zconfs) {
		ret = getPathValue(zconfs, num)
		zconf = ret.val
		
		// Set some defaults so that users of zone confs can use object attributes
		// without checking for null.
    SetDefaultIfMissing(zconf, "Name", "##MISSING##")
    SetDefaultIfMissing(zconf, "Number", parseInt(num))
    SetDefaultIfMissing(zconf, "Enabled", false)
    SetDefaultIfMissing(zconf, "GetsRain", false)
    SetDefaultIfMissing(zconf, "DepthIn", 0)
    SetDefaultIfMissing(zconf, "ZoneETRate", 10)
    SetDefaultIfMissing(zconf, "RunTimeMultiplier", 1)
    SetDefaultIfMissing(zconf, "SoilConfig.Name", "##MISSING##")
    SetDefaultIfMissing(zconf, "MinVWC", 0)
    SetDefaultIfMissing(zconf, "MaxVWC", 100)
	
		zoneConf[parseInt(num)] = zconf
	}
}

// "ETAlgorithmSimpleConfig":{"EtPctMap":{
// "R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},

function parseAlgorithm(tree) {
	ret = getPathValue(tree, "ETAlgorithmSimpleConfig.EtPctMap.R");
	if (ret.err) {
		return ret.err
	}

	rs = ret.val
	i = 0
	for (var r in rs) {
		x1r = getPathValue(rs[r], "X1")
		if (x1r.err) {
			return err
		}
		x2r = getPathValue(rs[r], "X2")
		if (x2r.err) {
			return err
		}
		yr = getPathValue(rs[r], "Y")
		if (yr.err) {
			return err
		}
		x1 = x1r.val
		x2 = x2r.val
		y = yr.val

		if (x1 <= -999) {
			x1 = -999
		}
		if (x2 >= 999) {
			x2 = 999
		}

		setDiv("temp_"+i+"_from", x1);
		setDiv("temp_"+i+"_to", x2);
		setDiv("temp_"+i+"_drying_pct", y);

		i++;
	}

}

function setDiv(name, val) {
	log("Setting " + name + ":" + val);
}

function setEnabled(name, on) {
// $(name).attr('checked', on ? "checked" : "");
  log("Setting enabled " + name + ":" + on);
}

function getPathOrLogErr(tree, path) {
	ret = getPathValue(tree, path);
	if (ret.err) {
		log(err)
		return ""
	}
	return ret.val
}

function SetDefaultIfMissing(zconf, path, defaultVal) {
  if (getPathOrLogErr(zconf, path) == "") {
    pv = path.split(".");
    cur = zconf
    for (i = 0; i < pv.length; i++) {
      cur = cur[pv[i]]
      if (!cur) {
        log("could not find path " + path + " in tree at element " + pv[i])
      }
    }
    cur = defaultVal
  }
}

function getPathValue(tree, path) {
	pv = path.split(".");
	cur = tree;
	for (i = 0; i < pv.length; i++) {
		cur = cur[pv[i]]
		if (!cur) {
			return {
				val: "",
				err: "could not find path " + path + " in tree at element " + pv[i]
			};
		}
	}
	return {
		val: cur,
		cur: ""
	};

}

function log(str) {
	logStr = str;
}


/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn parseResponseFile
 * 
 * @brief Parse the reponse file which is text formatted -> in memory objects.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function parseResponseFile()
{
	onConfFileGetComplete();
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn getServerLogData
 * 
 * @brief Sent request for a range of data (fromDate -> toDate) from the server
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getServerLogData(_fromDate, _toDate) 
{
  dateRange = "from="+DateString(_fromDate)+"&to="+DateString(_toDate);
  url = "http://"+server_ip+"/conditions?" + dateRange;
	makeRequest(url, processConditions);

	url = "http://"+server_ip+"/runtimes?" + dateRange;
  makeRequest(url, processRuntimes);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn processLogData
 * 
 * @brief Process log data response from server.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processConditions(data)
{
  j = JSON.parse(data)
  for (i=0; i<j.length; i++) {
    date = new Date(j[i]["Date"])
    dateStr = date.toDateString()
    iconHistory[dateStr] = j[i]["Icon"]
    tempHistory[dateStr] = j[i]["Temp"]
    precipHistory[dateStr] = j[i]["Precip"]
  }
  displayScheduleTable()
}

function processRuntimes(data)
{
  j = JSON.parse(data)
  for (i=0; i<j.length; i++) {
    date = new Date(j[i]["Date"])
    runtimeHistory[date.toDateString()] = j[i]["Runtimes"]
  }
  displayScheduleTable()
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn postSave
 * 
 * @brief Send a POST with the conf file to the server.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function postSave()
{
	var posturl = "http://"+server_ip+"/conf/user.conf";
	var str;

	writeStatus("Posting to "+ postUrl);

	$.ajaxSetup({ 
		cache: false,
		timeout: 1000, 
		error:   saveToServerError
	});

	str = jQuery.param(globalConf);
	writeStatus(str);

	$.post(posturl, str, function(data){ postDone(data);});

	str = jQuery.param(zoneConf);
	writeStatus(str);
}


/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn mustSave
 * 
 * @brief Called to indicate that some values have changed from the saved ones.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function mustSave()
{
	$('#cancel_button').button({disabled:false});
	$('#save_button').button({disabled:false});
	$('#cancel_button').addClass('enabled-button');
	$('#save_button').addClass('enabled-button');
	mustSave = true;
}

function copyUItoMemoryValues()
{
	if (displayedMenu == 'system_settings_table')
	{
		globalConf.climateZone = $('#climate_zone_text').val();
		globalConf.weatherStation = $('#weather_station_text').val();
		globalConf.runTime1 = $("#watering_time_spinner").timespinner('value');
	}
	else if (displayedMenu == 'email_settings_table')
	{
		globalConf.email = $('#email_address_text').val();
		globalConf.sendSummary = $('#send_summary_text').val();
	}
	else if (displayedMenu == 'display_settings_table')
	{
		globalConf.historyDays = $("#history_days_spinner").spinner('value');
		globalConf.waterDisplay = $('#water_display_select').val();
		globalConf.units        = $('#units_select').val();
	}
	else if (displayedMenu == 'plants_table')
	{
		zoneConf[selectedZone].plantProperties.dormant = $("#dormant_months").slider('values', 0) + '-' + $("#dormant_months").slider('values', 1);
		zoneConf[selectedZone].plantProperties.type    = $('#plant_type1').val()+'-'+ $("#plant_pct1").val() +'+'
		+$('#plant_type2').val +'-'+ $("#plant_pct2").val();
	}
	else if (displayedMenu == 'environment_table')
	{
		zoneConf[selectedZone].environment.wetness = $("#wetness_slider_div").slider('value');
		zoneConf[selectedZone].environment.inPots  = $("#planted_in_select").val() == 'pots' ? 1 : 0;
		zoneConf[selectedZone].environment.getRain = $("#receives_rain_select").val() == 'Receives rain' ? 1 : 0;
		zoneConf[selectedZone].environment.soil    = $("#soil_type_select").val();
		zoneConf[selectedZone].environment.light   = $("#exposure_select").val();
	}
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn makeRequest
 * 
 * @brief Make an AJAX request
 */
/*-------------------------------------------------------------------------------------------------------------*/

function makeRequest(url, callback) {

	writeStatus("Sending request for " + url);

	$.ajaxSetup({ 
		cache: true,
		timeout: 5000, 
		success: callback,
	});
	$.get(url, function(data){
		callback(data);
	}, "text");
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn postDone
 * 
 * @brief Handler for POST complete callback.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function postDone(data)
{
	if(data.match(/OK/))
	{
		// writeStatus(data);
	}
	else
	{
		alert("Problem saving configuration! Script error.");
		// writeStatus(data);
		return;

	}  
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn saveToServerError
 * 
 * @brief Hander for save conf file POST error.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function saveToServerError()
{
	alert("Problem saving configuration! Server error.");
}


