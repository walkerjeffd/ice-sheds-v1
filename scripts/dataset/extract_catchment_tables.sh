#!/bin/bash
# create covariates table for crossfilter
# usage: ./extract_catchment_tables.sh <dbname> <user>

set -eu

DB=$1
USER=$2

HUC12_FILE=catchment_huc12.csv
HUC12_SQL="COPY (SELECT featureid, huc12 FROM data.catchment_huc12)
           TO STDOUT DELIMITER ',' CSV HEADER;"
STATE_FILE=catchment_state.csv
STATE_SQL="COPY (SELECT featureid, stusps FROM data.catchment_state)
           TO STDOUT DELIMITER ',' CSV HEADER;"

echo ------------------------------------------
if [ ! -e $HUC12_FILE ]; then
  echo Create $HUC12_FILE from database...
  psql -d "$DB" -c "$HUC12_SQL" -U "$USER" > $HUC12_FILE
else
  echo File $HUC12_FILE already exists, delete it first to re-create
fi

echo ------------------------------------------
if [ ! -e $STATE_FILE ]; then
  echo Create $STATE_FILE from database...
  psql -d "$DB" -c "$STATE_SQL" -U "$USER" > $STATE_FILE
else
  echo File $STATE_FILE already exists, delete it first to re-create
fi
