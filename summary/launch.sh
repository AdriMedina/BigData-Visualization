#! /bin/bash

# Compile with sbt assembly before

spark-submit --class "Main" --master local ./target/scala-2.11/Summary-assembly-1.0.jar "mongodb://localhost:27017/" "summary" "test1" "hdfs://localhost:50070/datosTest/UGR2014_tst.csv" 1000
#spark-submit --class "Main" --master local ./target/scala-2.11/Summary-assembly-1.0.jar "mongodb://localhost:27017/" "summary" "test1" "hdfs://localhost:9000/datosTest/UGR2014_tst.csv" 1000