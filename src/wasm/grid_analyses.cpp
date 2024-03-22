#include <vector>
#include <cmath>

#define min3(x,y,z) min(min((x),(y)),(z))
#define max3(x,y,z) max(max((x),(y)),(z))

using namespace std;

// This class implements the square marching algorithm.
class Contour_finder{
private:
	enum edge_dir {
		northward = 1,
		eastward  = 2,
		southward = 3,
		westward  = 4
	};
	
	int x0, x1, nex, nxall;
	int y0, y1, ney, nyall;
	int skip;
	vector<vector<float>>* ccoords;
	vector<float>* clevs;
	
	float* edge_hor;
	float* edge_vert;
	
	void add_line(vector<float>& line0, vector<float>& line1, float clev){
		vector<float> all;
		clevs->push_back(clev);
		all.reserve(line0.size() + line1.size());
		for(int i=line1.size()/2-1; i>=0; --i){
			all.push_back(line1[2*i]);
			all.push_back(line1[2*i+1]);
		}
		all.insert( all.end(), line0.begin(), line0.end() );
		ccoords->push_back(all);
	}
	
	bool should_I_connect_sw_ne(float s, float w, float n, float e){
		const float d1 = hypot((float)s, (float)w) + hypot(1.f-n, 1.f-e);
		const float d2 = hypot(1.f-s, (float)e) + hypot((float)n, 1.f-w);
		return (d1 <= d2);
	}
	
	void trace(int ei, int ej, edge_dir enter_dir, vector<float>& line){
		float e1,e2,e3,e4;
		bool first = true;
		
		line.clear();
		line.reserve(200);
		
		while(true){
			if( ei<0 || ei>=nex-1 || ej<0 || ej>=ney-1 ){
				switch(enter_dir){
				case northward:
					line.push_back(x0+(ei+edge_hor[ei+ej*nex])*skip);
					line.push_back((float)(y0+ej*skip));
					return;
				case eastward:
					line.push_back((float)(x0+ei*skip));
					line.push_back(y0+(ej+edge_vert[ei+ej*nex])*skip);
					return;
				case southward:
					line.push_back(x0+(ei+edge_hor[ei+(ej+1)*nex])*skip);
					line.push_back((float)(y0+(ej+1)*skip));
					return;
				case westward:
					line.push_back((float)(x0+(ei+1)*skip));
					line.push_back(y0+(ej+edge_vert[(ei+1)+ej*nex])*skip);
					return;
				}
			}
			
			e1 = edge_hor [ ei   + ej   *nex];
			e2 = edge_vert[ ei   + ej   *nex];
			e3 = edge_hor [ ei   +(ej+1)*nex];
			e4 = edge_vert[(ei+1)+ ej   *nex];
			
			switch(enter_dir){
			case northward:
				if(e1>2) return;
				line.push_back(x0+(ei+e1)*skip);
				line.push_back((float)(y0+ej*skip));
				
				if(!first) edge_hor[ei+ej*nex] = 3.f;
				first = false;
				
				if( e2<2 && e3<2 && e4<2 ){
					if(should_I_connect_sw_ne(e1,e2,e3,e4)){
						enter_dir = edge_dir::westward; ei--; continue;
					}else{
						enter_dir = edge_dir::eastward; ei++; continue;
					}
				}
				if( e2<2 ){ enter_dir = edge_dir::westward;  ei--; continue; }
				if( e3<2 ){ enter_dir = edge_dir::northward; ej++; continue; }
				if( e4<2 ){ enter_dir = edge_dir::eastward;  ei++; continue; }
				return;
			case eastward:
				if(e2>2) return;
				line.push_back((float)(x0+ei*skip));
				line.push_back(y0+(ej+e2)*skip);
				
				if(!first) edge_vert[ei+ej*nex] = 3.f;
				first = false;
				
				if( e1<2 && e3<2 && e4<2 ){
					if(should_I_connect_sw_ne(e1,e2,e3,e4)){
						enter_dir = edge_dir::southward; ej--; continue;
					}else{
						enter_dir = edge_dir::northward; ej++; continue;
					}
				}
				if( e1<2 ){ enter_dir = edge_dir::southward; ej--; continue; }
				if( e3<2 ){ enter_dir = edge_dir::northward; ej++; continue; }
				if( e4<2 ){ enter_dir = edge_dir::eastward;  ei++; continue; }
				return;
			case southward:
				if(e3>2) return;
				line.push_back(x0+(ei+e3)*skip);
				line.push_back((float)(y0+(ej+1)*skip));
				
				if(!first) edge_hor[ei+(ej+1)*nex] = 3.f;
				first = false;
				
				if( e1<2 && e2<2 && e4<2 ){
					if(should_I_connect_sw_ne(e1,e2,e3,e4)){
						enter_dir = edge_dir::eastward; ei++; continue;
					}else{
						enter_dir = edge_dir::westward; ei--; continue;
					}
				}
				if( e1<2 ){ enter_dir = edge_dir::southward; ej--; continue; }
				if( e2<2 ){ enter_dir = edge_dir::westward;  ei--; continue; }
				if( e4<2 ){ enter_dir = edge_dir::eastward;  ei++; continue; }
				return;
			case westward:
				if(e4>2) return;
				line.push_back((float)(x0+(ei+1)*skip));
				line.push_back(y0+(ej+e4)*skip);
				
				if(!first) edge_vert[(ei+1)+ej*nex] = 3.f;
				first = false;
				
				if( e1<2 && e2<2 && e3<2 ){
					if(should_I_connect_sw_ne(e1,e2,e3,e4)){
						enter_dir = edge_dir::northward; ej++; continue;
					}else{
						enter_dir = edge_dir::southward; ej--; continue;
					}
				}
				if( e1<2 ){ enter_dir = edge_dir::southward; ej--; continue; }
				if( e2<2 ){ enter_dir = edge_dir::westward;  ei--; continue; }
				if( e3<2 ){ enter_dir = edge_dir::northward; ej++; continue; }
				return;
			}
		}
	}
	
	// To avoid looking for contour lines that are not present, the gridded data is split to nblockx*nblocky blocks.
	// Maximum and minimum values are calculated for each subblock.
	// Scanning for contours in find_contours() will only be performed within the value ranges in the subblocks.
	void calc_range(float* v, float cmin, float cmax, float cint, float* vmin, float* vmax, int& ic0, int& ic1,
					int blockx, int blocky, int nblockx, int nblocky, float* block_min, float* block_max){
		int ix, iy, ibx, ibx2, iby;
		float val;
		float block_min_tmp[nblockx*nblocky];
		float block_max_tmp[nblockx*nblocky];
		
		*vmax = -1e20f;
		*vmin = 1e20f;
		
		if(nblockx>=3){
			for(int ij=0; ij<nblockx*nblocky; ++ij){
				block_min_tmp[ij] = 1e20f;
				block_max_tmp[ij] = -1e20f;
			}
		}else{
			for(int ij=0; ij<nblockx*nblocky; ++ij){
				block_min[ij] = -1e20f;
				block_max[ij] = 1e20f;
			}
		}
		for(iy=y0; iy<y1; iy+=skip){
			for(ix=x0; ix<x1; ix+=skip){
				val = v[ix+iy*nxall];
				if(isnan(val)) continue;
				if(nblockx>=3){
					ibx = max(((ix-x0)/skip-1)/blockx,0);
					iby = (iy-y0)/skip/blocky;
					block_min_tmp[ibx+iby*nblockx] = min(block_min_tmp[ibx+iby*nblockx], val);
					block_max_tmp[ibx+iby*nblockx] = max(block_max_tmp[ibx+iby*nblockx], val);
					ibx2 = min(((ix-x0)/skip+1)/blockx,nblockx-1);
					if(ibx2 != ibx){
						block_min_tmp[ibx2+iby*nblockx] = min(block_min_tmp[ibx2+iby*nblockx], val);
						block_max_tmp[ibx2+iby*nblockx] = max(block_max_tmp[ibx2+iby*nblockx], val);
					}
				}else{
					*vmin = min(*vmin, val);
					*vmax = max(*vmax, val);
				}
			}
		}
		if(nblockx>=3){
			for(iby=0; iby<nblocky; ++iby){
				for(ibx=0; ibx<nblockx; ++ibx){
					block_min[ibx+iby*nblockx]
						 = min3( block_min_tmp[ibx+max(iby-1,        0)*nblockx],
								 block_min_tmp[ibx+    iby             *nblockx],
								 block_min_tmp[ibx+min(iby+1,nblocky-1)*nblockx] );
					*vmin = min(*vmin, block_min[ibx+iby*nblockx]);
					block_max[ibx+iby*nblockx]
						 = max3( block_max_tmp[ibx+max(iby-1,        0)*nblockx],
								 block_max_tmp[ibx+    iby             *nblockx],
								 block_max_tmp[ibx+min(iby+1,nblocky-1)*nblockx] );
					*vmax = max(*vmax, block_max[ibx+iby*nblockx]);
				}
			}
		}
		*vmin = max(*vmin, cmin);
		*vmax = min(*vmax, cmax);
		ic0 = (int)ceil(*vmin / cint);
		ic1 = (int)floor(*vmax / cint)+ 1;
	}

public:	
	void find_contours(float* v,
					int _nxall, int _x0, int _x1, 
					int _nyall, int _y0, int _y1, int _skip,
					float cmin, float cmax, float cint,
					float* vmin, float* vmax,
					vector<vector<float>>* _ccoords, vector<float>* _clevs){
		vector<float> line0, line1;
		float clev;
		int ic, ic0, ic1;
		int ij, i, j, ei, ej;
		int ib, jb;
		
		x0 = _x0; x1 = _x1; nxall = _nxall;
		y0 = _y0; y1 = _y1; nyall = _nyall; skip = _skip;
		nex = (_x1 - _x0) / skip + 1;
		ney = (_y1 - _y0) / skip + 1;
		ccoords = _ccoords;
		clevs = _clevs;
		
		const int blockx = max(nex/10, 50);
		const int blocky = max(ney/10, 50);
		const int nblockx = (nex+blockx-1) / blockx;
		const int nblocky = (ney+blocky-1) / blocky;
		float block_min[nblockx*nblocky];
		float block_max[nblockx*nblocky];
		
		edge_hor  = new float[nex*ney];
		edge_vert = new float[nex*ney];
		
		calc_range(v, cmin, cmax, cint, vmin, vmax, ic0, ic1,
				blockx, blocky, nblockx, nblocky, block_min, block_max);
		
		for(ic=ic0; ic<ic1; ++ic){
			float v0, v1, v2, v3;
			clev = ic * cint;
		
			for(ij=0; ij<nex*ney; ++ij){
				edge_hor [ij] = 3.f;
				edge_vert[ij] = 3.f;
			}
			
			for(j=y0; j<y1; j+=skip){
				jb = (j-y0) / skip / blocky;
				for(ib=0; ib<nblockx; ++ib){
					if(block_max[ib+jb*nblockx] < clev || block_min[ib+jb*nblockx] >= clev) continue;
					for(i=x0+blockx*ib*skip; i<min(x0+blockx*(ib+1)*skip,x1); i+=skip){
						if(i < x1-skip){
							v0 = v[ i      +j*nxall];
							v1 = v[(i+skip)+j*nxall];
							if( ( v0>=clev && v1<clev ) || ( v0<clev && v1>=clev ) ){
								edge_hor[(i-x0)/skip+(j-y0)/skip*nex] = (clev-v0) / (v1-v0);
							}
						}
						if(j < y1-skip){
							v0 = v[i+ j      *nxall];
							v1 = v[i+(j+skip)*nxall];
							if( ( v0>=clev && v1<clev ) || ( v0<clev && v1>=clev ) ){
								edge_vert[(i-x0)/skip+(j-y0)/skip*nex] = (clev-v0) / (v1-v0);
							}
						}
					}
				}
			}
			
			for(ej=0; ej<ney; ++ej){
				jb = ej / blocky;
				for(ib=0; ib<nblockx; ++ib){
					if(block_max[ib+jb*nblockx] < clev || block_min[ib+jb*nblockx] >= clev) continue;
					for(ei=blockx*ib; ei<min(blockx*(ib+1),nex); ++ei){
						if(edge_hor[ei+ej*nex] < 2){
							trace(ei, ej,   edge_dir::northward, line0);
							trace(ei, ej-1, edge_dir::southward, line1);
							add_line(line0, line1, clev);
							edge_hor[ei+ej*nex] = 3.f;
						}
						if(edge_vert[ei+ej*nex] < 2){
							trace(ei,   ej, edge_dir::eastward, line0);
							trace(ei-1, ej, edge_dir::westward, line1);
							add_line(line0, line1, clev);
							edge_vert[ei+ej*nex] = 3.f;
						}
					}
				}
			}
			
		}
		
		delete[] edge_hor;
		delete[] edge_vert;
	}	
	

};

int to_1d(vector<vector<float>>& points, vector<float>& clevs, vector<float>& values, vector<int>& numbers){
	int n = points.size();
	for(int i=0; i<n; ++i){
		values.push_back(clevs[i]);
		values.insert(values.end(), points[i].begin(), points[i].end());
		numbers.push_back(points[i].size() / 2);
	}
	return n;
}

extern "C" {

// Wrapper function to find contour coordinates
int find_contours(
	float*  ptr_array, // (In)  Pointer to the 2D input array. This should be allocated and populated with values in advance in JavaScript.
	float   cmin,      // (In)  No contour below this value will be serched for.
	float   cmax,      // (In)  No contour above this value will be serched for.
	float   cint,      // (In)  Contour interval
	float*  vmin,      // (Out) The minimum value encountered in ptr_array will be assigned to *vmin
	float*  vmax,      // (Out) The maximum value encountered in ptr_array will be assigned to *vmax
	int     nx,        // (In)  The size of ptr_array in the X axis
	int     x0,        // (In)   The minimum X index to look for contours. This should be 0 if the whole array is to be scanned.
	int     x1,        // (In)  (The maximum X index to look for contours) + 1. This should be equal to nx ifthe whole array is to be scanned.
	int     ny,        // (In)  The size of ptr_array in the Y axis
	int     y0,        // (In)   The minimum Y index to look for contours. This should be 0 if the whole array is to be scanned.
	int     y1,        // (In)  (The maximum Y index to look for contours) + 1. This should be equal to ny ifthe whole array is to be scanned.
	int     skip,      // (In)  Only one every "skip" points will be scanned. Set to 1 to disable the skipping. Set to larger values to speed up the calculation.
	int width_panel,
	int height_panel,
	int proj_type,     // (In)  0: lat-lon  1: orthogonal projection
	float clon, float clat, float range_lon, float range_lat,
	float lon0, float lat0, float dlon, float dlat,
	float** val_coords,          // (Out) *val_coords will point to an array containing contour values and coordinates.
	int**   length_of_each_line  // (Out) *length_of_each_line will point to an array containing the number of points comprizing contours.
){
	vector<float> coords_vec;
	vector<int> numbers;
	Contour_finder finder;
	vector<vector<float>> contours;
	vector<float> clevs;
	int il, ip, ix, iy, ipp, np;
	const float DEG2RAD = 0.01745329251, RAD2DEG = 57.295779513;
	float sinclat = sin(clat*DEG2RAD);
	float cosclat = cos(clat*DEG2RAD);
	float lon, lat, cosdlon, sindlon, coslat, sinlat, x,y;
	
	finder.find_contours(ptr_array, nx, x0, x1, ny, y0, y1, skip,
		cmin, cmax, cint, vmin, vmax, &contours, &clevs);
	const int n = to_1d(contours, clevs, coords_vec, numbers);
	
	ipp = 0;
	switch(proj_type){
	case 0:
		for(il=0; il<n; ++il){
			np = numbers[il];
			for(ip=0; ip<np; ++ip){
				coords_vec[ipp+2*ip+1] = ((lon0+dlon*coords_vec[ipp+2*ip+1] - clon) / range_lon + 0.5) * width_panel;
				coords_vec[ipp+2*ip+2] = (0.5 - (lat0+dlat*coords_vec[ipp+2*ip+2] - clat) / range_lat) * height_panel;
			}
			ipp += np*2 + 1;
		}
		break;
	case 1:
		for(il=0; il<n; ++il){
			np = numbers[il];
			for(ip=0; ip<np; ++ip){
				lon = lon0 + dlon * coords_vec[ipp+2*ip+1];
				lat = lat0 + dlat * coords_vec[ipp+2*ip+2];
				cosdlon = cos((lon - clon)*DEG2RAD);
				sindlon = sin((lon - clon)*DEG2RAD);
				coslat  = cos(lat *DEG2RAD);
				sinlat  = sin(lat *DEG2RAD);
				if(sinclat*sinlat + cosclat*coslat*cosdlon <= 0){
					coords_vec[ipp+2*ip+1] = NAN;
					coords_vec[ipp+2*ip+2] = NAN;
					continue;
				}
				x = coslat * sindlon * RAD2DEG;
				y = (cosclat * sinlat - sinclat * coslat * cosdlon) * RAD2DEG;
				coords_vec[ipp+2*ip+1] = (x / range_lon + 0.5) * width_panel;
				coords_vec[ipp+2*ip+2] = (0.5 - y / range_lat) * height_panel;
			}
			ipp += np*2 + 1;
		}
		break;
	}

	*val_coords = (float*) malloc(coords_vec.size() * sizeof(float));
	memcpy(*val_coords, coords_vec.data(), coords_vec.size() * sizeof(float));
	*length_of_each_line = (int*) malloc(numbers.size() * sizeof(int));
	memcpy(*length_of_each_line, numbers.data(), numbers.size() * sizeof(int));
	return n;
}

int calc_stream(
	float*  ptr_wdir,   // (In)  Pointer to the 2D input array containing wind directions in radians. This should be allocated and populated with values in advance in JavaScript.
	float** pp_coords,  // (Out) Calculated coordinates of lines and arrow heads. This double pointer should be pre-allocated in JavaScript.
	int**   pp_npoints, // (Out) Number of points in lines. This double pointer should be pre-allocated in JavaScript.
	int     nx_data,    // (In)  The size of ptr_wdir in the X axis
	int     ny_data,    // (In)  The size of ptr_wdir in the Y axis
	int     proj_type,  // (In)  0: lat-lon  1: orthogonal projection
	float   lon0, float dlon, float lat0, float dlat,
	float   clon, float clat, float range_lon, float range_lat,
	int     nx_img,         // (In) Width of the rendering area in pixels
	int     ny_img,         // (In) Height of the rendering area in pixels
	float   speed_adj,      // (In) Factor controlling the time step of the trajectory
	int     line_spacing,   // (In) Target spacing of lines in pixel
	int     interval_arrow, // (In) Interval of arrowheads in time steps
	float   len_arrow       // (In) Length of arrow heads in pixel
){
	int i, i_prev;
	float x, y, xy, ix, iy, cx, cy;
	int ix0, ix1, iy0, iy1;
	float u00, u01, u10, u11, u;
	float v00, v01, v10, v11, v;
	float wspd00, wspd01, wspd10, wspd11;
	float wdir00, wdir01, wdir10, wdir11;
	const float DEG2RAD = 0.01745329251, RAD2DEG = 57.295779513;
	float sinclat = sin(clat*DEG2RAD);
	float cosclat = cos(clat*DEG2RAD);
	float rho2, lon, lat, cosc, cosdlon, sindlon, coslat, sinlat;
	vector<float> coords;
	vector<int> npoints;
	vector<signed char> signs;
	float pixelx, pixely, pixelx_start, pixely_start;
	int pixelx_start0, pixely_start0;
	short n_line, i_line = 0;
	int i_point = 0, ipoint_last, n_stall = 0, n_point, n_arrow = 0;
	int sign = 1, sign0;
	
	int dx_small = line_spacing / 4;
	int nx_flags_small = (int)ceil(nx_img*1.0/dx_small);
	int ny_flags_small = (int)ceil(ny_img*1.0/dx_small);
	int nx_flags_large = (int)ceil(nx_img*1.0/line_spacing);
	int ny_flags_large = (int)ceil(ny_img*1.0/line_spacing);
	short* line_already_drawn_small = new short[nx_flags_small * ny_flags_small];
	short* line_already_drawn_large = new short[nx_flags_large * ny_flags_large];
	for(i=0; i<nx_flags_small * ny_flags_small; ++i) line_already_drawn_small[i] = -1;
	for(i=0; i<nx_flags_large * ny_flags_large; ++i) line_already_drawn_large[i] = -1;
	
	for(pixely_start0=line_spacing/2; pixely_start0<ny_img; pixely_start0+=line_spacing){
	for(pixelx_start0=line_spacing/2; pixelx_start0<nx_img; pixelx_start0+=line_spacing){
		if(line_already_drawn_large[pixelx_start0/line_spacing + (pixely_start0/line_spacing) * nx_flags_large] >= 0) continue;
		pixelx_start = pixelx_start0;
		pixely_start = pixely_start0;
		for(sign=-1; sign<=1; sign+=2){
			pixelx = pixelx_start;
			pixely = pixely_start;
			while(true){
				switch(proj_type){
				case 0:
					lon = (pixelx*1.0/(nx_img-1) - 0.5) * range_lon + clon;
					lat = (0.5 - pixely*1.0/(ny_img-1)) * range_lat + clat;
					break;
				case 1:
					x = (pixelx*1.0/(nx_img-1) - 0.5) * range_lon * DEG2RAD;
					y = (0.5 - pixely*1.0/(ny_img-1)) * range_lat * DEG2RAD;
					rho2 = x*x+y*y;
					if(rho2 >= 1){
						lon = NAN;
						break;
					}
					cosc = sqrt(1-rho2);
					
					lat = asin(cosc*sinclat + y*cosclat) * RAD2DEG;
					lon = clon + atan2(x, cosc*cosclat - y*sinclat) * RAD2DEG;
				}
				if(isnan(lon)) break;
				
				ix = (lon-lon0) / dlon;
				iy = (lat-lat0) / dlat;
				
				ix -= floor(ix/nx_data)*nx_data;
				
				ix0 = (int)floor(ix);
				ix1 = (int)ceil(ix);
				iy0 = (int)floor(iy);
				iy1 = (int)ceil(iy);
				cx = ix1 - ix;
				cy = iy1 - iy;
				if(ix1 < 0 || ix0 >= nx_data) break;
				if(iy1 < 0 || iy0 >= ny_data) break;
				
				coords.push_back(pixelx);
				coords.push_back(pixely);
				signs.push_back(sign);
				i_point++;
				
				wdir00 = ptr_wdir[nx_data*iy0+ix0];
				wdir01 = ptr_wdir[nx_data*iy0+ix1];
				wdir10 = ptr_wdir[nx_data*iy1+ix0];
				wdir11 = ptr_wdir[nx_data*iy1+ix1];
				u00 = cos(wdir00);
				u01 = cos(wdir01);
				u10 = cos(wdir10);
				u11 = cos(wdir11);
				v00 = sin(wdir00);
				v01 = sin(wdir01);
				v10 = sin(wdir10);
				v11 = sin(wdir11);
				
				u =    cy  *    cx  * u00
				  +    cy  * (1-cx) * u01
				  + (1-cy) *    cx  * u10
				  + (1-cy) * (1-cx) * u11;
				v =    cy  *    cx  * v00
				  +    cy  * (1-cx) * v01
				  + (1-cy) *    cx  * v10
				  + (1-cy) * (1-cx) * v11;
				
				if(isnan(u+v)) break;
				
				lon += sign * speed_adj * u / max(cos(lat*DEG2RAD), 0.01f);
				lat += sign * speed_adj * v;
				
				switch(proj_type){
				case 0:
					pixelx = ((lon-clon) / range_lon + 0.5) * (nx_img-1);
					pixely = (0.5 - (lat-clat) / range_lat) * (ny_img-1);
					break;
				case 1:
					cosdlon = cos((lon - clon)*DEG2RAD);
					sindlon = sin((lon - clon)*DEG2RAD);
					coslat  = cos(lat *DEG2RAD);
					sinlat  = sin(lat *DEG2RAD);
					if(sinclat*sinlat + cosclat*coslat*cosdlon <= 0){
						pixelx = NAN;
						break;
					};
					x = coslat * sindlon * RAD2DEG;
					y = (cosclat * sinlat - sinclat * coslat * cosdlon) * RAD2DEG;
					pixelx = (x / range_lon + 0.5) * (nx_img-1);
					pixely = (0.5 - y / range_lat) * (ny_img-1);
					break;
				}
				if(isnan(pixelx)) break;
				if((pixelx < 0) || (pixelx >= nx_img) || (pixely < 0) || (pixely >= ny_img)){
					coords.push_back(pixelx);
					coords.push_back(pixely);
					signs.push_back(sign);
					i_point++;
					break;
				}
				
				i = (int)floor(pixelx/dx_small) + (int)floor(pixely/dx_small) * nx_flags_small;
				if( (line_already_drawn_small[i] >= 0)
					&& ((line_already_drawn_small[i] < i_line)
						|| ((line_already_drawn_small[i] == i_line) && (i != i_prev)))){
					break;
				}
				if((line_already_drawn_small[i] == i_line) && (i == i_prev)){
					n_stall++;
					if(n_stall >= 20) break;
				}else{
					n_stall = 0;
				}
				line_already_drawn_small[i] = i_line;
				i_prev = i;
				i = (int)floor(pixelx/line_spacing) + (int)floor(pixely/line_spacing) * nx_flags_large;
				line_already_drawn_large[i] = i_line;
			}
			ipoint_last = npoints.empty() ? 0 : npoints.back();
			if(ipoint_last < i_point){
				npoints.push_back(i_point);
				i_line++;
			}
		}
	}
	}
	n_line = i_line;
	
	for(i_line=0; i_line<n_line; ++i_line){
		ipoint_last = (i_line==0 ? 0 : npoints[i_line-1]);
		n_point = npoints[i_line] - ipoint_last;
		for(i_point=min(n_point/2, interval_arrow); i_point<n_point-2; i_point+=interval_arrow){
			x = coords[2*(ipoint_last+i_point)+2] - coords[2*(ipoint_last+i_point)+0];
			y = coords[2*(ipoint_last+i_point)+3] - coords[2*(ipoint_last+i_point)+1];
			x *= signs[ipoint_last+i_point];
			y *= signs[ipoint_last+i_point];
			xy = sqrt(x*x+y*y);
			x *= len_arrow / xy;
			y *= len_arrow / xy;
			coords.push_back(coords[2*(ipoint_last+i_point)+0]);
			coords.push_back(coords[2*(ipoint_last+i_point)+1]);
			coords.push_back(coords[2*(ipoint_last+i_point)+0] - 0.866025404*x + 0.5*y);
			coords.push_back(coords[2*(ipoint_last+i_point)+1] - 0.5*x - 0.866025404*y);
			coords.push_back(coords[2*(ipoint_last+i_point)+0] - 0.866025404*x - 0.5*y);
			coords.push_back(coords[2*(ipoint_last+i_point)+1] + 0.5*x - 0.866025404*y);
			n_arrow++;
		}
	}
	npoints.push_back(n_arrow);
	
	*pp_coords = (float*) malloc(coords.size() * sizeof(float));
	memcpy(*pp_coords, coords.data(), coords.size() * sizeof(float));
	*pp_npoints = (int*) malloc(npoints.size() * sizeof(int));
	memcpy(*pp_npoints, npoints.data(), npoints.size() * sizeof(int));
	
	coords.clear();
	npoints.clear();
	signs.clear();
	delete[] line_already_drawn_small;
	delete[] line_already_drawn_large;
	return n_line;
}
} // extern "C"

