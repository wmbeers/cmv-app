define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dijit/ConfirmDialog',
    'dojo/ready',
    'dijit/popup',
    'dojo/request',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/dom',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/store/Memory',
    'dojo/text!./LayerLoader/templates/layerLoaderSidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./LayerLoader/templates/layerLoaderDialog.html', // template for the resource layer broswer dialog
    'dojo/text!./LayerLoader/templates/searchResultsDialog.html', // template for the layer search results

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, ready, popup, request, lang, array, on, dom, domConstruct, 
        topic, Memory, layerLoaderSidebarTemplate, layerLoaderDialogTemplate, searchResultsDialogTemplate
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
                var self = this; //solves the problem of "this" meaning something different in onchange event handler
                //computeds that refers to "self"/"this" have to be added here, not in root constructor
                self.mapServiceSearchResults = ko.pureComputed(function () {
                    return ko.utils.arrayFilter(self.searchResults(), function (x) {
                        return x.type === 'category' && x.layerDefs && x.layerDefs.length > 0;
                    });
                });

                self.featureLayerSearchResults = ko.pureComputed(function () {
                    return ko.utils.arrayFilter(self.searchResults(), function (x) {
                        return x.type === 'feature';
                    });
                });

                self.searchResultsCount = ko.pureComputed(function () {
                    if (self.mapServiceSearchResults().length === 0 && self.featureLayerSearchResults().length === 0) {
                        return 'No results found';
                    }
                    var s = [];
                    if (self.mapServiceSearchResults().length === 1) {
                        s.push('one category');
                    } else if (self.mapServiceSearchResults().length > 1) {
                        s.push(self.mapServiceSearchResults().length + ' categories');
                    }
                    if (self.featureLayerSearchResults().length === 1) {
                        s.push('one layer');
                    } else if (self.featureLayerSearchResults().length > 1) {
                        s.push(self.featureLayerSearchResults().length + ' layers');
                    }
                    return 'Found ' + s.join(' and ');
                });

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
                        dom.byId('savedMapsDijit').value = null;
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
            //First step in saving a map, check to see if we already have a map with the given name
            //and prompt to overwrite if so. If it's a new map name, construct the basic saved map object, 
            //or if user confirms overwrite, load the existing map, then pass the new/existing map to _saveMap
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
            //callback from saveMap function, gets the layer config/projects and saves to the referenced map.
            _saveMap: function (savedMap) {
                //get layers
                savedMap.layers = app.getLayerConfig();
                savedMap.extent = app.map.extent;
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
                var self = this; //solves the problem of "this" meaning something different in request callback handler
                this.searchResultsError(null);
                //eslint-disable-next-line no-useless-escape
                var encodedSearchTerms = encodeURIComponent(this.searchNode.displayedValue.replace(/([-\+\|\!\{\}\[\]\:\^\~\*\?\(\)])/g, '\\$1')); // escape solr special chars

                //SOLR query
                //should look like this for the search term land use:
                // /solr1/layers/select?indent=on&q=name:land%20use^10%20or%20longName:land%20use^10%20or%20description:land%20use%20or%20layerName:land%20use&wt=json

                var searchUrl = window.location.origin +
                    '/solr1/layers/select?q=name:"' +
                    encodedSearchTerms +
                    '"^150+OR+longName:"' +
                    encodedSearchTerms +
                    '"^100+OR+description:"' +
                    encodedSearchTerms +
                    '"^50+OR+name:' +
                    encodedSearchTerms +
                    '+OR+longName:' +
                    encodedSearchTerms +
                    '+OR+description:' +
                    encodedSearchTerms +
                    '&wt=json';
                request(searchUrl).then(function (reply) {
                    var resultDocs = JSON.parse(reply).response.docs;
                    var searchResults = [];
                    resultDocs.forEach(function (doc) {
                        if (doc.type === 'category') {
                            var cat = array.filter(self.allCategories, function (c) {
                                return ('c' + c.id) === doc.id;
                            });
                            if (cat && cat.length > 0) {
                                searchResults.push(cat[0]);
                            }
                        } else {
                            var lyr = array.filter(self.layerDefs, function (ld) {
                                return ('l' + ld.id) === doc.id;
                            });
                            if (lyr && lyr.length > 0) {
                                searchResults.push(lyr[0]);
                            }
                        }
                    });
                    self.searchResults(searchResults);
                    self.searchResultsDialog.show();
                }, function (err) {
                    self.searchResultsError(err);
                    self.searchResultsDialog.show();
                });
            },
            showCategories: function () {
                //resize to work around Dojo's auto-sizing limitations
                //it expects the content to have a fixed size, but we need it to be at least somewhat 
                //dynamic with regard to the size of the window
                var width = window.innerWidth * 0.85,
                    height = window.innerHeight * 0.7,
                    content = document.getElementById('layerLoaderDialog');

                content.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');

                this.layerBrowserDialog.show();
                
            },
            _initializeDialogs: function () {
                //layer browser dialog
                this.layerBrowserDialog = new Dialog({
                    id: 'layerloader_browser_dialog',
                    title: 'Layer Browser',
                    content: layerLoaderDialogTemplate,
                    style: 'width: 90%; height: 75%'
                });

                //post-process layerDefs
                this.layerDefs.forEach(function (layerDef) {
                    var root = this; // eslint-disable-line consistent-this

                    layerDef.loadLayer = function () {
                        var layer = app.constructLayer(layerDef);
                        return app.addLayer(layer);
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
                    layerDef.select = function () {
                        root.currentLayer(layerDef);
                    };

                    layerDef.isSelected = ko.pureComputed(function () {
                        return root.currentLayer() === layerDef;
                    });
                    layerDef.loaded = ko.observable(false);
                }, this);

                //start the chain of post-processing categories to add knockout observables and functions
                this._processCategories(this);

                //apply knockout bindings
                ko.applyBindings(this, dom.byId('layerLoaderDialog'));

                //bindings appear to muck this up and set it to the last one
                this.currentCategory(this.categories[0]);

                //search results dialog (content added in search handler)
                this.searchResultsDialog = new Dialog({
                    id: 'layerloader_search_dialog',
                    title: 'Search Results',
                    content: searchResultsDialogTemplate
                });

                //apply knockout bindings to search results
                ko.applyBindings(this, dom.byId('searchResultsDialog'));

            },
            //Post-process categories to cross-reference layers and knockoutify
            _processCategories: function () {
                var root = this; // eslint-disable-line consistent-this
                root.allCategories = []; // used when searching

                //internal function to add layerDefs and functions; recursively called, starting
                //with the root model (this LayerLoader), then each root-level category, then subcategories
                function processCategories (parent) {
                    parent.categories.forEach(function (category) {
                        root.allCategories.push(category);
                        category.layerDefs = category.layerIds.map(function (layerId) {
                            return root.layerDefs.find(function (l) {
                                return l.id === layerId;
                            });
                        }, this);

                        category.allLayerDefs = [];

                        category.loadCategory = function () {
                            app.addCategory(category);
                            root.layerBrowserDialog.hide();
                        };

                        category.loadCategoryRecursive = function () {
                            app.addCategory(category, true);
                            root.layerBrowserDialog.hide();
                        };

                        category.select = function () {
                            root.currentCategory(category);
                            root.currentLayer(category.layerDefs.length > 0 ? category.layerDefs[0] : null);
                        };

                        category.isSelected = ko.pureComputed(function () {
                            return root.currentCategory() === category;
                        });

                        category.loadService = function () {
                            if (category.serviceURL) {
                                var categoryLayerDef = {
                                    type: 'dynamic',
                                    url: category.serviceURL,
                                    name: category.name
                                };
                                var mapServiceLayer = app.constructLayer(categoryLayerDef);
                                app.addLayer(mapServiceLayer);
                                root.layerBrowserDialog.hide();
                                root.searchResultsDialog.hide();
                            } else {
                                //this shouldn't happen
                                //TODO
                            }
                        };

                        if (category.categories && category.categories.length > 0) {
                            processCategories(category);
                        }

                    }, this);
                }

                processCategories(this);
            },
            currentCategory: ko.observable(null),
            currentLayer: ko.observable(null),
            searchResults: ko.observableArray(),
            searchResultsError: ko.observable(null),
            showDetails: ko.observable(true)
        });
    });
