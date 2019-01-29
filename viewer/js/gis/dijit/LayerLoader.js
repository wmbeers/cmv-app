define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dojo/ready',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/dom',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/store/Memory',
    'dojo/text!./LayerLoader/templates/layerLoaderSidebar.html', // template for the widget in left panel
    'dojo/text!./LayerLoader/templates/layerLoaderDialog.html', // template for the dialog

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ready, popup, lang, array, on, dom, domConstruct, 
        topic, Memory, layerLoaderSidebarTemplate, layerLoaderDialogTemplate
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: layerLoaderSidebarTemplate,
            dialogTemplate: layerLoaderDialogTemplate,
            topicID: 'layerLoader',            
            baseClass: 'layerLoader',
            map: this.map,
            //broader scope needed for these dialogs to support closing when option is selected, so declaring these here
            categoryDialog: null, 
            layersDialog: null,
            searchResultsDialog: null,
            savedMaps: ko.observableArray(),
            selectedMap: ko.observable(),
            clearMapFirst: ko.observable(false),
            loadSelectedMap: function () {
                this.loadMap(this.selectedMap());
            },
            deleteSelectedMap: function () {
                this.savedMaps.remove(this.selectedMap());
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

                ko.applyBindings(this, dom.byId('savedMapsDialog'));
            },
            handleSearchKeyDown: function (event) {
                if (event.keyCode === 13) {
                    this.handleSearch();
                }
            },
            handleProjectKeyDown: function (event) {
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
            saveMap: function () {
                var mapName = this.mapName.value;
                if (!mapName) {
                    return;
                }

                //TODO confirm overwrite
                var savedMap = this.getSavedMap(mapName);
                if (!savedMap) {
                    //construct new
                    savedMap = {
                        name: mapName,
                        id: mapName //dojo needs this. Eventually we'll have our own server-provided ids
                    };
                    this.savedMaps.push(savedMap);
                }
                //get layers
                savedMap.layers = app.getLayerConfig();
                //TODO save to database/user config, not LSO
                localStorage.setItem('savedMaps', JSON.stringify(this.savedMaps()));
            },
            loadMap: function (savedMap) {
                //is it an object or just the name of a map?
                if (typeof savedMap === 'string') {
                    savedMap = this.getSavedMap(savedMap);
                }

                if (savedMap) {
                    app.loadLayerConfig(savedMap.layers, this.clearMapFirst());
                }
                //TODO: this happens too quickly, growling before all the layers are done loading.
                topic.publish('growler/growl', 'Loaded ' + savedMap.name);
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
                this.categoryDialog.show();
            },
            listAllLayers: function () {
                this.layersDialog.show();
            },
            _initializeDialogs: function () {
                //categories dialog
                this.categoryDialog = new Dialog({
                    id: 'layerloader_categories_dialog',
                    title: 'Layer Browser',
                    content: this.dialogTemplate,
                    style: 'width: 90%'
                });

                this.layerDefs.forEach(function (layerDef) {
                    layerDef.loadLayer = function () {
                        app.addToMap(layerDef);
                    };
                    layerDef.removeLayer = function () {
                        if (layerDef.layer) {
                            app.widgets.layerControl._removeLayer(layerDef.layer);
                        }
                    };
                    layerDef._legend = null;
                    //TODO make a request to get the legend, or pre-cache it
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
                    app.addToMap(layerDef);
                    this.layersDialog.hide();
                    this.searchResultsDialog.hide();
                }));
            }
        });
    });
