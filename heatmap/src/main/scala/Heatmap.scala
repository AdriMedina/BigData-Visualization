
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.SQLContext
import org.apache.spark.SparkContext._
import scala.collection.mutable.ListBuffer
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.Heatmap]] instances. */

object Heatmap {

	/** Case class for resume values.
	*
	*/
	case class Values(axisX: String, axisY: String, value: Double, valueColor: Int)
	case class Graphic(title: String, titleX: String, titleY: String, lvalues: List[Values])

	/** Computes the intervals to represent a Heatmap 
	* 
	*  @param df dataframe with data
	*  @param axisX column that represent axis X
	*  @param axisY column that represent axis Y
	*  @param colCount column that count values
	*  @param opVal operation to apply
	*/
	def computeHeatmapContinuous(sqlContext: SQLContext, df: DataFrame, axisX: String, axisY: String, colCount: String, opVal: Int, colorRan: Int, idPlot: String) : String = {

		import sqlContext.implicits._

		/** Select three columns of data, group by the first two and apply an operation on the third 
		*
		*/
		val listValues = opVal match {
			// Sum
			case 0 => df.select(axisX,axisY,colCount)
						.map(x => (x(0).toString.asInstanceOf[String], x(1).toString.asInstanceOf[String]) -> x(2).asInstanceOf[Number].doubleValue)
						.rdd.reduceByKey(_+_)
						.sortBy(_._1).collect
			// Max
			case 1 => df.select(axisX,axisY,colCount)
						.map(x => (x(0).toString.asInstanceOf[String], x(1).toString.asInstanceOf[String]) -> x(2).asInstanceOf[Number].doubleValue)
						.rdd.reduceByKey(Math.max(_,_))
						.sortBy(_._1).collect
			// Min
			case 2 => df.select(axisX,axisY,colCount)
						.map(x => (x(0).toString.asInstanceOf[String], x(1).toString.asInstanceOf[String]) -> x(2).asInstanceOf[Number].doubleValue)
						.rdd.reduceByKey(Math.min(_,_))
						.sortBy(_._1).collect
			// Default
			case _ => df.select(axisX,axisY,colCount)
						.map(x => (x(0).toString.asInstanceOf[String], x(1).toString.asInstanceOf[String]) -> x(2).asInstanceOf[Number].doubleValue)
						.rdd.reduceByKey(_+_)
						.sortBy(_._1).collect
		}


		/* Defines the functions that limit the section to which a value belongs
		*
		*/
		def getValueColor(v: Double, delta: Double, min: Double, max: Double) = if (v != max) (((v - min) / delta).asInstanceOf[Number].intValue() + 1) else ((v - min) / delta).asInstanceOf[Number].intValue()
		val colorRange = colorRan
		val top = listValues.maxBy(_._2)._2.asInstanceOf[Number].doubleValue()
		val bot = listValues.minBy(_._2)._2.asInstanceOf[Number].doubleValue()
		val deltaColor = (top - bot) / colorRange
		val auxl = listValues.map(x => Values(x._1._1, x._1._2, x._2, getValueColor(x._2, deltaColor, bot, top)))


		val res = Graphic("Heatmap", axisX, axisY, auxl.toList)


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
				("axisX" -> v.axisX) ~
				("axisY" -> v.axisY) ~ 
				("valueCount" -> v.value) ~
				("valueColor" -> v.valueColor)
			})

		println(pretty(render(json)))
		compact(render(json))
		
	}

}