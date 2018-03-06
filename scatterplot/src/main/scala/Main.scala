
import org.apache.spark.SparkContext
import org.apache.spark.SparkConf
import org.apache.spark.sql.SQLContext
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window

object Main extends App{

	import Scatterplot._
	import ManageFiles._


	/** Load SparkContext with MongoDB
	*
	*/
	val conf = new SparkConf()
		.setAppName("Scatterplot")

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
 	var secX = args(6).toInt
 	var secY = args(7).toInt
 	var colorRan = args(8).toInt
 	val idPlot = args(9)

	/** Load data into a dataframe
	*
	*/
	val df = loadCSV(inputData, sqlContext)
	
	/*val df = List(
	  (1,2,4,1),
	  (2,4,5,2),
	  (3,5,5,3),
	  (4,7,8,4),
	  (5,12,9,5),
	  (6,13,7,1),
	  (7,16,4,2)
	).toDF("id","ejeX","ejeY","ts")
	computeScatterplotContinuous(sqlContext, df, "ejeX", "ejeY")*/


	/** Compute values to draw chart and save JSON output into MongoDB
	*
	*/
	val result = computeScatterplotContinuous(sqlContext, df, axisX, axisY, secX, secY, colorRan, idPlot)
 	saveJSONintoMONGO(result, sc, mongoURL, mongoDatabase, mongoCollection)
 	sc.stop()
}