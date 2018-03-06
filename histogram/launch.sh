#! /bin/bash

# Compile with sbt assembly before

spark-submit --class "Main" --master local ./target/scala-2.11/Histogram-assembly-1.0.jar "mongodb://localhost:27017/" "vbd" "collectResult" "/datosTest/1000_ECBDL14_10tst.data" "f2" 5 1000 

# spark-submit --class "Main" --master spark://adri-pc:7077 ./target/scala-2.11/Histogram-assembly-1.0.jar "mongodb://localhost:27017/" "vbd" "collectResult" "/datosTest/1000_ECBDL14_10tst.data" "f2" 5 1000 