define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/topic',
    'dojo/io-query',
    'dojo/Deferred',
    'dijit/Dialog',
    'dojo/promise/all',
    'dojo/request',
    './js/config/projects.js',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/layers/RasterLayer',
    'esri/layers/VectorTileLayer',
    'esri/layers/ImageParameters',
    'esri/layers/ImageServiceParameters',
    'esri/request',
    'esri/tasks/ProjectParameters',
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    'esri/geometry/Extent',
    'esri/geometry/Point',
    'esri/renderers/SimpleRenderer',
    'esri/geometry/coordinateFormatter',
    'esri/geometry/webMercatorUtils',
    'gis/plugins/LatLongParser'
    //note: 'jquery' // we don't need jquery, just an example of how to reference it
], function (
    declare,
    lang,
    array,
    on,
    topic,
    ioQuery,
    Deferred,
    Dialog,
    all,
    request,
    projects,
    ArcGISDynamicMapServiceLayer,
    FeatureLayer,
    RasterLayer,
    VectorTileLayer,
    ImageParameters,
    ImageServiceParameters,
    esriRequest,
    ProjectParameters,
    Query,
    QueryTask,
    Extent,
    Point,
    SimpleRenderer,
    coordinateFormatter,
    webMercatorUtils,
    LatLongParser
    //jquery //we don't need jquery
) {

    return declare(null, {
        startup: function () {
            //subscribe to topics
            //topics called from custom menus defined in the addLayerMethod will use topic layerContro/...
            topic.subscribe('layerControl/openAttributeTable', lang.hitch(this, 'openAttributeTable'));
            topic.subscribe('layerControl/zoomToLayer', lang.hitch(this, 'zoomToLayer'));
            topic.subscribe('layerControl/viewMetadata', lang.hitch(this, 'viewMetadata'));

            //topics called from other places use topic layerLoader/... for clarity
            topic.subscribe('layerLoader/addProjectToMap', lang.hitch(this, 'addProjectToMap'));
            topic.subscribe('layerLoader/addAoiToMap', lang.hitch(this, 'addAoiToMap'));
            topic.subscribe('layerLoader/addLayerFromLayerDef', lang.hitch(this, 'addLayerFromLayerDef'));
            topic.subscribe('layerLoader/addLayerFromCategoryDef', lang.hitch(this, 'addLayerFromCategoryDef'));
            topic.subscribe('layerLoader/saveMap', lang.hitch(this, 'saveMap'));
            topic.subscribe('layerLoader/loadMap', lang.hitch(this, 'loadMap'));
            topic.subscribe('layerLoader/removeLayer', lang.hitch(this, 'removeLayer'));
            topic.subscribe('layerLoader/clearUserLayers', lang.hitch(this, 'clearUserLayers'));
            topic.subscribe('layerLoader/zoomToMgrsPoint', lang.hitch(this, 'zoomToMgrsPoint'));
            topic.subscribe('layerLoader/zoomToLatLong', lang.hitch(this, 'zoomToLatLong'));
            topic.subscribe('layerLoader/zoomToExtent', lang.hitch(this, 'zoomToExtent'));

            //load the coordinateFormatter
            coordinateFormatter.load();
            //just a test of whether jquery works: jquery("#subHeaderTitleSpan").html('Yo');

            //this has to wait until the layerLoader is finished loading
            //doesn't quite cut it: window.setTimeout(this._handleQueryString.bind(this), 2000);
            //so we wait for the last widget we have to publish startupComplete
            topic.subscribe('layerLoader/startupComplete', lang.hitch(this, '_handleQueryString'));

            window.addEventListener('storage', lang.hitch(this, '_handleStorageMessage'));

            this.inherited(arguments);
        },

        _handleStorageMessage: function (e) {
            if (e.key === 'postMessage') {
                this._handleQueryString('?' + e.newValue);
            }
        },

        /**
        * Handles arguments passed in the query string to do things after the map is loaded, like loading a saved map or adding a project to the map
        * @param {object} queryString optional queryString when calling this method from _handleStorageMessage. If not provided, uses window.location.href to get queryString
        * @returns {void}
        */
        _handleQueryString: function (queryString) {
            var uri = queryString || window.location.href;
            var qs = uri.indexOf('?') >= 0 ? uri.substring(uri.indexOf('?') + 1, uri.length) : '';
            qs = qs.toLowerCase();
            var qsObj = ioQuery.queryToObject(qs);
            //acceptable arguments include loadMap, projectId, aoiid, latlon, latlong, and mgrs
            //arguments are (for now) mutually exclusive, with preference given to the order of the arguments listed above
            //TODO expand to addLayer
            //TODO could also consider expanding to chain multiple events, like load several layers, load a saved map and add a project, etc.
            if (qsObj.loadmap) {
                this.loadMap(qsObj.loadmap, false, true); //load map, don't clear layers, zoom to extent
            } else if (qsObj.projectid) {
                this.addProjectToMap(qsObj.projectid);
            } else if (qsObj.aoiid) {
                this.addAoiToMap(qsObj.aoiid);
            } else if (qsObj.latlong || qsObj.latlon) {
                var ll = qsObj.latlong || qsObj.latlon;
                this.zoomToLatLong(ll, qsObj.zoomlevel);
            } else if (qsObj.mgrs) {
                this.zoomToMgrsPoint(qsObj.mgrs, qsObj.zoomlevel);
            }

        },

        openAttributeTable: function (layerControlItem) {
            //featureLayer loaded individually
            var url = layerControlItem.layer.url,
                title = layerControlItem.layer.name,
                topicId = layerControlItem.layer.id,
                definitionExpression = '1=1';

            //is this a dynamic map service layer or feature layer?
            if (layerControlItem.subLayer) {
                url += '/' + layerControlItem.subLayer.id;
                title = layerControlItem.subLayer.name;
                topicId += '_' + layerControlItem.subLayer.id;
                //todo pick up subLayer definitionExpression. Not sure how this is done or if it can be done...
            } else if (layerControlItem.layer.getDefinitionExpression && layerControlItem.layer.getDefinitionExpression()) {
                definitionExpression = layerControlItem.layer.getDefinitionExpression();
            }

            var tableOptions = {
                title: title,
                topicID: topicId,
                queryOptions: {
                    queryParameters: {
                        url: url,
                        maxAllowableOffset: 100, // TODO this is used for generalizing geometries. At this setting, the polygons are highly generalized
                        where: definitionExpression,
                        geometry: this.map.extent 
                    },
                    idProperty: 'AUTOID' // TODO get this from the layer's fields property
                },
                toolbarOptions: {
                    export: {
                        show: false
                    }
                },
                growlOptions: {
                    loading: true,
                    results: true
                },
                displaySourceGraphic: false //a new option I am adding to AttributesTable TODO make this do something
                //note: tried the following, but it just uses default symbols
                //symbolOptions: {
                //    source: { point: null, polyline: null, polygon: null }
                //}
            };
            topic.publish('attributesTable/addTable', tableOptions);
        },

        /**
         * Gets a reference to a map service by its service ID, via the allCategories array in the LayerLoader widget.
         * @param {number} serviceId Id of the service to find.
         * @returns {object} A reference to the category, defined in allCategories, with a serviceId matching the provided serviceId
         */
        getService: function (serviceId) {
            return this.widgets.layerLoader.allCategories.find(function (c) {
                return c.serviceId === serviceId;
            });
        },

        /**
         * Gets a reference to a layer definition by numeric id (relates back to objectid of t_rest_services_mxd), or
         * by its SDE layer name. The numeric id is used primarily when coming from a saved map, and the SDE layer name
         * is used primarily when coming from the GIS analysis results report.
         * @param {any} layerIdOrName the id of a layer def, or its sde layer name
         * @returns {object} a layer def with the id of sde layer name matching layerIdOrName
         */
        getLayerDef: function (layerIdOrName) {
            var layerDefs = this.widgets.layerLoader.layerDefs,
                ld = null;

            //by numeric id, when coming from saved map
            if (typeof layerIdOrName === 'number' || !isNaN(layerIdOrName)) {
                if (typeof layerIdOrName === 'string') {
                    layerIdOrName = parseInt(layerIdOrName, 10);
                }
                ld = layerDefs.find(function (layerDef) {
                    return layerDef.id === layerIdOrName;
                });
                //not found
                if (ld === null) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.getLayerDef',
                        error: 'Unable to find definition for layerDef with id ' + layerIdOrName
                    });
                }
                return ld;
            }

            //not a number, so look by SDE layername, when coming from external link/function call in analysis report
            ld = layerDefs.find(function (layerDef) {
                return layerDef.layerName === layerIdOrName;
            });
            //not found
            if (ld === null) {
                topic.publish('viewer/handleError', {
                    source: 'LayerLoadMixin.getLayerDef',
                    error: 'Unable to find definition for layerDef with name ' + layerIdOrName
                });
            }

            return ld;
        },

        /**
         * Tests if a layer (either feature or dynamic) is already loaded in the map (exists in this.layers)
         * based on the URL and definitionExpression, returns a reference to the layer if it is in the map
         * @param {object} layerDef the layerDef object defining the layer to find in the map
         * @param {string} definitionExpression optional definition expression, used to distinguish two instances of the same layer with different definition expressions defined
         * @returns {object} a reference to a map layer, if one is found with a matching layer definition and definition expression; otherwise null
        */
        findLayerInMap: function (layerDef, definitionExpression) {
            definitionExpression = definitionExpression || ''; //make sure it's not undefined
            return this.layers.find(function (l) {
                if (l.url === layerDef.url) {
                    //compare definitionExpressions, which may be (and usually are) undefined
                    //to simplify, make sure they are empty strings if not defined
                    var layerDefinitionExpression = (l.getDefinitionExpression && l.getDefinitionExpression()) || '';
                    return layerDefinitionExpression === definitionExpression;
                }
                //urls don't match, this is not the layer you're looking for
                return false;
            });
        },

        /**
         * Construct a layer based on a layerDef; layerDef might just be the ID of a layerDef contained in the config,
        // a layer name, or a URL
         * @param {any} layerDef Either a layerDef object found in the LayerLoader's layerDefs array, or a string or number that can be used to find the layer def
         * @param {String|Array} definitionExpression Optional definition expression to be applied to a feature layer (as string), or array of definition expressions to be applied to a dynamic layer with setLayerDefinitions
         * @param {Boolean} includeDefinitionExpressionInTitle If true, the defition expression will be displayed in the title
         * @param {Object} renderer Optional renderer to be used to display the layer in the map
         * @returns {Object} an ArcGIS layer of some sort; specific type depends on the layer definition
         */
        constructLayer: function (layerDef, definitionExpression, includeDefinitionExpressionInTitle, renderer) {
            var layer = null,
                visibleLayers = layerDef.visibleLayers || null; //cache the visible layers

            if (typeof layerDef === 'string' || typeof layerDef === 'number') {
                //find layer by id, layerName, or url property
                layerDef = this.getLayerDef(layerDef);
                if (!layerDef) {
                    return null; //error has already been handled in getLayerDef
                }
            }

            if (layerDef.type === 'featureLayer') {
                //from saved map, use the layerId property to find it in the layers collection
                layerDef = this.getLayerDef(layerDef.layerId);
                if (!layerDef) {
                    return null; //error has already been handled in getLayerDef
                }
            }

            if (layerDef.type === 'restService') {
                //from saved map, use the layerId property (which is actually the serviceId) to find it
                layerDef = this.getService(layerDef.layerId);
            }

            //See if the layer is already in the map; if so nothing to do, just return a reference to it
            layer = this.findLayerInMap(layerDef, definitionExpression);
            if (layer) {
                //set a temporary tag to make sure it doesn't get re-added, that breaks things
                layer.alreadyInMap = true;
                //TODO reset visible layers here?
                return layer;
            }

            //Note: I tried app.initLayer, and while it does do a great job of adding the layer to the map, 
            //it doesn't then call functions to make it show up in the LayerControl widget
            //app._initLayer(layerDef, ArcGISDynamicMapServiceLayer);

            if (layerDef.type === 'dynamic') {
                var ip = new ImageParameters();
                ip.format = 'png32';
                layer = new ArcGISDynamicMapServiceLayer(layerDef.url,
                    {
                        //opacity: 0.75, //todo store in config?
                        //todo either use db id or just let this be autoassigned id: layerDef.name,
                        //infoTemplate: new InfoTemplate('Attributes', '${*}')
                        imageParameters: ip
                    });
                if (visibleLayers) {
                    layer.setVisibleLayers(visibleLayers);
                }
            } else if (layerDef.type === 'feature') {
                layer = new FeatureLayer(layerDef.url,
                    {
                        outFields: '*' //necessary to have this to get any attributes returned, but TODO we might want to store that in layerDef?
                        //opacity: 0.75, //todo store in config?
                        //todo either use db id or just let this be autoassigned id: layerDef.name,
                        //infoTemplate: new InfoTemplate('Attributes', '${*}')
                    });
            } else if (layerDef.type === 'raster') {
                var isp = new ImageServiceParameters();
                isp.format = 'png32';
                layer = new RasterLayer(layerDef.url, {
                    imageServiceParameters: isp
                });
                //TODO 
                //{
                //    imageServiceParameters: {
                //        format: 'png32'
                //    }
                //});
            } else if (layerDef.type === 'vectortile') {
                layer = new VectorTileLayer(layerDef.url);
            } else {
                throw new Error('Unsupported or undefined type property of layerDef: ' + layerDef.type);
            }

            //definitionExpression only applies to a featureLayer
            //but we can support it for projects loaded via dynamic map service, applying it to all feature layers in the service
            layerDef.title = layerDef.name || layerDef.displayName;
            if (definitionExpression) {
                if (layerDef.type === 'dynamic') {
                    layer.setLayerDefinitions(definitionExpression);
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

        addCategory: function (category, includeSubCategories) {
            var promises = [], //array of promises to be resolved when layers are loaded
                layerDefs = category.layerDefs.slice(0).reverse(); //temporary cloned array (not a deep clone) of layerDefs of the category, cloned so we can reverse the sort

            //include sub-categories (and their sub-categories, ad infinitum)
            if (includeSubCategories) {
                //eslint-disable-next-line no-inner-declarations
                function recurse (c) { 
                    c.categories.forEach(function (subCategory) {
                        var subLayerDefs = subCategory.layerDefs.slice(0).reverse();
                        layerDefs = layerDefs.concat(subLayerDefs);
                    });
                }
                recurse(category);
            }

            //construct layers for layerDefs
            layerDefs.forEach(function (layerDef) {
                if (!layerDef.layer) {
                    this.constructLayer(layerDef);
                }
            }, this);

            layerDefs.forEach(function (layerDef) {
                promises.push(this.addLayer(layerDef.layer));
            }, this);

            //if (promises.length > 0) {
            //    all(promises).then(function (layers) {
            //        //currently not doing anything with this, but if you want to have something else happen when all layers are loaded, this is where you would do it.
            //        //or you could move this "if" block into whatever is calling addCategory
            //    });
            //}
            return promises;
        },

        /**
         * Adds a layer to the map
         * @param  {Object} layer An instance of a subclass of the base class esri/layers/Layer (.e.g FeatureLayer, ArcGisDynamicMapServiceLayer).
         * NOTE: the layer object must have a layerDef property, such those created with the constructLayer method.
         * @param {boolean} zoomOnLoad Optional parameter, if true the map will toom to the extent of the layer after it is loaded
         * @param {boolean} suppressGrowl Optional parameter, if false, the growler message that shows up after the layer loads is not shown; if true or missing, the growler message is shown.
         * @return {Object}  A Deferred that will be resolved after the layer is loaded in the map
         */
        addLayer: function (layer, zoomOnLoad, suppressGrowl) {
            var deferred = new Deferred(),
                layerDef = layer.layerDef,
                self = this;
            if (typeof suppressGrowl === 'undefined') {
                suppressGrowl = false;
            }

            if (layer.alreadyInMap) {
                //alreadyInMap was set in construct layer, means it was already found in the map
                //Make it visible
                layer.setVisibility(true); // use this method rather than .visible property to keep LayerControl in sync
                //rezoom--user might have panned/zoomed elsewhere, but are requesting to go back
                if (zoomOnLoad) {
                    this.zoomToLayer(layer);
                }
                //Warn if not visible at current scale
                if (!layer.visibleAtMapScale && !suppressGrowl) {
                    topic.publish('growler/growl', {
                        title: '',
                        message: layerDef.name + ' is already loaded in the map, but is not visible at the current map scale.',
                        level: 'warning'
                    });
                }
                //remove the temporary tag
                delete (layer.alreadyInMap);
                //todo maybe this needs to be set with timeout so it gets resolved before the return?
                deferred.resolve(layer);

                return deferred;

            }

            //Note: _MapMixin adds layers to the layers control with unshift, e.g.:
            //layers.unshift(l)
            //but that's to keep it in the order in which they're listed in operationalLayers;
            //we're using push so they appear on top. If we want them to appear under the projects
            //change the next line to unshift
            this.layers.push(layer);

            //construct on-load handler. The layer needs to be loaded before getting the layerInfo
            //and adding to layerControl widget
            //HOWEVER, if layer was previously loaded, apparently the load event doesn't fire...
            if (layer.loaded) {
                this._onLayerLoad(layer, deferred, zoomOnLoad, suppressGrowl);
            }
            on(layer, 'load', function () {
                self._onLayerLoad(layer, deferred, zoomOnLoad, suppressGrowl); 
            });
            
            //add the layer to the map
            this.map.addLayer(layer);

            return deferred;
        },

        /**
         * Callback function run after a layer is loaded via the addLayer function (or directly called from addLayer if the layer is already loaded).
         * @param {Object} layer Reference to the layer that was loaded
         * @param {Object} deferred Reference to the Deferred object to be resolved after layer is loaded
         * @param {boolean} zoomOnLoad If true, the map will toom to the referenced layer's extent after it is loaded
         * @param {boolean} suppressGrowl If true, the "Loaded..." growler is not shown
         * @returns {void}
         */
        _onLayerLoad: function (layer, deferred, zoomOnLoad, suppressGrowl) {
            var self = this,
                layerDef = layer.layerDef;

            if (layerDef.loaded) { //if it has a loaded observable, assign it to true. (It always does when it's a layerDef defined by our system)
                layerDef.loaded(true);
                layerDef.loadPending(false);
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

                var layerControlInfo = {
                    controlOptions: {
                        expanded: true,
                        metadataUrl: false,
                        //includeUnspecifiedLayers: true, //TODO: if this is included, the service doesn't load properly for some reason, and no layers show up.
                        swipe: true,
                        noMenu: false,
                        noZoom: true, //we use our own zoom-to function, defined in menu below
                        mappkgDL: true,
                        allowRemove: true,
                        //these are the menus that show up for stand-alone featureLayers
                        menu: [
                            {
                                label: 'Open Attribute Table',
                                topic: 'openAttributeTable',
                                iconClass: 'fa fa-table fa-fw'
                            },
                            {
                                label: 'Zoom to Layer',
                                topic: 'zoomToLayer',
                                iconClass: 'fas fa-fw fa-search'
                            }/* added below only if the layerDef has a layerName property,
                            {
                                label: 'View Metadata',
                                topic: 'viewMetadata',
                                iconClass: 'fa fa-info-circle fa-fw'
                            }*/
                        ],
                        //The subLayerMenu array contains the menu items that show up on sub-layers of a ArcGISDynamicMapServiceLayer
                        //Note: defining it as an object with dynamic/etc properties, as shown in the rest of this comment, is 
                        //what's documented on the CMV site, but doesn't work (or I'm not doing it right)
                        //see below for the correct way discovered via trial-and-error
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
                                label: 'Open Attribute Table',
                                topic: 'openAttributeTable',
                                iconClass: 'fa fa-table fa-fw'
                            },
                            {
                                label: 'Zoom to Layer',
                                topic: 'zoomToLayer',
                                iconClass: 'fas fa-fw fa-search'
                            }/* added below only if the layerDef has a layerName property,
                            {
                                label: 'View Metadata',
                                topic: 'viewMetadata',
                                iconClass: 'fa fa-info-circle fa-fw'
                            }*/
                        ]
                    },
                    layer: layer,
                    title: layerDef.title,
                    type: layerDef.type
                };
                //add metadata link for stand-alone layers (i.e. feature layers of a map service), if they've got a layerName property defined
                if (layerDef.layerName) {
                    layer.layerName = layerDef.layerName;
                    layerControlInfo.controlOptions.menu.push(
                        {
                            label: 'View Metadata',
                            topic: 'viewMetadata',
                            iconClass: 'fa fa-info-circle fa-fw'
                        }
                    );
                }
                //add metadata link for service layers with sub layers
                if (layerDef.layerDefs && layerDef.layerDefs.length > 1) {
                    layerControlInfo.controlOptions.subLayerMenu.push(
                        {
                            label: 'View Metadata',
                            topic: 'viewMetadata',
                            iconClass: 'fa fa-info-circle fa-fw'
                        }
                    );
                }

                topic.publish('layerControl/addLayerControls', [layerControlInfo]); //TODO the whole collection of layers to be added should be passed at once for layerGroup to do anything. We're not currently supporting layerGroup so this can wait.
                topic.publish('identify/addLayerInfos', [layerControlInfo]);
                self.legendLayerInfos.push(layerControlInfo);

                if (zoomOnLoad) {
                    //zoom to layer
                    self.zoomToLayer(layer);
                    //TODO? is it possible after zooming to the defined features (which, as far our documented requirements go, will be just one)
                    //it's still not visible? if so, need a callback handler after zooming
                    //with visibleAtMapScale check, like below
                }
                //TODO Ruth would prefer not to see these at all;
                //particularly when a bunch of layers are loaded at once. Maybe best to put this in the all-resolved?
                if (!suppressGrowl) {
                    if (!layer.visibleAtMapScale) {
                        topic.publish('growler/growl', {
                            title: '',
                            message: layerDef.name + ' loaded, but is not visible at the current map scale.',
                            level: 'warning',
                            timeout: 3000
                        });
                    } else {
                        topic.publish('growler/growl', layerDef.name + ' loaded.');
                    }
                }
                //publish layerLoader/layersChanged to let the layer loader know changes have been made to the current map
                //affects whether user should be prompted to save before they share the map
                topic.publish('layerLoader/layersChanged');
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

        },
        /**
         * Listens to topic layerLoader/addLayerFromLayerDef, called from LayerLoader widget.
         * @param {object} layerDef a layerDef object found in layerLoader.js
         * @return {object} Deffered instance
          */
        addLayerFromLayerDef: function (layerDef) {
            if (!layerDef.layer) {
                layerDef.layer = this.constructLayer(layerDef);
            }
            return this.addLayer(layerDef.layer, false, false); //note: return statement not needed, just call to this.addLayer, but may be useful in future
        },

        /**
         * Listens to topic layerLoader/addLayerFromCategoryDef
         * @param {object} categoryDef a layerDef object found in layerLoader.js
         * @return {object} Deffered instance
         */
        addLayerFromCategoryDef: function (categoryDef) {
            if (!categoryDef.layer) {
                categoryDef.layer = this.constructLayer(categoryDef);
            }
            return this.addLayer(categoryDef.layer, false, false);
        },


        /**
         * Add a project or alternative to the map, using one of the following patterns:
         *  1. 'p' followed by a project ID (e.g. p12992 to load project #12992)
         *  2. number, or string that contains just numbers (e.g. 12992 or '12992' to load project #12992)
         *  3. 'a' followed by a project alt ID (e.g. 'a9912' to load project alt 9912)
         *  4. string containing two numbers separated by a dash (e.g. 12992-1 to load alt 1 of project 12992)
         * This method first attempts to load a project from draft, and failing that recursively calls this method switching queryDraft to false.
         * @param {string} projectAltId Identifier of the project or alternative to load (see descripbion above for details)
         * @param {boolean} zoomOnLoad If true, map zooms to the extent of the project/alt loaded in the map.
         * The next two method arguments are only intended to be used when this method is called by itself, when the project isn't found in draft
         * @param {Deferred} _deferred Optional Deferred object to be resolved once the data has been loaded in the map; if not provided, a new one is created and returned.
         * @param {boolean} _queryDraft If true or not provided (defaults to true), and user has draft access, the "query drafts" layer (identified in projects.js as queryDraftLayer) is used, otherwise Milestone Max (projects.queryMmaLayer) is shown.
         * @returns {Deferred} Deferred object to be resolved after project is loaded, or rejected if not found
         */
        addProjectToMap: function (projectAltId, zoomOnLoad, _deferred, _queryDraft) {
            var self = this, //so we don't lose track buried down in callbacks
                isAlt = false,
                definitionQuery = '',
                deferred = _deferred || new Deferred(),
                query = new Query(),
                queryDraft = (this.hasProjectEditAuthority || this.hasViewDraftAuthority) && _queryDraft !== false,
                url = queryDraft ? projects.queryDraftLayer : projects.queryMmaLayer, //query task url is in the config file viewer/js/config/projects.js. 
                queryTask = new QueryTask(url); 

            //default zoomOnLoad to true
            if (typeof zoomOnLoad === 'undefined') {
                zoomOnLoad = true;
            }

            //figure out if we're zooming to a project or a specific alt
            if (typeof projectAltId === 'number' || !isNaN(projectAltId)) {
                //presumed to be a project #
                //all alternatives for a given project
                //TODO get lex to make drafts layer have same structure with fk_project field added
                if (queryDraft) {
                    definitionQuery = 'alt_id like \'' + projectAltId + '-%\'';
                } else {
                    definitionQuery = 'fk_project = ' + projectAltId;
                }
            } else if (projectAltId.startsWith('a')) {
                //specific alternative by fk_project_alt
                //TODO get lex to make drafts layer have same structure with fk_project_alt field instead of project_alt
                if (queryDraft) {
                    definitionQuery = 'project_alt = ' + projectAltId.substr(1);
                } else {
                    definitionQuery = 'fk_project_alt = ' + projectAltId.substr(1);
                }
                isAlt = true;
            } else if (projectAltId.indexOf('-') > 0) {
                //specific alternative identified by project-alt pattern, like '1234-1' for alt 1 of project 1234
                definitionQuery = 'alt_id = \'' + projectAltId + '\'';
                isAlt = true;
            } else if (projectAltId.startsWith('p')) {
                //TODO get lex to make drafts layer have same structure with fk_project field added
                if (queryDraft) {
                    definitionQuery = 'alt_id like \'' + projectAltId.substr(1) + '-%\'';
                } else {
                    definitionQuery = 'fk_project = ' + projectAltId.substr(1);
                }
            } else if (!isNaN(projectAltId)) {
                //something we don't know how to handle.
                //no features found
                topic.publish('growler/growl', {
                    title: 'Invalid Project/Analysis Area ID',
                    message: 'Unable to parse ID ' + projectAltId,
                    level: 'error'
                });
                deferred.cancel('Invalid project/alt ID');
            }

            //validate the projectAltId
            query.where = definitionQuery;
            query.returnGeometry = false;
            //TODO get lex to make draft layer structure consistent
            query.outFields = queryDraft ? ['PROJECT_ALT', 'ALT_ID'] : ['FK_PROJECT', 'FK_PROJECT_ALT', 'ALT_ID'];

            //old way used executeForCount and just got the number of features,
            //but we really need to know, if it's an alt, the fk_project_alt value for saving it
            //queryTask.executeForCount(query, function (count) {
            //    if (count === 0) {
            queryTask.execute(query, function (reply) {
                if (reply.features.length === 0) {                
                    //no features found

                    //if querying draft, try again with milestone max
                    if (queryDraft) {
                        //try again with Milestone max, passing the deferred we've already created and false for the queryDraft argument to force it to query from draft
                        self.addProjectToMap(projectAltId, zoomOnLoad, deferred, false);
                    } else {
                        //not found 
                        topic.publish('growler/growl', {
                            title: 'Invalid Project/Analysis Area ID',
                            message: 'No projects found with id ' + projectAltId,
                            level: 'error'
                        });
                        deferred.cancel('Invalid project/alt ID');
                    }
                } else {
                    //load it!
                    //first construct a layer config
                    var projectLayerConfig = {
                        name: 'Project # ' + projectAltId,
                        id: ('project_' + projectAltId).replace('-', '_'), //internal ID, not really important, but helps with debugging
                        url: url,
                        type: 'feature',
                        layerName: null //only needed for metadata
                    };
                    if (isAlt) {
                        //cache the fk_project_alt for savedMap
                        projectLayerConfig.projectAltId = queryDraft ? reply.features[0].attributes.PROJECT_ALT : reply.features[0].attributes.FK_PROJECT_ALT;
                        projectLayerConfig.name = 'Project # ' + reply.features[0].attributes.ALT_ID;
                    } else {
                        //cach the fk_project for savedMap
                        projectLayerConfig.projectId = queryDraft ? reply.features[0].attributes.ALT_ID.split('-')[0] : reply.features[0].attributes.FK_PROJECT;
                    }
                    
                    var projectLayer = self.constructLayer(projectLayerConfig, 
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
                    self.addLayer(projectLayer, zoomOnLoad).then(
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

        addAoiToMap: function (aoiId) {
            var self = this;

            MapDAO.getAoiModel(aoiId, {
                callback: function (aoi) {
                    //todo loading overlay for this class self.loadingOverlay.hide();
                    if (aoi) {
                        self.addAoiModelToMap(aoi);
                    } else {
                        topic.publish('growler/growlError', 'Unable to load AOI with ID ' + aoiId + '. No AOI with that ID found.');
                    }
                },
                errorHandler: function (message, exception) {
                    //self.loadingOverlay.hide();
                    topic.publish('viewer/handleError', {
                        source: '_LayerLoadMixin/addAoiToMap',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                    });
                }
            });

        },

        //adds an AOI to the map
        addAoiModelToMap: function (aoi) {
            var self = this, //so we don't lose track buried down in callbacks
                definitionExpression = 'FK_PROJECT = ' + aoi.id,
                deferred = new Deferred(),
                promises = [],
                layerNames = ['analysisAreaBuffer', 'polygon', 'polyline', 'point'];

            //mixin properties from projects.aoiLayers into new objects, load them in the map
            layerNames.forEach(function (layerName) {
                var l2 = layerName === 'analysisAreaBuffer' ? 'Analysis Areas' : ('P' + layerName.substr(1) + 's'),
                    layerDef = {
                        id: 'aoi_' + aoi.id + '_' + layerName,
                        url: projects.aoiLayers[layerName],
                        name: (aoi.name || 'AOI ' + aoi.id) + ' ' + l2,
                        type: 'feature'
                    },
                    layer = self.constructLayer(layerDef, definitionExpression),
                    promise = self.addLayer(layer, false, true);

                promises.push(promise);
            });

            //when all promises to load layers are resolved, we query their extents, union them with a second array of promises
            all(promises).then(function (layers) {
                var queryExtentPromises = [],
                    q = new Query({
                        where: '1=1' //definitionExpression doesn't need to be re-applied
                    });
                layers.forEach(function (layer) {
                    queryExtentPromises.push(layer.queryExtent(q));
                });

                all(queryExtentPromises).then(function (extentReplies) {
                    //union extents, but only those with actual extents
                    var unionOfExtents = null;
                    for (var i = 0; i < extentReplies.length; i++) {
                        var extentReply = extentReplies[i];
                        if (extentReply.count > 0) {
                            if (unionOfExtents) {
                                unionOfExtents = unionOfExtents.union(extentReply.extent);
                            } else {
                                unionOfExtents = extentReply.extent;
                            }
                        }
                    }
                    if (unionOfExtents) {
                        unionOfExtents = unionOfExtents.expand(1.5);
                        self.zoomToExtent(unionOfExtents).then(function () {
                            deferred.resolve(layers);
                        });
                    } else {
                        //todo alert no features
                        deferred.resolve(layers);
                    }
                });
            });

            deferred.then(function (layers) {
                topic.publish('layerLoader/layersChanged');
                topic.publish('layerLoader/aoiAdded', layers);
            }, function (err) {
                topic.publish('layerLoader/addAoiFailed', err);
            });

            return deferred;
        },

        /**
         * Saves to the referenced map to the server, including the layer configuration (via getLayerConfig) and the map extent.
         * Subscribed to topic layerLoader/saveMap.
         * @param {object} savedMap the map to save, an object with id and mapName properties, and optionally (if testing) a Deferred to be resolved when the saveMap call is complete.
         * @returns {void}
         */
        saveMap: function (savedMap) {
            //get layers, excluding operationalLayers
            savedMap.layers = this.getLayerConfig();
            savedMap.extent = this.map.extent;
            try {
                MapDAO.saveMap(savedMap, {
                    callback: function (savedMapId) {
                        savedMap.id = savedMapId;
                        topic.publish('growler/growl', 'Saved ' + savedMap.layers.length + ' layers to ' + savedMap.mapName);
                        topic.publish('layerLoader/mapSaved');
                        if (savedMap.deferred) {
                            savedMap.deferred.resolve();
                        }
                    },
                    errorHandler: function (message, exception) {
                        topic.publish('viewer/handleError', {
                            source: 'LayerLoadMixin.saveMap',
                            error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                        });
                        if (savedMap.deferred) {
                            savedMap.deferred.reject(message);
                        }
                    }
                });
            } catch (exception) {
                topic.publish('viewer/handleError', {
                    source: 'LayerLoadMixin.saveMap',
                    error: exception
                });
            }

        },
        /**
         * Loads a saved map from the server.
         * @param {number} savedMapId ID of the saved map to load
         * @param {boolean} clearMapFirst Optional, if true, all user layers will be removed from the map before loading new layers; if false or absent, layers from the saved map will be added on top of the layers already in the map.
         * @param {boolean} zoomToSavedMapExtent Optional, if true, all map will zoom to the saved map's extent before loading new layers; if false or absent, the map stays at the current extent.
         * @return {void}
         */
        loadMap: function (savedMapId, clearMapFirst, zoomToSavedMapExtent) {
            var self = this, //DWR callback loses scope of this
                deferred = new Deferred(); // promise to be fullfilled when map is done loading and map has zoomed

            //load from server
            MapDAO.getSavedMapBeanById(savedMapId, {
                callback: function (savedMap) {
                    if (savedMap) {
                        self._loadMap(savedMap, clearMapFirst, zoomToSavedMapExtent, deferred);
                        deferred.then(
                            function (layers) {
                                topic.publish('growler/removeUpdatable');
                                topic.publish('growler/growl', 'Loaded ' + layers.length + ' layers for ' + savedMap.mapName);
                                topic.publish('layerLoader/mapLoaded', savedMap); //lets the layerloader widget know what's up when this is loaded from query string
                            },
                            function (err) {
                                topic.publish('growler/growlError', err);
                            },
                            function (progressMessage) {
                                topic.publish('growler/updateGrowl', progressMessage);
                            }
                        );
                    } else {
                        topic.publish('viewer/handleError', {
                            source: 'LayerLoadMixin.loadMap',
                            error: 'Invalid Map ID (' + savedMapId + ')'
                        });
                    }
                },
                errorHandler: function (message, exception) {
                    topic.publish('viewer/handleError', {
                        source: 'LayerLoadMixin.loadMap',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                    });
                    deferred.reject(message);
                }
            });
        },
        /**
         * Opens FGDL metadata for the layer included in the event argument. Listens for LayerControl/viewMetadata topic.
         * @param {any} event The click event on the View Metadata menu itm.
         * @returns {void}
         */
        viewMetadata: function (event) {
            //we're looking for the layerName property of a layerDef. If this is a featureLayer, we're already there. If it's a dynamic map service,
            //we have to dig deeper.
            var layer = event.layer, //the layer, which might or might not have sublayers
                subLayer = event.subLayer, //the sublayer of a dynamic map service layer, which will be null if this is a feature layer
                displayName = subLayer ? subLayer.name : layer.name,
                layerName = null; //the SDE layer name, which is also the metadata file name.

            if (layer.layerDef) {
                if (subLayer) {
                    //sublayer has ids that are the index of the layer within the dynamic map service layer,
                    //but that id also takes into account the folders that might be used to organize layers within
                    //a service, while our layerDefs ignore foldrs. So you can't just do this:
                    //var subLayerDef = layer.layerDef.layerDefs[subLayer.id];
                    //and be assured of getting the right layerDef; you'll be off by one for each folder defined 
                    //for the service above our current index. So this little dance gets us there:
                    //first get the service's layers excluding folders:
                    //var filteredLayerInfos = layer.layerInfos.filter(function (l) {return l.subLayerIds == null});
                    //then find the index of sublayer in the filtered array
                    //var i = filteredLayerInfos.indexOf(subLayer);
                    //and finally use that index to get the layerDef out of our array.
                    //var subLayerDef = layer.layerDef.layerDefs[i];
                    //above seems to work, but I still worry about using index for anything
                    //so I've updated LLC to write the layerIndex, and we can just use that
                    var subLayerDef = layer.layerDef.layerDefs.find(function (ld) {
                        return ld.layerIndex === subLayer.id;
                    });
                    layerName = subLayerDef ? subLayerDef.layerName : null;
                } else if (layer.layerDef.layerDefs && layer.layerDef.layerDefs.length === 1) {
                    //this is the case for dynamic map services with only one layer, CMV handles those differently
                    layerName = layer.layerDef.layerDefs[0].layerName;
                } else {
                    layerName = layer.layerDef.layerName;
                }
            }

            if (!layerName) {
                //something has to be wrong with our configuration somehow.
                topic.publish('growler/growlError', 'Error loading metadata: missing information from configuration. Please inform the help desk. layer.url=' + layer.url);
                return;
            }

            //metadata files are in lower case
            layerName = layerName.toLowerCase();

            topic.publish('growler/growl', 'Fetching metadata for ' + displayName);
            window.open('https://etdmpub.fla-etat.org/meta/' + layerName + '.xml');

            //using request instead of the direct href property so we can handle errors
            //there's probably a way to handle errors with dialog.show, but Dojo documentation isn't clear on that
            //request('/est/metadata/' + layerName + '.htm', {
            //    headers: {
            //        'X-Requested-With': null
            //    }
            //}).then(
            //    function (data) {
            //        var dlg = new Dialog({
            //            id: layerName + '_metadata',
            //            title: 'Metadata for ' + displayName,
            //            content: data
            //        });
            //        dlg.show();
            //    },
            //    function () {
            //        //happens when running on a local server that doesn't have /est/metadata path
            //        //so make request to pub server
            //        //using window.open to work around CORS issues
            //        topic.publish('growler/growl', 'Fetching metadata for ' + displayName);
            //        window.open('https://etdmpub.fla-etat.org/est/metadata/' + layerName + '.htm');
            //    });

            //var dlg = new Dialog({
            //    id: event.subLayer.layerName + '_metadata',
            //    title: 'Metadata for ' + event.subLayer.name,
            //    href: '/est/metadata/' + event.subLayer.layerName + '.htm'
            //});
            //dlg.show();
        },

        /**
         * Callback function from MapDAO.getSavedMapBeanById call made in LoadMap function.
         * @param {object} savedMap The SavedMapBean returned from the DWR call
         * @param {boolean} clearMapFirst Optional, if true, all user layers will be removed from the map before loading new layers; if false or absent, layers from the saved map will be added on top of the layers already in the map.
         * @param {boolean} zoomToSavedMapExtent Optional, if true, all map will zoom to the saved map's extent before loading new layers; if false or absent, the map stays at the current extent.
         * @param {object} deferred The Deferred object to be resolved when the map is done loading
         * @return {void}
         */
        _loadMap: function (savedMap, clearMapFirst, zoomToSavedMapExtent, deferred) {
            var self = this; //this changes context in the "then" callback
            if (savedMap) {
                if (savedMap.layers.length === 0) {
                    deferred.reject('No savedMap passed to _loadMap function');
                }
                if (clearMapFirst) {
                    this.clearUserLayers();
                }
                if (zoomToSavedMapExtent && savedMap.extent) {
                    var savedMapExtent = new Extent({
                        xmin: savedMap.extent.xmin,
                        ymin: savedMap.extent.ymin,
                        xmax: savedMap.extent.xmax,
                        ymax: savedMap.extent.ymax,
                        spatialReference: self.map.spatialReference
                    });
                    this.zoomToExtent(savedMapExtent).then(function () {
                        self._loadSavedMapLayers(savedMap, deferred);
                    });
                } else {
                    //this is currently not an option, but we might in the future allow users the option whether to save the extent or not
                    this._loadSavedMapLayers(savedMap, deferred);
                }
            } else {
                deferred.reject('No savedMap passed to _loadMap function');
            }
        },
        /**
         * Loads the layers from a saved map
         * @param {object} savedMap The SavedMapBean returned from the DWR call
         * @param {object} deferred The Deferred object to be resolved when the map is done loading, and progress reported as layers load
         * @returns {void}
         */
        _loadSavedMapLayers: function (savedMap, deferred) {
            var layerConfig = savedMap.layers,
                promises = [],
                promisesKept = 0;

            //load in reverse order
            for (var i = layerConfig.length - 1; i >= 0; i--) {
                var layerConfigItem = layerConfig[i],
                    promise = null;
                if (layerConfigItem.type === 'project') {
                    promise = this.addProjectToMap(layerConfigItem.layerId, false);
                } else if (layerConfigItem.type === 'projectAlt') {
                    promise = this.addProjectToMap('a' + layerConfigItem.layerId, false);
                } else {
                    var layer = this.constructLayer(layerConfigItem, layerConfigItem.definitionExpression);
                    if (layer) {
                        promise = this.addLayer(layer, false, true);
                        if (layerConfigItem.visible === false) {
                            layer.visible = false;
                        }
                    }
                }

                if (promise) {
                    promises.push(promise);
                    promise.then(function () { //eslint-disable-line no-loop-func
                        //deferred action to take when layer is loaded, just updates progress
                        promisesKept++;
                        deferred.progress('Loaded layer ' + promisesKept + ' of ' + promises.length);
                    });
                }
            }


            if (promises.length > 0) {
                //'all' calls then function when all promises are resolved
                all(promises).then(
                    //resolved
                    function (layers) {
                        deferred.resolve(layers);
                    }
                );
            } else {
                deferred.reject('No valid layers found in saved map');
            }
        },

        /**
         * Zooms to the extent of the referenced layer, taking the layer's definition expression into account
         * @param {any} layer Either an object that is a subclass of esri.Layer, or an object defined by layer control with layer property
         * @returns {object} deferred The Deferred object to be resolved when the map is done zooming
         */
        zoomToLayer: function (layer) {
            var self = this;
            //when called from the menu, "layer" argument isn't really the layer, but a structure created by layer control
            if (layer.layer) {
                layer = layer.layer;
            }

            //test if we have a definition expression applied, and if so, query the extent and zoom in query callback
            if (layer.getDefinitionExpression && layer.getDefinitionExpression()) {
                var deferred = new Deferred();
                //this.zoomToExtent([layer.fullExtent]); //unfortunately, this doesn't take definitionExpression into account
                var q = new Query({
                    where: '1=1' //definitionExpression, if present doesn't need to be re-applied
                });
                layer.queryExtent(q,
                    //query extent succeeded, zoom the map
                    function (r) {
                        self.zoomToExtent(r.extent).then(
                            //zoom to extent succeeded, resolve this function's deferred
                            function (e) {
                                deferred.resolve(e);
                            },
                            //zoom to extent failed, reject this function's deferred
                            function (e) {
                                //TODO publish to handleError, or was that already done in zoomToExtent?
                                deferred.reject(e);
                            }
                        );
                    },
                    //query extent failed, reject thsi function's deferred
                    function (e) {
                        topic.publish('viewer/handleError', {
                            source: 'LayerLoadMixin.zoomToLayer',
                            error: e
                        });
                        deferred.reject(e);
                    }
                );
                return deferred;
            }

            //no definition expression, just zoom to the layer's full extent
            return this.zoomToExtent(layer.fullExtent);
        },

        /**
         * Zooms the map to the specified extent, projecting if necessary.
         * @param {object} extent an esri.geometry.Extent object
         * @returns {object} deferred The Deferred object to be resolved when the map is done zooming
         */
        zoomToExtent: function (extent) { //TODO this overwrites _GraphicsMixin.js zoomToExtent; does that break anything?
            var self = this,
                map = this.map,
                deferred = new Deferred();
            if (extent.spatialReference === map.spatialReference) {
                this._zoomToExtent(extent, deferred);               
            } else if (esriConfig.defaults.geometryService) {
                //project the extent--most often we're getting an extent from one of our layers,
                //and the extent will be in Albers; need to project it to the Map's World Mercator coordinate system
                var params = lang.mixin(new ProjectParameters(), {
                    geometries: [extent],
                    outSR: map.spatialReference
                });
                esriConfig.defaults.geometryService.project(params,
                    function (r) {
                        extent = new Extent(r[0]);
                        self._zoomToExtent(extent, deferred);
                    }, function (e) {
                        topic.publish('viewer/handleError', {
                            source: 'LayerLoadMixin.zoomToExtent',
                            error: e
                        });
                        deferred.reject(e);
                    }
                );
            } else {
                topic.publish('viewer/handleError', {
                    source: 'LayerLoadMixin.zoomToExtent',
                    error: 'esriConfig.defaults.geometryService is not set'
                });
                deferred.reject('esriConfig.defaults.geometryService is not set');
            }
            return deferred;
        },
        /**
         * Callback function from zoomToExtent, fired after the geometryService.project call, or directly if the extent does not need to be projected.
         * @param {object} extent an esri.geometry.Extent object
         * @param {object} deferred The Deferred object to be resolved when the map is done zooming
         * @returns {void}
         */
        _zoomToExtent: function (extent, deferred) {
            //we could just call setExtent, but if the extent is of a point, 
            //it results in the map just panning to the point and staying at whatever zoom 
            //level the map currently is at, even statewide; and if extent of line/poly
            //it often zooms in too tightly.
            //To handle this, we create an Extent object, then expanding it if it's a line/poly
            //or just center and zoom if a point
            if (extent.getWidth() === 0 && extent.getHeight() === 0) {
                //expanding it has no effect, so just use center and zoom
                this.map.centerAndZoom(extent.getCenter(), 21).then(
                    //resolved centerAndZoom
                    function () {
                        deferred.resolve('centerAndZoom');
                    },
                    //rejected
                    function (err) {
                        deferred.reject(err);
                    }
                );
            } else {
                extent.expand(1.1);
                this.map.setExtent(extent, true).then(
                    //resolved setExtent
                    function () {
                        deferred.resolve('setExtent');
                    },
                    //rejected
                    function (err) {
                        deferred.reject(err);
                    }
                );
            }
        },

        /**
         * Gets the layers added by the user to the map.
         * @returns {array} Array of layer objects, excluding the operational layers that are not user-configurable.
         */
        getUserLayers: function () {
            return array.filter(this.layers, function (layer) {
                var operationalLayer = this.config.operationalLayers.find(function (x) {
                    return x.options.id === layer.id;
                });
                return typeof operationalLayer === 'undefined';
            }, this);
        },

        /**
         * Gets the configuration of the layers currently loaded in the map, used for saving maps.
         * @returns {array} Array of layerDef objects, excluding the operational layers that are not user-configurable.
         */
        getLayerConfig: function () {
            return array.map(this.getUserLayers(), function (layer) {
                var x = {
                    url: layer.url, //TODO this will change if we support uploaded shapefiles
                    name: layer.layerDef ? layer.layerDef.name : (layer._name || layer.id),
                    visible: layer.visible,
                    layerId: layer.layerDef ? (layer.layerDef.type === 'dynamic' ? layer.layerDef.serviceId : layer.layerDef.id) : layer.id,
                    type: layer.layerDef ? layer.layerDef.type : null,
                    definitionExpression: layer.getDefinitionExpression ? layer.getDefinitionExpression() : null,
                    visibleLayers: []
                };
                if (layer.layerDef) {
                    //handle project layers
                    if (layer.layerDef.projectId) {
                        x.layerId = layer.layerDef.projectId;
                        x.type = 'project';
                    }
                    if (layer.layerDef.projectAltId) {
                        x.layerId = layer.layerDef.projectAltId;
                        x.type = 'projectAlt';
                    }
                }
                if (layer.declaredClass === 'esri.layers.ArcGISDynamicMapServiceLayer') {
                    x.visibleLayers = layer.visibleLayers;
                }
                return x;
            });
        },

        /**
         * Removes all layers added to the map by the user.
         * @returns {void}
         */
        clearUserLayers: function () {
            //clone the layers array first, otherwise forEach bails
            var layerClone = this.getUserLayers().slice(0);
            layerClone.forEach(function (layer) {
                this.removeLayer(layer);
            }, this);
        },

        /**
         * Removes the referenced layer from the map, as well as the layer control, identify, and legend widgets.
         * @param {any} layer the Layer to be removed from the map.
         * @returns {void}
         */
        removeLayer: function (layer) {
            //remove from the map
            this.map.removeLayer(layer);

            var i = 0;

            //remove from the layers collection
            for (i = 0; i < this.layers.length; i++) {
                if (this.layers[i] === layer) {
                    this.layers.splice(i, 1);
                }
            }

            //keep the layerDef's loaded property in sync so the LayerLoader widget is in sync.
            if (layer.layerDef && layer.layerDef.loaded) {
                layer.layerDef.loaded(false);
            }

            //remove from layerControls
            topic.publish('layerControl/removeLayerControls', [layer]);
            //remove from identify
            topic.publish('identify/removeLayerInfos', [{id: layer.id}]); //that's all we need of the layerInfo used in removeLayerInfos method
            //remove from legend
            for (i = 0; i < this.legendLayerInfos.length; i++) {
                if (this.legendLayerInfos[i].layer === layer) {
                    this.legendLayerInfos.splice(i, 1);
                }
            }

            //refresh the map; it isn't really necessary to do this as far as the map display is concerned, 
            //because the map will update on the removeLayer call above, but without this the removed layer 
            //remains in the legend until after the user pans/zooms the map
            this.map.setExtent(this.map.extent);

            //publish layerLoader/layersChanged to let the layer loader know changes have been made to the current map
            //affects whether user should be prompted to save before they share the map
            topic.publish('layerLoader/layersChanged');
        },

        /**
         * Centers that map at a latitude/longitude, and optionally zooms to the specified or inferred level.
         * @param {any} coordinates A lat long in a variety of acceptable formats, including:
         *      * An object with x and y numeric properties, e.g. {x: -81.2322, y: 32.3432}; 
         *        the X/longitude coordinate will be interpreted as negative if it is positive;
         *        the coordinate properties can be identified as x/y, lat/lon, lat/long, or latitude/longitude
         *      * A string containing both lat/long (or long/lat), as decimal degrees (##.####), 
         *        decimal minutes (## ##.####), or degrees/minutes/seconds (## ## ##.####), with or without +/- or 
         *        characters to denote degrees, minutes or seconds (e.g. [82 23 42.43] is treated the same as [-82� 23' 42.43"])
         * @param {any} zoomLevel optional number
         *      If specified and in the range of zoom levels supported by the map, it will be passed to the centerAndZoom function as the zoom level of the map to set; 
         *      If null, defaults to four steps up from the max level (13, based on current lods configuration in viewer.js)
         *      If less than zero, the map will not be zoomed, but just centered at the point.
         * @returns {object} Deffered object to be resolved after the map is zoomed.
         */
        zoomToLatLong: function (coordinates, zoomLevel) {
            //Note: I'm not using the otherwise very useful coordinateFormatter.fromLatitudeLongitude method, because this method
            //below has advantages of not worrying about hemisphere or swapped latitude and longitude, an advantage we can create
            //because we're only worrying about coordinates in the vicinity of Florida. 

            try {
                if (typeof (coordinates) === 'string') {
                    coordinates = LatLongParser.interpretCoordinates(coordinates);
                }
                if (!coordinates) {
                    //something went awry in interpreting coordinates
                    throw new Error('Unable to interpet ' + coordinates + ' as lat/long coordinates');
                }
                //normalize lat/long terms to y/x
                if (!coordinates.y) {
                    coordinates.y = coordinates.Y || coordinates.lat || coordinates.latitude;
                }
                if (!coordinates.x) {
                    coordinates.x = coordinates.X || coordinates.lon || coordinates.long || coordinates.longitude;
                }

                if (!coordinates.x || !coordinates.y) {
                    //invalid structure
                    throw new Error('Coordinates objecting missing x or y properties');
                }

                //normalize longitude to negative for Wester hemisphere
                if (coordinates.x > 0) {
                    coordinates.x *= -1;
                }
            } catch (err) {
                var deferred = new Deferred();
                deferred.reject(err);
                return deferred;
            }

            //assume WGS84 if not provided
            if (!coordinates.spatialReference) {
                coordinates.spatialReference = {'wkid': 4326};
            }

            //construct Point
            var point = new Point(coordinates);

            zoomLevel = zoomLevel || this.map.getMaxZoom() - 4;
            if (zoomLevel < this.map.getMinZoom() || zoomLevel > this.map.getMaxZoom()) {
                zoomLevel = null;
            }

            return (zoomLevel ? this.map.centerAndZoom(point, zoomLevel) : this.map.centerAt(point)); 
        },

        /**
         * Centers that map at a point in the Military Grid Reference System (MGRS) geocoordinate standard, and optionally zooms to the specified or inferred level.
         * @param {any} mgrs A point in MGRS format.
         * @param {any} zoomLevel Number, string 'infer', or null; 
         *      If a specific number, it will be passed to the centerAndZoom function as the zoom level of the map to set; 
         *      If the string 'infer', the zoom level is inferred from the precision of the input MGRS point.
         *      If null, the map will not be zoomed, but just centered at the point.
         * @returns {object} Deffered object to be resolved after the map is zoomed.
         */
        zoomToMgrsPoint: function (mgrs, zoomLevel) {
            var point = coordinateFormatter.fromMgrs(mgrs, null, 'automatic');

            if (!point) {
                //something went awry in converting from Mgrs
                var deferred = new Deferred();
                deferred.reject('Unable to interpet ' + mgrs + ' as an MGRS coordinate');
                return deferred;
            }
            //infer zoomLevel from length of string
            if (zoomLevel === 'infer') {
                switch (mgrs.replace(/\s/g, '').length) {
                case 5:
                    //precision 0, 100km
                    zoomLevel = 11;
                    break;
                case 7:
                    //precision 1, 10km
                    zoomLevel = 13;
                    break;
                case 9:
                    //precision 2, 1km
                    zoomLevel = 15;
                    break;
                case 11:
                    //precision 3, 100m
                    zoomLevel = 17;
                    break;
                case 13:
                    //precision 4, 10m
                    zoomLevel = 19;
                    break;
                case 15:
                    //precision 5, 1m
                    zoomLevel = 21;
                    break;
                case 17:
                    //precision off the scale < 1m
                    zoomLevel = 23;
                    break;
                default:
                    zoomLevel = 13; //punt
                    break;
                }
            }

            return (zoomLevel ? this.map.centerAndZoom(point, zoomLevel) : this.map.centerAt(point));
        },

        /**
         * Converts a point from geographic (WGS84) or Web Mercator to the Military Grid Reference System (mgrs).
         * @param {any} point The point to be converted
         * @returns {any} A point in MGRS.
         */
        convertPointToMgrs: function (point) {
            //point must be in wgs84
            if (point.spatialReference.isWebMercator()) {
                point = webMercatorUtils.webMercatorToGeographic(point);
            }
            var mgrs = coordinateFormatter.toMgrs(point, 'automatic', 5, true);
            return mgrs;
        }
    });
});
