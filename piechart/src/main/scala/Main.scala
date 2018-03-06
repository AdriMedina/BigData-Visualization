
import org.apache.spark.SparkContext
import org.apache.spark.SparkConf
import org.apache.spark.sql.SQLContext
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window

object Main extends App{

	import PieChart._
	import ManageFiles._


	/** Load SparkContext with MongoDB
	*
	*/
	val conf = new SparkConf()
		.setAppName("PieChart")

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
	val idPlot = args(4)
	var colSelected = args(5)
	var colCount = args(6)
	var op = args(7).toInt

	/** Load data into a dataframe
	*
	*/
	val df = loadCSV(inputData, sqlContext)
	
	/** Compute values to draw chart and save JSON output into MongoDB
	*
	*/
	val result = computePieChartContinuous(sqlContext, df, colSelected, colCount, op, idPlot)
 	saveJSONintoMONGO(result, sc, mongoURL, mongoDatabase, mongoCollection)
 	sc.stop()
}