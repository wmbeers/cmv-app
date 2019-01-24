define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/topic',

    'esri/map',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/layers/VectorTileLayer',
    'esri/dijit/Legend',
    'esri/InfoTemplate',
    'esri/request',
    'esri/tasks/ProjectParameters',
    'esri/tasks/query',
    'esri/geometry/Extent',
    'esri/renderers/SimpleRenderer'
], function (
    declare,
    lang,
    array,
    on,
    topic,

    Map,
    ArcGISDynamicMapServiceLayer,
    FeatureLayer,
    VectorTileLayer,
    Legend,
    InfoTemplate,
    esriRequest,
    ProjectParameters,
    Query,
    Extent,
    SimpleRenderer
) {

    return declare(null, {

        startup: function () {
            //nothing really to do here
        },

        getLayerDef: function (sdeLayerNameOrUrl) {
            for (var i = 0; i < this.categories.length; i++) {
                var category = this.categories[i];
                if (category.name === sdeLayerNameOrUrl) {
                    return category;
                }
                if (category.layersDefs) {
                    for (var j = 0; j < category.layersDefs.length; j++) {
                        var l = category.layersDefs[j];
                        if (l.url === sdeLayerNameOrUrl || l.sdeLayerName === sdeLayerNameOrUrl) {
                            return l;
                        }
                    }
                }
            }
            //maybe it's just a plain old URL?
            if (sdeLayerNameOrUrl.toLowerCase().startsWith('http')) {
                //TODO construct a new layerDef
                //we need to determine if it's a map service (dynamic) or layer (featureLayer)
                //or any other URL-based thing, see DnD for examples
            }
            //if we make it this far, it's a problem
            topic.publish('viewer/handleError', {
                source: 'LayerLoadMixin.getLayerDef',
                error: 'Unable to find definition for category with name or layer with sdeLayerName or URL "' + sdeLayerNameOrUrl + '"'
            });

            return null; //just to shut up eslint
        },

        addToMap: function (layerDef, definitionExpression, includeDefinitionExpressionInTitle, renderer) {
            var layer = null;

            if (typeof layerDef === 'string') {
                //find layer by sdeLayerName or url property
                layerDef = this.getLayerDef(layerDef);
                if (!layerDef) {
                    return null;
                }
            }

            if (layerDef.type === 'category') {
                //a pre-defined collection of layers (may also include user-defined in the future)
                //what will be reported at the end
                //How many layers loaded
                var layerCount = 0;
                //TODO Whether or not any of them are out of scale range--tricky because we run into a race condition with the layers loading
                layerDef.layerDefs.forEach(function (categorylayerDef) {
                    layerCount++;
                    //clone it (so grouping won't screw it up later)
                    var ld = lang.clone(categorylayerDef);
                    //group it
                    ld.layerGroup = layerDef.name;
                    //add it
                    this.addToMap(ld);
                }, this);

                topic.publish('growler/growl', 'Loaded ' + layerCount + ' layers for category ' + layerDef.name);


                return null; //TODO return an array or something
            }

            //test if it's already in the map by url and definitionExpression
            if (array.some(this.layers, function (l) {
                if (l.url === layerDef.url && l.getDefinitionExpression && l.getDefinitionExpression() === definitionExpression) {
                    //assign reference
                    layer = l;
                    //Make it visible
                    l.setVisibility(true); // use this method rather than .visible property to keep LayerControl in sync
                    //rezoom--user might have panned/zoomed elsewhere, but are requesting to go back
                    this.zoomToLayer(l);
                    //Warn if not visible at current scale
                    if (!l.visibleAtMapScale) {
                        topic.publish('growler/growl', {
                            title: '',
                            message: layerDef.name + ' is already loaded in the map, but is not visible at the current map scale.',
                            level: 'warning'
                        });
                    }
                    return true; //shortcuts the array.some call to stop looping through layers
                }
                return false; //not really necessary, but prevents a consistent-return eslint error
            }, this)) {
                return layer;
            }

            if (layerDef.layerGroup === null) {
                topic.publish('growler/growl', 'Loading ' + layerDef.name);
            }

            //Note: I tried app.initLayer, and while it does do a great job of adding the layer to the map, 
            //it doesn't then call functions to make it show up in the LayerControl widget
            //app._initLayer(layerDef, ArcGISDynamicMapServiceLayer);

            if (layerDef.type === 'dynamic') {
                layer = new ArcGISDynamicMapServiceLayer(layerDef.url,
                    {
                        //opacity: 0.75, //todo store in config?
                        //todo either use db id or just let this be autoassigned id: layerDef.name,
                        //infoTemplate: new InfoTemplate('Attributes', '${*}')
                    });
            } else if (layerDef.type === 'feature') {
                layer = new FeatureLayer(layerDef.url,
                    {
                        outFields: '*' //necessary to have this to get any attributes returned, but TODO we might want to store that in layerDef?
                        //opacity: 0.75, //todo store in config?
                        //todo either use db id or just let this be autoassigned id: layerDef.name,
                        //infoTemplate: new InfoTemplate('Attributes', '${*}')
                    });
            } else if (layerDef.type === 'vectortile') {
                layer = new VectorTileLayer(layerDef.url);
            } else {
                throw new Error('Unsupported or undefined type property of layerDef: ' + layerDef.type);
            }

            //definitionExpression only applies to a featureLayer
            //but we can support it for projects loaded via dynamic map service, applying it to all feature layers in the service
            if (definitionExpression) {
                if (layerDef.type === 'dynamic') {
                    //TODO see https://developers.arcgis.com/javascript/3/jsapi/arcgisdynamicmapservicelayer-amd.html#setlayerdefinitions
                } else if (layerDef.type === 'feature') {
                    layer.setDefinitionExpression(definitionExpression);
                }
            }
            if (renderer) {
                layer.setRenderer(renderer);
            }

            //cross-reference
            layer.layerDef = layerDef;
            layerDef.layer = layer;

            //Note: _MapMixin adds layers to the layers control with unshift, e.g.:
            //layers.unshift(l)
            //but that's to keep it in the order in which they're listed in operationalLayers;
            //we're using push so they appear on top. If we want them to appear under the projects
            //change the next line to unshift
            app.layers.push(layer);
            //construct on-load handler. The layer needs to be loaded before getting the layerInfo
            //and adding to layerControl widget
            on(layer, 'load', function () {
                if (layer.layerDef.loaded) {
                    layer.layerDef.loaded(true);
                }
                //I don't know why we need to make this separate esriRequest, but the layer won't show up in layerControl
                //unless we do. We don't do anything with the response. It's cribbed from DnD plug in, DroppedItem.js.
                esriRequest({
                    url: layerDef.url,
                    content: {f: 'json'},
                    handleAs: 'json',
                    callbackParamName: 'callback'
                }).then(function () {
                    //copy extended properties from our database and append to the sublayers
                    //this relies on our JS being in perfect sync with what's actually being served!
                    if (layerDef.layers) {
                        for (var i = 0; i < layerDef.layers.length; i++) {
                            //response.layers[i].sdeLayerName = layerDef.layers[i].sdeLayerName;
                            layer.layerInfos[i].sdeLayerName = layerDef.layers[i].sdeLayerName;
                        }
                    }
                    if (layerDef.sdeLayerName) {
                        layer.sdeLayerName = layerDef.sdeLayerName;
                    }
                    //todo: put this in config? Or have some default options if not in config?
                    var layerControlInfo = {
                        controlOptions: {
                            expanded: false,
                            metadataUrl: true,
                            //includeUnspecifiedLayers: true, //TODO: if this is included, the service doesn't load properly for some reason, and no layers show up.
                            swipe: true,
                            noMenu: false,
                            noZoom: true, //TODO: disable zoom to layer for state-wide layers?
                            mappkgDL: true,
                            allowRemove: true,
                            layerGroup: layerDef.layerGroup,
                            //TODO: documentation on this is really confusing, neither of these work
                            //menu: {
                            //    dynamic: {
                            //        label: 'Wny does this not show up?',
                            //        topic: 'remove',
                            //        iconClass: 'fa fa-info fa-fw'
                            //    }
                            //},
                            //menu: [{
                            //    label: 'Wny does this not show up?',
                            //    topic: 'remove',
                            //    iconClass: 'fa fa-info fa-fw'
                            //}],
                            //Note: the following is what's documented on the CMV site, but doesn't work, 
                            //see below for the correct way discovered via trial-and-error
                            // gives all dynamic layers the subLayerMenu items
                            //subLayerMenu: {
                            //    dynamic: [{
                            //        label: 'Query Layer...',
                            //        iconClass: 'fa fa-search fa-fw',
                            //        topic: 'queryLayer'
                            //    }, {
                            //        label: 'Open Attribute Table',
                            //        topic: 'openTable',
                            //        iconClass: 'fa fa-table fa-fw'
                            //    }]
                            //},
                            //TODO finish working on menus
                            subLayerMenu: [
                                {
                                    label: 'Query Layer...',
                                    iconClass: 'fa fa-search fa-fw',
                                    topic: 'queryLayer'
                                }, {
                                    label: 'Open Attribute Table',
                                    topic: 'openTable',
                                    iconClass: 'fa fa-table fa-fw'
                                }, {
                                    label: 'View Metadata',
                                    topic: 'viewMetadata',
                                    iconClass: 'fa fa-info-circle fa-fw'
                                }]
                        },
                        layer: layer,
                        title: layerDef.name,
                        type: layerDef.type
                        
                    };
                    if (definitionExpression && includeDefinitionExpressionInTitle !== false) {
                        //TODO: this is just a proof of concept, we'll probably want something cleaner than raw definitionExpression
                        layerControlInfo.title = layerControlInfo.title + ' (' + definitionExpression + ')';
                    }
                    topic.publish('layerControl/addLayerControls', [layerControlInfo]); //TODO the whole collection of layers to be added should be passed at once for layerGroup to do anything.
                    topic.publish('identify/addLayerInfos', [layerControlInfo]);
                    app.legendLayerInfos.push(layerControlInfo);
                    //topic.publish('identify/addLayerInfos', [{
                    //    type: layerDef.type,
                    //    layer: layer,
                    //    title: layerDef.name
                    //}]);
                    //app.legendLayerInfos.push({ layer: layer, title: layerDef.name });

                    if (definitionExpression) {
                        //zoom to layer
                        app.zoomToLayer(layer);
                        //TODO? is it possible after zooming to the defined features (which, as far our documented requirements go, will be just one)
                        //it's still not visible? if so, need a callback handler after zooming
                        //with visibleAtMapScale check, like below
                    }
                    //Report it's been loaded, suppressed if we're adding a whole category
                    if (layerDef.layerGroup === null) {
                        if (!layer.visibleAtMapScale) {
                            topic.publish('growler/growl', {
                                title: '',
                                message: layerDef.name + ' loaded, but is not visible at the current map scale.',
                                level: 'warning'
                            });
                        } else {
                            topic.publish('growler/growl', layerDef.name + ' loaded.');
                        }
                    }
                }, function (error) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.addToMap',
                        error: error
                    });
                }).catch(function (error) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.addToMap',
                        error: error
                    });
                });

            }); //end on-load

            //add the layer to the map
            app.map.addLayer(layer);

            return layer;
        },

        //TODO: support adding draft projects to map for editing
        addProjectToMap: function (projectId, altNumber) {
            //TODO just set this in the map service rather than having to code in js
            var renderer = new SimpleRenderer({
                'type': 'simple',
                'symbol': {
                    'type': 'esriSFS',
                    'style': 'esriSFSSolid',
                    'color': [255, 255, 0, 180],
                    'outline': {
                        'type': 'esriSLS',
                        'style': 'esriSLSSolid',
                        'color': [255, 255, 0, 255],
                        'width': 3
                    }
                }
            });
            var definitionQuery;
            if (altNumber) {
                definitionQuery = 'alt_id = \'' + projectId + '-' + altNumber + '\'';
            } else {
                definitionQuery = 'alt_id like \'' + projectId + '-%\'';
            }

            this.addToMap(
                {
                    name: 'Project # ' + projectId + (altNumber ? '-' + altNumber : ''),
                    url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Query_MMA_Dev/MapServer/0',
                    type: 'feature',
                    sdeLayerName: null //only needed for metadata
                },
                definitionQuery,
                false, //prevents definitionExpression from overriding title TODO cleaner method of handling this
                renderer
            );
        },

        zoomToLayer: function (layer) {
            //this.zoomToExtent([layer.fullExtent]); //unfortunately, this doesn't take definitionExpression into account
            var q = new Query({
                where: '1=1' //definitionExpression, if present doesn't need to be re-applied
            });
            layer.queryExtent(q, function (r) {
                app.zoomToExtent(r.extent);
            }, function (e) {
                topic.publish('viewer/handleError', {
                    source: 'LayerLoadMixin.zoomToLayer',
                    error: e
                });
            });
        },

        zoomToExtent: function (extent) {
            var map = this.map;
            //project the extent--most often we're getting an extent from one of our layers,
            //and the extent will be in Albers; need to project it to the Map's World Mercator coordinate system
            var params = lang.mixin(new ProjectParameters(), {
                geometries: [extent],
                outSR: map.spatialReference
            });
            esriConfig.defaults.geometryService.project(params, 
                function (r) {
                    //we could just call setExtent with r[0], but if the extent is of a point, 
                    //it results in the map just panning to the point and staying at whatever zoom 
                    //level the map currently is at, even statewide; and if extent of line/poly
                    //it often zooms in too tightly.
                    //To handle this, we create an Extent object, then expanding it if it's a line/poly
                    //or just center and zoom if a point
                    extent = new Extent(r[0]);
                    if (extent.getWidth() === 0 && extent.getHeight() === 0) {
                        //expanding it has no effect, so just use center and zoom
                        map.centerAndZoom(extent.getCenter(), 21);
                    } else {
                        extent.expand(1.1);
                        map.setExtent(extent, true);
                    }
                }, function (e) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.zoomToExtent',
                        error: e
                    });
                }
            );
        }
    });
});
