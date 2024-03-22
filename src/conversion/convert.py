import numpy as np
import os
import gzip
from lhpos import calc_lhpos_global
import pygrib
from datetime import datetime, timedelta

#
# This script assumes that there are five NWP files (us.grb2, ca.grb2, ec.grb2, kr.grb2, jp.grb2) initialized at 2024-02-14 00:00Z
# and reanalysis files (era5.grib, era5_precip.grib) which cover ten days from 2024-02-14 00:00Z.
# Time step is assumed to be six hours except for era5_precip.grib (hourly precipitation). 
# Intermediate files will be created in centers/ and the final product will be in bundled_nwp_data/
# Create your own script based on this sample to suit your needs.
#



##### Global variables #####

padding = b"\x00"

normalize = {
	"slp": lambda x: np.floor((x/100-850)/2),
	"t850": lambda x: np.floor(x-273.15+60),
	"precip6": lambda x: digitize_nan(x, [0.1, 0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 50, 75, 100]),
	"accprecip": lambda x: digitize_nan(x, [1, 2, 4, 6, 8, 12, 16, 24, 32, 40, 48, 64, 96, 128, 256, 512]),
	"z500": lambda x: np.floor((x-3000)/20),
	"wdir10": lambda x: np.floor(x*16),
	"wdir850": lambda x: np.floor(x*16),
	"wspd10": lambda x: np.floor(x/10),
	"wspd850": lambda x: np.floor(x/10),
}

varnames = ["slp","t850","precip6","accprecip","z500","wdir10","wspd10"]

lonmin = 0
lonmax = 359.5
latmin = -90
latmax = 90

initial_ymdh = [2024, 2, 14, 0]

############################

def crop_var(ary, indices):
	return np.concatenate((
			ary[::indices[2], indices[3]:indices[4]],
			ary[::indices[2], indices[3]:indices[3]+1]), axis=1)

def select_var(grbs, indices, **filters):
	results = []
	for grb in grbs:
		matches = True
		for key in filters.keys():
			accepted_values = filters[key]
			if grb[key] not in accepted_values:
				matches = False
				continue
		if matches:
			results.append(grb)
	if len(results) == 1:
		return crop_var(results[0].values, indices)
	elif len(results) == 0:
		raise RuntimeError("No message matched.")
	else:
		print("Warning: multiple messages matched.")
		print(results)
		return crop_var(results[0].values, indices)

def extract_grid(grb):
	lon0 = grb.longitudeOfFirstGridPointInDegrees
	lat0 = grb.latitudeOfFirstGridPointInDegrees
	lat1 = grb.latitudeOfLastGridPointInDegrees
	dlon = grb.iDirectionIncrementInDegrees
	dlat = grb.jDirectionIncrementInDegrees
	
	if lon0 >= 180:
		lon0 -= 360
	ix_start = round((lonmin - lon0) / dlon)
	ix_end   = round((lonmax - lon0) / dlon) + 1
	
	if lat0 < lat1:
		iy_start = round((latmin - lat0) / dlat)
		iy_end   = round((latmax - lat0) / dlat) + 1
		lat_start = lat0 + dlat * iy_start
		iy_dir = 1
	else:
		iy_start = round((lat0 - latmin) / dlat)
		iy_end   = round((lat0 - latmax) / dlat) - 1
		lat_start = lat0 - dlat * iy_start
		iy_dir = -1
	if min(ix_start,iy_start) < 0 or iy_end < -1: raise RuntimeError(f"{ix_start} {iy_start} {iy_end}")
	
	grid = (lon0+dlon*ix_start, lat_start, dlon, dlat)
	indices = (iy_start, iy_end, iy_dir, ix_start, ix_end)
	return grid, indices

def digitize_nan(ary, levels):
	result = np.digitize(ary, levels) * 1.0
	result[np.isnan(ary)] = np.nan
	return result

def process_lhpos(ary, l):
	nmax = 100
	lhpos = calc_lhpos_global(nmax, ary, l)
	
	nlowhigh = [0,0]
	result_lh = b""
	for ilh in [0,1]:
		for ip in range(nmax):
			if lhpos[ilh,ip,0] >= 0:
				result_lh += np.asarray([lhpos[ilh,ip,0], lhpos[ilh,ip,1], ary[lhpos[ilh,ip,1],lhpos[ilh,ip,0]]], dtype=np.float32).tobytes()
				nlowhigh[ilh] += 1
			else:
				break
	return np.asarray(nlowhigh, dtype=np.uint32).tobytes() + result_lh

def export_bin(model_id, grid, ft, ary_orig, varname, result_lh=np.asarray([0,0], dtype=np.uint32).tobytes()):
	ary = normalize[varname](ary_orig)
	ny, nx = ary.shape
	
	alldata  = np.asarray([model_id, nx, ny], dtype=np.uint16).tobytes() + padding + padding
	alldata += np.asarray(grid, dtype=np.float32).tobytes()
	alldata += result_lh
	
	ary_byte = np.clip(ary,0,254).astype(np.uint8)
	ary_byte[np.isnan(ary)] = 255
	
	alldata += ary_byte.tobytes()
	
	alldata += padding * ((-len(alldata))%4)
	
	path = f"centers/{model_id}"
	os.makedirs(path, exist_ok=True)
	filename = f"{path}/{model_id}_{ft}_{varname}.bin"
	with open(filename, "wb") as f:
		f.write(alldata)

def export_bin_wind(model_id, grid, ft, u, v, level):
	export_bin(model_id, grid, ft, (u**2+v**2)**0.5*1.944, f"wspd{level}")
	export_bin(model_id, grid, ft, np.arctan2(v, u) / np.pi % 2, f"wdir{level}")

def bundle(ft):
	for i in range(len(varnames)):
		varname = varnames[i]
		alldata = np.asarray([1, *initial_ymdh, ft, i], dtype=np.uint16).tobytes() + (padding*2)
		for model_id in range(6):
			filename = f"centers/{model_id}/{model_id}_{ft}_{varname}.bin"
			if os.path.exists(filename):
				with open(filename, "rb") as f:
					alldata += f.read()
		with gzip.open(f"bundled_nwp_data/{ft}_{varname}.bin.gz", "wb") as f:
			f.write(alldata)

def convert_forecasts(model_id, grbname):
	grbs_all = pygrib.open(grbname)
	accprecip_prev = 0
	for ft in range(6, 241, 6):
		grbs = grbs_all.select(step=ft)
		grid, indices = extract_grid(grbs[0])
		
		t850 = select_var(grbs, indices, shortName=["t"], level=[850])
		export_bin(model_id, grid, ft, t850, "t850")
		
		z500 = select_var(grbs, indices, shortName=["gh"], level=[500])
		export_bin(model_id, grid, ft, z500, "z500")
		
		u10 = select_var(grbs, indices, shortName=["10u"])
		v10 = select_var(grbs, indices, shortName=["10v"])
		export_bin_wind(model_id, grid, ft, u10, v10, "10")
		
		slp = select_var(grbs, indices, shortName=["prmsl","msl","mslet"])
		export_bin(model_id, grid, ft, slp, "slp", process_lhpos(slp/100, 10))
		
		accprecip = select_var(grbs, indices,
			parameterName=["Total precipitation","Total precipitation rate"],
			stepRange=f"0-{ft}")
		precip6 = accprecip - accprecip_prev
		export_bin(model_id, grid, ft, accprecip, "accprecip")
		export_bin(model_id, grid, ft, precip6, "precip6")
		accprecip_prev = accprecip

def convert_era5():
	initial_date = datetime(*initial_ymdh)
	grbs_all = pygrib.open("era5.grib")
	model_id = 5
	for ft in range(6,241,6):
		grbs = grbs_all.select(validDate=initial_date+timedelta(hours=ft))
		grid, indices = extract_grid(grbs[0])
		
		t850 = select_var(grbs, indices, shortName=["t"], level=[850])
		export_bin(model_id, grid, ft, t850, "t850")
		
		z500 = select_var(grbs, indices, shortName=["z"], level=[500])
		export_bin(model_id, grid, ft, z500/9.81, "z500")
		
		u10 = select_var(grbs, indices, shortName=["10u"])
		v10 = select_var(grbs, indices, shortName=["10v"])
		export_bin_wind(model_id, grid, ft, u10, v10, "10")
		
		slp = select_var(grbs, indices, shortName=["prmsl","msl","mslet"])
		export_bin(model_id, grid, ft, slp, "slp", process_lhpos(slp/100, 10))
	
	grbs_precip = pygrib.open("era5_precip.grib")
	grid, indices = extract_grid(grbs_precip[1])
	time_offset = round(1 + ((initial_date + timedelta(hours=1)) - (grbs_precip[1].analDate + timedelta(hours=grbs_precip[1].step))) / timedelta(hours=1))
	accprecip = 0
	for ft in range(6,241,6):
		precip6 = 0
		for i in range(ft-6+time_offset, ft+time_offset):
			precip6 += crop_var(grbs_precip[i].values, indices) * 1000
		accprecip += precip6
		export_bin(model_id, grid, ft, accprecip, "accprecip")
		export_bin(model_id, grid, ft, precip6, "precip6")


### Main ###

# Convert each NWP data and reanalysis
convert_forecasts(0, "us.grb2")
convert_forecasts(1, "ca.grb2")
convert_forecasts(2, "ec.grb2")
convert_forecasts(3, "kr.grb2")
convert_forecasts(4, "jp.grb2")
convert_era5()

# Bundle intermediate files
for ft in range(6,241,6):
	bundle(ft)

