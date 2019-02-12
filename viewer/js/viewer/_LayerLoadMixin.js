define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/topic',
    'dojo/Deferred',
    'dojo/promise/all',

    'esri/map',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/layers/VectorTileLayer',
    'esri/dijit/Legend',
    'esri/InfoTemplate',
    'esri/request',
    'esri/tasks/ProjectParameters',
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    'esri/geometry/Extent',
    'esri/renderers/SimpleRenderer'
], function (
    declare,
    lang,
    array,
    on,
    topic,
    Deferred,
    all,

    Map,
    ArcGISDynamicMapServiceLayer,
    FeatureLayer,
    VectorTileLayer,
    Legend,
    InfoTemplate,
    esriRequest,
    ProjectParameters,
    Query,
    QueryTask,
    Extent,
    SimpleRenderer
) {

    return declare(null, {

        startup: function () {
            //subscribe to topics
            topic.subscribe('layerControl/openAttributeTable', lang.hitch(this, 'openAttributeTable'));

            //topic.subscribe('layerControl/openAttributeTable', lang.hitch(this, function (args) {
            //    debugger;
            //    //this.togglePane(args.pane, args.show, args.suppressEvent);
            //}));

        },

        openAttributeTable: function (layerControlItem) {
            var tableOptions = {
                title: layerControlItem.layer.name,
                topicID: layerControlItem.layer.id,
                queryOptions: {
                    queryParameters: {
                        url: layerControlItem.layer.url,
                        maxAllowableOffset: 100, // TODO this is used for generalizing geometries. At this setting, they polygons are highly generalized
                        where: layerControlItem.layer.getDefinitionExpression() || '1=1',
                        geometry: app.map.extent //TODO should we be filtering by map extent?
                    },
                    idProperty: 'AUTOID' // TODO get this from the layer's fields property
                },
                toolbarOptions: {
                    export: {
                        show: false
                    }
                },
                displaySourceGraphic: false //a new option I am adding to AttributesTable TODO make this do something
                //note: tried the following, but it just uses default symbols
                //symbolOptions: {
                //    source: { point: null, polyline: null, polygon: null }
                //}
            };
            topic.publish('attributesTable/addTable', tableOptions);
        },

        getLayerDef: function (sdeLayerNameOrUrl) {
            var categories = this.widgets.layerLoader.categories;
            var layerDefs = this.widgets.layerLoader.layerDefs;

            if (typeof sdeLayerNameOrUrl === 'number') {
                var ld = layerDefs.find(function (layerDef) {
                    return layerDef.id === sdeLayerNameOrUrl;
                });
                //if we make it this far, it's a problem
                if (ld === null) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.getLayerDef',
                        error: 'Unable to find definition for layerDef with id ' + sdeLayerNameOrUrl
                    });
                }
                return ld;
            }
            for (var i = 0; i < categories.length; i++) {
                var category = categories[i];
                if (category.name === sdeLayerNameOrUrl) {
                    return category;
                }
                if (category.layersDefs) {
                    for (var j = 0; j < category.layersDefs.length; j++) {
                        var l = category.layersDefs[j];
                        if (l.url === sdeLayerNameOrUrl || l.layerName === sdeLayerNameOrUrl) {
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
                error: 'Unable to find definition for category with name or layer with layerName or URL "' + sdeLayerNameOrUrl + '"'
            });

            return null; //just to shut up eslint
        },

        constructLayer: function (layerDef, definitionExpression, includeDefinitionExpressionInTitle, renderer) {
            var layer = null;

            if (typeof layerDef === 'string' || typeof layerDef === 'number') {
                //find layer by id, layerName, or url property
                layerDef = this.getLayerDef(layerDef);
                if (!layerDef) {
                    return null; //error has already been handled in getLayerDef
                }
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
            layerDef.title = layerDef.name;
            if (definitionExpression) {
                if (layerDef.type === 'dynamic') {
                    //TODO see https://developers.arcgis.com/javascript/3/jsapi/arcgisdynamicmapservicelayer-amd.html#setlayerdefinitions
                } else if (layerDef.type === 'feature') {
                    layer.setDefinitionExpression(definitionExpression); //TODO need to be careful we're not overwritting any service defined def expressions. We don't have any yet, but if we do we'll need to deal with merging them together somehow.
                }
                if (includeDefinitionExpressionInTitle) {
                    layerDef.title = layerDef.name + ' (' + definitionExpression + ')'; //TODO some cleaner way of indicating data are filtered
                }
            }
            if (renderer) {
                layer.setRenderer(renderer);
            }

            //cross-reference
            layer.layerDef = layerDef;
            layerDef.layer = layer;

            return layer;
        },
        //layer has to be built with constructLayer, so that the fully-formed layerDef object is added to it
        addLayer: function (layer) {
            var deferred = new Deferred();
            var layerDef = layer.layerDef;

            //Note: _MapMixin adds layers to the layers control with unshift, e.g.:
            //layers.unshift(l)
            //but that's to keep it in the order in which they're listed in operationalLayers;
            //we're using push so they appear on top. If we want them to appear under the projects
            //change the next line to unshift
            app.layers.push(layer);

            //construct on-load handler. The layer needs to be loaded before getting the layerInfo
            //and adding to layerControl widget
            on(layer, 'load', function () {
                if (layerDef.loaded) { //if it has a loaded observable, assign it to true. (It always does when it's a layerDef defined by our system)
                    layerDef.loaded(true);
                }
                //I don't know why we need to make this separate esriRequest, but the layer won't show up in layerControl
                //unless we do. We don't do anything with the response. It's cribbed from DnD plug in, DroppedItem.js.
                esriRequest({
                    url: layerDef.url,
                    content: {
                        f: 'json'
                    },
                    handleAs: 'json',
                    callbackParamName: 'callback'
                }).then(function () {
                    //copy extended properties from our database and append to the sublayers
                    //this relies on our JS being in perfect sync with what's actually being served!
                    //we don't need this next block
                    if (layerDef.layers) {
                        for (var i = 0; i < layerDef.layers.length; i++) {
                            //response.layers[i].layerName = layerDef.layers[i].layerName;
                            layer.layerInfos[i].layerName = layerDef.layers[i].layerName;
                        }
                    }
                    if (layerDef.layerName) {
                        layer.layerName = layerDef.layerName;
                    }
                    //todo: put this in config? Or have some default options if not in config?
                    var layerControlInfo = {
                        controlOptions: {
                            expanded: false,
                            metadataUrl: true,
                            //includeUnspecifiedLayers: true, //TODO: if this is included, the service doesn't load properly for some reason, and no layers show up.
                            swipe: true,
                            noMenu: false,
                            noZoom: false,
                            mappkgDL: true,
                            allowRemove: true,
                            //layerGroup: layerDef.layerGroup,
                            //TODO: documentation on this is really confusing, neither of these work
                            //menu: {
                            //    dynamic: {
                            //        label: 'Wny does this not show up?',
                            //        topic: 'remove',
                            //        iconClass: 'fa fa-info fa-fw'
                            //    }
                            //},
                            menu: [{
                                label: 'Open Attribute Table',
                                topic: 'openAttributeTable',
                                iconClass: 'fa fa-table fa-fw'
                            }]
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
                            //subLayerMenu: [
                            //    //{
                            //    //    label: 'Query Layer...',
                            //    //    iconClass: 'fa fa-search fa-fw',
                            //    //    topic: 'queryLayer'
                            //    //},
                            //    {
                            //        label: 'Open Attribute Table',
                            //        topic: 'openTable',
                            //        iconClass: 'fa fa-table fa-fw'
                            //    },
                            //    {
                            //        label: 'View Metadata',
                            //        topic: 'viewMetadata',
                            //        iconClass: 'fa fa-info-circle fa-fw'
                            //    }]
                        },
                        layer: layer,
                        title: layerDef.title,
                        type: layerDef.type

                    };
                    topic.publish('layerControl/addLayerControls', [layerControlInfo]); //TODO the whole collection of layers to be added should be passed at once for layerGroup to do anything.
                    topic.publish('identify/addLayerInfos', [layerControlInfo]);
                    app.legendLayerInfos.push(layerControlInfo);

                    if (layer.getDefinitionExpression()) { //TODO there might be some pre-defined layers with definition expressions assigned in map service. None yet, but if there are we need some other way to handle deciding when to zoom
                        //zoom to layer
                        app.zoomToLayer(layer);
                        //TODO? is it possible after zooming to the defined features (which, as far our documented requirements go, will be just one)
                        //it's still not visible? if so, need a callback handler after zooming
                        //with visibleAtMapScale check, like below
                    }
                    if (!layer.visibleAtMapScale) {
                        topic.publish('growler/growl', {
                            title: '',
                            message: layerDef.name + ' loaded, but is not visible at the current map scale.',
                            level: 'warning'
                        });
                    } else {
                        topic.publish('growler/growl', layerDef.name + ' loaded.');
                    }
                    deferred.resolve(layer);

                }, function (error) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.addLayer',
                        error: error
                    });
                }).catch(function (error) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.addLayer',
                        error: error
                    });
                });

            }); //end on-load

            //add the layer to the map
            app.map.addLayer(layer);

            return deferred;
        },

        //TODO: support adding draft projects to map for editing
        addProjectToMap: function (projectAltId) {
            var self = this; //so we don't lose track buried down in callbacks
            //figure out if we're zooming to a project or just a specific alt
            var definitionQuery;
            if (projectAltId.indexOf('-') > 0) {
                definitionQuery = 'alt_id = \'' + projectAltId + '\'';
            } else {
                definitionQuery = 'alt_id like \'' + projectAltId + '-%\'';
            }

            //validate the projectAltId
            var query = new Query();
            query.where = definitionQuery;
            var queryTask = new QueryTask('https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Query_MMA_Dev/MapServer/0');
            var deferred = new Deferred();
            queryTask.executeForCount(query, function (count) {
                if (count === 0) {
                    //no features found
                    topic.publish('growler/growl', {
                        title: 'Invalid Project/Alt ID',
                        message: 'No projects found with project/Alt ID ' + projectAltId,
                        level: 'error'
                    });
                    deferred.cancel('Invalid project/alt ID');
                } else {
                    //load it!
                    var projectLayer = self.constructLayer(
                        {
                            name: 'Project # ' + projectAltId,
                            id: 'project_' + projectAltId.replace('-', '_'),
                            url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Query_MMA_Dev/MapServer/0',
                            type: 'feature',
                            projectAltId: projectAltId, //used when saving to layerconfig
                            layerName: null //only needed for metadata
                        },
                        definitionQuery,
                        false, //prevents definitionExpression from overriding title TODO cleaner method of handling this
                        //todo just set this in the map service rather than having to code in js
                        //currently it's the right color, but the width is too narrow
                        new SimpleRenderer({
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
                        })
                    );
                    //resolve deferred via addLayer method
                    //todo how to handle error?
                    self.addLayer(projectLayer).then(
                        function (l) {
                            deferred.resolve(l);
                        });
                }

            }, function (e) {
                topic.publish('viewer/handleError', {
                    source: 'LayerLoadMixin.addProjectToMap',
                    error: e
                });
                deferred.cancel('Invalid project/alt ID');
            });

            return deferred;
        },

        zoomToLayer: function (layer) {

            if (layer.getDefinitionExpression && layer.getDefinitionExpression()) {
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
            } else {
                app.zoomToExtent(layer.fullExtent);
            }
        },

        zoomToExtent: function (extent) {
            var map = this.map;
            if (extent.spatialReference === map.spatialReference) {
                map.setExtent(extent, true);
            } else if (esriConfig.defaults.geometryService) {
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
            } else {
                topic.publish('viewer/handleError', {
                    source: 'LayerLoadMixin.zoomToExtent',
                    error: 'esriConfig.defaults.geometryService is not set'
                });
            }
        },

        getLayerConfig: function () {
            return array.map(this.layers, function (layer) {
                var x = {
                    url: layer.url, //TODO this will change if we support uploaded shapefiles
                    name: layer._name || layer.id,
                    visible: layer.visible,
                    id: layer.id, 
                    definitionExpression: layer.getDefinitionExpression ? layer.getDefinitionExpression() : null
                };
                if (layer.layerDef) {
                    x.id = layer.layerDef.id; //for layers loaded via layerLoader
                    if (layer.name === 'Milestone Max Alternatives') {
                        //special case for our project/alt layers
                        x.projectAltId = layer.layerDef.projectAltId;
                    }
                }
                return x;
            });
        },

        loadLayerConfig: function (layerConfig, clearMapFirst) {
            var deferred = new Deferred();
            var promises = [];
            if (clearMapFirst) {
                //clone the layers array first, otherwise forEach bails
                var layerClone = this.layers.slice(0);
                layerClone.forEach(function (layer) {
                    if (layer.id !== 'Projects' && (layerConfig.includesProjects || layer.name !== 'Milestone Max Alternatives')) {
                        this.widgets.layerControl._removeLayer(layer);
                    }
                }, this);
            }

            //load in reverse order
            for (var i = layerConfig.length - 1; i >= 0; i--) {
                var layer = null,
                    layerConfigItem = layerConfig[i];
                //ignore projects (for now) TODO still important to know the order
                if (layerConfigItem.id === 'Projects') {
                    //don't load these for now--hard-coded in viewer.js
                } else if (layerConfigItem.name === 'Milestone Max Alternatives' && layerConfigItem.projectAltId) {
                    promises.push (this.addProjectToMap(layerConfigItem.projectAltId));
                    if (layerConfigItem.visible === false) {
                        layer.visible = false;
                    }
                } else {
                    layer = this.constructLayer(layerConfigItem.id, layerConfigItem.definitionExpression);
                }
                if (layer) {
                    promises.push(this.addLayer(layer));
                    if (layerConfigItem.visible === false) {
                        layer.visible = false;
                    }
                }
            }

            if (promises.length > 0) {
                all(promises).then(function (layers) {
                    deferred.resolve(layers);
                });
            }

            return deferred;
        }
    });
});
