///////////////////////// Defines etc. //////////////////////////////////////////////////////////////////////////

var oldValues = new Object();
var ra=[];
var NUM_ZONES = 8;
var NUM_SENSORS = 8;
var close_accordion = 0;

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     runZone
 *
 * @brief  called when user has selected a zone and run time and pressed the RUN button
 *        
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     runZoneTimer
 *
 * @brief  start the timer for a zone just starting
 *        
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     AddStopCancelButton
 *
 * @brief  dynamically add a stop button for a zone which has started running or has been queued
 *        
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     removeZoneFromQueue
 *
 * @brief  remove a zone queued up to be run
 *        
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     setNewZoneTimer
 *
 * @brief  setup a new countdown timer
 */
/*-------------------------------------------------------------------------------------------------------------*/

function setNewZoneTimer(zone, mins)
{
	$('.countdown_timer[data-array-index=0]').countdown('change', "until", "+"+mins+"m");
	$('.countdown_timer[data-array-index=0]').countdown('change', "layout", 
							    'Running zone '+zone+' for <b>{mnn}{sep}{snn}</b>');
}
			
/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     zoneRunTimerDone
 *
 * @brief  callback when zone timer is done. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function zoneRunTimerDone()
{
    // Same actions as if a user cancelled manually.
    stopZoneButtonPress(0,0);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     stopZoneButtonPress
 *
 * @brief  stops a timer for a running or queued zone.
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     runZoneOnServer
 *
 * @brief  Send a command to the server to run a zone for num_mins.
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     stopZoneOnServer
 *
 * @brief  Stop zone on server. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     runZoneOnServerDone
 *
 * @brief  callback for server run complete
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     stopZoneOnServerDone
 *
 * @brief  callback for server zone stop complete
 */
/*-------------------------------------------------------------------------------------------------------------*/

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

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     stopZoneOnServerDone
 *
 * @brief  callback for server zone error
 */
/*-------------------------------------------------------------------------------------------------------------*/

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



