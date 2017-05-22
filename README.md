# wn8_expected
Scripts and resources to update wn8 expected values. This is a work in progress, read: http://forum.wotlabs.net/index.php?/topic/26960-new-effort-to-create-tank-specific-values-for-wn8-rating/

- Install mongo and create a user for the wn8 db:
	
use wn8
db.createUser(
   {
     user: "username",
     pwd: "password",
     roles: [ "readWrite", "dbAdmin" ]
   }
)

- copy config.yml.template to config.yml
- edit config.yml with from your mongo database and a WG api key
- install node
- run "npm install" in the project directory
- run "node app.js"

The following functions take a long time, use a lot of bandswidth and hit the WG api servers pretty hard. Do this only if you're serious about using the data.

- visit http://localhost/generate_player_list to create a list of players. It will take approx 24h
- Once that is done visit http://localhost/generate_data to put the stats for those players in the db (you can close this and continue at a later time). It will take approx 5 days.
- Once that is done visit http://localhost/create_csv to output the stats to a csv file that van be parsed by the R script. 

Note: The these functions will occasionally print a "SOURCE_NOT_AVAILABLE" error. This is normal. The wg api sometimes responds with this error, the request will simply be retried.

Now you should have the statistics data in your mongo db and in a file called input.csv. Now to further process this:

- install R
- open the R console in the project directory and type 

install.packages("tidyverse")
install.packages("ff")
install.packages("DBI")
install.packages("devtools")
require(devtools)
install_github("agstudy/rsqlserver")

- Make sure you have an existing expected.csv file (the last version in your directory)

Then

- type 'source("expected_script.R", echo=T)', to create the csv file
- type 'source("plotter.R", echo=T)', to generate some plots, see the script for more details

Alternatively

- visit http://localhost/create_min_csv, to create a minimal input.csv file (with tank titles/tier/etc stripped)
- type 'source("expected_min.R", echo=T)', to create the csv file
- type 'source("plotter_min.R", echo=T)', to generate some plots, see the script for more details

Alternatively

- visit http://localhost/create_min_csv, to create a minimal input.csv file (with tank titles/tier/etc stripped)
- type 'source("weighted.R", echo=T)', to create the csv file
- type 'source("plotter_weighted.R", echo=T)', to generate some plots, see the script for more details

Note: These steps all take a little bit of time of to complete, especially the weighted ones. They also require quite bit of memory 10GB-64GB, if you don't have this amount of RAM memory, make sure you allocate some swap space/pagefiles and be prepared to not use you computer for a little while :). It's best to test the steps first with a smaller sample.

As a last step there is a "node generate_xml_json_csv.js expected_values_file version" that generates expected values files in csv and json format compatible with wnefficiency.net.

You can use "node validate.js json_expected_file" to calculate correlation between wr-wn8, it takes expected values in json format as the first parameter.


