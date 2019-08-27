define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    "dojo/_base/event",
    'dojo/on',
    'dojo/topic',
    "esri/toolbars/draw",
    "esri/toolbars/edit",
    'esri/graphic',

    'esri/geometry/Multipoint',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/geometry/Polygon',

    "esri/symbols/SimpleMarkerSymbol",
        "esri/symbols/SimpleLineSymbol",
        "esri/symbols/SimpleFillSymbol",
        'esri/Color',
    'esri/graphic',
    'esri/SpatialReference',

    'esri/tasks/BufferParameters'
], function (
    declare,
    lang,
    event,
    on,
    topic,
    Draw,
    Edit,
    Graphic,
    Multipoint,
    Point,
    Polyline,
    Polygon,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    Color,
    Graphic,
    SpatialReference,
    BufferParameters) {

        return declare(null, {
            startup: function () {
                this.inherited(arguments);
            },

            clickHandler: null,

            //activeEditLayer = ko.observable(), //either  S_AOI_P, S_AOI_L, S_AOI_A

            //currentProject = ko.observable(),

            //currentFeature = ko.observable(), //NOTE: for our purposes, a feature is a record in S_AOI_P, S_AOI_L or S_AOI_A, uniquely identified by FK_PROJECT_ALT, and eventually maps 1:1 with a feature in S_AOI, after being buffered; each "feature" is reflected as a record in T_PROJECT_ALT_AOI

            //locationText = ko.observable(), //User provided address, lat/long, or other location that can be resolved to a new point

            ////TODO rest of the UI things like roadway id, etc.

            //testBuffer: function () {

            //},

            testAssignClickHandler: function () {
                //todo this would go in the widgets postCreate
                this.clickHandler = this.map.on('click', lang.hitch(this, function (evt) {
                    if (this.mapClickMode.current === 'foo') {
                        debugger;
                    }
                }));

            },

            testToggleMode: function (mode) {
                if (mode) {
                    topic.publish('mapClickMode/setCurrent', mode);
                } else {
                    topic.publish('mapClickMode/setDefault');
                }
            },

            testClick: function (evt) {
                console.log('edit click');
            },

            testCreateMultipoint: function () {
                var mpJson = { "points": [[-122.63, 45.51], [-122.56, 45.51], [-122.56, 45.55]], "spatialReference": ({ " wkid": 4326 }) };
                return new Multipoint(mpJson);
            },

            initEditing: function (layer) {
                var editToolbar = new Edit(this.map);
                editToolbar.on("deactivate", function (evt) {
                    evt.graphic.attributes.FK_PROJECT = 2;
                    layer.applyEdits(null, [evt.graphic], null);
                });

                var editingEnabled = false;
                layer.on("dbl-click", function (evt) {
                    event.stop(evt);
                    if (editingEnabled === false) {
                        editingEnabled = true;
                        editToolbar.activate(Edit.EDIT_VERTICES, evt.graphic);
                    } else {
                        currentLayer = this;
                        editToolbar.deactivate();
                        editingEnabled = false;
                    }
                });

                layer.on("click", function (evt) {
                    event.stop(evt);
                    if (evt.ctrlKey === true || evt.metaKey === true) {  //delete feature if ctrl key is depressed
                        layer.applyEdits(null, null, [evt.graphic]);
                        currentLayer = this;
                        editToolbar.deactivate();
                        editingEnabled = false;
                    }
                });

                /*var templatePicker = new TemplatePicker({
                    featureLayers: layers,
                    rows: "auto",
                    columns: 2,
                    grouping: true,
                    style: "height: auto; overflow: auto;"
                }, "templatePickerDiv");

                templatePicker.startup();

                var drawToolbar = new Draw(map);

                var selectedTemplate;
                templatePicker.on("selection-change", function () {
                    if (templatePicker.getSelected()) {
                        selectedTemplate = templatePicker.getSelected();
                    }
                    switch (selectedTemplate.featureLayer.geometryType) {
                        case "esriGeometryPoint":
                            drawToolbar.activate(Draw.POINT);
                            break;
                        case "esriGeometryPolyline":
                            drawToolbar.activate(Draw.POLYLINE);
                            break;
                        case "esriGeometryPolygon":
                            drawToolbar.activate(Draw.POLYGON);
                            break;
                    }
                });

                drawToolbar.on("draw-end", function (evt) {
                    drawToolbar.deactivate();
                    editToolbar.deactivate();
                    var newAttributes = lang.mixin({}, selectedTemplate.template.prototype.attributes);
                    var newGraphic = new Graphic(evt.geometry, null, newAttributes);
                    selectedTemplate.featureLayer.applyEdits([newGraphic], null, null);
                });*/
            },



            //Just testing a proof of concept of using applyedits with a multipoint feature class. It works, so this can be deleted
            testApplyEdits: function (multippoint) {

                var feature = new Graphic(multipoint);

                this.layers[0].applyEdits([feature], null, null,
                    function (a, b, c) {
                        debugger;
                    },
                    function (d, e, f) {
                        debugger;
                    }).then(function (g, h, i) {
                        debugger;
                    });
            },

            testBufferAndUnion: function () {
                var params = new BufferParameters();

                params.distances = [100,100,100]; //,100,100]; //has to be the same number of distances as input features?
                params.outSpatialReference = new SpatialReference({ "wkid": 102100, "latestWkid": 3857 });
                params.unit = 9002; //todo GeometryService.UNIT_FOOT;
                params.unionResults = false; //TODO try true
                var polyline1 = new Polyline({
                    "paths": [[[-9421427.184329292, 3540405.5570207625], [-9420127.754848445, 3541743.205015751], [-9418828.325367598, 3540348.2292495486], [-9417548.005143823, 3541724.09575868]]],
                    "spatialReference": { "wkid": 102100, "latestWkid": 3857 }
                });

                var polygon1 = new Polygon({
                    rings: [[[-9418541.68651153, 3542584.012326887], [-9416401.449719548, 3543539.4751804504], [-9414815.381382633, 3542029.8438718203], [-9415369.5498377, 3540252.6829641922], [-9417318.694058968, 3540673.0866197604], [-9418541.68651153, 3542584.012326887]]],
                    "spatialReference": { "wkid": 102100, "latestWkid": 3857 }
                });

  
                var polyline2 = new Polyline({
                    "paths": [[[-9416611.651547333, 3541590.3309591813], [-9416860.071889259, 3539736.733023268], [-9414758.05361142, 3539622.0774808405], [-9415331.331323558, 3537883.135087355]]],
                    "spatialReference": { "wkid": 102100, "latestWkid": 3857 }
                });

                var sl = new SimpleLineSymbol(
                        SimpleLineSymbol.STYLE_SOLID,
                        new Color([255,0,0,0.65]), 2
                    );

                var symbol1 = new SimpleFillSymbol(
                    SimpleFillSymbol.STYLE_SOLID,
                    new SimpleLineSymbol(
                        SimpleLineSymbol.STYLE_SOLID,
                        new Color([255,0,0,0.65]), 2
                    ),
                    new Color([255,0,0,0.35])
                );

                var symbol2 = new SimpleFillSymbol(
                    SimpleFillSymbol.STYLE_SOLID,
                    new SimpleLineSymbol(
                        SimpleLineSymbol.STYLE_DASH,
                        new Color([255,0,0,0.65]), 2
                    ),
                    new Color([255,0,0,0.35])
                );

                var g = new Graphic(polygon1, symbol1);
                //this.map.graphics.add(g);
                var l1 = new Graphic(polyline1, sl);
                var l2 = new Graphic(polyline2, sl);
                this.map.graphics.add(l1);
                this.map.graphics.add(l2);

                var m = this.map;


                //step zero, simplify polygons
                //seems to be necessary because shrug emoji
                esriConfig.defaults.geometryService.simplify([polygon1], 
                    function(simplifiedGeometries) {
                        var gSimple = new Graphic(simplifiedGeometries[0], symbol2);
                        m.graphics.add(gSimple);

                        params.geometries = simplifiedGeometries; // [polyline1, /*simplifiedGeometries[0], */ polyline2];
                        
                        esriConfig.defaults.geometryService.buffer(params, 
                            function (bufferedGeometries) {
                                
                                bufferedGeometries.forEach(function(geometry) {
                                    var graphic = new Graphic(geometry, symbol1);
                                    m.graphics.add(graphic);
                                });
                            },
                            function(err, a) {
                                debugger;
                            });
                    },
                    function (err) {
                        debugger;
                    });
            }
        });
    });
