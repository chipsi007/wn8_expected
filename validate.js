var fs = require('fs');
var config = require('config-yml');
var MongoClient = require('mongodb').MongoClient;

var wg_app_id = config.wg.api_id;
var expected_file = process.argv[2];

if (!expected_file) {
	console.log("usage: node validate.js filename.json")
}

//calculate wn8
function calculate_wn8(tank, exp) {
	var rDAMAGE = tank.damage_dealt / exp.expDamage;
	var rSPOT   = tank.spotted / exp.expSpot;
	var rFRAG   = tank.frags / exp.expFrag;
	var rDEF    = tank.dropped_capture_points / exp.expDef;
	var rWIN    = (100*tank.wins) / exp.expWinRate;

	var rWINc    = Math.max(0,                     (rWIN    - 0.71) / (1 - 0.71) )
	var rDAMAGEc = Math.max(0,                     (rDAMAGE - 0.22) / (1 - 0.22) )
	var rFRAGc   = Math.max(0, Math.min(rDAMAGEc + 0.2, (rFRAG   - 0.12) / (1 - 0.12)))
	var rSPOTc   = Math.max(0, Math.min(rDAMAGEc + 0.1, (rSPOT   - 0.38) / (1 - 0.38)))
	var rDEFc    = Math.max(0, Math.min(rDAMAGEc + 0.1, (rDEF    - 0.10) / (1 - 0.10)))		
	
	return (980*rDAMAGEc + 210*rDAMAGEc*rFRAGc + 155*rFRAGc*rSPOTc + 75*rDEFc*rFRAGc + 145*Math.min(1.8,rWINc));
}

function calculate_account_wn8(tank_stats, tank_expected_wn8) {
	var expected_totals = {expDamage:0, expSpot:0, expFrag:0, expDef:0, expWinRate:0};
	var achieved_totals = {damage_dealt:0, spotted:0, frags:0, dropped_capture_points:0, wins:0, battles:0};
	
	for (var i in tank_stats) {
		var tank_id = tank_stats[i].tank_id;
		var tank = tank_stats[i].all;
		var exp = tank_expected_wn8[tank_id];
		
		if (exp) {
			expected_totals.expDamage += exp.expDamage * tank.battles;
			expected_totals.expSpot += exp.expSpot * tank.battles;
			expected_totals.expFrag += exp.expFrag * tank.battles;
			expected_totals.expDef += exp.expDef * tank.battles;
			expected_totals.expWinRate += exp.expWinRate * tank.battles;

			achieved_totals.damage_dealt += tank.damage_dealt;
			achieved_totals.spotted += tank.spotted;
			achieved_totals.frags += tank.frags;
			achieved_totals.dropped_capture_points += tank.dropped_capture_points;
			achieved_totals.wins += tank.wins;
			achieved_totals.battles += tank.battles;
		}
	}
	
	return calculate_wn8(achieved_totals, expected_totals);	
}	

//calculate wn9
var tierAvg = [	// from 150816 EU avgs exc scout/arty
	{ win:0.477, dmg:88.9, frag:0.68, spot:0.90, def:0.53, cap:1.0, weight:0.40 },
	{ win:0.490, dmg:118.2, frag:0.66, spot:0.85, def:0.65, cap:1.0, weight:0.41 },
	{ win:0.495, dmg:145.1, frag:0.59, spot:1.05, def:0.51, cap:1.0, weight:0.44 },
	{ win:0.492, dmg:214.0, frag:0.60, spot:0.81, def:0.55, cap:1.0, weight:0.44 },
	{ win:0.495, dmg:388.3, frag:0.75, spot:0.93, def:0.63, cap:1.0, weight:0.60 },
	{ win:0.497, dmg:578.7, frag:0.74, spot:0.93, def:0.52, cap:1.0, weight:0.70 },
	{ win:0.498, dmg:791.1, frag:0.76, spot:0.87, def:0.58, cap:1.0, weight:0.82 },
	{ win:0.497, dmg:1098.7, frag:0.79, spot:0.87, def:0.58, cap:1.0, weight:1.00 },
	{ win:0.498, dmg:1443.2, frag:0.86, spot:0.94, def:0.56, cap:1.0, weight:1.23 },
	{ win:0.498, dmg:1963.8, frag:1.04, spot:1.08, def:0.61, cap:1.0, weight:1.60 }];

function CalcWN9Tank(tank, expvals, maxhist) {
	var exp = expvals[tank.tank_id];
	if (!exp) { console.log("Tank ID not found: " + tank.tank_id); return -1; }
	
	var rtank = tank.random;
	var avg = tierAvg[exp.mmrange >= 3 ? exp.tier : exp.tier-1];
	var rdmg = rtank.damage_dealt / (rtank.battles * avg.dmg);
	var rfrag = rtank.frags / (rtank.battles * avg.frag);
	var rspot = rtank.spotted / (rtank.battles * avg.spot);
	var rdef = rtank.dropped_capture_points / (rtank.battles * avg.def);

	// Calculate raw winrate-correlated wn9base
	// Use different formula for low battle counts
	var wn9base = 0.7*rdmg;
	if (rtank.battles < 5) wn9base += 0.14*rfrag + 0.13*Math.sqrt(rspot) + 0.03*Math.sqrt(rdef);
	else wn9base += 0.25*Math.sqrt(rfrag*rspot) + 0.05*Math.sqrt(rfrag*Math.sqrt(rdef));
	// Adjust expected value if generating maximum historical value
	var wn9exp = maxhist ? exp.wn9exp * (1+exp.wn9nerf) : exp.wn9exp;
	// Calculate final WN9 based on tank expected value & skill scaling 
	var wn9 = 666 * Math.max(0, 1 + (wn9base / wn9exp - 1) / exp.wn9scale );
	return wn9;
}

function CalcWN9Account(tanks, expvals)	{
	// compile list of valid tanks with battles & WN9 
	var tanklist = [];
	var totbat = 0;
	for (var i=0; i<tanks.length; i++)
	{
		if (tanks[i].random.battles > 0) { // <-- code was modified here
			var exp = expvals[tanks[i].tank_id];
			if (!exp || exp.type == "SPG") continue;	// don't use SPGs & missing tanks
			var wn9 = CalcWN9Tank(tanks[i], expvals, false);
			var tankentry = { wn9:wn9, bat:tanks[i].random.battles, exp:exp };
			tanklist.push(tankentry);
			totbat += tankentry.bat;
		}
	}
	if (!totbat) return -1;		// handle case with no valid tanks

	// cap tank weight according to tier, total battles & nerf status
	var totweight = 0;
	for (var i=0; i<tanklist.length; i++)
	{
		var exp = tanklist[i].exp;
		var batcap = exp.tier*(40.0 + exp.tier*totbat/2000.0);
		tanklist[i].weight = Math.min(batcap, tanklist[i].bat);
		if (exp.wn9nerf) tanklist[i].weight /= 2;
		totweight += tanklist[i].weight;
	}

	// sort tanks by WN9 decreasing
	function compareTanks(a, b) { return b.wn9 - a.wn9 };
	tanklist.sort(compareTanks);

	// add up account WN9 over top 65% of capped battles
	totweight *= 0.65;
	var wn9tot = 0, usedweight = 0, i = 0;
	for (; usedweight+tanklist[i].weight <= totweight; i++)
	{
		wn9tot += tanklist[i].wn9 * tanklist[i].weight;
		usedweight += tanklist[i].weight;
	}
	// last tank before cutoff uses remaining weight, not its battle count
	wn9tot += tanklist[i].wn9 * (totweight - usedweight);
	return wn9tot / totweight;
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

function get_server(id) {
	if(id > 3000000000){return "kr";}
	if(id > 2000000000){return "asia";}
	if(id > 1000000000){return "com";}
	if(id > 500000000){return "eu";}
	return "ru";
}

//This part initialises db and remote_db
var connection_string =  config.mongo.connect_string;
console.log("Connecting to: ", connection_string)
//connect to local db
MongoClient.connect('mongodb://'+connection_string, function(err, db) {
if(err) throw err;	
//auth local db
db.authenticate(config.mongo.username, config.mongo.password, function(err) {	
if(err) throw err;

var sum_wn8 = 0;
var sum_wr = 0;
var players = 0;

console.log("using: ", expected_file);
var data = JSON.parse(fs.readFileSync(expected_file).toString());
var tank_expected_wn8 = {};
for (var i in data.data) {
	tank_expected_wn8[data.data[i].IDNum] = data.data[i];
}

new Promise(function(resolve) {
	db.collection('statistics').find({}).each(function (e, data) {
		if (data) {			
			//rebuild a stat as it comes from the server
			tank_stats = [];
			var total_wins = 0;
			var total_battles = 0;
			for (let key in data.tanks) {
				tank_stats.push({
					tank_id: data.tanks[key].compDescr, 
					all: {
						battles: data.tanks[key].battles,
						wins: data.tanks[key].victories,
						damage_dealt: data.tanks[key].damage_dealt,
						frags: data.tanks[key].frags,
						spotted: data.tanks[key].spotted,
						dropped_capture_points: data.tanks[key].defence_points
					}
				})
				total_wins += data.tanks[key].victories;
				total_battles += data.tanks[key].battles;
			}	
			if (total_battles > 0) {
				var wn8 = calculate_account_wn8(tank_stats, tank_expected_wn8);
				var wr = total_wins / total_battles;
				if (wn8 && wr) {
					players++;
					sum_wn8 += wn8;
					sum_wr += wr;
				}
			}
		} else {
			resolve();
		}
	})
}).then(() => {
	var avg_wn8 = sum_wn8 / players;
	var avg_wr = sum_wr / players;
	var nom = 0, wn8_sum_squared = 0, wr_sum_squared = 0;	
	db.collection('statistics').find({}).each(function (e, data) {
		if (data) {	
			//rebuild a stat as it comes from the server
			tank_stats = [];
			var total_wins = 0;
			var total_battles = 0;
			for (let key in data.tanks) {
				tank_stats.push({
					tank_id: data.tanks[key].compDescr, 
					all: {
						battles: data.tanks[key].battles,
						wins: data.tanks[key].victories,
						damage_dealt: data.tanks[key].damage_dealt,
						frags: data.tanks[key].frags,
						spotted: data.tanks[key].spotted,
						dropped_capture_points: data.tanks[key].defence_points
					}
				})
				total_wins += data.tanks[key].victories;
				total_battles += data.tanks[key].battles;
			}	
			if (total_battles > 0) {
				var wr = total_wins / total_battles;
				var wn8 = calculate_account_wn8(tank_stats, tank_expected_wn8);
				if (wn8 && wr) {
					nom += (wr - avg_wr) * (wn8 - avg_wn8);
					wn8_sum_squared += Math.pow((wn8 - avg_wn8), 2);
					wr_sum_squared += Math.pow((wr - avg_wr), 2)
				}
			}
		} else {
			var corr_wn8 = nom / Math.sqrt(wn8_sum_squared * wr_sum_squared)
			console.log("corr wr-wn8:", corr_wn8)
		}
	});
})


});}); //end open mongo databases
