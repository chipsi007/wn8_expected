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

WARNING: The following functions take a long time, use a lot of bandswidth and hit the WG api servers pretty hard, do this only if you're serious.

To start creating a list of players, visit http://localhost/generate_player_list. Once that is done visit http://localhost/generate_data

Now you should have the statistics data in your mongo db and in a file called input.csv. Now to further process this:

- install R
- open the R console in the project directory and type "install.packages("tidyverse")"
- Make sure you have an existing expected.csv file (the last version in your directory)
- type 'source("expected_script.R")'

If everything is correct this should generate an output date.csv file.

You can use "node validate.js" to calculate correlation between wr-wn8, using the data downloaded and "expected.json" in json format. 