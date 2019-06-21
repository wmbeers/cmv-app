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
    'dojo/Deferred',

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
        topic, Memory, Deferred, layerLoaderSidebarTemplate, layerLoaderDialogTemplate, searchResultsDialogTemplate
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
            savedMaps: ko.observableArray(), // eslint-disable-line no-undef
            //represents the map selected in the loadMapDialog; not the same as the currentMap until the user clicks the open button
            selectedMap: ko.observable(), // eslint-disable-line no-undef
            //represents the map currently loaded; will just be the stub of id and mapName
            currentMap: ko.observable(), // eslint-disable-line no-undef
            clearMapFirst: ko.observable(false), // eslint-disable-line no-undef
            includeProjects: ko.observable(false), // eslint-disable-line no-undef
            allCategories: [], // originally used in searching; now that that's been pushed to SOLR, not needed for that, but useful for loading saved maps with references to dynamic map services
            getCategoryByServiceId: function (serviceId) {
                //eslint-disable-next-line no-undef
                return ko.utils.arrayFirst(this.allCategories, function (c) {
                    return c.id === serviceId;
                });
            },
            loadSelectedMap: function () {
                if (this.selectedMap()) {
                    this.currentMap(this.selectedMap());
                    topic.publish('layerLoader/loadMap', this.selectedMap().id, this.clearMapFirst());
                    this.loadMapDialog.hide();
                }
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
                //localStorage.setItem('savedMaps', JSON.stringify(this.savedMaps()));
            },
            postCreate: function () {
                this.inherited(arguments);
                var self = this; //solves the problem of "this" meaning something different in onchange event handler
                //computeds that refers to "self"/"this" have to be added here, not in root constructor
                self.mapServiceSearchResults = ko.pureComputed(function () { // eslint-disable-line no-undef
                    return ko.utils.arrayFilter(self.searchResults(), function (x) { // eslint-disable-line no-undef
                        return x.type === 'dynamic' && x.layerDefs && x.layerDefs.length > 0;
                    });
                });

                self.featureLayerSearchResults = ko.pureComputed(function () { // eslint-disable-line no-undef
                    return ko.utils.arrayFilter(self.searchResults(), function (x) { // eslint-disable-line no-undef
                        return x.type === 'feature';
                    });
                });

                self.searchResultsCount = ko.pureComputed(function () { // eslint-disable-line no-undef
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

                //subscribe to the mapLoaded topic, published by _LayerLoadMixin when the map is loaded from query string
                topic.subscribe('layerloader/mapLoaded', lang.hitch(this, 'currentMap'));

                //configure knockout
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

                this._loadSavedMaps().then(function () {
                    ko.applyBindings(self, dom.byId('layerLoaderSideBarKO')); // eslint-disable-line no-undef
                    ko.applyBindings(self, dom.byId('loadMapDialog')); // eslint-disable-line no-undef
                    ko.applyBindings(self, dom.byId('saveMapDialog')); // eslint-disable-line no-undef
                }); //note: we need to have this deferred and then apply bindings or the open button does nothing.

                //let the application know we're done starting up
                topic.publish('layerLoader/startupComplete');
            },
            _loadSavedMaps: function () {
                var deferred = new Deferred();
                var self = this;
                //eslint-disable-next-line no-undef
                SavedMapDAO.getSavedMapNamesForCurrentUser({
                    callback: function (savedMapNames) {
                        self.savedMaps(savedMapNames);
                        deferred.resolve();
                    },
                    errorHandler: function (message, exception) {
                        topic.publish('viewer/handleError', {
                            source: 'LayerLoader._loadSavedMaps',
                            error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                        });
                        deferred.resolve();
                    }
                });
                return deferred;
            },
            //listen for the enter key when user is typing in the search field
            handleSearchKeyDown: function (event) {
                if (event.keyCode === 13) {
                    this.handleSearch();
                }
            },
            //listen for the enter key when user is typing in the Project field
            handleProjectKeyUp: function (event) {
                if (event.keyCode === 13) {
                    this.addProject();
                }
            },
            //listen for the enter key when user is typing in the map name field of the save dialog
            handleMapNameKeyUp: function (event) {
                if (event.keyCode === 13) {
                    this.saveMap();
                }
            },
            addProject: function () {
                //TODO: first a quick DWR call to check if user can see it (valid project, if draft then only show if user has draft access, etc.)
                //either do that here or in addProjectToMap function
                topic.publish('layerLoader/addProjectToMap', this.projectAltId.value);
            },
            //gets a saved map by its name
            getSavedMap: function (mapName) {
                var savedMap = this.savedMaps().find(function (sm) {
                    return sm.mapName === mapName;
                });
                return savedMap;
            },
            showLoadMapDialog: function () {
                this.loadMapDialog.show();
            },
            showSaveMapDialog: function () {
                if (this.currentMap()) {
                    this.mapName.set('value', this.currentMap().mapName);
                } else {
                    this.mapName.set('value', '');
                }
                this.saveMapDialog.show();
            },
            //First step in saving a map, check to see if we already have a map with the given name (other than the current map)
            //and prompt to overwrite if so. If it's a new map name, construct the basic saved map object, 
            //or if user confirms overwrite, load the existing map, then pass the new/existing map to _saveMap
            saveMap: function () {
                var mapName = this.mapName.value;
                if (!mapName) {
                    return;
                }
                var savedMap = this.getSavedMap(mapName);
                //if null, it's a new map
                if (!savedMap) {
                    //construct new
                    savedMap = {
                        mapName: mapName,
                        id: 0 //flags it as new, will get updated in callback from server; has to be a non-null value or Dojo memory borks
                    };
                    this.savedMaps.push(savedMap); //remember it locally
                    this._saveMap(savedMap);
                } else if (this.currentMap() === null || this.currentMap().id !== savedMap.id) {
                    //confirm overwrite
                    new ConfirmDialog({
                        title: 'Confirm Overwrite',
                        content: 'Are you sure you want to overwrite the ' + mapName + ' map?',
                        onExecute: lang.hitch(this, '_saveMap', savedMap)
                    }).show();
                } else {
                    //just update existing map
                    this._saveMap(savedMap);
                }
            },
            //callback from saveMap function, gets the layer config/projects and saves to the referenced map.
            _saveMap: function (savedMap) {
                this.currentMap(savedMap);
                this.saveMapDialog.hide();
                topic.publish('layerLoader/saveMap', savedMap);
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
                            var cat = self.allCategories.find(function (c) {
                                return ('c' + c.id) === doc.id;
                            });
                            if (cat) {
                                searchResults.push(cat);
                            }
                        } else {
                            var lyr = self.layerDefs.find(function (ld) {
                                return ('l' + ld.id) === doc.id;
                            });
                            if (lyr) {
                                searchResults.push(lyr);
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
                        topic.publish('layerLoader/addLayerFromLayerDef', this);
                    };
                    layerDef.removeLayer = function () {
                        if (layerDef.layer) {
                            topic.publish('layerLoader/removeLayer', layerDef.layer);
                        }
                    };
                    layerDef.scaleText = ko.computed(function () { // eslint-disable-line no-undef
                        var scaleText = '';
                        var minScale = (layerDef.layer && layerDef.layer.minScale) ? layerDef.layer.minScale : (layerDef.minScale || 0);
                        var maxScale = (layerDef.layer && layerDef.layer.maxScale) ? layerDef.layer.maxScale : (layerDef.maxScale || 0);

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

                    layerDef.isSelected = ko.pureComputed(function () { // eslint-disable-line no-undef
                        return root.currentLayer() === layerDef;
                    });
                    layerDef.loaded = ko.observable(false); // eslint-disable-line no-undef
                }, this);

                //start the chain of post-processing categories to add knockout observables and functions
                this._processCategories(this);

                //apply knockout bindings
                ko.applyBindings(this, dom.byId('layerLoaderDialog')); // eslint-disable-line no-undef

                //bindings appear to muck this up and set it to the last one
                this.currentCategory(this.categories[0]);

                //search results dialog (content added in search handler)
                this.searchResultsDialog = new Dialog({
                    id: 'layerloader_search_dialog',
                    title: 'Search Results',
                    content: searchResultsDialogTemplate
                });

                //apply knockout bindings to search results
                ko.applyBindings(this, dom.byId('searchResultsDialog')); // eslint-disable-line no-undef

            },
            //Post-process categories to cross-reference layers and knockoutify
            _processCategories: function () {
                var root = this; // eslint-disable-line consistent-this
                
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
                            topic.publish('layerLoader/addCategory', category);
                            root.layerBrowserDialog.hide();
                        };

                        category.loadCategoryRecursive = function () {
                            topic.publish('layerLoader/addCategory', category, true);
                            root.layerBrowserDialog.hide();
                        };

                        category.select = function () {
                            root.currentCategory(category);
                            root.currentLayer(category.layerDefs.length > 0 ? category.layerDefs[0] : null);
                        };

                        category.isSelected = ko.pureComputed(function () { // eslint-disable-line no-undef
                            return root.currentCategory() === category;
                        });

                        category.loadService = function () {
                            topic.publish('layerLoader/addLayerFromCategoryDef', category);
                            root.layerBrowserDialog.hide();
                            root.searchResultsDialog.hide();
                        };

                        if (category.categories && category.categories.length > 0) {
                            processCategories(category);
                        }

                    }, this);
                }

                processCategories(this);
            },
            currentCategory: ko.observable(null), // eslint-disable-line no-undef
            currentLayer: ko.observable(null), // eslint-disable-line no-undef
            searchResults: ko.observableArray(), // eslint-disable-line no-undef
            searchResultsError: ko.observable(null), // eslint-disable-line no-undef
            showDetails: ko.observable(true) // eslint-disable-line no-undef
        });
    });
