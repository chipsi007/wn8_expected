var fs = require('fs')

var filename = process.argv[2];
var version = process.argv[3];

if (String(parseInt(version)) == version) {
	version = parseInt(version);
}

if (!filename || !version) {
	console.log("usage: node generate_xml_json_csv.js filename version")
}

var data = fs.readFileSync(filename).toString();
data = data.split('\n');
data.shift();

//generate json
var headers = ["IDNum","frag","dmg","spot","def","win"]
var json = {header: {version:version}, data:[]}
for (let line of data) {
	line = line.split(",");	
	if (line.length > 1) {
		json.data.push({
			IDNum: parseInt(line[0]),
			expFrag: parseFloat(line[1]),
			expDamage: parseFloat(line[2]),
			expSpot: parseFloat(line[3]),
			expDef: parseFloat(line[4]),
			expWinRate: parseFloat(line[5])
		});	
	}
}

fs.writeFile("expected_v" + version + ".json", JSON.stringify(json));

//generate wnefficiency csv
var out = '"IDNum","frag","dmg","spot","def","win"\n';
for (let line of data) {
	line = line.split(",");
	if (line.length > 1) {	
		out += parseInt(line[0]) + "," + parseFloat(line[1]) + ","+ parseFloat(line[2]) + ","+ parseFloat(line[3]) + ","+ parseFloat(line[4]) + ","+ parseFloat(line[5]) + "\n";
	}
}
fs.writeFile("expected_v" + version + ".csv", out);


//generate http://www.wnefficiency.net xml