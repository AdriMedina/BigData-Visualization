

var insertChart = function(svgResult, title, params){

	var auxParam = splitParams(params);

	console.log(auxParam);

	var stringParams = function(){
		var stringRes = ""
		auxParam.forEach(function(p){
			stringRes = stringRes.concat("<small>" + p.parameter + " : " + p.value + "</small>");
		});
		return stringRes;
	};

	var insertDiv = "<div class='row'><div class='col-md-12 col-sm-12 col-xs-12'><div class='x_panel'><div class='x_title'><h2 style='white-space:normal'>" + title + stringParams() + "</h2><ul class='nav navbar-right panel_toolbox'><li><a class='close-link' onclick='var $BOX_PANEL = $(this).closest(\"" + ".x_panel" + "\"); $BOX_PANEL.remove();'><i class='fa fa-close'></i></a></li></ul><div class='clearfix'></div><div class='x_content'>" + svgResult + "</div></div></div></div>";

	$('#panelChartRes').append(insertDiv);

};

