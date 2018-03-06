 /**
  * Keeps the list of the latest generated charts.
  */

 var jsonLC = {
     listLC: []
 };

 var callLC = function(url, title, params) {
     $('#finishIconResult').css('display', 'none');
     $('#loadIconResult').css('display', 'inline');
     $.get(url, function(svgResult) {

         insertChart(svgResult, title, params);

         $('#loadIconResult').css('display', 'none');
         $('#finishIconResult').css('display', 'inline');

     });
 };

 var deleteAllCharts = function() {
     jsonLC.listLC = [];
     $('#menuLC').empty();
     setLenghtLastChart();
 };

 var setLenghtLastChart = function() {
     $('#numLC').html(jsonLC.listLC.length);
 };

 var getListCharts = function() {
     return jsonLC.listLC;
 };

 function getChart(index) {
     return jsonLC.listLC[index - 1];
 }

 function capitalizeFirstLetter(string) {
     return string.charAt(0).toUpperCase() + string.slice(1);
 };


 var splitParams = function(params) {
     var auxParam = [];
     if (params != "") {
         params.split("&").forEach(function(element) {
             auxParam.push({
                 "parameter": capitalizeFirstLetter(element.split("=")[0]).replace(/%5B%5D/g, "[]"),
                 "value": (element.split("=")[1]).replace(/%2F/g, "/")
             });
         });
     }
     return auxParam;
 };

 var setLastChart = function(url, chart, params) {

     var auxChart = capitalizeFirstLetter(chart.split("/")[1]).bold();
     var auxParam = [];

     auxParam = splitParams(params);
     jsonLC.listLC.push({
         "url": url,
         "chart": auxChart,
         "params": params
     });

     $('#menuLC').append("<li><a id='linkLC" + jsonLC.listLC.length + "' href='javascript:;' onClick='callLC(\"" + url + "\", \"" + auxChart + "\", \"" + params + "\");'><span><h5 class='title primary'>" + auxChart + "   <i id='loadIconLC" + jsonLC.listLC.length + "' class='fa fa-spinner fa-spin fa-2x blue' style='display:inline-block'></i><i id='finishIconLC" + jsonLC.listLC.length + "' class='fa fa-check fa-2x green' style='display:none'></i></h5></span></a></li>");
     auxParam.forEach(function(p) {
         $('#linkLC' + jsonLC.listLC.length).append("<span class='message primary'>" + p.parameter + " : " + p.value + "</span>");
     });

     setLenghtLastChart();

     return jsonLC.listLC.length;
 };

 var changeToFinish = function(id) {

     $('#loadIconLC' + id).css('display', 'none');
     $('#finishIconLC' + id).css('display', 'inline');

 }