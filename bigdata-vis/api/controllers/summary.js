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
 *   SummaryResponse:
 *     properties:
 *       _id:
 *         type: string
 *       values:
 *         type: object
 *         properties:
 *           name:
 *             type: string
 *           path:
 *             type: string
 *           size:
 *             type: number
 *           numCols:
 *             type: number
 *           numRows:
 *             type: number
 *           nameCols:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 value:
 *                   type: string
 */

/**
 * @swagger
 * /datavis/summary:
 *   get:
 *     tags:
 *       - Summary
 *     description: Gets information about the selected file
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: file
 *         in: query
 *         description: Path to file
 *         required: true
 *         type: string
 *     responses:
 *       "200":
 *        description: Success
 *        schema:
 *           $ref: "#/definitions/SummaryResponse"
 */
module.exports = {
    summary: summary
};


function summary(req, res) {

    /** Get parameters
     * 
     * @param file Path to file
     *
     */
    var file = req.swagger.params.file.value;


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
    var min = 1;
    var max = 1000000;
    var idPlot = parseInt(Math.random() * (max - min) + min).toString();
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

    /** Launch spark-submit to generate JSON data for summary
     * 
     */
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
                            res.json(dataMongo[0]);
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
                    res.json(dataMongo[0]);
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

            /** Launch spark-submit to generate JSON data for summary
             * 
             */
            var Result = db.model('Result', new mongoose.Schema({}), config.mongo.collectionResult);
            if (config.api.exec_mode == "systemcall") {
                var submit = config.api.submitSpark;
                submit = submit.concat(defaultValues.summary.path, ' "', mongodbURL, '" ', ' "', config.mongo.database, '" ', config.mongo.collectionResult, ' "', file, '" ', ' "', idPlot, '" ');

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
                            res.json(dataMongo[0]);
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
                //  function(data, err, stderr){
                //      if (!err){
                //          Result.find({"id_plot" : idPlot}, function(err, dataMongo){
                //              if (err) return console.error(err);
                //              res.json(dataMongo[0]);
                //              db.close(function () {
                //                          console.log('Mongoose connection disconnected');
                //                      });
                //                      delete db.models['Result'];
                //          });

                //          /* Update the status of the graph in MongoDB
                //              *
                //              */
                //              MongoStatus.update({'id_plot' : idPlot},
                //              {status : 'finish', date_end: new Date()},
                //              function(err, dataNum){
                //                      // Get err
                //              }
                //              );

                //      }else{
                //          res.render(err);
                //      }
                //          }
                //      );

            } else {}
        }
    });

}