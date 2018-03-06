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

/* GET boxplot page. */
router.get('/boxplot', function(req, res) {


    /** Starts the timer to know how long it takes to execute the request
     *
     */
    console.time('boxplot');


    /** Get parameters
     * 
     * @param file Path to file
     * @param col Array with column name selected
     * @param count Number of column selected
     *
     */
    var file = req.query.file;
    var count = req.query.count || defaultValues.boxplot.count;
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
    var plotMD5 = crypto.createHash('md5').update('boxplot').digest('hex');
    var auxParamMD5 = count.concat(";", stringCol);
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
        while (new Date().getTime() < stop + time) {;
        }
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
                            res.send(get_boxplot(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                    res.send(get_boxplot(JSON.stringify(dataMongo[0])).node().outerHTML);
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


            /** Launch spark-submit to generate JSON data for boxplot
             * 
             */
            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (config.api.exec_mode == "systemcall") {
                var submit = config.api.submitSpark;
                submit = submit.concat(defaultValues.boxplot.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" ', ' "', idPlot, '"', " ", count, stringCol);

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
                            res.send(get_boxplot(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                        var access = fs.createWriteStream('./graphicRegister/boxplot.time.log', {
                            flags: 'a',
                            autoClose: true
                        });
                        process.stdout.write = process.stderr.write = access.write.bind(access);
                        console.timeEnd('boxplot');
                        console.log('File: ' + file);
                        console.log('CountCols: ' + count);
                        console.log('Columns: ' + stringCol);
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
                //           res.send(get_boxplot(JSON.stringify(dataMongo[0])).node().outerHTML);
                //         }else{
                //           res.send("Data could not be recovered. Try it again later, please.");
                //         }
                //         db.close(function () {
                //           console.log('Mongoose connection disconnected');
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
                //       var access = fs.createWriteStream('./graphicRegister/boxplot.time.log', { flags: 'a', autoClose: true });
                //       process.stdout.write = process.stderr.write = access.write.bind(access);
                //       console.timeEnd('boxplot');
                //       console.log('File: ' + file);
                //       console.log('CountCols: ' + count);
                //       console.log('Columns: ' + stringCol);
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



function get_boxplot(dataJSON) {

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

    var domainXAxis = [];

    // Get min and max values
    json.boxes.forEach(function(x) {
        if (x.values.max > max) max = x.values.max;
        if (x.values.min < min) min = x.values.min;
        domainXAxis.push(x.column);
    });

    var chart = d3.box()
        .width(width)
        .height(height);

    chart.domain([min, max]);

    /*var svgContainer = d3.select(doc.body).append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("class", "box");

    var svg = svgContainer.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");*/


    // add the SVG element
    var svgContainer = d3.select(doc.body)
        .append("div")
        .classed("svg-container", true)
        .append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "-200 -40 1024 768")
        .classed("svg-content-responsive", true)
        .attr("class", "box");

    var svg = svgContainer;


    // the x-axis
    var x = d3.scale.ordinal()
        .domain(domainXAxis.map(function(d) {
            return d;
        }))
        .rangeRoundBands([0, width], 0.7, 0.3);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

    // the y-axis
    var y = d3.scale.linear()
        .domain([min, max])
        .range([height + margin.top, 0 + margin.top]);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

    // draw the boxplots  
    svg.selectAll(".box")
        .data(json.boxes)
        .enter().append("g")
        .attr("transform", function(d) {
            return "translate(" + x(d.column) + "," + margin.top + ")";
        })
        .call(chart.width(x.rangeBand()));

    // add a title
    svg.append("text")
        .attr("x", (width / 2))
        .attr("y", -10 + (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        //.style("text-decoration", "underline")  
        .text(json.title);

    // draw y axis
    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text") // and text1
        .attr("transform", "rotate(-90)")
        .attr("y", 10)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .style("font-size", "16px")
        .text("Values");

    // draw x axis  
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (height + margin.top + 10) + ")")
        .call(xAxis)
        .append("text") // text label for the x axis
        .attr("x", (width / 2))
        .attr("y", 35)
        .attr("dy", ".71em")
        .style("text-anchor", "middle")
        .style("font-size", "16px")
        .text("Columns");

    return svgContainer;
}






(function() {

    d3.box = function() {
        var width = 1,
            height = 1,
            duration = 0,
            domain = null,
            value = Number,
            tickFormat = null;

        function box(g) {
            g.each(function(d, i) {
                var g = d3.select(this),
                    min = d.values.min,
                    max = d.values.max;

                // Save quartile values.
                var quartileData = [d.values.quartil1, d.values.median, d.values.quartil3];

                // Save whisker values.
                var whiskerData = [d.values.min, d.values.max];

                // Compute the new x-scale.
                var x1 = d3.scale.linear()
                    .domain(domain && domain.call(this, d, i) || [min, max])
                    .range([height, 0]);

                // Retrieve the old x-scale, if this is an update.
                var x0 = this.__chart__ || d3.scale.linear()
                    .domain([0, Infinity])
                    .range(x1.range());

                // Stash the new scale.
                this.__chart__ = x1;




                // Update center line: the vertical line spanning the whiskers.
                var center = g.selectAll("line.center")
                    .data(whiskerData ? [whiskerData] : []);

                center.enter().insert("line", "rect")
                    .attr("class", "center")
                    .attr("x1", width / 2)
                    .attr("y1", function(d) {
                        return x0(d[0]);
                    })
                    .attr("x2", width / 2)
                    .attr("y2", function(d) {
                        return x0(d[1]);
                    })
                    .style("opacity", 1e-6)
                    .transition()
                    .duration(duration)
                    .style("opacity", 1)
                    .attr("y1", function(d) {
                        return x1(d[0]);
                    })
                    .attr("y2", function(d) {
                        return x1(d[1]);
                    });

                center.transition()
                    .duration(duration)
                    .style("opacity", 1)
                    .attr("y1", function(d) {
                        return x1(d[0]);
                    })
                    .attr("y2", function(d) {
                        return x1(d[1]);
                    });

                center.exit().transition()
                    .duration(duration)
                    .style("opacity", 1e-6)
                    .attr("y1", function(d) {
                        return x1(d[0]);
                    })
                    .attr("y2", function(d) {
                        return x1(d[1]);
                    })
                    .remove();

                // Update innerquartile box.
                var box = g.selectAll("rect.box")
                    .data([quartileData]);

                box.enter().append("rect")
                    .attr("class", "box")
                    .attr("x", 0)
                    .attr("y", function(d) {
                        return x0(d[2]);
                    })
                    .attr("width", width)
                    .attr("height", function(d) {
                        return x0(d[0]) - x0(d[2]);
                    })
                    .transition()
                    .duration(duration)
                    .attr("y", function(d) {
                        return x1(d[2]);
                    })
                    .attr("height", function(d) {
                        return x1(d[0]) - x1(d[2]);
                    });

                box.transition()
                    .duration(duration)
                    .attr("y", function(d) {
                        return x1(d[2]);
                    })
                    .attr("height", function(d) {
                        return x1(d[0]) - x1(d[2]);
                    });

                // Update median line.
                var medianLine = g.selectAll("line.median")
                    .data([quartileData[1]]);

                medianLine.enter().append("line")
                    .attr("class", "median")
                    .attr("x1", 0)
                    .attr("y1", x0)
                    .attr("x2", width)
                    .attr("y2", x0)
                    .transition()
                    .duration(duration)
                    .attr("y1", x1)
                    .attr("y2", x1);

                medianLine.transition()
                    .duration(duration)
                    .attr("y1", x1)
                    .attr("y2", x1);

                // -----------------------------------------------
                // FALTAN LOS WHISKERS Y OUTLIERS

                // Update whiskers.
                var whisker = g.selectAll("line.whisker")
                    .data(whiskerData || []);

                whisker.enter().insert("line", "circle, text")
                    .attr("class", "whisker")
                    .attr("x1", 0)
                    .attr("y1", x0)
                    .attr("x2", width)
                    .attr("y2", x0)
                    .style("opacity", 1e-6)
                    .transition()
                    .duration(duration)
                    .attr("y1", x1)
                    .attr("y2", x1)
                    .style("opacity", 1);

                whisker.transition()
                    .duration(duration)
                    .attr("y1", x1)
                    .attr("y2", x1)
                    .style("opacity", 1);

                whisker.exit().transition()
                    .duration(duration)
                    .attr("y1", x1)
                    .attr("y2", x1)
                    .style("opacity", 1e-6)
                    .remove();




                // -----------------------------------------------


                // Compute the tick format.
                var format = tickFormat || x1.tickFormat(8);

                // Update box ticks.
                var boxTick = g.selectAll("text.box")
                    .data(quartileData);

                boxTick.enter().append("text")
                    .attr("class", "box")
                    .attr("dy", ".3em")
                    .attr("dx", function(d, i) {
                        return i & 1 ? 6 : -6
                    })
                    .attr("x", function(d, i) {
                        return i & 1 ? width : 0
                    })
                    .attr("y", x0)
                    .attr("text-anchor", function(d, i) {
                        return i & 1 ? "start" : "end";
                    })
                    .text(format)
                    .transition()
                    .duration(duration)
                    .attr("y", x1);

                boxTick.transition()
                    .duration(duration)
                    .text(format)
                    .attr("y", x1);

                // -----------------------------------------------
                // FALTA CODIGO WHISKERS

                var whiskerTick = g.selectAll("text.whisker")
                    .data(whiskerData || []);

                whiskerTick.enter().append("text")
                    .attr("class", "whisker")
                    .attr("dy", ".3em")
                    .attr("dx", 6)
                    .attr("x", width)
                    .attr("y", x0)
                    .text(format)
                    .style("opacity", 1e-6)
                    .transition()
                    .duration(duration)
                    .attr("y", x1)
                    .style("opacity", 1);

                whiskerTick.transition()
                    .duration(duration)
                    .text(format)
                    .attr("y", x1)
                    .style("opacity", 1);

                whiskerTick.exit().transition()
                    .duration(duration)
                    .attr("y", x1)
                    .style("opacity", 1e-6)
                    .remove();


                // -----------------------------------------------

            });
            d3.timer.flush();
        }

        box.width = function(x) {
            if (!arguments.length) return width;
            width = x;
            return box;
        };

        box.height = function(x) {
            if (!arguments.length) return height;
            height = x;
            return box;
        };

        box.tickFormat = function(x) {
            if (!arguments.length) return tickFormat;
            tickFormat = x;
            return box;
        };

        box.duration = function(x) {
            if (!arguments.length) return duration;
            duration = x;
            return box;
        };

        box.domain = function(x) {
            if (!arguments.length) return domain;
            domain = x == null ? x : d3.functor(x);
            return box;
        };

        box.value = function(x) {
            if (!arguments.length) return value;
            value = x;
            return box;
        };

        box.whiskers = function(x) {
            if (!arguments.length) return whiskers;
            whiskers = x;
            return box;
        };

        box.quartiles = function(x) {
            if (!arguments.length) return quartiles;
            quartiles = x;
            return box;
        };

        return box;


    };

})();



module.exports = router;