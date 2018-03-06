
import org.apache.spark.SparkContext
import org.apache.spark.SparkConf
import org.apache.spark.sql.SQLContext
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window

object Main extends App{

	import Heatmap._
	import ManageFiles._


	/** Load SparkContext with MongoDB
	*
	*/
	val conf = new SparkConf()
		.setAppName("Heatmap")

	val sc = new SparkContext(conf)
	val sqlContext = new SQLContext(sc)


	import sqlContext.implicits._

	/** Get arguments
	*
	*/
	var mongoURL = args(0)
	var mongoDatabase = args(1)
	var mongoCollection = args(2)
	var inputData = args(3)
 	var axisX = args(4)
 	var axisY = args(5)
 	var colCount = args(6)
 	var op = args(7).toInt
 	var colorRan = args(8).toInt
 	val idPlot = args(9)

	/** Load data into a dataframe
	*
	*/
	val df = loadCSV(inputData, sqlContext)

	/*val df = List(
	  (1,"A","A",1),
	  (2,"A","A",1),
	  (3,"A","A",3),
	  (4,"A","B",2),
	  (5,"B","A",5),
	  (6,"C","C",10),
	  (7,"D","C",4)
	).toDF("id","ejeX","ejeY","ts")
	val result = computeHeatmapContinuous(sqlContext, df, "ejeX", "ejeY", "ts", 0, colorRan, idPlot)*/

	/** Compute values to draw chart and save JSON output into MongoDB
	*
	*/
	val result = computeHeatmapContinuous(sqlContext, df, axisX, axisY, colCount, op, colorRan, idPlot)
 	saveJSONintoMONGO(result, sc, mongoURL, mongoDatabase, mongoCollection)
 	sc.stop()
}