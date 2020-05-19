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
    'dijit/ConfirmDialog', //TODO: not using this, but maybe nice for delete? Or not necessary since we have undo.
    'dijit/form/FilteringSelect',
    'dijit/form/ValidationTextBox',

    'dojo/_base/lang',
    'dojo/on',
    'dojo/dom',
    'dojo/topic',
    'dojo/store/Memory',
    'dojo/Deferred',
    'dojo/promise/all',

    'dojo/text!./AoiEditor/templates/Sidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./AoiEditor/templates/Dialog.html', // template for the open AOI dialog
    'dojo/text!./AoiEditor/templates/NewFeatureDialog.html', // template for the new feature dialog

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

    'esri/tasks/BufferParameters',
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
    ConfirmDialog,
    FilteringSelect,
    ValidationTextBox,
    lang, on, dom,
    topic, Memory, Deferred, all,
    AoiEditorSidebarTemplate,
    OpenAoiDialogTemplate,
    NewFeatureDialogTemplate,
    UndoManager, FeatureOperations,
    Search,
    Draw, Edit, Extent, Point,
    FeatureLayer, GraphicsLayer, Graphic, SimpleRenderer,
    SimpleMarkerSymbol,
    SimpleLineSymbol,
    SimpleFillSymbol,
    Color,
    BufferParameters,
    Query,
    Locator,
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
        bufferUnits: {
            feet: {
                id: 9002,
                name: 'Feet',
                abbreviation: 'ft'
            },
            miles: {
                id: 9093,
                name: 'Miles',
                abbreviation: 'mi'
            },
            meters: {
                id: 9001,
                name: 'Meters',
                abbreviation: 'm'
            },
            kilometers: {
                id: 9036,
                name: 'Kilometers',
                abbreviation: 'km'
            }
        },
        projectTypes: [
            {
                id: 15,
                abbreviation: 'BRIDGE',
                name: 'Bridge'
            },
            {
                id: 9,
                abbreviation: 'CORR',
                name: 'Corridor Study'
            },
            {
                id: 4,
                abbreviation: 'CF',
                name: 'Cost Feasible'
            },
            {
                id: 12,
                abbreviation: 'ERT',
                name: 'Emergency Response Tool'
            },
            {
                id: 16,
                abbreviation: 'FREIGHT',
                name: 'Freight'
            },
            {
                id: 6,
                abbreviation: 'LRTP',
                name: 'Long Range Transportation Plan'
            },
            {
                id: 13,
                abbreviation: 'MCORES',
                name: 'Multi-use Corridors of Regional Economic Significance'
            },
            {
                id: 1,
                abbreviation: 'NDS',
                name: 'Needs'
            },
            {
                id: 7,
                abbreviation: 'NMSA',
                name: 'Non Major State Action'
            },
            {
                id: 17,
                abbreviation: 'RAIL',
                name: 'Rail'
            },
            {
                id: 10,
                abbreviation: 'SIS',
                name: 'SIS Designation Change'
            },
            {
                id: 14,
                abbreviation: 'TRANSIT',
                name: 'Transit'
            },
            {
                id: 3,
                abbreviation: 'T1CE',
                name: 'Type I CE'
            },
            {
                id: 5,
                abbreviation: 'UCFP',
                name: 'Ultimate Cost Feasible Project'
            },
            {
                id: 8,
                abbreviation: 'OAOI',
                name: 'Other Area of Interest'
            }
        ],
        getProjectTypeById: function (id) {
            return this.projectTypes.find(function (pt) {
                return pt.id === id;
            });
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
        openAoiDialog: new Dialog({
            id: 'aoiEditor_open_dialog',
            title: 'Open Area of Interest',
            content: OpenAoiDialogTemplate
        }),

        showOpenAoiDialog: function () {
            var self = this;
            this.loadingOverlay.show('Getting AOI list');
            this.listAois().then(
                function () {
                    self.loadingOverlay.hide();
                    self.openAoiDialog.show();
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
        },
        redo: function () {
            this.undoManager.redo();
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
            id: 'aoiEditor_new_feature_dialog',
            title: 'New Feature',
            content: NewFeatureDialogTemplate//,
            //style: 'width: 350px; height: 300px'
        }),

        showNewFeatureDialog: function () {
            this.extractPointError(null);
            this.extractLineError(null);
            this.newFeatureDialog.show();
        },

        //the ID of the current AOI being edited, if one is loaded; observable so links to it work elsewhere
        aoiId: ko.observable(null), //eslint-disable-line no-undef

        //navigation functions
        //mode observable defined in knockoutify
        showNameAndDescription: function () {
            this.mode('editName');
        },

        showFeatureList: function () {
            this.mode('editFeatures');
        },

        saveAndShowFeatureList: function () {
            var self = this;
            this.saveAoiHeader().then(function () {
                self.showFeatureList();
            });
        },

        showAnalysisAreas: function () {
            //todo validate >0 features, features have buffers, etc.
            this.mode('analysisAreas');
        },

        showAnalysisOptions: function () {
            this.mode('analysisOptions');
        },

        showAnalysisProgress: function () {
            this.mode('analysisProgress');
            this.checkAnalysisProgress();
        },

        createAoi: function () {
            this.loadAoiModel(null); //an empty AOI is used to populate
            this.mode('editName');
        },

        createAoiFromDialog: function () {
            this.openAoiDialog.hide();
            this.createAoi();
        },

        toJS: function () {
            return {
                id: this.aoiId(),
                name: this.name(),
                description: this.description(),
                projectTypeId: this.projectTypeId(),
                expirationDate: this.expirationDate(),
                orgUserId: this.currentAuthority().orgUserId,
                studyAreaReportRequested: this.studyAreaReportRequested(),
                socioCulturalDataReportRequested: this.socioCulturalDataReportRequested(),
                hardCopyMapsRequested: this.hardCopyMapsRequested(),
                culturalResourcesDataReportRequested: this.culturalResourcesDataReportRequested(),
                emergencyResponseReportRequested: this.emergencyResponseReportRequested()
            };
        },

        /**
        * Creates a cache of the AOI to be used when determining if the user has made changes that need to be saved.
        * @returns {void}
        */
        _updateAoiCache: function () {
            this.cachedModel = this.toJS();
        },

        saveAoiHeader: function () {
            var self = this,
                deferred = new Deferred(),
                aoiModel = this.toJS();
            //validate
            if (!(aoiModel.name && aoiModel.projectTypeId && aoiModel.expirationDate)) {
                deferred.reject('Missing data, cannot save AOI header.');
                self.aoiNameVTB.validate();
                self.projectTypeSelect.validate();
                self.aoiHeaderForm.validate();
                return deferred;
            }
            //if no changes
            if (aoiModel.id && aoiModel.id > 0 &&
                aoiModel.name === this.cachedModel.name &&
                aoiModel.description === this.cachedModel.description &&
                aoiModel.projectTypeId === this.cachedModel.projectTypeId &&
                aoiModel.expirationDate === this.cachedModel.expirationDate) {
                deferred.resolve(false); //indicates no change was necessary, not something we really use
            } else {
                //eslint-disable-next-line no-undef
                MapDAO.saveAoiHeader(aoiModel, {
                    callback: function (id) {
                        self.aoiId(id);
                        deferred.resolve(true);
                    },
                    errorHandler: function (message, exception) {
                        self.loadingOverlay.hide();
                        topic.publish('viewer/handleError', {
                            source: 'AoiEditor.saveAoiHeader',
                            error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                        });
                        deferred.reject(message);
                    }
                });
            }
            return deferred;
        },

        saveAnalysisAreasAndShowAnalysisOptions: function () {
            if (this.analysisRunning()) {
                //short cut to progress, as we don't want user to change options
                this.showAnalysisProgress();
                return;
            }
            var self = this;

            this.saveAnalysisAreas().then(
                function () {
                    self.saveAnalysisAreaBuffers().then(
                        function () {
                            self.mode('analysisOptions');
                        },
                        function (err) {
                            topic.publish('growler/growlError', err);
                        }
                    );
                },
                function (err) {
                    topic.publish('growler/growlError', err);
                }
            );
        },

        //Analysis areas are saved on the fly as features are added to them, but if the default, typical option
        //of NOT assigning features to analysisAreas is chosen, we'll need to do that here
        saveAnalysisAreas: function () {
            var self = this,
                promises = [], //promises to be resolved when all analysis areas are created from ungroupedFeatures.
                deferred = null, //deferred object resolved when this is done; usually is assigned by _deleteEmptyAnalysisAreas
                ungroupedFeatures = this.features().filter(function (f) {
                    return !f.analysisArea() || f.analysisArea().id() === 0; //latter shouldn't ever be the case
                });

            if (ungroupedFeatures.length === 0) {
                deferred = this._deleteEmptyAnalysisAreas();
            } else {
                deferred = new Deferred();
                ungroupedFeatures.forEach(function (f) {
                    promises.push(f.setAnalysisArea(f.name())); // self._addFeatureToAnalysisArea(f, f.name()));
                });
                all(promises).then(
                    function () {
                        self._deleteEmptyAnalysisAreas().then(function () {
                            deferred.resolve();
                        }, function (deleteError) {
                            window.setTimeout(function () {
                                deferred.reject(deleteError);
                            }, 10);

                        });
                    },
                    function (e) {
                        window.setTimeout(function () {
                            deferred.reject(e);
                        }, 10);
                    }
                );
            }

            return deferred;
        },

        _deleteEmptyAnalysisAreas: function () {
            var deferred = new Deferred(),
                emptyAnalysisAreas = this.analysisAreas().filter(function (aa) {
                    return aa.features().length === 0;
                });

            if (emptyAnalysisAreas.length > 0) {
                var ids = emptyAnalysisAreas.map(function (aa) {
                    return aa.id();
                });
                //eslint-disable-next-line no-undef
                MapDAO.deleteAoiAnalysisAreas(ids, this.currentAuthority().orgUserId, {
                    callback: function () {
                        deferred.resolve();
                    },
                    errorHandler: function (err) {
                        deferred.reject(err);
                    }

                });
            } else {
                window.setTimeout(function () {
                    deferred.resolve();
                }, 10);
            }
            return deferred;
        },

        /**
         * Saves analsysis areas and updates features with references to their analysis areas.
         * @returns {Deferred} a Deferred object to be resolved when the whole chain of events is completed.
         **/
        saveAnalysisAreaBuffers: function () {
            var self = this,
                //featureSavePromises = [],
                deferred = new Deferred();
            this._buildAnalysisAreaBufferEdits().then(function (edits) {
                if (edits.adds.length || edits.updates.length || edits.deletes.length) {
                    self.loadingOverlay.show('Saving analysis area buffers');
                    self.layers.analysisAreaBuffer.applyEdits(edits.adds, edits.updates, edits.deletes, function () {
                        self.loadingOverlay.hide();
                        deferred.resolve();
                    }, function (err) {
                        self.loadingOverlay.hide();
                        deferred.reject(err);
                    });
                } else {
                    //nothing to save
                    deferred.resolve();
                }
            });
            return deferred;
        },

        saveAnalysisOptions: function () {
            var self = this,
                deferred = new Deferred();

            this.loadingOverlay.show('Starting analysis...');
            //TODO this also needs to do the intersection with regions and roads
            //something currently done by gisEditor; could use the QUERY_REGIONS service for the former, and RCI? for roads.
            //eslint-disable-next-line no-undef
            MapDAO.saveAoiAnalysisOptions(this.toJS(),
                {
                    callback: function (result) {
                        self.loadingOverlay.hide();
                        if (result === 'ok') {
                            deferred.resolve();
                        } else {
                            topic.publish('growler/growlError', result);
                            deferred.reject(result);
                        }
                    },
                    errorHandler: function (err) {
                        self.loadingOverlay.hide();
                        topic.publish('growler/growlError', err);
                        deferred.reject(err);
                    }
                });
            return deferred;
        },

        saveAnalysisOptionsAndShowProgress: function () {
            var self = this;

            this.saveAnalysisOptions().then(function () {
                self.showAnalysisProgress();
            });
        },

        checkAnalysisProgress: function () {
            var self = this;
            self.progressErrorCount = self.progressErrorCount || 0;
            //eslint-disable-next-line no-undef
            MapDAO.getAoiAnalysisProgress(this.aoiId(), {
                callback: function (p) {
                    //a little post-processing
                    //Note: don't think you can simplify this by just directly referring to the DWR reply, it has to be cloned to a new object
                    //because DWR takes short-cuts, and there will be a common object like "s0={code: 1, text: 'whatever'}" re-used for each progress
                    var gis = {
                            code: p.progressGIS.code,
                            text: p.progressGIS.text,
                            running: p.progressGIS.running,
                            title: 'Study Area Report',
                            href: '/est/analysis/ReportOptions.do?aoiId=' + self.aoiId()
                        },
                        hcm = {
                            code: p.progressHCM.code,
                            text: p.progressHCM.text,
                            running: p.progressHCM.running,
                            title: 'Hardcopy Maps',
                            href: '/est/hardCopyMaps.jsp?aoiId=' + self.aoiId()
                        },
                        cci = {
                            code: p.progressCCI.code,
                            text: p.progressCCI.text,
                            running: p.progressCCI.running,
                            title: 'Sociocultural Data Report',
                            href: null //links are by feature, handled in sidebar.html layout
                        },
                        crd = {
                            code: p.progressCRD.code,
                            text: p.progressCRD.text,
                            running: p.progressCRD.running,
                            title: 'Cultural Resources Data Report',
                            href: '/est/analysis/CachedGisReport.do?aoiId=' + self.aoiId() + '&issueId=102&crdReport=true'
                        },
                        ert = {
                            code: p.progressERT.code,
                            text: p.progressERT.text,
                            running: p.progressERT.running,
                            title: 'Emergency Response Report',
                            href: 'todo'
                        };

                    if (gis.code === 4 && p.completedGisCount > 1) {
                        gis.text = 'Creating PDF ' + (p.completedGisCount - 1) + ' of 22';
                    }

                    if (hcm.code === 3 && p.completedHcmCount > 1) {
                        hcm.text = 'Creating Map ' + (p.completedHcmCount - 1) + ' of 22';
                    }

                    self.progressGIS(gis);
                    self.progressCCI(cci);
                    self.progressHCM(hcm);
                    self.progressCRD(crd);
                    self.progressERT(ert);

                    self.analysisRunning(p.running);

                    if (p.running) {
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

        //todo remove
        clearAoiPreview: function () {
            var self = this;
            this.aois().forEach(function (a) {
                if (a.layers) {
                    self.clearAoiLayers(a);
                }
                a.previewed(false);
            });
        },

        unloadCurrentAoi: function () {
            this.features.removeAll();
            this.analysisAreas.removeAll();
            this.clearAoiLayers();
            this.bufferGraphics.clear();
            this.extractGraphics.clear();
            this.deactivateExtract(); //deactivates draw tool too
            this.edit.deactivate();
            this.undoManager.clearUndo();
            this.undoManager.clearRedo();
            this.mode('default');
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
                var url = projects.aoiLayers[layerName],
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
                var unionOfExtents = null;
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

        loadAoi: function (id, showResults) {
            var self = this;
            //get from server
            //eslint-disable-next-line no-undef

            this.clearAoiPreview();

            this.loadingOverlay.show('Loading AOI');
            //eslint-disable-next-line no-undef
            MapDAO.getAoiModel(id, {
                callback: function (aoi) {
                    self.loadingOverlay.hide();
                    if (aoi) {
                        self.loadAoiModel(aoi);
                        if (showResults) {
                            self.showAnalysisProgress();
                        } else {
                            self.mode('editName');
                        }
                    } else {
                        topic.publish('viewer/handleError', {
                            source: 'AoiEditor.loadAoi',
                            error: 'Invalid AOI ID'
                        });
                    }
                },
                errorHandler: function (message, exception) {
                    self.loadingOverlay.hide();
                    topic.publish('viewer/handleError', {
                        source: 'AoiEditor.loadAoi',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                    });
                }
            });

        },

        lastEditAt: null, //tracks last time an edit was made, used for timeout-based updating of buffers, starting immediately after draw-complete, or 3 seconds after vertext-drag-end

        postCreate: function () {
            this.inherited(arguments);
            //todo post create code goes here
            //this._createGraphicLayers();

        },

        startup: function () {
            this.inherited(arguments);

            this.loadingOverlay = new LoadingOverlay(); //this can be defined at the root level, but...
            
            this.bufferUnitArray = [this.bufferUnits.feet, this.bufferUnits.miles, this.bufferUnits.meters, this.bufferUnits.kilometers]; //for binding to drop-down

            //tracks the most recently entered buffer distance and units
            //todo store in LSO?
            this.lastBufferDistance = 100;
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
            }, 'addressToPoint');
            this.addressToPointSearch.startup(); //todo maybe define this when the dialog opens?

            var self = this; //todo move to top or find some other way to maintain context

            on(this.addressToPointSearch, 'select-result', function (e) {
                self.map.setExtent(e.result.extent);
                e.result.feature.name = e.result.name;
                var feature = self._constructFeature(e.result.feature);
                self._addFeatureToLayer(feature, true);
                self.newFeatureDialog.hide();
            });

        },

        //save to server
        _addFeatureToLayer: function (feature, addToStack) {
            var self = this,
                layer = self.layers[feature.type],
                deferred = new Deferred(),
                operation = new FeatureOperations.Add(feature);
            //new Add({
            //    featureLayer: layer,
            //    addedGraphics: [feature.graphic]
            //});
            layer.applyEdits([feature.graphic], null, null, function (addResult) {
                if (!addResult || addResult.length === 0) {
                    topic.publish('growler/growlError', 'No response from applyEdits call.');
                    deferred.reject('No response from applyEdits call.');
                    return;
                } else if (addResult[0].error) {
                    topic.publish('growler/growlError', addResult[0].error);
                    deferred.reject(addResult[0].error);
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
                deferred.resolve(feature);

            }, function (err) {
                //todo
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
         * Constructs an AOI point from the lat/long value entered in latLongValidationTextBox
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
                //hide buffers
                self.bufferGraphics.setVisibility(false);

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
                //hide buffers
                self.bufferGraphics.setVisibility(false);
            };

            self.deactivateDrawTool = function () {
                //pass the word onto the draw tool
                self.draw.deactivate();
                self.drawMode(null);
                //restore buffers
                self.bufferGraphics.setVisibility(true);
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
                                    self.bufferFeature(currentFeature);
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
                                            sourceFeature: currentFeature, //for copying buffer distance and unit properties
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
                        feature.applyUpdate();

                    }
                }, delay);
            };

            this.edit.on('vertex-move-stop', this.vertexChanged, this);
            this.edit.on('vertex-delete', function (evt) {
                //hide buffers
                self.bufferGraphics.setVisibility(false);
                //update last changed
                self.lastEditAt = new Date();
                //update feature and buffer
                self.vertexChanged(evt);
            });
            this.edit.on('vertex-first-move', function () {
                //hide buffers
                self.bufferGraphics.setVisibility(false);
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
            this.edit.on('graphic-move-start', function () {
                //hide buffers
                self.bufferGraphics.setVisibility(false);
            });
            this.edit.on('graphic-move-stop', function (evt) {
                self.bufferFeature(evt.graphic.feature);
                //save to database
                evt.graphic.feature.applyUpdate();
            });

            //TODO we can also support move and scaling, etc.
        },

        //construct analysisAreas for features that don't already have one, using the feature's name as the analysisArea name
        //TODO this needs to be reworked
        _buildAnalysisAreasFromFeatures: function () {
            this.features().forEach(function (f) {
                if (!f.analysisArea()) {
                    this._addFeatureToAnalysisArea(f, f.name());
                }
            }, this);
        },

        /**
         * Builds the adds, edits and deletes arrays of analysisAreaBuffers; returns a deferred object that, when resolved, passes the 
         * arrays, ready for applyEdits. Makes external calls to geometryService to simplify and union. Only call this after syncing up 
         * the analysisAreas with AoiAnalysisAreas (T_PROJECT_ALT_AOI) records.
         * @returns {Deferred} Deferred object, which, when resolved, will pass in a result with adds, updates and deletes array properties.
         */
        _buildAnalysisAreaBufferEdits: function () {
            var self = this;
            //build analysis areas from features that don't already have one
            //(this is the default, typical arrangement, one feature = one analysisArea = one analysisAreaBuffer, 
            // unless user chooses to group features, in which case many features > one analysisArea = one analysisAreaBuffer)
            //and in the future we may have multiple analysisAreaBuffers per analysisArea.
            this._buildAnalysisAreasFromFeatures(); //TODO not needed any more, this happens upstream in saveAnalysisAreas
            this.loadingOverlay.show('Constructing analysis area buffers...');

            var analysisAreaBuffers = this.layers.analysisAreaBuffer.graphics,
                analysisAreaModels = this.analysisAreas(), //analysis areas observable defined in knockoutify
                result = {
                    adds: [],
                    updates: [],
                    deletes: analysisAreaBuffers.filter(function (f) {
                        return !this.getAnalysisAreaModel(f.attributes.FK_PROJECT_ALT);
                    }, this) //analysisAreaBuffer features that don't currently have a match in named analysis areas
                },
                deferred = new Deferred(), //the overall deferred to be resolved when we've got the edits all built
                buildPromises = [];

            //loop through models to add or update
            analysisAreaModels.forEach(function (analysisAreaModel) {
                var buildPromise = new Deferred(),
                    geometries = analysisAreaModel.features().map(function (f) {
                        return f.buffer ? f.buffer.geometry : f.graphic.geometry;
                    });

                buildPromises.push(buildPromise);

                //simplify
                //eslint-disable-next-line no-undef
                esriConfig.defaults.geometryService.simplify(geometries).then(function (simplifiedGeometries) {
                    //Note, just a union request would do the job, but maybe this is useful for multiple buffers?
                    var params = new BufferParameters();

                    params.distances = [1]; //TODO when we support multiple buffer distances this will need to change
                    params.outSpatialReference = self.map.spatialReference; //todo this should maybe be Albers
                    params.unit = 9002;
                    params.geodesic = true;
                    params.geometries = simplifiedGeometries;
                    params.unionResults = true;

                    //eslint-disable-next-line no-undef
                    esriConfig.defaults.geometryService.buffer(params,
                        function (bufferedGeometries) {
                            //search for existing feature by id and buffer distance
                            var analysisAreaFeature = self.getAnalysisAreaBuffer(analysisAreaModel.id(), 1); //TODO when we support multiple buffer distances this will need to change
                            if (analysisAreaFeature) {
                                //update
                                result.updates.push(analysisAreaFeature);
                                analysisAreaFeature.geometry = bufferedGeometries[0]; //TODO when we support multiple buffer distances this will need to change
                                analysisAreaFeature.attributes.FK_PRJ_ALT = analysisAreaModel.altNumber; //this probably doesn't change
                                analysisAreaFeature.attributes.ACRES = 0; // TODO if the analysis routines aren't setting this, make a separate call to a geometry service to get the acres
                                buildPromise.resolve(analysisAreaFeature);
                            } else {
                                //add
                                analysisAreaFeature = new Graphic(bufferedGeometries[0]); //todo if we can create multiple buffers in one go with different buffer distances, will need to foreach through those
                                analysisAreaFeature.attributes = {
                                    OBJECTID: null,
                                    BUFFER_DISTANCE: 1, //TODO when we support multiple buffer distances this will need to change
                                    FEATURE_NAME: analysisAreaModel.name(),
                                    FK_PROJECT: self.aoiId(),
                                    FK_PROJECT_ALT: analysisAreaModel.id(),
                                    FK_PRJ_ALT: analysisAreaModel.altNumber,
                                    ACRES: 0 // TODO if the analysis routines aren't setting this, make a separate call to a geometry service to get the acres
                                };
                                result.adds.push(analysisAreaFeature);
                                buildPromise.resolve(analysisAreaFeature);
                            }
                        },
                        function (err) {
                            buildPromise.reject(err);
                        }
                    );
                }, function (e) {
                    deferred.reject(e);
                });
            }); // end loop through analysisAreaModels


            //the overall deferred for this function is resolved when all the deferreds to build analyisAreas are resolved
            all(buildPromises).then(function () {
                self.loadingOverlay.hide();
                deferred.resolve(result);
            }, function (err) {
                self.loadingOverlay.hide();
                deferred.reject(err);
            });

            return deferred;

        },

        //gets an analysis area model from the analysisAreas observable array by id
        getAnalysisAreaModel: function (id) {
            return this.analysisAreas().find(function (m) {
                return m.id() === id;
            });
        },

        //gets an analysis area feature from the analysis areas feature layer by alt ID and buffer distance
        getAnalysisAreaBuffer: function (id, bufferDistance) {
            return this.layers.analysisAreaBuffer.graphics.find(function (f) {
                return f.attributes.FK_PROJECT_ALT === id && f.attributes.BUFFER_DISTANCE === bufferDistance;
            });
        },

        /**
         * Loads values into observable properties from the referenced AOI, then loads AOI features and analysis areas.
         * @param {any} aoi An AOI model, or null to create a new AOI model.
         * @returns {Deferred} a Deferred object created by _loadAoiFeatures
         */
        loadAoiModel: function (aoi) {
            //shouldn't need to do this, because the unload method also does it, but just to be safe
            this.undoManager.clearUndo();
            this.undoManager.clearRedo();

            aoi = aoi || {
                id: -1 /*signifies new*/,
                name: null,
                projectTypeId: null,
                expirationDate: null,
                orgUserId: null,
                description: null,
                features: [],
                analysisAreas: [],
                analysisRunning: false,
                //TODO do we want to default these to something other than all-false?
                //TODO if user has ERT access only, set emergencyResponseReportRequested = true, disable other options in UI
                studyAreaReportRequested: false,
                socioCulturalDataReportRequested: false,
                hardCopyMapsRequested: false,
                culturalResourcesDataReportRequested: false,
                emergencyResponseReportRequested: false
            };

            this.aoiId(aoi.id);

            if (!aoi.expirationDate) {
                //default date is current date + 30 days TODO confirm this
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

            this.name(aoi.name);
            this.description(aoi.description);
            this.projectTypeId(aoi.projectTypeId);
            this.expirationDate(aoi.expirationDate);

            var analysisAreaModels = [];
            aoi.analysisAreas.forEach(function (aoiAnalysisArea) {
                analysisAreaModels.push(new this.AnalysisArea(aoiAnalysisArea)); //convert to full KO model of an analysis area
            }, this);
            this.analysisAreas(analysisAreaModels);

            this.analysisRunning(aoi.analysisRunning);

            this.studyAreaReportRequested(aoi.studyAreaReportRequested);
            this.socioCulturalDataReportRequested(aoi.socioCulturalDataReportRequested);
            this.hardCopyMapsRequested(aoi.hardCopyMapsRequested);
            this.culturalResourcesDataReportRequested(aoi.culturalResourcesDataReportRequested);
            this.emergencyResponseReportRequested(aoi.emergencyResponseReportRequested);

            this._updateAoiCache();

            return this._loadAoiFeatures();
        },

        /**
         * Clears AOI layers from the map.
         * @param {any} layerOwner Not currently used, was part of the abandoned "preview" function.
         * @returns {void}
         */
        clearAoiLayers: function (layerOwner) {
            layerOwner = layerOwner || this;
            //remove existing layers from the map
            if (!layerOwner.layers) {
                return;
            }
            if (layerOwner.layers.analysisAreaBuffer) {
                this.map.removeLayer(layerOwner.layers.analysisAreaBuffer);
                //delete layerOwner.layers.analysisAreaBuffer;
            }
            this.featureTypes.forEach(function (layerName) {
                if (layerOwner.layers[layerName]) {
                    this.map.removeLayer(layerOwner.layers[layerName]);
                    //delete this.layers[layerName];
                }
            }, this);

        },

        /**
         * Gets the next number for auto-named features (e.g. "Feature 1", "Feature 2", ... "Feature N" or "Extracted Line 1" ...)
         * @returns {Number} the next number in the sequence of auto-named features.
         */
        _nextFeatureNumber: function () {
            var n = 0,
                rx = /(Feature|Extracted Line) (\d+)/;
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
            return n;
        },

        _loadAoiFeatures: function () {
            var self = this, //keeps a reference to the aoiEditor model
                loadPromises = []; //collection of promises resolved on update-end of the three editable layers (point, polyline and polygon), zooms to unioned extent when done

            this.loadingOverlay.show('Loading AOI Analysis Areas');

            this.clearAoiLayers();

            //get analysisAreaBuffers first TODO this isn't really a necessary step anymore, and we can include this in the same loop
            //through self.featureTypes below (loop through self.layers instead)
            self.layers.analysisAreaBuffer = new FeatureLayer(projects.aoiLayers.analysisAreaBuffer, {
                id: 'aoi_analysisArea_' + this.aoiId(),
                outFields: '*',
                definitionExpression: 'FK_PROJECT = ' + this.aoiId(),
                //note: can't be invisble, and must be loaded in map for update-end to work.
                //visible: false, //not actually loaded in map, so don't need to make invisible
                mode: FeatureLayer.MODE_SNAPSHOT
            });

            on.once(self.layers.analysisAreaBuffer, 'update-end', function () {
                if (self.aoiId()) {
                    self.loadingOverlay.show('Loading AOI Features');
                } else {
                    self.LoadingOverlay.show('Setting up AOI layers');
                }
                //we now have self.layers.analysisAreaBuffer.graphics as array of the analysis areas as GIS features
                //get the rest of the features and build relationships
                self.layers.analysisAreaBuffer.setVisibility(false);
                self.featureTypes.forEach(function (layerName) {
                    var url = projects.aoiLayers[layerName],
                        deferred = new Deferred(),
                        layer = new FeatureLayer(url,
                            {
                                id: 'aoi_' + layerName + '_' + self.aoiId(),
                                outFields: '*',
                                definitionExpression: 'FK_PROJECT = ' + self.aoiId(),
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
                    self.extent = unionOfExtents; //facilitates zooming to the aoi
                    self.zoomTo();
                    self.features(featuresKo);
                    //TODO there has to be a better way than this hack:
                    //self.dummyForceRecompute(new Date());

                }, function (err) {
                    self.loadingOverlay.hide();
                    topic.publish('growler/growlError', 'Error loading AOI features: ' + err);
                });

            }, function (err2) {
                self.loadingOverlay.hide();
                topic.publish('growler/growlError', 'Error loading AOI analysis areas: ' + err2);
            });

            self.map.addLayer(self.layers.analysisAreaBuffer);
        },

        //Constructs a feature either from a draw-complete event, cut operation, or when loading from server
        //It does not add the feature to the currentAoi features array, nor add it to a layer.
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
                feature.bufferDistance = featureOrEvent.attributes.BUFFER_DISTANCE || self.lastBufferDistance; //default in case null for old data
                feature.bufferUnit = (featureOrEvent.attributes.BUFFER_DISTANCE_UNITS ? self.bufferUnits[featureOrEvent.attributes.BUFFER_DISTANCE_UNITS.toLowerCase()] : null) || self.lastUnit; //default in case null; also converts to unit object
                feature.graphic = featureOrEvent;
            } else {
                //featureOrEvent is the event argument for on-draw-complete (either from draw or cut operation),
                //or from address-auto-complete, which we manufacture as a object with a name property
                feature.name = featureOrEvent.name || 'Feature ' + self._nextFeatureNumber();
                feature.bufferDistance = featureOrEvent.sourceFeature ? featureOrEvent.sourceFeature.bufferDistance() : self.lastBufferDistance;
                feature.bufferUnit = featureOrEvent.sourceFeature ? featureOrEvent.sourceFeature.bufferUnit() : self.lastUnit;
                feature.graphic = new Graphic(featureOrEvent.geometry, null, {
                    OBJECTID: null,
                    BUFFER_DISTANCE: feature.bufferDistance,
                    BUFFER_DISTANCE_UNITS: feature.bufferUnit.name,
                    FEATURE_NAME: feature.name,
                    FK_PROJECT: self.aoiId()
                });
            }

            //back-reference, supports clicking map or model
            feature.graphic.feature = feature;

            /* eslint-disable no-undef */
            feature.name = ko.observable(feature.name);
            feature.visible = ko.observable(true);
            feature.visible.subscribe(function (visible) {
                feature.graphic.visible = visible;
                if (feature.buffer) {
                    feature.buffer.visible = visible;
                }
                feature.graphic.getLayer().redraw();
                self.bufferGraphics.redraw();
            }, 'change');
            feature.bufferDistance = ko.observable(feature.bufferDistance);
            feature.bufferUnit = ko.observable(feature.bufferUnit);
            //for display
            feature.bufferText = ko.pureComputed(function () {
                if (feature.bufferDistance() > 0 && feature.bufferUnit()) {
                    return feature.bufferDistance() + ' ' + feature.bufferUnit().abbreviation;
                }
                return '-';
            });
            feature.bufferTextLong = ko.pureComputed(function () {
                if (feature.bufferDistance() > 0 && feature.bufferUnit()) {
                    return feature.bufferDistance() + ' ' + feature.bufferUnit().name;
                }
                return '-';
            });

            //function to assign the feature to an analysisArea
            feature.setAnalysisArea = function (analysisArea) {
                var deferred = new Deferred();

                //handle null analysis area
                if (!analysisArea) {
                    if (feature.graphic.attributes.FK_PROJECT_ALT) { //currently has an analysisArea assigned, so nullify it
                        feature.analysisArea(null);
                        feature.graphics.FK_PROJECT_ALT = null;
                        feature.applyUpdate().then(function () {
                            deferred.resolve();
                        }, function (e) {
                            deferred.reject(e);
                        });
                    } else {
                        deferred.resolve();
                    }
                    return deferred;
                }

                if (typeof analysisArea === 'string' || typeof analysisArea === 'number') {
                    //first check to see if it exists, using the ID or name
                    var existing = self.analysisAreas().find(function (ag) {
                        return ag.name() === analysisArea || ag.id() === analysisArea;
                    });
                    if (existing) {
                        return this.setAnalysisArea(existing); //call this method with the existing object
                    }

                    //construct a new analysis area
                    analysisArea = new self.AnalysisArea(analysisArea);
                    //figure out what altNumber to give it
                    self.analysisAreas().forEach(function (aa) {
                        if (aa.altNumber > analysisArea.altNumber) {
                            analysisArea.altNumber = aa.altNumber;
                        }
                    });
                    analysisArea.altNumber++;
                    
                    //do this here, before calling saveAoiAnalysisArea, otherwise there's a race condition
                    //resulting in the next analysisArea getting the same altNumber
                    self.analysisAreas.push(analysisArea);

                    self.loadingOverlay.show('Saving new analysis area to database');

                    var analysisAreaJS = analysisArea.toJS();

                    //save to non-spatial table
                    //eslint-disable-next-line no-undef
                    MapDAO.saveAoiAnalysisArea(self.aoiId(), self.currentAuthority().orgUserId, analysisAreaJS, {
                        callback: function (analysisAreaReply) {
                            self.loadingOverlay.hide();
                            analysisArea.id(analysisAreaReply.id); //the only thing that could possibly change after saving
                            feature.analysisArea(analysisArea);
                            //self.dummyForceRecompute(new Date());
                            feature.graphic.attributes.FK_PROJECT_ALT = analysisAreaReply.id;
                            feature.applyUpdate().then(function () {
                                deferred.resolve();
                            }, function (e) {
                                deferred.reject(e);
                            });
                        },
                        errorHandler: function (message, exception) {
                            self.loadingOverlay.hide();
                            topic.publish('viewer/handleError', {
                                source: 'AoiEditor.addFeatureToAnalysisArea',
                                error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                            });
                            deferred.reject();
                        }
                    });
                } else {
                    //method is called with existing analysis area as an object
                    feature.analysisArea(analysisArea);
                    //self.dummyForceRecompute(new Date());

                    if (feature.graphic.attributes.FK_PROJECT_ALT === analysisArea.id()) {
                        //happens during loading and building our model, no update required
                        deferred.resolve();
                    } else {
                        feature.graphic.attributes.FK_PROJECT_ALT = analysisArea.id();
                        deferred = feature.applyUpdate();
                    }
                }

                return deferred;
            };

            feature.analysisArea = ko.observable(feature.analysisArea);

            feature.analysisAreaName = ko.pureComputed({
                read: function () {
                    if (feature.analysisArea()) {
                        return feature.analysisArea().name();
                    }
                    return feature.name();
                },
                write: function (analysisAreaName) {
                    feature.setAnalysisArea(analysisAreaName); //also sets it to null if analysisAreaName is null
                }
            });

            //tie to analysis area record; shouldn't result in a save of the feature
            feature.setAnalysisArea(feature.graphic.attributes.FK_PROJECT_ALT);

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

            feature.bufferDistance.subscribe(function (newValue) {
                self.bufferFeature(feature);
                feature.graphic.attributes.BUFFER_DISTANCE = newValue;
                if (newValue) {
                    self.lastBufferDistance = newValue;
                }
                feature.applyUpdate();
            });

            feature.bufferUnit.subscribe(function (newValue) {
                self.bufferFeature(feature);
                feature.graphic.attributes.BUFFER_DISTANCE_UNITS = newValue.name;
                if (newValue) {
                    self.lastUnit = newValue;
                }
                feature.applyUpdate();
            });

            //using this in lieu of ko deferred for simpler control, we really only want to prevent applyUpdate in the limited
            //circumstance of restoring values after undo/redo
            feature.deferApplyEdits = false; //set to true when updating name, bufferDistance, bufferUnit, and analysisArea in series in the restore method

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
                    buffer = feature.buffer,
                    operation = new FeatureOperations.Delete(feature);
                self.deactivateExtract(); //deactivates draw tool too
                self.edit.deactivate();
                if (buffer) {
                    self.bufferGraphics.remove(buffer);
                }
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
                    feature.bufferDistance(preUpdateCache.bufferDistance);
                    feature.bufferUnit(preUpdateCache.bufferUnit);
                    //feature.analysisArea(feature.preUpdate.analysisArea); //todo probably needs to be the addFeatureToAnalysisArea method
                    feature.deferApplyEdits = false;
                    feature.applyUpdate(false).then(function () {
                        self.bufferFeature(feature);
                    });
                } else {
                    //means we're restoring from deleted
                    self._addFeatureToLayer(feature, false).then(function () {
                        self.bufferFeature(feature);
                    });
                }
            };

            //cache original, pre-update, to support undo
            feature.cachePreUpdate = function () {
                feature.preUpdate = {
                    graphic: feature.graphic.clone(),
                    name: feature.name(),
                    bufferDistance: feature.bufferDistance(),
                    bufferUnit: feature.bufferUnit(),
                    analysisArea: feature.analysisArea()
                };
            };
            feature.cachePreUpdate();

            /* eslint-enable no-undef */
            //buffer it
            self.bufferFeature(feature);

            return feature;
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
                            self.loadAoi(aoi.id, false);
                            self.openAoiDialog.hide();
                        };
                        aoi.loadResults = function () {
                            self.loadAoi(aoi.id, true);
                            self.openAoiDialog.hide();
                        };
                        //todo fix or dekruft aoi preview
                        aoi.preview = function () {
                            self.previewAoi(aoi);
                        };
                        aoi.previewed = ko.observable(false); //eslint-disable-line no-undef
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
                        params.geodesic = true;
                        params.geometries = simplifiedGeometries; //We're only doing one at a time, but buffer expects an array. 

                        //eslint-disable-next-line no-undef
                        esriConfig.defaults.geometryService.buffer(params,
                            function (bufferedGeometries) {
                                //we don't really need forEach here, we just have one...for now
                                //bufferedGeometries.forEach(function (bufferedGeometry) {
                                var bufferedGeometry = bufferedGeometries[0],
                                    graphic = new Graphic(bufferedGeometry);
                                graphic.feature = feature; //cross-reference from buffer is to the feature it is a buffer of
                                feature.buffer = graphic;
                                self.bufferGraphics.add(graphic);
                                //show buffers
                                self.bufferGraphics.setVisibility(true);
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

        zoomTo: function () {
            if (this.extent) {
                //todo this fails if there's just one point. See zoomToFeature for example, may need to centerAndZoom; in theory even if there's just one point, there will be a buffer of that point in S_AOI, so  might not be an issue
                topic.publish('layerLoader/zoomToExtent', this.extent.expand(1.5));
            } else if (this.id && this.id > 0) { //only warn if loading an existing AOI, obviously a new one won't have an extent.
                topic.publish('growler/growl', 'Area of Interest has no features');
            }
        },

        //eslint-disable-next-line max-statements
        _knockoutifyAoiEditor: function () {
            var self = this;
            /* eslint-disable no-undef */
            //basic properties
            this.name = ko.observable();
            this.description = ko.observable();
            this.projectTypeId = ko.observable();
            this.projectTypeSelect = new FilteringSelect({
                store: new Memory({
                    data: this.projectTypes
                }),
                onChange: function (newValue) {
                    self.projectTypeId(newValue);
                },
                style: 'width: 100%'
            }, dom.byId('projectTypeDojo'));
            this.projectTypeSelect.startup();
            //hack because we can't data-bind a filteringselect
            this.projectTypeId.subscribe(function (newValue) {
                self.projectTypeSelect.set('value', newValue);
            });

            this.analysisRunning = ko.observable();

            this.progressCCI = ko.observable({code: 2, text: 'Checking...', running: true, title: '', href: null});
            this.progressGIS = ko.observable({code: 2, text: 'Checking...', running: true, completedGisCount: 0, title: 'Study Area Report', href: null});
            this.progressHCM = ko.observable({code: 2, text: 'Checking...', running: true, completedHcmCount: 0, title: '', href: null});
            this.progressCRD = ko.observable({code: 2, text: 'Checking...', running: true, title: '', href: null});
            this.progressERT = ko.observable({code: 2, text: 'Checking...', running: true, title: '', href: null});

            this.analysisRunning.subscribe(function (newValue) {
                this.addFeatureButton.setDisabled(newValue);
            }, this);

            this.expirationDate = ko.observable();

            //all of the features, as models, regardless of geometry, distinct from, but related to, the features in layers.point.graphics, layers.polyline.graphics, and layers.polygon.graphics
            this.features = ko.observableArray();
            //sorted list of features
            this.featureSortOption = ko.observable('name'); //name, type, or analysisArea
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
            this.sortFeaturesByAnalysisArea = function () {
                this.sortFeaturesBy('analysisArea');
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
                    } else if (sortOption === 'analysisArea') {
                        aVal = a.analysisArea() ? a.analysisArea().name : a.name();
                        bVal = b.analysisArea() ? b.analysisArea().name : b.name();
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
                    if (self.mode() === 'editFeatures' && !self.analysisRunning()) {
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
                    if (feature.buffer) {
                        feature.buffer.visible = feature.graphic.visible;
                    }
                }, this);
                this.layers.point.redraw();
                this.layers.polyline.redraw();
                this.layers.polygon.redraw();
                this.bufferGraphics.redraw();
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

            //options for opening existing AOI
            this.aois = ko.observableArray(); //the list of aois loaded into the open-aoi dialog, not the full aoi model.
            this.filterOption = ko.observable('my'); //my or all
            //this.currentAuthority is synced with the global observable when the widgets start up
            this.includeExpired = ko.observable(false); //if true, expired AOIs are listed; any other value or null only non-expired AOIs are shown.

            this.aoiSortOption = ko.observable('name'); //name, type, expirationDate, lastEditedDate
            //functions for toggling sort
            this.sortAoisBy = function (option) {
                if (this.aoiSortOption() === option) {
                    this.aoiSortDescending(!this.aoiSortDescending());
                } else {
                    this.aoiSortOption(option);
                    this.aoiSortDescending(false);
                }
            };
            this.sortAoisByName = function () {
                this.sortAoisBy('name');
            };
            this.sortAoisByType = function () {
                this.sortAoisBy('typeName');
            };
            this.sortAoisByExpirationDate = function () {
                this.sortAoisBy('expirationDate');
            };
            this.sortAoisByModDate = function () {
                this.sortAoisBy('modDate');
            };
            this.aoiSortDescending = ko.observable(false);
            this.sortedAois = ko.pureComputed(function () {
                var sortOption = this.aoiSortOption() || 'name', //default sort by name
                    sortDescending = this.aoiSortDescending(); //default sort ascending
                return this.aois().sort(function (a, b) {
                    var aVal = a[sortOption],
                        bVal = b[sortOption],
                        comp = (aVal < bVal) ? -1 : (aVal > bVal) ? 1 : 0;
                    if (sortOption !== 'name' && comp === 0) {
                        //sort by name to break ties
                        aVal = a.name;
                        bVal = b.name;
                        comp = (aVal < bVal) ? -1 : (aVal > bVal) ? 1 : 0;
                    }
                    //flip direction for descending
                    if (sortDescending) {
                        comp *= -1;
                    }

                    return comp;
                });
            }, this);

            //if user is authorized, and working on a new AOI, we show a drop-down for selecting the orgUser identity
            this.showAuthoritySelection = ko.pureComputed(function () {
                return !this.aoiId() && this.authorities.length > 1;
            }, this);

            //when user changes filter option or current authority, re-list the aois
            this.filterOption.subscribe(this.listAois, this);
            this.currentAuthority.subscribe(this.listAois, this);
            this.includeExpired.subscribe(this.listAois, this);

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

            //this.dummyForceRecompute = ko.observable();

            //constructor for analysisArea model, can be an AoiAnalysisArea from DWR load, or just a string to use as the name of a new analysis area.
            this.AnalysisArea = function (analysisArea) {
                //"this" is now the context of an instance of an analysis area; self continues to be the root model
                this.id = ko.observable(0); //assigned >0 by server after it is saved
                this.name = ko.observable();
                this.altNumber = 0; //assigned after it is saved; relatively unimportant at this point
                this.features = ko.pureComputed(function () {
                    //self.dummyForceRecompute();
                    return self.features().filter(function (f) {
                        return f.analysisArea() === this;
                    }, this);
                }, this);
                if (analysisArea) {
                    if (typeof analysisArea === 'string') {
                        this.name(analysisArea);
                        //id and altNumber are set when it is saved
                    } else {
                        //only other supported method is passing in an analysisArea (T_PROJECT_ALT_AOI) from the database
                        this.name(analysisArea.name);
                        this.id(analysisArea.id);
                        this.altNumber = analysisArea.altNumber;
                    }
                }
                this.toJS = function () {
                    return {
                        id: this.id(),
                        altNumber: this.altNumber,
                        name: this.name()
                    };
                };
            };

            this.analysisAreas = ko.observableArray(); //formerly known as alternatives, distinct from analysisAreaBuffers (features in S_AOI)

            this.analysisAreaNames = ko.pureComputed(function () {
                //get names from analysis areas via features. The analysisAreaName computed inserts the feature name if no analysis area is defined.
                var analysisAreaNames = this.features().map(function (f) {
                    return f.analysisAreaName();
                });
                //todo sort

                return analysisAreaNames;
            }, this);

            //analysis options
            this.studyAreaReportRequested = ko.observable();
            this.socioCulturalDataReportRequested = ko.observable();
            this.hardCopyMapsRequested = ko.observable();
            this.culturalResourcesDataReportRequested = ko.observable();
            this.emergencyResponseReportRequested = ko.observable();

            //apply knockout bindings to sidebar
            ko.applyBindings(this, dom.byId('aoiEditorSidebar'));
            //apply knockout bindings to open AOI dialog
            ko.applyBindings(this, dom.byId('openAoiDialog'));
            //apply knockout bindings to new feature dialog
            ko.applyBindings(this, dom.byId('newFeatureDijit'));

            //not using knockout for binding autocomplete for address, but sticking this function here
            //to keep things tidy.
            //jQuery('#addressToPoint').autocomplete({
            //    /**
            //     * jQuery Autocomplete source function for auto-completing addresses and ultimately getting coordinate.
            //     * @param {string} request the term user has entered into the field
            //     * @param {function} response a reference to the callback function to invoke after getting a response from autocomplete
            //     * @returns {void}
            //     */
            //    source: function (request, response) {
            //        self.getLocatorSuggestions(request.term)
            //            .then(
            //                function (suggestions) {
            //                    //post-process to array of strings, pulling the "text" property out of each the suggestions
            //                    var addresses = suggestions.map(function (suggestion) {
            //                        return suggestion.text;
            //                    });
            //                    response(addresses); //jQuery auto-complete takes over from here
            //                },
            //                function (err) {
            //                    topic.publish('growler/growlError', 'Error getting address: ' + err);
            //                    response([]);
            //                }
            //            );
            //    },
            //    select: function (event, ui) {
            //        self.addPointFromAddress(ui.item.value);
            //    }
            //});


            /* eslint-enable no-undef */
        },

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
                if (evt.graphic && evt.graphic.feature) {
                    event.stopPropagation(evt);
                    self.currentFeature(evt.graphic.feature);
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
                id: this.id + '_roadways',
                title: this.id + '_roadways'
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