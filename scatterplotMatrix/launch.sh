#! /bin/bash

# Compile with sbt assembly before

spark-submit --class "Main" --master local ./target/scala-2.11/ScatterPlotMatrix-assembly-1.0.jar "mongodb://localhost:27017/" "scatterplotMatrix" "test1" "/datosTest/1000_ECBDL14_10tst.data" 1000 3 "f2" "f3" "f5"