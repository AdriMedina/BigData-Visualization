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


/* GET linechart page. */
router.get('/linechart', function(req, res) {

    /** Starts the timer to know how long it takes to execute the request
     *
     */
    console.time('linechart');


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
    var plotMD5 = crypto.createHash('md5').update('linechart').digest('hex');
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
                            res.send(get_linechart(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                    res.send(get_linechart(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                            res.send(get_linechart(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                        var access = fs.createWriteStream('./graphicRegister/linechart.time.log', {
                            flags: 'a',
                            autoClose: true
                        });
                        process.stdout.write = process.stderr.write = access.write.bind(access);
                        console.timeEnd('linechart');
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
                //                  res.send(get_linechart(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                //            var access = fs.createWriteStream('./graphicRegister/linechart.time.log', { flags: 'a', autoClose: true });
                //            process.stdout.write = process.stderr.write = access.write.bind(access);
                //            console.timeEnd('linechart');
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


function get_linechart(dataJSON) {

    var json = JSON.parse(dataJSON);

    // Set the dimensions of the canvas / graph
    var margin = {
            top: 40,
            right: 100,
            bottom: 70,
            left: 80
        },
        width = 800 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

    var colors = d3.scale.category20();

    // Set the ranges
    var minValueY = json.listLines[0].lvalues[0].pointY;
    var maxValueY = json.listLines[0].lvalues[0].pointY;

    json.listLines.forEach(function(lineValues) {
        lineValues.lvalues.forEach(function(values) {
            minValueY = Math.min(minValueY, values.pointY);
            maxValueY = Math.max(maxValueY, values.pointY);
        });
    });

    // Scale the range of the data
    var x = d3.scale.linear().domain([d3.min(json.listLines[0].lvalues, function(d) {
        return d.pointXMin;
    }), d3.max(json.listLines[0].lvalues, function(d) {
        return d.pointXMin;
    })]).range([0, width]);
    var y = d3.scale.linear().domain([minValueY, maxValueY]).range([height, 0]);

    // Define the axes
    var xAxis = d3.svg.axis().scale(x)
        .orient("bottom");

    var yAxis = d3.svg.axis().scale(y)
        .orient("left");

    // Define the line
    var valueline = d3.svg.line()
        .x(function(d) {
            return x(d.pointXMin);
        })
        .y(function(d) {
            return y(d.pointY);
        });


    var svgContainer = d3.select(doc.body)
        .append("div")
        .classed("svg-container", true)
        .append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "-200 -40 1024 768")
        .classed("svg-content-responsive", true);

    var svg = svgContainer;





    json.listLines.forEach(function(lineValues, index) {

        // Add the valueline path.
        svg.append("path")
            .attr("class", "line")
            .attr("d", valueline(lineValues.lvalues))
            .style('fill', 'none')
            .style('stroke-width', '2px')
            .style("stroke", function(d, i) {
                return colors(index);
            });

        svg.append("text")
            .attr("transform", "translate(" + x(lineValues.lvalues[lineValues.lvalues.length - 1].pointXMin) + "," + y(lineValues.lvalues[lineValues.lvalues.length - 1].pointY) + ")")
            .attr("x", 3)
            .attr("dy", "0.35em")
            .style("font", "14px sans-serif")
            .text(lineValues.titleLine);

    });

    // Add the X Axis
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    // Add the Y Axis
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis);

    return svgContainer;

}

module.exports = router;