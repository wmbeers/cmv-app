var mapWindow; //global reference to map window; will be set when map loads


function showMap(callback) {
    /// <summary>
    /// Shows the map, opening it in a new window if not already open
    /// </summary>
    /// <param name="callback">Optional callback function to execute after map loads.</param>
    /// <returns></returns>
    if (!mapWindow || mapWindow.closed) {
        mapWindow = window.open('index.html', 'mapWindow');
        if (callback) {
            mapWindow.onload = function () {
                //TODO: figure out if there's some callback/deferred/whatever CMV uses
                //and hitch/then/whatever onto that rather than setTimeout
                //but per tmcgee's answer here, I'm guessing there isn't
                //https://gis.stackexchange.com/questions/191426/cmv-search-widget-url-query-string/191440#191440

                window.setTimeout(function () {
                    callback();
                }, 2000);
            };
        }
    } else {
        if (callback) {
            callback();
        }
    }
}

//examples of how to open the map and load a layer in one step
function showMapAndLoadData() {
    showMap(loadData);
}

function showMapAndLoadData2() {
    showMap(loadData2);
}

//examples of how to load a layer filtered to a specific feature by autoId in an already opened map
function loadData() {
    mapWindow.app.addToMap(
        {
            name: 'Solid Waste',
            url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Contamination/MapServer/12',
            type: 'feature',
            sdeLayerName: 'sldwst'
        },
        'autoid = 228'
    );
}
//minimalist flavor, just using the sdeLayerName property; URL of map service is also supported
function loadData2() {
    mapWindow.app.addToMap('sldwst','autoid = 228');
}


function showFeature() {
    showMap(function () {
        mapWindow.app.addToMap(
            document.getElementById('layerName').value,
            'autoid = ' + document.getElementById('autoId').value
        );
    })
}