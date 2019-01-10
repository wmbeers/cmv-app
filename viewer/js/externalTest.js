var mapWindow; //will be set when map loads
function showMap(andLoadData) {
    if (!mapWindow || mapWindow.closed) {
        mapWindow = window.open('index.html', 'mapWindow');
        if (andLoadData) {
            mapWindow.onload = function () {
                //TODO: figure out if there's some callback/deferred/whatever CMV uses
                //and hitch/then/whatever onto that rather than setTimeout
                //but per tmcgee's answer here, I'm guessing there isn't
                //https://gis.stackexchange.com/questions/191426/cmv-search-widget-url-query-string/191440#191440

                window.setTimeout(function () {
                    loadBrownfieldAreas();
                }, 2000);
            };
        }
    }
}

function loadBrownfieldAreas() {
    mapWindow.app.addToMap({
        name: 'Brownfield Areas',
        url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Contamination/MapServer/25',
        type: 'feature',
        sdeLayerName: 'brownfields',
        definitionExpression: 'autoid = 359'
    })
}