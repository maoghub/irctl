window.onload = initAll()
var logStr = ""

function initAll() {
  confStr = '{"GlobalConfig":{"RunTimeAM":"0000-01-01T09:00:00Z","RunTimePM":"0000-01-01T16:00:00Z","AirportCode":"KSJC"},"ZoneConfigs":{"0":{"Name":"zone 0","Number":0,"Enabled":true,"GetsRain":true,"SoilConfig":{"Name":"Loam","MaxVWC":40},"MaxVWC":20,"MinVWC":10,"RunTimeMultiplier":1,"ZoneETRate":1,"DepthIn":8},"1":{"Name":"zone 1","Number":1,"Enabled":true,"GetsRain":false,"SoilConfig":{"Name":"Clay","MaxVWC":50},"MaxVWC":21,"MinVWC":11,"RunTimeMultiplier":2,"ZoneETRate":2,"DepthIn":9},"2":{"Name":"zone 2","Number":2,"Enabled":false,"GetsRain":true,"SoilConfig":{"Name":"Sandy Loam","MaxVWC":30},"MaxVWC":22,"MinVWC":12,"RunTimeMultiplier":3,"ZoneETRate":3,"DepthIn":11}},"ETAlgorithmSimpleConfig":{"EtPctMap":{"R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},"SoilConfigMap":{"Clay":{"Name":"Clay","MaxVWC":50},"Loam":{"Name":"Loam","MaxVWC":40},"Sandy Loam":{"Name":"Sandy Loam","MaxVWC":30}}}';
  err = parseConf(confStr);
  if (err) {
    emsg = err.message;
  }
}

function parseConf(confStr) {
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

    // "MaxVWC":20,"MinVWC":10,"RunTimeMultiplier":1,"ZoneETRate":1,"DepthIn":8}
    setDiv('.ZONE[data-object_name="name"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "Name"));
    //$('.ZONE[data-object_name="run"][data-array-index="' + num + '"]').attr('checked', getPathOrLogErr(zconf, "Enabled" ? "checked" : ""));
    //$('.ZONE[data-object_name="rain"][data-array-index="' + num + '"]').attr('checked', getPathOrLogErr(zconf, "GetsRain" ? "checked" : ""));
    setDiv('.ZONE[data-object_name="soil_name"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "SoilConfig.Name"));
    setDiv('.ZONE[data-object_name="min_moist_pct"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "MinVWC"));
    setDiv('.ZONE[data-object_name="max_moist_pct"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "MaxVWC"));
    setDiv('.ZONE[data-object_name="run_time_mult"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "RunTimeMultiplier"));
    setDiv('.ZONE[data-object_name="root_depth"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "DepthIn"));
    setDiv('.ZONE[data-object_name="et_rate"][data-array-index="' + num + '"]', getPathOrLogErr(zconf, "ZoneETRate"));

  }
}

//"ETAlgorithmSimpleConfig":{"EtPctMap":{
//  "R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},

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

function getPathOrLogErr(tree, path) {
  ret = getPathValue(tree, path);
  if (ret.err) {
    log(err)
    return ""
  }
  return ret.val
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
