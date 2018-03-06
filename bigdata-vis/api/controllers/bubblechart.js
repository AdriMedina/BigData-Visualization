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
 *   BubblechartResponse:
 *     properties:
 *       _id:
 *         type: string
 *       title:
 *         type: string
 *       titleX:
 *         type: string
 *       titleY:
 *         type: string
 *       values:
 *         type: array
 *         items:
 *           type: object
 *           properties:
 *             pointX:
 *               type: number
 *             pointY:
 *               type: number
 *             value:
 *               type: number
 *             valueColor:
 *               type: number
 */

/**
 * @swagger
 * /datavis/bubblechart:
 *   get:
 *     tags:
 *       - Bubblechart
 *     description: Returns the data on the requested Bubblechart
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: file
 *         in: query
 *         description: Path to file
 *         required: true
 *         type: string
 *       - name: colx
 *         in: query
 *         description: The selected column for the X-axis
 *         required: true
 *         type: string
 *       - name: coly
 *         in: query
 *         description: The selected column for the Y-axis
 *         required: true
 *         type: string
 *       - name: secx
 *         in: query
 *         description: Number of sections to divide the X-axis values
 *         required: true
 *         type: number
 *       - name: secy
 *         in: query
 *         description: Number of sections to divide the Y-axis values
 *         required: true
 *         type: number
 *     responses:
 *       "200":
 *        description: Success
 *        schema:
 *           $ref: "#/definitions/BubblechartResponse"
 */

module.exports = {
    bubblechart: bubblechart
};

function bubblechart(req, res) {

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
    var secx = req.query.secx || defaultValues.bubblechart.secx;
    var secy = req.query.secy || defaultValues.bubblechart.secy;
    var colorRan = /*req.query.colorRan ||*/ defaultValues.bubblechart.colorRan;
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
    var plotMD5 = crypto.createHash('md5').update('bubblechart').digest('hex');
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


            /** Launch spark-submit to generate JSON data for bubblechart
             * 
             */
            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (config.api.exec_mode == "systemcall") {
                var submit = config.api.submitSpark;
                submit = submit.concat(defaultValues.bubblechart.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" "', colx, '" "', coly, '" ', secx, " ", secy, " ", colorRan, " ", '"', idPlot, '" ');

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

                //              /* Update the status of the graph in MongoDB
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