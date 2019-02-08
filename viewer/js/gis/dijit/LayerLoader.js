define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dijit/ConfirmDialog',
    'dojo/ready',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/dom',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/store/Memory',
    'dojo/text!./LayerLoader/templates/layerLoaderSidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./LayerLoader/templates/layerLoaderDialog.html', // template for the resource layer broswer dialog

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, ready, popup, lang, array, on, dom, domConstruct, 
        topic, Memory, layerLoaderSidebarTemplate, layerLoaderDialogTemplate
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: layerLoaderSidebarTemplate,
            topicID: 'layerLoader',            
            baseClass: 'layerLoader',
            map: this.map,
            //broader scope needed for these dialogs to support closing when option is selected, so declaring these here
            layerBrowserDialog: null, //Note: we actually keep this open, and user closes it the usual way, so might not need broad scope for this one
            saveMapDialog: null,
            //loadMapDialog: null,
            searchResultsDialog: null,
            savedMaps: ko.observableArray(),
            selectedMap: ko.observable(),
            clearMapFirst: ko.observable(false),
            includeProjects: ko.observable(false),
            hasProjects: ko.observable(false), // non-computed, because fundamentally app.layers aren't observable, so computed doesn't know when to re-run. We set this when the save dialog loads
            loadSelectedMap: function () {
                this.loadMap(this.selectedMap());
            },
            deleteSelectedMap: function () {
                if (!this.selectedMap()) {
                    return;
                }
                new ConfirmDialog({
                    title: 'Confirm Delete',
                    content: 'Are you sure you want to delete the ' + this.selectedMap().name + ' map?',
                    onExecute: lang.hitch(this, '_deleteSelectedMap')
                }).show();
            },
            _deleteSelectedMap: function () {
                this.savedMaps.remove(this.selectedMap());
                this.selectedMap(null);
                //TODO save to database/user config, not LSO
                localStorage.setItem('savedMaps', JSON.stringify(this.savedMaps()));
            },
            postCreate: function () {
                this.inherited(arguments);

                //TEMPORARY!
                //this will be a core part of the layerDef
                this.layerDefs.forEach(function (layerDef) {
                    var legendSource = null;
                    if (layerDef.url.startsWith('https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Waste')) {
                        legendSource = this.contamLayers;
                    } else if (layerDef.url.startsWith('https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Historic_Resources')) {
                        legendSource = this.histLayers;
                    }

                    if (legendSource) {
                        var legendItem = legendSource.find(function (li) {
                            //layerDef.url number after last slash
                            var layerDefLayerId = layerDef.url.substr(layerDef.url.lastIndexOf('/') + 1);
                            return li.layerId == layerDefLayerId; // eslint-disable-line eqeqeq
                        });
                        layerDef.legend = legendItem ? legendItem.legend : [];
                    } else {
                        layerDef.legend = [];
                    }
                }, this);
                this._initializeDialogs();
            },
            startup: function () {
                var self = this; //solves the problem of "this" meaning something different in onchange event handler
                this.inherited(arguments);

                //TODO save to database/user config, not LSO
                var savedMaps = localStorage.getItem('savedMaps') || '[]';
                savedMaps = JSON.parse(savedMaps);

                //ko->dojo--load the data
                this.savedMaps.subscribe(function () {
                    var format = new Memory({
                        data: this.savedMaps()
                    });
                    this.savedMapsDijit.set('store', format);
                }, this);

                //ko->dojo--update UI
                this.selectedMap.subscribe(function () {
                    if (self.selectedMap()) {
                        //this bit already works
                    } else {
                        //when set to null, this doesn't get reflected in UI
                        self.savedMapsDijit.value = null;
                        self.savedMapsDijit.displayedValue = null;
                        self.savedMapsDijit.item = null;
                        dojo.byId('savedMapsDijit').value = null;
                    }
                });

                this.savedMaps(savedMaps);

                //dojo->ko--handle change
                on(this.savedMapsDijit, 'change', function () {
                    //argument passed to this function is going to just be the name, stupidly
                    //to get the actual object, use the item property
                    //in this context "this" is the dijit
                    self.selectedMap(this.item);
                });

                //ko->dojo--handle change (not really used, but just to sort of document how these interact)
                //Note: this just doesn't work with FilteringSelect. All the background properties are changed, but it will continue
                //to display the previous value. Since we don't need to dynamically update the displayed value, I'm letting this go.
                //this.selectedMap.subscribe(function () {
                //    self.savedMapsDijit.item = self.selectedMap();
                //    var s = self.selectedMap() ? self.selectedMap().name : '';
                //    self.savedMapsDijit.displayedValue = s;
                //    self.savedMapsDijit.value = s;
                //    debugger;
                //});

                ko.applyBindings(this, dom.byId('layerLoaderSideBarKO'));
                ko.applyBindings(this, dom.byId('loadMapDialog'));
                ko.applyBindings(this, dom.byId('saveMapDialog'));
            },
            handleSearchKeyDown: function (event) {
                if (event.keyCode === 13) {
                    this.handleSearch();
                }
            },
            handleProjectKeyUp: function (event) {
                if (event.keyCode === 13) {
                    this.addProject();
                }
            },
            addProject: function () {
                //TODO: first a quick DWR call to check if user can see it (valid project, if draft then only show if user has draft access, etc.)
                //either do that here or in addProjectToMap function 
                app.addProjectToMap(
                    this.projectAltId.value
                );
            },
            getSavedMap: function (mapName) {
                var savedMap = this.savedMaps().find(function (sm) {
                    return sm.name === mapName;
                });
                return savedMap;
            },
            showLoadMapDialog: function () {
                //todo apply bindings here?
                this.loadMapDialog.show();
            },
            showSaveMapDialog: function () {
                this.hasProjects(false);
                if (app.layers.find(
                    function (l) {
                        return l.name === 'Milestone Max Alternatives';
                    }
                )) {
                    this.hasProjects(true);
                }
                this.saveMapDialog.show();
            },
            saveMap: function () {
                var mapName = this.mapName.value;
                if (!mapName) {
                    return;
                }
                var savedMap = this.getSavedMap(mapName);
                if (!savedMap) {
                    //construct new
                    savedMap = {
                        name: mapName,
                        id: mapName //dojo needs this. Eventually we'll have our own server-provided ids
                    };
                    this.savedMaps.push(savedMap);
                    this._saveMap(savedMap);
                } else {
                    //confirm overwrite
                    new ConfirmDialog({
                        title: 'Confirm Overwrite',
                        content: 'Are you sure you want to overwrite the ' + mapName + ' map?',
                        onExecute: lang.hitch(this, '_saveMap', savedMap)
                    }).show();
                }
            },
            _saveMap: function (savedMap) {
                //get layers
                savedMap.layers = app.getLayerConfig();
                savedMap.includesProjects = this.hasProjects() && this.includeProjects();
                if (this.hasProjects() && !this.includeProjects()) {
                    //filter projects out of the map
                    savedMap.layers = array.filter(savedMap.layers, function (l) {
                        return l.name === 'Milestone Max Alternatives';
                    });
                }
                //TODO save to database/user config, not LSO
                localStorage.setItem('savedMaps', JSON.stringify(this.savedMaps()));
                this.saveMapDialog.hide();
                topic.publish('growler/growl', 'Saved ' + savedMap.layers.length + ' layers to ' + savedMap.name);
            },
            loadMap: function (savedMap) {
                //is it an object or just the name of a map?
                if (typeof savedMap === 'string') {
                    savedMap = this.getSavedMap(savedMap);
                }

                if (savedMap) {
                    app.loadLayerConfig(savedMap.layers, this.clearMapFirst()).then(function (layers) {
                        topic.publish('growler/growl', 'Loaded ' + layers.length + ' layers for ' + savedMap.name);
                    });
                }
                this.loadMapDialog.hide();
            },
            handleSearch: function () {
                //filter this.layerDefs
                //TODO lucene or some more powerful search engine will be replacing this
                var searchString = this.searchNode.displayedValue;
                var tokens = searchString.toLowerCase().split(' ');
                var matches = array.filter(this.layerDefs, function (l) {
                    var x = array.some(tokens, function (s) {
                        var name = String(l.name).toLowerCase(), 
                            description = String(l.description).toLowerCase(), 
                            fullName = String(l.fullName).toLowerCase();

                        return (name.indexOf(s) >= 0 ||
                            description.indexOf(s) >= 0 ||
                            fullName.indexOf(s) >= 0);
                    });
                    if (x) {
                        return true;
                    }
                    return false; //not really necessary, but prevents a consistent-return eslint error
                });
                var ul = domConstruct.toDom('<ul class="layerList"></ul>');
                matches.forEach(function (layerDef) {
                    this._constructLayerLink(layerDef, ul);
                }, this);
                this.searchResultsDialog.set('content', ul);

                this.searchResultsDialog.show();
            },
            showCategories: function () {
                this.layerBrowserDialog.show();
            },
            listAllLayers: function () {
                this.layersDialog.show();
            },
            _initializeDialogs: function () {
                //layer browser dialog
                this.layerBrowserDialog = new Dialog({
                    id: 'layerloader_browser_dialog',
                    title: 'Layer Browser',
                    content: layerLoaderDialogTemplate,
                    style: 'width: 90%; height: 75%'
                });

                this.layerDefs.forEach(function (layerDef) {
                    layerDef.loadLayer = function () {
                        var layer = app.constructLayer(layerDef);
                        app.addLayer(layer);
                    };
                    layerDef.removeLayer = function () {
                        if (layerDef.layer) {
                            app.widgets.layerControl._removeLayer(layerDef.layer);
                        }
                    };
                    layerDef.scaleText = ko.computed(function () {
                        var scaleText = '';
                        var minScale = (layerDef.layer && layerDef.layer.minScale) ? layererDef.layer.minScale : (layerDef.minScale || 0);
                        var maxScale = (layerDef.layer && layerDef.layer.maxScale) ? layererDef.layer.maxScale : (layerDef.maxScale || 0);

                        if (minScale > 0) {
                            if (maxScale > 0) {
                                scaleText = 'Visible between 1:' + maxScale + ' and 1:' + minScale;
                            } else {
                                scaleText = 'Visible when zoomed in closer than 1:' + minScale;
                            }
                        } else if (maxScale > 0) {
                            scaleText = 'Visible when zoomed out beyond 1:' + maxScale;
                        }
                        return scaleText;
                    });
                    layerDef.loaded = ko.observable(false);
                }, this);

                //This is problematic because of the recursive call lang.hitch(this, '_processCategories', this.categories);

                this._processCategories(this.categories, this.layerDefs);

                //apply knockout bindings
                ko.applyBindings(this, dom.byId('layerLoaderDialog'));
                //bindings appear to muck this up and set it to the last one
                this.currentCategory(this.categories[0]);


                //layers dialog
                var ul = domConstruct.toDom('<ul class="layerList"></ul>');
                this.layersDialog = new Dialog({
                    id: 'layerloader_layers_dialog',
                    title: 'Select Layer',
                    content: ul
                });

                //sort layerDefs by name (we'll do this server-side eventually)
                this.layerDefs.sort(function (a, b) {
                    if (a.name === b.name) {
                        return 0;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return -1;
                });

                //add layerDefs to all-layers list
                this.layerDefs.forEach(function (layerDef) {
                    this._constructLayerLink(layerDef, ul);
                }, this);

                //search results dialog (content added in search handler)
                this.searchResultsDialog = new Dialog({
                    id: 'layerloader_search_dialog',
                    title: 'Search Results'
                });
            },
            _processCategories: function (categories, layerDefs) {
                //post-process categories to cross-reference layers and knockoutify
                categories.forEach(function (category) {
                    category.layerDefs = category.layerIds.map(function (layerId) {
                        return layerDefs.find(function (l) {
                            return l.id === layerId;
                        });
                    }, this);
                    category.layerDefs.reverse();
                    //category.showCategory = function () {
                    //    //handled by knockout
                    //    self.currentCategory = category;
                    //};
                    //console.log(category.name + (category.categories ? category.categories.length : 'null'));
                    if (category.categories && category.categories.length > 0) {
                        this._processCategories(category.categories, layerDefs);
                    }
                }, this);
            },
            currentCategory: ko.observable(null),
            currentLayer: ko.observable(null),
            _constructLayerLink: function (layerDef, targetNode) {
                var li = domConstruct.create('li', null, targetNode);
                var a = domConstruct.create('a', {'href': '#', 'innerHTML': layerDef.name, 'title': layerDef.description}, li);
                on(a, 'click', lang.hitch(this, function () {
                    var layer = app.constructLayer(layerDef);
                    app.addLayer(layer);
                    this.layersDialog.hide();
                    this.searchResultsDialog.hide();
                }));
            }
        });
    });
