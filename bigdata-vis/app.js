'use strict';

var SwaggerExpress = require('swagger-express-mw');
var swaggerJSDoc = require('swagger-jsdoc');
var express = require('express');
var path = require('path');
var mongoose = require('mongoose');
var url = require('url');
var app = express();

var swaggerDefinition = {
    info: {
        title: 'Node Swagger API',
        version: '1.0.0',
        description: 'Project documentation and RESTful API with Swagger',
    },
    host: 'localhost:20183',
    basePath: '/',
};

// options for the swagger docs
var options = {
    // import swaggerDefinitions
    swaggerDefinition: swaggerDefinition,
    // path to the API docs
    apis: ['./api/controllers/*.js'],
};

// initialize swagger-jsdoc
var swaggerSpec = swaggerJSDoc(options);



var configWeb = require('./routes/config');
var index = require('./routes/index');
var about = require('./routes/about');
var files = require('./routes/files');
var summary = require('./routes/summary');
var histogram = require('./routes/histogram');
var boxplot = require('./routes/boxplot');
var scatterplot = require('./routes/scatterplot');
var heatmap = require('./routes/heatmap');
var bubblechart = require('./routes/bubblechart');
var scatterplotMatrix = require('./routes/scatterplotMatrix');
var piechart = require('./routes/piechart');
var linechart = require('./routes/linechart');
var stackedAreaChart = require('./routes/stackedAreaChart');
var barchart = require('./routes/barchart');


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));


module.exports = app; // for testing

var config = {
    appRoot: __dirname // required config
};


/** Launch server.
 *
 */
SwaggerExpress.create(config, function(err, swaggerExpress) {
    if (err) {
        throw err;
    }

    // install middleware
    swaggerExpress.register(app);

    var port = /*process.env.PORT ||*/ configWeb.web.port;
    app.listen(port);

});


// serve swagger
app.get('/swagger.json', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});



/** Index page.
 *
 */
app.use('/', index);


/** About page. Display information about developers.
 *
 */
app.get('/about', about);

/** Display files in HDFS
 *
 */
app.get('/files/*', files);

/** Display summary information about selected file
 *
 * @param file Path to file
 *
 */
app.get('/summary', summary);


/** Display an histogram
 *
 * @param file Path to file
 * @param col The column selected for the histogram
 * @param sections Number of histogram bars
 *
 */
app.get('/histogram', histogram);


/** Display an boxplot
 *
 * @param file Path to file
 * @param col Array with column name selected
 * @param count Number of column selected
 *
 */
app.get('/boxplot', boxplot);


/** Display an scatterplot
 *
 * @param file Path to file
 * @param colx Column selected for the x-axis
 * @param coly Column selected for the y-axis
 * @param secx Number of sections to divide values for the x-axis
 * @param secy Number of sections to divide values for the y-axis
 *
 */
app.get('/scatterplot', scatterplot);


/** Display an heatmap
 *
 * @param file Path to file
 * @param colx Column selected for the x-axis
 * @param coly Column selected for the y-axis
 * @param colCount Column that count values
 *
 */
app.get('/heatmap', heatmap);


/** Display an bubblechart
 *
 * @param file Path to file
 * @param colx Column selected for the x-axis
 * @param coly Column selected for the y-axis
 * @param secx Number of sections to divide values for the x-axis
 * @param secy Number of sections to divide values for the y-axis
 *
 */
app.get('/bubblechart', bubblechart);


/** Display an scatterplot matrix
 *
 * @param file Path to file
 * @param sec Number of sections to divide values for the axis
 * @param col Array with column name selected
 * @param count Number of column selected
 *
 */
app.get('/scatterplotMatrix', scatterplotMatrix);


/** Display an piechart
 *
 * @param file Path to file
 * @param colSelected Column selected for the x-axis
 * @param colCount Column that count values
 * @param op Operation to apply to colCount
 *
 */
app.get('/piechart', piechart);

/** Display an linechart
 *
 * @param file Path to file
 * @param sec number of sections to divide the data
 * @param colX column for x-axis
 * @param count Number of column selected
 * @param col Array with column name selected
 *
 */
app.get('/linechart', linechart);

/** Display an stackedAreaChart
 *
 * @param file Path to file
 * @param sec number of sections to divide the data
 * @param colX column for x-axis
 * @param count Number of column selected
 * @param col Array with column name selected
 *
 */
app.get('/stackedAreaChart', stackedAreaChart);

/** Display an barchart
 *
 * @param file Path to file
 * @param colSelected Column selected for the x-axis
 * @param colCount Column that count values
 * @param op Operation to apply to colCount
 *
 */
app.get('/barchart', barchart);