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
    'dojo/text!./LayerLoader/templates/layerLoaderSidebar.html', // template for the widget in left panel
    'dojo/text!./LayerLoader/templates/layerLoaderDialog.html', // template for the dialog
    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ready, popup, lang, array, on, dom, domConstruct, 
        topic, layerLoaderSidebarTemplate, layerLoaderDialogTemplate
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
            postCreate: function () {
                this.inherited(arguments);

                on(this.searchNode, 'keydown', lang.hitch(this, 'handleSearchKeyDown'));
                on(this.searchButton, 'click', lang.hitch(this, 'handleSearch'));
                on(this.showCategoriesButton, 'click', lang.hitch(this, 'showCategories'));
                on(this.listAllButton, 'click', lang.hitch(this, 'listAllLayers'));

                on(this.projectId, 'keydown', lang.hitch(this, 'handleProjectKeyDown'));
                on(this.altNumber, 'keydown', lang.hitch(this, 'handleProjectKeyDown'));
                on(this.addProjectToMapButton, 'click', lang.hitch(this, 'addProject'));
                
                this._initializeDialogs();
            },
            startup: function () {
                this.inherited(arguments);
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
                    this.projectId.value,
                    this.altNumber.value
                );
            },
            handleSearch: function () {
                //filter this.layerDefs
                //TODO lucene or some more powerful search engine will be replacing this
                var searchString = this.searchNode.value;
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
                        var minScale = layerDef.layer == null ? layerDef.minScale : layer.minScale;
                        var maxScale = layerDef.layer == null ? layerDef.maxScale : layer.maxScale;

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
