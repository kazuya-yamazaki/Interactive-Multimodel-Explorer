#!/bin/bash

emcc grid_analyses.cpp -o grid_analyses.js \
	-O3 --closure 1 -s TOTAL_MEMORY=32MB  \
	-s EXPORTED_FUNCTIONS="['_find_contours','_calc_stream','_malloc','_free']" \
	-s EXPORTED_RUNTIME_METHODS=getValue \
	-s EXPORT_ES6=1 -s MODULARIZE=1
