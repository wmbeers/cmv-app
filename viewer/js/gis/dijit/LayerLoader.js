define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
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
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, request, lang, on, query, dom,
        domClass, html, topic, Memory, Deferred, layerLoaderSidebarTemplate, layerLoaderDialogTemplate, searchResultsDialogTemplate
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: layerLoaderSidebarTemplate,
            topicID: 'layerLoader',
            baseClass: 'layerLoader',
            map: this.map,

            //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
            layerBrowserDialog: null,
            saveMapDialog: null,
            searchResultsDialog: null,

            //the array of saved maps (just id and mapName), loaded at startup
            savedMaps: ko.observableArray(), // eslint-disable-line no-undef

            //represents the map selected in the loadMapDialog; not the same as the currentMap until the user clicks the open button
            selectedMap: ko.observable(), // eslint-disable-line no-undef

            //represents the map currently loaded in the viewer; will just be the stub of id and mapName
            currentMap: ko.observable(), // eslint-disable-line no-undef

            //flags whether user wants to clear layers from the map before loading a new map
            clearMapFirst: ko.observable(false), // eslint-disable-line no-undef

            //tracks whether changes have been made to the map
            hasUnsavedChanges: ko.observable(false), // eslint-disable-line no-undef

            //the category currently selected in the layer browser
            currentCategory: ko.observable(null), // eslint-disable-line no-undef

            //the layer currently selected in the layer browser
            currentLayer: ko.observable(null), // eslint-disable-line no-undef

            //the array of layerDefs and categories returned from searching
            searchResults: ko.observableArray(), // eslint-disable-line no-undef

            //stores any errors that happen during search
            searchResultsError: ko.observable(null), // eslint-disable-line no-undef

            //boolean flag for storing whether user wants detailed search results, or just layer/category names
            showDetails: ko.observable(true), // eslint-disable-line no-undef

            //flattened list of all categories, used for loading saved maps with references to dynamic map services
            allCategories: [], 

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
                        s.push('one topic');
                    } else if (self.mapServiceSearchResults().length > 1) {
                        s.push(self.mapServiceSearchResults().length + ' topics');
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
                topic.subscribe('layerLoader/mapLoaded', lang.hitch(this, 'mapLoaded'));

                //subscribe to the mapSaved topic, published by _LayerLoadMixin when the map is saved
                topic.subscribe('layerLoader/mapSaved', lang.hitch(this, 'mapSaved'));


                //subscribe to the layerLoader/layersChanged topic, to let use know they have unsaved changes
                topic.subscribe('layerLoader/layersChanged', lang.hitch(this, 'layersChanged'));

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

                //set up link for copying
                window.copyElem = function (elem) {
                    elem.select();
                    document.execCommand('copy');
                    //not obvious: topic.publish('growler/growl','Map Link copied to clipboard.');
                    //this only works once, getting it by ID the second time fails. domClass.remove('linkCopiedTip', 'hidden');
                    query('.linkCopiedTip').forEach(function (n) {
                        domClass.remove(n, 'hidden');
                    });
                    //todo an alternative way would be to make sure the dialog gets destroyed when done
                };

                //let the application know we're done starting up
                topic.publish('layerLoader/startupComplete');
            },

            /**
             * Called from postCreate, initializes the layer browser dialog, post-processes layerDefs from config/layerLoader.js
             * @returns {void}
             */
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

            /**
             * Called from postCreate via _intializeDialogs. Post-process categories to cross-reference layers and knockoutify
             * @returns {void}
             */
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

            /**
             * Called from startup, loads current user's saved maps from the server.
             * @returns {object} Deferred object to be resolved after DWR callback is complete, or rejected if error.
             */
            _loadSavedMaps: function () {
                var deferred = new Deferred();
                var self = this;
                //eslint-disable-next-line no-undef
                SavedMapDAO.getSavedMapNamesForCurrentUser({
                    callback: function (savedMaps) {
                        self.savedMaps(savedMaps);
                        deferred.resolve();
                    },
                    errorHandler: function (message, exception) {
                        topic.publish('viewer/handleError', {
                            source: 'LayerLoader._loadSavedMaps',
                            error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                        });
                        deferred.reject();
                    }
                });
                return deferred;
            },

            /**
             * Loads the selected map into the viewer, passing the map's id to layerLoader/loadMap
             * @returns {void}
             */
            loadSelectedMap: function () {
                if (this.selectedMap()) {
                    this.currentMap(this.selectedMap());
                    topic.publish('layerLoader/loadMap', this.selectedMap().id, this.clearMapFirst());
                    this.loadMapDialog.hide();
                }
            },

            /**
             * Prompts the user to confirm deleting the selected map. If confirmed, calls _deleteSelectedMap.
             * @returns {void}
             */
            deleteSelectedMap: function () {
                var sm = this.selectedMap();
                if (!sm) {
                    return;
                }
                new ConfirmDialog({
                    title: 'Confirm Delete',
                    content: 'Are you sure you want to delete the "' + sm.mapName + '" map?',
                    onExecute: lang.hitch(this, '_deleteSelectedMap')
                }).show();
            },

            /**
             * Callback from confirmation prompt in deleteSelectedMap. Calls the DWR function to delete the saved map.
             * @returns {void}
             */
            _deleteSelectedMap: function () {
                var self = this,
                    sm = this.selectedMap(); //selected in dialog
                    
                if (!sm) {
                    return;
                }

                //eslint-disable-next-line no-undef
                SavedMapDAO.deleteSavedMap(sm.id, {
                    callback: function (reply) {
                        //reply will be string "ok", or if we're out of sync with the database, or string starting with "Invalid map ID" (which means it was already deleted--either way, let's sync up our copy of the maps), or some other error message
                        if (reply === 'ok' || reply.startsWith('Invalid map ID')) {
                            self.savedMaps.remove(sm);
                            if (sm === self.currentMap()) {
                                self.currentMap(null);
                            }
                            self.selectedMap(null);
                        } else {
                            //some other error
                            topic.publish('growler/growlError', 'Error deleting map: ' + reply);
                        }
                    },
                    errorHandler: function (message, exception) {
                        topic.publish('viewer/handleError', {
                            source: 'LayerLoader._deleteSelectedMap',
                            error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2) //eslint-disable-line no-undef
                        });
                    }
                });
            },


            /**
             * Listens for the map loading complete, to handle loading via url.
             * @param {any} savedMap Reference to the saved map that was loaded
             * @returns {void}
             */
            mapLoaded: function (savedMap) {
                this.currentMap(savedMap);
                this.hasUnsavedChanges(false);
            },

            /**
             * Listens for the map saved complete, to reset hasUnsavedChanges
             * @returns {void}
             */
            mapSaved: function () {
                this.hasUnsavedChanges(false);
                if (this.waitingToShare) {
                    //temporary tag written to the model just so the dialog shows up at the right time
                    delete (this.waitingToShare);
                    this.shareMap();
                }
            },

            /**
             * Listens for changes made via addLayer or removeLayer functions, via layerLoader/layersChanged
             * @returns {void}
             */
            layersChanged: function () {
                this.hasUnsavedChanges(true);
            },

            /**
             * Listen for the keyDown event in the search field, to detect when enter key is typed
             * @param {any} event the keyDown event
             * @returns {void}
             */
            handleSearchKeyDown: function (event) {
                if (event.keyCode === 13) {
                    this.handleSearch();
                }
            },
            /**
             * Listen for the keyUp event in the Project field, to detect when enter key is typed
             * @param {any} event the keyUp event
             * @returns {void}
             */
            handleProjectKeyUp: function (event) {
                if (event.keyCode === 13) {
                    this.addProject();
                }
            },

            /**
             * Listen for the keyDown event in the map name field of the save dialog, to detect when enter key is typed
             * @param {any} event the keyUp event
             * @returns {void}
             */
            handleMapNameKeyUp: function (event) {
                if (event.keyCode === 13) {
                    this.saveMap();
                }
            },

            /**
             * Adds the project/project-alt identified by the value entered in the projectAltId field.
             * @returns {void}
             */
            addProject: function () {
                //TODO: first a quick DWR call to check if user can see it (valid project, if draft then only show if user has draft access, etc.)
                //either do that here or in addProjectToMap function
                topic.publish('layerLoader/addProjectToMap', this.projectAltId.value);
            },

            /**
             * Gets a saved map by its name, used to determine whether a user is overwriting an existing saved map
             * @param {any} mapName The name of the map to get.
             * @returns {object} A reference to the savedMap with the referenced mapName, or undefined if not found
             */
            getSavedMap: function (mapName) {
                var savedMap = this.savedMaps().find(function (sm) {
                    return sm.mapName === mapName;
                });
                return savedMap;
            },

            /**
             * Shows the Load Map dialog.
             * @returns {void}
             */
            showLoadMapDialog: function () {
                this.loadMapDialog.show();
            },

            /**
             * Shows the Save Map dialog.
             * @returns {void}
             */
            showSaveMapDialog: function () {
                //clear the error message and hide it
                html.set(this.saveMapError, '');
                domClass.add(this.saveMapError, 'hidden');
                if (this.currentMap()) {
                    this.mapName.set('value', this.currentMap().mapName);
                } else {
                    this.mapName.set('value', '');
                }
                this.saveMapDialog.show();
            },

            /**
             * Starts the process of saving a map. First checks to see if we already have a map with the given name (other than the current map)
             * via getSavedMap, and prompts user to overwrite if found. If not found, it's a new map name, and constructs the basic saved map object
             * to pass to _saveMap.
             * @returns {void}
             */
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
                } else if (typeof this.currentMap() === 'undefined' || this.currentMap().id !== savedMap.id) {
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

            /**
             * Called from saveMap function, passes on to layerLoader.saveMap
             * @param {any} savedMap The map to be saved (just ID and mapName, rest handled in layerLoader.saveMap
             * @returns {void}
             */
            _saveMap: function (savedMap) {
                var self = this;
                //create and attach deferred to the savedMap, to be resolved/rejected in _LayerLoadMixin.saveMap
                //(because it's a topic publish call, we can't rely on _layerLoadMixin to create the deferred and return it)
                savedMap.deferred = new Deferred();
                domClass.remove(this.saveMapWait, 'hidden');
                this.currentMap(savedMap);
                savedMap.deferred.then(
                    //callback
                    function () {
                        domClass.add(self.saveMapWait, 'hidden');
                        self.saveMapDialog.hide();
                    },
                    //error handler
                    function (err) {
                        domClass.add(self.saveMapWait, 'hidden');
                        html.set(self.saveMapError, 'Error saving map: ' + err);
                        domClass.remove(self.saveMapError, 'hidden');
                    });
                topic.publish('layerLoader/saveMap', savedMap);
            },

            /**
             * Starts the chain of showing the link for a shared map, prompting to save first if necessary.
             * @returns {void}
             */
            shareMap: function () {
                if (this.hasUnsavedChanges()) {
                    //prompt user to save
                    new ConfirmDialog({
                        title: 'Unsaved Changes',
                        content: 'You have unsaved changes, do you want to save first?',
                        onExecute: lang.hitch(this, '_saveAndShare'),
                        onCancel: lang.hitch(this, '_shareMap')
                    }).show();
                } else {
                    this._shareMap();
                }
            },

            /**
             * Continues the chain of saving and coming back to share the link after saving is complete
             * @returns {void}
             */
            _saveAndShare: function () {
                this.waitingToShare = true; //temporary tag read after saving is complete, which will then call _shareMap
                this.showSaveMapDialog();
            },

            /**
             * Final step in the chain of share the link to a saved map.
             * @returns {void}
             */
            _shareMap: function () {
                if (this.currentMap() && this.currentMap().id && this.currentMap().id > 0) {
                    //get the base url
                    var uri = window.location.href;
                    if (uri.indexOf('?') >= 0) {
                        uri = uri.substr(0, uri.indexOf('?'));
                    }
                    uri += '?loadMap=' + this.currentMap().id;
                    //try to copy it to the 
                    var dlg = new Dialog({
                        title: 'Map Link',
                        content: '<div class="mapLinkDiv">' +
                            '<p class="tip">Copy the link below and paste it into an email to share this map.</p>' +
                            '<input type="text" value="' + uri + '" class="mapLink" onclick="copyElem(this)" />' +
                            '<p class="tip hidden linkCopiedTip">Link copied to clipboard</p>' +
                            '</div>'
                    });
                    dlg.show();
                } else if (this.hasUnsavedChanges()) {
                    topic.publish('growler/growl', {
                        message: 'You must save the map before you can share it.',
                        title: null,
                        level: 'warning'
                    });
                } else {
                    topic.publish('growler/growl', {
                        message: 'You don\'t have any changes in the map to save, nothing to share.',
                        title: null,
                        level: 'warning'
                    });
                }
            },

            /**
             * Handles searching for layers and services, showing the search results.
             * @returns {void}
             */
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

            /**
             * Opens the layer browser dialog.
             * @returns {void}
             */
            browseLayers: function () {
                //resize to work around Dojo's auto-sizing limitations
                //it expects the content to have a fixed size, but we need it to be at least somewhat 
                //dynamic with regard to the size of the window
                var width = window.innerWidth * 0.85,
                    height = window.innerHeight * 0.7,
                    content = document.getElementById('layerLoaderDialog');

                content.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');

                this.layerBrowserDialog.show();
                
            }

        });
    });
