// SPDX-License-Identifier: AGPL-3.0
// Copyright (C) David Disseldorp 2020

'use strict';
// navigation watch id while tracking
var watch_id = null;
// parent GPX document root
var gpx_doc = null;
// current GPX track segment (trkseg) element
var cur_seg = null;
// leaflet map
var map = null;
// leaflet popup also carries the position of the last popup for stashing
var popup = null;
var gpx_obj = null;

const tstatus = document.querySelector('#track_status');

function point_add_click(e) {
	map.closePopup();
	gpx_stash(popup.gpexr_pos);
}

function map_ctxmenu(e) {
	popup.setLatLng(e.latlng).openOn(map);
	// store position of this popup for point_add_click()
	popup.gpexr_pos = {
		coords: { latitude: e.latlng.lat,
			  longitude: e.latlng.lng },
		timestamp: new Date().toISOString()
	};
}

function map_init() {
	map = L.map('map');
	//var osmUrl = 'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png';
	var osmUrl = 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png';
	// OSM attribution is in page footer
	L.tileLayer(osmUrl, {
		attribution: '',
		maxZoom: 18
	}).addTo(map);

	map.setView([0, 20], 3);

	var btn = document.createElement('button');
	btn.innerHTML = 'Add Point';
	btn.className = 'btn_map';
	btn.addEventListener('click', point_add_click);
	popup = L.popup();
	popup.setContent(btn);
	// popup.closeButton = false;	// has no effect?
	map.on('contextmenu', map_ctxmenu);
}

function gpx_doc_init() {
	// https://www.topografix.com/GPX/1/1/#
	gpx_doc = document.implementation.createDocument(null, "gpx");
	gpx_doc.createElement("gpx");

	//var elements = gpx_doc.getElementsByTagName("gpx");
	//elements[0].setAttribute("version", "1.1");
	var gpx_el = gpx_doc.getElementsByTagName("gpx")[0];
	gpx_el.setAttribute("version", "1.1");
	gpx_el.setAttribute("creator", "gpexr-0.1");
	var trk_el = gpx_doc.createElement("trk");
	gpx_el.appendChild(trk_el);

	cur_seg = gpx_doc.createElement("trkseg");
	trk_el.appendChild(cur_seg);

	// gpx_doc is now valid XML, so allow exporting and mapping
	var btn = document.getElementById("btn_export");
	btn.style.visibility = 'visible';
}

function gpx_blob_url_gen() {
	console.log("gpx_blob_url_gen called");
	var serializer = new XMLSerializer();
	var xml_str = serializer.serializeToString(gpx_doc);
	return new Blob([xml_str],
			    {type: "application/gpx+xml; charset=utf-8"});
	//return window.URL.createObjectURL(blob);
}

function gpx_blob_gen() {
	console.log("gpx_blob_url_gen called");
	var serializer = new XMLSerializer();
	var xml_str = serializer.serializeToString(gpx_doc);
	return xml_str;
	//return window.URL.createObjectURL(blob);
}

function gpx_stash(pos) {
	if (gpx_doc == null) {
		gpx_doc_init();
	}

	var pt_el = gpx_doc.createElement("trkpt");
	pt_el.setAttribute("lat", pos.coords.latitude);
	pt_el.setAttribute("lon", pos.coords.longitude);

	var time_el = gpx_doc.createElement("time");
	time_el.appendChild(gpx_doc.createTextNode(pos.timestamp));
	pt_el.appendChild(time_el);
	cur_seg.appendChild(pt_el);

	if (gpx_obj == null) {
		gpx_obj = new L.GPX(gpx_doc, {async: true}).addTo(map);
	} else {
		gpx_obj.reload();
	}
}

function export_clicked(event) {
	event.preventDefault();
	if (gpx_doc == null) {
		console.log('gpx_export called while unpopulated');
		return;
	}
	var filename = 'gpexr-track.gpx'	// TODO include start time
	var serializer = new XMLSerializer();
	var xml_str = serializer.serializeToString(gpx_doc);
	var blob = new Blob([xml_str],
			    {type: "application/gpx+xml; charset=utf-8"});
	var url = window.URL.createObjectURL(blob);
	var a = document.createElement('a');
	a.style = "display: none";
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();

	setTimeout(function() {
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}, 300);
}

function track_clicked() {
	function watch_success(pos) {
		gpx_stash(pos);
		tstatus.textContent += '.';
	}

	function loc_error(error) {
		tstatus.textContent = 'Failed to obtain location: ' + error.code;
		if (watch_id != null) {
			navigator.geolocation.clearWatch(watch_id);
		}
		watch_id = null;
	}

	function loc_success(pos) {
		gpx_stash(pos);

		const watch_opts = {
			  enableHighAccuracy: true,
			  timeout: 2000,
			  maximumAge: 0
		};

		//tstatus.textContent = `Latitude: ${lat} °, Longitude: ${lon} °`;
		tstatus.textContent = 'Watching...';
		navigator.geolocation.watchPosition(watch_success, loc_error,
						watch_opts);
	}

	if (!navigator.geolocation) {
		tstatus.textContent = 'Geolocation is not supported by your browser';
	} else {
		tstatus.textContent = 'Locating...';
		navigator.geolocation.getCurrentPosition(loc_success, loc_error);
	}
};

document.querySelector('#btn_track').addEventListener('click', track_clicked);
// btn_export is only visible after gpx_doc has been initialized
document.querySelector('#btn_export').addEventListener('click', export_clicked);
map_init();