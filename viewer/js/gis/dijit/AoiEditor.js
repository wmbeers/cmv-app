define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dijit/ConfirmDialog',
    'dijit/form/DateTextBox',
    'dojo/request',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/query',
    'dojo/dom',
    'dojo/dom-class',
    'dojo/html',
    'dojo/topic',
    'dojo/store/Memory',
    'dojo/Deferred',

    'dojo/text!./AoiEditor/templates/Sidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./AoiEditor/templates/Dialog.html', // template for the open AOI dialog

    'esri/dijit/editing/Add',
    'esri/dijit/editing/Delete',
    'esri/dijit/editing/Update',

    'esri/toolbars/draw',
    'esri/toolbars/edit',

    'esri/layers/GraphicsLayer',
    'esri/graphic',

    'esri/renderers/SimpleRenderer',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/Color',

    'esri/tasks/BufferParameters',

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',
    'dijit/form/Select',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, DateTextBox, request, lang, on, query, dom, //eslint-disable-line no-unused-vars
        domClass, html, topic, Memory, Deferred, AoiEditorSidebarTemplate, AoiEditorDialogTemplate, //eslint-disable-line no-unused-vars
        Add, Delete, Update, Draw, Edit, GraphicsLayer, Graphic, SimpleRenderer,
        SimpleMarkerSymbol,
        SimpleLineSymbol,
        SimpleFillSymbol, 
        Color,
        BufferParameters
    ) { //eslint-disable-line no-unused-vars
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: AoiEditorSidebarTemplate,
            topicID: 'AoiEditor',
            baseClass: 'AoiEditor',
            map: this.map,

            constructor: function (options) {
                this.currentAuthority = options.currentAuthority;
            },

            //knockout-bound observable properties, will be assigned in _knockoutify method
            aois: null,
            currentAoi: null,
            filterAois: null,

            aoiAuthorities: [], //populated in startup


            //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
            openAoiDialog: null,

            openAOI: function () {
                //todo
            },

            createAoi: function () {
                var aoi = this._constructAoiModel();
                this.currentAoi(aoi);
                this._loadAoiLayers(aoi).then(function () {
                    aoi.mode('editName');
                });
            },

            lastEditAt: null, //tracks last time an edit was made, used for timeout-based updating of buffers, starting immediately after draw-complete, or 3 seconds after vertext-drag-end

            _loadAoiLayers: function (aoiModel) {
                //aoiModel.foo();
                //todo: create new features layers from the point, line, and poly AOI layers, with assigned definition queries
                var deferred = new Deferred();
                window.setTimeout(function () { deferred.resolve(); }, 3); //TODO the deferred is resolved when all layers are added to map
                return deferred;
            },
            _constructFeatureLayer: function (layerId, aoiId) {
                var layer = new FeatureLayer('https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/' + layerId, {
                    opacity: 0.75,
                    mode: FeatureLayer.MODE_ONDEMAND,
                    infoTemplate: new InfoTemplate(null, '${*}'),
                    id: 'aoi_' + aoiId + '_' + layerId,
                    definitionQuery: '1=1' //TODO
                });
                return this.map.addLayer(layer);

            },

            postCreate: function () {
                this.inherited(arguments);
                //todo post create code goes here
                this._createGraphicLayers();


            },

            startup: function () {
                this.inherited(arguments);
                //this entire widget will be hidden if user doesn't have at least one aoi auth, so don't need to worry about index out of bounds
                if (!this.currentAuthority() || this.currentAuthority().aoiEditor === false) {
                    this.currentAuthority(this.aoiAuthorities[0]);
                }

                this.draw = new Draw(this.map); //draw toolbar, not shown in UI, but utilized by our UI
                this.edit = new Edit(this.map);
                var self = this; //closure so we can access this.draw etc.
                this.draw.on('draw-complete', function (event) {

                    //toggle back to default map click mode
                    topic.publish('mapClickMode/setDefault');
                    self.draw.deactivate();
                    //if something has gotten wildly out of sorts, bail
                    if (!self.currentAoi()) {
                        return;
                    }
                    //construct a feature
                    var f = self._constructFeature(event);
                    //put a graphic on the map
                    //switch (f.geometry.type) {
                    //   case "point":
                    //     symbol = self.draw.markerSymbol;
                    //     break;
                    //   case "polyline":
                    //     symbol = self.draw.lineSymbol;
                    //     break;
                    //   case "polygon":
                    //     symbol = self.draw.fillSymbol;
                    //     break;
                    //}
                    f.graphic = new Graphic(f.geometry);
                    //back-reference
                    f.graphic.feature = f;
                    switch (f.geometry.type) {
                        case "point":
                            self.pointGraphics.add(f.graphic);
                            break;
                        case "polyline":
                            self.polylineGraphics.add(f.graphic);
                            break;
                        case "polygon":
                            self.polygonGraphics.add(f.graphic);
                            break;
                    }

                    //make it active
                    self.currentAoi().currentFeature(f);

                    //push it to features collection
                    self.currentAoi().features.push(f);

                    //buffer it
                    self.bufferFeature(f);

                });

                var vertexChanged = function(evt) {
                    var delay = 2000; //number of seconds to give the user before we automatically rebuffer
                    self.lastEditAt = new Date();
                    self.vertexMoving = false;
                    //update buffer after short delay
                    //the delay prevents annoying the user if they're busy moving several vertices
                    window.setTimeout(function() {
                        //if another vertex move has happened in the built-in delay since this function was called, do not buffer
                        var now = new Date(),
                            duration = now.getTime() - self.lastEditAt.getTime(); //# of milliseconds since the last time vertex move stop happened
                        if (duration >= delay && !self.vertexMoving) {
                            self.bufferFeature(self.currentAoi().currentFeature());
                        }
                    }, delay);
                };

                var deleteBuffer = function (evt) {
                    //remove the buffer graphic
                    var buffer = evt.graphic.feature.buffer;
                    if (buffer) {
                        self.bufferGraphics.remove(buffer);
                    }
                };

                this.edit.on('vertex-move-stop', vertexChanged, this);
                this.edit.on('vertex-delete', function (evt) {
                    deleteBuffer(evt);
                    this.lastEditAt = new Date();
                    vertexChanged(evt);
                }, this);
                this.edit.on('vertex-first-move', function (evt) {
                    deleteBuffer(evt);
                });
                this.edit.on('vertex-move', function (evt) {
                    this.lastEditAt = new Date();
                    this.vertexMoving = true;
                }, this);
                //TODO we can also support scaling, etc.
                //TODO handle merge/split

                this._knockoutifyAoiEditor();
            },

            //user clicks the Point, Line, Freehand Line, Polygon or Freehand Polygon digitize button
            digitizeFeature: function (toolName) {
                //toolname is one of the draw tools
                this.draw.activate(toolName);
                //todo turn off identify
                topic.publish('mapClickMode/setCurrent', 'digitize');
                //hides the dialog, constructs stub of feature, puts map in click-to-digitize- mode, shows tips in sidebar, along with cancel button
                //onDrawFinish event creates a point feature, hides tip and shows the features list, with newly created feature with default name selected, saves to point feature class
                //this.currentFeature = this._constructFeature(featureType);
            },

            //todo etc.
            clearFeatures: function () {
                this.pointGraphics.clear();
                this.polylineGraphics.clear();
                this.polygonGraphics.clear();
            },

            _constructAoiModel: function (aoi) {
                var self = this;
                aoi = aoi || { id: null, name: null, type: null, expirationDate: null, orgUserId: null, description: null, features: [] };

                if (!aoi.expirationDate) {
                    //default date is current date + 30 days TODO confirm this
                    //TODO for demo purposes only
                    aoi.expirationDate = '09/15/2019'; //new Date();
                    //aoi.expirationDate.setDate(aoi.expirationDate.getDate() + 30);
                }
                var authority = null;
                if (aoi.orgUserId) {
                    //loading existing--if we allow loading all aois for all of the current user's orgUsers, rather than having to select to filter them, we don't need this bit
                    //about tracking authority, and just use currentAuthority
                    authority = this.aoiAuthorities.find(function (auth) {
                        return auth.orgUserId === aoi.orgUserId;
                    });
                } else {
                    authority = this.currentAuthority(); //default
                }
                /* eslint-disable no-undef */
                aoi.name = ko.observable(aoi.name);
                aoi.description = ko.observable(aoi.description);
                aoi.type = ko.observable(aoi.type);
                aoi.expirationDate = ko.observable(aoi.expirationDate);

                //navigation
                aoi.mode = ko.observable();
                aoi.showFeatureList = function () {
                    //todo validate name, etc.
                    //save, and wait for callback to update id
                    aoi.mode('editFeatures');
                    //todo if features.length === 0 show the new feature dialog
                };
                aoi.authority = ko.observable(authority);
                aoi.showAuthoritySelection = ko.pureComputed(function () {
                    return !aoi.id && this.aoiAuthorities.length > 1; //TODO lose this reference to app
                }, this);
                var features = ko.observableArray();
                if (aoi.features) {
                    aoi.features.forEach(function (f) {
                        features.push(this._constructFeature(f));
                    }, this);
                }
                aoi.features = features;
                aoi.currentFeature = ko.observable();
                aoi.analysisGroups = ko.computed(function () {
                    return ko.utils.arrayMap(aoi.features(), function (f) {
                        return f.analysisGroup;
                    });
                });
                aoi.currentFeature.subscribe(function (f) {
                    if (f && (f.type === 'polygon' || f.type === 'polyline') && f.graphic) {
                        self.edit.activate(2, f.graphic);
                    } else {
                        self.edit.activate(1, f.graphic);
                    }
                });

                /* eslint-enable no-undef */
                return aoi;
            },

            //constructs a feature either from a draw-end event, or when loading from server
            //

            _constructFeature: function (featureOrEvent) {
                if (!featureOrEvent) return null;
                var feature = null,
                    self = this;
                if (featureOrEvent.geometry) {
                    feature = {
                        type: featureOrEvent.geometry.type,
                        name: 'Feature ' + this._nextFeatureNumber(),
                        geometry: featureOrEvent.geometry
                    }
                } //todo else whatever we have to do to get it from the server

                /* eslint-disable no-undef */
                feature.name = ko.observable(feature.name);
                feature.bufferDistance = ko.observable(feature.bufferDistance || 100); //TODO cache the last-entered distance
                feature.bufferUnit = ko.observable(feature.bufferUnit || { id: 9002, name: 'Ft' }); //TODO cache the last-entered unit
                feature._analysisGroup = ko.observable(feature.analysisGroup);
                feature.analysisGroup = ko.pureComputed({
                    read: function() {
                        return feature._analysisGroup();
                    },
                    write: function(ag) {
                        feature._analysisGroup(ag);
                        //todo update buffer
                    }
                });
                feature.selected = ko.pureComputed(function() {
                    return self.currentAoi() && self.currentAoi().currentFeature() === feature;
                });
                //happens when user clicks on a feature in the table of features, but not when clicking on the map;
                //a different function handles that, but doesn't include the zoom/pan
                feature.select = function () {
                    if (self.currentAoi()) {
                        self.currentAoi().currentFeature(feature);
                        //todo zoom/pan if not in current extent
                        var geometry = feature.graphic ? feature.graphic.geometry : {getExtent: function () { return null }}, //pseudo object with null extent
                            testExtent = feature.type === 'point' ? geometry : geometry.getExtent(); //contains method expects a point or an extent

                        if (testExtent && !self.map.extent.contains(testExtent)) {
                            if (feature.type === 'point') {
                                //center at
                                self.map.centerAt(testExtent);
                            } else {
                                //zoom to buffer around extent
                                self.map.setExtent(testExtent.expand(2));
                            }
                        }
                    }
                };


                /* eslint-enable no-undef */
                return feature;
            },

            loadAOIs: function () {
                //todo DWR call to get list of AOIs with basic properties of  id, name, type and description
            },

            simplifyGeometry: function (geometry) {
                var deferred;
                if (geometry) {
                    if (geometry.type === 'polygon') {
                        deferred = esriConfig.defaults.geometryService.simplify([geometry]);
                    } else {
                        //todo do we need to simplify polylines?
                        deferred = new Deferred();
                        window.setTimeout(function () {
                            deferred.resolve([geometry]);
                        }, 100);
                    }
                } else {
                    deferred = new Deferred();
                    window.setTimeout(function () {
                        deferred.reject('Missing geometry, unable to simplify.');
                    }, 100);
                }
                return deferred;                            
            },
//TODO! this doesn't take into account analysisGroup; we really need to be bufffering and unioning. Unfortunately 
//the geometryService.buffer can only deal with a collection of geometries of the same type, so it has to be a several-step process.
//first we buffer each feature individually, but don't draw anything
//then we union the buffers of features within the same analysisGroup,
//and finally we draw it on the map, and eventually save to AOI
            bufferFeature: function (feature) {
                var self = this, //closures because "this" changes context in callbacks; self is the AoiEditor
                    geometry = feature.graphic ? feature.graphic.geometry : null,
                    buffer = feature.buffer,
                    group = feature.analysisGroup();

                if (buffer) {
                    self.bufferGraphics.remove(buffer);
                }

                if (group) {
                    //get all features of the same group
                    //buffer them individually
                }
                if (geometry && feature.bufferDistance() > 0) {
                    
                    //first, simplify polygons
                    //seems to be always necessary
                    this.simplifyGeometry(geometry).then(
                        function (simplifiedGeometries) {
                            var params = new BufferParameters();

                            params.distances = [feature.bufferDistance()];
                            params.outSpatialReference = self.map.spatialReference;
                            params.unit = feature.bufferUnit().id;
                            params.geometries = simplifiedGeometries; //We're only doing one at a time, but buffer expects an array. 

                            esriConfig.defaults.geometryService.buffer(params,
                                function (bufferedGeometries) {
                                    //we don't really need forEach here, we just have one...for now
                                    bufferedGeometries.forEach(function (bufferedGeometry) {
                                        var graphic = new Graphic(bufferedGeometry);
                                        graphic.feature = feature; //back-reference from buffer is to the feature it is a buffer of
                                        self.bufferGraphics.add(graphic);
                                        feature.buffer = graphic;
                                    });
                                },
                                function (err, a) {
                                    debugger;
                                });
                        },
                        function (err) {
                            debugger;
                        });
                } else {
                    //buffer distance set to 0, or no geometry
                    feature.buffer = null;
                }
            },

            _knockoutifyAoiEditor: function () {
                /* eslint-disable no-undef */
                this.aois = ko.observable();
                this.currentAoi = ko.observable();
                this.filterAois = ko.observable(false);

                this._nextFeatureNumber = ko.pureComputed(function () {
                    var n = 0,
                        rx = /(\d+)/;
                    if (this.currentAoi()) {
                        ko.utils.arrayForEach(this.currentAoi().features(), function (f) {
                            var r = rx.exec(f.name());
                            if (r) {
                                //convert string to number
                                r = parseInt(r[0], 10);
                                if (r > n) {
                                    n = r;
                                }
                            }
                        });
                    }
                    n++;
                    return n;
                }, this);

                //apply knockout bindings
                ko.applyBindings(this, dom.byId('aoiEditorSidebar'));

                /* eslint-enable no-undef */

            },

            _createGraphicLayers: function () {
                var self = this;
                // points
                this.pointGraphics = new GraphicsLayer({
                    id: this.id + '_Points',
                    title: this.id + ' Points'
                });

                // polyline
                this.polylineGraphics = new GraphicsLayer({
                    id: this.id + '_Lines',
                    title: this.id + ' Lines'
                });

                // polygons
                this.polygonGraphics = new GraphicsLayer({
                    id: this.id + '_Polygons',
                    title: this.id + ' Polygons'
                });

                // buffers
                this.bufferGraphics = new GraphicsLayer({
                    id: this.id + '_Buffers',
                    title: this.id + ' Buffers'
                });

                this.map.addLayer(this.polygonGraphics);
                this.map.addLayer(this.polylineGraphics);
                this.map.addLayer(this.pointGraphics);
                this.map.addLayer(this.bufferGraphics);

                var f = function (evt) {
                    //subscription on currentFeature does this edit.activate(2, evt.graphic);
                    if (self.currentAoi() && evt.graphic && evt.graphic.feature) {
                        event.stopPropagation(evt);
                        self.currentAoi().currentFeature(evt.graphic.feature);
                    }
                }

                on(this.pointGraphics, 'click', f);
                on(this.polylineGraphics, 'click', f);
                on(this.polygonGraphics, 'click', f);
                on(this.bufferGraphics, 'click', f);

                this._createGraphicLayersRenderers();
            },
            _createGraphicLayersRenderers() {
                //create renderers
                var markerSymbol = new SimpleMarkerSymbol({
                    style: 'esriSMSCircle',
                    color: [0, 255, 197, 127],
                    size: 5,
                    outline: {
                        color: [0, 255, 197, 255],
                        width: 0.75
                    }
                });
                var pointRenderer = new SimpleRenderer(markerSymbol);
                this.pointGraphics.setRenderer(pointRenderer);

                var polylineSymbol = new SimpleLineSymbol({
                    style: 'esriSLSSolid ',
                    color: [0, 255, 197, 255],
                    width: 1
                });
                var polylineRenderer = new SimpleRenderer(polylineSymbol);
                this.polylineGraphics.setRenderer(polylineRenderer);

                var fillSymbol = new SimpleFillSymbol({
                    style: 'esriSFSSolid',
                    color: [0, 255, 197, 63],
                    outline: {
                        style: 'esriSLSSolid ',
                        color: [0, 255, 197, 255],
                        width: 0.75
                    }
                });
                var polygonRenderer = new SimpleRenderer(fillSymbol);
                this.polygonGraphics.setRenderer(polygonRenderer);

                var bufferSymbol = new SimpleFillSymbol({
                    style: 'esriSFSSolid',
                    color: [0, 115, 76, 63],
                    outline: {
                        style: 'esriSLSDash',
                        color: [0, 115, 76, 255],
                        width: 0.75
                    }
                });
                var bufferRenderer = new SimpleRenderer(bufferSymbol);
                this.bufferGraphics.setRenderer(bufferRenderer);

                //todo separate symbols for "active" feature? If/when switching from using graphics/graphicslayers to storing features, the selectionSymbol would be the way to go.
            }
        });
    });