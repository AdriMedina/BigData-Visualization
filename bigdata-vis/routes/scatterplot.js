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


/* GET scatterplot page. */
router.get('/scatterplot', function(req, res) {

    /** Starts the timer to know how long it takes to execute the request
     *
     */
    console.time('scatterplot');


    /** Get parameters
     * 
     * @param file Path to file
     * @param colx Column selected for the x-axis
     * @param coly Column selected for the y-axis
     * @param secx Number of sections to divide values for the x-axis
     * @param secy Number of sections to divide values for the y-axis
     * @param colorRan Color intensity range
     *
     */
    var file = req.query.file;
    var colx = req.query.colx;
    var coly = req.query.coly;
    var secx = req.query.secx || defaultValues.scatterplot.secx;
    var secy = req.query.secy || defaultValues.scatterplot.secy;
    var colorRan = /*req.query.colorRan ||*/ defaultValues.scatterplot.colorRan;
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
    var plotMD5 = crypto.createHash('md5').update('scatterplot').digest('hex');
    var auxParamMD5 = colx.concat(";", coly, ";", secx, ";", secy, ";", colorRan);
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
                            res.send(get_scatterplot(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                    res.send(get_scatterplot(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                submit = submit.concat(defaultValues.scatterplot.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" "', colx, '" "', coly, '" ', secx, " ", secy, " ", colorRan, " ", '"', idPlot, '" ');

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
                            res.send(get_scatterplot(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                        var access = fs.createWriteStream('./graphicRegister/scatterplot.time.log', {
                            flags: 'a',
                            autoClose: true
                        });
                        process.stdout.write = process.stderr.write = access.write.bind(access);
                        console.timeEnd('scatterplot');
                        console.log('File: ' + file);
                        console.log('ColX: ' + colx);
                        console.log('ColY: ' + coly);
                        console.log('SecX: ' + secx);
                        console.log('SecY: ' + secy);
                        console.log('Size: ' + sizeFile);
                        console.log('');
                    }
                }

                getResultAndSend(false);

                // cmd.get(
                //  submit,
                //      function(data, err, stderr){
                //      if (!err){
                //          Result.find({"id_plot" : idPlot}, function(err, dataMongo){
                //              if (err) return console.error(err);
                //                          if(dataMongo.length === 1){
                //                              res.send(get_scatterplot(JSON.stringify(dataMongo[0])).node().outerHTML);
                //                          }else{
                //                              res.send("Data could not be recovered. Try it again later, please.");
                //                          }
                //              db.close(function () {
                //                      console.log('Mongoose connection disconnected');
                //              });
                //              delete db.models['Result'];
                //              });

                //          /* Update the status of the graph in MongoDB
                //       *
                //       */
                //       MongoStatus.update({'id_plot' : idPlot},
                //         {status : 'finish', date_end: new Date()},
                //         function(err, dataNum){
                //           // Get err
                //         }
                //       );

                //       /** Ends the timer to know how long it took to execute the request
                //          *
                //          */
                //          var access = fs.createWriteStream('./graphicRegister/scatterplot.time.log', { flags: 'a', autoClose: true });
                //          process.stdout.write = process.stderr.write = access.write.bind(access);
                //          console.timeEnd('scatterplot');
                //          console.log('File: ' + file);
                //          console.log('ColX: ' + colx);
                //          console.log('ColY: ' + coly);
                //          console.log('SecX: ' + secx);
                //          console.log('SecY: ' + secy);
                //          console.log('Size: ' + sizeFile);
                //          console.log('');


                //      }else{
                //              res.send(err);
                //      }
                //      }
                // );
            } else {}
        }
    });
});


function get_scatterplot(dataJSON) {

    var json = JSON.parse(dataJSON);

    // Set svg parameters
    var margin = {
        top: 40,
        right: 100,
        bottom: 120,
        left: 80
    };
    var width = 800 - margin.left - margin.right;
    var height = 500 - margin.top - margin.bottom;

    var min = Infinity,
        max = -Infinity;

    var x = d3.scale.linear()
        .range([0, width]);

    var y = d3.scale.linear()
        .range([height, 0]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");


    var colorScale = d3.scale.linear()
        .domain([1, 2, 3, 4, 5, 6, 7, 8, 9])
        .range(["#2c7bb6", "#00a6ca", "#00ccbc", "#90eb9d", "#ffff8c", "#f9d057", "#f29e2e", "#e76818", "#d7191c"]);


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

    x.domain(d3.extent(json.values, function(d) {
        return d.pointX;
    })).nice();
    y.domain(d3.extent(json.values, function(d) {
        return d.pointY;
    })).nice();

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .append("text")
        .attr("class", "label")
        .attr("x", width)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text(json.titleX);

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(json.titleY)


    svg.selectAll(".dot")
        .data(json.values)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 3.5)
        .style("fill", function(d) {
            return colorScale(d.valueColor);
        })
        .attr("cx", function(d) {
            return x(d.pointX);
        })
        .attr("cy", function(d) {
            return y(d.pointY);
        });


    return svgContainer;
}


module.exports = router;