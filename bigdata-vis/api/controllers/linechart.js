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
 *   LinechartResponse:
 *     properties:
 *       _id:
 *         type: string
 *       title:
 *         type: string
 *       colX:
 *         type: string
 *       listLines:
 *         type: array
 *         items:
 *           type: object
 *           properties:
 *             titleLine:
 *               type: string
 *             lvalues:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   pointXMin:
 *                     type: number
 *                   pointXMax:
 *                     type: number
 *                   pointY:
 *                     type: number
 */

/**
 * @swagger
 * /datavis/linechart:
 *   get:
 *     tags:
 *       - Linechart
 *     description: Returns the data on the requested Linechart
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: file
 *         in: query
 *         description: Path to file
 *         required: true
 *         type: string
 *       - name: sec
 *         in: query
 *         description: Number of sections to divide the axis values
 *         required: true
 *         type: number
 *       - name: colX
 *         in: query
 *         description: The selected column for the X-axis
 *         required: true
 *         type: string
 *       - name: count
 *         in: query
 *         description: Number of column selected
 *         required: true
 *         type: number
 *       - name: col
 *         in: query
 *         description: Array with the name of the selected columns
 *         required: true
 *         type: array
 *         items:
 *           type: string
 *     responses:
 *       "200":
 *        description: Success
 *        schema:
 *           $ref: "#/definitions/LinechartResponse"
 */

module.exports = {
    linechart: linechart
};


function linechart(req, res) {

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
    var sizeFile = req.query.sizeFile || 0;
    if (sizeFile == 0) {
        arrayCol = arrayCol.split(",");
    }
    var stringCol = ""
    for (var i = 0; i < count; i++) {
        stringCol = stringCol.concat(' "', arrayCol[i], '"');
    }

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
                //  submit,
                //      function(data, err, stderr){
                //      if (!err){
                //          Result.find({"id_plot" : idPlot}, function(err, dataMongo){
                //              if (err) return console.error(err);
                //     if(dataMongo.length === 1){
                //      res.setHeader('Content-Type', 'application/json');
                //      res.send(JSON.stringify(dataMongo[0], null, 3));
                //  }else{
                //      res.send("Data could not be recovered. Try it again later, please.");
                //  }
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
                //      }else{
                //              res.send(err);
                //      }
                //      }
                // );



            } else {

            }
        }

    });


}