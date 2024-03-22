class Renderer{

	constructor(wasm_module, coastlines){
		this.wasm = wasm_module;
		this.coastlines = coastlines;
		this.cached_canvas_all = new LimitedDict(5);
		this.cached_canvas_gpv = new LimitedDict(5);
	}

	render(use_cache=true){
		processing = true;
		
		const {canvas_all, canvas_gpv, canvas_overlay, canvas_coast, dpr,
			nxp, nyp, width_panel, height_panel, lw_border,
			height_title, width_lticks, height_bticks, width_cbar, vert_cbar} = chart;
		const {varname_shade, varname_ctr, drag_info, wheel_info, current_region} = ui;
		const {proj_type} = projection;

		this.dpr2 = Math.pow(dpr, 0.5);
		this.fontsize_big = Math.round(width_panel*this.dpr2*0.07);
		this.fontsize_sml = Math.round(width_panel*this.dpr2*0.05);
		this.fontsize_label = Math.round(width_panel*this.dpr2*0.04);
		this.len_xmark = Math.round(width_panel*this.dpr2*0.015);

		const {clon, clat, range_lat} = current_region;

		const range_lon = chart.range_lon_from_lat(range_lat);
		
		Object.assign(this, {clon,clat,range_lat,range_lon});

		const ctx_all = canvas_all.getContext("2d");
		const canvas_key = ui.current_state_toString();
		if(use_cache && this.cached_canvas_all.get(canvas_key)){
			ctx_all.putImageData(this.cached_canvas_all.get(canvas_key), 0,0);
			let cache_gpv = this.cached_canvas_gpv.get(canvas_key);
			const ctx = canvas_gpv.getContext("2d");
			ctx.putImageData(cache_gpv, 0,0);
			processing = false;
			$(`#timebtn_${ui.ft}`).removeClass("timebtn_loading");
			return;
		}


		this.buffer = this.wasm.HEAP8.buffer;
		let ptr_rgba, ptr_cmap;
		this.ptr_data = {};
		const reproject_while_dragging = (proj_type != "latlon");
		this.proj_id = {"latlon":0, "ortho":1}[proj_type];

		if(!drag_info && !wheel_info){
			ptr_rgba = this.wasm._malloc(4*width_panel*height_panel);
			this.ptr_data["ctr"] = this.wasm._malloc(4*grid.datalen_max["ctr"]);
			ptr_cmap = this.wasm._malloc(cmap_rgbs[varname_shade].length);
			this.wasm.HEAP8.set(cmap_rgbs[varname_shade], ptr_cmap);

			const ctx = canvas_coast.getContext("2d");
			ctx.clearRect(0,0,width_panel,height_panel);
			this.draw_coast(ctx);
		}

		const {bounds, draw_entire_x} = this.bounds_for_contours();

		const ctx = canvas_gpv.getContext("2d");
		const ctx_overlay = canvas_overlay.getContext("2d");
		let skip_panels = false;
		if((drag_info || wheel_info) && reproject_while_dragging){
			const info = drag_info ? drag_info : wheel_info;
			const start_range_lon = chart.range_lon_from_lat(info.start_range_lat);
			$("#canvas_webgl").css("z-index", 10);
			draw_reproj_webgl(info.start_clon, info.start_clat,  start_range_lon, info.start_range_lat,
							clon, clat, range_lon, range_lat);
			skip_panels = true;
		}else{
			ctx_all.fillStyle = "white";
			ctx_all.fillRect(0,0,canvas_all.width,canvas_all.height);
			ctx_all.fillStyle = "gray";
			ctx_all.fillRect(width_lticks, height_title, nxp * width_panel + nxp*lw_border, nyp * height_panel + nyp*lw_border);
			ctx_overlay.clearRect(0,0,canvas_overlay.width,canvas_overlay.height);
			$("#canvas_webgl").css("z-index", -1);

			if(!drag_info && !wheel_info){
				draw_shade_webgl(ctx, this.proj_id, clon,clat,range_lon,range_lat);
			}
		}

		for(let i=0; i<(skip_panels?0:6); ++i){
			const x0_panel = (i%nxp)*width_panel + (i%nxp) * lw_border;
			const y0_panel = Math.floor(i/nxp)*height_panel + (Math.floor(i/nxp)) * lw_border;

			if(drag_info || wheel_info){
				this.linear_transformation(ctx_all, x0_panel, y0_panel, drag_info || wheel_info);
				continue;
			}

			ctx.save();
			ctx.beginPath();
			ctx.rect(x0_panel, y0_panel, width_panel, height_panel);
			ctx.clip();
			ctx_overlay.save();
			ctx_overlay.beginPath();
			ctx_overlay.rect(x0_panel, y0_panel, width_panel, height_panel);
			ctx_overlay.clip();

			ctx.drawImage(canvas_coast, x0_panel,y0_panel);

			if(grid.array_data["ctr"] && grid.array_data["ctr"][i]){
				this.wasm.HEAPF32.set(grid.array_data["ctr"][i], this.ptr_data["ctr"]/4);
				const lon_offset_min = (proj_type == "latlon" &&  clon-range_lon < 0) ? -360 : 0;
				const lon_offset_max = (proj_type == "latlon" &&  clon+range_lon > 360) ? 360 : 0;
				for(let lon_offset=lon_offset_min; lon_offset<=lon_offset_max+1; lon_offset+=360){
					const proj_configs = [range_lon,range_lat,lon_offset,clon,clat];
					if(varnames_wdir.includes(varname_ctr)){
						this.render_stream(ctx, i, x0_panel, y0_panel, proj_configs);
					}else{
						this.render_contours(ctx, ctx_overlay, i, x0_panel, y0_panel, proj_configs, bounds, draw_entire_x);
					}
				}
			}

			ctx.restore();
			ctx_overlay.restore();

		}

		if(!skip_panels){
			if(!drag_info && !wheel_info){
				ctx_all.drawImage(canvas_gpv, width_lticks, height_title);
				ctx_all.drawImage(canvas_overlay, width_lticks, height_title);
			}
			this.draw_title(ctx_all);
			this.draw_ticks(ctx_all, bounds, clon, clat, range_lon, range_lat);
			if(varname_shade != "none") draw_cbar(ctx_all);
			this.draw_labels(ctx_all);
		}

		ctx_all.strokeStyle = "black";
		ctx_all.lineWidth = lw_border;
		for(let i=0; i<nxp+1; ++i){
			ctx_all.beginPath();
			const x = i*(width_panel+lw_border)-lw_border/2+0.5 + width_lticks;
			ctx_all.moveTo(x, height_title);
			ctx_all.lineTo(x, height_title + nyp * height_panel + nyp*lw_border);
			ctx_all.stroke();
		}
		for(let i=0; i<nyp+1; ++i){
			ctx_all.beginPath();
			const y = i*(height_panel+lw_border)-lw_border/2+0.5 + height_title;
			ctx_all.moveTo(width_lticks, y);
			ctx_all.lineTo(width_lticks + nxp * width_panel + nxp*lw_border, y);
			ctx_all.stroke();
		}

		if(!drag_info && !wheel_info){
			this.wasm._free(ptr_rgba);
			this.wasm._free(this.ptr_data["ctr"]);
			this.wasm._free(ptr_cmap);
		}

		if(!drag_info && !wheel_info){
			this.cached_canvas_all.put(canvas_key, ctx_all.getImageData(0,0,canvas_all.width,canvas_all.height));
			const ctx = canvas_gpv.getContext("2d");
			const cache_gpv = ctx.getImageData(0,0,canvas_gpv.width, canvas_gpv.height);
			gl.useProgram(webgl_programs["reproj"]);
			gl.activeTexture(gl.TEXTURE0);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas_gpv);
			this.cached_canvas_gpv.put(canvas_key, cache_gpv);
		}
		processing = false;
		$(`#timebtn_${ui.ft}`).removeClass("timebtn_loading");
	}
	
	bounds_for_contours(){
		let draw_entire_x = false;
		let lon_offset_base=0;
		let bounds = projection.ll_bounds([this.range_lon,this.range_lat,0,this.clon,this.clat]);
		lon_offset_base = Math.floor(bounds[0]/360)*360;
		bounds[1] -= lon_offset_base;
		bounds[0] -= lon_offset_base;
		if(isNaN(bounds[1]-bounds[0]) || bounds[1] >= 360 || bounds[0] < 0 || (projection.proj_type != "latlon" && (this.clat+this.range_lat/2 > 90 || this.clat-this.range_lat < -90))){
			draw_entire_x = true;
			bounds[0] = 0;
			bounds[1] = 360;
		}
		if(isNaN(bounds[2])) bounds[2] = -90;
		if(isNaN(bounds[3])) bounds[3] = 90;
		return {bounds, draw_entire_x};
	}
	
	draw_coast(ctx){
		const {width_panel, height_panel, dpr} = chart;
		for(let width_color of [[3*dpr*Math.pow(width_panel/400, 0.5),"white"], [dpr*Math.pow(width_panel/400, 0.5),"black"]]){
			ctx.lineWidth = width_color[0];
			ctx.strokeStyle = width_color[1];
			for(let lon_offset = 0; lon_offset <= (projection.proj_type == "latlon" ? 360 : 0); lon_offset += 360){
				const proj_configs = [this.range_lon,this.range_lat,lon_offset,this.clon,this.clat];
				for(let j=0; j<(Math.min(this.range_lat, this.range_lon)>37?1:2); ++j){
					for(let line of this.coastlines[j]){
						const n = line.length;
						ctx.beginPath();
						let beginline = true;
						for(let i=0; i<n; ++i){
							const xy = projection.ll_to_xy(line[i][0], line[i][1], proj_configs);
							if(isNaN(xy[0])){
								beginline = true;
								continue;
							}
							if(beginline){
								ctx.moveTo(xy[0], xy[1]);
							}else{
								ctx.lineTo(xy[0], xy[1]);
							}
							beginline = false;
						}
						ctx.stroke();
					}
				}
			}
		}
	}
	
	linear_transformation(ctx_all, x0_panel, y0_panel, info){
		const {canvas_gpv, width_panel, height_panel, width_lticks, height_title} = chart;
		ctx_all.save();
		ctx_all.beginPath();
		ctx_all.rect(x0_panel+width_lticks, y0_panel+height_title, width_panel, height_panel);
		ctx_all.clip();
		const start_range_lon = chart.range_lon_from_lat(info.start_range_lat);
		const dx = (((info.start_clon - start_range_lon/2) - this.clon) / this.range_lon + 0.5) * width_panel;
		const dy = ((this.clat - (info.start_clat + info.start_range_lat/2)) / this.range_lat + 0.5) * height_panel;
		const zoom = info.start_range_lat/this.range_lat;
		ctx_all.drawImage(canvas_gpv, x0_panel,y0_panel, width_panel,height_panel,
			width_lticks+x0_panel+dx, height_title+y0_panel+dy, width_panel*zoom, height_panel*zoom);
		ctx_all.restore();
	}
	
	render_stream(ctx, i, x0_panel, y0_panel, proj_configs){
		const [range_lon,range_lat,lon_offset,clon,clat] = proj_configs;
		const {width_panel, height_panel, dpr} = chart;
		
		const pp_coords = this.wasm._malloc(4);
		const pp_numbers = this.wasm._malloc(4);
		const line_spacing = Math.round(Math.pow(range_lat/30, -0.2) * 1.3 * Math.min(width_panel, height_panel) / Math.pow(dpr, 0.2) * 0.04);
		const nlines = this.wasm._calc_stream(this.ptr_data["ctr"], pp_coords, pp_numbers,
				grid.nx_grid["ctr"][i], grid.ny_grid["ctr"][i], this.proj_id,
				grid.lon0_grid["ctr"][i], grid.dlon_grid["ctr"][i],
				grid.lat0_grid["ctr"][i], grid.dlat_grid["ctr"][i],
				clon, clat, range_lon, range_lat,
				width_panel, height_panel,
				range_lat*0.004, line_spacing,
				20, Math.min(width_panel, height_panel)*Math.pow(dpr,0.2)*0.02);
		
		const ptr_coords = this.wasm.HEAPU32[pp_coords/4];
		const ptr_numbers = this.wasm.HEAPU32[pp_numbers/4];
		const numbers = new Int32Array(this.buffer, ptr_numbers, nlines+1);
		const coords = new Float32Array(this.buffer, ptr_coords, numbers[nlines-1]*2+numbers[nlines]*6);
		
		ctx.lineWidth = Math.pow(dpr, 0.2);
		ctx.strokeStyle = "#00000080";
		ctx.beginPath();
		let iline = -1;
		for(let ip=0; ip<numbers[nlines-2]; ++ip){
			if((ip == 0) || (ip == numbers[iline])){
				iline++;
				ctx.moveTo(x0_panel+coords[ip*2],y0_panel+coords[ip*2+1]);
			}else{
				ctx.lineTo(x0_panel+coords[ip*2],y0_panel+coords[ip*2+1]);
			}
		}
		for(let ip=0; ip<numbers[nlines]; ++ip){
			ctx.moveTo(x0_panel+coords[numbers[nlines-1]*2+ip*6  ],y0_panel+coords[numbers[nlines-1]*2+ip*6+1]);
			ctx.lineTo(x0_panel+coords[numbers[nlines-1]*2+ip*6+2],y0_panel+coords[numbers[nlines-1]*2+ip*6+3]);
			ctx.moveTo(x0_panel+coords[numbers[nlines-1]*2+ip*6  ],y0_panel+coords[numbers[nlines-1]*2+ip*6+1]);
			ctx.lineTo(x0_panel+coords[numbers[nlines-1]*2+ip*6+4],y0_panel+coords[numbers[nlines-1]*2+ip*6+5]);
		}
		ctx.stroke();

		this.wasm._free(ptr_coords);
		this.wasm._free(ptr_numbers);
		this.wasm._free(pp_coords);
		this.wasm._free(pp_numbers);
	}
	
	render_contours(ctx, ctx_overlay, i, x0_panel, y0_panel, proj_configs, bounds, draw_entire_x){
		const [range_lon,range_lat,lon_offset,clon,clat] = proj_configs;
		const {width_panel, height_panel, lw_border, dpr} = chart;
		const {varname_ctr} = ui;
		const {val_to_lw, cint, cmin} = contour_configs(range_lat);
		const lon0_grid = grid.lon0_grid["ctr"][i];
		const lat0_grid = grid.lat0_grid["ctr"][i];
		const dlon_grid = grid.dlon_grid["ctr"][i];
		const dlat_grid = grid.dlat_grid["ctr"][i];
		
		
		ctx_overlay.textAlign = "center";
		ctx_overlay.textBaseline = "middle";

		const ix0 = draw_entire_x ? 0 : Math.max(Math.floor((bounds[0] - lon0_grid) / dlon_grid)-1, 0);
		const ix1 = draw_entire_x ? grid.nx_grid["ctr"][i] : Math.min(Math.ceil ((bounds[1] - lon0_grid) / dlon_grid)+2, grid.nx_grid["ctr"][i]);
		const iy0 = Math.max(Math.floor((bounds[2] - lat0_grid) / dlat_grid)-1, 0);
		const iy1 = Math.min(Math.ceil ((bounds[3] - lat0_grid) / dlat_grid)+2, grid.ny_grid["ctr"][i]);

		let cskip = Math.sqrt((ix1-ix0) * (iy1-iy0) * dlon_grid*dlat_grid / (360*180));
		cskip = Math.min(Math.max(Math.round(cskip*12-2), 1), 6);

		if(ix1 <= ix0 || iy1 <= iy0) return;
		
		const pp_coords = this.wasm._malloc(4);
		const pp_numbers = this.wasm._malloc(4);
		const ptr_vrange = this.wasm._malloc(8);
		const nlines = this.wasm._find_contours(this.ptr_data["ctr"],
			cmin, 1e20, cint,
			ptr_vrange, ptr_vrange+4,
			grid.nx_grid["ctr"][i], ix0, ix1, grid.ny_grid["ctr"][i], iy0, iy1, cskip,
			width_panel, height_panel,
			this.proj_id, clon,clat, range_lon,range_lat,
			lon0_grid, lat0_grid, dlon_grid, dlat_grid,
			pp_coords, pp_numbers);
		const ptr_coords = this.wasm.HEAPU32[pp_coords/4];
		const ptr_numbers = this.wasm.HEAPU32[pp_numbers/4];
		const numbers = new Int32Array(this.buffer, ptr_numbers, nlines);
		const vrange = new Float32Array(this.buffer, ptr_vrange, 2);
		
		const lineWidth_adj = Math.pow(dpr * width_panel/400, 0.5);
		let i0_coords = 0;
		for(let il = 0; il < nlines; ++il){
			const np = numbers[il];
			const coords = new Float32Array(this.buffer, ptr_coords + 4*i0_coords, np*2+1);
			if(np>3 || (np >= 2 && coords[1] != coords[np*2-1])){
				const lineWidth_noadj = val_to_lw(coords[0], vrange[0], vrange[1]);
				ctx.lineWidth = lineWidth_noadj * lineWidth_adj;
				let cut = true;
				let dist = 0, xy_prev;
				let label_coords = [];
				ctx.strokeStyle = "black";
				ctx.beginPath();
				for(let ip = 0; ip < np; ++ip){
					const xy = [coords[ip*2+1]+x0_panel, coords[ip*2+2]+y0_panel];
					if(isNaN(xy[0])){
						cut = true;
						dist = 0;
						continue;
					}
					if(cut){
						ctx.moveTo(xy[0], xy[1]);
					}else{
						ctx.lineTo(xy[0], xy[1]);
						dist += Math.sqrt(Math.pow(xy[0]-xy_prev[0],2) + Math.pow(xy[0]-xy_prev[0],2));
						if(dist > width_panel * 0.2){
							if((lineWidth_noadj > 1) || (coords[0] == 5880)) label_coords.push(xy);
							dist -= width_panel * 1;
						}
					}
					cut = false;
					xy_prev = xy;
				}
				ctx.stroke();
				ctx_overlay.lineWidth = 5*Math.pow(width_panel/400, 0.5);
				ctx_overlay.strokeStyle = "white";
				ctx_overlay.fillStyle = "black";
				for(const xy of label_coords){
					const cvalue = cmap_levs_realval[varname_ctr] ? cmap_levs_realval[varname_ctr][coords[0]-1] : coords[0];
					ctx_overlay.font = `${this.fontsize_label}px sans-serif`;
					ctx_overlay.strokeText(cvalue, xy[0], xy[1]);
					ctx_overlay.fillText(cvalue, xy[0], xy[1]);
				}
			}
			i0_coords += 2*np+1;
		}
		this.wasm._free(ptr_coords);
		this.wasm._free(ptr_numbers);
		this.wasm._free(pp_coords);
		this.wasm._free(pp_numbers);
		this.wasm._free(ptr_vrange);

		// draw extrema
		let dist = 0.3*range_lat / dlat_grid;
		if(projection.proj_type == "ortho"){
			dist *= 1 + Math.pow(range_lat/80, 2);
		}
		const lows  = this.remove_small_extrema(i, grid.lowhighs[i][0], dist, -1);
		const highs = this.remove_small_extrema(i, grid.lowhighs[i][1], dist,  1);
		const nlow = lows.length, nhigh = highs.length;
		for(let lowhigh_info of [[nlow, lows, "blue"], [nhigh, highs, "red"]]){
			const [n, lowhigh, color] = lowhigh_info;
			for(let ip = 0;ip < n; ++ip){
				const xy = projection.ij_to_xy(i, lowhigh[ip][0], lowhigh[ip][1], proj_configs);
				if(xy){
					if(xy[0] < 0 || xy[0] > width_panel || xy[1] < 0 || xy[1] > height_panel) continue;
					xy[0] += x0_panel; xy[1] += y0_panel;
					ctx_overlay.lineWidth = this.len_xmark*0.7;
					ctx_overlay.strokeStyle = "white";
					this.draw_cross(xy, this.len_xmark*1.15, ctx_overlay);
					ctx_overlay.lineWidth = this.len_xmark*0.3;
					ctx_overlay.strokeStyle = color;
					this.draw_cross(xy, this.len_xmark*1, ctx_overlay);
					ctx_overlay.lineWidth = 3*this.dpr2*Math.pow(width_panel/400, 0.5);
					ctx_overlay.fillStyle = color;
					ctx_overlay.strokeStyle = "white";
					ctx_overlay.font = `${this.fontsize_sml}px sans-serif`;
					const value = Math.round(lowhigh[ip][2]);
					ctx_overlay.strokeText(`${value}`, xy[0], xy[1]+this.fontsize_sml);
					ctx_overlay.fillText(`${value}`,   xy[0], xy[1]+this.fontsize_sml);
				}
			}
		}
	}
	
	draw_cross(xy, len, ctx){
		ctx.beginPath();
		ctx.moveTo(xy[0]-len, xy[1]-len);
		ctx.lineTo(xy[0]+len, xy[1]+len);
		ctx.moveTo(xy[0]-len, xy[1]+len);
		ctx.lineTo(xy[0]+len, xy[1]-len);
		ctx.stroke();
	}
	
	remove_small_extrema(model, highs_orig, dist, sgn){
		let result = [];
		const array_data = grid.array_data["ctr"][model];
		const nx = grid.nx_grid["ctr"][model];
		const ny = grid.ny_grid["ctr"][model];
		let ip, ip2, np = highs_orig.length;
		let ok = new Array(np);
		let val, dval;
		let ix2,iy2, x, y, ix_min, ix_max, iy_min, iy_max, xx, yy;
		for(ip=0; ip<np; ++ip) { ok[ip] = 2; }
		for(ip=0; ip<np; ++ip){
			if(ok[ip] == 0) continue;
			x = highs_orig[ip][0];
			y = highs_orig[ip][1];
			val = highs_orig[ip][2];
			for(ip2=0; ip2<np; ++ip2){
				if((Math.abs(x - highs_orig[ip2][0]) > dist) || (Math.abs(y - highs_orig[ip2][1]) > dist)) continue;
				dval = (val - highs_orig[ip2][2]) * sgn;
				if(dval > 0){ ok[ip2] = 0; }
				if((ip<ip2) && (dval == 0)){ ok[ip2] = 1; }
				if(dval < 0){ ok[ip] = 0; break; }
			}
			if(ok[ip] < 2) continue;
			
			ix_min = Math.max(Math.round(x-dist), 0);
			ix_max = Math.min(Math.round(x+dist), nx-1);
			iy_min = Math.max(Math.round(y-dist), 0);
			iy_max = Math.min(Math.round(y+dist), ny-1);
			for(yy=0; yy<4; ++yy){
				for(xx=0; xx<4; ++xx){
					ix2 = Math.round(ix_min + (ix_max-ix_min)*x/3);
					iy2 = Math.round(iy_min + (iy_max-iy_min)*y/3);
					if((val - array_data[iy2*nx+ix2])*sgn + factor[varname_ctr]*1.5 < 0){ ok[ip] = 0; break; }
				}
				if(ok[ip] < 2) break;
			}
		}
		for(ip=0; ip<np; ++ip){
			if(ok[ip] == 2) result.push([highs_orig[ip][0],highs_orig[ip][1],highs_orig[ip][2]]);
		}
		return result;
	}

	draw_ticks(ctx, bounds, clon, clat, range_lon, range_lat){
		if(ui.drag_info || ui.wheel_info) return;

		const {nxp, nyp, width_panel, height_panel, lw_border,
				height_title, width_lticks, height_bticks} = chart;
		
		let lon_offset = 0;
		const proj_configs = [range_lon,range_lat,lon_offset,clon,clat];
		const l_tick = height_bticks * 0.2;
		
		let tint_x, tint_y;
		tint_y = Math.ceil(range_lat/6);
		if(tint_y > 5){
			tint_y = Math.ceil(tint_y/5)*5;
		}
		const abslatmin = Math.min(Math.abs(bounds[2]), Math.abs(bounds[3]));
		tint_x = Math.min(tint_y * Math.round(1 / Math.max(Math.cos(clat/180*Math.PI), 0.1)), 45);
		const dlon = Math.min((bounds[1]-bounds[0])/10, 10);
		let dlat = Math.min((bounds[3]-bounds[2])/10, 10);
		if(abslatmin > 40){
			dlat = Math.min(bounds[3]-bounds[2], 15);
		}else if(abslatmin > 10){
			dlat = Math.min((bounds[3]-bounds[2])/3, 10);
		}
		
		let x0_panel = new Array(6);
		let y0_panel = new Array(6);
		
		for(let i=0; i<6; ++i){
			x0_panel[i] = (i%nxp) * (width_panel + lw_border) + width_lticks;
			y0_panel[i] = Math.floor(i/nxp) * (height_panel + lw_border) + height_title;
		}
		
		let lines = [];
		let ticks_x = [], ticks_y = [];
		let xtick_max=0, xtick_min=width_panel;
		let lon = Math.ceil(bounds[0]/tint_x)*tint_x;
		while(lon <= Math.floor(Math.min(bounds[1],bounds[0]+360)/tint_x)*tint_x){
			let line = [], xy_prev = null;
			for(let lat=bounds[2]; lat<bounds[3]+dlat; lat+=dlat){
				const xy = projection.ll_to_xy(lon,lat, proj_configs);
				if(isNaN(xy[0])){
					if(line.length>0) lines.push(line);
					line = []; xy_prev = null;
					continue;
				}
				if(xy_prev){
					if((xy_prev[1]-height_panel)*(xy[1]-height_panel) <= 0){
						let x = xy[0] + (xy_prev[0]-xy[0]) * (height_panel-xy[1])/(xy_prev[1]-xy[1]);
						if(x >= width_panel*0.05 && x <= width_panel*0.95){
							ticks_x.push([x, lon]);
							xtick_max = Math.max(xtick_max, x);
							xtick_min = Math.min(xtick_min, x);
						}
					}
				}
				line.push(xy);
				xy_prev = xy;
			}
			if(line.length>0) lines.push(line);
			lon += tint_x;
		}
		let xskip = Math.max(Math.round(ticks_x.length * 2 * height_bticks/(xtick_max-xtick_min)), 1);
		
		let lat = Math.floor(bounds[2]/tint_y)*tint_y;
		while(lat <= Math.ceil(bounds[3]/tint_y)*tint_y){
			let line = [], xy_prev = null;
			for(let lon=bounds[0]; lon<bounds[1]+dlon; lon+=dlon){
				const xy = projection.ll_to_xy(lon,lat, proj_configs);
				if(isNaN(xy[0])){
					if(line.length>0) lines.push(line);
					line = []; xy_prev = null;
					continue;
				}
				if(xy_prev){
					if(xy_prev[0]*xy[0] <= 0){
						let y = xy[1] + (xy_prev[1]-xy[1]) * xy[0]/(xy[0]-xy_prev[0]);
						if(y >= height_panel*0.05 && y <= height_panel*0.95){
							ticks_y.push([y, lat]);
						}
					}
				}
				line.push(xy);
				xy_prev = xy;
			}
			if(line.length>0) lines.push(line);
			lat += tint_y;
		}
		
		ctx.fillStyle = "black";
		ctx.font = `${Math.round(height_bticks*0.6)}px sans-serif`;

		for(let i=0; i<6; ++i){
			ctx.save();
			ctx.beginPath();
			ctx.rect(x0_panel[i], y0_panel[i], width_panel, height_panel);
			ctx.clip();
			ctx.setLineDash([l_tick*0.4, l_tick*0.6]);
			ctx.lineWidth = lw_border * 0.4;
			ctx.strokeStyle = "gray";
			ctx.beginPath();
			let beginline = true;
			for(let line of lines){
				for(let j=0; j<line.length; ++j){
					if(j==0){
						ctx.moveTo(line[j][0]+x0_panel[i], line[j][1]+y0_panel[i]);
					}else{
						ctx.lineTo(line[j][0]+x0_panel[i], line[j][1]+y0_panel[i]);
					}
				}
			}
			ctx.stroke();
			ctx.restore();
			ctx.setLineDash([]);
			ctx.strokeStyle = "black";
			ctx.lineWidth = lw_border * 0.6;
			if(i >= 6 - nxp){
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				for(let ix=Math.floor(xskip/2); ix<ticks_x.length; ix+=xskip){
					let [x, lon] = ticks_x[ix];
					if(lon == 360) continue;
					const y = y0_panel[i] + height_panel;
					x += x0_panel[i];
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x, y+l_tick);
					ctx.stroke();
					let lon_str = `${(lon+720)%360}E`;
					if(lon%180 == 0) lon_str = `${lon}`;
					if((lon+720)%360 > 180) lon_str = `${360-(lon+720)%360}W`;
					ctx.fillText(lon_str, x, y+l_tick*1.3);
				}
			}
			if(i%nxp == 0){
				ctx.textAlign = "right";
				ctx.textBaseline = "middle";
				for(let tick of ticks_y){
					let [y, lat] = tick;
					if(Math.abs(lat) > 90) continue;
					const x = width_lticks;
					y += y0_panel[i];
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x-l_tick, y);
					ctx.stroke();
					let lat_str = `${lat}N`;
					if(lat == 0) lat_str = "EQ";
					if(lat < 0) lat_str = `${-lat}S`;
					ctx.fillText(lat_str, width_lticks-l_tick*1.3, y);
				}
			}
		}
	}
	
	draw_labels(ctx){
		const {width_panel, height_panel, nxp, nyp, width_lticks, height_title, lw_border, dpr} = chart;
		const fontsize = Math.round(Math.min(width_panel,height_panel)*0.07*Math.pow(dpr,0.2));
		ctx.textAlign = "left";
		ctx.textBaseline = "top";
		ctx.font = `${fontsize}px sans-serif`;
		for(let i=0; i<6; ++i){
			const x0_panel = (i%nxp)*(width_panel+lw_border) + width_lticks;
			const y0_panel = Math.floor(i/nxp)*(height_panel+lw_border) + height_title;
			const textsize = ctx.measureText(models[i]);
			ctx.fillStyle = "#404040";
			ctx.fillRect(x0_panel, y0_panel, textsize.width+1, fontsize+1);
			ctx.fillStyle = "white";
			ctx.fillText(models[i], x0_panel, y0_panel);
		}
	}

	draw_title(ctx){
		const {canvas_all, nxp, nyp, width_panel, height_panel, height_title, vert_cbar, width_cbar, width_lticks} = chart;
		const {varname_shade, varname_ctr} = ui;
		ctx.textAlign = "center";
		ctx.textBaseline = "bottom";
		ctx.fillStyle = "black";
		let fontsize = Math.min(height_title * (vert_cbar?0.8:0.35), canvas_all.width*0.03);
		ctx.font = `${Math.round(fontsize)}px sans-serif`;
		let vardesc;
		if(varname_ctr == "none" && varname_shade == "none"){
			vardesc = "None";
		}else if(varname_ctr == "none"){
			vardesc = labels[varname_shade];
		}else if(varname_shade == "none"){
			vardesc = labels[varname_ctr];
		}else if(labels[varname_shade] == labels[varname_ctr]){
			vardesc = labels[varname_shade];
		}else{
			vardesc = `${labels[varname_ctr]} & ${labels[varname_shade]}`;
		}
		const date = $.exDate(ui.init_ymdh, "yyyymmddhh");
		let datestr = "Init: " + date.toChar("yyyy-mm-dd hh24") + "Z   FT" + ("00"+ui.ft).slice(-3) + "h   Valid: ";
		date.setTime(date.getTime() + ui.ft*3600*1000);
		datestr += date.toChar("mm-dd hh24Z");
		if(vert_cbar){
			const title = `${datestr}    ${vardesc}`;
			fontsize *= Math.min(nxp * width_panel / ctx.measureText(title).width * 0.9, 1);
			ctx.font = `${Math.round(fontsize)}px sans-serif`;
			ctx.fillText(title, width_lticks + (canvas_all.width - width_cbar - width_lticks)/2, height_title*0.9);
		}else{
			ctx.fillText(`Multi-model  ${vardesc}`, canvas_all.width/2, height_title*0.5);
			ctx.fillText(datestr, canvas_all.width/2, height_title*0.9);
		}
	}
}


function draw_cbar(ctx_all){
	const {nxp, nyp, width_panel, height_panel, lw_border,
		height_title, width_lticks, height_bticks, width_cbar, vert_cbar} = chart;
	const {varname_shade} = ui;
	
	let x0_abs, y0_abs, y1_abs;
	if(vert_cbar){
		x0_abs = width_lticks + nxp * width_panel + (nxp+1)*lw_border;
		y0_abs = height_title;
		y1_abs = height_title + nyp * height_panel + (nyp+1)*lw_border;
	}else{
		x0_abs = height_title + nyp * height_panel + (nyp+1)*lw_border + height_bticks;
		y0_abs = width_lticks;
		y1_abs = width_lticks + nxp * width_panel + (nxp+1)*lw_border;
	}

	if(chart.canvas_cbar === null){
		chart.canvas_cbar = document.createElement("canvas");
		chart.canvas_cbar.width = vert_cbar ? width_cbar : y1_abs;
		chart.canvas_cbar.height = vert_cbar ? y1_abs : width_cbar;
	}else if(ui.cbar_valid){
		ctx_all.drawImage(chart.canvas_cbar, Math.round(vert_cbar?x0_abs:0), Math.round(vert_cbar?0:x0_abs));
		return;
	}
		
	const ctx = chart.canvas_cbar.getContext("2d");
	ctx.clearRect(0,0,chart.canvas_cbar.width,chart.canvas_cbar.height);
	ctx.lineWidth = lw_border*0.7;
	const bar0 = width_cbar*0.1;
	const bar1 = vert_cbar ? width_cbar*0.3 : width_cbar*0.4;
	const bar2 = vert_cbar ? width_cbar*0.4 : width_cbar*0.5;
	const bar3 = vert_cbar ? width_cbar*0.5 : width_cbar*0.6;

	if(!vert_cbar) ctx.setTransform(0,1,-1,0, y0_abs+y1_abs,0);

	const x0 = 0, y0 = y0_abs, y1 = y1_abs;

	const vmin = cmap_levs[varname_shade][0], vmax = cmap_levs[varname_shade][cmap_levs[varname_shade].length-1];
	const vint = shade_step[varname_shade], tickint = tickint_cbar[varname_shade];
	const n = Math.round((vmax-vmin)/vint);
	let yb = y1 - tickint/(vmax-vmin+tickint*2) * (y1-y0);
	let yt = y0 + (y1-yb);

	const cmap_rgb = cmap_rgbs[varname_shade];
	ctx.fillStyle = `rgb(${cmap_rgb[0]},${cmap_rgb[1]},${cmap_rgb[2]})`;
	ctx.beginPath();
	ctx.moveTo(x0+bar0, yb);
	ctx.lineTo(x0+(bar0+bar1)/2, y1);
	ctx.lineTo(x0+bar1, yb);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = `rgb(${cmap_rgb[cmap_rgb.length-3]},${cmap_rgb[cmap_rgb.length-2]},${cmap_rgb[cmap_rgb.length-1]})`;
	ctx.beginPath();
	ctx.moveTo(bar0, yt);
	ctx.lineTo((bar0+bar1)/2, y0);
	ctx.lineTo(bar1, yt);
	ctx.closePath();
	ctx.fill();

	for(let i=0; i<n; ++i){
		const top = yb - (i+1)/n * (yb-yt);
		ctx.fillStyle = `rgb(${cmap_rgb[3*(i+1)]},${cmap_rgb[3*(i+1)+1]},${cmap_rgb[3*(i+1)+2]})`;
		ctx.fillRect(bar0, Math.floor(top), bar1-bar0, Math.ceil(1/n * (yb-yt)));
	}

	ctx.beginPath();
	ctx.moveTo(bar0, yb);
	ctx.lineTo((bar0+bar1)/2, y1);
	ctx.lineTo(bar1, yb);
	ctx.lineTo(bar1, yt);
	ctx.lineTo((bar0+bar1)/2, y0);
	ctx.lineTo(bar0, yt);
	ctx.closePath();
	ctx.stroke();

	ctx.strokeStyle = "black";
	for(let value=vmin; value<=vmax; value+=tickint){
		let y = yb - (value-vmin)/Math.max(vmax-vmin,1e-10) * (yb-yt);
		ctx.beginPath();
		ctx.moveTo(bar0, y);
		ctx.lineTo(bar2, y);
		ctx.stroke();
	}

	ctx.fillStyle = "black";
	ctx.setTransform(1,0,0,1, 0,0);
	if(vert_cbar){
		const fontsize_factor = ["z500","slp"].includes(varname_shade) ? 0.75 : 1;
		ctx.font = `${Math.round(width_cbar*0.25*fontsize_factor)}px sans-serif`;
		ctx.textAlign = "left";
		ctx.textBaseline = "middle";
		for(let value=vmin; value<=vmax; value+=tickint){
			let y = yb - (value-vmin)/Math.max(vmax-vmin,1e-10) * (yb-yt);
			let realval;
			if(varnames_nonlinear.includes(varname_shade)){
				realval = cmap_levs_realval[varname_shade][Math.round(value/tickint)];
			}else{
				realval = value;
			}
			ctx.fillText(realval, x0+bar3, y);
		}

		ctx.textAlign = "center";
		ctx.font = `${Math.round(width_cbar*0.2)}px sans-serif`;
		ctx.textBaseline = "bottom";
		ctx.fillText(`(${units[varname_shade]})`, x0+width_cbar*0.5, y0 - width_cbar*0.05);
	}else{
		ctx.font = `${Math.round(Math.min(width_cbar*0.35, width_panel*0.06))}px sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		for(let value=vmin; value<=vmax; value+=tickint){
			let y = yt + (value-vmin)/Math.max(vmax-vmin,1e-10) * (yb-yt);
			let realval;
			if(varnames_nonlinear.includes(varname_shade)){
				realval = cmap_levs_realval[varname_shade][Math.round(value/tickint)];
			}else{
				realval = value;
			}
			ctx.fillText(realval, y, x0+bar3);
		}

		ctx.font = `${Math.round(Math.min(width_cbar*0.25, width_panel*0.04))}px sans-serif`;
		ctx.textBaseline = "top";
		ctx.fillText(`(${units[varname_shade]})`, y0*0.7, bar3);
	}

	ctx_all.drawImage(chart.canvas_cbar, Math.round(vert_cbar?x0_abs:0), Math.round(vert_cbar?0:x0_abs));
	ui.cbar_valid = true;
}
