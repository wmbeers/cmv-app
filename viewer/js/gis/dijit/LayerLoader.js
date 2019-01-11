define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/TooltipDialog',
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
    'dojo/text!./LayerLoader/templates/layerLoaderTooltip.html',
    'dojo/query',    
    'dijit/registry',
    'dijit/form/FilteringSelect',
    'xstyle/css!./LayerLoader/css/layerLoader.css',
    // If nested widgets fail on load try adding these
    'dijit/form/Form',
    'dijit/layout/ContentPane',
    'dijit/layout/TabContainer'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, TooltipDialog, LightboxNano, ready, popup, lang, array, on, aspect, dom, domStyle, domClass, domConstruct, 
        topic, layerLoaderTemplate, layerLoaderTooltipTemplate, query, registry, fSelect
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: layerLoaderTemplate,
            tooltiptemplateString: layerLoaderTooltipTemplate,            
            topicID: 'layerLoader',            
            baseClass: 'layerLoader',
            map: this.map,
            postCreate: function () {
                this.inherited(arguments);
                this._initializeLayerLoader();
            },
            startup: function () {
                this.inherited(arguments);
                this.initializeTooltip();
            },
            initializeTooltip: function () {
                // tooltip Dialog
                this.inherited(arguments);

                var myTooltipDialog = new TooltipDialog({
                    id: 'myTooltipDialog',
                    style: 'width: 300px;',
                    templateString: layerLoaderTooltipTemplate,
                    onShow: function () {
                        // Focus the first element in the TooltipDialog
                        this.focus();
                    },                    
                    _onBlur: function () {
                        // User must have clicked a blank area of the screen, so close the TooltipDialog
                        // popup.close(myTooltipDialog);
                    },                 
                    onClick: function (evt) {
                        if (evt.target === this.slrTTCloseNode) {
                            popup.close(myTooltipDialog);
                        }
                    }
                });
                this.layerLoaderTooltip = myTooltipDialog;    
                this.layerLoaderTooltip.startup();

                on(this.layerLoaderHelpNode, 'click', function () {
                    popup.open({
                        popup: myTooltipDialog,
                        around: dom.byId('tooltipNode'),
                        onCancel: function () {                            
                            // User pressed escape, so close myself
                            popup.close(myTooltipDialog);
                        }
                    });
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
