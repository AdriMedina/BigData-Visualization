#! /bin/bash

# Compile with sbt assembly before

spark-submit --class "Main" --master local ./target/scala-2.11/ScatterPlot-assembly-1.0.jar "mongodb://localhost:27017/" "scatterplot" "test1" "/datosTest/1000_ECBDL14_10tst.data" "f3" "f4" 4 4 5 1000