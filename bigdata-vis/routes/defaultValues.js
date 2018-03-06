var defaultValues = {};

defaultValues.summary = {}
defaultValues.histogram = {}
defaultValues.boxplot = {}
defaultValues.scatterplot = {}
defaultValues.heatmap = {}
defaultValues.bubblechart = {}
defaultValues.scatterplotMatrix = {}
defaultValues.piechart = {}
defaultValues.linechart = {}

defaultValues.summary.path = "../summary/target/scala-2.11/Summary-assembly-1.0.jar";

defaultValues.histogram.path = "../histogram/target/scala-2.11/Histogram-assembly-1.0.jar";
defaultValues.histogram.sections = 6;

defaultValues.boxplot.path = "../boxplot/target/scala-2.11/Boxplot-assembly-1.0.jar";
defaultValues.boxplot.count = 1;

defaultValues.scatterplot.path = "../scatterplot/target/scala-2.11/ScatterPlot-assembly-1.0.jar";
defaultValues.scatterplot.secx = 20;
defaultValues.scatterplot.secy = 20;
defaultValues.scatterplot.colorRan = 9;

defaultValues.heatmap.path = "../heatmap/target/scala-2.11/Heatmap-assembly-1.0.jar";
defaultValues.heatmap.opVal = 0;
defaultValues.heatmap.colorRan = 9;

defaultValues.bubblechart.path = "../scatterplot/target/scala-2.11/ScatterPlot-assembly-1.0.jar";
defaultValues.bubblechart.secx = 20;
defaultValues.bubblechart.secy = 20;
defaultValues.bubblechart.colorRan = 9;

defaultValues.scatterplotMatrix.path = "../scatterplotMatrix/target/scala-2.11/ScatterPlotMatrix-assembly-1.0.jar";
defaultValues.scatterplotMatrix.count = 0;

defaultValues.piechart.path = "../piechart/target/scala-2.11/PieChart-assembly-1.0.jar";
defaultValues.piechart.opVal = 0;

defaultValues.linechart.path = "../linechart/target/scala-2.11/LineChart-assembly-1.0.jar";
defaultValues.linechart.count = 0;

module.exports = defaultValues;