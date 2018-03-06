var config = {};

config.app = {};
config.devel = {};
config.web = {};
config.mongo = {};
config.templates = {};
config.api = {};
config.webhdfs = {};

config.app.title= "BigData Visualization";
config.app.name= "BigData Visualization";
config.app.description="Tools for BigData Visualization. WebUI.";
config.app.year="2016-2017";
config.devel.author="Adrián Medina González";
config.devel.supervisor="José M. Benítez Sánchez and Manuel J. Parra Royón";
config.devel.department="SCI2S";
config.web.url="localhost";
config.web.port="20183";
config.web.start="/about";
config.mongo.connection = "mongodb://localhost:"
config.mongo.database = "vbd"
config.mongo.collectionStatus = "collectStatus"
config.mongo.collectionResult = "collectResult"
config.mongo.port="27017";
config.templates.folder="/templates";
config.api.url="api/v1";
config.api.exec_mode="systemcall";
config.api.submitSpark='spark-submit --class "Main" --master local ';
config.webhdfs.url = "http://localhost";
config.webhdfs.port = "50070";
config.webhdfs.api = "/webhdfs/v1/";

module.exports = config;