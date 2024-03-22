class LimitedDict{
	constructor(capacity){
		this.keys = [];
		this.values = [];
		this.capacity = capacity;
	}
	put(key, value){
		const i = this.keys.indexOf(key);
		if(i>-1){
			this.keys.splice(i,1);
			this.values.splice(i,1);
		}
		this.keys.push(key);
		this.values.push(value);
		while(this.keys.length > this.capacity){
			this.keys.shift();
			this.values.shift();
		}
	}
	get(key){
		const i = this.keys.indexOf(key);
		if(i>-1){
			const value = this.values[i];
			this.keys.splice(i,1);
			this.values.splice(i,1);
			this.keys.push(key);
			this.values.push(value);
			return value;
		}else{
			return undefined;
		}
	}
	clear(){
		this.keys = [];
		this.values = [];
	}
}

function fetch_grd(url, cache) {
	return new Promise((resolve, reject) => {
		fetch(url, { cache: cache ? "default" : "reload" })
			.then(response => {
				if (!response.ok) {
					resolve(null);
					return null;
				}
				return response.arrayBuffer();
			})
			.then(buf => {
				if (buf) {
					resolve(decode_grd(buf));
				}
			});
	});
}

function fetch_json(url, cache) {
	return new Promise((resolve, reject) => {
		fetch(url, { cache: cache ? "default" : "reload" })
			.then(response => {
				if (!response.ok) {
					reject();
					return null;
				}
				return response.json();
			})
			.then(json => {
				if (json) {
					resolve(json);
				}
			});
	});
}
