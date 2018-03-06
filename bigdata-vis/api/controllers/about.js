'use strict';

var util = require('util');
var config = require('../../routes/config');

/**
 * @swagger
 * definition:
 *   AboutResponse:
 *     required:
 *       - title
 *     properties:
 *       title:
 *         type: string
 *       app_name:
 *         type: string
 *       app_description:
 *         type: string
 *       devel_author:
 *         type: string
 *       devel_department:
 *         type: string
 *       devel_supervisor:
 *         type: string
 */

/**
 * @swagger
 * /datavis/about:
 *   get:
 *     tags:
 *       - About
 *     description: Returns information about developers and the application
 *     produces:
 *       - application/json
 *     responses:
 *       "200":
 *        description: Success
 *        schema:
 *           $ref: "#/definitions/AboutResponse"
 */

module.exports = {
    about: about
};


function about(req, res) {
    res.json({
        title: config.app.name,
        app_name: config.app.name,
        app_description: config.app.description,
        devel_author: config.devel.author,
        devel_department: config.devel.department,
        devel_supervisor: config.devel.supervisor
    });
}