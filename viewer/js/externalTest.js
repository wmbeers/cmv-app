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
            map = app.map,
            layerDefs = [],
            layerNames = document.getElementById('layerNames').value;

        if (layerNames) {
            //convert to array
            layerNames = layerNames.split(',');
            layerNames.forEach(function (ln) {
                ld = app.getLayerDef(ln);
                if (ld) {
                    layerDefs.push(ld);
                } else {
                    console.log('Invalid layer name: ' + ln);
                }
            });
        } else {
            //hooboy, going for the full enchilada
            layerDefs = mapWindow.app.widgets.layerLoader.layerDefs;
        }
        
        app.layers[0].setVisibility(false); //Hide Projects layers
        app.layers[1].setVisibility(false); //Hide Projects layers

        function wrapUp() {
            if (updateEndListener) updateEndListener.remove();
            //REPORT
           
            layerDefs.forEach(function(layerDef) {
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
                if (l > layerDefs.length) {
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
            ld = layerDefs[l];
            console.log('Loading ' + ld.layerName);
            ld.drawTimes = [];
            app.addLayerFromLayerDef(ld).then(function(a) {
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


function testServiceDrawSpeed() {
    debugger;
    document.getElementById('drawSpeedResults').innerText = 'id,centerName,zoomLevel,duration,visibleAtScale';
    cancel = false;
    i = 0;
    l = 0;
    z = 7;
    sd = null;
    timer = null;

    showMap(function () {
        var app = mapWindow.app,
            map = app.map,
            serviceDefs = [],
            serviceIds = document.getElementById('serviceIds').value;

        if (serviceIds) {
            //convert to array
            serviceIds = serviceIds.split(',');
            serviceIds.forEach(function (id) {
                if (id && !isNaN(id)) {
                    id = parseInt(id,10);
                }
                sd = app.getService(id);
                if (sd) {
                    serviceDefs.push(sd);
                } else {
                    console.log('Invalid service ID: ' + id);
                }
            });
        } else {
            //hooboy, going for the full enchilada
            serviceDefs = mapWindow.app.widgets.layerLoader.allCategories.filter(function (c) {
                return c.servicdId;
            });
        }

        app.layers[0].setVisibility(false); //Hide Projects layers
        app.layers[1].setVisibility(false); //Hide Projects layers

        function wrapUp() {
            if (updateEndListener) updateEndListener.remove();
            //REPORT

            serviceDefs.forEach(function (serviceDef) {
                if (serviceDef.drawTimes) {
                    serviceDef.drawTimes.forEach(function (drawTime) {
                        console.log(serviceDef.id + ',' + drawTime.centerName + ',' + drawTime.zoomLevel + ',' + drawTime.duration + ',' + drawTime.visibleAtScale)
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
                if (l > serviceDefs.length) {
                    //done!
                    console.log('done');
                    wrapUp();

                    return;
                }
                ld.removeLayer();
                console.log("moving to next layer");
                loadService();
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

        function loadService() {
            sd = serviceDefs[l];
            console.log('Loading ' + sd.id);
            sd.drawTimes = [];
            app.addLayerFromCategoryDef(sd).then(function (a) {
                console.log('Loaded ' + a.layerName);
                centerAndZoom();
            });
        }

        updateEndListener = map.on('update-end', function () {
            timer.visibleAtScale = sd.layer.visibleAtMapScale;
            timer.endTime = new moment();
            timer.duration = timer.endTime.diff(timer.startTime);
            console.log(timer.duration);
            sd.drawTimes.push(timer);
            writeResultLine(sd.id + ',' + timer.centerName + ',' + timer.zoomLevel + ',' + timer.duration + ',' + timer.visibleAtScale)
            z++;
            centerAndZoom();
        });
        //load first layer and start
        loadService();

    });
}


//example of how to open the map and load a layer
function loadLayer () {
    showMap(function () {
        mapWindow.postMessage({
            command: 'addLayer',
            layerName: 'SLDWST'
        });
    });
}

//example of how to open the map, load a layer, and zoom to a specific feature
function showFeature () {
    showMap(function () {
        mapWindow.postMessage({
            command: 'addLayer',
            layerName: 'SLDWST',
            zoomPoint: '17RKP2401887779'
        });
    });
}

function showProject () {
    showMap(function () {
        mapWindow.postMessage({
            command: 'addProjectToMap',
            projectId: document.getElementById('projectId').value
        });
    });
}

function loadSavedMap() {
    showMap(function () {
        mapWindow.postMessage({
            command: 'loadMap',
            savedMapId: document.getElementById('savedMapId').value,
            clearBeforeLoading: document.getElementById('clearBeforeLoading').checked
        });
    });
}

function zoomToMgrsPoint() {
    showMap(function () {
        var mgrs = document.getElementById('mgrs').value,
            zoomLevelText = document.getElementById('zoomLevel').value,
            inferZoom = document.getElementById('inferZoom').checked,
            zoomLevel = inferZoom ? 'infer' : zoomLevelText;
        //mapWindow.app.zoomToMgrsPoint(mgrs, zoomLevel).then(function () { console.log('done'); });
        mapWindow.postMessage({
            command: 'zoomToMgrsPoint',
            mgrs: mgrs,
            zoomLevel: zoomLevel
        });
    });
}



