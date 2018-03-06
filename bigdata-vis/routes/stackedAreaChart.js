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

/* GET stackedAreaChart page. */
router.get('/stackedAreaChart', function(req, res) {

    /** Starts the timer to know how long it takes to execute the request
     *
     */
    console.time('stackedAreaChart');


    /** Get parameters
     * 
     * @param file Path to file
     * @param sec number of sections to divide the data
     * @param colX column for x-axis
     * @param count Number of column selected
     * @param col Array with column name selected
     *
     */
    var file = req.query.file;
    var sec = req.query.sec;
    var colX = req.query.colX;
    var count = req.query.count || defaultValues.linechart.count;
    var arrayCol = req.query.col;
    var stringCol = ""
    for (var i = 0; i < count; i++) {
        stringCol = stringCol.concat(' "', arrayCol[i], '"');
    }
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
    var plotMD5 = crypto.createHash('md5').update('stackedAreaChart').digest('hex');
    var auxParamMD5 = colX.concat(";", sec, ";", count, ";", stringCol);
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
                            res.send(get_stackedAreaChart(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                    res.send(get_stackedAreaChart(JSON.stringify(dataMongo[0])).node().outerHTML);
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


            /** Launch spark-submit to generate JSON data for scatterplot
             * 
             */
            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (config.api.exec_mode == "systemcall") {

                var submit = config.api.submitSpark;
                submit = submit.concat(defaultValues.linechart.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" ', ' "', idPlot, '" ', sec, " ", '"', colX, '" ', count, stringCol);
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
                            res.send(get_stackedAreaChart(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                        }, function(err, dataNum) {
                            // Get err
                        });
                        /** Ends the timer to know how long it took to execute the request
                         *
                         */
                        var access = fs.createWriteStream('./graphicRegister/stackedAreaChart.time.log', {
                            flags: 'a',
                            autoClose: true
                        });
                        process.stdout.write = process.stderr.write = access.write.bind(access);
                        console.timeEnd('stackedAreaChart');
                        console.log('File: ' + file);
                        console.log('Sec: ' + sec);
                        console.log('ColX: ' + colX);
                        console.log('CountCols: ' + count);
                        console.log('Columns: ' + stringCol);
                        console.log('Size: ' + sizeFile);
                        console.log('');
                    }
                }

                getResultAndSend(false);


                //    cmd.get(
                //  submit,
                //    function(data, err, stderr){
                //      if (!err){
                //        Result.find({"id_plot" : idPlot}, function(err, dataMongo){
                //            if (err) return console.error(err);
                //                if(dataMongo.length === 1){
                //                  res.send(get_stackedAreaChart(JSON.stringify(dataMongo[0])).node().outerHTML);
                //                }else{
                //                  res.send("Data could not be recovered. Try it again later, please.");
                //                }
                //            db.close(function () {
                //                console.log('Mongoose connection disconnected');
                //            });
                //            delete db.models['Result'];
                //          });
                //        /* Update the status of the graph in MongoDB
                //       *
                //       */
                //       MongoStatus.update({'id_plot' : idPlot},
                //         {status : 'finish', date_end: new Date()},
                //         function(err, dataNum){
                //           // Get err
                //         }
                //       );
                //            /** Ends the timer to know how long it took to execute the request
                //            *
                //            */
                //            var access = fs.createWriteStream('./graphicRegister/stackedAreaChart.time.log', { flags: 'a', autoClose: true });
                //            process.stdout.write = process.stderr.write = access.write.bind(access);
                //            console.timeEnd('stackedAreaChart');
                //            console.log('File: ' + file);
                //            console.log('Sec: ' + sec);
                //            console.log('ColX: ' + colX);
                //            console.log('CountCols: ' + count);
                //            console.log('Columns: ' + stringCol);
                //            console.log('Size: ' + sizeFile);
                //            console.log('');
                //      }else{
                //          res.send(err);
                //      }
                //    }
                // );
            } else {}
        }
    });
});


function get_stackedAreaChart(dataJSON) {

    var json = JSON.parse(dataJSON);
    var margin = {
            top: 40,
            right: 100,
            bottom: 70,
            left: 80
        },
        width = 800 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    var formatPercent = d3.format(".0%");
    var x = d3.scale.linear().range([0, width]);
    var y = d3.scale.linear().range([height, 0]);
    var color = d3.scale.category20();
    var xAxis = d3.svg.axis().scale(x).orient("bottom");
    var yAxis = d3.svg.axis().scale(y).orient("left").tickFormat(formatPercent);

    var area = d3.svg.area().x(function(d) {
        return x(d.colX);
    }).y0(function(d) {
        return y(d.y0);
    }).y1(function(d) {
        return y(d.y0 + d.y);
    });
    var stack = d3.layout.stack().values(function(d) {
        return d.values;
    });

    var svgContainer = d3.select(doc.body).append("div").classed("svg-container", true).append("svg").attr("preserveAspectRatio", "xMinYMin meet").attr("viewBox", "-200 -40 1024 768").classed("svg-content-responsive", true);
    var svg = svgContainer;

    var minValueY = json.listLines[0].lvalues[0].pointXMin;
    var maxValueY = json.listLines[0].lvalues[0].pointXMax;

    json.listLines.forEach(function(lineValues) {
        lineValues.lvalues.forEach(function(values) {
            minValueY = Math.min(minValueY, values.pointY);
            maxValueY = Math.max(maxValueY, values.pointY);
        });
    });

    // Scale the range of the data
    x.domain([d3.min(json.listLines[0].lvalues, function(d) {
        return d.pointXMin;
    }), d3.max(json.listLines[0].lvalues, function(d) {
        return d.pointXMin;
    })]);
    color.domain(json.listLines.length);

    var auxArray = new Array();
    var sumAux = 0;
    for (var i = 0; i < json.listLines[0].lvalues.length; i++) {
        for (var j = 0; j < json.listLines.length; j++) {
            sumAux += Math.abs(json.listLines[j].lvalues[i].pointY);
        }
        auxArray.push(sumAux);
        sumAux = 0;
    }
    var browsers = stack(json.listLines.map(function(lineValues) {
        return {
            name: lineValues.titleLine,
            values: lineValues.lvalues.map(function(v, i) {
                return {
                    colX: v.pointXMin,
                    y: Math.abs(v.pointY) / auxArray[i]
                };
            })
        };
    }));

    var browser = svg.selectAll(".browser").data(browsers).enter().append("g").attr("class", "browser");
    browser.append("path").attr("class", "area").attr("d", function(d) {
        return area(d.values);
    }).style("fill", function(d) {
        return color(d.name);
    });
    browser.append("text").datum(function(d) {
        return {
            name: d.name,
            value: d.values[d.values.length - 1]
        };
    }).attr("transform", function(d) {
        return "translate(" + x(d.value.colX) + "," + y(d.value.y0 + d.value.y / 2) + ")";
    }).attr("x", -6).attr("dy", ".35em").style("font", "10px sans-serif").text(function(d) {
        return d.name;
    });

    svg.append("g").attr("class", "x axis").attr("transform", "translate(0," + height + ")").call(xAxis);
    svg.append("g").attr("class", "y axis").call(yAxis);

    return svgContainer;
}

module.exports = router;