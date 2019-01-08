define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/topic',

    'esri/map',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/dijit/Legend',
    'esri/InfoTemplate',
    'esri/request'

], function (
    declare,
    lang,
    on,
    topic,

    Map,
    ArcGISDynamicMapServiceLayer,
    FeatureLayer,
    Legend,
    InfoTemplate,
    esriRequest
) {

    return declare(null, {

        startup: function () {
            //nothing really to do here
        },

        addToMap: function (layerDef) {
            topic.publish('growler/growl', 'Loading ' + layerDef.title);

            //todo add layerControlInfo
            //Note: I tried app.initLayer, and while it does do a great job of adding the layer to the map, 
            //it doesn't then call functions to make it show up in the LayerControl widget
            //app._initLayer(layerDef, ArcGISDynamicMapServiceLayer);

            var layer;
            if (layerDef.type === 'dynamic') {
                layer = new ArcGISDynamicMapServiceLayer(layerDef.url,
                    {
                        opacity: 0.75, //todo store in config?
                        //todo either use db id or just let this be autoassigned id: layerDef.name,
                        infoTemplate: new InfoTemplate('Attributes', '${*}')
                    });
            } else if (layerDef.type === 'feature') {
                layer = new FeatureLayer(layerDef.url,
                    {
                        opacity: 0.75, //todo store in config?
                        //todo either use db id or just let this be autoassigned id: layerDef.name,
                        infoTemplate: new InfoTemplate('Attributes', '${*}')
                    });
            } else {
                throw ("Unsupported or undefined type property of layerDef: " + layerDef.type);
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
                        title: layerDef.title,
                        type: layerDef.type
                    };
                    topic.publish('layerControl/addLayerControls', [layerControlInfo]);
                    topic.publish('identify/addLayerInfos', [{
                        type: layerDef.type,
                        layer: layer,
                        title: layerDef.title
                    }]);
                    app.legendLayerInfos.push({ layer: layer, title: layerDef.title });
                    //Legend.refresh();
                    //TODO: somewhere around here we should warn the user if the layer loaded to the map is out of scale range


                }, function (error) {
                    topic.publish('growler/growl', {
                        title: 'LayerLoad Error',
                        message: error.message,
                        level: 'error', //can be: 'default', 'warning', 'info', 'error', 'success'.
                        timeout: 0, //set to 0 for no timeout
                        opacity: 1.0
                    });
                });

            }); //end on-load

            //add the layer to the map
            //note: in DnD, after which this is modelled, "this.map" is a thing
            //for some reason it doesn't work here, so using app.map
            app.map.addLayer(layer);
        }
    });
});
