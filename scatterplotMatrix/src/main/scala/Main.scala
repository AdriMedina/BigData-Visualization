
import org.apache.spark.SparkContext
import org.apache.spark.SparkConf
import org.apache.spark.sql.SQLContext
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window

object Main extends App{

	import ScatterplotMatrix._
	import ManageFiles._


	/** Load SparkContext with MongoDB
	*
	*/
	val conf = new SparkConf()
		.setAppName("ScatterplotMatrix")

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
	val sec = args(5).toInt
 	var numCol = args(6).toInt
	var nameCols = new Array[String](numCol)
	var i = 0
	for(i <- 0 to numCol-1){
		nameCols(i) = args(7+i)
	}

	/** Load data into a dataframe
	*
	*/
	val df = loadCSV(inputData, sqlContext)
	
	/** Compute values to draw chart and save JSON output into MongoDB
	*
	*/
	val result = computeScatterplotMatrixContinuous(sqlContext, df, sec, nameCols, idPlot)
 	saveJSONintoMONGO(result, sc, mongoURL, mongoDatabase, mongoCollection)
 	sc.stop()
}