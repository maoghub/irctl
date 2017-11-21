/*==================================== SERVER VARS, COMMANDS ==================================================*/


/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     getServerVar
 *
 * @brief  Get the varName var value from server
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getServerVar(varName)
{
    var postParams = { var_name: varName};
    var posturl = "http://"+server_ip+"/cgi-bin/get_var.cgi";
    var str;

    $.ajaxSetup({ 
	cache: false,
	timeout: 1000, 
    });
    
    str = jQuery.param(postParams);
    //writeStatus("Posting to "+posturl+"?"+str);
    
    $.post(posturl, postParams, function(data){ 
	alert(data);
    });
}
/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     serverVarResponse
 *
 * @brief  Handler for getServerVar response
 */
/*-------------------------------------------------------------------------------------------------------------*/

function serverVarResponse(data)
{
    var ra = data.split("\n");
    var toks;

    if(data.match(/OK/))
    {
	toks = ra[0].split("=");
	if(serverVars[toks[0]] != toks[1])
	{
	    serverVars[toks[0]]=toks[1];
	    writeStatus("Server var "+toks[0]+" = "+toks[1]+"\n");
	}
    }
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     sendServerCmd
 *
 * @brief  Send a command to the server
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
 * @fn     serverCmdResponse
 *
 * @brief  Handler for sendServerCmd completion
 */
/*-------------------------------------------------------------------------------------------------------------*/

function serverCmdResponse(data)
{
    if(data.match(/OK/))
    {
	writeStatus("Server cmd OK\n");
    }
}

/*==================================== SERVER CONF FILE =======================================================*/

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     getConfFile
 *
 * @brief  Get config file from server
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getConfFile()
{
    var url = "http://"+server_ip+"/"+conf_filename;

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
 * @fn     processConfFileResponse
 *
 * @brief  Handler for getConfFile
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processConfFileResponse(data) {

    current_soil_num = 1;

    ra = data.split("\n");

    writeStatus("Received response length "+ra.length);

    parseResponseFile();
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     parseResponseFile
 *
 * @brief  Parse the reponse file which is text formatted -> in memory objects.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function parseResponseFile()
{
    onConfFileGetComplete();
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     getServerLogData
 *
 * @brief  Sent request for a range of data (fromDate -> toDate) from the server 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getServerLogData(_fromDate, _toDate) 
{
    //url = "http://"+server_ip+"/cgi-bin/get_log_range.cgi?"+"airport_code="+airportCode+
//	"&from_date="+getDateString(_fromDate)+"&to_date="+getDateString(_toDate);

    url = "http://"+server_ip+"/get_log.txt";

    newHistoryStart = firstDate(historyStart, _fromDate);
    newHistoryEnd   = lastDate(historyEnd, _toDate);

    makeRequest(url, processLogData);

    setTimeout("getServerLogData()", MS_1_HR);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     processLogData
 *
 * @brief  Process log data response from server.  
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processLogData(data) 
{

    var ra=[];
    var ta=[];
    var la=[];
    var dateArr=[];
    var mode;
    var st, i,s,z, val;

    ra = data.split("\n");

    writeStatus("Received response length "+ra.length);

    for( i=0; i < ra.length; i++ )
    {
	//writeStatus(ra[i]+"\n");

	ta = ra[i].split("=");
	
	if(ta == "")
	{
	    continue;
	}
	
	if(ta[0].match(/WEATHER/) ||
	   ta[0].match(/ZONE_RUN_TIMES/) ||
	   ta[0].match(/ZONE_MOISTURE/) ||
	   ta[0].match(/ZONE_DRYING_RATE/) ||
	   ta[0].match(/SENSOR_MOISTURE/) ||
	   ta[0].match(/SENSOR_DRYING_RATE/) )
	{
	    mode = ta[0];
	    st=i+1;
	}
	else 
	{
	    if(!ta[1])
	    {
		continue;
	    }

	    dateArr   = ta[0].split("-");
	    var day   = dateArr[2];
	    var month = dateArr[1];
	    var year  = dateArr[0];
	
	    var hashDate = hashStr(year.toString(), month.toString(), day.toString());

	    la = ta[1].split(",");
	    
	    if(mode == "WEATHER")
	    {					
		// (0-"min_temp_f", 1-"avg_temp_f", 2-"max_temp_f", 3-"dew_point_f", 4-"humidity_pct", 5-"pressure_in", 6-"wind_speed_mph", 
		//   7-"max_wind_speed_mph",  8-"max_gust_speeed", 9-"wind_dir_deg",  10-"precipitation_in", 11-"cloud_cover_pct" );
		// 12 - weather icon string

		tempHistory[hashDate]      = useMetric ? F2C(la[2]) : la[2];
		humidityHistory[hashDate]  = la[4];
		windSpeedHistory[hashDate] = useMetric ? M2Km(la[4]) : la[4];
		rainHistory[hashDate]      = useMetric ? In2Cm(la[4]) : la[4];
		iconHistory[hashDate]      = la[12];
	    }
	    else if ( mode == "ZONE_RUN_TIMES" || mode == "ZONE_MOISTURE" || mode == "ZONE_DRYING_RATE" )
	    {
		for (z=0; z<numZones; z++)
		{
		    var hStr = z.toString() + '-' + hashDate;

		    val = parseFloat(la[z]);
		    if( isNaN(val) )
		    {
			val = 0;
		    }
		    
		    if(mode == "ZONE_RUN_TIMES")
		    {
			zoneRuntimeHistory[hStr]  = val;
		    }
		    
		    else if(mode == "ZONE_MOISTURE")
		    {
			zoneMoistureHistory[hStr]  = val;
		    }						
		    else if(mode == "ZONE_DRYING_RATE")
		    {
			zoneDryingRateHistory[hStr]  = val;
		    }			
		}
	    }
	    else if (mode == "SENSOR_MOISTURE" || mode == "SENSOR_DRYING_RATE" )
	    {
		for (s=0; s<numSensors; s++)
		{
		    var hStr = s.toString() + '-' + hashDate;

		    val = parseFloat(la[s]);
		    if( isNaN(val) )
		    {
			val = 0;
		    }
		    
		    if(mode == "SENSOR_MOISTURE")
		    {
			sensorMoistureHistory[hStr]  = val;
		    }						
		    else if(mode == "SENSOR_DRYING_RATE")
		    {
			sensorDryingRateHistory[hStr]  = val;
		    }			
		}

	    }
	}
	
    }

    onServerLogRequestComplete();
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     postSave
 *
 * @brief  Send a POST with the conf file to the server. 
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

function getConfObject(_confString)
{
    var attrs = _confString.split(";");
    var retObj = new Object();
    var pArr = [];

    for (var i=0; i<attrs.length-1; i++)
    {
	pArr = attrs[i].split(/:(.+)?/);
	retObj[pArr[0].trim()] = pArr[1].trim();
    } 

    return retObj;
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     mustSave
 *
 * @brief  Called to indicate that some values have changed from the saved ones.
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
 * @fn     makeRequest
 *
 * @brief  Make an AJAX request  
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
 * @fn     postDone
 *
 * @brief  Handler for POST complete callback.
 */
/*-------------------------------------------------------------------------------------------------------------*/

function postDone(data)
{
    if(data.match(/OK/))
    {
	//writeStatus(data);
    }
    else
    {
	alert("Problem saving configuration! Script error.");
	//writeStatus(data);
	return;

    }  
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     saveToServerError
 *
 * @brief  Hander for save conf file POST error. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function saveToServerError()
{
    alert("Problem saving configuration! Server error.");
}


