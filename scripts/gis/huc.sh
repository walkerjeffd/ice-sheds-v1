#!/bin/bash

# CREATE TABLE huc12 AS (
#   SELECT * FROM gis.wbdhu12
#   WHERE huc12 IN (SELECT huc12 FROM catchment_huc12)
# );

HUC2S="01 02 03 04 05 06"

for HUC2 in $HUC2S; do
  echo Extracting HUC2=$HUC2...
  # if [ -e huc12-$HUC2.geojson ]; then
  #   echo Removing huc12-$HUC2.geojson
  #   rm huc12-$HUC2.geojson
  # fi

  if [ ! -e huc12-$HUC2.geojson ]; then
    SQL="SELECT * FROM huc12 WHERE substr(huc12, 1, 2)='$HUC2' AND huc12 IN (SELECT huc12 FROM catchment_huc12)"

    echo Creating huc12-$HUC2.geojson
    ogr2ogr -f GeoJSON huc12-$HUC2.geojson PG:"host=alewife.local dbname=sheds user=jeff password=wGgY2fX3toyLmVLC" -sql "$SQL" -clipsrc states_boundary.shp
  else
    echo File huc12-$HUC2.geojson already exists, skipping...
  fi

  echo Creating huc12-$HUC2.topojson...
  topojson -o huc12-$HUC2.topojson -s 0.000000001 --id-property huc12 --properties name=name huc12-$HUC2.geojson
done
