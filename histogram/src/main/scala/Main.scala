
import org.apache.spark.SparkContext
import org.apache.spark.SparkConf
import org.apache.spark.sql.SQLContext
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window

object Main extends App{

	import Histogram._
	import ManageFiles._


	/** Load SparkContext with MongoDB
	*
	*/
	val conf = new SparkConf()
		.setAppName("Histogram")

	val sc = new SparkContext(conf)
	val sqlContext = new SQLContext(sc)


	import sqlContext.implicits._


	/** Input (args(0) variable in the HDFS
	*
	*/
	val inputData = args(3)


	/** Load data into a dataframe
	*
	*/
	val df = loadCSV(inputData, sqlContext)


	/** Compute values to draw chart and save JSON output into MongoDB
	*
	*/
 	val colName = args(4)
 	val intervalNum = args(5).toInt
 	val idPlot = args(6)
 	val result = computeHistogramContinuous(df, colName, intervalNum, idPlot)
 	saveJSONintoMONGO(result, sc, args(0), args(1), args(2))


 	sc.stop()
}