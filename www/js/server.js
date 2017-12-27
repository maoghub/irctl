/*----------------------------------------------------------------------------*/
/**
 * @fn getConfFile
 * @brief Get config file from server
 */
/*----------------------------------------------------------------------------*/

function getConfFile() {
  var url = "http://" + server_ip + "/" + confFilename;

  Debug("Sending request for " + url);

  makeRequest(url, processConfFileResponse);
}

/*----------------------------------------------------------------------------*/
/**
 * @fn processConfFileResponse
 * @brief Populate g.globalConfig, g.zoneConf and g.algorithm with values
 * derived from the supplied data, which is a JSON string of the config.
 */
/*----------------------------------------------------------------------------*/

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
  if (tv.length != 2 && tv.length != 3) {
    return "bad time string for " + runtimePath + ":" + ret.val;
  }
  hrv = tv[0].split("T");
  if (hrv.length != 2) {
    return "bad time string for " + runtimePath + ":" + ret.val;
  }

  tvz = tv[1].split("Z");
  g.runTime = hrv[1] + ":" + tvz[0];

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

// Populate the values in the global g.zoneConf array with zone config values
// found in the given JSON tree. All values are populated - any missing values
// are filled with defaults, so all zoneConf objects have all expected 
// properties set to something.
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

// Populate g.algorithm with values derived from the given json config tree.
// "ETAlgorithmSimpleConfig":{"EtPctMap":{
// "R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},
function parseAlgorithm(tree) {
  ret = getPathValue(tree, "ETAlgorithmSimpleConfig.EtPctMap.R");
  if (ret.err) {
    return ret.err;
  }

  rs = ret.val;
  var i = 0;
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

    g.algorithm[i] = {};
    g.algorithm[i].from = x1;
    g.algorithm[i].to = x2;
    g.algorithm[i].pct = y;

    i++;
  }

}

// Return the value at the given path and return it in an object containing 
// {val, err} where err indicates any error encountered.
function getPathOrLogErr(tree, path) {
  ret = getPathValue(tree, path);
  if (ret.err) {
    log(ret.err);
    return "";
  }
  return ret.val;
}

// Populate the given path in the zconf tree with the the given defaultValue if
// no value is found at the given path. If value is already present, do nothing.
function SetDefaultIfMissing(zconf, path, defaultVal) {
  if (getPathOrLogErr(zconf, path) == "") {
    pv = path.split(".");
    cur = zconf;
    for (i = 0; i < pv.length; i++) {
      cur = cur[pv[i]];
      if (!cur) {
        log("could not find path " + path + " in tree at element " + pv[i]);
      }
    }
    cur = defaultVal;
  }
}

// get the value from the JSON tree at the given path. Returns object with 'err'
// indicating any error and val the retrieved value.
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

function log(msg) {
	console.log(msg);
}

/*----------------------------------------------------------------------------*/
/**
 * @fn sendRunZoneCmd
 * @brief Send a run zone command to server.
 */
/*----------------------------------------------------------------------------*/

function sendRunZoneCmd(num, mins) {
	  url = "http://" + server_ip + "/runzone?num=" + num.toString() + "&mins=" + mins.toString();
	  makeRequest(url, onSendRunZoneCmdDone);	
}
 
function onSendRunZoneCmdDone(data) {
	  if (!data.match(/OK/)) {
		    alert("Problem starting zone: " + data);
	  }
	}

function sendRunZoneStopCmd(num) {
	  url = "http://" + server_ip + "/runzonestop?num=" + num.toString();
	  makeRequest(url, onSendRunZoneStopCmdDone);	
}

function onSendRunZoneStopCmdDone(data) {
	  if (!data.match(/OK/)) {
		    alert("Problem stopping zone: " + data);
	  }
	}

/*----------------------------------------------------------------------------*/
/**
 * @fn getServerLogData
 * @brief Sent request for a range of conditions and runtimes data 
 * (fromDate -> toDate) from the server
 */
/*----------------------------------------------------------------------------*/

function getServerLogData(_fromDate, _toDate) {
  dateRange = "from=" + DateString(_fromDate) + "&to=" + DateString(_toDate);
  url = "http://" + server_ip + "/conditions?" + dateRange;
  makeRequest(url, processConditionsResponse);

  url = "http://" + server_ip + "/runtimes?" + dateRange;
  makeRequest(url, processRuntimesResponse);
}

// Process the conditions response and populate corresponding values in g global.
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
  log("processConditionsResponse:");
  log(JSON.stringify(g.iconHistory, null, 2));
  log(JSON.stringify(g.tempHistory, null, 2));
  log(JSON.stringify(g.precipHistory, null, 2));
}

//Process the runtimes response and populate corresponding values in g global.
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
  log("processRuntimesResponse:");
  log(JSON.stringify(g.runtimeHistory, null, 2));
}

/*----------------------------------------------------------------------------*/
/**
 * @fn makeRequest
 * @brief Make an AJAX request
 */
/*----------------------------------------------------------------------------*/

function makeRequest(url, callback) {

  log("Sending request for " + url);

  $.ajaxSetup({
	  async: false,
      cache: true,
      timeout: 5000,
      success: callback,
  });
  $.get(url, function(data) {
    callback(data);
  }, "text");
}

/*----------------------------------------------------------------------------*/
/**
 * @fn postSave
 * @brief Send a POST with the conf file to the server.
 */
/*----------------------------------------------------------------------------*/

function postSave() {
  var postUrl = "http://" + server_ip + "/setconfig";
  var str;

  log("Posting to " + postUrl);

  $.ajaxSetup({
      cache: false,
      timeout: 1000,
      error: saveToServerError
  });

  str = JSON.stringify(g.globalConf);
  writeStatus(str);

  $.post(postUrl, str, function(data) {
    postDone(data);
  });

}

/*----------------------------------------------------------------------------*/
/**
 * @fn postDone
 * @brief Handler for POST complete callback.
 */
/*----------------------------------------------------------------------------*/

function postDone(data) {
  if (data.match(/OK/)) {
	    alert("Config saved.");
  } else {
	    alert("Problem saving configuration: " + data);
  }
}

// Hander for save conf file POST error.
function saveToServerError() {
  alert("Problem saving configuration! Server error.");
}

