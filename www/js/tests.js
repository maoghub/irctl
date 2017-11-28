/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     runTests
 *
 * @brief  Run all tests. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function runTests() {
  TestProcessRuntimes();
  TestProcessConditions();
}

function TestParseConf() {
  confStr = '{"GlobalConfig":{"RunTimeAM":"0000-01-01T09:00:00Z","RunTimePM":"0000-01-01T16:00:00Z","AirportCode":"KSJC"},"ZoneConfigs":{"0":{"Name":"zone 0","Number":0,"Enabled":true,"GetsRain":true,"SoilConfig":{"Name":"Loam","MaxVWC":40},"MaxVWC":20,"MinVWC":10,"RunTimeMultiplier":1,"ZoneETRate":1,"DepthIn":8},"1":{"Name":"zone 1","Number":1,"Enabled":true,"GetsRain":false,"SoilConfig":{"Name":"Clay","MaxVWC":50},"MaxVWC":21,"MinVWC":11,"RunTimeMultiplier":2,"ZoneETRate":2,"DepthIn":9},"2":{"Name":"zone 2","Number":2,"Enabled":false,"GetsRain":true,"SoilConfig":{"Name":"Sandy Loam","MaxVWC":30},"MaxVWC":22,"MinVWC":12,"RunTimeMultiplier":3,"ZoneETRate":3,"DepthIn":11}},"ETAlgorithmSimpleConfig":{"EtPctMap":{"R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},"SoilConfigMap":{"Clay":{"Name":"Clay","MaxVWC":50},"Loam":{"Name":"Loam","MaxVWC":40},"Sandy Loam":{"Name":"Sandy Loam","MaxVWC":30}}}';
  processConfFile(confStr);
}

function TestProcessRuntimes() {
  testStr = '[{"Date":"0001-02-03T00:00:00Z","Runtimes":[1,2,3,4]},{"Date":"0001-02-04T00:00:00Z","Runtimes":[1.1,2.1,3.1,4.1]}]'
  processRuntimes(testStr)
}

function TestProcessConditions() {
  testStr = '[{"Date":"0001-02-03T00:00:00Z","Icon":"test","Temp":42.42,"Precip":4.2},{"Date":"0001-02-04T00:00:00Z","Icon":"test2","Temp":43.43,"Precip":4.3}]'
  processConditions(testStr)
}