const DEG2RAD = Math.PI/180;
const RAD2DEG = 180/Math.PI;

class Projection{
	constructor(){}
	
	set_type(new_proj){
		this.proj_type = new_proj;
		switch(this.proj_type){
		case "latlon":
			this.ll_to_xy = this.ll_to_xy_latlon;
			break;
		case "ortho":
			this.ll_to_xy = this.ll_to_xy_ortho;
			break;
		}
	}

	ll_to_xy_latlon(lon,lat, configs){
		const [range_lon,range_lat,lon_offset,clon,clat] = configs;
		const {width_panel, height_panel} = chart;
		return [
			(lon - (clon-lon_offset-range_lon/2)) / range_lon * width_panel,
			((clat+range_lat/2) - lat) / range_lat * height_panel];
	}

	ll_to_xy_ortho(lon,lat, configs){
		const [range_lon,range_lat,lon_offset,clon,clat] = configs;
		const {width_panel, height_panel} = chart;
		const dlon = lon - (clon-lon_offset);
		const cosclat = Math.cos(clat*DEG2RAD);
		const sinclat = Math.sin(clat*DEG2RAD);
		const cosdlon = Math.cos(dlon*DEG2RAD);
		const sindlon = Math.sin(dlon*DEG2RAD);
		const coslat  = Math.cos(lat *DEG2RAD);
		const sinlat  = Math.sin(lat *DEG2RAD);
		const sinlon  = Math.sin(lon *DEG2RAD);
		if(sinclat*sinlat + cosclat*coslat*cosdlon <= 0) return [NaN, NaN];
		const x = coslat * sindlon * RAD2DEG;
		const y = (cosclat * sinlat - sinclat * coslat * cosdlon) * RAD2DEG;
		return [
			(x / range_lon + 0.5) * width_panel,
			(0.5 - y / range_lat) * height_panel];
	}

	xy_to_ll_ortho(ix_img,iy_img, configs){
		const [range_lon,range_lat,lon_offset,clon,clat] = configs;
		const {width_panel, height_panel} = chart;
		const x = (ix_img*1.0/width_panel - 0.5)  * range_lon * DEG2RAD;
		const y = (0.5 - iy_img*1.0/height_panel) * range_lat * DEG2RAD;
		const rho = Math.sqrt(x*x+y*y);
		if(rho >= 1){
			return [NaN, NaN];
		}
		const cosc = Math.sqrt(1-rho*rho);
		const sinclat = Math.sin(clat*DEG2RAD);
		const cosclat = Math.cos(clat*DEG2RAD);
		
		const lat = Math.asin(cosc*sinclat + y*cosclat) * RAD2DEG;
		const lon = clon + Math.atan2(x, cosc*cosclat - y*sinclat) * RAD2DEG;
		return [lon, lat];
	}

	ij_to_xy(model,i,j, configs){
		const [range_lon,range_lat,lon_offset,clon,clat] = configs;
		return this.ll_to_xy(
			i * grid.dlon_grid["ctr"][model] + grid.lon0_grid["ctr"][model],
			j * grid.dlat_grid["ctr"][model] + grid.lat0_grid["ctr"][model], [range_lon,range_lat,lon_offset,clon,clat]);
	}

	ll_bounds_ortho(configs){
		const {width_panel, height_panel} = chart;
		const [range_lon,range_lat,lon_offset,clon,clat] = configs;
		const xy1 = this.xy_to_ll_ortho(          0,              0, configs);
		const xy2 = this.xy_to_ll_ortho(width_panel,              0, configs);
		const xy3 = this.xy_to_ll_ortho(          0,   height_panel, configs);
		const xy4 = this.xy_to_ll_ortho(width_panel,   height_panel, configs);
		const xy5 = this.xy_to_ll_ortho(width_panel/2,            0, configs);
		const xy6 = this.xy_to_ll_ortho(width_panel/2, height_panel, configs);
		let lonmin = Math.min(xy1[0], xy2[0], xy3[0], xy4[0], xy5[0], xy6[0]);
		let lonmax = Math.max(xy1[0], xy2[0], xy3[0], xy4[0], xy5[0], xy6[0]);
		let latmin = Math.min(xy1[1], xy2[1], xy3[1], xy4[1], xy5[1], xy6[1], clat-range_lat/2);
		let latmax = Math.max(xy1[1], xy2[1], xy3[1], xy4[1], xy5[1], xy6[1], clat+range_lat/2);
		return [lonmin, lonmax, latmin, latmax];
	}

	ll_bounds(configs){
		const [range_lon,range_lat,lon_offset,clon,clat] = configs;
		switch(this.proj_type){
		case "latlon":
			return [clon-range_lon/2, clon+range_lon/2, clat-range_lat/2, clat+range_lat/2];
		case "ortho":
			return this.ll_bounds_ortho(configs);
		}
	}
}

