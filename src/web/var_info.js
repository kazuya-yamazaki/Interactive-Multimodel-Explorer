
const shade_step = {"t850": 1, "precip6": 1, "accprecip": 1, "slp": 2, "wspd10": 10, "z500": 20};
const tickint_cbar = {"t850": 5, "precip6": 1, "accprecip": 1, "slp": 10, "wspd10": 10, "z500": 100};
const offset = {"t850": -60, "precip6": 0, "accprecip": 0, "slp": 850, "wspd10": 0, "wdir10": 0, "z500": 3000};
const factor = {"t850": 1, "precip6": 1, "accprecip": 1, "slp": 2, "wspd10": 10, "wdir10": Math.PI/16, "z500": 20};
const labels = {"t850": "850hPa Temp.", "precip6": "Precipitation", "accprecip": "Accum. precipitation", "slp": "SLP", "wspd10": "SFC wind", "wdir10": "SFC wind", "z500": "500hPa Z"};
const units = {"t850": "℃", "precip6": "mm/6h", "accprecip": "mm", "slp": "hPa", "wspd10": "kt", "z500": "m"};
const varnames_wdir = ["wdir10"];
const varnames_nonlinear = ["precip6", "accprecip"];
const varnames_5x5_smooth = ["z500", "slp"];
const varnames_nosmooth = ["precip6"];

let cmap_levs = {
	"t850": [-30, 0, 25],
	"z500": [5000, 5500, 6000],
	"slp":  [960, 1010, 1060],
	"precip6": [0,1,2,3,4,5,6,7,8,9,10,11,12,13],
	"accprecip": [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
	"wspd10": [10,50],
};
let cmap_rgbs = {"none": []};
const default_vrange = {"t850": [-30,20], "z500": [5000,6000], "slp": [960,1060],
	"wspd10": [10,50], "precip6": [0,10], "accprecip": [0,15]};
const max_vrange = {"t850": [-50,30], "z500": [4500,6500], "slp": [900,1100],
	"wspd10": [0,100], "precip6": [0,13], "accprecip": [0,15]};
const cmap_levs_realval = {
	"precip6": [0.1, 0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 50, 75, 100],
	"accprecip": [1, 2, 4, 6, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128, 256, 512],
};

const cmap_hsls_tz = {
	"monotone": cmap_continuous([[270,50,40], [180,50,80], [90,50,96]]),
	"bwr": [[260,60,45],[260,60,45], [260,60,100],[12,60,100], [12,60,50],[12,60,50]],
	"rainbow": cmap_continuous([[300,80,40], [150,100,85], [0,80,60]]),
};
const cmap_hsls_slp = {
	"monotone": cmap_continuous([[270,50,40], [180,50,80], [90,50,96]]),
	"bwr": [[260,60,45],[260,60,45], [260,60,100],[12,60,100], [12,60,50],[12,60,50]],
};
const cmap_hsls_wspd = {
	"monotone2": cmap_continuous([[60,0,100], [180,60,60], [360,90,30]]),
};
const cmap_hsls = {
	"t850": cmap_hsls_tz,
	"z500": cmap_hsls_tz,
	"slp": cmap_hsls_slp,
	"precip6": cmap_hsls_wspd,
	"accprecip": cmap_hsls_wspd,
	"wspd10":  cmap_hsls_wspd,
};

const varnames_variable_vrange = ["t850", "z500", "slp", "wspd10", "precip6", "accprecip"];
const varnames_multuple_cmaps = ["t850", "z500", "slp", "wspd10", "precip6", "accprecip"];

const models = ["US GFS", "CA GDPS", "ECMWF HRES", "KR KIM", "JP GSM", "ERA5 reanalysis"];

function cmap_discrete(rgbs){
	let result = [rgbs[0]];
	for(let i=1; i<rgbs.length-1; ++i){
		result.push(rgbs[i]);
		result.push(rgbs[i]);
	}
	result.push(rgbs[rgbs.length-1]);
	return result;
}

function cmap_continuous(rgbs){
	let result = [];
	for(let i=0; i<rgbs.length; ++i){
		result.push(rgbs[i]);
		result.push(rgbs[i]);
	}
	return result;
}

function contour_configs(range_lat){
	let val_to_lw, cint, cmin=-1e20;
	switch(ui.varname_ctr){
	case "slp":
		if(range_lat > 100){
			val_to_lw = x => x%20 == 0 ? 2 : 1;
			cint = 10;
		}else if(range_lat > 20){
			val_to_lw = x => x%20 == 0 ? 2 : 1;
			cint = 4;
		}else if(range_lat > 10){
			val_to_lw = x => x%20 == 0 ? 2 : x%4 == 0 ? 1 : 0.5;
			cint = 2;
		}else{
			val_to_lw = (x, vmin, vmax) => x%20 == 0 ? 2 : x%4 == 0 ? (vmax-vmin<30 ? 1.1 : 1) : 0.5;
			cint = 1;
		}
		break;
	case "z500":
		if(range_lat > 30){
			val_to_lw = x => x%120 == 0 ? 2 : 1;
			cint = 60;
		}else{
			val_to_lw = (x, vmin, vmax) => x%120 == 0 ? 2 : x%60 == 0 ? (vmax-vmin<400 ? 2 : 1) : 1;
			cint = 20;
		}
		break;
	case "t850":
		if(range_lat > 10){
			val_to_lw = x => x%6 == 0 ? 2 : x%3 == 0 ? 1 : 0.5;
			cint = 3;
		}else{
			val_to_lw = x => x%6 == 0 ? 2 : x%3 == 0 ? 1.1 : 0.5;
			cint = 1;
		}
		break;
	case "wspd10":
		val_to_lw = x => x > 1 ? 1.1 : 1;
		cint = 10;
		break;
	case "precip6":
		val_to_lw = x => [3,6,8,10,12].includes(x) ? 1.1 : 0.01;
		cmin = 3;
		cint = 1;
		break;
	case "accprecip":
		val_to_lw = x => [7,9,12,14,15,16].includes(x) ? 1.1 : 0.01;
		cmin = 7;
		cint = 1;
		break;
	}
	return {val_to_lw, cmin, cint};
}
