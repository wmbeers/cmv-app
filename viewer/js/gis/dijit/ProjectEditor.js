define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',

    'gis/plugins/LatLongParser',
    'gis/plugins/MultiPartHelper',
    'gis/plugins/Extract',
    'gis/dijit/LoadingOverlay',

    'dijit/Dialog',
    'dijit/form/FilteringSelect',
    'dijit/form/ValidationTextBox',

    'dojo/_base/lang',
    'dojo/on',
    'dojo/dom',
    'dojo/topic',
    'dojo/io-query',
    'dojo/store/Memory',
    'dojo/Deferred',
    'dojo/promise/all',

    'dojo/text!./ProjectEditor/templates/Sidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./ProjectEditor/templates/Dialog.html', // template for the open project dialog
    'dojo/text!./ProjectEditor/templates/NewFeatureDialog.html', // template for the new feature dialog

    'esri/undoManager',
    './FeatureOperations',

    'esri/dijit/Search',

    'esri/toolbars/draw',
    'esri/toolbars/edit',

    'esri/geometry/Extent',
    'esri/geometry/Point',

    'esri/layers/FeatureLayer',
    'esri/layers/GraphicsLayer',
    'esri/graphic',

    'esri/renderers/SimpleRenderer',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/Color',

    'esri/tasks/query',
    'esri/tasks/locator',

    './js/config/projects.js',

    //jquery and jqueryUI needed for datepicker
    'jquery',
    'jqueryUi',
    'koBindings',

    //following are not used in this file, but are needed in the html template files
    'dijit/form/SimpleTextarea',
    'dijit/form/TextBox',
    'dijit/layout/TabContainer',
    'dijit/layout/ContentPane',

    'xstyle/css!./AoiEditor/css/AoiEditor.css'
],
function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, 
    LatLongParser,
    MultiPartHelper,
    Extract,
    LoadingOverlay,
    Dialog,
    FilteringSelect,
    ValidationTextBox,
    lang, on, dom,
    topic, ioQuery, Memory, Deferred, all,
    ProjectEditorSidebarTemplate,
    OpenProjectDialogTemplate,
    NewFeatureDialogTemplate,
    UndoManager, FeatureOperations,
    Search,
    Draw, Edit, Extent, Point,
    FeatureLayer, GraphicsLayer, Graphic, SimpleRenderer,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    Color,
    Query,
    Locator,
    projects
) { //eslint-disable-line no-unused-vars
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: ProjectEditorSidebarTemplate,
        topicID: 'ProjectEditor',
        baseClass: 'ProjectEditor',
        map: this.map,
        featureTypes: ['polygon', 'polyline', 'point'], //preprended with "project_" as id of layer, referenced in layers object as self.layers.point, etc.
        layers: {}, //caches the layers

        //translates the first three alt statuses, plus a couple of extra steps that aren't really ETDM status codes, but relevant here; everything else is "Other" as far as we're concerned.
        analysisStatuses: {
            EDITING: 'Editing',
            ANALYSIS_RUNNING: 'Ready for GIS Analysis',
            ANALYSIS_COMPLETE: 'GIS Analysis Complete',
            ANALYSIS_STARTING: 'Starting analysis...',
            PDF_GENERATING: 'Creating PDF',
            COMPLETE: 'Complete',
            OTHER: 'Other',
            fromEtdmStatus: function (etdmStatus) {
                var foundStatus = null;
                for (var s in this) {
                    if (this[s] === etdmStatus) {
                        foundStatus = this[s];
                        break;
                    }
                }
                return foundStatus || this.OTHER;
            },
            fromProgressResultCode: function (progressResultCode) {
                switch (progressResultCode) {
                case -1: return this.EDITING;
                case 0: return this.EDITING;
                case 2: return this.ANALYSIS_RUNNING;
                case 4: return this.PDF_GENERATING;
                case 5: return this.COMPLETE;
                default: return this.OTHER;
                }
            }
        },

        selectionSymbols: {
            point:
                new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 12,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                        new Color([0, 168, 132, 1]), 2),
                    new Color([0, 255, 197, 0.5])),
            polyline:
                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                    new Color([0, 255, 197, 1]), 2),
            polygon:
                new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                        new Color([0, 168, 132, 1]), 2),
                    new Color([0, 255, 197, 0.5]))
        },

        constructor: function (options) {
            this.currentAuthority = options.currentAuthority;
        },

        //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
        openProjectDialog: new Dialog({
            id: 'projectEditor_open_dialog',
            title: 'Open Project',
            content: OpenProjectDialogTemplate
        }),

        showOpenProjectDialog: function () {
            var self = this;
            this.loadingOverlay.show('Getting project list');
            this.listProjectAlts().then(
                function () {
                    self.loadingOverlay.hide();
                    self.openProjectDialog.show();
                },
                function (e) {
                    self.loadingOverlay.hide();
                    topic.publish('viewer/handleError', e);
                }
            );
        },
        //undo/redo
        undoManager: new UndoManager(),
        undo: function () {
            this.undoManager.undo();
            this.edit.deactivate();
        },
        redo: function () {
            this.undoManager.redo();
            this.edit.deactivate();
        },
        updateUndoRedoButtons: function () {
            var operation = null,
                title = '';
            if (this.undoManager.canUndo) {
                operation = this.undoManager.peekUndo();
                title = 'Undo ' + operation.label + ' "' +
                    operation.feature.graphic.attributes.FEATURE_NAME + '"';
                this.undoButton.set('title', title);
                this.undoButton.set('disabled', false);
            } else {
                this.undoButton.set('title', 'Nothing to undo');
                this.undoButton.set('disabled', true);
            }
            if (this.undoManager.canRedo) {
                operation = this.undoManager.peekRedo();
                title = 'Redo ' + operation.label + ' "' +
                    operation.feature.graphic.attributes.FEATURE_NAME + '"';
                this.redoButton.set('title', title);
                this.redoButton.set('disabled', false);
            } else {
                this.redoButton.set('title', 'Nothing to undo');
                this.redoButton.set('disabled', true);
            }
        },

        newFeatureDialog: new Dialog({
            id: 'projectEditor_new_feature_dialog',
            title: 'New Feature',
            content: NewFeatureDialogTemplate//,
            //style: 'width: 350px; height: 300px'
        }),

        showNewFeatureDialog: function () {
            this.extractPointError(null);
            this.extractLineError(null);
            this.newFeatureDialog.show();
        },

        projectAltId: null, //the ID of the current project alternative being edited, if one is loaded

        unloadCurrentProject: function () {
            this.features.removeAll();
            this.clearProjectLayers();
            this.extractGraphics.clear();
            this.deactivateExtract(); //deactivates draw tool too
            this.edit.deactivate();
            this.undoManager.clearUndo();
            this.undoManager.clearRedo();
            this.currentProjectAlt(null);
            this.mode('default');
            this.projectAltId = null;
        },

        enableAnalysisOption: function () {
            return this.features.length > 0;
        },
        showEditFeatures: function () {
            this.mode('editFeatures');
        },

        showAnalysisOption: function () {
            //add to input queue (only does new/updated features; no need to wait for response; it can take a while to process, and it's ok to set the status to ready for GIS--that will wait if necessary)
            MapDAO.addAltFeaturesToInputQueue(this.projectAltId); //eslint-disable-line no-undef
            this.deactivateExtract(); //deactivates draw tool too
            this.edit.deactivate();

            this.mode('analysis');
        },

        startAnalysis: function () {
            var self = this;
            self.analysisStatus(self.analysisStatuses.ANALYSIS_STARTING);
            MapDAO.startAnalysisForAlternative(this.projectAltId, { //eslint-disable-line no-undef
                callback: function (reply) {
                    if (reply === 'ok') {
                        self.analysisStatus(self.analysisStatuses.ANALYSIS_RUNNING);
                        //first time can take a while before status actually updates, might still be stuff going on, so wait 45 seconds before first check
                        window.setTimeout(function () {
                            self.checkAnalysisProgress();
                        }, 45000);
                    } else {
                        self.analysisStatus(self.analysisStatuses.EDITING);
                        topic.publish('growler/growlError', 'Error starting analysis: ' + reply);
                    }
                    
                    //self.unloadCurrentProject();
                    //topic.publish('growler/growl', 'Analysis started. Please check the Project Status page to see progress.');
                },
                errorHandler: function (message, exception) {
                    self.analysisStatus(self.analysisStatuses.EDITING);
                    topic.publish('growler/growlError', 'Error starting analysis. Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)); //eslint-disable-line no-undef
                }
            });
        },

        checkAnalysisProgress: function () {
            var self = this;
            self.progressErrorCount = self.progressErrorCount || 0;
            //eslint-disable-next-line no-undef
            MapDAO.getAltAnalysisProgress(this.projectAltId, {
                callback: function (p) {
                    var s = self.analysisStatuses.fromProgressResultCode(p.progressGIS.code);
                    self.completedGisCount(p.completedGisCount);

                    self.analysisStatus(s);

                    if (self.analysisRunning()) {
                        window.setTimeout(function () {
                            self.checkAnalysisProgress();
                        }, 15000);
                    }
                },
                errorHandler: function (e) {
                    if (self.progressErrorCount > 5) {
                        //bail
                        topic.publish('growler/growlError', 'Too many errors updating progress, updates will stop: ' + e);
                    } else {
                        topic.publish('growler/growlError', 'Error updating progress: ' + e);
                        self.progressErrorCount++;
                        self.checkAnalysisProgress();
                    }
                }
            });
        },

        //called from startup or external call to start editing a project
        loadProject: function (projectId) {
            var self = this;
            MapDAO.getEditableAlternativeOfProjectList(projectId, { //eslint-disable-line no-undef
                callback: function (projectList) {
                    if (projectList.length === 0) {
                        topic.publish('growler/growlError', 'Project ' + projectId + ' has no editable alternatives');
                    } else {
                        if (self.currentAuthority().orgId !== projectList[0].orgId) {
                            //change currentAuthority
                            var authority = self.authorities.find(function (a) {
                                return a.orgId === projectList[0].orgId;
                            });
                            if (authority) {
                                self.currentAuthority(authority);
                            } else {
                                topic.publish('growler/growlError', 'You are not authorized to edit this project');
                                return;
                            }
                        }
                        if (projectList.length === 1) {
                            var a = projectList[0];
                            //combine project and alt names
                            a.name = a.projectName + ' - ' + a.altName;
                            a.label = '#' + a.projectId + '-' + a.altNumber + ': ' + a.name;

                            self.loadProjectAlt(a);

                        } else {
                            //pick an alt
                            projectList.forEach(function (projectAlt) {
                                //combine project and alt names
                                projectAlt.name = projectAlt.projectName + ' - ' + projectAlt.altName;
                                projectAlt.label = '#' + projectAlt.projectId + '-' + projectAlt.altNumber + ': ' + projectAlt.name;

                                //add functions
                                projectAlt.load = function () {
                                    self.loadProjectAlt(projectAlt);
                                    self.openProjectDialog.hide();
                                };
                            });
                            self.projects(projectList);
                            self.openProjectDialog.show();
                        }
                    }
                },
                errorHandler: function (message, exception) {
                    topic.publish('viewer/handleError', {
                        source: 'ProjectEditor.listProjectAlts',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                    });
                }
            });

        },

        
        loadProjectAlt: function (projectAlt) {
            var self = this;

            this.loadingOverlay.show('Loading Project');

            //eslint-disable-next-line no-undef
            MapDAO.getPermissionToEditProjectAlt(projectAlt.id, {
                callback: function (permission) {
                    self.loadingOverlay.hide();
                    if (permission === 'ok') {
                        self.projectAltId = projectAlt.id;
                        self.currentProjectAlt(projectAlt);
                        var s = self.analysisStatuses.fromEtdmStatus(projectAlt.status);
                        self.analysisStatus(s);
                        if (s === self.analysisStatuses.ANALYSIS_COMPLETE) {
                            self.checkAnalysisProgress();
                        }
                        self._loadProjectAltFeatures(projectAlt.id);
                        self.mode('editFeatures');
                    } else {
                        topic.publish('growler/growlError', permission);
                    }
                },
                errorHandler: function (message, exception) {
                    self.loadingOverlay.hide();
                    topic.publish('viewer/handleError', {
                        source: 'ProjectEditor.loadProjectAlt',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                    });
                }
            });

        },

        postCreate: function () {
            this.inherited(arguments);
            //todo post create code goes here
            //this._createGraphicLayers();

        },

        startup: function () {
            this.inherited(arguments);

            this.loadingOverlay = new LoadingOverlay(); //this can be defined at the root level, but...

            topic.subscribe('projectEditor/loadProject', lang.hitch(this, 'loadProject'));

            this._createGraphicLayers();
            //this entire widget will be hidden if user doesn't have at least one project editing auth, so don't need to worry about index out of bounds
            if (!this.currentAuthority() || this.currentAuthority().projectEditor === false) {
                this.currentAuthority(this.authorities[0]);
            }
            this._setupEditor();
            this._knockoutifyProjectEditor();


            this.addressToPointSearch = new Search({
                maxResults: 4, // just because > 4 gets clipped in bottom of dialog
                sources: [
                    {
                        locator: new Locator('//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer'),
                        singleLineFieldName: 'SingleLine',
                        outFields: ['Addr_type'],
                        name: 'Esri World Geocoder',
                        countryCode: 'US',
                        localSearchOptions: {
                            minScale: 300000,
                            distance: 50000
                        },
                        searchExtent: new Extent({
                            xmin: -87.79,
                            ymin: 24.38,
                            xmax: -79.8,
                            ymax: 31.1,
                            spatialReference: {
                                wkid: 4326
                            }
                        }),
                        placeholder: 'Create point from address or place',
                        highlightSymbol: { /*TODO this isn't showing up*/
                            url: 'https://js.arcgis.com/3.27/esri/dijit/Search/images/search-pointer.png',
                            width: 36, height: 36, xoffset: 9, yoffset: 18
                        }
                    }
                ]
            }, 'addressToPointP');
            this.addressToPointSearch.startup(); //todo maybe define this when the dialog opens?

            var self = this; //todo move to top or find some other way to maintain context

            on(this.addressToPointSearch, 'select-result', function (e) {
                self.map.setExtent(e.result.extent);
                e.result.feature.name = e.result.name;
                var feature = self._constructFeature(e.result.feature);
                self._addFeatureToLayer(feature, true);
                self.newFeatureDialog.hide();
            });

            window.addEventListener('storage', lang.hitch(this, '_handleStorageMessage'));

            this._handleQueryString();

        },

        _handleStorageMessage: function (e) {
            if (e.key === 'postMessage') {
                this._handleQueryString('?' + e.newValue);
            }
        },

        /**
        * Handles"editproject" arguments passed in the query string to do things after this widget is loaded.
        * @param {object} queryString optional queryString when calling this method from _handleStorageMessage. If not provided, uses window.location.href to get queryString
        * @returns {void}
        */
        _handleQueryString: function (queryString) {
            var uri = queryString || window.location.href;
            var qs = uri.indexOf('?') >= 0 ? uri.substring(uri.indexOf('?') + 1, uri.length) : '';
            qs = qs.toLowerCase();
            var qsObj = ioQuery.queryToObject(qs);
            if (qsObj.editproject) {
                this.loadProject(qsObj.editproject);
            //TODO } else if (qsObj.editalt) {
            //TODO loadProjectAlt expects an object, need to create/call a new MapDAO method that accepts projectAltId
            }
        },

        //TODO need something like _handleMessage from _LayerLoadMixin to handle already-loaded maps

        //save to server
        _addFeatureToLayer: function (feature, addToStack) {
            var self = this,
                layer = self.layers[feature.type],
                deferred = new Deferred(),
                operation = new FeatureOperations.Add(feature);

            layer.applyEdits([feature.graphic], null, null, function (addResult) {
                if (!addResult || addResult.length === 0) {
                    //not sure if this can actually happen
                    topic.publish('growler/growlError', 'No result from applyEdits. Please contact the help desk for assistance.'); 
                    return;
                }

                if (addResult[0].error) {
                    topic.publish('growler/growlError', addResult[0].error.message);
                    return;
                }

                //make it active
                self.currentFeature(feature);

                //push it to features observableArray
                self.features.push(feature);

                //Add to undo stack
                if (addToStack !== false) {
                    self.undoManager.add(operation);
                }

                self.analysisStatus(self.analysisStatuses.EDITING);

                deferred.resolve(feature);

            }, function (err) {
                deferred.reject(err);
            });
            return deferred;
        },

        digitizePoint: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('point');
        },

        extractPoint: function () {
            var self = this;
            self.extractPointError(null);
            self.loadingOverlay.show('Extracting point...');

            Extract.extractPoint(this.roadwayId(), this.milepost()).then(
                function (p) {
                    self.loadingOverlay.hide();
                    //construct a feature
                    var o = {
                        name: self.roadwayId() + ' @ ' + self.milepost(),
                        geometry: p
                    };
                    var f = self._constructFeature(o);
                    self._addFeatureToLayer(f, true);
                    self.map.centerAt(p);
                    self.newFeatureDialog.hide();
                }, function (e) {
                    self.loadingOverlay.hide();
                    self.extractPointError(e);
                });
        },

        extractLine: function () {
            var self = this;
            self.extractLineError(null);
            self.loadingOverlay.show('Extracting line...');

            Extract.extractLine(this.roadwayId(), this.milepost(), this.endMilepost()).then(
                function (polyLines) {
                    self.loadingOverlay.hide();
                    self.newFeatureDialog.hide();
                    self._addRoadwayFeatures(polyLines, self.roadwayId());
                }, function (e) {   
                    self.extractLineError(e);
                    self.loadingOverlay.hide();
                }
            );
        },

        /**
         * Callback handler for extractLine, constructs features for each  one.
         * @param {any} polyLines An array of polyLines extracted from the basemap
         * @param {any} roadwayId The ID of the roadway, used for labeling features.
         * @returns {void}
         */
        _addRoadwayFeatures: function (polyLines, roadwayId) {
            var extent = null;
            //todo warn user if empty? I don't think that can happen 
            for (var i = 0; i < polyLines.length; i++) {
                //construct a feature
                var pl = polyLines[i],
                    path = pl.paths[0],
                    bmp = path[0][2].toFixed(3),
                    emp = path[path.length - 1][2].toFixed(3),
                    name = roadwayId + ' from ' + bmp + ' to ' + emp,
                    o = {
                        name: name,
                        geometry: pl
                    };
                var f = this._constructFeature(o);
                this._addFeatureToLayer(f, true);
                extent = extent ? extent.union(pl.getExtent()) : pl.getExtent();
            }
            this.map.setExtent(extent);
        },

        /**
         * Constructs a point from the lat/long value entered in latLongValidationTextBox
         * @returns {void}
         */
        latLongToPoint: function () {
            var llInput = this.latLongValidationTextBox.get('value'),
                p = LatLongParser.interpretCoordinates(llInput);
            if (!p) {
                //surely there's a purely dojo way to do this, but documentation is impenetrable
                this._latLongValid = false;
                this.latLongValidationTextBox.validate(); //forces display of invalid
                return;
            }
            //have an object with x and y properties, flesh this out into a thing that can be passed to _constructFeature;
            var featureStub = {
                    geometry: new Point(p.x, p.y),
                    name: llInput
                },
                feature = this._constructFeature(featureStub);
            this._addFeatureToLayer(feature, true);
            this.newFeatureDialog.hide();
        },

        /**
         * Puts the app in draw-polyline mode
         * @returns {void}
         */
        digitizeLine: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('polyline');
        },

        /**
         * Puts the app in draw-freehandpolyline mode
         * @returns {void}
         */
        digitizeFreehandLine: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('freehandpolyline');
        },

        /**
         * Puts the app in interactive extract mode.
         * @returns {void}
         */
        interactiveExtract: function () {
            this.newFeatureDialog.hide();
            this.extractGraphics.clear();
            this.roadwayGraphics.clear();
            Extract.addRciBasemapToMap();
            this.activateDrawTool('extract1');
        },

        /**
         * Puts the app in draw-polygon mode
         * @returns {void}
         */
        digitizePolygon: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('polygon');
        },

        /**
         * Puts the app in draw-freehandpolygon mode
         * @returns {void}
         */
        digitizeFreehandPolygon: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('freehandpolygon');
        },

        /**
         * Sets up the draw and edit toolbars, including the draw-complete event handler that handles drawing and interactive extracting.
         * @returns {void}
         */
        _setupEditor: function () {
            var self = this; //closure so we can access this.draw etc.
            this.draw = new Draw(this.map); //draw toolbar, not shown in UI, but utilized by our UI
            this.edit = new Edit(this.map);

            on(this.undoManager, 'change', lang.hitch(this, 'updateUndoRedoButtons'));

            //customizing the draw toolbar so the UI can remind user what they're doing, and have ability to cancel
            //eslint-disable-next-line no-undef
            self.drawMode = ko.observable(); //either null, 'draw', 'extract1', 'extract2', or 'split'; controls what happens in draw-complete and visibility of cancel buttons in sidebar

            self.activateDrawTool = function (mode) {
                //put us in draw-new-feature mode.
                self.drawMode(mode.startsWith('extract') ? mode : 'draw');
                //deactivate edit toolbar
                self.edit.deactivate();
                //clear out current feature
                self.currentFeature(null);
                //pass the word onto the draw tool
                self.draw.activate(mode.startsWith('extract') ? 'point' : mode);
                //turn off identify
                topic.publish('mapClickMode/setCurrent', 'digitize');
            };

            self.activateSplitTool = function (geometryType) {
                geometryType = geometryType || 'polyline'; //default
                //put us in draw-new-feature mode.
                self.drawMode('split');
                //deactivate edit toolbar
                self.edit.deactivate();
                //pass the word onto the draw tool
                self.draw.activate(geometryType);
                //turn off identify
                topic.publish('mapClickMode/setCurrent', 'digitize');
            };

            self.deactivateDrawTool = function () {
                //pass the word onto the draw tool
                self.draw.deactivate();
                self.drawMode(null);
                //toggle back to default map click mode. The brief delay prevents identify from jumping on the bandwagon after extract
                topic.publish('mapClickMode/setDefault');
            };

            self.deactivateExtract = function () {
                self.deactivateDrawTool();
                self.extractGraphics.clear();
                self.roadwayGraphics.clear();
            };

            self.roadwayGraphics.on('click', function (event) {
                self.selectedRoadway = event.graphic;
            });

            //event handler for draw complete, creates a new feature when user finishes digitizing, or splits a feature when user finishes drawing a line for splitting
            this.draw.on('draw-complete', function (event) {
                var layer = self.layers[event.geometry.type], //note: only applys in draw mode, gets redefined in split mode
                    mode = self.drawMode();
                //toggle back to default map click mode, except when extracting
                if (!(mode || '').startsWith('extract')) {
                    self.deactivateDrawTool();
                }

                if (mode === 'draw') {
                    //construct a feature
                    var f = self._constructFeature(event);
                    self._addFeatureToLayer(f, true);
                } else if (mode === 'extract1') {
                    Extract.getRoadwaysByPoint(event.geometry, self.map).then(
                        function (reply) {
                            if (reply.features.length > 0) {
                                self.extractPoint1 = event.geometry; //cache the first point
                                self.extractGraphics.add(new Graphic(event.geometry));

                                //construct features
                                for (var i = 0; i < reply.features.length; i++) {
                                    var roadwayFeature = reply.features[i];
                                    roadwayFeature.geometry.spatialReference = reply.spatialReference;
                                    var roadwayGraphic = new Graphic(roadwayFeature); //creates a Graphic with a JSON object
                                    self.roadwayGraphics.add(roadwayGraphic);
                                }
                                //queue up drawing the second point
                                self.activateDrawTool('extract2');
                            }
                        },
                        function (e) {
                            topic.publish('growler/growlError', 'Error extracting roadway: ' + e);
                        }
                    );
                } else if (mode === 'extract2') {
                    if (!self.selectedRoadway) {
                        //TODO alert the user; stay in this mode, don't draw a point
                        return;
                    }
                    //extract the line
                    self.extractGraphics.add(new Graphic(event.geometry));
                    self.loadingOverlay.show('Extracting line...');
                    var roadwayLine = self.selectedRoadway.geometry.paths[0],
                        v1 = Extract.findClosestVertexToPoint(roadwayLine, self.extractPoint1),
                        v2 = Extract.findClosestVertexToPoint(roadwayLine, event.geometry),
                        roadwayId = self.selectedRoadway.attributes.ROADWAY;
                    Extract.extractLine(roadwayId, v1[2], v2[2]).then(
                        function (polyLines) {
                            self.loadingOverlay.hide();
                            self._addRoadwayFeatures(polyLines, roadwayId);
                            self.deactivateExtract(); //hides the points
                            self.extractPoint1 = null; //superfluous, but just to keep things tidy
                        }, function (e) {
                            self.loadingOverlay.hide();
                            topic.publish('growler/growlError', 'Error extracting roadway: ' + e);
                            //todo alert user!
                        }
                    );

                    //self.extract.extractRouteBetweenPoints2(self.extractPoint1, event.geometry, self.map).then(
                    //    function (polyline) {
                    //        self.loadingOverlay.hide();
                    //        self.deactivateExtract(); //hides the points
                    //        self.extractPoint1 = null; //superfluous, but just to keep things tidy
                    //        var ef = self._constructFeature({
                    //            geometry: polyline,
                    //            name: 'Extracted Line ' + self._nextFeatureNumber() //TODO can we do better? Maybe the return from extractRouteBetweenPoints could also do identify, etc.?
                    //        });
                    //        self._addFeatureToLayer(ef, true);
                    //    },
                    //    function (e) {
                    //        self.loadingOverlay.hide(); //we don't use the extractError observable b/c the dialog isn't shown.
                    //        topic.publish('growler/growlError', 'Error extracting roadway: ' + e);
                    //    }
                    //);
                } else if (mode === 'split') {
                    //the currentFeature().geometry is the geometry to be cut
                    var currentFeature = self.currentFeature(),
                        geometry = currentFeature ? currentFeature.graphic.geometry : null,
                        //the event.geometry is the cutter
                        cutter = event.geometry,
                        explodedGeometries = [];
                    //redefine layer to be the layer containing the feature being split, not the event geometry type used to split it
                    layer = geometry ? self.layers[geometry.type] : null;

                    if (geometry && cutter) {
                        self.loadingOverlay.show('Splitting features...');
                        //eslint-disable-next-line no-undef
                        esriConfig.defaults.geometryService.cut([geometry], cutter,
                            function (result) {
                                self.loadingOverlay.hide();
                                //for our purposes, we're only cutting one geometry object at a time, so we can ignore the cutIndexes property of result
                                //but for reference, because it's poorly documented, the cutIndexes is an array that indicates which of the geometries
                                //passed into the cut request were the source of the given geometry at the same place in the array of geometries returned.
                                //For example, if we cut two geometries g1 and g2 with one line into two pieces each, the cutIndexes would be [0,0,1,1], and geometries
                                //[g1a, g1b, g2a, g2b], where g1a and g1b were derived from g1, ang g2a and b from g2.
                                if (result.geometries.length > 1) {
                                    //split always returns two geometries, which may be multi-part geometries if there are multiple
                                    //intersections of the geometry being cut and the cutting geometry
                                    //because we want to avoid the headaches of multi-part features, we have to test whether we need to explode them
                                    result.geometries.forEach(function (g) {
                                        //test if multi-part
                                        if (!MultiPartHelper.isMultiPart(g)) {
                                            explodedGeometries.push(g);
                                        } else {
                                            //explode and write sub-parts
                                            var egs = MultiPartHelper.explode(g);
                                            egs.forEach(function (eg) {
                                                explodedGeometries.push(eg);
                                            });
                                        }
                                    });

                                    //assume 0 is the geometry we'll store in the current feature, and 1..N are new features
                                    //update the geometry of the currentFeature
                                    currentFeature.graphic.setGeometry(explodedGeometries[0]);
                                    //todo rename?

                                    //create the features and their graphics to add; note these are both essentially the same,
                                    //the features being a wrapper around the geometries, but for simplicity down the line 
                                    //here I have separate arrays for different purposes; addedFeatures get added to the model's
                                    //features array, the addedGraphics are passed to the applyEdits function.
                                    var addedFeatures = [],
                                        addedGraphics = [];
                                    for (var i = 1; i < explodedGeometries.length; i++) { //starting at 1, not 0, because we assume 0 is new graphic for current feature
                                        //construct a new current feature
                                        var newFeature = self._constructFeature({
                                            geometry: explodedGeometries[i],
                                            name: currentFeature.name() + ' (' + (i + 1) + ')' //e.g. "Feature X (2)"
                                        });
                                        addedFeatures.push(newFeature); //for adding to model.features
                                        addedGraphics.push(newFeature.graphic); //for use in applyEdits
                                    }

                                    //save to server
                                    self.loadingOverlay.show('Saving new and updated features...');
                                    layer.applyEdits(addedGraphics, [currentFeature.graphic], null, function (addResult, updateResult) {
                                        self.loadingOverlay.hide();
                                        if (!addResult || addResult.length === 0 || !updateResult || updateResult.length === 0) {
                                            //todo check a and u and make sure successfull
                                        }
                                        addedFeatures.forEach(function (addedFeature) {
                                            self.features.push(addedFeature);
                                        });

                                        self.analysisStatus(self.analysisStatuses.EDITING);

                                        //add to undo stack
                                        var operation = new FeatureOperations.Split(currentFeature, addedFeatures);
                                        self.undoManager.add(operation);
                                    }, function (err) {
                                        self.loadingOverlay.hide();
                                        topic.publish('growler/growlError', 'Error saving features: ' + err);
                                    });
                                }
                            }, function (err) {
                                self.loadingOverlay.hide();
                                topic.publish('growler/growlError', 'Error splitting features: ' + err);
                            }
                        );
                    }
                } else {
                    topic.public('growler/growlError', 'Unexepected draw mode "' + mode + '".');
                }
            });

            //event handler function for vertext move and delete
            this.vertexChanged = function (evt) {
                var delay = 2000, //number of milliseconds to give the user before we automatically save
                    graphic = evt.graphic,
                    feature = graphic.feature;

                self.lastEditAt = new Date();
                self.vertexMoving = false;
                //save after short delay
                //the delay prevents annoying the user if they're busy moving several vertices
                window.setTimeout(function () {
                    //if another vertex move has happened in the built-in delay since this function was called, do not save
                    var now = new Date(),
                        duration = now.getTime() - self.lastEditAt.getTime(); //# of milliseconds since the last time vertex move stop happened
                    if (duration >= delay && !self.vertexMoving) {
                        //save to database
                        feature.applyUpdate();
                    }
                }, delay);
            };

            this.edit.on('vertex-move-stop', this.vertexChanged, this);
            this.edit.on('vertex-delete', function (evt) {
                //update last changed
                self.lastEditAt = new Date();
                //update feature
                self.vertexChanged(evt);
            });
            this.edit.on('vertex-first-move', function () {
                //update last changed
                self.lastEditAt = new Date();
                //track that we're moving vertices
                self.vertexMoving = true;

            });
            this.edit.on('vertex-move', function () {
                //update last changed
                self.lastEditAt = new Date();
                self.vertexMoving = true;
            });
            this.edit.on('graphic-move-stop', function (evt) {
                //save to database
                evt.graphic.feature.applyUpdate();
            });

            //TODO we can also support scaling, etc.
        },

        /**
         * Clears project layers from the map.
         * @returns {void}
         */
        clearProjectLayers: function () {
            //remove existing layers from the map
            if (!this.layers) {
                return;
            }
            this.featureTypes.forEach(function (layerName) {
                if (this.layers[layerName]) {
                    this.map.removeLayer(this.layers[layerName]);
                }
            }, this);
        },

        /**
         * Gets the next number for auto-named features (e.g. "S-001", "S-002", ... "P-001" or "A-001" ...)
         * @param {String} prefix The prefix of the feature name, either S, A or P
         * @returns {String} left-padded string representing the next number in the sequence of auto-named features.
         */
        _nextFeatureNumber: function (prefix) {
            var n = 0,
                rx = new RegExp('(' + prefix + '-)(\\d+)');
            this.features().forEach(function (f) {
                var r = rx.exec(f.name());
                if (r) {
                    //convert string to number
                    r = parseInt(r[2], 10);
                    if (r > n) {
                        n = r;
                    }
                }
            });
            n++;

            return n.toString().padStart(3, 0);
        },

        _loadProjectAltFeatures: function () {
            var self = this, //keeps a reference to the root model
                loadPromises = []; //collection of promises resolved on update-end of the three editable layers (point, polyline and polygon), zooms to unioned extent when done

            this.clearProjectLayers();

            self.loadingOverlay.show('Loading Project Features');

            self.featureTypes.forEach(function (layerName) {
                var url = projects.estProjectLayers[layerName],
                    deferred = new Deferred(),
                    layer = new FeatureLayer(url,
                        {
                            id: 'projectAlt_' + layerName + '_' + self.projectAltId,
                            outFields: '*',
                            definitionExpression: 'FK_PROJECT_ALT = ' + self.projectAltId,
                            mode: FeatureLayer.MODE_SNAPSHOT
                        });
                layer.setSelectionSymbol(self.selectionSymbols[layerName]);
                self.layers[layerName] = layer;
                loadPromises.push(deferred);

                on.once(layer, 'update-end', function (info) {
                    deferred.resolve(info.target);
                });

                self.map.addLayer(layer);
            });

            //when update-end has fired for all editable layers, we can convert their graphics into feature models
            all(loadPromises).then(function (layers) {
                self.loadingOverlay.hide();

                //extract all features
                var allGraphics = [],
                    unionOfExtents = null,
                    featuresKo = [],
                    onLayerClick = function (evt) { //eslint-disable-line func-style
                        //subscription on currentFeature does this edit.activate(2, evt.graphic);
                        if (evt.graphic && evt.graphic.feature && !self.drawMode()) {
                            event.stopPropagation(evt);
                            self.currentFeature(evt.graphic.feature);
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
                self.extent = unionOfExtents; //facilitates zooming to the project
                self.zoomTo();
                self.features(featuresKo);
            }, function (err) {
                self.loadingOverlay.hide();
                topic.publish('growler/growlError', 'Error loading Project features: ' + err);
            });
        },

        //Constructs a feature either from a draw-complete event, cut operation, or when loading from server
        //It does not add the feature to the features array, nor add it to a layer.
        //eslint-disable-next-line max-statements
        _constructFeature: function (featureOrEvent) {
            if (!featureOrEvent) {
                return null;
            }
            var self = this,
                feature = {
                    geometry: featureOrEvent.geometry, //all sources have a geometry property
                    type: featureOrEvent.geometry.type,
                    canSplit: featureOrEvent.geometry.type === 'polygon' || featureOrEvent.geometry.type === 'polyline'
                };
            if (featureOrEvent._sourceLayer) {
                //feature is a graphic object returned from a feature layer
                feature.name = featureOrEvent.attributes.FEATURE_NAME;
                feature.graphic = featureOrEvent;
            } else {
                //featureOrEvent is the event argument for on-draw-complete (either from draw or cut operation),
                //or from address-auto-complete, which we manufacture as a object with a name property
                //default names for project features include the type prefix "S" for polylines (segments), "P" for points, or "A" for polygons
                var prefix = featureOrEvent.geometry.type === 'polyline' ? 'S' : featureOrEvent.geometry.type === 'polygon' ? 'A' : 'P';
                feature.name = featureOrEvent.name || (prefix + '-' + self._nextFeatureNumber(prefix));
                feature.graphic = new Graphic(featureOrEvent.geometry, null, {
                    OBJECTID: null,
                    FEATURE_NAME: feature.name,
                    FK_PROJECT_ALT: self.projectAltId,
                    FK_PROJECT: self.currentProjectAlt().projectId,
                    FK_PRJ_ALT: self.currentProjectAlt().altNumber,
                    FK_ORG_USER: self.currentAuthority().orgUserId
                    //TODO additional fields if extracted curr_lanes, fk_roadway_fclass, rdwyid, begpt, endpt, 
                });
            }

            //back-reference, supports clicking map or model
            feature.graphic.feature = feature;

            /* eslint-disable no-undef */
            feature.name = ko.observable(feature.name);
            feature.visible = ko.observable(true);
            feature.visible.subscribe(function (visible) {
                feature.graphic.visible = visible;
                feature.graphic.getLayer().redraw();
            }, 'change');

            feature.selected = ko.pureComputed(function () {
                return self.currentFeature() === feature;
            });

            //happens when user clicks on a feature in the table of features, but not when clicking on the map;
            //a different function handles that, but doesn't include the zoom/pan
            feature.select = function () {
                self.currentFeature(feature);
                //todo zoom/pan if not in current extent
                var geometry = feature.graphic ? feature.graphic.geometry : {
                        getExtent: function () {
                            return null;
                        }
                    }, //pseudo object with getExtent function that returns null extent
                    testExtent = geometry.type === 'point' ? geometry : geometry.getExtent(); //contains method expects a point or an extent
                if (testExtent && !self.map.extent.contains(testExtent)) {
                    if (geometry.type === 'point') {
                        //center at
                        self.map.centerAt(testExtent);
                    } else {
                        //zoom to buffer around extent
                        self.map.setExtent(testExtent.expand(2));
                    }
                }
            };

            feature.nameHasFocus = ko.observable(); //used to set focus to the name textbox

            //This subscription undoes a user's attempt to enter duplicate feature names, and updates the database with the new feature name if it has changed.
            feature.name.subscribeChanged(function (latestValue, previousValue) {
                //validate the new name is unique
                var matchedName = self.features().find(function (f) {
                    return feature !== f && f.name() === latestValue;
                });

                if (matchedName) {
                    topic.publish('growler/growlWarning', 'Warning: another feature with the name "' + latestValue + '" exists. Reverting to previous value "' + previousValue + '"');
                    feature.name(previousValue);
                    window.setTimeout(function () {
                        feature.select(); //if the name change event that started this all is clicking to a different feature, set it back
                        feature.nameHasFocus(true); //sets focus on the name element
                    }, 300);
                    return;
                }

                //has something changed?
                if (feature.graphic.attributes.FEATURE_NAME !== latestValue) {
                    feature.graphic.attributes.FEATURE_NAME = latestValue;
                    feature.applyUpdate();
                }
            });

            //using this in lieu of ko deferred for simpler control, we really only want to prevent applyUpdate in the limited
            //circumstance of restoring values after undo/redo
            //TODO not needed for projects?
            feature.deferApplyEdits = false; //set to true when updating in series in the restore method

            /**
             * Apply an update to this feature, and optionally add to stack. If the deferApplyEdits property is true
             * then nothing happens.
             * @param {any} addToStack //set to false when restoring an update to prevent adding to the stack.
             * @returns {Defered} a Deferred object to be resolved when applyEdits is complete or when we short-cut based on deferApplyEdits
             */
            feature.applyUpdate = function (addToStack) {
                var graphic = feature.graphic,
                    layer = self.layers[graphic.geometry.type],
                    operation = FeatureOperations.Update(feature), //eslint-disable-line new-cap
                    deferred = new Deferred();
                if (feature.deferApplyEdits) {
                    deferred.resolve(false);
                    return deferred;
                }
                self.loadingOverlay.show('Saving feature...');
                layer.applyEdits(null, [graphic], null, function (adds, updates) { //eslint-disable-line no-unused-vars "adds" var is here because that's the structure of the callback, but will always be empty
                    self.loadingOverlay.hide();
                    if (!updates || updates.length === 0) {
                        //todo warn user and handle situation. Not sure if this actually happens
                    }
                    if (!(addToStack === false)) { //if null, or true, or anything other than a literal false, add to stack
                        self.undoManager.add(operation);
                    }

                    self.analysisStatus(self.analysisStatuses.EDITING);

                    deferred.resolve(true);
                    //feature.cachePreUpdate();
                }, function (err) {
                    self.loadingOverlay.hide();
                    deferred.reject(err);
                });
                return deferred;
            };

            feature.deleteFeature = function (addToStack) {
                var graphic = feature.graphic,
                    layer = self.layers[graphic.geometry.type],
                    operation = new FeatureOperations.Delete(feature);
                self.deactivateExtract(); //deactivates draw tool too
                self.edit.deactivate();
                layer.applyEdits(null, null, [graphic], function () {
                    self.features.remove(feature);
                    self.currentFeature(null); //todo or activate next feature?
                    self.edit.deactivate();
                    //Add to undo stack
                    if (addToStack !== false) {
                        self.undoManager.add(operation);
                    }
                });
            };
            //no add function, handled elsewhere

            feature.restore = function (preUpdateCache) {
                if (preUpdateCache) {
                    //defer applying updates
                    feature.deferApplyEdits = true;
                    //restore properties
                    feature.graphic = preUpdateCache.graphic;
                    feature.name(preUpdateCache.name);
                    feature.deferApplyEdits = false;
                    feature.applyUpdate(false);
                } else {
                    //means we're restoring from deleted
                    self._addFeatureToLayer(feature, false);
                }
            };

            //cache original, pre-update, to support undo
            feature.cachePreUpdate = function () {
                feature.preUpdate = {
                    graphic: feature.graphic.clone(),
                    name: feature.name()
                };
            };
            feature.cachePreUpdate();

            /* eslint-enable no-undef */

            return feature;
        },

        listProjectAlts: function () {
            var self = this,
                deferred = new Deferred(),
                orgId = this.currentAuthority().orgId;

            //eslint-disable-next-line no-undef
            MapDAO.getEditableAlternativeList(orgId, {
                callback: function (projectList) {
                    projectList.forEach(function (projectAlt) {
                        //combine project and alt names
                        projectAlt.name = projectAlt.projectName + ' - ' + projectAlt.altName;
                        projectAlt.label = '#' + projectAlt.projectId + '-' + projectAlt.altNumber + ': ' + projectAlt.name;

                        //add functions
                        projectAlt.load = function () {
                            self.loadProjectAlt(projectAlt);
                            self.openProjectDialog.hide();
                        };
                    });
                    self.projects(projectList);
                    deferred.resolve();
                },
                errorHandler: function (message, exception) {
                    topic.publish('viewer/handleError', {
                        source: 'ProjectEditor.listProjectAlts',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                    });
                    deferred.reject(message);
                }
            });
            return deferred;
        },

        simplifyGeometry: function (geometry) {
            var deferred = null;
            if (geometry) {
                if (geometry.type === 'polygon') {
                    deferred = esriConfig.defaults.geometryService.simplify([geometry]); //eslint-disable-line no-undef
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

        zoomTo: function () {
            if (this.extent) {
                //todo this fails if there's just one point. See zoomToFeature for example, may need to centerAndZoom; 
                topic.publish('layerLoader/zoomToExtent', this.extent.expand(1.5));
            } else {
                topic.publish('growler/growl', 'Project has no features');
            }
        },

        //eslint-disable-next-line max-statements
        _knockoutifyProjectEditor: function () {
            var self = this;

            /* eslint-disable no-undef */

            this.projects = ko.observableArray(); //not really projects, but rather editable project alts.

            this.currentProjectAlt = ko.observable(); //doesn't do much except cache the project and alt ids and name for display; not editable

            this.analysisStatus = ko.observable();

            this.completedGisCount = ko.observable();

            this.canEdit = ko.pureComputed(function () {
                return self.analysisStatus() === self.analysisStatuses.EDITING || self.analysisStatus() === self.analysisStatuses.ANALYSIS_COMPLETE;
            });

            this.analysisRunning = ko.pureComputed(function () {
                return self.analysisStatus() === self.analysisStatuses.ANALYSIS_STARTING || self.analysisStatus() === self.analysisStatuses.ANALYSIS_RUNNING || self.analysisStatus() === self.analysisStatuses.ANALYSIS_COMPLETE || self.analysisStatus() === self.analysisStatuses.PDF_GENERATING;
            });

            this.analysisStatusText = ko.pureComputed(function () {
                if (self.analysisStatus() === self.analysisStatuses.ANALYSIS_RUNNING) {
                    return 'Analyzing';
                }
                if (self.analysisStatus() === self.analysisStatuses.PDF_GENERATING) {
                    return 'Creating PDF ' + (self.completedGisCount - 1) + ' of 21';
                }
                return self.analysisStatus();
            });

            this.hasAnalysisResults = ko.pureComputed(function () {
                //this presumes there are some sort of results available for the project if status is analysis complete or higher
                return self.analysisStatus() === self.analysisStatuses.OTHER || self.analysisStatus() === self.analysisStatuses.COMPLETE;
            });

            //all of the features, as models, regardless of geometry, distinct from, but related to, the features in layers.point.graphics, layers.polyline.graphics, and layers.polygon.graphics
            this.features = ko.observableArray();
            //sorted list of features
            this.featureSortOption = ko.observable('name'); //name, type
            //functions for toggling sort
            this.sortFeaturesBy = function (option) {
                if (this.featureSortOption() === option) {
                    this.featureSortDescending(!this.featureSortDescending());
                } else {
                    this.featureSortOption(option);
                    this.featureSortDescending(false);
                }
            };
            this.sortFeaturesByName = function () {
                this.sortFeaturesBy('name');
            };
            this.sortFeaturesByType = function () {
                this.sortFeaturesBy('type');
            };
            this.featureSortDescending = ko.observable(false);
            //for class binding
            this.featureSortClass = ko.pureComputed(function () {
                return this.featureSortDescending() ? 'dgrid-sort-down' : 'dgid-sort-up';
            }, this);
            this.sortedFeatures = ko.pureComputed(function () {
                var sortOption = this.featureSortOption() || 'name', //default sort by name
                    featureTypes = ['point', 'polyline', 'polygon'],
                    sortDescending = this.featureSortDescending(); //default sort ascending
                return this.features().sort(function (a, b) {
                    var comp = 0,
                        aVal = null,
                        bVal = null;

                    if (sortOption === 'name') {
                        aVal = a.name();
                        bVal = b.name();
                    } else if (sortOption === 'type') {
                        //convert point=0, polyline=1, polygon=2 for usual organization of features, not alphabetically
                        aVal = featureTypes.indexOf(a.type);
                        bVal = featureTypes.indexOf(b.type);
                        // because our featureTypes array is ordered with polygon first, reverse the sort
                    }
                    comp = (aVal < bVal) ? -1 : (aVal > bVal) ? 1 : 0;
                    if (sortOption === 'type' && comp === 0) {
                        //sort by name to break type ties
                        aVal = a.name();
                        bVal = b.name();
                        comp = (aVal < bVal) ? -1 : (aVal > bVal) ? 1 : 0;
                    }
                    //flip direction for descending
                    if (sortDescending) {
                        comp *= -1;
                    }

                    return comp;
                });
            }, this);
            //the active, highlighted feature in the table and map
            this.currentFeature = ko.observable();

            //syncs selection of features in the table and map, and initiates the appropriate editing function
            this.currentFeature.subscribe(function (f) {
                self.layers.point.clearSelection();
                self.layers.polyline.clearSelection();
                self.layers.polygon.clearSelection();
                if (f && f.graphic) {
                    if (self.mode() === 'editFeatures') {
                        //activate edit toolbar
                        if (f.type === 'polygon' || f.type === 'polyline') {
                            //activates for vertex editing
                            self.edit.activate(2, f.graphic);
                        } else {
                            //activates for move
                            self.edit.activate(1, f.graphic);
                        }
                    }
                    //select it
                    if (f.graphic.attributes && f.graphic.attributes.OBJECTID) {
                        var query = new Query();
                        query.objectIds = [f.graphic.attributes.OBJECTID];
                        self.layers[f.type].selectFeatures(query); //highlights it
                    }
                }
                window.setTimeout(function () {
                    self.updateFeatureVisibility();
                }, 100);
            });

            //bound to the toggle all features visible checkbox
            this.featuresVisible = ko.pureComputed({
                read: function () {
                    var featureCount = this.features().length,
                        visibleFeatureCount = this.features().filter(function (feature) {
                            return feature.visible();
                        }).length;
                    if (featureCount === 0) {
                        return true;
                    }
                    if (featureCount === visibleFeatureCount) {
                        return true; //all visible, or no features
                    }
                    if (visibleFeatureCount === 0) {
                        return false; //none visible
                    }
                    return null; //indeterminate, some visible, some invisible
                },
                write: function (val) {
                    //prevent writing
                    this.features().forEach(function (feature) {
                        feature.visible(val);
                    });
                }
            }, this);

            //function to handle changing visibility while forcing the current feature to always be visible
            this.updateFeatureVisibility = function () {
                this.features().forEach(function (feature) {
                    feature.graphic.visible = feature.selected() || feature.visible();
                }, this);
                this.layers.point.redraw();
                this.layers.polyline.redraw();
                this.layers.polygon.redraw();
            };

            //Controls display of Split button; computes whether the current feature can be split, true if there is a current feature selected that is a polyline or polygon;
            //false if no feature selected or only point selected. 
            this.canSplitCurrentFeature = ko.pureComputed(function () {
                var cf = this.currentFeature(),
                    gt = cf && cf.geometry ? cf.geometry.type : null;

                return gt === 'polygon' || gt === 'polyline';
            }, this);

            //facilitates navigation
            this.mode = ko.observable('default');

            //options for opening existing project
            this.projectAlts = ko.observableArray(); //the list of projects loaded into the open dialog

            this.projectSortOption = ko.observable('timeStamp'); //name, timeStamp, or projectId
            //functions for toggling sort
            this.sortProjectsBy = function (option) {
                if (this.projectSortOption() === option) {
                    this.projectSortDescending(!this.projectSortDescending());
                } else {
                    this.projectSortOption(option);
                    this.projectSortDescending(false);
                }
            };
            this.sortProjectsById = function () {
                this.sortProjectsBy('projectId');
            };
            this.sortProjectsByName = function () {
                this.sortProjectsBy('name');
            };
            this.sortProjectsByModDate = function () {
                this.sortProjectsBy('timeStamp');
            };
            this.projectSortDescending = ko.observable(true);
            this.sortedProjects = ko.pureComputed(function () {
                var sortOption = this.projectSortOption(),
                    sortDescending = this.projectSortDescending(); 
                return this.projects().sort(function (a, b) {
                    var aVal = a[sortOption],
                        bVal = b[sortOption],
                        comp = (aVal < bVal) ? -1 : (aVal > bVal) ? 1 : 0;
                    if (sortOption === 'timeStamp' && comp === 0) {
                        //sort by name to break ties
                        aVal = a.name;
                        bVal = b.name;
                        comp = (aVal < bVal) ? -1 : (aVal > bVal) ? 1 : 0;
                    }
                    if (sortOption === 'projectId' && comp === 0) {
                        //sort individual alts
                        aVal = a.altNumber;
                        bVal = b.altNumber;
                        comp = (aVal < bVal) ? -1 : (aVal > bVal) ? 1 : 0;
                    }
                    //flip direction for descending
                    if (sortDescending) {
                        comp *= -1;
                    }

                    return comp;
                });
            }, this);

            //when user changes filter option or current authority, re-list the projects
            this.currentAuthority.subscribe(this.listProjectAlts, this);

            //for extract and lat/long tools
            this.roadwayId = ko.observable();
            this.milepost = ko.observable(); //either the milepost on the point tab, or the begin milepost on the line tab
            this.endMilepost = ko.observable();
            this.extractPointError = ko.observable();
            this.extractLineError = ko.observable();

            this._latLongValid = true;
            this.latLongValidationTextBox = new ValidationTextBox({
                validator: function () {
                    return self._latLongValid;
                },
                onInput: function () {
                    self._latLongValid = true; //validation happens only on clicking the "Go" button
                }
            }, dom.byId('latLongInput'));

            //apply knockout bindings to sidebar
            ko.applyBindings(this, dom.byId('projectEditorSidebar'));
            //apply knockout bidings to open dialog
            ko.applyBindings(this, dom.byId('openProjectDialog'));
            //apply knockout bindings to new feature dialog
            ko.applyBindings(this, dom.byId('newProjectFeatureDijit'));

            /* eslint-enable no-undef */
        },

        _createGraphicLayers: function () {
            // extract points (drawn on map during interactive extract from RCI)
            this.extractGraphics = new GraphicsLayer({
                id: this.id + '_extractPoints',
                title: this.id + '_extractPoints'
            });

            var extractSymbol = new SimpleMarkerSymbol({
                style: '',
                color: [0, 115, 25, 255]
            });
            var pointRenderer = new SimpleRenderer(extractSymbol);
            this.extractGraphics.setRenderer(pointRenderer);

            this.map.addLayer(this.extractGraphics);

            this.roadwayGraphics = new GraphicsLayer({
                id: 'roadways',
                title: 'Roadways'
            });

            var lineSymbol = new SimpleLineSymbol({
                style: '',
                color: [20, 115, 25, 255],
                width: 5
            });
            var lineRenderer = new SimpleRenderer(lineSymbol);
            this.roadwayGraphics.setRenderer(lineRenderer);

            this.map.addLayer(this.roadwayGraphics);

        }

    });
});