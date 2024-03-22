class Chart{
	constructor(){
		this.canvas_all = $("#canvas")[0];
		this.canvas_gpv = document.createElement("canvas");
		this.canvas_overlay = document.createElement("canvas");
		this.canvas_coast = document.createElement("canvas");
		this.canvas_cbar = null;
		this.dpr = window.devicePixelRatio;
		this.resolution_adj = 1;
		this.set_size(true);
	}
	
	
	set_size(initializing){
		this.resolution_adj = parseFloat($("#resolution").val());
		if(!this.resolution_adj) this.resolution_adj = 1;
		const dpr = this.dpr;
		const width_window = (window.innerWidth - 10) * dpr;
		const height_window = window.innerHeight * 0.87 * dpr;
		if(width_window/3 > height_window/2){
			this.nxp = 3;
			this.nyp = 2;
		}else{
			this.nxp = 2;
			this.nyp = 3;
		}
		this.vert_cbar = (width_window > height_window);
		this.width_panel  = Math.floor(width_window  / (this.nxp+0.2 + (this.vert_cbar ? 0.2 : 0)) * this.resolution_adj);
		this.height_panel = Math.floor(height_window / (this.nyp+0.2 + (this.vert_cbar ? 0 : 0.27)) * this.resolution_adj);
		this.lw_border = Math.round(2 * Math.pow(dpr,0.6) * this.resolution_adj);
		this.canvas_gpv.width      = (this.width_panel  + this.lw_border) * this.nxp;
		this.canvas_gpv.height     = (this.height_panel + this.lw_border) * this.nyp;
		this.canvas_overlay.width  = (this.width_panel  + this.lw_border) * this.nxp;
		this.canvas_overlay.height = (this.height_panel + this.lw_border) * this.nyp;

		this.width_lticks  = Math.round(0.14 * this.width_panel * Math.pow(dpr, 0.3));
		this.height_bticks = Math.round(0.65 * this.width_lticks);
		this.height_title = Math.round((this.vert_cbar?0.1:0.2) * this.height_panel);

		this.width_cbar = this.vert_cbar ? this.width_panel * 0.2 : this.height_panel * 0.25;

		this.canvas_all.width  = this.width_panel  * this.nxp + (this.nxp+1) * this.lw_border
								+ this.width_lticks + (this.vert_cbar ? this.width_cbar : 0);
		this.canvas_all.height = this.height_panel * this.nyp + (this.nyp+1) * this.lw_border
								+ this.height_title + this.height_bticks + (this.vert_cbar ? 0 : this.width_cbar);
		this.canvas_all.style.width  = `${this.canvas_all.width/dpr/this.resolution_adj}px`;
		this.canvas_all.style.height = `${this.canvas_all.height/dpr/this.resolution_adj}px`;

		this.canvas_coast.width  = this.width_panel;
		this.canvas_coast.height = this.height_panel;

		$("#canvas_container").css("width", `${this.canvas_all.width/dpr/this.resolution_adj}px`);
		$("#canvas_container").css("height", `${this.canvas_all.height/dpr/this.resolution_adj}px`);
		setup_webgl(this, initializing, this.resolution_adj);
		if(!initializing){
			this.canvas_cbar.remove();
			this.canvas_cbar = null;
			this.cbar_valid = false;
			renderer.render(false);
		}
	}

	range_lon_from_lat(range_lat){
		return range_lat * this.width_panel / this.height_panel;
	}
}
