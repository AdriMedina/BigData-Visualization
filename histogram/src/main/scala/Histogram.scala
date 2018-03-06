
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import scala.collection.mutable.ListBuffer
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.Histogram]] instances. */

object Histogram {

	/** Case class for intervals values. 
	*
	*/
	case class Segments(min: Double, max: Double, count: Long)
	case class Values(chart: String){
		var intervals = List[Segments]()
	}
	


	/** Computes the intervals to represent a histogram 
	* 
	*  @param df dataframe with data
	*  @param colName name of the selected column
	*  @param intervalNum number of intervals
	*/
	def computeHistogramContinuous(df: DataFrame, colName: String, intervalNum: Int, idPlot: String) : String = {

		/** Minimum and maximum values of dataframe. NumCol (number of histogram bars). interval (Segments to count values)
		*
		*/
		val minimum = df.select(min(colName)).first().apply(0).asInstanceOf[Number].doubleValue()
		val maximum = df.select(max(colName)).first().apply(0).asInstanceOf[Number].doubleValue()
		val numCol = if (intervalNum <= 0) 1 else intervalNum;	
		val interval = (maximum - minimum) / numCol


		/** Count the number of values per segment
		*
		*/
		var initInterval = minimum
		var endInterval = initInterval + interval
		var listSeg = ListBuffer[Segments]()
		var i = 0
		for(i <- 1 to numCol){
			if(i < numCol)
				listSeg += Segments(initInterval, endInterval, df.filter(df(colName) >= initInterval && df(colName) < endInterval).count())
			else
				listSeg += Segments(initInterval, maximum, df.filter(df(colName) >= initInterval && df(colName) <= maximum).count())			
			
			initInterval = endInterval
			endInterval = initInterval + interval
		}


		/** Get result into JSON String and return
		*
		*/
		implicit val formats = DefaultFormats
		val res = Values("histogram")
		res.intervals = listSeg.toList

		val json =
				("id_plot" -> idPlot) ~
				("values" ->
					("type" -> res.chart) ~
					("segments" -> listSeg.map { s => 
						("min" -> s.min) ~
						("max" -> s.max) ~
						("count" -> s.count)
					})
				)
		compact(render(json))

	}

}