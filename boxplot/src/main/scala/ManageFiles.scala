
import org.apache.spark.sql.SQLContext
import org.apache.spark.SparkContext
import org.apache.spark.sql.DataFrame
import com.mongodb.spark._
import com.mongodb.spark.config._
import org.bson.Document



/** Factory for [[mypackage.ManageFiles]] instances. */

object ManageFiles {

	/** Load CSV file with a given name (archivo) and sqlContext
	* 
	*  @param archivo path or name of the datafile
	*  @param sqlContext 
	*/
	def loadCSV(archivo: String, sqlContext: SQLContext) = sqlContext.read.format("com.databricks.spark.csv").option("header", "true").option("inferSchema", "true").load(archivo)


	/** Load JSON file with a given name (archivo) and sqlContext
	* 
	*  @param archivo path or name of the datafile
	*  @param sqlContext 
	*/
	def loadJSON(archivo: String, sqlContext: SQLContext) = sqlContext.read.json(archivo)


	/** Save CSV file with a given name (archivo) and dataframe
	* 
	*  @param archivo path or name of the datafile
	*  @param df DataFrame source
	*/
	def saveCSV(archivo: String, df: DataFrame) = df.coalesce(1).write.format("com.databricks.spark.csv").option("header", "true").save(archivo)

	/** Save JSON file with a given name (archivo) and dataframe
	* 
	*  @param archivo path or name of the datafile
	*  @param df DataFrame source
	*/
	def saveJSON(archivo: String, df: DataFrame) = df.write.json(archivo)

	/** Save JSON string into MongoDB
	* 
	*  @param jsonData JSON string to save into MongoDB
	*  @param sc SparkContext
	*  @param uri Uri to MongoDB
	*  @param database Database in MongoDB
	*  @param collection Collection in MongoDB
	*/
	def saveJSONintoMONGO(jsonData: String, sc: SparkContext, uri: String, database: String, collection: String) = {
		val writeConfig = WriteConfig(Map("uri" -> uri, "database" -> database, "collection" -> collection))
		val doc = sc.parallelize(Seq(Document.parse(jsonData)))
		MongoSpark.save(doc, writeConfig)
	}

}