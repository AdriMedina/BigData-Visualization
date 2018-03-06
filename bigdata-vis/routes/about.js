var express = require('express');
var config = require('./config');
var router = express.Router();

/* GET about page. */
router.get('/about', function(req, res) {
  res.render('about', {
    	title: config.app.title,
    	app_name: config.app.name,
  	  	app_description: config.app.description,
  	  	devel_author: config.devel.author,
    	devel_department: config.devel.department,
    	devel_supervisor: config.devel.supervisor
   	});
});

module.exports = router;