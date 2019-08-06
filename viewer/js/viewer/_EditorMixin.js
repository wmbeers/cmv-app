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
    'esri/SpatialReference'
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
    SpatialReference) {

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
            }
        });
    });
