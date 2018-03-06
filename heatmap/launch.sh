#! /bin/bash

# Compile with sbt assembly before

spark-submit --class "Main" --master local ./target/scala-2.11/Heatmap-assembly-1.0.jar "mongodb://localhost:27017/" "vbd" "collectResult" "/datosTest/UGR2014_tst.csv" "PredSS_r1_-1" "PredSS_r1" "separation" 0 9 1000