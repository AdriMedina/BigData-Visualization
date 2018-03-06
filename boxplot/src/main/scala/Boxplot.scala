
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.SQLContext
import scala.collection.mutable.ListBuffer
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.Boxplot]] instances. */

object Boxplot {

	/** Case class for resume values.
	*
	*/
	case class Values(min: Double, quartil1: Double, median: Double, quartil3: Double, max: Double, iqr: Double)
	case class Boxes(column: String, values: Values)
	case class Graphic(chart: String, lboxes: List[Boxes])


	/** Computes the intervals to represent a Boxplot 
	* 
	*  @param df dataframe with data
	*  @param nameCols name of the columns selected
	*/
	def computeBoxplotContinuous(sqlContext: SQLContext, df: DataFrame, nameCols: Array[String], idPlot: String) : String = {

		import sqlContext.implicits._

		/** Get all necesary values of each column
		*
		*/
		val listBoxes = ListBuffer[Boxes]()
		for(col <- nameCols){
			//var dfAux = df.select(col).sort(asc(col))
			//var mean = dfAux.select(mean(col))
			val medianAndQuantiles = df.stat.approxQuantile(col, Array(0,0.25,0.5,0.75,1),0)
			val iqr = medianAndQuantiles(3) - medianAndQuantiles(1)
			val valuesBox = Values(medianAndQuantiles(0), medianAndQuantiles(1), medianAndQuantiles(2), medianAndQuantiles(3), medianAndQuantiles(4), iqr)
			val box = Boxes(col, valuesBox)

			listBoxes += box
		}
		val res = Graphic("Boxplot", listBoxes.toList)


		/** Get result into JSON String and return
		*
		*/
		implicit val formats = DefaultFormats

		val json =
			("id_plot" -> idPlot) ~
			("title" -> res.chart) ~
			("boxes" -> res.lboxes.map { b =>
					("column" -> b.column) ~
					("values" -> 
						("min" -> b.values.min) ~
						("quartil1" -> b.values.quartil1) ~
						("median" -> b.values.median) ~
						("quartil3" -> b.values.quartil3) ~
						("max" -> b.values.max) ~
						("iqr" -> b.values.iqr)
					)
			})
			
		compact(render(json))
	}

}