# Interactive Multimodel Explorer
[Demo using this codeset](https://weather-models.info/research/IME/) | [Realtime version using codes modified from this repository](https://weather-models.info/latest/medium_multimodel/multimap/global.html)


A web application to interactively visualize products of numerical weather prediction (NWP). Rich contents can be hosted on minimal-spec servers because all components are rendered on browsers. 

This project is published under the GPL-3.0 license. If you wish to use codes in this repository in your proprietary project, please reach out to ??? (at) cc.u-tokyo.ac.jp to request another type of license.

## Overview and requirements of the system

### Preparation
* Some WebAssembly components need to be compiled using [Emscripten](https://emscripten.org/). This can be done either on a page-hosting server or on your laptop

### Server
* Original NWP fields are converted to small compressed files in a Python script.
* Compressed files are hosted on a web server.
* Requirements:
  * Python3
  * Python packages to decode your NWP product of interest (ex. pygrib, netCDF4)
  * A web server (ex. NGINX, Apache) which can serve pre-gzipped files using the "Content-Encoding: gzip" header
  * [Emscripten](https://emscripten.org/), which compiles some client-side codes to a WebAssembly binary (this can alternatively be installed to your laptop)

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
