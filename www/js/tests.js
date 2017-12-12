/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     runTests
 *
 * @brief  Run all tests. 
 */
/*-------------------------------------------------------------------------------------------------------------*/

function runTests() {
	TestParseConf();
	TestProcessConditions();
	TestProcessRuntimes();
	toDate.setFullYear(2017,10,26);
	displayScheduleTable();
	displayZoneConfigTable();
}

function TestParseConf() {
	confStr = '{"GlobalConfig":{"RunTimeAM":"0000-01-01T09:00:00Z","RunTimePM":"0000-01-01T16:00:00Z","AirportCode":"KSJC"},"ZoneConfigs":{"0":{"Name":"zone 0","Number":0,"Enabled":true,"GetsRain":true,"SoilConfig":{"Name":"Loam","MaxVWC":40},"MaxVWC":20,"MinVWC":10,"RunTimeMultiplier":1,"ZoneETRate":1,"DepthIn":8},"1":{"Name":"zone 1","Number":1,"Enabled":true,"GetsRain":false,"SoilConfig":{"Name":"Clay","MaxVWC":50},"MaxVWC":21,"MinVWC":11,"RunTimeMultiplier":2,"ZoneETRate":2,"DepthIn":9},"2":{"Name":"zone 2","Number":2,"Enabled":false,"GetsRain":true,"SoilConfig":{"Name":"Sandy Loam","MaxVWC":30},"MaxVWC":22,"MinVWC":12,"RunTimeMultiplier":3,"ZoneETRate":3,"DepthIn":11}},"ETAlgorithmSimpleConfig":{"EtPctMap":{"R":[{"X1":-1e+99,"X2":50,"Y":25},{"X1":50,"X2":65,"Y":50},{"X1":65,"X2":75,"Y":75},{"X1":75,"X2":1e+99,"Y":100}]}},"SoilConfigMap":{"Clay":{"Name":"Clay","MaxVWC":50},"Loam":{"Name":"Loam","MaxVWC":40},"Sandy Loam":{"Name":"Sandy Loam","MaxVWC":30}}}';
	processConfFile(confStr);
}

function TestProcessConditions() {
	testStr = '{"Conditions":[{"Date":"2017-11-20T00:00:00Z","Icon":"clear","Temp":20,"Precip":2},{"Date":"2017-11-21T00:00:00Z","Icon":"clear","Temp":21,"Precip":2.1},{"Date":"2017-11-22T00:00:00Z","Icon":"clear","Temp":22,"Precip":2.2},{"Date":"2017-11-23T00:00:00Z","Icon":"clear","Temp":23,"Precip":2.3},{"Date":"2017-11-24T00:00:00Z","Icon":"clear","Temp":24,"Precip":2.4},{"Date":"2017-11-25T00:00:00Z","Icon":"clear","Temp":25,"Precip":2.5},{"Date":"2017-11-26T00:00:00Z","Icon":"clear","Temp":26,"Precip":2.6},{"Date":"2017-11-27T00:00:00Z","Icon":"clear","Temp":27,"Precip":2.7}],"Errors":null}'
	processConditions(testStr)
}

function TestProcessRuntimes() {
	testStr = '{"Runtimes":[{"Date":"2017-11-20T00:00:00Z","Runtimes":[20,2,3,4]},{"Date":"2017-11-21T00:00:00Z","Runtimes":[21,2,3,4]},{"Date":"2017-11-22T00:00:00Z","Runtimes":[22,2,3,4]},{"Date":"2017-11-23T00:00:00Z","Runtimes":[23,2,3,4]},{"Date":"2017-11-24T00:00:00Z","Runtimes":[24,2,3,4]},{"Date":"2017-11-25T00:00:00Z","Runtimes":[25,2,3,4]},{"Date":"2017-11-26T00:00:00Z","Runtimes":[26,2,3,4]},{"Date":"2017-11-27T00:00:00Z","Runtimes":[27,2,3,4]}],"Errors":null}'
	processRuntimes(testStr)
}

