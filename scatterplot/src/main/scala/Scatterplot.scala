
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.SQLContext
import org.apache.spark.SparkContext._
import scala.collection.mutable.ListBuffer
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.Scatterplot]] instances. */

object Scatterplot {

	/** Case class for resume values.
	*
	*/
	case class Values(pointX: Double, pointY: Double, value: Double, valueColor: Int)
	case class Graphic(title: String, titleX: String, titleY: String, lvalues: List[Values])

	/** Computes the intervals to represent a Scatterplot 
	* 
	*  @param df dataframe with data
	*  @param axisX column that represent axis X
	*  @param axisY column that represent axis Y
	*/
	def computeScatterplotContinuous(sqlContext: SQLContext, df: DataFrame, axisX: String, axisY: String, secX: Int, secY: Int, colorRan: Int, idPlot: String) : String = {

		import sqlContext.implicits._


		/* Define min and max values of the dataframe, numbers of sections (or blocks) for axis and size of interval for axis
		*
		*/
		val minX = df.select(min(axisX)).first().apply(0).asInstanceOf[Number].doubleValue()
		val maxX = df.select(max(axisX)).first().apply(0).asInstanceOf[Number].doubleValue()
		val minY = df.select(min(axisY)).first().apply(0).asInstanceOf[Number].doubleValue()
		val maxY = df.select(max(axisY)).first().apply(0).asInstanceOf[Number].doubleValue()
		val sectionsX = secX
		val sectionsY = secY
		val deltaX = (maxX - minX) / sectionsX
		val deltaY = (maxY - minY) / sectionsY

		/* Defines the functions that limit the section to which a value belongs
		*
		*/
		def funcionBloque(v: Double, delta: Double, min: Double, sections: Int) = {val b = ((v - min) / delta).asInstanceOf[Number].intValue(); if(b != sections) (delta*b)+min else ((delta*b)+min)-delta}
		def getValueColor(v: Int, delta: Double, min: Double, max: Double) = if (v != max) (((v - min) / delta).asInstanceOf[Number].intValue() + 1) else ((v - min) / delta).asInstanceOf[Number].intValue()
		
		
		/* Assign the values to the corresponding sections and compute the centroid
		*
		*/
		var listValues = df.select(axisX, axisY)
					.map(x => ((funcionBloque(x(0).asInstanceOf[Number].doubleValue(), deltaX, minX, sectionsX), funcionBloque(x(1).asInstanceOf[Number].doubleValue(), deltaY, minY, sectionsY)), 1))
					.rdd.reduceByKey(_+_)
					.map{case (k, v) => ((k._1 * 2 + deltaX)/2, (k._2 * 2 + deltaY)/2) -> v}
					.collect


		/* Compute the values of the colors to which each point belongs
		*
		*/
		val colorRange = colorRan
		val top = listValues.maxBy(_._2)._2.asInstanceOf[Number].doubleValue()
		val bot = listValues.minBy(_._2)._2.asInstanceOf[Number].doubleValue()
		val deltaColor = (top - bot) / colorRange
		val auxl = listValues.map(x => Values(x._1._1, x._1._2, x._2, getValueColor(x._2, deltaColor, bot, top)))

		val res = Graphic("Scatterplot", axisX, axisY, auxl.toList)


		/** Get result into JSON String and return
		*
		*/
		implicit val formats = DefaultFormats

		val json =
			("id_plot" -> idPlot) ~
			("title" -> res.title) ~
			("titleX" -> res.titleX) ~
			("titleY" -> res.titleY) ~
			("values" -> res.lvalues.map { v =>
				("pointX" -> v.pointX) ~
				("pointY" -> v.pointY) ~ 
				("value" -> v.value) ~
				("valueColor" -> v.valueColor)
			})

		compact(render(json))
		
	}

}