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

function TestProcessRuntimes() {
  testStr = '[{"Date":"0001-02-03T00:00:00Z","Runtimes":[1,2,3,4]},{"Date":"0001-02-04T00:00:00Z","Runtimes":[1.1,2.1,3.1,4.1]}]'
  processRuntimes(testStr)
}

function TestProcessConditions() {
  testStr = '[{"Date":"0001-02-03T00:00:00Z","Icon":"test","Temp":42.42,"Precip":4.2},{"Date":"0001-02-04T00:00:00Z","Icon":"test2","Temp":43.43,"Precip":4.3}]'
  processConditions(testStr)
}