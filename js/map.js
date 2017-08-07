

var HereMap = function(where) {
    
    this.drawLink = function(coords, color) {
        var strip = new H.geo.Strip();
        coords.forEach(function(point) {
            strip.pushPoint({lat: point[1], lng: point[0]});
        });

        var customStyle = {
            strokeColor: color,
            lineWidth: 8
        };

        // Initialize a polyline with the strip:
        var polyline = new H.map.Polyline(strip, { style: customStyle});
        polyline.setArrows({
            fillColor: 'black',
            frequency: 5
        })
        // Add the polyline to the map:
        this.map.addObject(polyline);

    }

    this.drawTripFromProbes = function(probes, options){

        if (probes.length > 1) {
            var strip = new H.geo.Strip();
            probes.forEach(function(point) {
                strip.pushPoint({lat: point.lat, lng: point.lon||point.lng});
            });

            var customStyle = {
                strokeColor: 'gray',
                lineWidth: 3
            };

            // Initialize a polyline with the strip:
            var polyline = new H.map.Polyline(strip, { style: customStyle});
            polyline.setArrows({
                fillColor: 'black',
                frequency: 5
            })
            // Add the polyline to the map:
            this.map.addObject(polyline);
        }

        // draw all the probes over the Strip
        probes.forEach(p => this.drawProbe(p, options));

        // center map
        if (probes.length > 0){
            this.setCenter({
                lat: probes[0].lat,
                lng: probes[0].lng || probes[0].lon 
            });
        } 
    };

    this.drawProbe = function(probe, options) {
        // first draw heading
        var lat = probe.lat;
        var lng = probe.lng;
        var heading = probe.heading;
        var color = probe.color;

        if (options.heading && options.headingCol && heading >= 0 && heading <= 360) {
                
            var strip = new H.geo.Strip();
            var start = {lat: lat, lng: lng};
            strip.pushPoint(start);

            var dLat = Math.sin((90 - heading) * Math.PI / 180);
            var dLon = Math.cos((90 - heading) * Math.PI / 180);
            

            var end = {lat: + start.lat + dLat, lng: +start.lng + dLon};
            var dist = haversine(start, end);

            var mul = 30 / dist;
            end = {lat: + start.lat + dLat * mul, lng: +start.lng + dLon * mul};

            strip.pushPoint(end);
            var customStyle = {
                strokeColor: 'gray',
                lineWidth: 1
            };

            // Initialize a polyline with the strip:
            var polyline = new H.map.Polyline(strip, { style: customStyle});
            this.map.addObject(polyline);
        }

        let circle = new H.map.Circle(
			// The central point of the circle
			{
				lat: lat,
				lng: lng
			},
			// The radius of the circle in meters
			probe.size, {
				style: {
					strokeColor: color || options.probesColor, // Color of the perimeter
					lineWidth: 1,
					fillColor: color || options.probesColor // Color of the circle
				}
			}
		);

		this.map.addObject(circle);
        circle.addEventListener('tap', (evt) => {
            console.log(probe)
            console.log(evt)
            var bubble =  new H.ui.InfoBubble(evt.target.getCenter(), {
                // read custom data
                content: wrapBubble(JSON.stringify(probe.original, null, 2))
            });
            // show info bubble
            this.ui.addBubble(bubble);
        });


    };

    this.clear = function() {
		this.map.removeObjects(this.map.getObjects());
	};

	this.setCenter = function(loc) {
		if (!loc) {
			return;
		}
		this.map.setCenter(loc);
	};

    var platform = new H.service.Platform({
	    'app_id': APP_ID,
	    'app_code': APP_CODE
    });


    // Obtain the default map types from the platform object:
    var defaultLayers = platform.createDefaultLayers();

    // Instantiate (and display) a map object:
    this.map = new H.Map(
    document.getElementById(where),
    defaultLayers.terrain.map,
    {
        zoom: 11,
        center: { lat: 45.944974, lng: 9.182605 }
    });

    // Create the default UI:
    this.ui = H.ui.UI.createDefault(this.map, defaultLayers);

    // Enable the event system on the map instance:
    this.mapEvents = new H.mapevents.MapEvents(this.map);

    // Instantiate the default behavior, providing the mapEvents object: 
    this.behavior = new H.mapevents.Behavior(this.mapEvents);

}

function haversine(coords1, coords2, isMiles) {
	function toRad(x) {
		return x * Math.PI / 180;
	}

	var lon1 = coords1.lng;
	var lat1 = coords1.lat;

	var lon2 = coords2.lng;
	var lat2 = coords2.lat;

	var R = 6371; // km

	var x1 = lat2 - lat1;
	var dLat = toRad(x1);
	var x2 = lon2 - lon1;
	var dLon = toRad(x2);
	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	var d = R * c;

	if (isMiles) {
		d /= 1.60934;
	}

	return d * 1000;
}

function wrapBubble(text) {
    return '<div class="popup-bubble"> ' + text.replace(',', ',\n') + '</div>'; 
}
