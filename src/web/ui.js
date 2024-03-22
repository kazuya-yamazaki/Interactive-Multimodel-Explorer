class UI{
	constructor(){
		if(window.ontouchstart === undefined){
			chart.canvas_all.addEventListener("mousedown",  this.drag_start);
			chart.canvas_all.addEventListener("mousemove",  this.drag_middle);
			chart.canvas_all.addEventListener("mouseup",    this.drag_end);
			chart.canvas_all.addEventListener("mouseout",   this.drag_end);
			chart.canvas_all.addEventListener("wheel",      this.wheel);
		}else{
			chart.canvas_all.addEventListener("touchstart", this.touch_start);
			chart.canvas_all.addEventListener("touchmove",  this.touch_middle);
			chart.canvas_all.addEventListener("touchend",   this.touch_end);
			window.addEventListener          ("touchend",   this.drag_end);
		}
		chart.canvas_all.addEventListener("click", this.download_image);
		$(window).keydown(e => this.onKey(e));
		if($("#region").val() == "custom") $("#region").val("conus");
		this.init_ymdh = $("#initial_ymdh").val();
		this.varname_shade = $("#varname_shade").val();
		this.varname_ctr = $("#varname_ctr").val();
		this.ft = 240;
		
		this.hsl_converter = new Hsluv();
		
		this.current_region = {clat: 25, clon: 140, range_lat: 50};
		this.drag_info = null;
		this.wheel_info = null;
		this.click_ignore = false;
		this.cbar_valid = false;
		
		this.init_timebar();
		this.init_slider();
		this.update_cmap(null);
		this.on_projection(false);
	}

	current_state_toString(){
		const {clon, clat, range_lat} = this.current_region;
		return `ctr=${this.varname_ctr},shade=${this.varname_shade},clon=${clon},clat=${clat},range_lat=${range_lat},init=${this.init_ymdh},ft=${this.ft},projection=${projection.proj_type}`;
	}

	init_timebar(){
		let htmls = ["","","","",""];
		let nrows = Math.min(Math.ceil(50 * 40 / window.innerWidth), 5);
		const ncols = Math.ceil(10/nrows) * 4;
		for(let ft=6; ft<=240; ft+=6){
			const label = ft;
			const irow = Math.floor(Math.floor((ft-6) / 24) / ncols * 4);
			htmls[irow] += `<span class="timebtn" id="timebtn_${ft}" onclick="ui.change_ft(${ft})">${label}</span>`;
		}
		for(let irow=0; irow<nrows; ++irow){
			$("#timebar"+irow).html(htmls[irow]);
			$("#timebar"+irow).addClass("timebar_row");
		}
		$(".timebtn").css("width", `${window.innerWidth * 0.9 / ncols - 2}px`);
		$(".timebtn_inc").css("width", `min(${window.innerWidth * 0.9 / ncols * 3}px, 4em, 12vw)`);
		$(`#timebtn_${this.ft}`).addClass("timebtn_sel");
		$(`#timebtn_${this.ft}`).addClass("timebtn_loading");
	}

	async change_var(){
		const new_shade = $("#varname_shade").val();
		const new_ctr = $("#varname_ctr").val();
		$(".shade_prefs").hide();
		if(varnames_multuple_cmaps.includes(new_shade) || varnames_variable_vrange.includes(new_shade)){
			$("#shade_prefs_"+new_shade).show();
		}
		if(new_shade != this.varname_shade){
			this.varname_shade = new_shade;
			await grid.prepare_data(this.varname_shade, true, true);
			this.cbar_valid = false;
		}
		if(new_ctr != varname_ctr){
			this.varname_ctr = new_ctr;
			await grid.prepare_data(this.varname_ctr, true, false);
		}
		renderer.render();
	}

	on_projection(redraw){
		projection.set_type($("#projection").val());
		if(redraw) renderer.render();
	}

	drag_start(e){
		if(e.button == 2) return;
		let dlon_per_pixel, dlat_per_pixel;
		dlat_per_pixel = ui.current_region.range_lat / chart.height_panel;
		dlon_per_pixel = dlat_per_pixel;
		const offset = $(chart.canvas_all).offset();
		const x = (e.pageX - offset.left) * chart.dpr;
		const y = (e.pageY - offset.top)  * chart.dpr;
		ui.drag_info = {
			start_clon: ui.current_region.clon, start_clat: ui.current_region.clat, start_range_lat: ui.current_region.range_lat,
			start_x: x, start_y: y,
			dlon_per_pixel: dlon_per_pixel, dlat_per_pixel: dlat_per_pixel,
		};
	}

	drag_middle(e){
		if(!ui.drag_info) return;
		ui.click_ignore = true;
		$("#region").val("custom");
		ui.current_region = ui.calc_drag_region(e);
		renderer.render();
	}

	drag_end(e){
		if(!ui.drag_info) return;
		e.preventDefault();
		ui.current_region = ui.calc_drag_region(e);
		ui.drag_info = null;
		renderer.render();
		setTimeout(()=>{ui.click_ignore=false;}, 200);
	}

	touch_start(e){
		if(processing) return;
		const touches = e.touches;
		if(touches.length > 2){
			return;
		}

		if(touches.length == 2){
			if(ui.drag_info) ui.drag_info = null;
			const offset = $(chart.canvas_all).offset();
			const x0 = (touches[0].pageX - offset.left) * chart.dpr;
			const y0 = (touches[0].pageY - offset.top)  * chart.dpr;
			const x1 = (touches[1].pageX - offset.left) * chart.dpr;
			const y1 = (touches[1].pageY - offset.top)  * chart.dpr;
			let dlat_per_pixel = ui.current_region.range_lat / chart.height_panel;
			let dlon_per_pixel = dlat_per_pixel;
			ui.drag_info = {
				start_clon: ui.current_region.clon, start_clat: ui.current_region.clat, start_range_lat: ui.current_region.range_lat,
				start_xy: [x0,y0,x1,y1],
				prev_xy: [x0,y0,x1,y1],
				dlon_per_pixel: dlon_per_pixel, dlat_per_pixel: dlat_per_pixel,
			};
			e.preventDefault();
			return;
		}
	}

	touch_middle(e){
		if(processing) return;
		const touches = e.touches;
		if(touches.length != 2){
			if(ui.drag_info){
				touch_end(e);
				return;
			}
		}
		if(!ui.drag_info) return;

		const offset = $(chart.canvas_all).offset();
		const x0 = (touches[0].pageX - offset.left) * chart.dpr;
		const y0 = (touches[0].pageY - offset.top)  * chart.dpr;
		const x1 = (touches[1].pageX - offset.left) * chart.dpr;
		const y1 = (touches[1].pageY - offset.top)  * chart.dpr;
		const [x0p, y0p, x1p, y1p] = ui.drag_info.prev_xy;
		const ratio = Math.sqrt(((x0-x1)*(x0-x1)+(y0-y1)*(y0-y1)) / ((x0p-x1p)*(x0p-x1p)+(y0p-y1p)*(y0p-y1p)));
		ui.current_region.range_lat = Math.min(Math.max(ui.current_region.range_lat / ratio, 2), 180);
		const dx = - (x0+x1-x0p-x1p) / 2 * ui.drag_info.dlon_per_pixel * ui.current_region.range_lat / ui.drag_info.start_range_lat;
		const dy =   (y0+y1-y0p-y1p) / 2 * ui.drag_info.dlat_per_pixel * ui.current_region.range_lat / ui.drag_info.start_range_lat;
		ui.current_region.clon += dx;
		ui.current_region.clat += dy;
		$("#region").val("custom");
		renderer.render();
		ui.drag_info.prev_xy = [x0,y0,x1,y1];
		e.preventDefault();
		return;
	}

	touch_end(e){
		if(!ui.drag_info) return;
		ui.drag_info = null;
		if(processing) return;
		renderer.render();
		e.preventDefault();
		return;
	}

	download_image(){
		if(ui.click_ignore) return;
		chart.canvas_all.toBlob( blob =>{
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `${init_ymdh}_ft${ft}.png`;
			a.click();
			URL.revokeObjectURL(a.src);
		});
	}

	calc_drag_region(e){
		const offset = $(chart.canvas_all).offset();
		const x = (e.pageX - offset.left) * chart.dpr;
		const y = (e.pageY - offset.top)  * chart.dpr;
		const info = ui.drag_info;
		let dlon = -(x-info.start_x)*info.dlon_per_pixel;
		let dlat =  (y-info.start_y)*info.dlat_per_pixel;
		if(projection.proj_type != "latlon"){
			dlon /= Math.max(Math.cos(info.start_clat/180*Math.PI), 0.2);
		}
		let clon = info.start_clon + dlon;
		if(clon < -180) clon += 360;
		if(clon > 540) clon -= 360;
		return {
			clon: clon,
			clat: info.start_clat + dlat,
			range_lat: info.start_range_lat
		};
	}

	zoom(ratio){
		const [lon_mouse, lat_mouse] = this.wheel_info.start_mouse;
		const {clon, clat, range_lat} = this.current_region;
		let new_lon = (clon - lon_mouse) / ratio + lon_mouse;
		if(projection.proj_type == "ortho"){
			new_lon = clon + (new_lon-clon) / Math.max(Math.cos(lat_mouse/180*Math.PI), 0.2);
		}
		this.current_region = {
			clon: new_lon,
			clat: (clat - lat_mouse) / ratio + lat_mouse,
			range_lat: Math.min(Math.max(range_lat / ratio, 2), 360),
		};
		$("#region").val("custom");
		renderer.render();
	}

	wheel(e){
		if(!e.ctrlKey) return;
		if(ui.drag_info) return;
		if(ui.wheel_info){
			clearTimeout(ui.wheel_info.timeout);
		}else{
			const offset = $(chart.canvas_all).offset();
			const x = (e.pageX - offset.left) * chart.dpr * chart.resolution_adj;
			const y = (e.pageY - offset.top)  * chart.dpr * chart.resolution_adj;
			let start_mouse = ui.canvas_to_lonlat(x,y);
			if(!start_mouse) start_mouse = [ui.current_region.clon, ui.current_region.clat];
			ui.wheel_info = {
				start_clon: ui.current_region.clon, start_clat: ui.current_region.clat, start_range_lat: ui.current_region.range_lat,
				start_mouse: start_mouse
			};
		}
		ui.zoom(Math.exp(-e.deltaY/1000));
		ui.wheel_info.timeout = setTimeout(() => {
			ui.wheel_info = null;
			renderer.render();
		}, 200);
		e.preventDefault();
	}
	
	on_region(){
		this.current_region = this.region_bounds($("#region").val());
		renderer.render();
	}

	region_bounds(region){
		let range_lon, range_lat, clon, clat;
		switch(region){
		case "pacific":
			range_lat = 100;
			range_lon = chart.range_lon_from_lat(range_lat);
			if(range_lon < 100){
				range_lat *= 100 / range_lon;
			}
			clon = 180; clat = 0;
			break;
		case "conus":
			range_lat = 45;
			range_lon = chart.range_lon_from_lat(range_lat);
			if(range_lon < 60){
				range_lat *= 60 / range_lon;
			}
			clon = 265; clat = 40;
			break;
		case "ne-us":
			range_lat = 15;
			range_lon = chart.range_lon_from_lat(range_lat);
			if(range_lon < 20){
				range_lat *= 25 / range_lon;
			}
			clon = 290; clat = 42;
			break;
		case "custom":
			return this.current_region;
		}
		return {range_lat, clon, clat};
	}
	
	canvas_to_lonlat(x, y){
		const {width_panel, height_panel, width_lticks, height_title, lw_border} = chart;
		if(x < lw_border || y < lw_border) return null;
		let x2 = (x+1 - lw_border - width_lticks) % (width_panel  + lw_border);
		let y2 = (y+1 - lw_border - height_title) % (height_panel + lw_border);
		if(x2 >= width_panel || y2 >= height_panel) return null;
		const {clon, clat, range_lat} = this.current_region;
		const range_lon = chart.range_lon_from_lat(range_lat);
		return [clon + (x2/width_panel-0.5) * range_lon, clat - (y2/height_panel-0.5) * range_lat];
	}

	init_slider(){
		for(let varname of varnames_variable_vrange){
			$(`#vrange_${varname}`).slider({
				range: true,
				min: max_vrange[varname][0],
				max: max_vrange[varname][1],
				values: default_vrange[varname],
				step: tickint_cbar[varname],
				slide: function( event, elem ) {
					let vmin, vmax;
					if(varnames_nonlinear.includes(varname)){
						vmin = cmap_levs_realval[varname][elem.values[0]];
						vmax = cmap_levs_realval[varname][elem.values[1]];
					}else{
						vmin = elem.values[0];
						vmax = elem.values[1];
					}
					$(`#vrange_${varname}_indicator`).text(`${vmin}〜${vmax} ${units[varname]}`);
					ui.update_cmap(varname, elem.values[0], elem.values[1]);
				}
			});
			let vmin, vmax;
			if(varnames_nonlinear.includes(varname)){
				vmin = cmap_levs_realval[varname][default_vrange[varname][0]];
				vmax = cmap_levs_realval[varname][default_vrange[varname][1]];
			}else{
				vmin = default_vrange[varname][0];
				vmax = default_vrange[varname][1];
			}
			$(`#vrange_${varname}_indicator`).text(`${vmin}〜${vmax} ${units[varname]}`);
		}
	}

	onKey(e) {
		var code = e.key;
		var shift = e.shiftKey;
		var ctrl = e.ctrlKey;
		var alt = e.altKey;
		if (alt) return;
		if(e.target.className.includes("ui-slider-handle")) return;
		getSelection().removeAllRanges();
		if (code == "ArrowRight") {
			ui.inc_ft(6);
			e.stopPropagation();
			e.preventDefault();
			return false;
		} else if (code == "ArrowLeft") {
			ui.inc_ft(-6);
			e.stopPropagation();
			e.preventDefault();
			return false;
		}
	}

	inc_ft(dt){
		let new_ft = Math.min(Math.max(this.ft+dt, 6), 240);
		if(new_ft != this.ft) this.change_ft(new_ft);
	}

	change_ft(new_ft){
		const reload = new_ft == this.ft;
		this.ft = new_ft;
		$(".timebtn").removeClass("timebtn_sel");
		$(`#timebtn_${this.ft}`).addClass("timebtn_sel");
		$(`#timebtn_${this.ft}`).addClass("timebtn_loading");
		grid.load_data(reload);
	}
	

	append_hsl2rgb(hsl, rgbs){
		this.hsl_converter.hsluv_h = (hsl[0]+3600)%360;
		this.hsl_converter.hsluv_s = hsl[1];
		this.hsl_converter.hsluv_l = hsl[2];
		this.hsl_converter.hsluvToRgb();
		rgbs.push(Math.round(this.hsl_converter.rgb_r*255));
		rgbs.push(Math.round(this.hsl_converter.rgb_g*255));
		rgbs.push(Math.round(this.hsl_converter.rgb_b*255));
	}

	update_cmap(varname, vmin=null, vmax=null){
		let varnames = [varname], initializing;
		if(varname === null){
			varnames = Object.keys(cmap_levs);
			initializing = true;
			varname = $("#varname_shade").val();
			$(".shade_prefs").hide();
			if(varnames_multuple_cmaps.includes(varname) || varnames_variable_vrange.includes(varname)){
				$("#shade_prefs_"+varname).show();
			}
		}else{
			initializing = false;
		}

		for(varname of varnames){
			if(varnames_variable_vrange.includes(varname)){
				if(initializing || vmin === null) vmin = $(`#vrange_${varname}`).slider("values", 0);
				if(initializing || vmax === null) vmax = $(`#vrange_${varname}`).slider("values", 1);
				cmap_levs[varname] = [vmin, (vmin+vmax)/2, vmax];
			}
			const levs = cmap_levs[varname];
			let hsls;
			if(varnames_multuple_cmaps.includes(varname)){
				const cmap = $("#cmap_"+varname).val();
				hsls = cmap_hsls[varname][cmap];
				for(let cmap_option of Object.keys(cmap_hsls[varname])){
					if(cmap == cmap_option){
						$(`#shade_prefs_${varname} .ui-slider-range`).addClass("cmap_"+cmap_option);
					}else{
						$(`#shade_prefs_${varname} .ui-slider-range`).removeClass("cmap_"+cmap_option);
					}
				}
			}else{
				hsls = cmap_hsls[varname];
			}
			vmin = levs[0];
			vmax = levs[levs.length-1];
			const n = Math.round((vmax-vmin)/shade_step[varname]);
			let rgbs = [];
			this.append_hsl2rgb(hsls[0], rgbs);
			let ilev = 0;
			for(let i=0; i<n; ++i){
				const value = vmin + shade_step[varname] * (i+0.5);
				while(levs[ilev+1] < value) ilev++;
				const c = (levs[ilev+1] - value) / (levs[ilev+1] - levs[ilev]);
				this.append_hsl2rgb([
					c*hsls[ilev*2+1][0] + (1-c)*hsls[ilev*2+2][0],
					c*hsls[ilev*2+1][1] + (1-c)*hsls[ilev*2+2][1],
					c*hsls[ilev*2+1][2] + (1-c)*hsls[ilev*2+2][2]], rgbs);
			}
			this.append_hsl2rgb(hsls[hsls.length-1], rgbs);
			cmap_rgbs[varname] = new Uint8Array(rgbs);
		}
		this.cbar_valid = false;
		if(!initializing){
			renderer.cached_canvas_all.clear();
			renderer.cached_canvas_gpv.clear();
			renderer.render();
		}
	}
}



function measure_perf(){
	$("#measure_perf").text("Measuring...");
	$("#info").text("");
	setTimeout(() => {
		const t0 = performance.now();
		for(let i=0; i<10; ++i){
			renderer.render(false);
		}
		$("#info").text(`Rendering took ${Math.round((performance.now()-t0)/10)/1000} s on average`);
		$("#measure_perf").text("Render 10 times & calc. average time");
	}, 0);
}

