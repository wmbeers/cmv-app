define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dojox/image/LightboxNano',
    'dojo/ready',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/aspect',
    'dojo/dom',
    'dojo/dom-style',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/text!./LayerLoader/templates/layerLoader.html',
    'dojo/query',    
    'dijit/registry',
    'dijit/form/FilteringSelect',
    'xstyle/css!./LayerLoader/css/layerLoader.css',
    // If nested widgets fail on load try adding these
    'dijit/form/Form',
    'dijit/layout/ContentPane',
    'dijit/layout/TabContainer'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, LightboxNano, ready, popup, lang, array, on, aspect, dom, domStyle, domClass, domConstruct, 
        topic, layerLoaderTemplate, query, registry, fSelect
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: layerLoaderTemplate,
            topicID: 'layerLoader',            
            baseClass: 'layerLoader',
            map: this.map,
            //broader scope needed so declaring these here
            categoryDialog: null, 
            layerDialog: null,
            searchResultsDialog: null,
            postCreate: function () {
                this.inherited(arguments);

                on(this.searchButton, 'click', lang.hitch(this, 'handleSearch'));
                on(this.showCategoriesButton, 'click', lang.hitch(this, 'showCategories'));
                on(this.listAllButton, 'click', lang.hitch(this, 'listAllLayers'));
                
                this._initializeDialogs();
            },
            startup: function () {
                this.inherited(arguments);
            },
            handleSearch: function () {
                //filter this.allLayers
                //TODO lucene or some more powerful search engine will be replacing this
                var searchString = this.searchNode.value;
                var tokens = searchString.toLowerCase().split(' ');
                var matches = array.filter(this.allLayers, function (l) {
                    var x = array.some(tokens, function (s) {
                        var name = String(l.name).toLowerCase(), 
                            description = String(l.description).toLowerCase(), 
                            fullName = String(l.fullName).toLowerCase();

                        return (name.indexOf(s) >= 0 ||
                            description.indexOf(s) >= 0 ||
                            fullName.indexOf(s) >= 0);
                    });
                    if (x) return true;
                });
                var ul = domConstruct.toDom('<ul class="layerList"></ul>');
                matches.forEach(function (layerDef) {
                    var li = domConstruct.create('li', null, ul);
                    var a = domConstruct.create('a', { 'href': '#', 'innerHTML': layerDef.name, 'title': layerDef.description }, li);
                    on(a, 'click', lang.hitch(this, function () {
                        app.addToMap(layerDef);
                        this.layersDialog.hide();
                    }));
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
                var div = domConstruct.toDom('<div class="categoriesList"></div>');
                this.categoryDialog = new Dialog({
                    id: 'layerloader_categories_dialog',
                    title: 'Select Category',
                    content: div
                });
                
                this.categories.forEach(function (mapService) {
                    var span = domConstruct.create('span', null, div);
                    if (!mapService.iconUrl) {
                        //default to image named the same as the map service
                        mapService.iconUrl = mapService.name.replace(/\s/g, '_') + '.png';
                    }
                    domConstruct.create('img', { 'alt': mapService.name, 'src': 'js/gis/dijit/LayerLoader/images/' + mapService.iconUrl }, span);
                    domConstruct.create('br', null, span);
                    if (mapService.url) {
                        on(span, 'click', lang.hitch(this, function () {
                            app.addToMap(mapService);
                            this.categoryDialog.hide();
                        }));
                        domClass.add(span, 'enabled');
                        domConstruct.create('span', { 'innerHTML': mapService.name }, span);
                    } else {
                        domClass.add(span, 'disabled');
                        domConstruct.create('span', { 'innerHTML': mapService.name, 'disabled': true }, span);
                    }

                    }, this);

                //layers dialog
                var div2 = domConstruct.toDom('<ul class="layerList"></ul>');
                this.layersDialog = new Dialog({
                    id: 'layerloader_layers_dialog',
                    title: 'Select Layer',
                    content: div2
                });

                //sort layerDefs by name (we'll do this server-side eventually)
                this.allLayers.sort(function (a, b) {
                    if (a.name == b.name) return 0;
                    if (a.name > b.name) return 1;
                    return -1;
                });

                //add layerDefs to all-layers list
                this.allLayers.forEach(function (layerDef) {
                    var li = domConstruct.create('li', null, div2);
                    var a = domConstruct.create('a', { 'href': '#', 'innerHTML': layerDef.name, 'title': layerDef.description }, li);
                    on(a, 'click', lang.hitch(this, function () {
                        app.addToMap(layerDef);
                        this.layersDialog.hide();
                    }));
                }, this);

                //search results dialog (content added in search handler)
                this.searchResultsDialog = new Dialog({
                    id: 'layerloader_search_dialog',
                    title: 'Search Results'
                });
            },
            _initializeLayerLoader: function () {
                //flattened list of all layers--will be defined server-side eventually
                var layerDefs = [];
     
                this.categories.forEach(function (mapService) {
                    var span = domConstruct.create('span', null, this.ServicesList);
                    if (!mapService.iconUrl) {
                        //default to image named the same as the map service
                        mapService.iconUrl = mapService.name.replace(/\s/g, '_') + '.png';
                    }
                    domConstruct.create('img', {'alt': mapService.name, 'src': 'js/gis/dijit/LayerLoader/images/' + mapService.iconUrl}, span);
                    domConstruct.create('br', null, span);
                    if (mapService.url) {
                        on(span, 'click', lang.hitch(this, function () {
                            app.addToMap(mapService);
                        }));
                        domClass.add(span, 'enabled');
                        domConstruct.create('span', {'innerHTML': mapService.name}, span);

                        //TODO: it would be faster to do this server-side when generating layerLoader.js
                        //but for now this hackiness will suffice
                        mapService.layers.forEach(function (layerDef) {
                            layerDef.type = 'feature';
                            if (!array.some(layerDefs, function (ld) { return ld.sdeLayerName == layerDef.sdeLayerName; })) {
                                layerDefs.push(layerDef);
                            }
                        });
                    } else {
                        domClass.add(span, 'disabled');
                        domConstruct.create('span', {'innerHTML': mapService.name, 'disabled': true}, span);
                    }
                    
                }, this);

                //sort layerDefs by name (again, we'll do this server-side eventually)
                layerDefs.sort(function (a, b) {
                    if (a.name == b.name) return 0;
                    if (a.name > b.name) return 1;
                    return -1;
                });

                //add layerDefs to all-layers list
                layerDefs.forEach(function (layerDef) {
                    var li = domConstruct.create('li', null, this.LayersList);
                    var a = domConstruct.create('a', { 'href': '#', 'innerHTML': layerDef.name, 'title': layerDef.description }, li);
                    on(a, 'click', lang.hitch(this, function () {
                        app.addToMap(layerDef);
                    }));
                }, this);

            },
            openFilterHelp: function () {
                this.myDialog.show();
            }
        });
    });
