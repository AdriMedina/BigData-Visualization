
import org.apache.spark.SparkContext
import org.apache.spark.SparkConf
import org.apache.spark.sql.SQLContext
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window

object Main extends App{

	import LineChart._
	import ManageFiles._


	/** Load SparkContext with MongoDB
	*
	*/
	val conf = new SparkConf()
		.setAppName("LineChart")

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
	var sec = args(5).toInt
	var colX = args(6)
 	var numCol = args(7).toInt
	var nameCols = new Array[String](numCol)
	var i = 0
	for(i <- 0 to numCol-1){
		nameCols(i) = args(8+i)
	}

	/** Load data into a dataframe
	*
	*/
	val df = loadCSV(inputData, sqlContext)
	
	/*val df = List(
	  (1,2,4,0.3),
	  (2,4,5,0.2),
	  (3,5,5,0.3),
	  (4,7,8,0.4),
	  (5,12,9,0.5),
	  (6,13,7,0.1),
	  (7,16,4,0.2),
	  (8,3,10,0.5)
	).toDF("id","line1","line2","line3")
	val result = computeLineChartContinuous(sqlContext, df, 4, "id", Array[String]("line1", "line2", "line3"), "2000")*/



	/** Compute values to draw chart and save JSON output into MongoDB
	*
	*/
	val result = computeLineChartContinuous(sqlContext, df, sec, colX, nameCols, idPlot)
 	saveJSONintoMONGO(result, sc, mongoURL, mongoDatabase, mongoCollection)
 	sc.stop()
}