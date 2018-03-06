'use strict';

var util = require('util');
var cmd = require('node-cmd');
var mongoose = require('mongoose');
var assert = require('assert');
var crypto = require('crypto');
var defaultValues = require('../../routes/defaultValues');
var config = require('../../routes/config');

/**
 * @swagger
 * definition:
 *   HistogramResponse:
 *     properties:
 *       _id:
 *         type: string
 *       values:
 *         type: object
 *         properties:
 *           type:
 *             type: string
 *           segments:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 min:
 *                   type: number
 *                 max:
 *                   type: number
 *                 count:
 *                   type: number
 */

/**
 * @swagger
 * /datavis/histogram:
 *   get:
 *     tags:
 *       - Histogram
 *     description: Returns the data on the requested histogram
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: file
 *         in: query
 *         description: Path to file
 *         required: true
 *         type: string
 *       - name: col
 *         in: query
 *         description: The selected column for the histogram
 *         required: true
 *         type: string
 *       - name: sections
 *         in: query
 *         description: Number of histogram bars
 *         required: false
 *         type: number
 *     responses:
 *       "200":
 *        description: Success
 *        schema:
 *           $ref: "#/definitions/HistogramResponse"
 */

module.exports = {
    histogram: histogram
};

function histogram(req, res) {

    /** Get parameters
     * 
     * @param file Path to file
     * @param col The column selected for the histogram
     * @param sections Number of histogram bars
     *
     */
    var file = req.swagger.params.file.value;
    var col = req.swagger.params.col.value;
    var sections = req.swagger.params.sections.value || defaultValues.histogram.sections;
    var sizeFile = req.query.sizeFile || 0;


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
                            res.setHeader('Content-Type', 'application/json');
                            res.send(JSON.stringify(dataMongo[0], null, 3));
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
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify(dataMongo[0], null, 3));
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
                            res.setHeader('Content-Type', 'application/json');
                            res.send(JSON.stringify(dataMongo[0], null, 3));
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
                //           res.setHeader('Content-Type', 'application/json');
                //           res.send(JSON.stringify(dataMongo[0], null, 3));
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

                //     }else{
                //       res.send(err);
                //     }
                //   }
                // );

            } else {}
        }
    });
}