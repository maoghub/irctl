var zoneColors = ['#00749F', '#73C774', "#4bb2c5", "#EAA228", "#579575", "brown", "#999999"];


var zoneRunPlotArray=[];
var zoneRunPlotLabels=[];
var zoneRunPlotSeries=[];
var tptObj = new Object();
var timeSpanDays=7;
var dateTicks = [];


var zoneRunChartConfig = {

    stackSeries: true,
    captureRightClick: true,
    seriesDefaults:{
        renderer:$.jqplot.BarRenderer,
        rendererOptions: { barWidth:40, varyBarColor: true},
    },
    seriesColors:  zoneColors, 
    axes: {
	xaxis: {
	    renderer:$.jqplot.DateAxisRenderer, 
	    rendererOptions:{
		tickRenderer:$.jqplot.CanvasAxisTickRenderer},
	    tickOptions:{formatString:'%m/%d', fontSize:'12pt', fontFamily:'Tahoma', angle:0, fontWeight:'normal', fontStretch:1}
	}
    },
    axesDefaults:{useSeriesColor: true},
    highlighter:{bringSeriesToFront:true},
    

};


var zoneSeriesConfig = [
	{value: 1, show: true, runTimeArray:[], chartRunTimeSeries:{} }, 
	{value: 2, show: true, runTimeArray:[], chartRunTimeSeries:{} }, 
	{value: 3, show: true, runTimeArray:[], chartRunTimeSeries:{} },
	{value: 4, show: true, runTimeArray:[], chartRunTimeSeries:{} },
	{value: 5, show: true, runTimeArray:[], chartRunTimeSeries:{} },
	{value: 6, show: true, runTimeArray:[], chartRunTimeSeries:{} },
	{value: 7, show: true, runTimeArray:[], chartRunTimeSeries:{} },
	{value: 8, show: true, runTimeArray:[], chartRunTimeSeries:{} }
];

function formatGraphs()
{
    var i, j, znval;
    
    zoneRunPlotArray=[];
    zoneRunPlotLabels=[];
    zoneRunPlotSeries=[];

    for (z=numZones-1; z>=0; z--)
    {
	if(zoneSeriesConfig[z].show)
	{
	    zoneRunPlotArray.push(zoneSeriesConfig[z].runTimeArray);
	    zoneRunPlotSeries.push(zoneSeriesConfig[z].chartRunTimeSeries);
	}
    }

//    zoneRunChartConfig.legend.labels = zoneRunPlotLabels;
    zoneRunChartConfig.axes.xaxis.ticks = dateTicks;
    zoneRunChartConfig.series = zoneRunPlotSeries;
}		

function genRuntimeCheckboxes()
{
    var html='';

    html+='	<tbody> \r\n';

    for (z=0; z<numZones; z++)
    {
	html+='	  <tr><td style="background:'+zoneColors[z]//numZones-z-1]
	    +'"><input type="checkbox" checked="checked" class="show-run-checkbox" data-zone-num="'+z
	    +'"/></td></tr> \r\n';
    }

    html+='	</tbody> \r\n';

    $('#zone_run_chart_select_table').html(html);
    $('.show-run-checkbox').click( function() {
	var z = $(this).attr('data-zone-num');
	zoneSeriesConfig[z].show = this.checked;
	refreshGraphs();
    });
    
}

function refreshGraphs()
{
    formatGraphs();
    plot2 = $.jqplot('zone_run_chart', zoneRunPlotArray, zoneRunChartConfig );
    plot2.replot();
}

function redrawGraphs()
{
    addData();
    formatGraphs();
    
    plot2 = $.jqplot('zone_run_chart', zoneRunPlotArray, zoneRunChartConfig );
    
    genRuntimeCheckboxes();

    $('#run_totals_totals_div').hide("slide", { direction : "up" }, 10 );
    $('#run_totals_totals_div').show("slide", { direction : "up" }, 300, null );
    $('#zone_run_chart_select').hide("slide", { direction : "up" }, 10 );
    $('#zone_run_chart_select').show("slide", { direction : "up" }, 300, null );

    plot2.replot();

}

function addData()
{
    today = new Date();
    var d = new Date();
    var numSummaryDays = 60;
    var totalRunTime = [0,0,0,0,0,0,0,0];

    var endDate = new Date(today.getTime());

    while (endDate.getDay() != 6)
    {
	endDate.setDate(endDate.getDate() + 1);
    }

    for (z=0; z<numZones; z++)
    {
	zoneSeriesConfig[z].runTimeArray = [];
    }

    for (n=0; n<numSummaryDays; n++)
    {
	d.setDate(d.getDate() - 1);
	
	if (d.getDay() == 6)
	{
	    dateTicks.unshift(weekEndStr(endDate));

	    for (z=0; z<numZones; z++)
	    {
		var dayArr = [weekEndStr(endDate), totalRunTime[z]];
		zoneSeriesConfig[z].runTimeArray.unshift(dayArr);
		totalRunTime[z] = 0;
	    }

	    endDate.setTime(d.getTime());
	}
	else
	{
	    for (z=0; z<numZones; z++)
	    {
		var hashDate = numDateHashStr(z, d);
		var runTime  = parseInt(zoneRuntimeHistory[hashDate]);
		if (isNaN(runTime))
		{
		    runTime = 0;
		}
		totalRunTime[z] += runTime;
	    }
	}
    }
}

function weekEndStr (_d)
{
    var retStr = _d.getFullYear() + '-' + (_d.getMonth()+1) + '-' + _d.getDate();
    return retStr;
}
