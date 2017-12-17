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
 * @fn processConfFileResponse
 * 
 * @brief Handler for getConfFile
 */
/*-------------------------------------------------------------------------------------------------------------*/

function processConfFileResponse(data) {

	confStr = data;
	conf = JSON.parse(confStr);

	ret = getPathValue(conf, "GlobalConfig.AirportCode");
	if (ret.err) {
		return ret.err;
	}
	g.airportCode = ret.val;

	runtimePath = "GlobalConfig.RunTimeAM";
	ret = getPathValue(conf, runtimePath);
	if (ret.err) {
		return ret.err;
	}

	// expect format "0000-01-01T16:00:00Z"
	tv = ret.val.split(":");
	if (tv.length != 3) {
		return "bad time string for " + runtimePath + ":" + ret.val;
	}
	hrv = tv[0].split("T");
	if (tv.length != 3) {
		return "bad time string for " + runtimePath + ":" + ret.val;
	}

	g.runTime = hrv[1] + ":" + tv[1];

	err = parseZoneConfigs(conf);
	if (err) {
		return err;
	}
	err = parseAlgorithm(conf)
	if (err) {
		return err;
	}

	g.globalConf = conf;
}

function parseZoneConfigs(tree) {
	ret = getPathValue(tree, "ZoneConfigs");
	if (ret.err) {
		return ret.err;
	}

	zconfs = ret.val;

	for ( var num in zconfs) {
		ret = getPathValue(zconfs, num);
		zconf = ret.val;

		// Set some defaults so that users of zone confs can use object
		// attributes
		// without checking for null.
		SetDefaultIfMissing(zconf, "Name", "##MISSING##");
		SetDefaultIfMissing(zconf, "Number", parseInt(num));
		SetDefaultIfMissing(zconf, "Enabled", false);
		SetDefaultIfMissing(zconf, "GetsRain", false);
		SetDefaultIfMissing(zconf, "DepthIn", 0);
		SetDefaultIfMissing(zconf, "ZoneETRate", 10);
		SetDefaultIfMissing(zconf, "RunTimeMultiplier", 1);
		SetDefaultIfMissing(zconf, "SoilConfig.Name", "##MISSING##");
		SetDefaultIfMissing(zconf, "MinVWC", 0);
		SetDefaultIfMissing(zconf, "MaxVWC", 100);

		nz = parseInt(num);
		g.zoneConf[nz] = zconf;
		if (nz + 1 > g.numZones) {
			g.numZones = nz + 1;
		}
	}
}

// "ETAlgorithmSimpleConfig":{"EtPctMap":{
// "R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},

function parseAlgorithm(tree) {
	ret = getPathValue(tree, "ETAlgorithmSimpleConfig.EtPctMap.R");
	if (ret.err) {
		return ret.err;
	}

	rs = ret.val;
	i = 0;
	for ( var r in rs) {
		x1r = getPathValue(rs[r], "X1");
		if (x1r.err) {
			return err;
		}
		x2r = getPathValue(rs[r], "X2");
		if (x2r.err) {
			return err;
		}
		yr = getPathValue(rs[r], "Y");
		if (yr.err) {
			return err;
		}
		x1 = x1r.val;
		x2 = x2r.val;
		y = yr.val;

		if (x1 <= -999) {
			x1 = -999;
		}
		if (x2 >= 999) {
			x2 = 999;
		}

		setDiv("temp_" + i + "_from", x1);
		setDiv("temp_" + i + "_to", x2);
		setDiv("temp_" + i + "_drying_pct", y);

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
		log(ret.err);
		return "";
	}
	return ret.val;
}

function SetDefaultIfMissing(zconf, path, defaultVal) {
	if (getPathOrLogErr(zconf, path) == "") {
		pv = path.split(".");
		cur = zconf;
		for (i = 0; i < pv.length; i++) {
			cur = cur[pv[i]];
			if (!cur) {
				log("could not find path " + path + " in tree at element "
						+ pv[i]);
			}
		}
		cur = defaultVal;
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
				err: "could not find path " + path + "in tree at element " + pv[i]
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

function getServerLogData(_fromDate, _toDate) {
	dateRange = "from=" + DateString(_fromDate) + "&to=" + DateString(_toDate);
	url = "http://" + server_ip + "/conditions?" + dateRange;
	makeRequest(url, processConditions);

	url = "http://" + server_ip + "/runtimes?" + dateRange;
	makeRequest(url, processRuntimes);
}

function processConditionsResponse(data) {
	jt = JSON.parse(data);
	if (jt.Errors != null) {
		alert(jt.Errors);
		return;
	}
	ja = jt.Conditions;
	for (i = 0; i < ja.length; i++) {
		date = new Date(ja[i]["Date"]);
		dateStr = DateString(date);
		g.iconHistory[dateStr] = ja[i]["Icon"];
		g.tempHistory[dateStr] = ja[i]["Temp"];
		g.precipHistory[dateStr] = ja[i]["Precip"];
	}
}

function processRuntimesResponse(data) {
	jt = JSON.parse(data);
	if (jt.Errors != null) {
		alert(jt.Errors);
		return;
	}
	ja = jt.Runtimes;
	for (i = 0; i < ja.length; i++) {
		date = new Date(ja[i]["Date"]);
		dateStr = DateString(date);
		g.runtimeHistory[dateStr] = ja[i]["Runtimes"];
	}
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

	str = jQuery.param(g.globalConf);
	writeStatus(str);

	$.post(posturl, str, function(data){ postDone(data);});

	str = jQuery.param(g.zoneConf);
	writeStatus(str);
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


