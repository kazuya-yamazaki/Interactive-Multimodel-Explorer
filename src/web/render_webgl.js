
let webgl_programs = {}, webgl_uniforms = {}, webgl_attributes = {};
let webgl_vaos = {};
let canvas_webgl, gl=null;

let webgl_source_vertex = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
uniform vec2 u_resolution;
out vec2 v_texCoord;

void main() {
	vec2 zeroToOne = a_position / u_resolution;
	vec2 zeroToTwo = zeroToOne * 2.0;
	vec2 clipSpace = zeroToTwo - 1.0;
	gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
	v_texCoord = a_texCoord;
}`;

var webgl_sources_frag = {
	"reproj": `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform float clat_src, clon_src, clat_dest, clon_dest;
uniform float range_lon_src, range_lat_src, range_lon_dest, range_lat_dest;
uniform float sinclat_src, cosclat_src, sinclat_dest, cosclat_dest;
uniform vec2 border_ratio;
uniform int nxp, nyp;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
	vec2 texCoord_model = vec2(v_texCoord.x*float(nxp), v_texCoord.y*float(nyp));
	int ix = int(floor(texCoord_model.x));
	int iy = int(floor(texCoord_model.y));
	texCoord_model.x -= float(ix);
	texCoord_model.y -= float(iy);

	float DEG2RAD = 0.01745329251, RAD2DEG = 57.295779513;
	float x,y, rho2,cosc, lon,lat, cosdlon,sindlon;
	float coslat, sinlat;

	x = texCoord_model.x;
	y = texCoord_model.y;
	if(x > (1. - border_ratio.x) || y > (1. - border_ratio.y)){
		outColor = vec4(0.,0.,0.,1.);
		return;
	}

	x = (x-0.5) * range_lon_dest * DEG2RAD;
	y = (0.5-y) * range_lat_dest * DEG2RAD;
	rho2 = x*x+y*y;
	if(rho2 >= 1.){
		outColor = vec4(0.75,0.75,0.75,1.0);
		return;
	}
	cosc = sqrt(1.-rho2);		
	sinlat = cosc*sinclat_dest + y*cosclat_dest;
	lon = clon_dest + atan(x, cosc*cosclat_dest - y*sinclat_dest) * RAD2DEG;
	cosdlon = cos((lon - clon_src)*DEG2RAD);
	sindlon = sin((lon - clon_src)*DEG2RAD);
	coslat  = sqrt(1.-sinlat*sinlat);
	if(sinclat_src*sinlat + cosclat_src*coslat*cosdlon <= 0.){
		outColor = vec4(0.75,0.75,0.75,1.0);
		return;
	}
	x = coslat * sindlon * RAD2DEG;
	y = (cosclat_src * sinlat - sinclat_src * coslat * cosdlon) * RAD2DEG;
	texCoord_model.x = x / range_lon_src + 0.5;
	texCoord_model.y = 0.5 - y / range_lat_src;
	if(texCoord_model.x < 0. || texCoord_model.x > 1. - border_ratio.x || texCoord_model.y < 0. || texCoord_model.y > 1. - border_ratio.y){
		outColor = vec4(0.75,0.75,0.75,1.0);
		return;
	}

	texCoord_model.x = (float(ix) + texCoord_model.x) / float(nxp);
	texCoord_model.y = (float(iy) + texCoord_model.y) / float(nyp);
	outColor = texture(u_image, texCoord_model);
}`, 

	"shade": `#version 300 es
precision highp float;
precision mediump sampler3D;
uniform sampler3D grid_data;
uniform sampler2D grid_coords, cmap;
uniform float clat, clon, range_lon, range_lat;
uniform float sinclat, cosclat;
uniform vec2 border_ratio, norm;
uniform int nxp, nyp, nlevs, proj_id;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
	vec2 texCoord_model = vec2(v_texCoord.x*float(nxp), v_texCoord.y*float(nyp));
	int ixp = int(floor(texCoord_model.x));
	int iyp = int(floor(texCoord_model.y));
	int i = ixp + iyp * nxp;
	texCoord_model.x -= float(ixp);
	texCoord_model.y -= float(iyp);

	float nx_grid = float(texelFetch(grid_coords, ivec2(4,i), 0)[0]);
	float ny_grid = float(texelFetch(grid_coords, ivec2(5,i), 0)[0]);
	if(nx_grid < 1.){
		outColor = vec4(0.5,0.5,0.5,1.);
		return;
	}
	float lon0_grid = texelFetch(grid_coords, ivec2(0,i), 0)[0];
	float lat0_grid = texelFetch(grid_coords, ivec2(1,i), 0)[0];
	float dlon_grid = texelFetch(grid_coords, ivec2(2,i), 0)[0];
	float dlat_grid = texelFetch(grid_coords, ivec2(3,i), 0)[0];

	float DEG2RAD = 0.01745329251, RAD2DEG = 57.295779513;
	float x,y, rho2,cosc, lon,lat, cosdlon,sindlon;

	x = texCoord_model.x;
	y = texCoord_model.y;
	if(x > (1. - border_ratio.x) || y > (1. - border_ratio.y)){
		outColor = vec4(0.,0.,0.,1.);
		return;
	}

	switch(proj_id){
	case 0:
		lon = (x-0.5) * range_lon + clon;
		lat = (0.5-y) * range_lat + clat;
		break;
	case 1:
		x = (x-0.5) * range_lon * DEG2RAD;
		y = (0.5-y) * range_lat * DEG2RAD;
		rho2 = x*x+y*y;
		if(rho2 >= 1.){
			outColor = vec4(0.75,0.75,0.75,1.0);
			return;
		}
		cosc = sqrt(1.-rho2);		
		lat = asin(cosc*sinclat + y*cosclat) * RAD2DEG;
		lon = clon + atan(x, cosc*cosclat - y*sinclat) * RAD2DEG;
		break;
	}

	x = (lon - lon0_grid) / dlon_grid;
	y = (lat - lat0_grid) / dlat_grid;
	x -= floor(x/(nx_grid-1.))*(nx_grid-1.);
	if(x < 0. || x > nx_grid-1. || y < 0. || y > ny_grid-1.){
		outColor = vec4(0.75,0.75,0.75,1.0);
		return;
	}

	int ix0 = int(floor(x)), ix1 = int(ceil(x));
	int iy0 = int(floor(y)), iy1 = int(ceil(y));
	float cx = 1. - (x - float(ix0)), cy = 1. - (y - float(iy0));

	float value;
	value =       cx  *     cy  * texelFetch(grid_data, ivec3(ix0,iy0,i), 0)[0]
			+ (1.-cx) *     cy  * texelFetch(grid_data, ivec3(ix1,iy0,i), 0)[0]
			+     cx  * (1.-cy) * texelFetch(grid_data, ivec3(ix0,iy1,i), 0)[0]
			+ (1.-cx) * (1.-cy) * texelFetch(grid_data, ivec3(ix1,iy1,i), 0)[0];
	
	value = floor(min(max((value - norm[0]) / norm[1], 0.), float(nlevs-1)));
	outColor = vec4( texelFetch(cmap, ivec2(int(value), 0), 0).xyz, 1. );
}`};

function getShader(gl, src, shader_type){
	var shader;
	if (shader_type == "fragment"){
		shader = gl.createShader ( gl.FRAGMENT_SHADER );
	}else{
		shader = gl.createShader(gl.VERTEX_SHADER);
	}
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0){
		alert(gl.getShaderInfoLog(shader));
	}
	return shader;
}

function setupProgram(name, uniform_vars, attribute_vars){
	webgl_programs[name] = gl.createProgram();
	webgl_uniforms[name] = {};
	webgl_attributes[name] = {};
	gl.attachShader(webgl_programs[name], getShader(gl, webgl_source_vertex, "vertex"));
	gl.attachShader(webgl_programs[name], getShader(gl, webgl_sources_frag[name], "fragment"));
	gl.linkProgram(webgl_programs[name]);
	gl.useProgram(webgl_programs[name]);
	for(unif of uniform_vars){
		webgl_uniforms[name][unif] = gl.getUniformLocation(webgl_programs[name], unif);
	}
	for(unif of attribute_vars){
		webgl_attributes[name][unif] = gl.getAttribLocation(webgl_programs[name], unif);
	}
}

function setupTexture(texture_id, prog, varname, filter){
	const tex = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0 + texture_id);
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
	gl.uniform1i(webgl_uniforms[prog][varname], texture_id);
}

function setupTexture3D(texture_id, prog, varname, filter){
	const tex = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0 + texture_id);
	gl.bindTexture(gl.TEXTURE_3D, tex);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
	gl.uniform1i(webgl_uniforms[prog][varname], texture_id);
}

function setup_webgl(chart, initializing, resolution_adj){
	const {nxp, nyp, width_panel, height_panel, lw_border,
		height_title, width_lticks, height_bticks, dpr} = chart;
	
	if(initializing) canvas_webgl = document.getElementById("canvas_webgl");
	canvas_webgl.width = width_panel * nxp + nxp * lw_border;
	canvas_webgl.height = height_panel * nyp + nyp * lw_border;
	if(initializing){
		gl = canvas_webgl.getContext("webgl2");
		setupProgram("reproj", ["u_resolution", "nxp", "nyp", "border_ratio", "u_image",
				"clat_src", "clon_src", "clat_dest", "clon_dest",
				"range_lon_src", "range_lat_src", "range_lon_dest", "range_lat_dest",
				"sinclat_src", "cosclat_src", "sinclat_dest", "cosclat_dest",
			], ["a_position", "a_texCoord"]);
		setupProgram("shade", ["u_resolution", "nxp", "nyp", "border_ratio", "grid_data",
				"grid_sizes", "grid_coords", "cmap",
				"clat", "clon", "range_lon", "range_lat", "sinclat", "cosclat",
				"norm", "nlevs", "proj_id"
			], ["a_position", "a_texCoord"]);
	}
	for(let prog of ["reproj", "shade"]){
		gl.useProgram(webgl_programs[prog]);
		gl.uniform1i(webgl_uniforms[prog]["nxp"], nxp);
		gl.uniform1i(webgl_uniforms[prog]["nyp"], nyp);
		gl.uniform2f(webgl_uniforms[prog]["border_ratio"], lw_border / width_panel, lw_border / height_panel);

		webgl_vaos[prog] = gl.createVertexArray();
		gl.bindVertexArray(webgl_vaos[prog]);
		let positionBuffer = gl.createBuffer();
		gl.enableVertexAttribArray(webgl_attributes[prog]["a_position"]);
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			0, 0,
			gl.canvas.width, 0,
			0, gl.canvas.height,
			0, gl.canvas.height,
			gl.canvas.width, 0,
			gl.canvas.width, gl.canvas.height
		]), gl.STATIC_DRAW);
		gl.vertexAttribPointer(webgl_attributes[prog]["a_position"], 2, gl.FLOAT, false, 0, 0);

		let texCoordBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
			0.0,  0.0,
			1.0,  0.0,
			0.0,  1.0,
			0.0,  1.0,
			1.0,  0.0,
			1.0,  1.0,
		]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(webgl_attributes[prog]["a_texCoord"]);
		gl.vertexAttribPointer(webgl_attributes[prog]["a_texCoord"], 2, gl.FLOAT, false, 0, 0);
		gl.uniform2f(webgl_uniforms[prog]["u_resolution"], gl.canvas.width, gl.canvas.height);
	}
	
	if(initializing){
		gl.useProgram(webgl_programs["reproj"]);
		setupTexture(0, "reproj", "u_image0", gl.LINEAR);

		gl.useProgram(webgl_programs["shade"]);
		setupTexture3D(1, "shade", "grid_data", gl.NEAREST);
		setupTexture(2, "shade", "grid_coords", gl.NEAREST);
		setupTexture(3, "shade", "cmap", gl.NEAREST);
	}

	canvas_webgl.style.left = `${width_lticks/dpr/resolution_adj}px`;
	canvas_webgl.style.top = `${height_title/dpr/resolution_adj}px`;
	canvas_webgl.style.width  = `${canvas_webgl.width/dpr/resolution_adj}px`;
	canvas_webgl.style.height  = `${canvas_webgl.height/dpr/resolution_adj}px`;
}

function draw_reproj_webgl(start_clon, start_clat,  start_range_lon, start_range_lat,
		clon, clat, range_lon, range_lat){
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(webgl_programs["reproj"]);
	gl.bindVertexArray(webgl_vaos["reproj"]);
	gl.uniform1f(webgl_uniforms["reproj"]["clat_src"], start_clat);
	gl.uniform1f(webgl_uniforms["reproj"]["clon_src"], start_clon);
	gl.uniform1f(webgl_uniforms["reproj"]["clat_dest"], clat);
	gl.uniform1f(webgl_uniforms["reproj"]["clon_dest"], clon);
	gl.uniform1f(webgl_uniforms["reproj"]["range_lon_src"], start_range_lon);
	gl.uniform1f(webgl_uniforms["reproj"]["range_lat_src"], start_range_lat);
	gl.uniform1f(webgl_uniforms["reproj"]["range_lon_dest"], range_lon);
	gl.uniform1f(webgl_uniforms["reproj"]["range_lat_dest"], range_lat);
	const DEG2RAD = 0.01745329251;
	gl.uniform1f(webgl_uniforms["reproj"]["sinclat_src"], Math.sin(start_clat *DEG2RAD));
	gl.uniform1f(webgl_uniforms["reproj"]["cosclat_src"], Math.cos(start_clat *DEG2RAD));
	gl.uniform1f(webgl_uniforms["reproj"]["sinclat_dest"], Math.sin(clat *DEG2RAD));
	gl.uniform1f(webgl_uniforms["reproj"]["cosclat_dest"], Math.cos(clat *DEG2RAD));
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.finish();
}

function draw_shade_webgl(ctx, proj_id, clon,clat,range_lon,range_lat){
	if(grid.array_data["shade"] === null){
		ctx.fillStyle = "white";
		ctx.fillRect(0,0, chart.canvas_gpv.width, chart.canvas_gpv.height);
		return;
	}
	const {varname_shade} = ui;
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(webgl_programs["shade"]);
	gl.bindVertexArray(webgl_vaos["shade"]);
	gl.uniform1f(webgl_uniforms["shade"]["clat"], clat);
	gl.uniform1f(webgl_uniforms["shade"]["clon"], clon);
	gl.uniform1f(webgl_uniforms["shade"]["range_lon"], range_lon);
	gl.uniform1f(webgl_uniforms["shade"]["range_lat"], range_lat);
	const DEG2RAD = 0.01745329251;
	gl.uniform1f(webgl_uniforms["shade"]["sinclat"], Math.sin(clat *DEG2RAD));
	gl.uniform1f(webgl_uniforms["shade"]["cosclat"], Math.cos(clat *DEG2RAD));

	let grid_sizes = new Int32Array(6*2), grid_coords = new Float32Array(6*6);
	for(let i=0; i<6; i++){
		if(grid.array_data["shade"][i] === null){
			grid_coords[i*6+4] = 0;
			grid_coords[i*6+5] = 0;
		}else{
			grid_coords[i*6+4] = grid.nx_grid["shade"][i];
			grid_coords[i*6+5] = grid.ny_grid["shade"][i];
			grid_coords[i*6+0] = grid.lon0_grid["shade"][i];
			grid_coords[i*6+1] = grid.lat0_grid["shade"][i];
			grid_coords[i*6+2] = grid.dlon_grid["shade"][i];
			grid_coords[i*6+3] = grid.dlat_grid["shade"][i];
		}
	}
	const v0 = -offset[varname_shade] + cmap_levs[varname_shade][0], dv = shade_step[varname_shade];
	const nlevs = cmap_rgbs[varname_shade].length/3;
	gl.uniform2f(webgl_uniforms["shade"]["norm"], v0, dv);
	gl.uniform1i(webgl_uniforms["shade"]["nlevs"], nlevs);
	gl.uniform1i(webgl_uniforms["shade"]["proj_id"], proj_id);
	gl.activeTexture(gl.TEXTURE2);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 6, 6, 0, gl.RED, gl.FLOAT, grid_coords);
	gl.activeTexture(gl.TEXTURE3);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, nlevs, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, cmap_rgbs[varname_shade]);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.finish();
	ctx.drawImage(canvas_webgl, 0,0);
}
