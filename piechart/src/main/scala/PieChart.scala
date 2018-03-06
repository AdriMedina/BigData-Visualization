
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.SQLContext
import org.apache.spark.SparkContext._
import scala.collection.mutable.ListBuffer
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.PieChart]] instances. */

object PieChart {

	/** Case class for resume values.
	*
	*/
	case class Values(colKey: String, colValue: Double)
	case class Graphic(title: String, colSelected: String, colCount: String, lvalues: List[Values])

	/** Computes the intervals to represent a Pie Chart 
	* 
	*  @param df dataframe with data
	*  @param colSelected column selected to grouped
	*  @param colCount column to apply operation
	*  @param idPlot plot identificator
	*/
	def computePieChartContinuous(sqlContext: SQLContext, df: DataFrame, colSelected: String, colCount: String, op:Int, idPlot: String) : String = {

		import sqlContext.implicits._

		var opVal = op

		val listValues = opVal match {
			// Count
			case 0 => df.select(colSelected, colCount)
						.map(x => x(0).toString.asInstanceOf[String] -> x(1).asInstanceOf[Number].doubleValue)
						.rdd.map(x => (x._1, 1L)).reduceByKey(_+_)
						.sortBy(_._1).collect
						.map(x => Values(x._1, x._2))
			// Sum
			case 1 => df.select(colSelected, colCount)
						.map(x => x(0).toString.asInstanceOf[String] -> x(1).asInstanceOf[Number].doubleValue)
						.rdd.reduceByKey(_+_)
						.sortBy(_._1).collect
						.map(x => Values(x._1, x._2))
			// Max
			case 2 => df.select(colSelected, colCount)
						.map(x => x(0).toString.asInstanceOf[String] -> x(1).asInstanceOf[Number].doubleValue)
						.rdd.reduceByKey(Math.max(_,_))
						.sortBy(_._1).collect
						.map(x => Values(x._1, x._2))
			// Min
			case 3 => df.select(colSelected, colCount)
						.map(x => x(0).toString.asInstanceOf[String] -> x(1).asInstanceOf[Number].doubleValue)
						.rdd.reduceByKey(Math.min(_,_))
						.sortBy(_._1).collect
						.map(x => Values(x._1, x._2))

			// Default
			case _ => df.select(colSelected, colCount)
						.map(x => x(0).toString.asInstanceOf[String] -> x(1).asInstanceOf[Number].doubleValue)
						.rdd.map(x => (x._1, 1L)).reduceByKey(_+_)
						.sortBy(_._1).collect
						.map(x => Values(x._1, x._2))
		}


		/** Get result into JSON String and return
		*
		*/
		val res = Graphic("PieChart", colSelected, colCount, listValues.toList)
		implicit val formats = DefaultFormats

		val json =
			("id_plot" -> idPlot) ~
			("title" -> res.title) ~
			("colSelected" -> res.colSelected) ~
			("colCount" -> res.colCount) ~
			("lvalues" -> res.lvalues.map { lv =>
				("colKey" -> lv.colKey) ~
				("colValue" -> lv.colValue)
			})

		//print(pretty(render(json)))
		compact(render(json))
		
	}

}