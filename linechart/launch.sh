#! /bin/bash

# Compile with sbt assembly before

spark-submit --class "Main" --master local ./target/scala-2.11/LineChart-assembly-1.0.jar "mongodb://localhost:27017/" "lineChart" "test1" "/datosTest/1000_ECBDL14_10tst.data" 1000 4 "f3" 3 "f4" "f5" "f6"