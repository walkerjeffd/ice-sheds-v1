#!/bin/Rscript
# usage: Rscript merge_datasets.R

suppressPackageStartupMessages(library(tidyverse))
suppressPackageStartupMessages(library(RPostgreSQL))

args <- commandArgs(trailingOnly = TRUE)

# covariates
drv <- dbDriver("PostgreSQL")
con <- dbConnect(
  drv,
  dbname = "sheds_new",
  host="osensei.cns.umass.edu",
  user = getOption("SHEDS_OSENSEI_USERNAME"),
  password = getOption("SHEDS_OSENSEI_PASSWORD")
)

# list covariate variables
# dbSendQuery(con, "SELECT DISTINCT variable FROM covariates;") %>%
#   fetch(n=-1) %>%
#   arrange(variable)

# fetch local covariates
cov_localQuery <- dbSendQuery(con, "SELECT featureid, variable, value FROM covariates WHERE variable IN ('AreaSqKM', 'elevation', 'forest', 'agriculture', 'jun_prcp_mm', 'jul_prcp_mm', 'aug_prcp_mm') AND zone = 'local' AND riparian_distance_ft IS NULL;")
cov_local <- fetch(cov_localQuery, n=-1)
cov_local <- cov_local %>%
  spread(variable, value)
summary(cov_local)

# compute summer mean precip
cov_local <- mutate(cov_local, summer_prcp_mm=(jun_prcp_mm+jul_prcp_mm+aug_prcp_mm)/3) %>%
  select(-jun_prcp_mm, -jul_prcp_mm, -aug_prcp_mm)
summary(cov_local)
nrow(cov_local)

# fetch upstream covariates
cov_upQuery <- dbSendQuery(con, "SELECT featureid, variable, value FROM covariates WHERE variable = 'AreaSqKM' AND zone = 'upstream' AND riparian_distance_ft IS NULL;")
cov_up <- fetch(cov_upQuery, n=-1)
cov_up <- cov_up %>%
  spread(variable, value) %>%
  rename(UpAreaSqKM=AreaSqKM)
summary(cov_up)
nrow(cov_up)

# merge covariates
cov <- left_join(cov_local, cov_up, by = "featureid")
summary(cov)
nrow(cov)

# add huc and state columns
hucs <- read_csv("catchment_huc12.csv", col_types = cols(
  featureid = col_double(),
  huc12 = col_character()
))
states <- read_csv("catchment_state.csv", col_types = cols(
  featureid = col_double(),
  stusps = col_character()
))

derived_fish <- read_csv("~/Projects/sheds/data/bto-model/1.0/model-predict.csv", col_types = cols(
  .default = col_double(),
  featureid = col_integer(),
  huc12 = col_character()
))
derived_fish <- derived_fish %>%
  select(
    featureid,
    occ_current,
    plus2 = occ_temp7p20,
    plus4 = occ_temp7p40,
    plus6 = occ_temp7p60,
    max_temp_0.3 = max_temp7p_occ30,
    max_temp_0.5 = max_temp7p_occ50,
    max_temp_0.7 = max_temp7p_occ70
  )

include_featureids <- read_csv("~/Projects/sheds/data/bto-model/20160321/bkt_range_10km_featureids.csv", col_types = cols(
  FEATUREID = col_integer()
))
derived_fish <- filter(derived_fish, as.character(featureid) %in% as.character(include_featureids$FEATUREID))

summary(derived_fish)
nrow(derived_fish)

# stream temperature model
# derived_temp <- read.csv('~/Projects/sheds/model/20160226/derived_site_metrics.csv', stringsAsFactors=FALSE)
# derived_temp <- select(derived_temp, featureid, meanSummerTemp, meanDays.18, meanDays.22)

derived_temp <- read_csv("~/Projects/sheds/data/temp-model/1.0/model-predict-derived.csv", col_types = cols(
  featureid = col_double(),
  mean_max_temp = col_double(),
  max_max_temp = col_double(),
  mean_jun_temp = col_double(),
  mean_jul_temp = col_double(),
  mean_aug_temp = col_double(),
  mean_summer_temp = col_double(),
  max_temp_30d = col_double(),
  n_day_temp_gt_18 = col_double(),
  n_day_temp_gt_20 = col_double(),
  n_day_temp_gt_22 = col_double(),
  resist = col_double()
))
derived_temp <- derived_temp %>%
  select(
    featureid,
    meanSummerTemp = mean_summer_temp,
    meanDays.18 = n_day_temp_gt_18,
    meanDays.22 = n_day_temp_gt_22
  )

summary(derived_temp)
nrow(derived_temp)

# merge huc12, state, cov and derived
df <- hucs %>%
  left_join(states, by = "featureid") %>%
  filter(stusps %in% c("ME","NH","VT","MA","RI","CT","NY","NJ","PA","DE","MD","DC","WV","VA")) %>%
  left_join(cov, by = "featureid") %>%
  left_join(derived_fish, by = "featureid") %>%
  left_join(derived_temp, by = "featureid")

# replace dots with underscores in column names
names(df) <- str_replace(names(df), "[.]", "_")

glimpse(df)

df_rnd <- mutate_at(df, vars(agriculture:meanDays_22), funs(round(., digits=4)))

df_rnd %>%
  arrange(featureid) %>%
  write_csv("dataset-20181025.csv", na = "")
