'use strict';

var util = require('util');
var config = require('../../routes/config');
var request = require('request');

/**
 * @swagger
 * definition:
 *   FilesResponse:
 *     properties:
 *       FileStatuses:
 *         type: object
 *         properties:
 *           FileStatus:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 accessTime:
 *                   type: number
 *                 blockSize:
 *                   type: number
 *                 childrenNum:
 *                   type: number
 *                 fileId:
 *                   type: number
 *                 group:
 *                   type: string
 *                 length:
 *                   type: number
 *                 modificationTime:
 *                   type: number
 *                 owner:
 *                   type: string
 *                 pathSuffix:
 *                   type: string
 *                 permission:
 *                   type: string
 *                 replication:
 *                   type: number
 *                 storagePolicy:
 *                   type: number
 *                 type:
 *                   type: string
 */

/**
 * @swagger
 * /datavis/files:
 *   get:
 *     tags:
 *       - Files
 *     description: Returns a list of hdfs files in the specified path
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: folder
 *         in: query
 *         description: The path to the file list (without starting '/')
 *         required: true
 *         type: string
 *     responses:
 *       "200":
 *        description: Success
 *        schema:
 *           $ref: "#/definitions/FilesResponse"
 */

module.exports = {
    files: files
};


function files(req, res) {

    var folder = req.swagger.params.folder.value || "";
    var urlHDFS = config.webhdfs.url.concat(":", config.webhdfs.port, config.webhdfs.api, folder, '?op=LISTSTATUS');
    request.get(urlHDFS).pipe(res);


}