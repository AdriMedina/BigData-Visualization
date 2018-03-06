
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.SQLContext
import org.apache.spark.SparkContext._
import scala.collection.mutable.ListBuffer
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.LineChart]] instances. */

object LineChart {

	/** Case class for resume values.
	*
	*/
	case class Values(pointXMin: Double, pointXMax: Double, pointY: Double)
	case class Lines(titleLine: String, lvalues: List[Values])
	case class Graphic(title: String, colX: String, lLines: List[Lines])

	/** Computes the lines for columns selected to represent LineChart
	* 
	*  @param df dataframe with data
	*  @param sec number of sections to divide the data
	*  @param colX column for x-axis
	*  @param nameCols name of the columns selected()
	*  @param idPlot process identifier
	*/
	def computeLineChartContinuous(sqlContext: SQLContext, df: DataFrame, sec: Int, colX:String, nameCols: Array[String], idPlot: String) : String = {

		import sqlContext.implicits._

		var listLines = ListBuffer[Lines]()

		nameCols.map( x => getLineChartValues(colX, x))


		/** Compute the interval of the axis
		* 
		*  @param axisX column that represent axis X
		*  @param axisY column that represent axis Y
		*/
		def getLineChartValues(axisX: String, axisY: String) = {

			/* Define min and max values of the dataframe, numbers of sections (or blocks) for column and size of interval for x-axis
			*
			*/
			val minX = df.select(min(axisX)).first().apply(0).asInstanceOf[Number].doubleValue()
			val maxX = df.select(max(axisX)).first().apply(0).asInstanceOf[Number].doubleValue()
			val deltaX = (maxX - minX) / sec

			/* Defines the functions that limit the section to which a value belongs
			*
			*/
			def funcionBloque(v: Double, delta: Double, min: Double, sections: Int) = {val b = ((v - min) / delta).asInstanceOf[Number].intValue(); if(b != sections) (delta*b)+min else ((delta*b)+min)-delta}
			
			
			/* Assign the values to the corresponding sections and compute the average
			*
			*/
			var listValues = df.select(axisX, axisY)
						.map{x => var p = funcionBloque(x(0).asInstanceOf[Number].doubleValue(), deltaX, minX, sec); (p, p+deltaX) -> x(1).asInstanceOf[Number].doubleValue()}.rdd
						.mapValues(x => (x, 1)).reduceByKey((x, y) => (x._1 + y._1, x._2 + y._2))
						.mapValues(y => 1.0 * y._1 / y._2)
						.sortBy(_._1._1)
						.collect
						.map(a => Values(a._1._1, a._1._2, a._2))

			val lineValues = Lines(axisY, listValues.toList);

			listLines += lineValues
		}



		/** Get result into JSON String and return
		*
		*/
		val res = Graphic("LineChart", colX, listLines.toList)
		implicit val formats = DefaultFormats

		val json =
			("id_plot" -> idPlot) ~
			("title" -> res.title) ~
			("colX" -> res.colX) ~
			("listLines" -> res.lLines.map {ll =>
				("titleLine" -> ll.titleLine) ~
				("lvalues" -> ll.lvalues.map { lv =>
					("pointXMin" -> lv.pointXMin) ~
					("pointXMax" -> lv.pointXMax) ~
					("pointY" -> lv.pointY)
				})
			})
			
		//print(pretty(render(json)))
		compact(render(json))
		
	}

}