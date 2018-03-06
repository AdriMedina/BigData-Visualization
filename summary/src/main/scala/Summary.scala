
import org.apache.spark.sql.functions._
import org.apache.spark.sql.DataFrame
import org.apache.spark.sql.Row
import org.apache.spark.rdd.RDD
import org.apache.spark.rdd
import org.apache.spark.util.SizeEstimator
import scala.collection.mutable.ListBuffer
import java.io.File
import net.liftweb.json._
import net.liftweb.json.JsonDSL._



/** Factory for [[mypackage.Summary]] instances. */

object Summary {

	/** Case class for summary information. 
	*
	*/
	case class ColumnInfo(value: String, typeCol: String)
	case class Values(name: String, path: String, size: Long, numCols: Long, numRows: Long, nameCols: List[ColumnInfo])


	/** Computes the intervals to represent a Summary 
	* 
	*  @param df Dataframe with data
	*  @param path Path to file
	*/
	def computeSummaryContinuous(df: DataFrame, pathFile: String, idPlot: String) : String = {

		def getSize (pathFile: String) : Long = {
			val hdfs: org.apache.hadoop.fs.FileSystem =
			  org.apache.hadoop.fs.FileSystem.get(
			    new org.apache.hadoop.conf.Configuration())

			val hadoopPath= new org.apache.hadoop.fs.Path(pathFile)
			val recursive = false
			val ri = hdfs.listFiles(hadoopPath, recursive)
			val it = new Iterator[org.apache.hadoop.fs.LocatedFileStatus]() {
			  override def hasNext = ri.hasNext
			  override def next() = ri.next()
			}

			// Materialize iterator
			val files = it.toList
			files.map(_.getLen).sum
		}

		var size = getSize(pathFile)
		var numCols = df.columns.length
		var numRows = df.count()

		//var nameCols = df.columns.toList
		var nameCols = df.dtypes.map(x => ColumnInfo(x._1, (x._2).replace("Type", ""))).toList
		

		/** Get result into JSON String and return
		*
		*/
		implicit val formats = DefaultFormats
		val res = Values("Summary", pathFile, size, numCols, numRows, nameCols)
		val json =
			("id_plot" -> idPlot) ~
			("values" ->
				("name" -> res.name) ~
				("path" -> res.path) ~
				("size" -> res.size) ~
				("numCols" -> res.numCols) ~
				("numRows" -> res.numRows) ~
				("nameCols" -> res.nameCols.map { s =>
					("value" -> s.value) ~
					("typeCol" -> s.typeCol)
				})
			)

		println(pretty(render(json)))
		compact(render(json))

	}

}