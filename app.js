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
request("https://api.worldoftanks.ru/wot/encyclopedia/tanks/?application_id=" + config.wg.api_key + "&fields=tank_id,type,name,level,nation", function (error, response, data) {

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
			console.error(error)
			cb(null, error);
		}
	});	
}

//will request the battles count for players with [start_index, end_index[, in batches of 100
function generate_player_list() {
	var start_index = config.wg.start_index
	var end_index = config.wg.end_index
	var min_battles = config.wg.min_battles
	new Promise (function(resolve) {
		function loop(i, once) {
			if (i < end_index) {
				var a100_players = [];
				for (var j = 0; j < 100 && i < end_index; j++) {
					a100_players.push(i++);
				}
				get_wg_data("/account/info/?extra=statistics.random&", ["statistics." + [config.wg.src] + ".battles"], a100_players, function(data, e) {
					if (e) {
						console.error(e);
						setTimeout(() => { loop(i-100, true); }, 100); //try this batch again
						return;
					} else {
						for (let key of Object.keys(data)) {
							if (data[key] && data[key].statistics[src].battles >= min_battles) {
								db.collection('players').updateOne({_id:key}, {$set: {battles:data[key].statistics[src].battles}}, {upsert: true});
							}
						}
					}
				})
				if (!once) {
					setTimeout(() => { loop(i);	}, 100);
				}
			} else {
				resolve();
			}	
		}
		loop(start_index);
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
	var fields = ["tank_id", config.wg.src + ".battles", config.wg.src +"random.wins", config.wg.src +".damage_dealt", config.wg.src +".frags", config.wg.src +".spotted", config.wg.src + ".dropped_capture_points"];
	var promise = db.collection('players').find({},{_id:true}).toArray();
	promise.then(function(players) {
		players = players.map((x) => {return x._id});

		var promise = db.collection('statistics').find({},{_id:true}).toArray();
		promise.then(function(processed_players) {	
			processed_players = processed_players.map((x) => {return x._id});
			
			//remove the players we already processed
			let a = new Set(players);
			let b = new Set(processed_players);
			players = Array.from(new Set([...a].filter(x => !b.has(x))));
	
			//shuffle them
			players = shuffle(players);
			
			new Promise (function(resolve) {
				function loop(i, once) {
					if (i < players.length) {					
						get_wg_data("/tanks/stats/?extra=random&", fields, players[i], function(data, e) {
							if (e) {
								console.error(e);
								setTimeout(() => { loop(i, true); }, 100) //try this player again
								return;
							} else {
								var tanks = {}
								for (let tank of data) {
									if (tank[src].battles >= config.wg.min_tank_battles) {
										var tank_summary = {}
										tank_summary.userid = players[i];
										tank_summary.compDescr = tank.tank_id;
										if (tank_data[tank.tank_id]) {
											tank_summary.title = tank_data[tank.tank_id].name;
											tank_summary.type = tank_data[tank.tank_id].type;
											tank_summary.tier = tank_data[tank.tank_id].level;
											tank_summary.countryid = tank_data[tank.tank_id].nation;
										} else {
											tank_summary.title = String(tank.tank_id);
											tank_summary.type = String("unknown");
											tank_summary.tier = 0;
											tank_summary.countryid = String("unknown");											
										}
										tank_summary.battles = tank[src].battles;
										tank_summary.victories = tank[src].wins;
										tank_summary.damage_dealt = tank[src].damage_dealt;
										tank_summary.frags = tank[src].frags;							
										tank_summary.spotted = tank[src].spotted;
										tank_summary.defence_points = tank[src].dropped_capture_points;
										tanks[tank.tank_id] = tank_summary;
									}
								}
								
								//important for reset accounts, their vehicle stats sometimes show outdated data
								get_wg_data("/account/tanks/?", ["tank_id"], players[i], function(valid_tanks) {
									if (e) {
										console.error(e);
										setTimeout(() => { loop(i, true); }, 100) //try this player again
										return;
									} else {
										if (!valid_tanks) valid_tanks = [];
										valid_tanks = valid_tanks.map((x) => {return parseInt(x.tank_id)})
										valid_tanks.sort((a,b) => { return a-b });
										var to_remove = []
										for (var key in tanks) {
											var pos = binarySearch(valid_tanks, parseInt(key), (a,b) => {return a-b});
											if (pos < 0) {					
												to_remove.push(key);
											}
										}
										for (let key of to_remove) {
											delete tanks[key];
										}										
										//output the data to the DB
										db.collection('statistics').updateOne({_id:players[i]}, {tanks:tanks}, {upsert: true}, function(e) {
											if (e) {
												console.error(e);
												setTimeout(() => { loop(i, true); }, 100); //try this player again
												return;
											}
										});
									}
								});
							}
						});
						if (!once) {
							setTimeout(() => { loop(++i); }, 100); //do the next player
						}
					} else {
						resolve();
					}
				}
				loop(0);
			}).then(() => {
				console.log("Downloading stats done");
			})
		})
	})
}

function create_csv() {
	var outFile = fs.createWriteStream('input.csv', { flags: 'w' });
	outFile.write('"userid","compDescr","title","type","tier","countryid","battles","victories","damage_dealt","frags","spotted","defence_points"');	
	outFile.write('\n');
	
	db.collection('statistics').find({}).each(function (err, data) {
		//output data to csv
		if (data) {
			for (var key in data.tanks) {
				var tank = data.tanks[key];
				if (tank.battles >= config.csv.min_tank_battles) {
					var output = tank.userid + "," + tank.compDescr + "," + tank.title + "," + 
						tank.type + "," + tank.tier + "," + tank.countryid + "," + tank.battles + "," +
						tank.victories + "," + tank.damage_dealt + "," + tank.frags + "," +
						tank.spotted + "," + tank.defence_points;
					output += "\n";
					outFile.write(output);
				}
			};
		} else {
			console.log("done writing csv file");
			outFile.end();
		}
	});
}

function create_min_csv() {
	var outFile = fs.createWriteStream('input.csv', { flags: 'w' });
	outFile.write('"userid","compDescr","battles","victories","damage_dealt","frags","spotted","defence_points"');	
	outFile.write('\n');
	
	db.collection('statistics').find({}).each(function (err, data) {
		//output data to csv
		if (data) {
			for (var key in data.tanks) {
				var tank = data.tanks[key];
				if (tank.battles >= config.csv.min_tank_battles) {
					var output = tank.userid + "," + tank.compDescr + "," + tank.battles + "," +
						tank.victories + "," + tank.damage_dealt + "," + tank.frags + "," +
						tank.spotted + "," + tank.defence_points;
					output += "\n";
					outFile.write(output);
				}
			};
		} else {
			console.log("done writing csv file");
			outFile.end();
		}
	});
}

function fix_names() {
	db.collection('statistics').find({}).each(function (err, data) {
		if (data) {
			for (var key in data.tanks) {
				var tank = data.tanks[key];
				tank.title = tank_data[tank.compDescr].tag;
			}
			db.collection('statistics').updateOne({_id:data._id}, data, {upsert: true});
		} else {
			console.log("done")
		}
	})
}


router.get('/generate_player_list', function(req, res, next) {
	generate_player_list();
	res.send("Generating player list started");
});

router.get('/generate_data', function(req, res, next) {
	res.send("Generating data started");
	download_stats();
});

router.get('/create_csv', function(req, res, next) {
	res.send("Creating csv");
	create_csv()
});

router.get('/create_min_csv', function(req, res, next) {
	res.send("Creating csv");
	create_min_csv();
});

app.use('/', router);
app.listen(config.port, function () {
	console.log('App listening on port ' + config.port)
})


});}); //end open mongo databases
	
}); //end get tankdata from wg api