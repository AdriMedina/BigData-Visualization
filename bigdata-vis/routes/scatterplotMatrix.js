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


/* GET scatterplotMatrix page. */
router.get('/scatterplotMatrix', function(req, res) {

    /** Starts the timer to know how long it takes to execute the request
     *
     */
    console.time('scatterplotMatrix');


    /** Get parameters
     * 
     * @param file Path to file
     * @param sec Number of sections to divide values for the axis
     * @param col Array with column name selected
     * @param count Number of column selected
     *
     */
    var file = req.query.file;
    var sec = req.query.sec;
    var count = req.query.count || defaultValues.scatterplotMatrix.count;
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
    var plotMD5 = crypto.createHash('md5').update('scatterplotMatrix').digest('hex');
    var auxParamMD5 = sec.concat(";", count, ";", stringCol);
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
                            res.send(get_scatterplotMatrix(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                    res.send(get_scatterplotMatrix(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                submit = submit.concat(defaultValues.scatterplotMatrix.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" ', ' "', idPlot, '" ', sec, " ", count, stringCol);

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
                            res.send(get_scatterplotMatrix(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                        var access = fs.createWriteStream('./graphicRegister/scatterplotMatrix.time.log', {
                            flags: 'a',
                            autoClose: true
                        });
                        process.stdout.write = process.stderr.write = access.write.bind(access);
                        console.timeEnd('scatterplotMatrix');
                        console.log('File: ' + file);
                        console.log('Sec: ' + sec);
                        console.log('CountCols: ' + count);
                        console.log('Columns: ' + stringCol);
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
                //                              res.send(get_scatterplotMatrix(JSON.stringify(dataMongo[0])).node().outerHTML);
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
                //          var access = fs.createWriteStream('./graphicRegister/scatterplotMatrix.time.log', { flags: 'a', autoClose: true });
                //          process.stdout.write = process.stderr.write = access.write.bind(access);
                //          console.timeEnd('scatterplotMatrix');
                //          console.log('File: ' + file);
                //          console.log('Sec: ' + sec);
                //          console.log('CountCols: ' + count);
                //          console.log('Columns: ' + stringCol);
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


function get_scatterplotMatrix(dataJSON) {

    var json = JSON.parse(dataJSON);

    // Set svg parameters
    var width = 900,
        height = 700,
        sizeWidth = parseFloat(width / Math.sqrt(json.listAxis.length)) - 1,
        sizeHeight = parseFloat(height / Math.sqrt(json.listAxis.length)) - 1,
        padding = 20;

    var x = d3.scale.linear()
        .range([padding / 2, sizeWidth - padding / 2]);

    var y = d3.scale.linear()
        .range([sizeHeight - padding / 2, padding / 2]);

    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(6);

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(6);

    var domainByColumn = {},
        columns = json.listAxis,
        nomColumns = [],
        n = 0;

    columns.forEach(function(column) {
        if (column.titleX === column.titleY) {
            domainByColumn[column.titleX] = d3.extent(column.values, function(d) {
                return d.pointX;
            });
            nomColumns.push(column.titleX);
            n += 1;
        }
    });

    xAxis.tickSize(sizeWidth * n);
    yAxis.tickSize(-sizeHeight * n);

    var svgContainer = d3.select(doc.body)
        .append("div")
        .classed("svg-container", true)
        .append("svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "-80 -40 1024 768")
        .classed("svg-content-responsive", true);

    var svg = svgContainer;

    /*svg.selectAll(".x.axis")
        .data(nomColumns)
        .enter().append("g")
        .attr("class", "x axis")
        .attr("transform", function(d, i) { return "translate(" + (n - i - 1) * sizeWidth + ",0)"; });
        .each(function(d) { x.domain(domainByColumn[d]); d3.select(this).call(xAxis); });

    svg.selectAll(".y.axis")
        .data(nomColumns)
        .enter().append("g")
        .attr("class", "y axis")
        .attr("transform", function(d, i) { return "translate(0," + i * sizeHeight + ")"; });
        .each(function(d) { y.domain(domainByColumn[d]); d3.select(this).call(yAxis); });*/


    var cell = svg.selectAll(".cell")
        .data(columns)
        .enter().append("g")
        .attr("class", "cell")
        .attr("transform", function(d) {
            return "translate(" + (n - d.posX - 1) * sizeWidth + "," + d.posY * sizeHeight + ")";
        })
        .each(plot);

    // Titles for the diagonal.
    cell.filter(function(d) {
            return d.titleX === d.titleY;
        }).append("text")
        .attr("x", padding)
        .attr("y", padding)
        .attr("dy", ".71em")
        .text(function(d) {
            return d.titleX;
        });

    function plot(p) {
        var cell = d3.select(this);

        x.domain(domainByColumn[p.titleX]).nice();
        y.domain(domainByColumn[p.titleY]).nice();

        cell.append("rect")
            .attr("class", "frame")
            .attr("x", padding / 2)
            .attr("y", padding / 2)
            .attr("width", sizeWidth - padding)
            .attr("height", sizeHeight - padding);

        if (p.titleX !== p.titleY) {
            cell.selectAll("circle")
                .data(p.values)
                .enter().append("circle")
                .attr("cx", function(d) {
                    return x(d.pointX);
                })
                .attr("cy", function(d) {
                    return y(d.pointY);
                })
                .attr("r", 4)
                .style("stroke", "#2c7bb6")
                .style("fill", "#2c7bb6");
        }
    }


    return svgContainer;

}

module.exports = router;