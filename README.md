# Interactive Multimodel Explorer (IME)

[Demo using this codeset](https://weather-models.info/research/IME/) | [Realtime version using codes modified from this repository](https://weather-models.info/latest/medium_multimodel/multimap/global.html)

A web application to interactively visualize products of numerical weather prediction (NWP). Rich contents can be hosted on minimal-spec servers because all components are rendered on browsers.

This project is published under the GPL-3.0 license.

## Overview and requirements of the system

### Code compilation

* Some WebAssembly components need to be compiled using [Emscripten](https://emscripten.org/). This can be done either on a page-hosting server or on your laptop.

### Server

* Original NWP fields are converted to small compressed files in a Python script.
* Compressed files are hosted on a web server.
* Requirements:
  * Python3
  * Python packages to decode your NWP product of interest (ex. pygrib, netCDF4)
  * A web server (ex. NGINX, Apache) which can serve pre-gzipped files using the "Content-Encoding: gzip" header

### Client

* Charts are rendered interactively on modern web browsers. Works on recent versions of Chrome, Edge, Firefox, and Safari.
* Requirements:
  * WebAssembly
  * WebGL2

## Installation

First, copy all codes to your web server or your laptop.

```
git clone https://github.com/kazuya-yamazaki/Interactive-Multimodel-Explorer.git
```

### Compile WebAssmebly codes

Enable your Emscripten installation and execute `src/wasm/compile.sh`. Two files should be created: `grid_analyses.wasm` and `grid_analyses.js`. Copy these files to `src/web/`.

### Modify server-side Python scripts and download source NWP data

`src/convertion/lhpos.f90` contains Fortran codes invoked from Python scripts to locate lows and highs. Activate your Python environment and compile it: `f2py -m lhpos -c --f90flags='-O2' lhpos.f90`

`src/convertion/convert.py` is a sample script for the server-side data conversion. Create your own version to adapt to the models and variables of your interest. Download NWP data and reflect the file path to your conversion script.

### Convert NWP data and copy client-side files

Run your conversion script. Copy the `bundled_nwp_data` directory and all files in `src/web/` to the directory where you wish to host the the IME.

### Modify client-side scirpts

Data directory, initial dates, and model names may not be suitable for your IME. Modify them as necessary.

## Data and softwares used in this project

* Coastlines: [GrADS lowres data](http://cola.gmu.edu/grads/gadoc/basemap.html)
* Political borders: [GSHHG](https://www.soest.hawaii.edu/pwessel/gshhg/)
* UI management: [jQuery](https://jquery.com/), [jQuery UI](https://jqueryui.com/), [jQuery UI Touch Punch](https://github.com/furf/jquery-ui-touch-punch)
* Date formatting: [jQuery.exDate.js by Cyokodog](https://cyokodog.hatenadiary.org/entry/20090316/jQueryExDate)
* Human-friendly HSL color space: [https://github.com/hsluv/hsluv-javascript](https://github.com/hsluv/hsluv-javascript)
