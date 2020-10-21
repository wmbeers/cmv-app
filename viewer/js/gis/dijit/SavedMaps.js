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

    'dojo/text!./SavedMaps/templates/sidebarAndDialogs.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./SavedMaps/templates/shareMapDialog.html', // template for the share saved map

    //jquery and jqueryUI, and custom ko Bindings needed for expandable categories
    'jquery',
    'jqueryUi',
    'koBindings',

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',
    'dijit/form/MultiSelect',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, request, lang, on, query, dom,
    domClass, html, topic, Memory, Deferred, sidebarAndDialogsTemplate, shareMapDialogTemplate
) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: sidebarAndDialogsTemplate,
        topicID: 'savedMaps',
        baseClass: 'savedMaps',
        map: this.map,

        //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
        saveMapDialog: null,
        shareMapDialog: null,

        //the array of saved maps (just id and mapName), loaded at startup
        savedMaps: ko.observableArray(),

        //represents the map selected in the loadMapDialog; not the same as the currentMap until the user clicks the open button
        selectedMap: ko.observable(),

        //represents the map currently loaded in the viewer; will just be the stub of id and mapName
        currentMap: ko.observable(),

        //option to get a public site version of the url
        sharePublic: ko.observable(false),

        //see also currentMapUri defined in postCreate. No amount of monkeying with defining a pureComputed at this level that references "this" gives me anything other than "this" = window, not this widget

        //boolean flag set to true after it's copied to windows clipboard
        linkCopied: ko.observable(false),

        //flags whether user wants to clear layers from the map before loading a new map
        clearMapFirst: ko.observable(false),

        //flags whether user wants to zoom to a saved map extent
        zoomToSavedMapExtent: ko.observable(false), // eslint-disable-line no-undef

        //tracks whether changes have been made to the map
        hasUnsavedChanges: ko.observable(false),

        //flattened list of all categories, used for loading saved maps with references to dynamic map services
        allCategories: [],

        postCreate: function () {
            this.inherited(arguments);

            //layerDefs are defined in LayerLoader widget, post-processed, and then set as a property of the map as that's the only reliable global object (app will not be a thing if debug=false)
            this.layerDefs = this.map.layerDefs;

            //represents the sharable URI for the map currently loaded in the viewer
            this.currentMapUri = ko.pureComputed(function () {
                if (this.currentMap() && this.currentMap().id && this.currentMap().id > 0) {
                    //get the base url
                    var uri = window.location.href;
                    if (uri.indexOf('?') >= 0) {
                        uri = uri.substr(0, uri.indexOf('?'));
                    }
                    if (this.sharePublic()) {
                        if (uri.indexOf('www.fla-etat.org') >= 0) {
                            //prod. Do we need to also take filegens into account? I think not.
                            uri = 'https://etdmpub.fla-etat.org/est/map/index.html';
                        } else if (uri.indexOf('preprod') >= 0 || uri.indexOf('preprod') >= 0) {
                            return null; //no public stage
                        } else {
                            uri = 'https://pubdev.fla-etat.org/est/secure/map/index.html';
                        }
                    }
                    uri += '?loadMap=' + this.currentMap().id;
                    return uri;
                }
                return null;
            }, this);
        },

        startup: function () {
            var self = this; //solves the problem of "this" meaning something different in onchange event handler
            this.inherited(arguments);

            //subscribe to the mapLoaded topic, published by _LayerLoadMixin when the map is loaded from query string
            topic.subscribe('savedMaps/mapLoaded', lang.hitch(this, 'mapLoaded'));

            //subscribe to the mapSaved topic, published by _LayerLoadMixin when the map is saved
            //topic.subscribe('savedMaps/mapSaved', lang.hitch(this, 'mapSaved'));

            //subscribe to the layerLoader/layersChanged topic, to let use know they have unsaved changes
            topic.subscribe('savedMaps/layersChanged', lang.hitch(this, 'layersChanged'));

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

            //share map dialog
            this.shareMapDialog = new Dialog({
                id: 'savedmap_share_map_dialog',
                title: 'Share Map',
                content: shareMapDialogTemplate
            });

            this._loadSavedMaps().then(function () {
                ko.applyBindings(self, dom.byId('savedMapsSidebar'));
                ko.applyBindings(self, dom.byId('shareMapDialog'));
                ko.applyBindings(self, dom.byId('loadMapDialog'));
                ko.applyBindings(self, dom.byId('saveMapDialog'));
            }); //note: we need to have this deferred and then apply bindings or the open button does nothing. I think because it's nested in a ko:if; if we can just disable it and keep it visible this deferred...then isn't necessary


            this._loadThematicMaps().then(function () {
                ko.applyBindings(self, dom.byId('thematicMaps'));
            }); //see note above

            //let the application know we're done starting up
            topic.publish('savedMaps/startupComplete');
        },

        /**
         * Called from startup, loads current user's saved maps from the server.
         * @returns {object} Deferred object to be resolved after DWR callback is complete, or rejected if error.
         */
        _loadSavedMaps: function () {
            var deferred = new Deferred();
            var self = this;

            MapDAO.getSavedMapNamesForCurrentUser({
                callback: function (savedMaps) {
                    self.savedMaps(savedMaps);
                    deferred.resolve();
                },
                errorHandler: function (message, exception) {
                    topic.publish('viewer/handleError', {
                        source: 'SavedMaps._loadSavedMaps',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                    });
                    deferred.resolve(); //don't reject! The app is waiting for this deferred to be resolved before calling ko.applyBindings
                }
            });

            return deferred;
        },

        _loadThematicMaps: function () {
            //TODO:
            var deferred = new Deferred(),
                self = this;

            //TODO DWR call. this is mockup
            self.thematicMaps([
                {
                    id: 1,
                    name: 'Aquifers'
                },
                {
                    id: 2,
                    name: 'Cultural Resources'
                },
                {
                    id: 3,
                    name: 'Land Use'
                },
                {
                    id: 4,
                    name: 'Safety'
                },
                {
                    id: 5,
                    name: 'Water Resources'
                }
            ]);
            window.setTimeout(function () {
                deferred.resolve();
            }, 1000);

            return deferred;
        },

        /**
            * Loads the selected map into the viewer, passing the map's id to savedMaps/loadMap
            * @returns {void}
            */
        loadSelectedMap: function () {
            if (this.selectedMap()) {
                this.currentMap(this.selectedMap());
                topic.publish('savedMaps/loadMap', this.selectedMap().id, this.clearMapFirst(), this.zoomToSavedMapExtent());
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

            MapDAO.deleteSavedMap(sm.id, {
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
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
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
        mapSaved: function () {
            this.hasUnsavedChanges(false);
            if (this.waitingToShare) {
                //temporary tag written to the model just so the dialog shows up at the right time
                delete (this.waitingToShare);
                this.shareMap();
            }
        },
         */

        /**
            * Listens for changes made via addLayer or removeLayer functions, via layerLoader/layersChanged
            * @returns {void}
            */
        layersChanged: function () {
            this.hasUnsavedChanges(true);
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
         * @param {any} savedMap The map to be saved (just ID and mapName, rest handled in layerLoader.saveMap)
         * @returns {void}
         */
        _saveMap: function (savedMap) {
            var self = this;
            //create and attach deferred to the savedMap, to be resolved/rejected in _LayerLoadMixin.saveMap
            //(because it's a topic publish call, we can't rely on _layerLoadMixin to create the deferred and return it)
            savedMap.deferred = new Deferred();
            domClass.remove(this.saveMapWait, 'hidden');
            savedMap.deferred.then(
                //callback
                function () {
                    //console.log('savedMap.deferred.callback');
                    //console.log('setting currentMap null');
                    //self.currentMap(null); //forces recomputation of currentMapUri
                    //console.log('setting currentMap to dummy');
                    //this.currentMap({ id: Date.now(), mapName: 'Empty' });
                    //console.log('setting currentMap to ' + (savedMap ? savedMap.id : 'savedMap but it is null'));
                    self.currentMap(savedMap);
                    domClass.add(self.saveMapWait, 'hidden');
                    self.saveMapDialog.hide();
                    self.hasUnsavedChanges(false);
                    if (self.waitingToShare) {
                        //temporary tag written to the model just so the dialog shows up at the right time
                        delete (self.waitingToShare);
                        self.shareMap();
                    }
                },
                //error handler
                function (err) {
                    //?todo? self.currentMap(null);
                    domClass.add(self.saveMapWait, 'hidden');
                    html.set(self.saveMapError, 'Error saving map: ' + err);
                    domClass.remove(self.saveMapError, 'hidden');
                });
            topic.publish('savedMaps/saveMap', savedMap); //passes control over to _LayerLoadMixin, we'll pick back up here with the callbacks in savedMap.deferred above
        },

        /**
         Starts the chain of showing the link for a shared map, prompting to save first if necessary.
         * @returns {void}
         */
        shareMap: function () {
            if (!this.currentMap() || this.hasUnsavedChanges()) {
                //prompt user to save
                var content = this.currentMap()
                    ? 'You have unsaved changes, do you want to save first?<br /><br />Click <strong>Yes</strong> to save and share your map with the latest changes.<br/>Click <strong>No</strong> to share the map from when it was last saved.'
                    : 'You must first save the map before you can share it. Do you want to save first?<br /><br />Click <strong>Yes</strong> to save and share your map. Click <strong>No</strong> to cancel.';
                var cd = new ConfirmDialog({
                    title: 'Unsaved Changes',
                    buttonOk: 'Yes', //Bug in dojo ConfirmDialog, this does nothing to set the button text, see set statement below
                    buttonCancel: 'No', //does nothing, see set below
                    content: content,
                    onExecute: lang.hitch(this, '_saveAndShare'),
                    onCancel: this.currentMap() ? lang.hitch(this, '_shareMap') : function () {
                        return false; // not sure if returning anything is necessary, we just want this dialog to go away
                    }
                });
                cd.set({
                    buttonOk: 'Yes',
                    buttonCancel: 'No'
                });
                cd.show();
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
            if (this.currentMap() && !this.hasUnsavedChanges()) {
                this.linkCopied(false);
                this.shareMapDialog.show();
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
            * Copies the current map URI to the windows clipboard
            * @returns {void}
            */
        copyCurrentMapUri: function () {
            //set up link for copying
            var elem = dom.byId('mapLink');
            elem.select();
            document.execCommand('copy');
            this.linkCopied(true);
        },

        thematicMaps: ko.observableArray(),

        selectedThematicMap: ko.observable(),

        loadThematicMap: function () {
            //TODO
        }

    });
});
