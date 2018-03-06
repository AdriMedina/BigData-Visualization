name := "Summary"

version := "1.0"

scalaVersion := "2.11.6"

libraryDependencies ++= Seq(
	"org.apache.spark" %% "spark-core" % "2.0.0" % "provided",
	"org.apache.spark" %% "spark-sql" % "2.0.0" % "provided", 
	"com.databricks" %% "spark-csv" % "1.5.0" % "provided",
	"net.liftweb" %% "lift-json" % "2.6.3",
	"org.mongodb.spark" %% "mongo-spark-connector" % "1.1.0"
)
