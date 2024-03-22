class Grid{

	constructor(){
		this.array_data = {"shade": [], "ctr": []};
		this.nx_grid = {"shade": [], "ctr": []};
		this.ny_grid = {"shade": [], "ctr": []};
		this.lon0_grid = {"shade": [], "ctr": []};
		this.lat0_grid = {"shade": [], "ctr": []};
		this.dlon_grid = {"shade": [], "ctr": []};
		this.dlat_grid = {"shade": [], "ctr": []};
		this.datalen_max = {"shade": [], "ctr": []};
		this.lowhighs = [];
		this.cached_data = new LimitedDict(10);
	}
	
	prepare_data(varname, cache, is_shade){
		const shade_ctr = is_shade ? "shade" : "ctr";
		const smoothing = is_shade ? $("#smoothing").val() : "none";
		if(varname == "none"){
			this.array_data[shade_ctr] = null;
			return new Promise(resolve => {resolve()});
		}
		const url = this.data_url(varname);
		return new Promise(async resolve => {
			const key = `${url}?is_shade=${is_shade}&smoothing=${smoothing}`;
			let alldata;
			const canvas_key = ui.current_state_toString();
			if(!cache && renderer.cached_canvas_all.get(canvas_key)) renderer.cached_canvas_all.put(canvas_key, null);
			if(cache && this.cached_data.get(key)){
				alldata = this.cached_data.get(key);
			}else{
				alldata = smooth_data(await fetch_grd(url, cache), is_shade);
				this.cached_data.put(key, alldata);
			}
			if(!is_shade) this.lowhighs = alldata.lowhighs;
			this.array_data[shade_ctr] = alldata.ary_data;
			this.nx_grid[shade_ctr] = alldata.nx_data;
			this.ny_grid[shade_ctr] = alldata.ny_data;
			this.lon0_grid[shade_ctr] = alldata.lon0_data;
			this.dlon_grid[shade_ctr] = alldata.dlon_data;
			this.lat0_grid[shade_ctr] = alldata.lat0_data;
			this.dlat_grid[shade_ctr] = alldata.dlat_data;
			this.datalen_max[shade_ctr] = alldata.datalen_max;
			if(is_shade && gl){
				let nx_max = 1, ny_max = 1;
				for(let i=0; i<6; ++i){
					if(alldata.ary_data[i]){
						nx_max = Math.max(nx_max, alldata.nx_data[i]);
						ny_max = Math.max(ny_max, alldata.ny_data[i]);
					}
				}
				let buffer = new Float32Array(nx_max*ny_max*6);
				for(let i=0; i<6; ++i){
					if(alldata.ary_data[i]){
						let nx = alldata.nx_data[i], ny = alldata.ny_data[i];
						for(let iy=0; iy<ny; ++iy){
							for(let ix=0; ix<nx; ++ix){
								buffer[i*nx_max*ny_max + ix+iy*nx_max] = alldata.ary_data[i][ix+iy*nx];
							}
						}
					}
				}
				gl.useProgram(webgl_programs["shade"]);
				gl.activeTexture(gl.TEXTURE1);
				gl.texImage3D(gl.TEXTURE_3D, 0, gl.R32F, nx_max, ny_max, 6, 0, gl.RED, gl.FLOAT, buffer);
			}
			resolve();
		});
	}
	
	data_url(varname){
		return `data/${ui.init_ymdh}/${ui.ft}_${varname}.bin`;
	}

	async load_data(nocache){
		ui.init_ymdh = $("#initial_ymdh").val();
		processing = true;
		await Promise.all([grid.prepare_data(ui.varname_shade, !nocache, true), grid.prepare_data(ui.varname_ctr, !nocache, false)]);
		renderer.render();
	}
}

function decode_grd(buf){
	let result = [null, null, null, null, null, null];
	let datalen_max = 0;
	let ibuf = 16;
	while(ibuf < buf.byteLength){
		let buf_uint16 = new Uint16Array(buf, ibuf+0, 3);
		const model = buf_uint16[0];
		const nx = buf_uint16[1], ny = buf_uint16[2];
		let buf_float32 = new Float32Array(buf, ibuf+8, 4);
		const lon0 = buf_float32[0], lat0 = buf_float32[1], dlon = buf_float32[2], dlat = buf_float32[3];
		let buf_uint32 = new Uint32Array(buf, ibuf+24, 2);
		const nlow = buf_uint32[0], nhigh = buf_uint32[1];
		buf_float32 = new Float32Array(buf, ibuf+32, 3*(nlow+nhigh));
		let lows = [], highs = [];
		for(let i=0; i<nlow; ++i){
			lows.push([buf_float32[3*i], buf_float32[3*i+1], buf_float32[3*i+2]]);
		}
		for(let i=nlow; i<nlow+nhigh; ++i){
			highs.push([buf_float32[3*i], buf_float32[3*i+1], buf_float32[3*i+2]]);
		}
		const data_orig = new Uint8Array(buf, ibuf+32+4*3*(nlow+nhigh), nx*ny);
		const data = new Float32Array(nx*ny);
		for(let i=0; i<nx*ny; ++i){
			data[i] = data_orig[i] == 255 ? Math.NaN : data_orig[i];
		}
		result[model] = {
			data, nx, ny, lon0, dlon, lat0, dlat, lows, highs
		};
		ibuf += Math.ceil((32+4*3*(nlow+nhigh) + nx*ny)/4)*4;
		datalen_max = Math.max(datalen_max, nx*ny);
	}
	return {models: result, datalen_max: datalen_max};
}

function smooth_data(decoded, is_shade){
	let result = {
		ary_data: [null, null, null, null, null, null],
		nx_data: [null, null, null, null, null, null],
		ny_data: [null, null, null, null, null, null],
		lon0_data: [null, null, null, null, null, null],
		lat0_data: [null, null, null, null, null, null],
		dlon_data: [null, null, null, null, null, null],
		dlat_data: [null, null, null, null, null, null],
		lowhighs: [null, null, null, null, null, null]
	};

	if(!decoded) return result;
	const models = decoded.models;
	let smoothing = $("#smoothing").val();
	const {varname_ctr, varname_shade} = ui;
	const varname = is_shade ? varname_shade : varname_ctr;
	
	if(smoothing == "default"){
		if(varnames_5x5_smooth.includes(varname)){
			smoothing = "5x5";
		}else if(varnames_nosmooth.includes(varname)){
			smoothing = "none";
		}else{
			smoothing = "3x3";
		}
	}

	for(let i=0; i<6; ++i){
		if(models[i] === null){
			result.ary_data[i] = null;
			continue;
		}
		const tmpdata = models[i].data;
		const nx = models[i].nx;
		const ny = models[i].ny;
		const data = new Float32Array(nx*ny);
		let ix, iy;
		for(iy=0; iy<ny; ++iy){
			data[     iy*nx] = tmpdata[     iy*nx];
			data[   1+iy*nx] = tmpdata[   1+iy*nx];
			data[nx-2+iy*nx] = tmpdata[nx-2+iy*nx];
			data[nx-1+iy*nx] = tmpdata[nx-1+iy*nx];
		}
		for(ix=0; ix<nx; ++ix){
			data[ix          ] = tmpdata[ix          ];
			data[ix+       nx] = tmpdata[ix+       nx];
			data[ix+(ny-2)*nx] = tmpdata[ix+(ny-2)*nx];
			data[ix+(ny-1)*nx] = tmpdata[ix+(ny-1)*nx];
		}
		if(smoothing == "none"){
			for(iy=2; iy<ny-2; ++iy){
				for(ix=2; ix<nx-2; ++ix){
					data[ix+iy*nx] = tmpdata[ix+iy*nx];
				}
			}
		}else if(smoothing == "3x3"){
			for(iy=1; iy<ny-1; ++iy){
				for(ix=1; ix<nx-1; ++ix){
					const value =  (  tmpdata[(ix-1)+(iy-1)*nx] + tmpdata[ix+(iy-1)*nx] + tmpdata[(ix+1)+(iy-1)*nx]
									+ tmpdata[(ix-1)+(iy  )*nx] + tmpdata[ix+(iy  )*nx] + tmpdata[(ix+1)+(iy  )*nx]
									+ tmpdata[(ix-1)+(iy+1)*nx] + tmpdata[ix+(iy+1)*nx] + tmpdata[(ix+1)+(iy+1)*nx] ) / 9;
					data[ix+iy*nx] = Math.min(Math.max(value, tmpdata[ix+iy*nx]-0.5), tmpdata[ix+iy*nx]+0.5);
				}
			}
		}else{
			for(iy=2; iy<ny-2; ++iy){
				for(ix=2; ix<nx-2; ++ix){
					let value = 0;
					for(let dy=-2; dy<=2; ++dy){
						for(let dx=-2; dx<=2; ++dx){
							value += tmpdata[(ix+dx)+(iy+dy)*nx];
						}
					}
					value /= 25;
					data[ix+iy*nx] = Math.min(Math.max(value, tmpdata[ix+iy*nx]-0.5), tmpdata[ix+iy*nx]+0.5);
				}
			}
		}

		if(is_shade){
			const level_adj = varnames_nonlinear.includes(varname) ? 0.5 : 1.5;
			for(iy=0; iy<ny; ++iy){
				for(ix=0; ix<nx; ++ix){
					data[ix+iy*nx] = (data[ix+iy*nx] + level_adj)*factor[varname];
				}
			}
		}else{
			for(iy=0; iy<ny; ++iy){
				for(ix=0; ix<nx; ++ix){
					data[ix+iy*nx] = (data[ix+iy*nx] + 0.5)*factor[varname] + offset[varname];
				}
			}
			result.lowhighs[i] = [models[i].lows, models[i].highs];
		}
		result.ary_data[i] = data;
		result.nx_data[i] = nx; result.ny_data[i] = ny;
		result.lon0_data[i] = models[i].lon0; result.dlon_data[i] = models[i].dlon;
		result.lat0_data[i] = models[i].lat0; result.dlat_data[i] = models[i].dlat;
	}
	result.datalen_max = decoded.datalen_max;
	return result;
}
