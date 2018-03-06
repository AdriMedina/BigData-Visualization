
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.SQLContext
import org.apache.spark.SparkContext._
import scala.collection.mutable.ListBuffer
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.ScatterplotMatrix]] instances. */

object ScatterplotMatrix {

	/** Case class for resume values.
	*
	*/
	case class Values(pointX: Double, pointY: Double, value: Double)
	case class AxisXY(titleX: String, titleY: String, posX: Int, posY: Int, lvalues: List[Values])
	case class Graphic(title: String, laxis: List[AxisXY])

	/** Computes all the ranges of the selected columns to represent a ScatterplotMatrix 
	* 
	*  @param df dataframe with data
	*  @param nameCols name of the columns selected()
	*/
	def computeScatterplotMatrixContinuous(sqlContext: SQLContext, df: DataFrame, sec: Int, nameCols: Array[String], idPlot: String) : String = {

		import sqlContext.implicits._

		/* Define number of sections for axis
		*
		*/
		val sectionsX = sec
		val sectionsY = sec


		/* Generate all column combinations
		*
		*/
		val listAxisXY = ListBuffer[AxisXY]()
		for (i <- nameCols.indices) yield {
			var j = -1;
			nameCols.map{y => j+= 1; getScatterplotValues(nameCols(i), y, i, j)}
		}


		/** Compute the interval of the axis
		* 
		*  @param axisX column that represent axis X
		*  @param axisY column that represent axis Y
		*/
		def getScatterplotValues(axisX: String, axisY: String, posX: Int, posY: Int) = {

			/* Define min and max values of the dataframe, numbers of sections (or blocks) for axis and size of interval for axis
			*
			*/
			val minX = df.select(min(axisX)).first().apply(0).asInstanceOf[Number].doubleValue()
			val maxX = df.select(max(axisX)).first().apply(0).asInstanceOf[Number].doubleValue()
			val minY = df.select(min(axisY)).first().apply(0).asInstanceOf[Number].doubleValue()
			val maxY = df.select(max(axisY)).first().apply(0).asInstanceOf[Number].doubleValue()
			val deltaX = (maxX - minX) / sectionsX
			val deltaY = (maxY - minY) / sectionsY

			/* Defines the functions that limit the section to which a value belongs
			*
			*/
			def funcionBloque(v: Double, delta: Double, min: Double, sections: Int) = {val b = ((v - min) / delta).asInstanceOf[Number].intValue(); if(b != sections) (delta*b)+min else ((delta*b)+min)-delta}
			
			
			/* Assign the values to the corresponding sections and compute the centroid
			*
			*/
			var listValues = df.select(axisX, axisY)
						.map(x => ((funcionBloque(x(0).asInstanceOf[Number].doubleValue(), deltaX, minX, sectionsX), funcionBloque(x(1).asInstanceOf[Number].doubleValue(), deltaY, minY, sectionsY)), 1))
						.rdd.reduceByKey(_+_)
						.map{case (k, v) => ((k._1 * 2 + deltaX)/2, (k._2 * 2 + deltaY)/2) -> v}
						.collect
						.map(x => Values(x._1._1, x._1._2, x._2))


			val axisValues = AxisXY(axisX, axisY, posX, posY, listValues.toList);

			listAxisXY += axisValues

		}

		/** Get result into JSON String and return
		*
		*/
		val res = Graphic("ScatterplotMatrix", listAxisXY.toList)
		implicit val formats = DefaultFormats

		val json =
			("id_plot" -> idPlot) ~
			("title" -> res.title) ~
			("listAxis" -> res.laxis.map { la =>
				("titleX" -> la.titleX) ~
				("titleY" -> la.titleY) ~
				("posX" -> la.posX) ~
				("posY" -> la.posY) ~
				("values" -> la.lvalues.map { v =>
					("pointX" -> v.pointX) ~
					("pointY" -> v.pointY) ~ 
					("value" -> v.value)
				})
			})

		compact(render(json))
		
	}

}