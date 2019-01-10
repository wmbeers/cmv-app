define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/topic',

    'esri/map',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/dijit/Legend',
    'esri/InfoTemplate',
    'esri/request',
    'esri/tasks/ProjectParameters',
    'esri/tasks/query',
    'esri/geometry/Extent'


], function (
    declare,
    lang,
    array,
    on,
    topic,

    Map,
    ArcGISDynamicMapServiceLayer,
    FeatureLayer,
    Legend,
    InfoTemplate,
    esriRequest,
    ProjectParameters,
    Query,
    Extent
) {

    return declare(null, {

        startup: function () {
            //nothing really to do here
            console.log('LayerLoadMixin startup');
        },

        getLayerDef: function (sdeLayerNameOrUrl) {
            //search for it in mapServices
            var mapServices = app.widgets.layerLoader.mapServices; //TODO or read directly from JS?

            for (var i = 0; i < mapServices.length; i++) {
                if (mapServices[i].url === layerDef) {
                    return mapServices[i];
                }
                for (var j = 0; j < mapServices[i].layers.length; j++) {
                    //TODO eventually we'll have the layers as a separate list generated server-side
                    var l = mapServices[i].layers[j];
                    if (l.url === layerDef || l.sdeLayerName === layerDef) {
                        return l;
                    }
                }
            }
            //if we make it this far, it's a problem
            topic.publish('viewer/handleError', {
                source: 'LayerLoadMixin.getLayerDef',
                error: 'Unable to find service or layer with sdeLayerName or URL "' + sdeLayerNameOrUrl + '"'
            });
        },

        addToMap: function (layerDef) {
            var layer;

            if (typeof layerDef === 'string') {
                layerDef = this.getLayerDef(layerDef);
                if (!layerDef) return;
            }

            //test if it's already in the map
            //URL seems as good as anything for a unique identifier
            //HOWEVER--if the definitionExpression doesn't match we'll want to update it
            if (array.some(this.layers, function (l) {
                if (l.url == layerDef.url && l.getDefinitionExpression() == layerDef.definitionExpression) {
                    //assign reference
                    layer = l;
                    //Make it visible
                    l.setVisibility(true); // use this method rather than .visible property to keep LayerControl in sync
                    //rezoom?
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
            }, this)) {
                return layer;
            }

            topic.publish('growler/growl', 'Loading ' + layerDef.name);

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
            } else {
                throw ("Unsupported or undefined type property of layerDef: " + layerDef.type);
            }

            //definitionExpression only applies to a featureLayer
            //but we can support it for projects loaded via dynamic map service, applying it to all feature layers in the service
            if (layerDef.definitionExpression) {
                if (layerDef.type === 'dynamic') {
                    //TODO see https://developers.arcgis.com/javascript/3/jsapi/arcgisdynamicmapservicelayer-amd.html#setlayerdefinitions
                } else if (layerDef.type === 'feature') {
                    layer.setDefinitionExpression(layerDef.definitionExpression);
                }
            }

            //Note: _MapMixin adds layers to the layers control with unshift, e.g.:
            //layers.unshift(l)
            //but that's to keep it in the order in which they're listed in operationalLayers;
            //we're using push so they appear on top. If we want them to appear under the projects
            //change the next line to unshift
            app.layers.push(layer);
            //construct on-load handler. The layer needs to be loaded before getting the layerInfo
            //and adding to layerControl widget
            on(layer, 'load', function () {
                //I don't know why we need to make this separate esriRequest, but the layer won't show up in layerControl
                //unless we do. We don't do anything with the response. It's cribbed from DnD plug in, DroppedItem.js.
                esriRequest({
                    url: layerDef.url,
                    content: { f: 'json' },
                    handleAs: 'json',
                    callbackParamName: 'callback'
                }).then(function (response) {
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
                    if (layerDef.definitionExpression) {
                        //TODO: this is just a proof of concept, we'll probably want something cleaner than raw definitionExpression
                        layerControlInfo.title = layerControlInfo.title + ' (' + layerDef.definitionExpression + ')';
                    }
                    topic.publish('layerControl/addLayerControls', [layerControlInfo]);
                    topic.publish('identify/addLayerInfos', [layerControlInfo]);
                    app.legendLayerInfos.push(layerControlInfo);
                    //topic.publish('identify/addLayerInfos', [{
                    //    type: layerDef.type,
                    //    layer: layer,
                    //    title: layerDef.name
                    //}]);
                    //app.legendLayerInfos.push({ layer: layer, title: layerDef.name });

                    if (layerDef.definitionExpression) {
                        //zoom to layer
                        app.zoomToLayer(layer);
                        //TODO? is it possible after zooming to the defined features (which, as far our documented requirements go, will be just one)
                        //it's still not visible? if so, need a callback handler after zooming
                    } else {
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
                });

            }); //end on-load

            //add the layer to the map
            //note: in DnD, after which this is modelled, "this.map" is a thing
            //for some reason it doesn't work here, so using app.map
            app.map.addLayer(layer);

            return layer;
        },

        zoomToLayer: function (layer) {
            //this.zoomToExtent([layer.fullExtent]); //unfortunately, this doesn't take definitionExpression into account
            var q = new Query({
                where: '1=1' //TODO or use definitionExpression?
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

        zoomToFeature: function (feature) {

        },

        zoomToFeatureByOid: function (layer, objectId) {

        },

        zoomToExtent: function (extent) {
            var map = this.map;
            var params = lang.mixin(new ProjectParameters(), {
                geometries: [extent],
                outSR: map.spatialReference
            });
            esriConfig.defaults.geometryService.project(params, 
                function (r) {
                    //we could just call setExtent with r[0], but 
                    //if the extent is of a point, it results in the map just panning to the point
                    //this is best done by constructing a proper Extent instance, then expanding it if it's a line/poly
                    //or just center and zoom if a point
                    extent = new Extent(r[0]);
                    if (extent.getWidth() == 0 && extent.getHeight() == 0) {
                        //expanding it has no effect
                        //TODO: this next line sort of works, but then the feature doesn't draw, and zooming gets screwed up
                        //maybe because the point isn't properly set?
                        map.centerAndZoom({x: extent.xmin, y: extent.ymin}, 21);
                    } else {
                        extent.expand(1.1);
                        map.setExtent(extent, true);
                    }
            }, function (e) {
                topic.publish('viewer/handleError', {
                    source: 'LayerLoadMixin.zoomToExtent',
                    error: e
                });
            });
        }
    });
});
