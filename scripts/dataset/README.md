# ICE Dataset File

First extract the catchment/huc12 and catchment/state tables from the database

```bash
./extract_catchment_tables.sh
```

Then step through R script `merge_datasets.R` to load tables, extract covariates, get derived metrics from data local filesystem, and save results to `dataset.csv`.



```bash
./make_dataset.sh <dbname> <user>
```

This script will:

1. download derived metrics from dropbox (`derived.csv`)
2. create a table of featureid and associated huc12 (`catchment_huc12.csv`)
3. create a table of featureid and associated state (`catchment_state.csv`)
4. merge these tables with the covariates in the database and save to `dataset.csv`
5. gzip the result to `dataset.csv.gz`
