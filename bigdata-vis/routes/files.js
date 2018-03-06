var express = require('express');
var request = require('request');
var config = require('./config');
var router = express.Router();
var app = express();

// GET display HDFS files page. 
router.get('/files/*', function(req, res){
  	var folder = req.params[0] || "";
    var urlHDFS = config.webhdfs.url.concat(":", config.webhdfs.port, config.webhdfs.api, folder, '?op=LISTSTATUS');
    request.get(urlHDFS).pipe(res);
});


module.exports = router;




