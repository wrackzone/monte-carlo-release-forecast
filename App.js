Ext.define("ForecastCalculator", function() {

    var self;

    return {

        extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

        config : {
            series : [],
        },

        constructor:function(config) {
            self = this;
            this.initConfig(config);
            return this;
        },

 		getMetrics: function () {

 			return [
 				{ field : "LeafStoryCount", as : "CountScope", f : "sum" },
 				{ field : "AcceptedLeafStoryCount", as : "CountAccepted", f : "sum" },
 				{ field : "LeafStoryPlanEstimateTotal", as : "PointsScope", f : "sum" },
 				{ field : "AcceptedLeafStoryPlanEstimateTotal", as : "PointsAccepted", f : "sum" }
 			]
        },

        getDerivedFieldsOnInput : function () {
            return [];
        },

        getDerivedFieldsAfterSummary : function () {
            return [];
        }
    }
});


Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
    componentCls: 'app',

    scopeType: 'release',

    samples : 1000,
    projectionSeries : 'PointsAccepted',
    scopeSeries : 'PointsScope',

    settingsScope: 'project',
    config: {
      defaultSettings: {
        // includeBefore: 0,
        // includeAfter: 0,
        // costPerPoint: 200,
        // truncateStringLength: 20,
        // rotateLabels: false
      }
    },

    featureFetchFields : ["_ValidFrom","_ValidTo","ObjectID","FormattedID","AcceptedLeafStoryCount","AcceptedLeafStoryPlanEstimateTotal","LeafStoryCount","LeafStoryPlanEstimateTotal"],

  // 	launch : function() {

  //   	var me = this;

  //       var timeBox = {
  //           ReleaseStartDate: "2015-04-13T06:00:00.000Z",
  //           ReleaseDate : "2015-07-20T05:59:59.000Z"
  //       };

  //   	// for testing
		// me._fetchData("PortfolioItem/Feature",["ObjectID"],{property:"Release.Name",operator:"=",value:"2015 Q2"}).then({
		// 	scope : me,
		// 	success : function(records) {
		// 		console.log("records",records);
		// 		me._loadSnapshots(records,timeBox);
		// 	},
  //           failure : function(error) {
  //               console.log("error",error);
  //           }
		// });
  //   },

    _loadSnapshots : function ( features, timeBox ) {

    	var me = this;

    	var cPromises = _.map(features, function(feature,i) {
            var deferred = Ext.create('Deft.Deferred');
            me.getSnapshots(
                feature, timeBox
            ).then({
                scope : me,
                success : function(snapshots) {
                    deferred.resolve(snapshots);
                }
            });
            return deferred;
        });

        Deft.Promise.all(cPromises).then( {
            scope : me,
            success : function(all) {
                console.log("all",all);
                me._createForecast(all, timeBox);
            }
        });
    },

    _createForecast : function( featureSnapshots,timeBox ) {

    	var me = this;

    	var lumenize = window.parent.Rally.data.lookback.Lumenize;
    	console.log("lumenize",lumenize);

    	var myCalc = Ext.create("ForecastCalculator", {
            series : []
        });

        // calculator config
        var config = {
            deriveFieldsOnInput: myCalc.getDerivedFieldsOnInput(),
            metrics: myCalc.getMetrics(),
            summaryMetricsConfig: [],
            deriveFieldsAfterSummary: myCalc.getDerivedFieldsAfterSummary(),
            granularity: lumenize.Time.DAY,
            tz: 'America/Chicago',
            holidays: [],
            workDays: 'Monday,Tuesday,Wednesday,Thursday,Friday'
        };
        console.log("config",config);
        // release start and end dates
        // var startOnISOString = new lumenize.Time(timeBox.ReleaseStartDate).getISOStringInTZ(config.tz);
        // var upToDateISOString = new lumenize.Time(timeBox.ReleaseDate).getISOStringInTZ(config.tz);

        // create the calculator and add snapshots to it.
        
        calculator = new lumenize.TimeSeriesCalculator(config);
        //calculator.addSnapshots(_.flatten(featureSnapshots), startOnISOString, upToDateISOString);
        calculator.addSnapshots(_.flatten(featureSnapshots), timeBox.ReleaseStartDate, timeBox.ReleaseDate);

        console.log("calculator",calculator.getResults());

        var data = _.map( calculator.getResults().seriesData, function(series) { return series[me.projectionSeries] }); 
        var categories = _.map( calculator.getResults().seriesData, function(series) { return series["label"] }); 

        console.log("data",data);

        var index = _.findIndex( categories,function(cat) {
        	return cat === moment().format("YYYY-MM-DD");
        });

        console.log("index",index,categories[index])

        var size = data.length-index;

        data = _.first(data,index+1);
        var scope = _.map( calculator.getResults().seriesData,function(series) { return series[me.scopeSeries]});

        var projections = [];
        var bounds = me._createVarianceBounds(data);

        for (var i = 0; i < me.samples; i++) {
        	// null fill existing data
        	var projection = me._createMonteCarloProjection(data,size,bounds)
        	projections.push(projection);
        }

		me.addChart( me._createChartData(categories,data,scope,projections));

    },

    addChart : function(data) {

        var that = this;

        if (!_.isUndefined(that.chart)) {
            that.remove(that.chart);
        }

        that.chart = Ext.create('Rally.technicalservices.monteCarloChart', {
            itemId: 'rally-chart',
            chartData: data,
        });

        // console.log(that.chart);
        that.add(that.chart);

    },

    _createChartData : function( categories, data, scope, projections ) {

    	var me = this;

        var chartData = {
        	categories : categories,
        	series : [{ name : me.projectionSeries, data : data},{name: me.scopeSeries, data : scope}]
        };

        // add the highest and lowest projection, then the first 50 projections.
        var samples = [];
        samples.push(_.min(projections,function(p) { return _.last(p);}));
        samples.push(_.max(projections,function(p) { return _.last(p);}));
        samples = samples.concat(_.first(projections,50));

        chartData.series = chartData.series.concat(
        	_.map( samples, function(p,i) { 
        		return {
        			name : 'projection ' + i,
        			data : p,
        			color : '#F5F5F5',
                    marker : { enabled : false },
                    showInLegend : false,
                    zIndex : -1
        		};
        	})
        );

        // add the percentiles
        var results = _.map(projections,function(p) {
            return _.last(p);
        });

        console.log(_.map([0.25,0.5,0.75],function(p){
            return results.percentile(p);
        }));

        var groups = _.groupBy(results,function(result){ return Math.round(result / 10) * 10;   });
        console.log("groups",groups);
        // console.log(_.map(_.keys(groups,function(key) { return [key,groups[key].length] })));
        var values = _.map( _.keys(groups),function(key){ return groups[key].length});

		var pValues = [0.85]
        var pcts = _.map(pValues,function(p) { 
            return results.percentile(p);
        });

        var lpcts = _.map([0.1,0.25,0.5,0.85,0.99],function(p) { 
            return values.percentile(p);
        });

        console.log("lpcts",lpcts);

        chartData.plotLines = _.map(pcts,function(p,i){
            return {
                color: '#C8C8C8 ',
                width:2,
                zIndex:4,
                label:{text:''+(pValues[i]*100)+'% = '+p},
                dashStyle: 'dot', // Style of the plot line. Default to solid
                value: p, // Value of where the line will appear
            }
        });

        return chartData;
    },

    _createVarianceBounds : function( data ) {

    	var diff = _.max(data) - _.min(data);
    	console.log("diff",diff);
    	diff = Math.floor(diff+1);

    	 var variances = _.compact(_.map(data,function(d,i) {
        	if (i<data.length-1)
        		return data[i+1] - d;
        	else
        		return null;
        }));

        console.log("variances",variances,variances.stdDev(),variances.median());
        // var lower = _.min(variances),upper = _.max(variances); // Math.floor(variances.stdDev()+1); // _.max(variances);
        var lower = 0;
        var upper = variances.median() + variances.stdDev();
        console.log(lower,upper);
        // return { lower : lower, upper : upper };
        return { lower : lower, upper : upper };

    },

    _createMonteCarloProjection : function( data, size, bounds ) {
    	// null fill existing data
    	var projection = _.map(data,function(d){ return null; });
    	var start = _.last(data);
    	for (x = 0; x < size; x++) {
    		start = start + Math.floor((Math.random() * bounds.upper) + bounds.lower);
    		projection.push(start);
    	}
    	return projection;
    },

    getSnapshots : function(feature, timeBox) {

		var me = this;
        var query = Ext.merge({
            'ObjectID' : feature.get("ObjectID"),
            "$or" : [
                    {"_ValidTo": "9999-01-01T00:00:00.000Z"},
                    {"_ValidTo" : { "$gte" : timeBox.ReleaseStartDate } }    
                ],
        }, {});

        var deferred = new Deft.Deferred();

        Ext.create('Rally.data.lookback.SnapshotStore', {
            autoLoad : true,
            limit: Infinity,
            listeners: {
                refresh: function(store) {
                    //Extract the raw snapshot data...
                    var snapshots = [];
                    for (var i = 0, ii = store.getTotalCount(); i < ii; ++i) {
                        snapshots.push(store.getAt(i).data);
                    }
                    deferred.resolve(snapshots);
                }
            },
            fetch: me.featureFetchFields,
            // hydrate : [that.field],
            find: query,
            // sort: { "_ValidFrom": 1 }
        });
        return deferred.getPromise();
    },

    onScopeChange: function (scope) {

      	var me = this;

      	console.log(scope.getRecord());

      	console.log( scope.getQueryFilter().toString());

		me._fetchData("PortfolioItem/Feature",["ObjectID"],scope.getQueryFilter()).then({
			scope : me,
			success : function(records) {
				console.log("records",records);
				me._loadSnapshots(records,scope.getRecord().raw);
			},
            failure : function(error) {
                console.log("error",error);
            }
		});

    },

    _fetchData: function(modelType, fetchFields, filters){
        // this.logger.log('_fetchData',modelType, fetchFields, filters);
        var deferred = Ext.create('Deft.Deferred'),
            store = Ext.create('Rally.data.wsapi.Store',{
                model: modelType,
                limit: 'Infinity',
                fetch: fetchFields,
                filters: filters,
                context: {
                    workspace: this.getContext().getWorkspace()._ref,
                    project: this.getContext().getProjectRef(),
                    projectScopeDown: this.getContext().getProjectScopeDown(),
                    projectScopeUp: false
                }
            });

        store.load({
            scope: this,
            callback: function(records, operation, success){
                if (success){
                    deferred.resolve(records);
                } else {
                    deferred.reject(operation);
                }
            }
        });
        return deferred;
    },



});