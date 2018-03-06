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
 *   PiechartResponse:
 *     properties:
 *       _id:
 *         type: string
 *       title:
 *         type: string
 *       colSelected:
 *         type: string
 *       colCount:
 *         type: string
 *       lvalues:
 *         type: array
 *         items:
 *           type: object
 *           properties:
 *             colKey:
 *               type: string
 *             colValue:
 *               type: number
 */

/**
 * @swagger
 * /datavis/piechart:
 *   get:
 *     tags:
 *       - Piechart
 *     description: Returns the data on the requested Piechart
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: file
 *         in: query
 *         description: Path to file
 *         required: true
 *         type: string
 *       - name: colSelected
 *         in: query
 *         description: The selected column for piechart
 *         required: true
 *         type: string
 *       - name: colCount
 *         in: query
 *         description: Reference column to apply the operation
 *         required: true
 *         type: string
 *       - name: opVal
 *         in: query
 *         description: Code of the operation to be applied [0-Count, 1-Sum, 2-Max, 3-Min]
 *         required: true
 *         type: number
 *     responses:
 *       "200":
 *        description: Success
 *        schema:
 *           $ref: "#/definitions/PiechartResponse"
 */

module.exports = {
    piechart: piechart
};

function piechart(req, res) {

    /** Get parameters
     * 
     * @param file Path to file
     * @param colSelected Column selected for the axis
     * @param colCount Column that count values
     * @param opVal Operation to apply
     *
     */
    var file = req.query.file;
    var colSelected = req.query.colSelected;
    var colCount = req.query.colCount;
    var opVal = req.query.opVal || defaultValues.piechart.opVal;
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
    var plotMD5 = crypto.createHash('md5').update('piechart').digest('hex');
    var auxParamMD5 = colSelected.concat(";", colCount, ";", opVal);
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


            /** Launch spark-submit to generate JSON data for piechart
             * 
             */
            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (config.api.exec_mode == "systemcall") {
                var submit = config.api.submitSpark;
                submit = submit.concat(defaultValues.piechart.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', ' "', config.mongo.collectionResult, '" ', ' "', file, '" "', idPlot, '" "', colSelected, '" "', colCount, '" ', opVal);

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
                //     submit,
                //     function(data, err, stderr){
                //         if (!err){
                //             Result.find({"id_plot" : idPlot}, function(err, dataMongo){
                //                 if (err) return console.error(err);
                //                 if(dataMongo.length === 1){
                //                     res.setHeader('Content-Type', 'application/json');
                //                     res.send(JSON.stringify(dataMongo[0], null, 3));
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
                //         }else{
                //             res.send(err);
                //         }
                //     }
                // );


            } else {

            }
        }
    });

}