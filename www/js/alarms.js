
/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     showAlarmsButtonClick
 *
 * @brief  Handler for clicking on show server log button
 */
/*-------------------------------------------------------------------------------------------------------------*/

function showAlarmsButtonClick()
{
	displayServerLog("alarms.log");
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     clearAlarmsButtonClick
 *
 * @brief  Handler for clicking on clear alarms
 */
/*-------------------------------------------------------------------------------------------------------------*/

function clearAlarmsButtonClick()
{
	clearingAlarms=1;
	$("#num_alarms").html("No alarms");
	$("#num_alarms").css({"color": "green", "text-decoration":""});
	$("#show_alarms_button").attr("disabled","disabled");
	$("#clear_alarms_button").attr("disabled","disabled");
	sendServerCmd("CLEAR_ALARMS");
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     pollServerAlarms
 *
 * @brief  Get list of alarms for the server
 */
/*-------------------------------------------------------------------------------------------------------------*/

function pollServerAlarms()
{
	
	getServerVar("NUM_ALARMS");
	setTimeout("pollServerAlarms()", 60000);

	if(clearingAlarms)
	{
		if(serverVars.NUM_ALARMS > 0 )
		{
			return;
		}
		
		clearingAlarms=0;
	}

	if(serverVars.NUM_ALARMS > 0 )
	{
		$("#num_alarms").html(serverVars.NUM_ALARMS+" alarms!");
		$("#num_alarms").css({"color": "red", "text-decoration":"blink"});
		$("#show_alarms_button").attr("disabled","");
		$("#clear_alarms_button").attr("disabled","");
	}
	else
	{
		$("#num_alarms").html("No alarms");
		$("#num_alarms").css({"color": "green", "text-decoration":""});
		$("#show_alarms_button").attr("disabled","disabled");
		$("#clear_alarms_button").attr("disabled","disabled");
	}

}
/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     popupServerLog
 *
 * @brief  Pops up a message
 */
/*-------------------------------------------------------------------------------------------------------------*/

function popupServerLog(data)
{
	alert(data);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     displayServerLog
 *
 * @brief  Show contents of log on server. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function displayServerLog(logName)
{
	var url="http://"+server_ip+"/logs/"+logName;

	writeStatus("Sending request for " + url);

	$.ajaxSetup({ 
		cache: false,
				timeout: 1000, 
				});
	$.get(url, function(data){
			popupServerLog(data);
		}, "text");
}

