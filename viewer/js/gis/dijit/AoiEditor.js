define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/form/DateTextBox',
    'jquery',
    'jqueryUi',
    'koBindings',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dijit/ConfirmDialog',
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
    'dojo/promise/all',

    'dojo/text!./AoiEditor/templates/Sidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./AoiEditor/templates/Dialog.html', // template for the open AOI dialog

    'esri/dijit/editing/Add',
    'esri/dijit/editing/Delete',
    'esri/dijit/editing/Update',

    'esri/toolbars/draw',
    'esri/toolbars/edit',

    'esri/geometry/Extent',

    'esri/layers/FeatureLayer',
    'esri/layers/GraphicsLayer',
    'esri/graphic',

    'esri/renderers/SimpleRenderer',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/Color',

    'esri/tasks/BufferParameters',
    'esri/tasks/query',

    './js/config/projects.js', //TODO put in app.js paths?

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',
    'dijit/form/Select',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
function (declare, _WidgetBase, _TemplatedMixin, DateTextBox, jquery, jqueryUi, koBindings,
    _WidgetsInTemplateMixin, Dialog, ConfirmDialog, request, lang, on, query, dom, //eslint-disable-line no-unused-vars
    domClass, html, topic, Memory, Deferred, all, AoiEditorSidebarTemplate, OpenAoiDialogTemplate, //eslint-disable-line no-unused-vars
    Add, Delete, Update, Draw, Edit, Extent, FeatureLayer, GraphicsLayer, Graphic, SimpleRenderer,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    Color,
    BufferParameters,
    Query,
    projects
) { //eslint-disable-line no-unused-vars
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: AoiEditorSidebarTemplate,
        topicID: 'AoiEditor',
        baseClass: 'AoiEditor',
        map: this.map,
        featureTypes: ['polygon', 'polyline', 'point'], //preprended with "aoi_" as id of layer, referenced in layers object as self.layers.point, etc.
        layers: {}, //caches the layers
        /*bufferUnits: [
            {id: 9002, name: 'Feet', abbreviation: 'Ft'}, 
            {id: 9003, name: 'Miles', abbreviation: 'Mi'},
            {id: 9001, name: 'Meters', abbreviation: 'M'},
            {id: 9036, name: 'Kilometers', abbreviation: 'KM'},
        ],*/
        bufferUnits: {
            feet: {id: 9002, name: 'Feet', abbreviation: 'ft'}, //for simplicity of converting from strings
            miles: {id: 9093, name: 'Miles', abbreviation: 'mi'},
            meters: {id: 9001, name: 'Meters', abbreviation: 'm'},
            kilometers: {id: 9036, name: 'Kilometers', abbreviation: 'km'}
        },
        projectTypes: [
            {id: 8, abbreviation: 'AOI', name: 'Area of Interest'},
            {id: 15, abbreviation: 'BRIDGE', name: 'Bridge'},
            {id: 4, abbreviation: 'CF', name: 'Cost Feasible'},
            {id: 9, abbreviation: 'CORR', name: 'Corridor Study'},
            {id: 12, abbreviation: 'ERT', name: 'Emergency Response Tool'},
            {id: 16, abbreviation: 'FREIGHT', name: 'Freight'},
            {id: 6, abbreviation: 'LRTP', name: 'Long Range Transportation Plan'},
            {id: 13, abbreviation: 'MCORES', name: 'Multi-use Corridors of Regional Economic Significance'},
            {id: 1, abbreviation: 'NDS', name: 'Needs'},
            {id: 2, abbreviation: 'NFE', name: 'Not for ETAT'},
            {id: 7, abbreviation: 'NMSA', name: 'Non Major State Action'},
            {id: 11, abbreviation: 'OAOI', name: 'Other Area of Interest'},
            {id: 17, abbreviation: 'RAIL', name: 'Rail'},
            {id: 10, abbreviation: 'SIS', name: 'SIS Designation Change'},
            {id: 3, abbreviation: 'TICE', name: 'Type I CE'},
            {id: 14, abbreviation: 'TRANSIT', name: 'Transit'},
            {id: 5, abbreviation: 'UCFP', name: 'Ultimate Cost Feasible Project'}
        ],
        getProjectTypeById: function (id) {
            return ko.utils.arrayFirst(this.projectTypes, function (pt) {
                return pt.id === id;
            });
        },
        //bufferUnitArray: [bufferUnits.feet, bufferUnits.miles, bufferUnits.meters, bufferUnits.kilometers], //for binding to drop-down
        //lastUnit: bufferUnits.feet,
        lastBufferDistance: 100,

        constructor: function (options) {
            this.currentAuthority = options.currentAuthority;
        },

        //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
        openAoiDialog: new Dialog({
            id: 'aoiEditor_open_dialog',
            title: 'Open Area of Interest',
            content: OpenAoiDialogTemplate
        }),

        showOpenAoiDialog: function () {
            var self = this;
            this.listAois().then(function () {
                self.openAoiDialog.show();
            });
        },

        createAoi: function () {
            var aoi = this._constructAoiModel();
            this.currentAoi(aoi);
            aoi.mode('editName');
        },

        clearAoiPreview: function () {
            var self = this;
            ko.utils.arrayForEach(this.aois(), function (a) {
                if (a.layers) {
                    self.clearAoiLayers(a);
                }
                a.previewed(false);
            });
        },

        unloadCurrentAoi: function () {
            this.clearAoiLayers();
            this.bufferGraphics.clear();
            this.currentAoi(null);
        },

        previewAoi: function (aoi) {
            var self = this,
                promises = [],
                q = new Query({
                    where: '1=1' //definitionExpression doesn't need to be re-applied
                });

            this.clearAoiPreview();

            aoi.previewed(true);

            if (aoi.layers && aoi.extent) {
                this.map.addLayer(aoi.layers.polygon);
                this.map.addLayer(aoi.layers.polyline);
                this.map.addLayer(aoi.layers.point);

                topic.publish('layerLoader/zoomToExtent', aoi.extent.expand(1.5));
                return;
            }
            aoi.layers = {};
            

            this.featureTypes.forEach(function (layerName) {
                var url = projects.aoiLayers[layerName].url,
                    deferred = new Deferred(),
                    layer = new FeatureLayer(url,
                        {
                            id: 'aoi_' + layerName,
                            outFields: '*',
                            definitionExpression: 'FK_PROJECT = ' + aoi.id,
                            mode: FeatureLayer.MODE_ONDEMAND
                        });
                aoi.layers[layerName] = layer;
                deferred = layer.queryExtent(q);
                promises.push(deferred);
            });

            all(promises).then(function (extentReplies) {
                //union extents, but only those with actual extents
                var unionOfExtents;
                for (var i = 0; i < extentReplies.length; i++) {
                    var extentReply = extentReplies[i];
                    if (extentReply.count > 0) {
                        if (unionOfExtents) {
                            unionOfExtents = unionOfExtents.union(extentReply.extent);
                        } else {
                            unionOfExtents = extentReply.extent;
                        }
                    }
                }
                if (unionOfExtents) {
                    aoi.extent = unionOfExtents;
                    topic.publish('layerLoader/zoomToExtent', aoi.extent.expand(1.5));

                    self.map.addLayer(aoi.layers.polygon);
                    self.map.addLayer(aoi.layers.polyline);
                    self.map.addLayer(aoi.layers.point);
                }
            });

        },

        loadAoi: function (id) {
            var self = this;
            //get from server
            //eslint-disable-next-line no-undef

            this.clearAoiPreview();

            MapDAO.getAoiModel(id, {
                callback: function (aoi) {
                    if (aoi) {
                        aoi = self._constructAoiModel(aoi);
                        self.currentAoi(aoi);
                        self._loadAoiFeatures();
                        aoi.mode('editName');
                    } else {
                        topic.publish('viewer/handleError', {
                            source: 'AoiEditor.loadAoi',
                            error: 'Invalid AOI ID'
                        });
                    }
                },
                errorHandler: function (message, exception) {
                    topic.publish('viewer/handleError', {
                        source: 'AoiEditor.loadAoi',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                    });
                }
            });

        },

        lastEditAt: null, //tracks last time an edit was made, used for timeout-based updating of buffers, starting immediately after draw-complete, or 3 seconds after vertext-drag-end

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
            //this._createGraphicLayers();


        },

        startup: function () {
            this.inherited(arguments);

            this.bufferUnitArray = [this.bufferUnits.feet, this.bufferUnits.miles, this.bufferUnits.meters, this.bufferUnits.kilometers]; //for binding to drop-down
            this.lastUnit = this.bufferUnits.feet;

            //this.proj4 = proj4;
            //for debugging only
            //window.proj4 = proj4;
            this._createGraphicLayers();
            //this entire widget will be hidden if user doesn't have at least one aoi auth, so don't need to worry about index out of bounds
            if (!this.currentAuthority() || this.currentAuthority().aoiEditor === false) {
                this.currentAuthority(this.authorities[0]);
            }
            this._setupEditor();
            this._knockoutifyAoiEditor();
        },

        _setupEditor: function () {
            var self = this; //closure so we can access this.draw etc.
            this.draw = new Draw(this.map); //draw toolbar, not shown in UI, but utilized by our UI
            this.edit = new Edit(this.map);

            //customizing the draw toolbar so the UI can remind user what they're doing, and have ability to cancel
            self.drawToolGeometryType = ko.observable(null); //independent of draw._geometryType, but we keep it in sync

            self.drawMode = ko.observable('draw'); //either 'draw' or 'split', controls what happens in draw-complete

            //user clicks the Point, Line, Freehand Line, Polygon or Freehand Polygon digitize button
            self.activateDrawTool = function (geometryType) {
                //put us in draw-new-feature mode.
                self.drawMode('draw');
                //deactivate edit toolbar
                self.edit.deactivate();
                //clear out current feature
                self.currentAoi().currentFeature(null);
                //pass the word onto the draw tool
                self.draw.activate(geometryType);
                //sync up with geometryType observable
                self.drawToolGeometryType(geometryType);
                //todo turn off identify
                topic.publish('mapClickMode/setCurrent', 'digitize');
                //hide buffers
                this.bufferGraphics.setVisibility(false);
            };

            self.activateSplitTool = function (geometryType) {
                geometryType = geometryType || 'polyline'; //default
                //put us in draw-new-feature mode.
                self.drawMode('split');
                //deactivate edit toolbar
                self.edit.deactivate();
                //pass the word onto the draw tool
                self.draw.activate(geometryType);
                //sync up with geometryType observable
                self.drawToolGeometryType(geometryType);
                //todo turn off identify
                topic.publish('mapClickMode/setCurrent', 'digitize');
                //hide buffers
                this.bufferGraphics.setVisibility(false);
            };


            self.deactivateDrawTool = function () {
                //pass the word onto the draw tool
                self.draw.deactivate();
                //sync up with geometryType observable
                self.drawToolGeometryType(null);
                //restore buffers
                self.bufferGraphics.setVisibility(true);
            };
            self.drawToolActive = ko.pureComputed(function () { //eslint-disable-line no-undef
                return self.drawToolGeometryType() !== null;
            });
            //event handler for draw complete, creates a new feature when user finishes digitizing, or splits a feature when user finishes drawing a line for splitting
            this.draw.on('draw-complete', function (event) {
                var aoi = self.currentAoi(),
                    layer = self.layers[event.geometry.type]; //note: only applys in draw mode, gets redefined in split mode
                //toggle back to default map click mode
                topic.publish('mapClickMode/setDefault');
                self.deactivateDrawTool();
                //if something has gotten wildly out of sorts, bail
                if (!aoi) {
                    return;
                }
                    
                if (self.drawMode() === 'draw') {
                    //construct a feature
                    var f = self._constructFeature(event);

                    //save to server
                    layer.applyEdits([f.graphic], null, null, function (addResult) {
                        if (!addResult || addResult.length === 0) {
                            //todo check a and make sure successfull
                        }

                        //make it active
                        aoi.currentFeature(f);

                        //push it to features observableArray
                        aoi.features.push(f);

                        //todo add to undo stack

                    }, function () {
                        //todo
                    });
                } else {
                    //split mode
                    //the currentFeature().geometry is the geometry to be cut
                    var currentFeature = aoi.currentFeature(),
                        geometry = currentFeature ? currentFeature.graphic.geometry : null,
                        //the event.geometry is the cutter
                        cutter = event.geometry;
                    layer = geometry ? self.layers[geometry.type] : null; //gets the pointer to the layer containing the feature being split, not the polyline used to split it
    
                    if (geometry && cutter) {
                        esriConfig.defaults.geometryService.cut([geometry], cutter, 
                            function (result) {
                                //for our purposes, we're only cutting one geometry object at a time, so we can ignore the cutIndexes property of result
                                //but for reference, because it's poorly documented, the cutIndexes is an array that indicates which of the geometries
                                //passed into the cut request were the source of the given geometry at the same place in the array of geometries returned.
                                //For example, if we cut two geometries g1 and g2 with one line into two pieces each, the cutIndexes would be [0,0,1,1], and geometries
                                //[g1a, g1b, g2a, g2b], where g1a and g1b were derived from g1, ang g2a and b from g2.
                                if (result.geometries.length > 1) {
                                    //assume 0 is the geometry we'll store in the current feature, and 1..N are new features
                                    //update the geometry of the currentFeature
                                    currentFeature.graphic.setGeometry(result.geometries[0]);
                                    self.bufferFeature(currentFeature);
                                    //make the features to add
                                    var adds = [];
                                    for (var n = 1; n < result.geometries.length; n++) {
                                        //construct a new current feature
                                        //TODO: if a polyline, further break down geometriese[n] into paths, because if 
                                        //a polyline is split by the same line more than once, it will create at least 
                                        //one multi-part feature.
                                        //see https://community.esri.com/thread/58239
                                        //it's always two geometries, and one of them may be multi-part
                                        var newFeature = self._constructFeature({
                                            geometry: result.geometries[n],
                                            sourceFeature: currentFeature
                                        });
                                        adds.push(newFeature.graphic);
                                    }

                                    //save to server
                                    layer.applyEdits(adds, [currentFeature.graphic], null, function (addResult, updateResult) {
                                        if (!addResult || addResult.length === 0 || !updateResult || updateResult.length === 0) {
                                            //todo check a and u and make sure successfull
                                        }
                                        adds.forEach(function (addedFeature) {
                                            aoi.features.push(addedFeature.feature);
                                        });
                                        //todo add to undo stack

                                    }, function (e) {
                                        console.log(e);
                                        //todo
                                    });
                                        
                                }
                            },
                            function () {
                                //todo
                            }
                        );
                    }
                }

            });

            //event handler function for vertext move and delete
            var vertexChanged = function (evt) {
                var delay = 2000, //number of seconds to give the user before we automatically rebuffer
                    graphic = evt.graphic,
                    feature = graphic.feature;

                self.lastEditAt = new Date();
                self.vertexMoving = false;
                //update buffer after short delay
                //the delay prevents annoying the user if they're busy moving several vertices
                window.setTimeout(function () {
                    //if another vertex move has happened in the built-in delay since this function was called, do not buffer
                    var now = new Date(),
                        duration = now.getTime() - self.lastEditAt.getTime(); //# of milliseconds since the last time vertex move stop happened
                    if (duration >= delay && !self.vertexMoving) {
                        self.bufferFeature(feature);
                        //save to database
                        feature.updateDatabase();
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
                self.lastEditAt = new Date();
                vertexChanged(evt);
            }, this);
            this.edit.on('vertex-first-move', function (evt) {
                self.lastEditAt = new Date();
                self.vertexMoving = true;
                deleteBuffer(evt);
            }, this);
            this.edit.on('vertex-move', function () {
                self.lastEditAt = new Date();
                self.vertexMoving = true;
            }, this);
            this.edit.on('graphic-move-start', function (evt) {
                deleteBuffer(evt);
            }, this);
            this.edit.on('graphic-move-stop', function (evt) {
                self.bufferFeature(evt.graphic.feature);
                //save to database
                evt.graphic.feature.updateDatabase();
            }, this);
                
            //TODO we can also support move and scaling, etc.
        },

        _constructAoiModel: function (aoi) {
            var self = this; //maintains a reference to the root model
            aoi = aoi || {id: -1 /*signifies new*/, name: null, type: null, expirationDate: null, orgUserId: null, description: null, features: []};

            if (!aoi.expirationDate) {
                //default date is current date + 30 days TODO confirm this
                //TODO for demo purposes only
                aoi.expirationDate = new Date();
                aoi.expirationDate.setDate(aoi.expirationDate.getDate() + 30);
            }

            if (aoi.orgUserId) {
                //loading existing--if we allow loading all aois for all of the current user's orgUsers, rather than having to select to filter them, we don't need this bit
                //about tracking authority, and just use currentAuthority
                var authority = this.authorities.find(function (auth) {
                    return auth.orgUserId === aoi.orgUserId || aoi.orgId === auth.orgId;
                });
                this.currentAuthority(authority);
            }

            /* eslint-disable no-undef */
            aoi.name = ko.observable(aoi.name);
            aoi.description = ko.observable(aoi.description);
            aoi.projectTypeId = ko.observable(aoi.projectTypeId);
            aoi.expirationDate = ko.observable(aoi.expirationDate);

            //navigation
            aoi.mode = ko.observable();

            aoi.showNameAndDescription = function () {
                aoi.mode('editName');
            };

            aoi.showFeatureList = function () {
                aoi.mode('editFeatures');
            };

            aoi.unload = function () {
                self.unloadCurrentAoi();
            };

            aoi.saveAndShowFeatureList = function () {
                //todo validate name, etc.
                var aoiModel = {
                    id: aoi.id,
                    name: aoi.name(),
                    description: aoi.description(),
                    projectTypeId: aoi.projectTypeId(),
                    expirationDate: aoi.expirationDate(),
                    orgUserId: self.currentAuthority().orgUserId
                };
                MapDAO.saveAoiHeader(aoiModel, {
                    callback: function (id) {
                        aoi.id = id;
                        aoi.showFeatureList();
                    },
                    errorHandler: function () {
                        //todo
                    }
                });

            };

            aoi.showAnalysisOptions = function () {
                //todo validate >0 features, features have buffers, etc.
                aoi.mode('analysisOptions');
            };

            aoi.showAuthoritySelection = ko.pureComputed(function () {
                return !aoi.id && this.authorities.length > 1; //TODO lose this reference to app
            }, this);

            //all of the features, as models, regardless of geometry, distinct from, but related to, the features in layers.point.graphics, layers.polyline.graphics, and layers.polygon.graphics
            aoi.features = ko.observableArray();
            aoi.currentFeature = ko.observable();

            aoi.canSplitCurrentFeature = ko.pureComputed(function () {
                var cf = aoi.currentFeature(),
                    gt = cf && cf.geometry ? cf.geometry.type : null;

                return gt === 'polygon' || gt === 'polyline';
            });

            aoi.analysisAreas = ko.computed(function () {
                var analysisAreas = [];

                ko.utils.arrayForEach(aoi.features(), function (f) {
                    if (f.analysisArea() && analysisAreas.indexOf(f.analysisArea()) < 0) {
                        analysisAreas.push(f.analysisArea());
                    } return f.analysisArea();
                });

                return analysisAreas;
            });
            aoi.currentFeature.subscribe(function (f) {
                if (f && f.graphic) {
                    if (f.type === 'polygon' || f.type === 'polyline') {
                        self.edit.activate(2, f.graphic);
                    } else {
                        self.edit.activate(1, f.graphic);
                    }
                }
            });

            aoi.getAnalysisAreaModel = function (name) {
                return ko.utils.arrayFirst(aoi.analysisAreas(), function (m) {
                    return m.name() === name;
                });
            };

            aoi.getAnalysisAreaFeature = function (name) {
                return ko.utils.arrayFirst(self.layers.analysisArea.graphics, function (f) {
                    return f.attributes.FEATURE_NAME === name;
                });
            };

            /**
             * Builds the adds, edits and deletes arrays of analysisAreas; returns a deferred object that, when resolved, passes the 
             * arrays, ready for applyEdits. Makes external calls to geometryService to simplify and union.
             * @returns {Deferred} Deferred object, which, when resolved, will pass in a result with adds, updates and deletes array properties.
             */
            aoi._buildAnalysisAreaFeatureEdits = function () {
                //build analysis areas from features that don't already have one
                //(this is the default, typical arrangement, one feature = one analysisArea, 
                // unless user chooses to group features)
                aoi._buildAnalysisAreasFromFeatures();

                var analysisAreaFeatures = self.layers.analysisArea.graphics,
                    analysisAreaModels = aoi.analysisAreas(),
                    result = {
                        adds: [],
                        updates: [],
                        deletes: ko.utils.arrayFilter(analysisAreaFeatures, function (f) {
                            return !aoi.getAnalysisAreaModel(f.attributes.FEATURE_NAME);
                        }) //analysisArea features that don't currently have a match in named analysis areas
                    },
                    deferred = new Deferred(), //the overall deferred to be resolved when we've got the edits all built
                    buildPromises = [];

                //loop through models to add or update
                analysisAreaModels.forEach(function (analysisAreaModel) {
                    var buildPromise = new Deferred(),
                        geometries = ko.utils.arrayMap(analysisAreaModel.features(), function (f) {
                            return f.buffer ? f.buffer.geometry : f.graphic.geometry;
                        });

                    window.buildPromises.push(buildPromise);

                    //simplify
                    esriConfig.defaults.geometryService.simplify(geometries).then(function (simplifiedGeometries) {
                        //Note, just a union request would do the job, but maybe this is useful for multiple buffers?
                        var params = new BufferParameters();

                        params.distances = [0];
                        params.outSpatialReference = self.map.spatialReference; //todo this should maybe be Albers
                        params.unit = 9002;
                        params.geometries = simplifiedGeometries;
                        params.unionResults = true;

                        esriConfig.defaults.geometryService.buffer(params,
                            function (bufferedGeometries) {
                                //todo save to s_aoi
                                //search for existing feature by name
                                var analysisAreaFeature = aoi.getAnalysisAreaFeature(analysisAreaModel.name());
                                if (analysisAreaFeature) {
                                    result.updates.push(analysisAreaFeature);
                                    analysisAreaFeature.geometry = bufferedGeometries[0]; //todo if we can create multiple buffers in one go with different buffer distances, will need to foreach through those
                                    analysisAreaFeature.sourceFeatures = analysisAreaModel.features(); //for later update of features to cross reference
                                    buildPromise.resolve(analysisAreaFeature);
                                } else {
                                    analysisAreaFeature = new Graphic(bufferedGeometries[0]); //todo if we can create multiple buffers in one go with different buffer distances, will need to foreach through those
                                    //get ID from sequence
                                    MapDAO.getNextAnalysisAreaId({
                                        callback: function (id) {
                                            analysisAreaFeature.attributes = {
                                                OBJECTID: null,
                                                BUFFER_DISTANCE: 1,
                                                FEATURE_NAME: analysisAreaModel.name(),
                                                FK_PROJECT: aoi.id,
                                                FK_PROJECT_ALT: id
                                            };
                                            result.adds.push(analysisAreaFeature);
                                            analysisAreaFeature.sourceFeatures = analysisAreaModel.features(); //for later update of features to cross reference
                                            buildPromise.resolve(analysisAreaFeature);
                                        }
                                    });
                                }
                            },
                            function (err) {
                                promise.reject(err);
                            }
                        );
                    });
                }); // end loop through analysisAreaModels


                //the overall deferred for this function is resolved when all the deferreds to build analyisAreas are resolved
                all(buildPromises).then(function () {
                    deferred.resolve(result);
                }, function () {
                    //todo!
                });
                    
                return deferred;

            };

            //construct analysisAreas for features that don't already have one, using the feature's name as the analysisArea name
            aoi._buildAnalysisAreasFromFeatures = function () {
                ko.utils.arrayForEach(aoi.features(), function (f) {
                    if (!f.analysisArea()) {
                        self._addFeatureToAnalysisArea(f, f.name());
                    }
                });
            };

            aoi.saveAnalysisAreas = function () {
                aoi._buildAnalysisAreaFeatureEdits().then(function (edits) {
                    self.layers.analysisArea.applyEdits(edits.adds, edits.updates, edits.deletes, function () {
                        //update all features 
                        edits.adds.concat(edits.updates).forEach(function (aa) {
                            aa.sourceFeatures.forEach(function (f) {
                                f.graphic.attributes.FK_PROJECT_ALT = aa.attributes.FK_PROJECT_ALT;
                                f.updateDatabase();
                            });
                        });
                        //todo, something more than this but what?
                        //console.log('added ' + a.length + ' features, updated ' + u.length + ' features, and deleted ' + d.length + ' features');
                    }, function () {
                        //todo
                    });
                });
            };

            /* eslint-enable no-undef */
            return aoi;
        },

        clearAoiLayers: function (layerOwner) {
            layerOwner = layerOwner || this;
            //remove existing layers from the map
            if (!layerOwner.layers) {
                return;
            }
            if (layerOwner.layers.analysisArea) {
                this.map.removeLayer(layerOwner.layers.analysisArea);
                //delete layerOwner.layers.analysisArea;
            }
            this.featureTypes.forEach(function (layerName) {
                if (layerOwner.layers[layerName]) {
                    this.map.removeLayer(layerOwner.layers[layerName]);
                    //delete this.layers[layerName];
                }
            }, this);

        },

        _nextFeatureNumber: function () {
            var aoi = this.currentAoi(),
                n = 0,
                rx = /(\d+)/;
            if (!aoi) {
                return 1;
            }
            aoi.features().forEach(function (f) {
                var r = rx.exec(f.name());
                if (r) {
                    //convert string to number
                    r = parseInt(r[0], 10);
                    if (r > n) {
                        n = r;
                    }
                }
            });
            n++;
            return n;
        },

        _loadAoiFeatures: function () {
            var self = this,
                aoi = this.currentAoi(),
                loadPromises = []; //collection of promises resolved on update-end of the three editable layers (point, polyline and polygon), zooms to unioned extent when done

            this.clearAoiLayers();

            if (!aoi) {
                return;
            }

            //get analysisAreas first
            self.layers.analysisArea = new FeatureLayer(projects.aoiLayers.analysisArea.url, {
                id: 'aoi_analysisArea_' + aoi.id,
                outFields: '*',
                definitionExpression: 'FK_PROJECT = ' + aoi.id,
                //note: can't be invisble, and must be loaded in map for update-end to work.
                //visible: false, //not actually loaded in map, so don't need to make invisible
                mode: FeatureLayer.MODE_SNAPSHOT
            });

            on.once(self.layers.analysisArea, 'update-end', function () {
                //we now have self.layers.analysisArea.graphics as array of the analysis areas as GIS features
                //get the rest of the features and build relationships
                self.layers.analysisArea.setVisibility(false);
                self.featureTypes.forEach(function (layerName) {
                    var url = projects.aoiLayers[layerName].url,
                        deferred = new Deferred(),
                        layer = new FeatureLayer(url,
                            {
                                id: 'aoi_' + layerName + '_' + aoi.id,
                                outFields: '*',
                                definitionExpression: 'FK_PROJECT = ' + aoi.id,
                                mode: FeatureLayer.MODE_SNAPSHOT //gets all features! TODO or does it? What happens if it's not in the current map's extent?
                            });
                    self.layers[layerName] = layer;
                    loadPromises.push(deferred);

                    on.once(layer, 'update-end', function (info) {
                        deferred.resolve(info.target);
                    });

                    self.map.addLayer(layer);
                });

                //when update-end has fired for all editable layers, we can convert their graphics into feature models
                all(loadPromises).then(function (layers) {
                    //extract all features
                    var allGraphics = [],
                        unionOfExtents = null,
                        featuresKo = [],
                        onLayerClick = function (evt) { //eslint-disable-line func-style
                            //subscription on currentFeature does this edit.activate(2, evt.graphic);
                            if (self.currentAoi() && evt.graphic && evt.graphic.feature && !self.drawToolActive()) {
                                event.stopPropagation(evt);
                                self.currentAoi().currentFeature(evt.graphic.feature);
                            }
                        };

                    layers.forEach(function (layer) {
                        allGraphics = allGraphics.concat(layer.graphics);
                        on(layer, 'click', onLayerClick);
                    });

                    //union extents, but only those with actual extents
                    for (var i = 0; i < allGraphics.length; i++) { //todo switch to foreach; this way to simplify debugging
                        var graphic = allGraphics[i],
                            geometry = graphic.geometry,
                            featureKO = self._constructFeature(graphic),
                            extent = null;
                        featuresKo.push(featureKO);
                        if (geometry) {
                            if (geometry.type === 'point') {
                                extent = new Extent(geometry.x, geometry.y, geometry.x, geometry.y, geometry.spatialReference);
                            } else {
                                extent = geometry.getExtent();
                            }
                            if (extent) {
                                unionOfExtents = unionOfExtents ? unionOfExtents.union(extent) : extent;
                            }
                        }
                    }
                    aoi.extent = unionOfExtents; //facilitates zooming to the aoi
                    aoi.zoomTo = function () {
                        if (aoi.extent) {
                            //todo this fails if there's just one point. See zoomToFeature for example, may need to centerAndZoom; in theory even if there's just one point, there will be a buffer of that point in S_AOI, so  might not be an issue
                            topic.publish('layerLoader/zoomToExtent', aoi.extent.expand(1.5));
                        } else {
                            topic.publish('growler/growl', 'Area of Interest has no features');
                        }
                    };
                    aoi.zoomTo();
                    aoi.features(featuresKo);
                        
                    //tie to S_AOI record only after it's added to features observableArray
                    aoi.features().forEach(function (feature) {
                        if (feature.analysisAreaId) {
                            //do we already have it loaded?
                            var analysisAreaFeature = self.layers.analysisArea.graphics.find(function (aaf) {
                                return aaf.attributes.FK_PROJECT_ALT === feature.analysisAreaId;
                            });
                            if (analysisAreaFeature) {
                                var analysisArea = aoi.getAnalysisAreaModel(analysisAreaFeature.attributes.FEATURE_NAME);
                                if (analysisArea) {
                                    self._addFeatureToAnalysisArea(feature, analysisArea);
                                } else {
                                    self._addFeatureToAnalysisArea(feature, analysisAreaFeature.attributes.FEATURE_NAME);
                                }
                            //} else {
                                //the possibility of it not existing really should only happen during development when things can be all out of sync
                                //debugger;
                            }
                        }
                    });
                });

            }, function () {
                //todo
            });

            self.map.addLayer(self.layers.analysisArea);
        },

        //Constructs a feature either from a draw-complete event, cut operation, or when loading from server
        //It does not add the feature to the currentAoi features array, nor add it to a layer.
        _constructFeature: function (featureOrEvent) {
            if (!featureOrEvent) {
                return null;
            }
            var self = this,
                aoi = self.currentAoi(),
                feature = {
                    geometry: featureOrEvent.geometry, //all sources have a geometry property
                    type: featureOrEvent.geometry.type,
                    canSplit: featureOrEvent.geometry.type === 'polygon' || featureOrEvent.geometry.type === 'polyline'
                };
            if (featureOrEvent._sourceLayer) {
                //feature is a graphic object returned from a feature layer
                feature.name = featureOrEvent.attributes.FEATURE_NAME;
                feature.bufferDistance = featureOrEvent.attributes.BUFFER_DISTANCE || self.lastBufferDistance; //default in case null for old data
                feature.bufferUnit = (featureOrEvent.attributes.BUFFER_DISTANCE_UNITS ? self.bufferUnits[featureOrEvent.attributes.BUFFER_DISTANCE_UNITS.toLowerCase()] : null) || self.lastUnit; //default in case null; also converts to unit object
                feature.analysisAreaId = featureOrEvent.attributes.FK_PROJECT_ALT;
                feature.graphic = featureOrEvent;
            } else {                    
                //featureOrEvent is the event argument for on-draw-complete
                //either from draw or cut operation
                feature.name = 'Feature ' + self._nextFeatureNumber();
                feature.bufferDistance = featureOrEvent.sourceFeature ? featureOrEvent.sourceFeature.bufferDistance() : self.lastBufferDistance;
                feature.bufferUnit = featureOrEvent.sourceFeature ? featureOrEvent.sourceFeature.bufferUnit() : self.lastUnit;
                //todo keep it in the same group feature.analysisAreaId = featureOrEvent.sourceFeature ? featureOrEvent.sourceFeature.ana
                feature.graphic = new Graphic(featureOrEvent.geometry, null, {
                    OBJECTID: null,
                    BUFFER_DISTANCE: feature.bufferDistance,
                    BUFFER_DISTANCE_UNITS: feature.bufferUnit.name,
                    FEATURE_NAME: feature.name,
                    FK_PROJECT: aoi ? aoi.id : null //never null in practice, but used this way during development
                });
            }

            //back-reference, supports clicking map or model
            feature.graphic.feature = feature;

            /* eslint-disable no-undef */
            feature.name = ko.observable(feature.name);
            feature.bufferDistance = ko.observable(feature.bufferDistance);
            feature.bufferUnit = ko.observable(feature.bufferUnit);
            feature.bufferText = ko.pureComputed(function () {
                if (feature.bufferDistance() > 0 && feature.bufferUnit()) {
                    return feature.bufferDistance() + ' ' + feature.bufferUnit().abbreviation;
                }
                return '-';
            });

            feature.analysisArea = ko.observable(feature.analysisArea);
                
            feature.selected = ko.pureComputed(function () {
                return self.currentAoi() && self.currentAoi().currentFeature() === feature;
            });
            //happens when user clicks on a feature in the table of features, but not when clicking on the map;
            //a different function handles that, but doesn't include the zoom/pan
            feature.select = function () {
                if (self.currentAoi()) {
                    self.currentAoi().currentFeature(feature);
                    //todo zoom/pan if not in current extent
                    var geometry = feature.graphic ? feature.graphic.geometry : {
                            getExtent: function () {
                                return null;
                            }
                        }, //pseudo object with getExtent function that returns null extent
                        testExtent = geometry.type === 'point' ? geometry : geometry.getExtent(); //contains method expects a point or an extent
                    //project, our features are stored in 3087, needs to be in 3857/102100, which makes no sense
                    //debugger;
                    if (testExtent && !self.map.extent.contains(testExtent)) {
                        if (geometry.type === 'point') {
                            //center at
                            self.map.centerAt(testExtent);
                        } else {
                            //zoom to buffer around extent
                            self.map.setExtent(testExtent.expand(2));
                        }
                    }
                }
            };

            feature.bufferDistance.subscribe(function (newValue) {
                self.bufferFeature(feature);
                feature.graphic.attributes.BUFFER_DISTANCE = newValue;
                if (newValue) {
                    self.lastBufferDistance = newValue;
                }
                feature.updateDatabase();
            }, 'changed');

            feature.bufferUnit.subscribe(function (newValue) {
                self.bufferFeature(feature);
                feature.graphic.attributes.BUFFER_DISTANCE_UNITS = newValue.name;
                if (newValue) {
                    self.lastUnit = newValue;
                }
                feature.updateDatabase();
            }, 'changed');

            feature.name.subscribe(function (newValue) {
                feature.graphic.attributes.FEATURE_NAME = newValue;
                feature.updateDatabase();
            }, 'changed');

            feature.updateDatabase = function () {
                var graphic = feature.graphic,
                    layer = graphic._layer;
                layer.applyEdits(null, [graphic], null, function () {
                    //todo
                }, function () {
                    //todo
                });
                //todo add to undo stack
            };

            feature.deleteFeature = function () {
                //todo confirm?
                //todo add to undo stack
                var graphic = feature.graphic,
                    layer = graphic._layer,
                    buffer = feature.buffer;
                self.deactivateDrawTool();
                self.edit.deactivate();
                if (buffer) {
                    self.bufferGraphics.remove(buffer);
                }
                layer.applyEdits(null, null, [graphic], function () {
                    self.currentAoi().features.remove(feature);
                    self.currentAoi().currentFeature(null); //todo or activate next feature?
                }, function () {
                    //todo
                });
            };
            //no add function, handled elsewhere

            /* eslint-enable no-undef */
            //buffer it
            self.bufferFeature(feature);

            return feature;
        },

        _addFeatureToAnalysisArea: function (feature, analysisArea) {
            //if analysis area is null, nothing to do
            if (!analysisArea) {
                return null;
            }
            if (typeof analysisArea === 'string') {
                //first check to see if it exists
                var existingGroup = ko.utils.arrayFirst(this.currentAoi().analysisAreas(), function (ag) {
                    return ag.name() === analysisArea;
                });
                if (existingGroup) {
                    analysisArea = existingGroup;
                } else {
                    analysisArea = {
                        name: ko.observable(analysisArea), //observable so that user can rename it
                        buffer: null //doesn't need to be observable
                    };
                    analysisArea.features = ko.pureComputed(function () {
                        return ko.utils.arrayFilter(this.currentAoi().features(), function (f) {
                            return f.analysisArea() === analysisArea;
                        });
                    }, this);
                }
            }
            feature.analysisArea(analysisArea);
            return analysisArea;
        },

        listAois: function () {
            var self = this,
                deferred = new Deferred(),
                orgId = this.filterOption() === 'my' ? null : this.currentAuthority().orgId,
                includeExpired = this.includeExpired();

            //todo DWR call to get list of AOIs with basic properties of  id, name, type and description
            //eslint-disable-next-line no-undef
            MapDAO.getAreaOfInterestList(orgId, includeExpired, {
                callback: function (aois) {
                    aois.forEach(function (aoi) {
                        //get type
                        var pt = self.getProjectTypeById(aoi.projectTypeId);
                        aoi.typeAbbr = pt.abbreviation;
                        aoi.typeName = pt.name;
                        //add functions
                        aoi.load = function () {
                            self.loadAoi(aoi.id);
                            self.openAoiDialog.hide();
                        };
                        aoi.preview = function () {
                            self.previewAoi(aoi);
                        };
                        aoi.previewed = ko.observable(false);
                    });
                    self.aois(aois);
                    deferred.resolve();
                },
                errorHandler: function (message, exception) {
                    topic.publish('viewer/handleError', {
                        source: 'AoiEditor.listAois',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                    });
                    deferred.reject(message);
                }
            });
            return deferred;
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

        /**
            * Creates a buffer around the referenced feature. If buffer distance is set to 0, no buffer is created. 
            * Called after creating a new feature, modifying an existing feature (moving vertices, etc.), or changing the
            * feature's buffer distance or buffer distance units.
            * @param {any} feature The feature object to be buffered.
            * @returns {Deffered} A Deffered object that is resolved when the buffer is created, passing a reference to the buffer graphic if it can be created.
            */
        bufferFeature: function (feature) {
            var self = this, //closures because "this" changes context in callbacks; self is the AoiEditor
                geometry = feature.graphic ? feature.graphic.geometry : null,
                buffer = feature.buffer,
                deferred = new Deferred();

            if (buffer) {
                self.bufferGraphics.remove(buffer);
                feature.buffer = null;
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
                                //bufferedGeometries.forEach(function (bufferedGeometry) {
                                var bufferedGeometry = bufferedGeometries[0],
                                    graphic = new Graphic(bufferedGeometry);
                                graphic.feature = feature; //cross-reference from buffer is to the feature it is a buffer of
                                feature.buffer = graphic;
                                self.bufferGraphics.add(graphic);
                                deferred.resolve(graphic);
                                //});
                            },
                            function (err) {
                                deferred.reject(err);
                            });
                    },
                    function (err) {
                        deferred.reject(err);
                    });
            } else {
                //buffer distance set to 0, or no geometry, delete the buffer
                feature.buffer = null;
                deferred.resolve(null);
            }
            return deferred;
        },

        _knockoutifyAoiEditor: function () {
            /* eslint-disable no-undef */

            this.aois = ko.observableArray();
            this.currentAoi = ko.observable(); //TODO it might be clearer if we just promoted everything defined under currentAoi, because it's not like we toggle between them or anything
            this.filterOption = ko.observable('my'); //my or all
            this.includeExpired = ko.observable(false);
            this.filteredAois = ko.pureComputed(function () {
                var filterOption = this.filterOption(),
                    currentAuthority = this.currentAuthority();

                if (filterOption === 'my') {
                    var orgUserIds = ko.utils.arrayMap(this.authorities, function (a) {
                        return a.orgUserId;
                    });
                    return ko.utils.arrayFilter(this.aois(), function (aoi) {
                        return orgUserIds.indexOf(aoi.orgUserId) >= 0;
                        //return authorization.userId === aoi.userId;
                    });
                }
                return ko.utils.arrayFilter(this.aois(), function (aoi) {
                    return aoi.orgId === currentAuthority.orgId;
                });
            }, this);


            //apply knockout bindings
            ko.applyBindings(this, dom.byId('aoiEditorSidebar'));
            //apply knockout bindings to dialog
            ko.applyBindings(this, dom.byId('openAoiDialog'));

            this.filterOption.subscribe(this.listAois, this);
            this.currentAuthority.subscribe(this.listAois, this);

            /* eslint-enable no-undef */

        },

        ////mostly not used, 
        _createGraphicLayers: function () {
            var self = this;
           
            // buffers
            this.bufferGraphics = new GraphicsLayer({
                id: this.id + '_Buffers',
                title: this.id + ' Buffers'
            });

            this.map.addLayer(this.bufferGraphics);

            on(this.bufferGraphics, 'click', function (evt) {
                //subscription on currentFeature does this edit.activate(2, evt.graphic);
                if (self.currentAoi() && evt.graphic && evt.graphic.feature) {
                    event.stopPropagation(evt);
                    self.currentAoi().currentFeature(evt.graphic.feature);
                }
            });

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

            //    //todo separate symbols for "active" feature? If/when switching from using graphics/graphicslayers to storing features, the selectionSymbol would be the way to go.
        }
    });
});