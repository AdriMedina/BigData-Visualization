#! /bin/bash

# Compile with sbt assembly before

spark-submit --class "Main" --master local ./target/scala-2.11/PieChart-assembly-1.0.jar "mongodb://localhost:27017/" "pieChart" "test1" "/datosTest/1000_ECBDL14_10tst.data" 1000 "f3" "f4" 3