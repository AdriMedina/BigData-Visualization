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


/* GET heatmap page. */
router.get('/heatmap', function(req, res) {

    /** Starts the timer to know how long it takes to execute the request
     *
     */
    console.time('heatmap');


    /** Get parameters
     * 
     * @param file Path to file
     * @param colx Column selected for the x-axis
     * @param coly Column selected for the y-axis
     * @param colCount Column that count values
     * @param opVal Operation to apply
     * @param colorRan Color intensity range
     *
     */
    var file = req.query.file;
    var colx = req.query.colx;
    var coly = req.query.coly;
    var colCount = req.query.colCount;
    var opVal = req.query.opVal || defaultValues.heatmap.opVal;
    var colorRan = /*req.query.colorRan ||*/ defaultValues.heatmap.colorRan;
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
    var plotMD5 = crypto.createHash('md5').update('heatmap').digest('hex');
    var auxParamMD5 = colx.concat(";", coly, ";", colCount, ";", opVal, ";", colorRan);
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
                            res.send(get_heatmap(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                    res.send(get_heatmap(JSON.stringify(dataMongo[0])).node().outerHTML);
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

            /** Launch spark-submit to generate JSON data for heatmap
             * 
             */
            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (config.api.exec_mode == "systemcall") {
                var submit = config.api.submitSpark;
                submit = submit.concat(defaultValues.heatmap.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" "', colx, '" "', coly, '" "', colCount, '" ', opVal, " ", colorRan, " ", '"', idPlot, '" ');

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
                            res.send(get_heatmap(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                        var access = fs.createWriteStream('./graphicRegister/heatmap.time.log', {
                            flags: 'a',
                            autoClose: true
                        });
                        process.stdout.write = process.stderr.write = access.write.bind(access);
                        console.timeEnd('heatmap');
                        console.log('File: ' + file);
                        console.log('ColX: ' + colx);
                        console.log('ColY: ' + coly);
                        console.log('ColCount: ' + colCount);
                        console.log('OpVal: ' + opVal);
                        console.log('Size: ' + sizeFile);
                        console.log('');
                    }
                }

                getResultAndSend(false);



                // cmd.get(
                //     submit,
                //     function(data, err, stderr){
                //         if (!err){
                //             Result.find({"id_plot" : idPlot}, function(err, dataMongo){
                //                 if (err) return console.error(err);
                //                 if(dataMongo.length === 1){
                //                     res.send(get_heatmap(JSON.stringify(dataMongo[0])).node().outerHTML);
                //                 }else{
                //                     res.send("Data could not be recovered. Try it again later, please.");
                //                 }
                //                 db.close(function () {
                //                     console.log('Mongoose connection disconnected');
                //                 });
                //                 delete db.models['Result'];
                //             });

                //             /* Update the status of the graph in MongoDB
                //             *
                //             */
                //             MongoStatus.update({'id_plot' : idPlot},
                //               {status : 'finish', date_end: new Date()},
                //               function(err, dataNum){
                //                 // Get err
                //               }
                //             );

                //             /** Ends the timer to know how long it took to execute the request
                //             *
                //             */
                //             var access = fs.createWriteStream('./graphicRegister/heatmap.time.log', { flags: 'a', autoClose: true });
                //             process.stdout.write = process.stderr.write = access.write.bind(access);
                //             console.timeEnd('heatmap');
                //             console.log('File: ' + file);
                //             console.log('ColX: ' + colx);
                //             console.log('ColY: ' + coly);
                //             console.log('ColCount: ' + colCount);
                //             console.log('OpVal: ' + opVal);
                //             console.log('Size: ' + sizeFile);
                //             console.log('');

                //         }else{
                //             res.send(err);
                //         }
                //     }
                // );


            } else {}
        }
    });
});


function get_heatmap(dataJSON) {

    var json = JSON.parse(dataJSON);

    // Set svg parameters
    var margin = {
        top: 120,
        right: 100,
        bottom: 120,
        left: 120
    };
    var width = 800 - margin.left - margin.right;
    var height = 500 - margin.top - margin.bottom;


    var itemSize = 22,
        cellSize = itemSize - 1,
        legendElementSize = cellSize;

    var formatDate = d3.time.format("%Y-%m-%d");

    var x_elements = d3.set(json.values.map(function(item) {
            return item.axisX;
        })).values(),
        y_elements = d3.set(json.values.map(function(item) {
            return item.axisY;
        })).values();

    var xScale = d3.scale.ordinal()
        .domain(x_elements)
        .rangeBands([0, x_elements.length * itemSize]);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .tickFormat(function(d) {
            return d;
        })
        .orient("top");

    var yScale = d3.scale.ordinal()
        .domain(y_elements)
        .rangeBands([0, y_elements.length * itemSize]);

    var yAxis = d3.svg.axis()
        .scale(yScale)
        .tickFormat(function(d) {
            return d;
        })
        .orient("left");

    var maxV = d3.max(json.values, function(d) {
        return d.valueCount
    });
    var minV = d3.min(json.values, function(d) {
        return d.valueCount
    });
    var deltaV = (maxV - minV) / 9;
    var arrV = [];
    var i;
    for (i = 0; i < 9; i++) {
        arrV[i] = minV + (i * deltaV);
    }


    var colors = ["#ffffd9", "#edf8b1", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#253494", "#081d58"]
    var colorScale = d3.scale.linear()
        .domain([1, 2, 3, 4, 5, 6, 7, 8, 9])
        .range(colors);

    // add the SVG element
    var svgContainer = d3.select(doc.body)
        .append("div")
        .classed("svg-container", true)
        .append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "-100 -75 1024 768")
        .classed("svg-content-responsive", true);

    var svg = svgContainer;


    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .selectAll('text')
        .attr('font-weight', 'normal');

    svg.append("g")
        .attr("class", "x axis")
        .call(xAxis)
        .selectAll('text')
        .attr('font-weight', 'normal')
        .style("text-anchor", "start")
        .attr("dx", ".8em")
        .attr("dy", ".5em")
        .attr("transform", function(d) {
            return "rotate(-65)";
        });


    var cells = svg.selectAll('rect')
        .data(json.values)
        .enter().append('g').append('rect')
        .attr('class', 'cell')
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('x', function(d) {
            return xScale(d.axisX);
        })
        .attr('y', function(d) {
            return yScale(d.axisY);
        })
        .style('fill', function(d) {
            return colorScale(d.valueColor);
        });


    var legend = svg.selectAll(".legend")
        .data(arrV);

    legend.enter().append("g")
        .attr("class", "legend");

    legend.append("rect")
        .attr("x", (width * 0.95))
        .attr("y", function(d, i) {
            return legendElementSize * i;
        })
        .attr("width", legendElementSize)
        .attr("height", legendElementSize)
        .style("fill", function(d, i) {
            return colors[i];
        });

    legend.append("text")
        .attr("class", "axis")
        .text(function(d) {
            return "≥ " + (parseFloat(d)).toFixed(2);
        })
        .attr("x", (width * 0.95) + (cellSize * 1.5))
        .attr("y", function(d, i) {
            return (legendElementSize * i) + (legendElementSize * 0.7);
        })
        .style("font-size", "12px");


    return svgContainer;
}


module.exports = router;