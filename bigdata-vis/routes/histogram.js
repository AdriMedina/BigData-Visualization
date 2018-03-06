var fs = require('fs');
var d3 = require('d3');
var jsdom = require('jsdom');
var doc = jsdom.jsdom();
var express = require('express');
var util = require('util');
var cmd = require('node-cmd');
var mongoose = require('mongoose');
var assert = require('assert');
var crypto = require('crypto');
var defaultValues = require('./defaultValues');
var config = require('./config');

var router = express.Router();

/* GET histogram page. */
router.get('/histogram', function(req, res) {


    /** Starts the timer to know how long it takes to execute the request
     *
     */
    console.time('histogram');


    /** Get parameters
     * 
     * @param file Path to file
     * @param col The column selected for the histogram
     * @param sections Number of histogram bars
     *
     */
    var file = req.query.file;
    var col = req.query.col;
    var sections = req.query.sections || defaultValues.histogram.sections;
    var sizeFile = req.query.sizeFile;


    /** Init id_plot and create status in Mongo database
     *
     */
    var mongodbURL = config.mongo.connection;
    mongodbURL = mongodbURL.concat(config.mongo.port, "/");
    var mongodbURLDatabase = mongodbURL.concat(config.mongo.database);
    mongoose.Promise = global.Promise;
    var option = {
        server: {
            socketOptions: {
                keepAlive: 300000,
                connectTimeoutMS: 30000
            }
        },
        replset: {
            socketOptions: {
                keepAlive: 300000,
                connectTimeoutMS: 30000
            }
        }
    };
    var db = mongoose.createConnection(mongodbURLDatabase, option);


    /* Insert the status of the graph in MongoDB
     *
     */
    var fileMD5 = crypto.createHash('md5').update(file).digest('hex');
    var sizMD5 = crypto.createHash('md5').update(sizeFile.toString()).digest('hex');
    var plotMD5 = crypto.createHash('md5').update('histogram').digest('hex');
    var auxParamMD5 = col.concat(";", sections);
    var paramMD5 = crypto.createHash('md5').update(auxParamMD5).digest('hex');
    var idPlot = fileMD5 + sizMD5 + plotMD5 + paramMD5;

    var statusSchema = new mongoose.Schema({
        id_plot: String,
        status: String,
        date_start: Date,
        date_end: Date
    });
    var MongoStatus = db.model('Status', statusSchema, config.mongo.collectionStatus);

    function sleep(time, callback) {
        var stop = new Date().getTime();
        while (new Date().getTime() < stop + time) {}
        callback();
    }

    MongoStatus.find({
        "id_plot": idPlot
    }, function(err, statusFinded) {
        if (err) return console.error(err);

        if (statusFinded.length != 0) { // If it was previously loaded

            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (statusFinded[0].status == "run") {
                function isLoadedData(fin) {
                    if (!fin) {
                        sleep(2000, function() {});
                        Result.find({
                            "id_plot": idPlot
                        }, function(err, dataMongo) {
                            if (dataMongo.length === 0) {
                                isLoadedData(false);
                            } else {
                                isLoadedData(true);
                            }
                        });
                    } else {
                        Result.find({
                            "id_plot": idPlot
                        }, function(err, dataMongo) {
                            if (err) return console.error(err);
                            res.send(get_histogram(JSON.stringify(dataMongo[0])).node().outerHTML);
                            db.close(function() {
                                //console.log('Mongoose connection disconnected');
                            });
                            delete db.models['Result'];
                        });
                    }
                }

                isLoadedData(false);

            } else {
                Result.find({
                    "id_plot": idPlot
                }, function(err, dataMongo) {
                    if (err) return console.error(err);
                    res.send(get_histogram(JSON.stringify(dataMongo[0])).node().outerHTML);
                    db.close(function() {
                        //console.log('Mongoose connection disconnected');
                    });
                    delete db.models['Result'];
                });
            }

        } else { // If it was not previously loaded
            var data = [{
                'id_plot': idPlot,
                'status': 'run',
                'date_start': new Date(),
                'date_end': new Date()
            }];


            MongoStatus.collection.insertMany(data, function(err, r) {
                assert.equal(null, err);
                assert.equal(1, r.insertedCount);
            });

            /** Launch spark-submit to generate JSON data for histogram
             * 
             */
            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (config.api.exec_mode == "systemcall") {
                var submit = config.api.submitSpark;
                submit = submit.concat(defaultValues.histogram.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" ', ' "', col, '" ', sections, " ", '"', idPlot, '" ');

                cmd.run(submit);

                function getResultAndSend(fin) {
                    if (!fin) {
                        sleep(2000, function() {});
                        Result.find({
                            "id_plot": idPlot
                        }, function(err, dataMongo) {
                            if (dataMongo.length === 0) {
                                getResultAndSend(false);
                            } else {
                                getResultAndSend(true);
                            }
                        });
                    } else {
                        Result.find({
                            "id_plot": idPlot
                        }, function(err, dataMongo) {
                            res.send(get_histogram(JSON.stringify(dataMongo[0])).node().outerHTML);
                            db.close(function() {
                                //console.log('Mongoose connection disconnected');
                            });
                            delete db.models['Result'];
                        });

                        /* Update the status of the graph in MongoDB
                         *
                         */
                        MongoStatus.update({
                                'id_plot': idPlot
                            }, {
                                status: 'finish',
                                date_end: new Date()
                            },
                            function(err, dataNum) {
                                // Get err
                            }
                        );

                        /** Ends the timer to know how long it took to execute the request
                         *
                         */
                        var access = fs.createWriteStream('./graphicRegister/histogram.time.log', {
                            flags: 'a',
                            autoClose: true
                        });
                        process.stdout.write = process.stderr.write = access.write.bind(access);
                        console.timeEnd('histogram');
                        console.log('File: ' + file);
                        console.log('Column: ' + col);
                        console.log('Sections: ' + sections);
                        console.log('Size: ' + sizeFile);
                        console.log('');
                    }
                }

                getResultAndSend(false);

                // cmd.get(
                //   submit,
                //   function(data, err, stderr){
                //     if (!err){
                //       Result.find({"id_plot" : idPlot}, function(err, dataMongo){
                //         if (err) return console.error(err);
                //         if(dataMongo.length === 1){
                //           res.send(get_histogram(JSON.stringify(dataMongo[0])).node().outerHTML);
                //         }else{
                //           res.send("Data could not be recovered. Try it again later, please.");
                //         }
                //         db.close(function () {
                //           //console.log('Mongoose connection disconnected');
                //         });
                //         delete db.models['Result'];
                //       });   

                //       /* Update the status of the graph in MongoDB
                //       *
                //       */
                //       MongoStatus.update({'id_plot' : idPlot},
                //         {status : 'finish', date_end: new Date()},
                //         function(err, dataNum){
                //           // Get err
                //         }
                //       );

                //       /** Ends the timer to know how long it took to execute the request
                //       *
                //       */
                //       var access = fs.createWriteStream('./graphicRegister/histogram.time.log', { flags: 'a', autoClose: true });
                //       process.stdout.write = process.stderr.write = access.write.bind(access);
                //       console.timeEnd('histogram');
                //       console.log('File: ' + file);
                //       console.log('Column: ' + col);
                //       console.log('Sections: ' + sections);
                //       console.log('Size: ' + sizeFile);
                //       console.log('');

                //     }else{
                //       res.send(err);
                //     }
                //   }
                // );

            } else {}
        }
    });
});



function get_histogram(dataJSON) {

    // Procesamos los datos para que tenga una mejor forma de uso para D3js
    var json = JSON.parse(dataJSON);

    var maxBin = json.values.segments[json.values.segments.length - 1].max;
    var minBin = json.values.segments[0].min;

    var title = json.values.type;
    var data = [];
    var binTicks = [];
    for (var i = 0; i < json.values.segments.length; i++) {
        data.push({
            "x": json.values.segments[i].min,
            "y": json.values.segments[i].count
        });
        binTicks.push(json.values.segments[i].min);
    }
    binTicks.push(json.values.segments[json.values.segments.length - 1].max);


    // Dibujamos el histograma
    var formatCount = d3.format(",.0f");
    var margin = {
            top: 40,
            right: 100,
            bottom: 70,
            left: 80
        },
        width = 800 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;


    // add the SVG element
    /*var svgContainer = d3.select(doc.body).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    var svg = svgContainer.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");*/


    // add the SVG element
    var svgContainer = d3.select(doc.body)
        .append("div")
        .classed("svg-container", true)
        .append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "-200 -40 1024 768")
        .classed("svg-content-responsive", true);

    var svg = svgContainer;


    var x = d3.scale.linear()
        .domain([minBin, maxBin])
        .range([0, width]);
    var binWidth = parseFloat(width / (binTicks.length - 1)) - 1;
    var y = d3.scale.linear()
        .domain([0, d3.max(data, function(d) {
            return d.y;
        })])
        .range([height, 0]);


    // define the axis
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickValues(binTicks);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");


    // Add bar chart
    svg.selectAll("bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", function(d) {
            return x(d.x);
        })
        .attr("width", binWidth)
        .attr("y", function(d) {
            return y(d.y);
        })
        .attr("height", function(d) {
            return height - y(d.y);
        });

    // Add bar chart labels
    /*svg.selectAll("text")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "text-bar")
      .text(function(d) { return d.y; })
      .attr("x", function(d) { return x(d.x) + binWidth/2; })
      .attr("y", function(d) { return y(d.y) + 20; })
      .style("fill", "steelblue")
      .style("text-anchor", "middle")
      .style("font-size", "16px");*/


    // add axis
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .style("font-size", "12px")
        .call(xAxis)

    svg.append("g")
        .attr("class", "y axis")
        .style("font-size", "12px")
        .call(yAxis)

    // Add axis labels
    svg.append("text")
        .attr("class", "x label")
        .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.bottom - 15) + ")")
        //.attr("dy", "1em")
        .attr("text-anchor", "middle")
        .text("Segments");

    svg.append("text")
        .attr("class", "y label")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("text-anchor", "middle")
        .text("Count");

    // Add title to chart
    svg.append("text")
        .attr("class", "title")
        .attr("transform", "translate(" + (width / 2) + " ," + (-20) + ")")
        //.attr("dy", "1em")
        .attr("text-anchor", "middle")
        .text(title.toUpperCase());

    return svgContainer;
}


module.exports = router;