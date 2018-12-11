#!/bin/bash
# create ICE dataset
# usage: ./make_dataset.sh <dbname> <user>
set -eu

DB_NAME=$1
DB_USER=$2

echo ------------------------------------------
echo Fetching catchment tables
bash extract_catchment_tables.sh $DB_NAME $DB_USER

echo ------------------------------------------
echo Create dataset.csv using R script...
Rscript merge_datasets.R "$DB_NAME"

echo ------------------------------------------
echo Gzipping...
gzip -kv dataset.csv

echo ------------------------------------------
if [ -e dataset.csv.gz ]; then
  echo File dataset.csv.gz created, now you can copy it to ../../public/data
else
  echo Failed to create dataset.csv.gz!

