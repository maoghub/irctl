/*==================================== SERVER VARS, COMMANDS ==================================================*/

/*==================================== SERVER CONF FILE =======================================================*/

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     getConf
 *
 * @brief  Get config file from server
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getConf()
{
    var reqParams = { 
	userName: userName
    };

    var paramStr = jQuery.param(reqParams);

    var url = "http://"+server_ip + servletPath+"/UserConfigServlet?" + paramStr;

    url = "http://127.0.0.1/irr/UserConfigServlet?userName=" + userName;
    
    makeRequest(url, processConfResponse);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     processConfResponse
 *
 * @brief  Handler for getConfFile
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processConfResponse(data) 
{
    g_conf = JSON.parse(data);
    
    numZones = g_conf.numZones;
    historyDays = g_conf.historyDays;
    
    onConfGetComplete();
}

/*==================================== SERVER LOG DATA =======================================================*/

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     getLogs
 *
 * @brief  Sent request for a range of data for given month/year 
 */
/*-------------------------------------------------------------------------------------------------------------*/

var g_getMonth;
var g_getYear;

function getLog(_month, _year) 
{
    g_getMonth = _month;
    g_getYear  = _year;
    getWeatherLog(_month, _year);
}

function onWeatherLogRequestComplete()
{
    getScheduleLog(g_getMonth, g_getYear);
}

function onScheduleLogRequestComplete()
{
    onLogRequestComplete();
}


/*==================================== WEATHER LOG DATA =======================================================*/

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     getWeatherLog
 *
 * @brief  Sent request for a range of weather data for given month/year 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getWeatherLog(_month, _year) 
{
    var reqParams = { 
	wuIdStr:g_conf.weatherStation,
	monthyear: _month + '-' + _year
    };

    var paramStr = jQuery.param(reqParams);

    var url = "http://"+server_ip + servletPath+"/GetWeatherServlet?" + paramStr;
    url = "http://127.0.0.1/irr/GetWeatherServlet?wuIdStr=CA/San_Francisco&monthyear=6-2013";
    makeRequest(url, processWeatherLog);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     processWeatherLog
 *
 * @brief  Process weather log data response from server.  
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processWeatherLog(data) 
{

    var ra=[];
    var ta=[];
    var la=[];
    var dateArr=[];
    var i;

    ra = data.split("\n");

    writeStatus("Received response length "+ra.length);

    for( i=0; i < ra.length; i++ )
    {
	ta = ra[i].split("=");

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

	/*
	  0 minTemp +',' + 1 avgTemp + ',' + 2 maxTemp + ',' + 3 minDewPoint + ',' + 4 avgDewPoint + ',' + 5 maxDewPoint + ',' + 
	  6 minHumidity + ',' + 7 avgHumidity + ',' + 8 maxHumidity + ',' + 9 minWindSpeed +',' + 10 avgWindSpeed + ',' + 11 axWindSpeed + ',' + 
	  12 minPressure + ',' + 13 avgPressure + ',' + 14 maxPressure + ',' + 15 precipitation + ',' + 16 avgWindDir + ',' +
	  17 conditions + ',' + 18 icon + ',' + fog + ',' + rain + ',' + snow + ',' + hail + ',' + thunder + ',' + tornado);
	*/
	tempHistory[hashDate]      = useMetric ? F2C(la[2]) : la[2];
	humidityHistory[hashDate]  = la[7];
	windSpeedHistory[hashDate] = useMetric ? M2Km(la[10]) : la[10];
	rainHistory[hashDate]      = useMetric ? In2Cm(la[15]) : la[15];
	iconHistory[hashDate]      = la[17];
    }

    onWeatherLogRequestComplete();
}

/*==================================== SCHEDULE LOG DATA ======================================================*/

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     getScheduleLog
 *
 * @brief  Sent request for a range of Schedule data for given month/year 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function getScheduleLog(_month, _year) 
{
    var reqParams = { 
	userName : g_conf.userName,
	monthyear: _month + '-' + _year
    };

    var paramStr = jQuery.param(reqParams);

    var url = "http://"+server_ip + servletPath+"/GetScheduleServlet?" + paramStr;

    makeRequest(url, processScheduleLog);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     processScheduleLog
 *
 * @brief  Process Schedule log data response from server.  
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processScheduleLog(data) 
{

    var ra=[];
    var ta=[];
    var la=[];
    var dateArr=[];
    var i, z;

    ra = data.split("\n");

    for( i=0; i < ra.length; i++ )
    {
	ta = ra[i].split("=");

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

	for (z=0; z<numZones; z++)
	{
	    var hStr = z.toString() + '-' + hashDate;

	    val = parseFloat(la[z]);
	    if( isNaN(val) )
	    {
		val = 0;
	    }

	    zoneRuntimeHistory[hStr]  = val;
	}
    }

    onScheduleLogRequestComplete();
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
    var postUrl = "http://"+server_ip+"/irr/UserConfig";
    var body, params;

    writeStatus("Posting to "+ postUrl);

    $.ajaxSetup({ 
	cache: false,
	timeout: 1000, 
	error:   saveToServerError
    });

    params = jQuery.param({"userName":userName});
    var conf = { "userName":userName, "config": { "global":globalConf, "zones": zoneConf } };
    body = JSON.stringify(conf, null, "    ");

    alert(body);
    $.ajax({
	type: "POST",
	url: postUrl + "?" + params,
	processData: false,
	contentType: 'application/json',
	data: body,
	success: function(data) {
	    postDone(data);
	}
    });

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
 * @fn     makeRequest
 *
 * @brief  Make an AJAX request  
 */
/*-------------------------------------------------------------------------------------------------------------*/

function makeRequest(url, callback) {

    $.ajaxSetup({ 
	cache: true,
	timeout: 5000, 
	success: callback,
	error: function (xhr, ajaxOptions, thrownError) {
	    alert(xhr.status);
	    alert(thrownError);
	}	});
    $.get(url, function(data){
	callback(data);
    }, "text");
}

function serverError(data)
{
    alert(data);

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


