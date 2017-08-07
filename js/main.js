
var REST_URL = 'http://traffico73.lnx.in.here.com:9000/api/dirLink?linkId=';
var FILE_INPUT_ID = 'fileInput';
var SUPPORTED_EXTENSIONS = ['CSV', 'JSON'];
var gui;
var updateBtn;
var map;
var _firstViz = true;
var _probes = [];
var options = {
    headers: true,
    columns: [],
    multipleTrips: false,
    tripIdentifierColumn: '',
    showTrips: false,
    timeColumn: '',
    probesSize: 3,
    latCol: '',
    lngCol: '',
    headingCol: '',
    heading: true,
    updateMap: updateMap,
    probesColor: '#4682B4',
    dataColor: false,
    dataColumn: '',
}

function init() {
    map = new HereMap('mapContainer');
    gui = new dat.GUI({load: CONSORTIUM_PRESET});
    gui.remember(options);
    setupGUI(gui);
    
}

function setupGUI(gui) {
    var input = document.getElementById(FILE_INPUT_ID);
    input.addEventListener('change', handleUpload, false);

    var tripsLoader = {
        loadFile: function() {
            input.click();
        }
    }

    var fileFolder = gui.addFolder('File');
    fileFolder.add(options, 'headers').name('Headers');
    fileFolder.add(tripsLoader, 'loadFile').name('Load File');
    fileFolder.open();
    
}

function addProbesGui() {
    gui.removeFolder('Probes');
    var probesFolder = gui.addFolder('Probes');
    probesFolder.add(options, 'probesSize', 1, 20);
    probesFolder.add(options, 'latCol', options.columns).listen().name('Latitude Column');
    probesFolder.add(options, 'lngCol', options.columns).listen().name('Longitude Column');
    probesFolder.add(options, 'heading').name('Show Heading');
    probesFolder.add(options, 'headingCol', options.columns).listen().name('Heading Column');
    probesFolder.open();

    gui.removeFolder('Trips');
    var tripsFolder = gui.addFolder('Trips');
    tripsFolder.add(options, 'showTrips').name('Show Trips');
    tripsFolder.add(options, 'multipleTrips').name('Multiple Trips');
    tripsFolder.add(options, 'tripIdentifierColumn', options.columns).listen().name('Vehicle Column');
    tripsFolder.add(options, 'timeColumn', options.columns).listen().name('Date Column');

    gui.removeFolder('Colors');
    var colorsFolder = gui.addFolder('Colors');
    colorsFolder.addColor(options, 'probesColor');
    colorsFolder.add(options, 'dataColor').name('Data Based');
    colorsFolder.add(options, 'dataColumn', options.columns).listen().name('Data Column');

    try {
        gui.remove(updateBtn);
    }catch(e){}
    updateBtn = gui.add(options, 'updateMap').name('Update Map');
}

function updateMap() {
    map.clear();
    prepareColorScale(_probes);
    var probes = _probes.map(p => transformProbe(p, options));

    // Re-center the map if first time visualizing
    if (_firstViz) {
        if (probes[0]) {
            var probe = probes[0];
            var pos = {
                lat: probe.lat,
                lng: probe.lng
            }
            map.setCenter(pos);
        }
        _firstViz = false;
    }

    // Handle Visualization
    if (options.showTrips) {
        var trips = [];
        if (options.multipleTrips) {
            trips = partitionByVehicle(probes);
        }else {
            trips = [probes];
        }
        trips.forEach(t => {
            t.sort((p1, p2) => p1.timestamp - p2.timestamp);
        });

        trips.forEach (t => {
            map.drawTripFromProbes(t, options);
        });

    }else {
        probes.map(p => map.drawProbe(p, options));
    }
}

function handleProbes(probes) {
    addProbesGui();
    guessColumns();
    gui.__folders.File.close();
    _firstViz = true;
    _probes = probes;
}

function transformProbe(probe, options) {
    var lat = +getOrElse(probe, options.latCol, 0, LAT_VALIDATOR);
    var lng = +getOrElse(probe, options.lngCol, 0, LNG_VALIDATOR);
    var heading = +getOrElse(probe, options.headingCol, -1, HEADING_VALIDATOR);
    var vehicleId = getOrElse(probe, options.tripIdentifierColumn, '');
    var timestamp = new Date(getOrElse(probe, options.timeColumn, 0));
    let res = {
        lat: lat,
        lng: lng,
        heading: heading,
        timestamp: timestamp,
        vehicleId: vehicleId,
        color: colorForProbe(probe),
        size: options.probesSize,
        original: probe
    }

    return res;
}

function colorForProbe(probe) {
    if (!options.dataColor) {
        return options.probesColor;
    }

    if (!(options.dataColumn in probe)) {
        return options.probesColor;
    }

    return options.colorFun(probe);
    
}

// Prepares a color scale if needed based on the data
function prepareColorScale(probes) {
    // start assuming attribute is numerical
    var numerical = true;
    var min = 0;
    var max = 0;
    probes.forEach(p => {
        if (isNaN(p[options.dataColumn])) {
            numerical = false;
        }else {
            var val = +p[options.dataColumn];
            if (val < min) {
                min = val;
            }
            if (val > max) {
                max = val;
            }
        }
    });

    var colorFun = () => options.probesColor;

    if (numerical) {
        colorFun = (probe) => {
            var val = +probe[options.dataColumn];
            var range = max - min;
            if (range == 0) {
                return options.probesColor;
            }
            val = (val - min) / range;
            return d3.interpolateRdYlGn(val)
        }
    }else {
        var scale = d3.scaleOrdinal(d3.schemeAccent)
        colorFun = (probe) => {
            var val = probe[options.dataColumn];
            return scale(val);
        }
    }

    options.colorFun = colorFun;
}

// given a list of probes with a vehicleId attribute, returns them grouped by it
function partitionByVehicle(probes) {
    var res = {};
    for (var i = 0; i < probes.length; i++) {
        var p = probes[i];
        if (p.vehicleId in res) {
            res[p.vehicleId].push(p);
        }else {
            res[p.vehicleId] = [p];
        }
    }
    let partitions = [];
    for (var k in res) {
        partitions.push(res[k]);
    }
    return partitions;
}

function handleCSV() {
    result = this.result;
    if (options.headers) {
        result = d3.csvParse(result);
        options.columns = result.columns;
    }else {
        result = d3.csvParseRows(result);
        options.columns = zeroTo((result[0] || []).length);
    }
  
    handleProbes(result);
}

function handleJSON() {
    result = this.result;
    result = JSON.parse(result);

    options.columns = Object.keys(result[0]);

    handleProbes(result);
}


// Function that receives the trip data file when first uploaded
function handleUpload(evt) {
    if (!browserSupportFileUpload()) {
        alert('The File APIs are not fully supported in this browser!');
        return;
    }

    var data = null;
    var file = evt.target.files[0];
    var extension = file.name.split('.');
    extension = extension[extension.length - 1].toUpperCase();
    if (SUPPORTED_EXTENSIONS.indexOf(extension) === -1) {
        alert('Unsupported extension, supported extensions are: ' +  JSON.stringify(SUPPORTED_EXTENSIONS));
        return;
    }

    var reader = new FileReader();
    var readFunction = function() {};

    switch(extension) {
        case 'CSV': 
            readFunction = handleCSV;
            break;
        case 'JSON':
            readFunction = handleJSON;
            break;
    }

    reader.onload = readFunction.bind(reader);
    reader.readAsText(file);
}

// Method that checks that the browser supports the HTML5 File API
function browserSupportFileUpload() {
    var isCompatible = false;
    if (window.File && window.FileReader && window.FileList && window.Blob) {
    isCompatible = true;
    }
    return isCompatible;
}

// Helper: given an object and a property, checks if the object has the property and returns it, otherwise return the default
function getOrElse(obj, property, def, validator) {
    var validator = validator || (() => true);
    if (property in obj) {
        var val = obj[property];
        if (validator(val)) {
            return val;
        }
    }
    return def;
}

// Helper function that returns an array of numbers from 0 to n-1
function zeroTo(n) {
    let res = [];
    for (var i = 0; i < n; i++) {
        res.push(i);
    }
    return res;
}

// Helper function that guesses attributes functions from their names
function guessColumns() {
    var lat = ['LAT', 'LATITUDE'];
    options.columns.forEach(c => {
        c = '' + c;
        if (lat.indexOf(c.toUpperCase()) !== -1) {
            options.latCol = c;
        }
    });

    var lon = ['LON', 'LONGITUDE', 'LNG'];
    options.columns.forEach(c => {
        c = '' + c;
        if (lon.indexOf(c.toUpperCase()) !== -1) {
            options.lngCol = c;
        }
    });

    var h = ['HEADING', 'BEARING'];
    options.columns.forEach(c => {
        c = '' + c;
        if (h.indexOf(c.toUpperCase()) !== -1) {
            options.headingCol = c;
        }
    });

    var time = ['TIME', 'TIMESTAMP'];
    options.columns.forEach(c => {
        c = '' + c;
        if (time.indexOf(c.toUpperCase()) !== -1) {
            options.timeColumn = c;
        }
    });
}

// validators
function NUMBER_VALIDATOR(val) {
    return val !== '' && !isNaN(val);
}
function LAT_VALIDATOR(val) {
    var res = NUMBER_VALIDATOR(val) && +val >= -90 && +val <= 90;
    // Maybe throw error?
    return res;
}
function LNG_VALIDATOR(val) {
    var res = NUMBER_VALIDATOR(val) && +val >= -180 && +val <= 180;
    // Maybe throw error?
    return res;
}
function HEADING_VALIDATOR(val) {
    var res = NUMBER_VALIDATOR(val) && +val >= 0 && +val <= 360;
    // Maybe throw error?
    return res;
}

// Add removing folders functionality
dat.GUI.prototype.removeFolder = function(name) {
  var folder = this.__folders[name];
  if (!folder) {
    return;
  }
  folder.close();
  this.__ul.removeChild(folder.domElement.parentNode);
  delete this.__folders[name];
  this.onResize();
}


var CONSORTIUM_PRESET = {
  "preset": "Default",
  "closed": false,
  "remembered": {
    "Default": {
      "0": {
        "headers": false,
        "probesSize": 10,
        "latCol": "5",
        "lngCol": "6",
        "heading": true,
        "headingCol": "8",
        "showTrips": false,
        "multipleTrips": false,
        "tripIdentifierColumn": "1",
        "timeColumn": "4",
        "probesColor": "#4682B4",
        "dataColor": false,
        "dataColumn": ""
      }
    },
    "Consortium": {
      "0": {
        "headers": false,
        "probesColor": "#4682B4",
        "probesSize": 10,
        "latCol": "5",
        "lngCol": "6",
        "heading": true,
        "headingCol": "8",
        "showTrips": true,
        "multipleTrips": true,
        "tripIdentifierColumn": "1",
        "timeColumn": "4"
      }
    }
  },
  "folders": {
    "File": {
      "preset": "Consortium",
      "closed": false,
      "folders": {}
    },
    "Probes": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    },
    "Trips": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    },
    "Colors": {
      "preset": "Default",
      "closed": true,
      "folders": {}
    }
  }
}