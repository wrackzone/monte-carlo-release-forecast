Ext.define('Rally.technicalservices.monteCarloChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.progresschart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : [],
    chartConfig: {
        // colors : ["#E0E0E0","#00a9e0","#fad200","#8dc63f"],
        legend : {
            // enabled : false
        },
        chart: {
            type: 'line',
            zoomType: 'xy',
        },
        title: {
            text: 'Release Forecast'
        },
        xAxis: {

            type: 'linear',
            title: {
                enabled : true,
                text: 'Index'
            },
            startOnTick: true,
            endOnTick: true,
            tickInterval : 7
        },
        yAxis: [
            {
                title: {
                    text: 'Points'
                }
            }
        ],

        plotOptions: {
            series: {
                marker: {
                    radius: 2
                }
            },
            scatter: {
                tooltip: {
                    // xDateFormat: '%Y-%m-%d',
                    // headerFormat: '<b>{series.name}</b><br>',
                    // pointFormat: '{point.x}<br>{point.workItem.FormattedID}:{point.workItem.Name} ({point.y})'
                }

            }
        },
    },
    constructor: function (config) {
        // var config = Ext.merge()
        // _.first(this.chartConfig.yAxis).plotLines = config.chartData.plotLines;
        // _.first(this.chartConfig.yAxis).title.text = config.chartData.granularity;
        _.first(this.chartConfig.yAxis).plotLines = config.chartData.plotLines;


        this.callParent(arguments);

        console.log("chart config",this.chartConfig);
        
        if (config.title){
            this.chartConfig.title = config.title;
        }
    }
});