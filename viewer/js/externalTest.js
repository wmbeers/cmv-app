var mapWindow = null; //global reference to map window; will be set when map loads

function showMap (callback) {
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
    } else if (callback) {
        //map window already loaded
        callback();
    }
}

//globals for testLayerDrawSpeed
var cancel = false,
    i = 0, //index for centers
    l = 0, //index for layers
    z = 7, //index for zoom levels
    ld = null, //current layerDef
    timer = null, //current timer
    updateEndListener = null; //listener for update end used to time how long it took the draw and call the next centerAndZoom iteration

function writeResultLine(line) {
    document.getElementById('drawSpeedResults').innerText += '\n' + line;
}

function cancelTest() {
    cancel = true;
}

var updateStartHandler,
    updateEndHandler;

//call showMap first, add layers, run this to set up handlers
function testMapDrawSpeed() {
    var app = mapWindow.app,
        map = app.map,
        drawStart = new moment(); //will change on update-start

    var updateStartHandler = map.on('update-start', function () {
        drawStart = new moment();
    });

    var updateEndHandler = map.on('update-end', function () {
        var drawEnd = new moment(),
            duration = drawEnd.diff(drawStart);
        writeResultLine(duration + 'ms');
    });
}

function stopMapDrawSpeed() {
    updateEndHandler.remove();
    updateStartHandler.remove();
}

var centers = [
    {
        "name": 'Jacksonville',
        center: {
            spatialReference: { wkid: 102100, latestWkid: 3857 },
            x: -9085521.075514013, 
            y: 3547635.492378052
        },
        "type": 'Urban'
    },

    {
        "name": 'Pensacola',
        center: {
            spatialReference: { wkid: 102100, latestWkid: 3857 },
            x: -9710341.20227474,
            y: 3558894.6072282605,
        },
        "type": 'Urban'
    },
    {
        "name": 'Everglades',
        center: {
            spatialReference: { wkid: 102100, latestWkid: 3857 },
            x: -9010346.207235985,
            y: 2918653.048481843,
            "type": 'Unpopulated Area'
        }
    }
];

function testLayerDrawSpeed() {
    document.getElementById('drawSpeedResults').innerText = 'id,layerName,definitionQuery,centerName,zoomLevel,duration,visibleAtScale';
    cancel = false;
    i = 0;
    l = 0;
    z = 7;
    ld = null;
    timer = null;

    showMap(function () {
        var app = mapWindow.app,
            map = app.map;
        
        app.layers[0].setVisibility(false); //Hide Projects layer

        function wrapUp() {
            if (updateEndListener) updateEndListener.remove();
            //REPORT
           
            app.widgets.layerLoader.layerDefs.forEach(function(layerDef) {
               if (layerDef.drawTimes) {
                   layerDef.drawTimes.forEach(function (drawTime) {
                       console.log(layerDef.id + ',' + layerDef.definitionQuery + ',' + layerDef.layerName + ',' + drawTime.centerName + ',' + drawTime.zoomLevel + ',' + drawTime.duration + ',' + drawTime.visibleAtScale)
                   })
               } 
            });
        }

        function centerAndZoom() {
            if (cancel) {
                wrapUp();
                return;
            }
            if (z > 23) {
                //no more zoom levels, on to the next center
                z = 7;
                i++;
                console.log("Moving to next center");
            }
            if (i >= centers.length) {
                //no more centers, on to the next layer
                l++;
                i = 0;
                if (l > app.widgets.layerLoader.layerDefs.length) {
                    //done!
                    console.log('done');
                    wrapUp();

                    return;
                }
                ld.removeLayer();
                console.log("moving to next layer");
                loadLayer();
                return;
            }
            console.log('l: ' + l + ' i:' + i + ' z:' + z);
            timer = {
                zoomLevel: z,
                centerName: centers[i].name,
                startTime: new moment()
            };
            map.centerAndZoom(centers[i].center, z);
        }

        function loadLayer() {
            ld = mapWindow.app.widgets.layerLoader.layerDefs[l];
            console.log('Loading ' + ld.layerName);
            ld.drawTimes = [];
            ld.loadLayer().then(function(a) {
                console.log('Loaded ' + a.layerName);
                centerAndZoom();
            });
        }

        updateEndListener = map.on('update-end', function () {
            timer.visibleAtScale = ld.layer.visibleAtMapScale;
            timer.endTime = new moment();
            timer.duration = timer.endTime.diff(timer.startTime);
            console.log(timer.duration);
            ld.drawTimes.push(timer);
            writeResultLine(ld.id + ',' + ld.layerName + ',' + timer.centerName + ',' + timer.zoomLevel + ',' + timer.duration + ',' + timer.visibleAtScale)
            z++;
            centerAndZoom();
        });
        //load first layer and start
        loadLayer();
          
    });
}

//examples of how to load a layer filtered to a specific feature by autoId in an already opened map
function loadData () {
    mapWindow.app.addLayer(
        {
            name: 'Solid Waste',
            url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Contamination/MapServer/12',
            type: 'feature',
            layerName: 'sldwst'
        },
        'autoid = 228'
    );
}
//minimalist flavor, just using the layerName property; URL of map service is also supported
function loadData2 () {
    mapWindow.app.addLayer('sldwst', 'autoid = 228');
}

//examples of how to open the map and load a layer in one step
/* exported showMapAndLoadData */
function showMapAndLoadData () {
    showMap(loadData);
}

/* exported showMapAndLoadData2 */
function showMapAndLoadData2 () {
    showMap(loadData2);
}




function showFeature () {
    showMap(function () {
        mapWindow.app.addToMap(
            document.getElementById('layerName').value,
            'autoid = ' + document.getElementById('autoId').value
        );
    });
}

function showProject () {
    showMap(function () {
        mapWindow.app.addProjectToMap(
            document.getElementById('projectId').value,
            document.getElementById('altNumber').value
        );
    });
}

function zoomToMgrsPoint() {
    showMap(function () {
        var mgrs = document.getElementById('mgrs').value,
            zoomLevelText = document.getElementById('zoomLevel').value,
            inferZoom = document.getElementById('inferZoom').checked,
            zoomLevel = inferZoom ? 'infer' : zoomLevelText;
        mapWindow.app.zoomToMgrsPoint(mgrs, zoomLevel).then(function () { console.log('done'); });
    });
}



