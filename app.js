"use strict";

var fs = require('fs');
var profiler = require('v8-profiler');
var config = require('config-yml');
var express = require('express')
var router = express.Router();
var bodyParser = require('body-parser');
var compress = require('compression');
var request = require('request');
var MongoClient = require('mongodb').MongoClient;
var app = express();

var tank_data;
request("https://api.worldoftanks.eu/wot/encyclopedia/tanks/?application_id=" + config.wg.api_key + "&fields=tank_id,type,name,level,nation", function (error, response, data) {

tank_data = JSON.parse(data).data;

app.use(compress());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// not pretty but oh so handy to not crash
process.on('uncaughtException', function (err) {
	console.log(err);
	console.log(err.stack);	
});
process.on('unhandledRejection', function(error, promise) {
  console.error("UNHANDLED REJECTION");
  throw(error);
});

//This part initialises db and remote_db
var connection_string =  config.mongo.connect_string;
console.log("Connecting to: ", connection_string)
//connect to local db
MongoClient.connect('mongodb://'+connection_string, function(err, db) {
if(err) throw err;	
//auth local db
db.authenticate(config.mongo.username, config.mongo.password, function(err) {	
if(err) throw err;

var servers = ["kr", "asia", "com", "eu", "ru"]

function get_server(id) {
	if(id > 3000000000){return "kr";}
	if(id > 2000000000){return "asia";}
	if(id > 1000000000){return "com";}
	if(id > 500000000){return "eu";}
	return "ru";
}

function get_wg_data(page, fields, player, cb) {
	var server;
	if (Array.isArray(player)) {
		server = get_server(player[0]);
	} else {
		server = get_server(player);
	}
	var link = "http://api.worldoftanks." + server + "/wot" + page;
	link += "application_id=" + config.wg.api_key;
	link += "&account_id=";
	if (Array.isArray(player)) {
		for (var i in player) {
			link += player[i] + ","; 
		}
	} else {
		link += player;
	}
	if (Array.isArray(player)) {
		link = link.slice(0,-1);
	}
	if (fields && fields.length > 0) {
		link += "&fields=";
		for (var i in fields) {
			var field = fields[i];
			link += field + ",";
		}
		link = link.slice(0,-1);
	}
	request(link, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var data = JSON.parse(body);
			if (data.status == "error") {
				console.error("Error fetching link: " + link);
				console.error(data);
				cb(null, data);
			} else {
				if (Array.isArray(player)) {
					cb(data.data);
				} else {
					cb(data.data[player]);
				}
			}
		} else { 
			console.error(response.statusCode + ": "+ error)
			cb(null, error);
		}
	});	
}

function generate_player_list() {
	new Promise (function(resolve) {
		function loop(i) {
			if (i < 540000000) {
				var a100_players = [];
				for (var j = 0; j < 100 && i < 540000000; j++) {
					a100_players.push(i++);
				}
				get_wg_data("/account/info/?extra=statistics.random&", ["statistics.random.battles"], a100_players, function(data, e) {
					if (e) {
						i -= 100; //try this again
					} else {
						for (let key of Object.keys(data)) {
							if (data[key] && data[key].statistics.random.battles > 1000) {
								db.collection('players').updateOne({_id:key}, {$set: {battles:data[key].statistics.random.battles}}, {upsert: true});
							}
						}
						
					}
				})	
				setTimeout(() => {
					loop(i);
				}, 150);
			} else {
				resolve();
			}	
		}
		loop(500000000);
	}).then(() => {
		console.log("Done building player list")
	})
}

//fisher-yates shuffle from: http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
function shuffle(array) {
    let counter = array.length;
    // While there are elements in the array
    while (counter > 0) {
        // Pick a random index
        let index = Math.floor(Math.random() * counter);
        // Decrease counter by 1
        counter--;
        // And swap the last element with it
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }
    return array;
}

//borrowed from http://stackoverflow.com/questions/22697936/binary-search-in-javascript
function binarySearch(ar, el, compare_fn) {
	var m = 0;
	var n = ar.length - 1;
	while (m <= n) {
		var k = (n + m) >> 1;
		var cmp = compare_fn(el, ar[k]);
		if (cmp > 0) {
			m = k + 1;
		} else if(cmp < 0) {
			n = k - 1;
		} else {
			return k;
		}
	}
	return -m - 1;
}

function download_stats() {
	var promise = db.collection('players').find({},{_id:true}).toArray();
	var fields = ["tank_id", "random.battles", "random.wins", "random.damage_dealt", "random.frags", "random.spotted", "random.dropped_capture_points"];
	
	promise.then(function(players) {
		players = players.map((x) => {return x._id});

		//take a random sample
		players = shuffle(players);
		players = players.slice(0, 5);
				
		var file = fs.createWriteStream('input.csv', { flags: 'w' });
		file.write('"userid","compDescr","title","type","tier","countryid","battles","victories","damage_dealt","frags","spotted","defence_points"\n');
		
		new Promise (function(resolve) {
			function loop(i) {
				if (i < players.length) {					
					get_wg_data("/tanks/stats/?extra=random&", fields, players[i], function(data, e) {
						if (e) {
							i--;  //try this again
						} else {
							var tanks = {}
							for (let tank of data) {
								if (tank_data[tank.tank_id] && tank.random.battles >= 50) { //better to prune early
									var tank_summary = {}
									tank_summary.userid = players[i];
									tank_summary.compDescr = tank.tank_id;
									tank_summary.title = tank_data[tank.tank_id].name;
									tank_summary.type = tank_data[tank.tank_id].type;
									tank_summary.tier = tank_data[tank.tank_id].level;
									tank_summary.countryid = tank_data[tank.tank_id].nation;
									tank_summary.battles = tank.random.battles;
									tank_summary.victories = tank.random.wins;
									tank_summary.damage_dealt = tank.random.damage_dealt;
									tank_summary.frags = tank.random.frags;							
									tank_summary.spotted = tank.random.spotted;
									tank_summary.defence_points = tank.random.dropped_capture_points;
									tanks[tank.tank_id] = tank_summary;
								}
							}
							
							//important for reset accounts, their vehicle stats sometimes show outdated data
							get_wg_data("/account/tanks/?", ["tank_id"], players[i], function(valid_tanks) {
								if (e) {
									i--; //try this again
								} else {
									valid_tanks = valid_tanks.map((x) => {return parseInt(x.tank_id)})
									valid_tanks.sort((a,b) => { return a-b });
									var to_remove = []
									for (var key in tanks) {
										var pos = binarySearch(valid_tanks, key, (a,b) => {return a-b});
										if (pos < 0) {					
											to_remove.push(key);
										}
									}
									for (let key of to_remove) {
										delete tanks[key];
									}
									//output data to csv
									for (var key in tanks) {
										var tank = tanks[key];
										var output = tank.userid + "," + tank.compDescr + "," + tank.title + "," + 
											tank.type + "," + tank.tier + "," + tank.countryid + "," + tank.battles + "," +
											tank.victories + "," + tank.damage_dealt + "," + tank.frags + "," +
											tank.spotted + "," + tank.defence_points + "\n";
										file.write(output);
									};
									
									//output the data to the DB
									console.log("uploading");
									db.collection('statistics').updateOne({_id:parseInt(players[i])}, {tanks:tanks}, {upsert: true});
									
								}
							});
						}
					});
					setTimeout(() => {
						loop(++i);
					}, 1000);
				} else {
					resolve();
				}
			}
			loop(0);
		}).then(() => {
			setTimeout(() => { //give it some time to finish fetching the data/writing to files, etc
				file.end();
				console.log("Downloading stats done")
			}, 20000);
		})
	})
}

download_stats()

router.get('/generate_player_list', function(req, res, next) {
	generate_player_list();
	res.send("Generating player list started");
});

router.get('/generate_data', function(req, res, next) {
	res.send("Generating data started");
	download_stats();
});

app.use('/', router);
app.listen(80, function () {
	console.log('App listening on port ' + 80)
})


});}); //end open mongo databases
	
}); //end get tankdata from wg api