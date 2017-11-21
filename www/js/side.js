var system_setup = new Object();
var soil_types = new Object();
var algorithm_parms = new Object();
var zones = new Object();

var statusArea;
var server_ip = location.host;
var conf_filename = "conf/scheduler_conf.json";

var needSave = 0;
var savedValues = new Object();
var oldValues = new Object();
var ra=[];

var NUM_ZONES = 8;

var NUM_ZONE_QUEUE_SLOTS = 6;
var zoneQueueSlotsUsed = 0;
var zoneQueueSlot=[];
var zoneRunning=0;


var clearingAlarms=0;
var stoppingRunCommand=0;

function initAll()
{
	if(parent.bottom)
	{
		statusArea = parent.bottom.document.getElementById("statusArea");
	}

	getConfFile();

	for(i=0; i<NUM_ZONE_QUEUE_SLOTS; i++)
	{
		zoneQueueSlot[i] = new Object();
	}

	$("#accordion").accordion( "option", "active", false );

	pollServerAlarms();
}

function popupServerLog(data)
{
	alert(data);
}

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

function showAlarmsButtonClick()
{
	displayServerLog("alarms.log");
}
function clearAlarmsButtonClick()
{
	clearingAlarms=1;
	$("#num_alarms").html("No alarms");
	$("#num_alarms").css({"color": "green", "text-decoration":""});
	$("#show_alarms_button").attr("disabled","disabled");
	$("#clear_alarms_button").attr("disabled","disabled");
	sendServerCmd("CLEAR_ALARMS");
}

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

function setNeedSaveState(val)
{
	needSave = 1;
	$("#save_button").attr("disabled", needSave==1?"":"disabled");
	$("#cancel_button").attr("disabled", needSave==1?"":"disabled");
}

function writeStatus(str) {
	if(statusArea)
		statusArea.innerHTML += str + "<br />";
}

function to_24hr_str(hr, min, am_pm)
{
	var hr_val = hr;
	var min_val = min;

	if(am_pm == "PM")
	{
		hr_val = Number(12) + Number(hr_val);
	}

	return hr_val+":"+min_val;
}

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
		
	$.post(posturl, postParams, function(data){ serverVarResponse(data);});
}

function serverCmdResponse(data)
{
	if(data.match(/OK/))
	{
		writeStatus("Server cmd OK\n");
	}
}

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

function parseResponseFile()
{

	for( var i=0; i < ra.length; i++ )
	{
		var raw_line = ra[i];
		var ta = ra[i].split(",");

		if(ta[0].match(/#/))
		{
			continue;
		}
		else if(ta[0].match(/GLOBAL_CONFIG/) )
		{
			//#GLOBAL_CONFIG,airport_code,metric_units,run1_time,run2_time,startup_show

			$("#airport_code").val(ta[1]);
			$("#radio_metric").attr('checked', ta[2]==1?"checked":"");
			$("#radio_usa").attr('checked', ta[2]==0?"checked":"");
			run1str = ta[3].split(/:/);
			run2str = ta[4].split(/:/);
			$("#run1_hr").val((run1str[0]<=12)? run1str[0] : (run1str[0]-12));
			$("#run1_min").val(run1str[1]);
			$("#run1_am_pm").val((run1str[0]<=12)? "AM" : "PM");
			$("#run2_hr").val((run2str[0]<=12)? run2str[0] : (run2str[0]-12));
			$("#run2_min").val(run2str[1]);
			$("#run2_am_pm").val((run2str[0]<=12)? "AM" : "PM");

			airport_code = $("#airport_code").value;

			//writeStatus("GLOBAL_CONFIG: airport_code="+$("#airport_code").value+", use_metric="+$("#radio_metric").checked+", ");	
			//writeStatus("run_am="+run1str+", run_pm="+run2str+"\n");
		}
		else if(ta[0].match(/ALGORITHM/) )
		{
                        //ALGORITHM,range1,evap_rate_1,range2,evap_rate_2...
			var range = [];

			if(ta[1])
			{
				range = ta[1].split(/-/);
				$("#temp_1_from").val(range[0]);
				$("#temp_1_to").val(range[1]);
				$("#temp_1_drying_pct").val(ta[2]);
			}
			if(ta[3])
			{
				range = ta[3].split(/-/);
				$("#temp_2_from").val(range[0]);
				$("#temp_2_to").val(range[1]);
				$("#temp_2_drying_pct").val(ta[4]);
			}
			if(ta[5])
			{
				range = ta[5].split(/-/);
				$("#temp_3_from").val(range[0]);
				$("#temp_3_to").val(range[1]);
				$("#temp_3_drying_pct").val(ta[6]);
			}
			if(ta[7])
			{
				range = ta[7].split(/-/);
				$("#temp_4_from").val(range[0]);
				$("#temp_4_to").val(range[1]);
				$("#temp_4_drying_pct").val(ta[8]);
			}
			if(ta[9])
			{
				range = ta[9].split(/-/);
				$("#temp_5_from").val(range[0]);
				$("#temp_5_to").val(range[1]);
				$("#temp_5_drying_pct").val(ta[10]);
			}
		}
		else if(ta[0].match(/SOIL/) )
		{
			var soil_num = ta[1];

			$('.SOIL[data-object_name="name"][data-array-index="'+soil_num+'"]').val(ta[2]);
			$('.SOIL[data-object_name="max_moist_pct"][data-array-index="'+soil_num+'"]').val(ta[3]);

		}
		else if(ta[0].match(/ZONE/) )
		{
			//ZONE,number,name,run,rain,soil_name,min_moist_pct,max_moist_pct,run_time_mult,root_depth,et_rate
			var zone_num = ta[1];

			$('.ZONE[data-object_name="name"][data-array-index="'+zone_num+'"]').val(ta[2]);
			$('.ZONE[data-object_name="run"][data-array-index="'+zone_num+'"]').attr('checked',(ta[3]==1?"checked":""));
			$('.ZONE[data-object_name="rain"][data-array-index="'+zone_num+'"]').attr('checked',(ta[4]==1?"checked":""));
			$('.ZONE[data-object_name="soil_name"][data-array-index="'+zone_num+'"]').val(ta[5]);
			$('.ZONE[data-object_name="min_moist_pct"][data-array-index="'+zone_num+'"]').val(ta[6]);
			$('.ZONE[data-object_name="max_moist_pct"][data-array-index="'+zone_num+'"]').val(ta[7]);
			$('.ZONE[data-object_name="run_time_mult"][data-array-index="'+zone_num+'"]').val(ta[8]);
			$('.ZONE[data-object_name="root_depth"][data-array-index="'+zone_num+'"]').val(ta[9]);
			$('.ZONE[data-object_name="et_rate"][data-array-index="'+zone_num+'"]').val(ta[10]);
		}
	}

	if(close_accordion)
	{
		$("#accordion").accordion( "option", "active", 0 );
		$("#accordion").accordion( "activate" , 0);
		close_accordion = 0;
	}
}

function processConfFileResponse(data) {

	current_soil_num = 1;

	ra = data.split("\n");

	writeStatus("Received response length "+ra.length);

	parseResponseFile();
}

function getConfFile()
{
	var url = "http://"+server_ip+"/"+conf_filename;

	writeStatus("Sending request for " + url);

	$.ajaxSetup({ 
		cache: false,
				timeout: 1000, 
				});

	$.ajax({url: url,
				dataType: "text",
				success:  function(data){
				processConfFileResponse(data);
			}});


}

function marshallParms()
{
	savedValues.soil_types = [];
	savedValues.zones = [];
	savedValuesArray=[];

	savedValues.system_setup = {
	var_name:      "GLOBAL_CONFIG",
	airport_code: $("#airport_code").val(),
	run1_time: to_24hr_str($("#run1_hr").val(), $("#run1_min").val(), $("#run1_am_pm").val()), 
	run2_time: to_24hr_str($("#run2_hr").val(), $("#run2_min").val(), $("#run2_am_pm").val()),
	metric_units: $("#radio_metric").attr('checked')?1:0,
	need_save: needSaveArray["GLOBAL_CONFIG"][0]
	};
	
	var radio_metric=$("#radio_metric").attr('checked');
	var radio_usa=$("#radio_usa").attr('checked');
	writeStatus("Metric="+radio_metric+" usa="+radio_usa+"\n");

	savedValuesArray.push(savedValues.system_setup);

	for(var s=1; s<=4; s++)
	{
	
		savedValues.soil_types[s-1] = {
		var_name:      "SOIL",
		number:        s,
		name:          $('.SOIL[data-object_name="name"][data-array-index="'+s+'"]').val(),
		max_moist_pct: $('.SOIL[data-object_name="max_moist_pct"][data-array-index="'+s+'"]').val(),
		need_save: needSaveArray["SOIL"][s-1]
		};

		savedValuesArray.push(savedValues.soil_types[s-1]);
	}

	savedValues.algorithm_parms = {
	var_name:      "ALGORITHM",

	range1: $("#temp_1_from").val()+"-"+$("#temp_1_to").val(),
	evap_rate_1: $("#temp_1_drying_pct").val(),

	range2: $("#temp_2_from").val()+"-"+$("#temp_2_to").val(),
	evap_rate_2: $("#temp_2_drying_pct").val(),

	range3: $("#temp_3_from").val()+"-"+$("#temp_3_to").val(),
	evap_rate_3: $("#temp_3_drying_pct").val(),

	range4: $("#temp_4_from").val()+"-"+$("#temp_4_to").val(),
	evap_rate_4: $("#temp_4_drying_pct").val(),

	range5: $("#temp_5_from").val()+"-"+$("#temp_5_to").val(),
	evap_rate_5: $("#temp_5_drying_pct").val(),
	need_save: needSaveArray["ALGORITHM"][0]
	};

	savedValuesArray.push(savedValues.algorithm_parms);
	
	for(var z=1; z<=8; z++)
	{
		savedValues.zones[z-1] = {
		var_name: "ZONE",
		number : z,
		name : $('.ZONE[data-object_name="name"][data-array-index="'+z+'"]').val(),
		run :  $('.ZONE[data-object_name="run"][data-array-index="'+z+'"]').attr('checked')?1:0,
		rain : $('.ZONE[data-object_name="rain"][data-array-index="'+z+'"]').attr('checked')?1:0,
		soil_name : $('.ZONE[data-object_name="soil_name"][data-array-index="'+z+'"]').val(),
		min_moist_pct : $('.ZONE[data-object_name="min_moist_pct"][data-array-index="'+z+'"]').val(),
		max_moist_pct : $('.ZONE[data-object_name="max_moist_pct"][data-array-index="'+z+'"]').val(),
		run_time_mult : $('.ZONE[data-object_name="run_time_mult"][data-array-index="'+z+'"]').val(),
		root_depth : $('.ZONE[data-object_name="root_depth"][data-array-index="'+z+'"]').val(),
		et_rate : $('.ZONE[data-object_name="et_rate"][data-array-index="'+z+'"]').val(),
		need_save: needSaveArray["ZONE"][z-1]
		};
		savedValuesArray.push(savedValues.zones[z-1]);
	}
}

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

	if(saveParamIndex < savedValuesArray.length)
	{
		saveParamIndex++;
		postSave(savedValuesArray[saveParamIndex]);
	}
	else
	{
		alert("Configuration saved.");
	}
	
}

function saveToServerError()
{
		alert("Problem saving configuration! Server error.");
}


function postSave(postParams)
{
	var posturl = "http://"+server_ip+"/cgi-bin/set_var.cgi";
	var str;

	if(!postParams)
	{
		postDone("OK");
		return;
	}

	if(postParams.need_save)
	{

		$.ajaxSetup({ 
			cache: false,
			timeout: 1000, 
					error:   saveToServerError
					});
		
		delete postParams.need_save;

		str = jQuery.param(postParams);
		writeStatus("Posting to "+posturl+"?"+str);
		
		$.post(posturl, postParams, function(data){ postDone(data);});
	}
	else
	{
		postDone("OK");
	}
}

function saveFunction()
{
	if(savedValuesArray.length == 0)
	{
		alert("Nothing needs to be saved.");
		return;
	}

	marshallParms();
	saveParamIndex=0;
	postSave(savedValuesArray[saveParamIndex]);
	needSaveArray = {
	GLOBAL_CONFIG : [0],
	ZONE: [0,0,0,0,0,0,0,0],
	SOIL: [0,0,0,0],
	ALGORITHM: [0]}
}

function cancelFunction()
{
	parseResponseFile();
	setNeedSaveState(0);
}
function removeZoneFromQueue(zoneSlot)
{
	for(i=zoneSlot; i<zoneQueueSlotsUsed-1; i++)
	{
		if(i)
		{
			// Only remove the queue slots, not the running slot
			var j = Number(i)+1;
			$('.countdown_timer[data-array-index="'+i+'"]').html($('.countdown_timer[data-array-index="'+j+'"]').html());
		}
		zoneQueueSlot[i] = zoneQueueSlot[i+1];
	}

	// Remove last line
	zoneQueueSlotsUsed--;
	if(zoneQueueSlotsUsed)
	{
		$('.stop_button[data-array-index="'+zoneQueueSlotsUsed+'"]').empty();
		$('.countdown_timer[data-array-index="'+zoneQueueSlotsUsed+'"]').html("");
	}
}

function zoneRunTimerDone()
{
	stopZoneButtonPress(0,0);
}

function setNewZoneTimer(zone, mins)
{
	$('.countdown_timer[data-array-index=0]').countdown('change', "until", "+"+mins+"m");
	$('.countdown_timer[data-array-index=0]').countdown('change', "layout", 
							    'Running zone '+zone+' for <b>{mnn}{sep}{snn}</b>');
}
			
function stopZoneButtonPress(zoneSlot, destroyTimer)
{
	removeZoneFromQueue(zoneSlot);

	if(zoneSlot==0)
	{
		if(destroyTimer || !zoneQueueSlotsUsed)
		{	
			$('.countdown_timer[data-array-index="0"]').countdown('destroy');
		}
		else
		{
			$('.countdown_timer[data-array-index="0"]').countdown('destroy');
			$('.stop_button[data-array-index="0"]').empty();
			$('.countdown_timer[data-array-index="0"]').html("Preparing zone "+zoneQueueSlot[0].zone+"..." );
			setTimeout( "runZoneTimer(zoneQueueSlot[0].zone, zoneQueueSlot[0].mins)", 5000);
			setTimeout( "runZoneOnServer(zoneQueueSlot[0].zone, zoneQueueSlot[0].mins)", 5000);
			//setTimeout( setNewZoneTimer(zoneQueueSlot[0].zone, zoneQueueSlot[0].mins), 2000);
		}
	}
	
	if(destroyTimer && zoneQueueSlotsUsed)
	{
		$('.stop_button[data-array-index="0"]').empty();
		$('.countdown_timer[data-array-index="0"]').html("Preparing zone "+zoneQueueSlot[0].zone+"..." );
		setTimeout( "runZoneTimer(zoneQueueSlot[0].zone, zoneQueueSlot[0].mins)", 5000);
		setTimeout( "runZoneOnServer(zoneQueueSlot[0].zone, zoneQueueSlot[0].mins)", 5000);
	}
						
	if(!zoneQueueSlotsUsed)
	{
		$('.stop_button[data-array-index="0"]').empty();
	}
}

function runZoneTimer(zone, mins)
{
	$('.countdown_timer[data-array-index=0]').countdown({compact: true, 
				layout: ' Running zone '+zone+' for <b>{mnn}{sep}{snn}</b>', 
				until: '+'+ mins +'m', 
				//until: '+10s', 
				format: 'YOWDHMS', 
				significant: 2, 
				onExpiry:  zoneRunTimerDone
				});
	AddStopCancelButton(0);
	//alert("Run zone "+zone+" for "+mins+" mins.");
		
	//$('.countdown_timer[data-array-index="'+0+'"]').html("Run Zone "+zone+" for "+mins+" mins.");
}

function AddStopCancelButton(zoneSlot)
{
	var element = document.createElement("input");
		
	//Assign different attributes to the element.
	element.setAttribute("type", "button");
	element.setAttribute("value", zoneSlot?"CANCEL":"STOP");
	element.setAttribute("name", zoneSlot?"CANCEL":"STOP");
	element.onclick = function(){	
		if(zoneSlot==0)
		{
			stopZoneOnServer(zoneQueueSlot[zoneSlot].zone);
		}
		stopZoneButtonPress(zoneSlot,1);
	};
	element.setAttribute("style", "margin-left: -15px; font-size: 1.0em; ");
		
	$('.stop_button[data-array-index="'+zoneSlot+'"]').append(element);
}

function runZoneOnServerDone(data)
{
	var resp = [];
	var token = [];

	resp = data.split("\n");
	
	//  Server outputs "Running zone $zone_num for $run_mins mins\n"
	token = resp[0].split(/[\s]+/);

	var zone = token[2];
	var mins = token[4];

	if(resp[1].match(/OK/))
	{
		writeStatus("Zone "+zone+" ran for "+mins+" mins");
	}
	else
	{
		alert("ERROR: "+resp[0]);
	}
}
function stopZoneOnServerDone(data)
{
	var resp = [];
	var token = [];

	resp = data.split("\n");
	
	writeStatus(data);
	//  Server outputs "Running zone $zone_num for $run_mins mins\n"
	token = resp[0].split(/[\s]+/);

	var zone = token[2];

	if(resp[1].match(/OK/))
	{
		writeStatus("Zone "+zone+" stopped.");
	}
	else
	{
		alert("ERROR: "+resp[0]);
	}
}

function runZoneOnServerError()
{
	if(stoppingRunCommand)
	{
		stoppingRunCommand--;
	}
	else
	{
		alert("Server Error");
	}
}

function runZoneOnServer(zone, num_mins)
{
	var posturl = "http://"+server_ip+"/cgi-bin/zone_run.cgi";
	var postParams = { zone_num: zone, mins: num_mins };
	var str = jQuery.param(postParams);

	writeStatus("Posting to "+posturl+"?"+str);
	$.ajaxSetup({ 
		cache: false,
		timeout: num_mins * 60 * 1000 + 10000, 
		error:   runZoneOnServerError
				});
	$.post(posturl, postParams, function(data){ runZoneOnServerDone(data);}); 
}
function stopZoneOnServer(zone)
{
	var posturl = "http://"+server_ip+"/cgi-bin/zone_stop.cgi";
	var postParams = { zone_num: zone };
	var str = jQuery.param(postParams);

	// Prevetnt the zone POST timeout message. Could have multiple stops queued.
	stoppingRunCommand++;

	writeStatus("Posting to "+posturl+"?"+str);
	$.ajaxSetup({ 
		cache: false,
		timeout: 5000, 
		error:   runZoneOnServerError
				});
	$.post(posturl, postParams, function(data){ stopZoneOnServerDone(data);}); 
}
function runZone()
{
	var mins = $('#zone_run_time').val();
	var zone = $('#zone_run_number').val();
        writeStatus("Running zone "+$('#zone_run_number').val() + "for "+mins+" mins.\n");

	var zsl = zoneQueueSlotsUsed;

	if(zoneQueueSlotsUsed)
	{
		// Queue for later
		if(zoneQueueSlotsUsed == NUM_ZONE_QUEUE_SLOTS)
		{
			alert("All run slots are used. Please try again when a zone completes.");
			return;
		}
		$('.countdown_timer[data-array-index="'+zsl+'"]').html("Next: Zone "+zone+" for "+mins+" mins.");
		AddStopCancelButton(zsl);
	}
	else
	{
		//AddStopCancelButton(0, zone);
		runZoneTimer(zone, mins);
		runZoneOnServer(zone,mins);
	}

	zoneQueueSlot[zsl].zone = zone;
	zoneQueueSlot[zsl].mins = mins;
	zoneQueueSlotsUsed++;
}

function debugCheckClicked()
{
	var checkon=$("#debug_checkbox").attr("checked");
	var fs = parent.document.getElementById('frameset_id');

	if(fs)
	{
		fs.rows=checkon?"80%,*":"100%,*";
	}
}

$(document).ready(function(){
		marshallParms();
		$( ".checkGroup" ).buttonset();
		//$(".run-button").button();
		//$(".run-button").click(runZone());
/*function() {
				var button_number = Number(this.getAttribute("data-button-number"));
				var run_time = $('.runtime-value[data-button-number="'+button_number+'"]').val();
				//alert("Running zone "+button_number +" for "+run_time+" mins."); 
				runZone(button_number-1, run_time)
				});*/
		$("#accordion").accordion( {
			collapsible: true,
					active: false
					});


		$(".SOIL").children().find('*').addClass("SOIL");
		$(".SOIL").children().attr("data-tab", "SOIL");
		$(".ZONE").children().find('*').addClass("ZONE");
		$(".ZONE").children().attr("data-tab", "ZONE");
		$(".GLOBAL_CONFIG").children().find('*').addClass("GLOBAL_CONFIG");
		$(".GLOBAL_CONFIG").children().attr("data-tab", "GLOBAL_CONFIG");
		$("#algorithm_fields").children().find('*').addClass("ALGORITHM");
		$("#algorithm_fields").children().attr("data-tab", "ALGORITHM");
		$("#accordion").children().find('*').addClass("need_save");
		$(".need_save").change(function() {
				var calling_tab = this.getAttribute("data-tab");
				var calling_element = this.id;
				var calling_value = this.value;
				var calling_index = Math.max(0, this.getAttribute("data-array-index")-1);

				if(calling_tab)
				{
					needSaveArray[calling_tab][calling_index]=1;
				}
			});

		$("#cancel_button").easyconfirm();
		$("#cancel_button").click(function() {
				cancelFunction();
			});

		initAll();
		setNeedSaveState(0);
	});

