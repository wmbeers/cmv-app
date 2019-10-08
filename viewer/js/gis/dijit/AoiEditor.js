define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',

    'gis/plugins/LatLongParser',
    'gis/plugins/MultiPartHelper',
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
    './AoiEditor/FeatureOperations',

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
                id: 8,
                abbreviation: 'AOI',
                name: 'Area of Interest'
            },
            {
                id: 15,
                abbreviation: 'BRIDGE',
                name: 'Bridge'
            },
            {
                id: 4,
                abbreviation: 'CF',
                name: 'Cost Feasible'
            },
            {
                id: 9,
                abbreviation: 'CORR',
                name: 'Corridor Study'
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
                id: 2,
                abbreviation: 'NFE',
                name: 'Not for ETAT'
            },
            {
                id: 7,
                abbreviation: 'NMSA',
                name: 'Non Major State Action'
            },
            {
                id: 11,
                abbreviation: 'OAOI',
                name: 'Other Area of Interest'
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
                id: 3,
                abbreviation: 'TICE',
                name: 'Type I CE'
            },
            {
                id: 14,
                abbreviation: 'TRANSIT',
                name: 'Transit'
            },
            {
                id: 5,
                abbreviation: 'UCFP',
                name: 'Ultimate Cost Feasible Project'
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
            this.listAois().then(function () {
                self.openAoiDialog.show();
            });
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
            this.newFeatureDialog.show();
        },

        aoiId: null, //the ID of the current AOI being edited, if one is loaded

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
            }, function (e) {
                debugger;
            });
        },

        showAnalysisAreas: function () {
            //todo validate >0 features, features have buffers, etc.
            this.mode('analysisAreas');
        },

        showAnalysisOptions: function () {
            this.mode('analysisOptions');
        },

        createAoi: function () {
            this.loadAoiModel(null); //an empty AOI is used to populate
            this.mode('editName');
        },

        toJS: function () {
            return {
                id: this.aoiId,
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
                        self.aoiId = id;
                        deferred.resolve(true);
                    },
                    errorHandler: function (err) {
                        deferred.reject(err);
                    }
                });
            }
            return deferred;
        },

        saveAnalysisAreasAndShowAnalysisOptions: function () {
            var self = this;
            this.saveAnalysisAreas().then(
                function() {
                    self.saveAnalysisAreaBuffers().then(
                        function () {
                            self.mode('analysisOptions');
                        }
                    );
                }
            );
        },

        //Analysis areas are saved on the fly as features are added to them, but if the default, typical option
        //of NOT assigning features to analysisAreas is chosen, we'll need to do that here
        saveAnalysisAreas: function () {
            var promises = [], //promises to be resolved when all analysis areas are created from ungroupedFeatures.
                ungroupedFeatures = this.features().filter(function (f) {
                    return !f.analysisArea() || f.analysisArea().id === 0; //latter shouldn't ever be the case
                });

            if (ungroupedFeatures.length === 0) {
                return this._deleteEmptyAnalysisAreas();
            } else {
                ungroupedFeatures.forEach(function (f) {
                    promises.push(f.setAnalysisArea(f.name())); // self._addFeatureToAnalysisArea(f, f.name()));
                });
                all(promises).then(
                    function () {
                        return this._deleteEmptyAnalysisAreas();
                    },
                    function (e) {
                        var deferred = new Deferred();
                        window.setTimeout(function() {
                            deferred.reject(e);
                        }, 10);
                        return deferred;
                    }
                );
            }
        },

        _deleteEmptyAnalysisAreas: function () {
            var deferred = new Deferred(),
                emptyAnalysisAreas = this.analysisAreas().filter(function(aa) {
                    return aa.features().length === 0;
                });
            if (emptyAnalysisAreas.length > 0) {
                var ids = emptyAnalysisAreas.map(function (aa) {
                    return aa.id;
                });
                MapDAO.deleteAoiAnalysisAreas(ids, this.currentAuthority().orgUserId, {
                    callback: function () {
                        deferred.resolve(true);
                    },
                    errorHandler: function (err) {
                        deferred.reject(err);
                    }

                });
            } else {
                window.setTimeout(function() {
                    deferred.resolve(false);
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
                        //update all features no longer necessary, we assign the FK_PROJECT_ALT values when the AoiAnalysisArea is created
//                         edits.adds.concat(edits.updates).forEach(function (aa) {
//                             aa.sourceFeatures.forEach(function (f) {
//                                 f.graphic.attributes.FK_PROJECT_ALT = aa.attributes.FK_PROJECT_ALT;
//                                 featureSavePromises.push(f.applyUpdate());
//                             });
//                         });
//                         all(featureSavePromises).then(
//                             function () {
//                                 deferred.resolve();
//                             },
//                             function (err) {
//                                 deferred.reject(err);
//                             }
//                         );
                        //todo, something more than this but what?
                        //console.log('added ' + a.length + ' features, updated ' + u.length + ' features, and deleted ' + d.length + ' features');
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
                self.mode('analysisProgress');
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
            this.deactivateDrawTool();
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

        loadAoi: function (id) {
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
                        self.mode('editName');
                    } else {
                        topic.publish('viewer/handleError', {
                            source: 'AoiEditor.loadAoi',
                            error: 'Invalid AOI ID'
                        });
                    }
                },
                errorHandler: function (message, exception) {
                    self.LoadingOverlay.hide();
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
            //TODO figure out why this doesn't work: this.sidebarLoadingOverlay = new LoadingOverlay('aoiEditorSidebar'); //...this has to be defined in startup, because the sidebar widget has to be constructed first


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
                    //todo warn user and handle situation. Not sure if this actually happens
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

        //geolocation functions for adding points, not used

        /**
         * Gets suggested addresses that match the search term, focussed on the current map location, with a Florida extent
         * @param {any} searchTerm User-entered address to search for.
         * @returns {Deferred} a Deferred object. Refer to ESRI JSAPI documentation for suggestLocations.
         */
        //getLocatorSuggestions: function (searchTerm) {
        //    var locator = new Locator('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer');
        //    return locator.suggestLocations({
        //        text: searchTerm,
        //        location: this.map.extent.getCenter().normalize(),
        //        distance: 50000,
        //        searchExtent: new Extent({
        //            xmin: -87.79,
        //            ymin: 24.38,
        //            xmax: -79.8,
        //            ymax: 31.1,
        //            spatialReference: {
        //                wkid: 4326
        //            }
        //        })
        //    });
        //},

        ///**
        // * Gets a location from the provided address.
        // * @param {any} address The address to convert to a location.
        // * @returns {Deferred} a Deferred object. Refer to ESRI JSAPI documentation for addressToLocations.
        // */
        //getLocatorAddressToLocations: function (address) {
        //    var locator = new Locator('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer');
        //    return locator.addressToLocations({
        //        address: {
        //            SingleLine: address //Note: if we switch to a different server a different format for the address may be needed
        //        },
        //        countryCode: 'US',
        //        searchExtent: new Extent({
        //            xmin: -87.79,
        //            ymin: 24.38,
        //            xmax: -79.8,
        //            ymax: 31.1,
        //            spatialReference: {
        //                wkid: 4326
        //            }
        //        })
        //    });
        //},

        //addPointFromAddress: function (address) {
        //    var self = this;
        //    if (address) {
        //        this.getLocatorAddressToLocations(address).then(
        //            function (findAddressCandidatesResult) {
        //                if (findAddressCandidatesResult && findAddressCandidatesResult.candidates && findAddressCandidatesResult.candidates.length > 0) {
        //                    //assume the first match is the only/best match
        //                    var candidate = findAddressCandidatesResult.candidates[0],
        //                        point = candidate.location, //a point object
        //                        featureStub = {
        //                            geometry: point,
        //                            name: candidate.address
        //                        },
        //                        feature = self._constructFeature(featureStub);
        //                    self.features.push(feature);
        //                } else {
        //                    topic.publish('growler/growlError', 'Error getting location from address: no location found');
        //                }
        //            },
        //            function (err) {
        //                topic.publish('growler/growlError', 'Error getting location from address: ' + err);
        //            }
        //        );
        //    } else {
        //        //todo, but what?
        //    }
        //},

        digitizePoint: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('point');
        },

        extractPoint: function () {
            topic.publish('growler/growl', 'Extract coming soon!');
        },

        extractLine: function () {
            topic.publish('growler/growl', 'Extract coming soon!');
        },

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

        digitizeLine: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('polyline');
        },

        digitizeFreehandLine: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('freehandpolyline');
        },

        digitizePolygon: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('polygon');
        },

        digitizeFreehandPolygon: function () {
            this.newFeatureDialog.hide();
            this.activateDrawTool('freehandpolygon');
        },

        _setupEditor: function () {
            var self = this; //closure so we can access this.draw etc.
            this.draw = new Draw(this.map); //draw toolbar, not shown in UI, but utilized by our UI
            this.edit = new Edit(this.map);

            //on(this.undoManager, 'undo', function (a,b,c,d) {
            //    debugger;
            //});
            //on(this.undoManager, 'redo', function (a, b, c, d) {
            //    debugger;
            //});

            on(this.undoManager, 'change', lang.hitch(this, 'updateUndoRedoButtons'));


            //customizing the draw toolbar so the UI can remind user what they're doing, and have ability to cancel
            /*eslint-disable no-undef*/
            self.drawToolGeometryType = ko.observable(null); //independent of draw._geometryType, but we keep it in sync

            self.drawMode = ko.observable('draw'); //either 'draw' or 'split', controls what happens in draw-complete
            /*eslint-enable no-undef*/

            self.activateDrawTool = function (geometryType) {
                //put us in draw-new-feature mode.
                self.drawMode('draw');
                //deactivate edit toolbar
                self.edit.deactivate();
                //clear out current feature
                self.currentFeature(null);
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
                self.bufferGraphics.setVisibility(false);
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
                var layer = self.layers[event.geometry.type], //note: only applys in draw mode, gets redefined in split mode
                    mode = self.drawMode();
                //toggle back to default map click mode
                topic.publish('mapClickMode/setDefault');
                self.deactivateDrawTool();

                if (mode === 'draw') {
                    //construct a feature
                    var f = self._constructFeature(event);
                    self._addFeatureToLayer(f, true);
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
            analysisAreaModels.forEach(function (analysisAreaModel, index) {
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

                    params.distances = [1];  //TODO when we support multiple buffer distances this will need to change
                    params.outSpatialReference = self.map.spatialReference; //todo this should maybe be Albers
                    params.unit = 9002;
                    params.geometries = simplifiedGeometries;
                    params.unionResults = true;

                    //eslint-disable-next-line no-undef
                    esriConfig.defaults.geometryService.buffer(params,
                        function (bufferedGeometries) {
                            //search for existing feature by id and buffer distance
                            var analysisAreaFeature = self.getAnalysisAreaBuffer(analysisAreaModel.id, 1); //TODO when we support multiple buffer distances this will need to change
                            if (analysisAreaFeature) {
                                //update
                                result.updates.push(analysisAreaFeature);
                                analysisAreaFeature.geometry = bufferedGeometries[0];  //TODO when we support multiple buffer distances this will need to change
                                analysisAreaFeature.attributes.FK_PRJ_ALT = analysisAreaModel.altNumber; //this probably doesn't change
                                buildPromise.resolve(analysisAreaFeature);
                            } else {
                                //add
                                analysisAreaFeature = new Graphic(bufferedGeometries[0]); //todo if we can create multiple buffers in one go with different buffer distances, will need to foreach through those
                                analysisAreaFeature.attributes = {
                                    OBJECTID: null,
                                    BUFFER_DISTANCE: 1, //TODO when we support multiple buffer distances this will need to change
                                    FEATURE_NAME: analysisAreaModel.name(),
                                    FK_PROJECT: self.aoiId,
                                    FK_PROJECT_ALT: analysisAreaModel.id,
                                    FK_PRJ_ALT: analysisAreaModel.altNumber
                                };
                                result.adds.push(analysisAreaFeature);
                                buildPromise.resolve(analysisAreaFeature);
                            }
                        },
                        function (err) {
                            buildPromise.reject(err);
                        }
                    );
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
                return m.id === id;
            });
        },

        //gets an analysis area feature from the analysis areas feature layer by alt ID and buffer distance
        getAnalysisAreaBuffer: function (id, bufferDistance) {
            return this.layers.analysisAreaBuffer.graphics.find(function (f) {
                return f.attributes.FK_PROJECT_ALT === id && f.attributes.BUFFER_DISTANCE === bufferDistance;
            });
        },

        //loads up our observable properties from the referenced aoi
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
                alternatives: []
            };

            this.aoiId = aoi.id;

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

            this.studyAreaReportRequested(aoi.studyAreaReportRequested);
            this.socioCulturalDataReportRequested(aoi.socioCulturalDataReportRequested);
            this.hardCopyMapsRequested(aoi.hardCopyMapsRequested);
            this.culturalResourcesDataReportRequested(aoi.culturalResourcesDataReportRequested);
            this.emergencyResponseReportRequested(aoi.emergencyResponseReportRequested);

            this._updateAoiCache();

            return this._loadAoiFeatures();
        },

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

        _nextFeatureNumber: function () {
            var n = 0,
                rx = /(\d+)/;
            this.features().forEach(function (f) {
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
            var self = this, //keeps a reference to the aoiEditor model
                loadPromises = []; //collection of promises resolved on update-end of the three editable layers (point, polyline and polygon), zooms to unioned extent when done

            this.loadingOverlay.show('Loading AOI Analysis Areas');

            this.clearAoiLayers();

            //get analysisAreaBuffers first TODO this isn't really a necessary step anymore, and we can include this in the same loop
            //through self.featureTypes below (loop through self.layers instead)
            self.layers.analysisAreaBuffer = new FeatureLayer(projects.aoiLayers.analysisAreaBuffer.url, {
                id: 'aoi_analysisArea_' + this.aoiId,
                outFields: '*',
                definitionExpression: 'FK_PROJECT = ' + this.aoiId,
                //note: can't be invisble, and must be loaded in map for update-end to work.
                //visible: false, //not actually loaded in map, so don't need to make invisible
                mode: FeatureLayer.MODE_SNAPSHOT
            });

            on.once(self.layers.analysisAreaBuffer, 'update-end', function () {
                self.loadingOverlay.show('Loading AOI Features');
                //we now have self.layers.analysisAreaBuffer.graphics as array of the analysis areas as GIS features
                //get the rest of the features and build relationships
                self.layers.analysisAreaBuffer.setVisibility(false);
                self.featureTypes.forEach(function (layerName) {
                    var url = projects.aoiLayers[layerName].url,
                        deferred = new Deferred(),
                        layer = new FeatureLayer(url,
                            {
                                id: 'aoi_' + layerName + '_' + self.aoiId,
                                outFields: '*',
                                definitionExpression: 'FK_PROJECT = ' + self.aoiId,
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
                            if (evt.graphic && evt.graphic.feature && !self.drawToolActive()) {
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

            }, function () {
                //todo
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
                    FK_PROJECT: self.aoiId
                });
            }

            //back-reference, supports clicking map or model
            feature.graphic.feature = feature;

            /* eslint-disable no-undef */
            feature.name = ko.observable(feature.name);
            feature.visible = ko.observable(true);
            feature.visible.subscribe(function (visible) {
                feature.graphic.visible = visible;
                feature.buffer.visible = visible;
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
                        deferred = feature.applyUpdate();
                    } else {
                        deferred.resolve();
                    }
                    return deferred;
                }

                if (typeof analysisArea === 'string' || typeof analysisArea === 'number') {
                    //first check to see if it exists, using the ID or name
                    var existing = self.analysisAreas().find(function (ag) {
                        return ag.name() === analysisArea || ag.id === analysisArea;
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

                    self.loadingOverlay.show('Saving new analysis area to database');

                    //save to non-spatial table
                    //eslint-disable-next-line no-undef
                    MapDAO.saveAoiAnalysisArea(this.aoiId, this.currentAuthority().orgUserId, analysisArea.toJS(), {
                        callback: function (analysisAreaReply) {
                            self.loadingOverlay.hide();
                            analysisArea.id = analysisAreaReply.id; //the only thing that could possibly change after saving
                            self.analysisAreas.push(analysisArea);
                            feature.analysisArea(analysisArea);
                            //self.dummyForceRecompute(new Date());

                            deferred = feature.applyUpdate();
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

                    if (feature.graphic.attributes.FK_PROJECT_ALT === analysisArea.id) {
                        //happens during loading and building our model, no update required
                        deferred.resolve();
                    } else {
                        feature.graphic.attributes.FK_PROJECT_ALT = analysisArea.id;
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
            };

            feature.name.subscribeChanged(function (latestValue, previousValue) {
                //validate the new name is unique
                var matchedName = self.features().find(function (f) {
                    return feature !== f && f.name() === latestValue;
                });

                if (matchedName) {
                    //todo alert user 
                    feature.name(previousValue);
                    return;
                }

                //has something changed?
                if (feature.graphic.attributes.FEATURE_NAME !== latestValue) {
                    feature.graphic.attributes.FEATURE_NAME = latestValue;
                    feature.applyUpdate();
                }
            });

            //feature.name.subscribe(function (oldValue) {
            //    //todo here we can prevent assigning a name that's already been used
            //    console.log('beforeChange: feature.name=' + this.name() + ', oldValue=' + oldValue);
            //}, feature, 'beforeChange');

            //feature.name.subscribe(function (newValue) {
            //    this.graphic.attributes.FEATURE_NAME = newValue;
            //    this.applyUpdate();
            //}, feature, 'change');

            feature.bufferDistance.subscribe(function (newValue) {
                self.bufferFeature(feature);
                feature.graphic.attributes.BUFFER_DISTANCE = newValue;
                if (newValue) {
                    self.lastBufferDistance = newValue;
                }
                feature.applyUpdate();
            }, 'changed');

            feature.bufferUnit.subscribe(function (newValue) {
                self.bufferFeature(feature);
                feature.graphic.attributes.BUFFER_DISTANCE_UNITS = newValue.name;
                if (newValue) {
                    self.lastUnit = newValue;
                }
                feature.applyUpdate();
            }, 'changed');

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
                self.deactivateDrawTool();
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
                }, function () {
                    //todo
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
                    feature.applyUpdate(false).then (function () {
                        self.bufferFeature(feature);
                    });
                } else {
                    //means we're restoring from deleted
                    self._addFeatureToLayer(feature, false).then (function () {
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
                            self.loadAoi(aoi.id);
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
            } else {
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
                return !this.aoiId && this.authorities.length > 1;
            }, this);

            //when user changes filter option or current authority, re-list the aois
            this.filterOption.subscribe(this.listAois, this);
            this.currentAuthority.subscribe(this.listAois, this);
            this.includeExpired.subscribe(this.listAois, this);

            //for extract and lat/long tools
            this.roadwayId = ko.observable();
            this.milepost = ko.observable(); //either the milepost on the point tab, or the begin milepost on the line tab
            this.endMilepost = ko.observable();

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
                this.id = 0; //assigned >0 by server after it is saved
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
                        this.id = analysisArea.id;
                        this.altNumber = analysisArea.altNumber;
                    }
                }
                this.toJS = function () {
                    return {
                        id: this.id,
                        altNumber: this.altNumber,
                        name: this.name()
                    };
                };


                //TODO do we want to embed save function for an analysis area here?
            };

            //analysis areas are defined based on the features, and are independent, mostly, of what's in S_AOI (via layers.analysisAreas.graphics) at the moment.
            //this.analysisAreas = ko.pureComputed(function () {
            //    var analysisAreas = [];
            //    this.features().forEach(function (f) {
            //        if (f.analysisArea() && analysisAreas.indexOf(f.analysisArea()) < 0) {
            //            analysisAreas.push(f.analysisArea());
            //        } return f.analysisArea();
            //    });
            //    return analysisAreas;
            //}, this);
            this.analysisAreas = ko.observableArray(); //formerly known as alternatives, distinct from analysisAreaBuffers (features in S_AOI)

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

            //    //todo separate symbols for "active" feature? If/when switching from using graphics/graphicslayers to storing features, the selectionSymbol would be the way to go.
        }
    });
});