
///////////////////////// Member functions //////////////////////////////////////////////////////////////////////



///////////////////////// Utility functions //////////////////////////////////////////////////////////////////////////

function changeToDate(_newToDate)
{
    toDate = _newToDate;

    if (!haveLogsForDate(toDate) || !haveLogsForDate(fromDate()))
    {
	if (!haveLogsForDate(dateAddDays(toDate,1)))
	{
	    getServerLogData(dateAddDays(toDate,1), dateAddDays(toDate,31))
	}
    }
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     haveLogsForDate
 *
 * @brief  Logs are available for the given date
 */
/*-------------------------------------------------------------------------------------------------------------*/

function haveLogsForDate(_date)
{
    return (_date >= startHistory && _date <= endHistory);
}

/*-------------------------------------------------------------------------------------------------------------*/
/**
 * @fn     setNeedSaveState
 *
 * @brief  If any params change, raise the flag to need save state.
 */
/*-------------------------------------------------------------------------------------------------------------*/

/*function setNeedSaveState(val)
{
	needSave = 1;
	$("#save_button").attr("disabled", needSave==1?"":"disabled");
	$("#cancel_button").attr("disabled", needSave==1?"":"disabled");
}*/

