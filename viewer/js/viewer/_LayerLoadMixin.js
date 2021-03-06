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
    './js/config/layerLoader.js',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/layers/FeatureLayer',
    'esri/layers/RasterLayer',
    'esri/layers/VectorTileLayer',
    'esri/layers/ImageParameters',
    'esri/layers/ImageServiceParameters',

    //for zoom-to-point support
    'esri/layers/GraphicsLayer',
    'esri/graphic',
    'esri/symbols/SimpleMarkerSymbol',

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
    layerLoader,
    ArcGISDynamicMapServiceLayer,
    FeatureLayer,
    RasterLayer,
    VectorTileLayer,
    ImageParameters,
    ImageServiceParameters,
    GraphicsLayer,
    Graphic,
    SimpleMarkerSymbol,
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

            //Note: can't do this on startup: this.map.addLayer(this.zoomPointGraphics), because this.map is defined asynchronously in _MapMixin
            //need to use mapDeferred, also defined in _MapMixin, resolved when the map has been created
            this.mapDeferred.then(lang.hitch(this, '_createZoomPointGraphics'));

            window.addEventListener('storage', lang.hitch(this, '_handleStorageMessage'));

            this.inherited(arguments);
        },

        _createZoomPointGraphics: function () {
            this.zoomPointGraphics = new GraphicsLayer({
                id: '_LayerLoadMixin_ZoomPointGraphics',
                title: 'Zoom Point Graphics'
            });

            this.map.addLayer(this.zoomPointGraphics);

            this.zoomPointSymbol = new SimpleMarkerSymbol({
                type: 'esriSMS',
                style: 'esriSMSCircle',
                size: 15,
                color: [200, 0, 200, 16],
                angle: 0,
                xoffset: 0,
                yoffset: 0,
                outline: {
                    type: 'esriSLS',
                    style: 'esriSLSSolid',
                    color: [200, 0, 200, 200],
                    width: 3
                }
            });
        },

        _handleStorageMessage: function (e) {
            if (e.key === 'postMessage') {
                this._handleQueryString('?' + e.newValue);
            }
        },

        /**
        * Handles arguments passed in the query string to do things after the map is loaded, like loading a saved map or adding a project to the map
        * @param {object} queryString optional queryString when calling this method from _handleStorageMessage. If not provided, uses window.location.href to get queryString.
        * Acceptable queryString parameters include:
        * projectId: ID of the a project to load in the map (PK_PROJECT), or alternative (identified by PK_PROJECT_ALT prefixed with a, e.g. projectId=a33241, or as project-altnum (FK_PROJECT, PK_PRJ_ALT), e.g. projectId=3321-1
        * aoiId: ID of an AOI project to load in the map (T_PROJECT_AOI.PK_PROJECT)
        * aoiAnalysisAreaId: ID of an AOI project alt to load in the map
        * layerName: SDE layer name of a layer to load in the map
        * latLon: coordinates in lat/long, wgs84 datum assumed, to center the map on. Not currently used by EST. Can be decimal degress, decimal minutes, degrees/minutes/seconds
        * mgrs: coordinates in Miltary Grid Reference System (MGRS) coordinate system
        * zoomLevel: zoom level to set to the map. If not provided, it is inferred based on the precision of the MGRS coordinate, or the fourth-highest zoom level if using latLon
        * featureId: the ID of a project feature to load in the map; must be paired with valid featureType parameter
        * featureType: the type of project feature to load in the map (point, line or polygon); must be paried with featureId
        * featureName: the name of the project feature, used as the label of the feature's layer in the Layers widget. If not provided, label "Feature ######" is used.
        * Some parameters can be combined, including:
        *  * layerName and any other parameter (e.g. with projectId, aoiId, or featureId/featureType)
        *  * loadMap and any other parameter
        *  * mgrs or latLon with any other parameter
        * Zoom-to point paramters (mgrs and latLon) are mutually exclusive. If both are provided only mgrs value is used.
        * Parameters related to loading projects/aois/features are mutually exclusive, and can't be combined; if multiple ones are provided the one earliest 
        * on the following list is used:
        *  * projectId
        *  * aoiId
        *  * featureId and featureType
        * Parameters for loading a feature (featureId and featureType) have to be paired to add a feature to the map, and ideally also include 
        * featureName. If featureName isn't provided, the feature is labeled "Feature ######" in the Layers widget.
        * @returns {void}
        */
        _handleQueryString: function (queryString) { //eslint-disable-line complexity
            var self = this, //so we don't lose track of the application as the appropriate closure scope
                uri = (queryString || window.location.href),
                qs = (uri.indexOf('?') >= 0 ? uri.substring(uri.indexOf('?') + 1, uri.length) : ''),
                qsObj = ioQuery.queryToObject(qs),
                functions = [],
                args = [],
                i = 0,
                //eslint-disable-next-line func-style
                processNextFunction = function () {
                    if (functions[i]) {
                        var f = functions[i],
                            a = args[i];
                        i++;
                        f.apply(self, a).then(function () {
                            processNextFunction();
                        },
                        //even if the deferred is rejected we want to process the next
                        function () {
                            processNextFunction();
                        });
                    }
                };

            //load a saved map
            if (qsObj.loadMap) {
                functions.push(this.loadMap);
                args.push([qsObj.loadMap]);
            }
            //load a project, alternative, AOI, AOI analysis area, or feature
            if (qsObj.projectId) {
                //addProjectToMap accepts multiple arguments (projectAltId, zoomOnLoad, _deferred, queryDraft)
                //we only care about the first two
                //zoomOnLoad should be false if mgrs/latlong parameter is also included
                functions.push(this.addProjectToMap);
                var zoomOnLoadProject = true;
                if (qsObj.mgrs || qsObj.latLong) {
                    zoomOnLoadProject = false;
                }
                args.push([qsObj.projectId, zoomOnLoadProject]);
                //load an AOI
            } else if (qsObj.aoiId) {
                functions.push(this.addAoiToMap);
                args.push([qsObj.aoiId]);
            //load an AOI analysis area
            } else if (qsObj.aoiAnalysisAreaId) {
                functions.push(this.addAoiAltToMap);
                args.push([qsObj.aoiAnalysisAreaId]);
            //load a project feature
            } else if (qsObj.featureId && qsObj.featureType) {
                functions.push(this.addProjectFeatureToMap);
                var zoomOnLoadFeature = true;
                if (qsObj.mgrs || qsObj.latlong) {
                    zoomOnLoadFeature = false;
                }
                args.push([qsObj.featureId, qsObj.featureType, qsObj.featureName, zoomOnLoadFeature]);
            }
            //load a layer
            if (qsObj.layerName) {
                functions.push(this.addLayerByLayerName);
                args.push([qsObj.layerName]);
            }
            //coordinate to zoom to, we don't support both at the same time, and really currently only use mgrs
            if (qsObj.mgrs) {
                functions.push(this.zoomToMgrsPoint);
                args.push([qsObj.mgrs, qsObj.zoomLevel || 'infer']);
            } else if (qsObj.latLon) {
                functions.push(this.zoomToLatLong);
                args.push([qsObj.latLon, qsObj.zoomLevel]);
            }
            processNextFunction();
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
            //note re next line, when first loaded, before all widgets have loaded, "this.widgets.layerLoader" = true, not a 
            //reference to the widget itself. We also load the layerDefs into this mixin, thus the || bit
            //rationale for wanting to reference the layerLoader's layerDefs is to keep in sync what's loaded and what's not.
            var layerDefs = this.widgets.layerLoader.layerDefs || layerLoader.layerDefs,
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
                return layerDef.layerName.toLowerCase() === layerIdOrName.toLowerCase();
            });//not found
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
        constructLayer: function (layerDef, definitionExpression, includeDefinitionExpressionInTitle, renderer) { //eslint-disable-line max-statements
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

                //fix for issue #65; arcgisProps.title is used for feature layer title in printed TOC
                layer.arcgisProps = {
                    title: layerDef.name
                };

                var layerControlInfo = { //Note this is actually a "LayerInfo", a property passed into the layerInfos property of the LayerControl class
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

        //from analysis results; could use layerName and autoId to add the layer with a definitionExpression
        //so add optional autoId argument here, build the where clause 'AUTOID=' + autoId
        //but maybe the user wants to see all features and just highlight the autoid one?
        //this also depends on Lex's call on whether we want to support autoid filtering at all, or instead
        //just use MGRS, which is there in the data, but not in the analysis results.
        /**
         * Adds a layer by its layer name. Called typically from the GIS analysis results report, in combination with an MGRS code.
         * @param {String} layerName The name of the layer, as defined in layerLoader.js, in the layerDef's layerName property.
         * @returns {Deferred} A deferred object to be resolved when the layer is loaded, or rejected if not found or some other error occurs.
         */
        addLayerByLayerName: function (layerName) {
            var layer = this.constructLayer(layerName),
                deferred = new Deferred();
            if (layer) {
                deferred = this.addLayer(layer);
            } else {
                //alert user
                topic.publish('growler/growl', {
                    message: 'The ' + layerName +
                        ' layer is unavailable. It may have been renamed or replaced, or is no longer in service. <strong>Check the layer browser for the latest available data</strong>.<br /><br />' +
                        'If you need further assistance, please contact the OEM Help Desk at <a href="mailto:help@fla-etat.org?subject=' + layerName +
                        ' is not available in EST map">help@fla-etat.org</a> or <a href="tel:850-414-5334">850-414-5334</a>.',
                    title: 'Layer Unavailable',
                    level: 'warning',
                    timeout: 0
                });
                deferred.reject('Invalid layerName "' + layerName + '" property passed to addLayerByLayerName function.');
            }
            return deferred;
        },

        /**
         * TODO add support for project/alt milestones
         * Add a project or alternative to the map, using one of the following patterns:
         * 'p' followed by a project ID (e.g. p12992 to load project #12992)
         * number, or string that contains just numbers (e.g. 12992 or '12992' to load project #12992)
         * 'a' followed by a project alt ID (e.g. 'a9912' to load project alt 9912)
         * string containing two numbers separated by a dash (e.g. 12992-1 to load alt 1 of project 12992)
         * @param {any} projectAltId The project or alternative ID, as described above
         * @param {boolean} zoomOnLoad If true (or omitted), the map will zoom to the extent of the project after loading it. If false the current map extent is maintained. It is set to false when loading a saved map, because the desired map extent is saved with the map.
         * @param {Deferred} _deferred Optional Deferred object, created if omitted. Used when calling this function from itself to maintain the promise.
         * @param {Boolean} queryDraft Set when calling this function from itself to indicate we should check the draft layer
         * @return {Deferred} Deffered instance--one created by this function or passed in via _deferred argument.
         */
        addProjectToMap: function (projectAltId, zoomOnLoad, _deferred, queryDraft) {
            var self = this, //so we don't lose track buried down in callbacks
                isAlt = false,
                definitionQuery = '',
                deferred = _deferred || new Deferred(),
                query = new Query(),
                url = queryDraft && (this.hasProjectEditAuthority || this.hasViewDraftAuthority) ? projects.queryDraftLayer : projects.queryMmaLayer, //query task url is in the config file viewer/js/config/projects.js. 
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
            query.outFields = queryDraft ? ['PROJECT_ALT', 'ALT_ID', 'ALT_NAME'] : ['FK_PROJECT', 'FK_PROJECT_ALT', 'ALT_ID', 'ALT_NAME'];

            //old way used executeForCount and just got the number of features,
            //but we really need to know, if it's an alt, the fk_project_alt value for saving it
            //queryTask.executeForCount(query, function (count) {
            //    if (count === 0) {
            queryTask.execute(query, function (reply) {
                if (reply.features.length === 0) {                
                    //no features found
                    if (!queryDraft && (self.hasProjectEditAuthority || self.hasViewDraftAuthority)) {
                        //try again with draft, passing the deferred we've already created and true for the queryDraft argument
                        self.addProjectToMap(projectAltId, zoomOnLoad, deferred, true);
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
                        //per bug 5100, alts use the alt_name
                        if (reply.features[0].attributes.ALT_NAME) {
                            projectLayerConfig.name = reply.features[0].attributes.ALT_NAME;
                        } else {
                            projectLayerConfig.name = 'Project # ' + reply.features[0].attributes.ALT_ID;
                        }
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

        /**
         * Add the project feature to the map identified by featureId and featureType
         * @param {number} featureId The numeric ID of the feature
         * @param {string} featureType The type of the feature, either 'point', 'line', or 'polygon'
         * @param {string} featureName The name of the feature. If null "Feature " + featureId is used.
         * @param {boolean} zoomOnLoad If true (or omitted), the map will zoom to the extent of the project feature after loading it. If false the current map extent is maintained. It is set to false when loading a saved map, because the desired map extent is saved with the map.
         * @param {Deferred} _deferred Optional Deferred object, created if omitted. Used when calling this function from itself to maintain the promise.
         * @return {Deferred} Deffered instance--one created by this function or passed in via _deferred argument.
         */
        addProjectFeatureToMap: function (featureId, featureType, featureName, zoomOnLoad, _deferred) {
            var self = this, //so we don't lose track buried down in callbacks
                deferred = _deferred || new Deferred();

            //default zoomOnLoad to true
            if (typeof zoomOnLoad === 'undefined') {
                zoomOnLoad = true;
            }

            //figure out if we're zooming to a project or a specific alt
            if (isNaN(featureId)) {
                //something we don't know how to handle.
                //no features found
                topic.publish('growler/growl', {
                    title: 'Invalid Feature ID',
                    message: 'Unable to parse ID ' + featureId,
                    level: 'error'
                });
                deferred.cancel('Invalid feature ID');
                return deferred;
            }

            this._findFeatureInLayers(featureId, featureType).then(
                function (info) {
                    var featureLayerConfig = {
                            name: featureName || 'Feature # ' + featureId,
                            id: ('feature_' + featureId), //internal ID, not really important, but helps with debugging
                            url: info.url,
                            type: 'feature',
                            layerName: null, //only needed for metadata
                            featureId: featureId, //needed for saving
                            featureType: featureType
                        },
                        symbol = null;

                    if (featureType === 'polygon') {
                        symbol = {
                            'type': 'esriSFS',
                            'style': 'esriSFSSolid',
                            'color': [255, 255, 0, 180],
                            'outline': {
                                'type': 'esriSLS',
                                'style': 'esriSLSSolid',
                                'color': [255, 255, 0, 255],
                                'width': 3
                            }
                        };
                    } else if (featureType === 'line') {
                        symbol = {
                            type: 'esriSLS',
                            style: 'esriSLSSolid',
                            color: [255, 255, 0, 180],
                            width: 3
                        };
                    } else if (featureType === 'point') {
                        symbol = {
                            type: 'esriSMS',
                            style: 'esriSMSCircle',
                            size: 12,
                            color: [255, 255, 0, 180],
                            angle: 0,
                            xoffset: 0,
                            yoffset: 0,
                            outline: {
                                type: 'esriSLS',
                                style: 'esriSLSSolid',
                                color: [255, 255, 0, 255],
                                width: 2
                            }
                        };
                    }

                    var featureLayer = self.constructLayer(featureLayerConfig,
                        info.definitionQuery,
                        false, //prevents definitionExpression from overriding title TODO cleaner method of handling this
                        //todo just set this in the map service rather than having to code in js
                        //currently it's the right color, but the width is too narrow
                        new SimpleRenderer({
                            'type': 'simple',
                            'symbol': symbol
                        })
                    );
                    //resolve deferred via addLayer method
                    self.addLayer(featureLayer, zoomOnLoad).then(
                        function (l) {
                            deferred.resolve(l);
                        },
                        function (m) {
                            deferred.reject(m);
                        }
                    );
                },
                function (msg) {
                    deferred.reject(msg);
                //},
                //function (progressMsg) {
                    //todo?
                }
            );
            return deferred;
        },

        /**
         * Finds the service and layer the referenced feature can be found in, searching in currently in review, previously reviewed, eliminated, and draft services
         * @param {any} featureId The id of the feature to find.
         * @param {any} featureType The type of feature to find.
         * @param {any} _serviceIndex The index of the four services to try next.
         * @param {any} _deferred The Deferred object created by this function, used only when this function calls itself.
         * @return {Deferred} A Deferred object (either the one passed in by reference as _deferred, or a new one created by this function). When resolved, will Deferred will pass an object with the service URL and definition query.
         */
        _findFeatureInLayers: function (featureId, featureType, _serviceIndex, _deferred) {
            var self = this,
                deferred = _deferred || new Deferred(),
                query = new Query(),
                layerIndex = null,
                serviceIndex = _serviceIndex || 0,
                url = [projects.currentlyInReviewProjectsService, projects.previouslyReviewedProjectsService, projects.eliminatedProjectsService, projects.draftProjectsService][serviceIndex],
                queryField = null;

            if (featureType === 'polygon') {
                //set layer
                layerIndex = 8;
                //set where
                queryField = 'FK_POLYGON';
            } else if (featureType === 'line') {
                layerIndex = 7;
                queryField = 'FK_SEGMENT';
            } else if (featureType === 'point') {
                layerIndex = 6;
                queryField = 'FK_POINT';
            } else {
                deferred.cancel('Invalid feature type');
                return deferred;
            }

            //of course draft and eliminated projects are different
            if (serviceIndex === 3 || serviceIndex === 2) {
                if (featureType === 'line') {
                    queryField = 'SEGMENT'; //No FK_ in eliminated
                } else {
                    queryField = 'FK_FEATURE'; //point and polygon just have FK_FEATURE, which I wish they all had.
                }
            }

            query.where = queryField + '=' + featureId;
            query.returnGeometry = false;

            url += '/' + layerIndex;
            var queryTask = new QueryTask(url);
            queryTask.executeForCount(query, function (count) {
                if (count > 0) {
                    deferred.resolve({
                        url: url,
                        definitionQuery: query.where,
                        isDraft: (serviceIndex === 3)
                    });
                } else if (serviceIndex < 3 || (serviceIndex === 3 && self.hasViewDraftAuthority)) {
                    //increment to next service
                    serviceIndex++;
                    //recursively call this function, passing in the new serviceIndex and existing deferred
                    self._findFeatureInLayers(featureId, featureType, serviceIndex, deferred);
                } else {
                    //nowhere else to look
                    deferred.reject('No feature found with that ID');
                }
            }, function (err) {
                deferred.reject(err);
            });

            return deferred;
        },

        /**
         * Adds the feature layers of the associated identified AOI to the map.
         * @param {number} aoiId The ID of the AOI to add to the map.
         * @returns {Deferred} A Deffered object to be resolved when the layers have been loaded.
         */
        addAoiToMap: function (aoiId) {
            var self = this,
                deferred = new Deferred();

            MapDAO.getAoiModel(aoiId, {
                callback: function (aoi) {
                    //todo loading overlay for this class self.loadingOverlay.hide();
                    if (aoi) {
                        self.addAoiModelToMap(aoi).then(function (r) {
                            deferred.resolve(r);
                        }, function (err) {
                            deferred.reject(err);
                        });
                    } else {
                        topic.publish('growler/growlError', 'Unable to load AOI with ID ' + aoiId + '. No AOI with that ID found.');
                        deferred.reject('Unable to load AOI with ID ' + aoiId + '. No AOI with that ID found.');
                    }
                },
                errorHandler: function (message, exception) {
                    //self.loadingOverlay.hide();
                    topic.publish('viewer/handleError', {
                        source: '_LayerLoadMixin/addAoiToMap',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                    });
                    deferred.reject(message);
                }
            });
            return deferred;
        },

        /**
         * Adds just the referenced AOI analysis area to the map.
         * @param {number} aoiAltId Identifier of an AOI analysis area (feature in S_AOI);
         * @returns {Deferred} A Deffered object to be resolved when the layer has been loaded.
         */
        addAoiAltToMap: function (aoiAltId) {
            var self = this, //so we don't lose track buried down in callbacks
                definitionExpression = 'FK_PROJECT_ALT = ' + aoiAltId,
                deferred = new Deferred();

            MapDAO.getAoiAnalysisAreaName(aoiAltId, { //eslint-disable-line no-undef
                callback: function (name) {
                    var layerDef = {
                            id: 'aoi_analysis_area_' + aoiAltId,
                            url: projects.aoiLayers.analysisAreaBuffer,
                            name: name,
                            type: 'feature'
                        },
                        layer = self.constructLayer(layerDef, definitionExpression);

                    self.addLayer(layer, false, true).then(
                        function () {
                            topic.publish('layerLoader/layersChanged');
                            topic.publish('layerLoader/aoiAdded', layer);
                            var q = new Query({
                                where: '1=1' //definitionExpression doesn't need to be re-applied
                            });
                            layer.queryExtent(q).then(
                                function (extentReply) {
                                    extentReply.extent.expand(1.5);
                                    self.zoomToExtent(extentReply.extent).then(function () {
                                        deferred.resolve(layer);
                                    });
                                }
                                //todo handle error from queryExtent
                            );
                        },
                        function (err) {
                            deferred.reject(err);
                        }
                    );

                },
                errorHandler: function (err) {
                    deferred.reject(err);
                }
            });
                

            return deferred;
        },

        /**
         * Adds a feature layers associated with the referenced AOI model to the map
         * @param {object} aoiModel A model of the AOI to be loaded, with at least the name and id properties
         * @returns {Deferred} A Deferred object to be resolved when all feature layers have been loaded in the map
         */
        addAoiModelToMap: function (aoiModel) {
            var self = this, //so we don't lose track buried down in callbacks
                definitionExpression = 'FK_PROJECT = ' + aoiModel.id,
                deferred = new Deferred(),
                promises = [],
                layerNames = ['analysisAreaBuffer', 'polygon', 'polyline', 'point'];

            //mixin properties from projects.aoiLayers into new objects, load them in the map
            layerNames.forEach(function (layerName) {
                var l2 = layerName === 'analysisAreaBuffer' ? 'Analysis Areas' : ('P' + layerName.substr(1) + 's'),
                    layerDef = {
                        id: 'aoi_' + aoiModel.id + '_' + layerName,
                        url: projects.aoiLayers[layerName],
                        name: (aoiModel.name || 'AOI ' + aoiModel.id) + ' ' + l2,
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
         * @return {Deferred} deferred object to be resolved when map is loaded
         */
        loadMap: function (savedMapId, clearMapFirst, zoomToSavedMapExtent) {
            var self = this, //DWR callback loses scope of this
                deferred = new Deferred(), //wrapper deferred used by this function for the overall progress
                loadDeferred = new Deferred(); // promise to be fullfilled when map is done loading and map has zoomed

            //load from server
            MapDAO.getSavedMapBeanById(savedMapId, {
                callback: function (savedMap) {
                    if (savedMap) {
                        self._loadMap(savedMap, clearMapFirst, zoomToSavedMapExtent, loadDeferred);
                        loadDeferred.then(
                            function (layers) {
                                topic.publish('growler/removeUpdatable');
                                topic.publish('growler/growl', 'Loaded ' + layers.length + ' layers for ' + savedMap.mapName);
                                topic.publish('layerLoader/mapLoaded', savedMap); //lets the layerloader widget know what's up when this is loaded from query string
                                deferred.resolve();
                            },
                            function (err) {
                                topic.publish('growler/growlError', err);
                                deferred.reject(err);
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
                        deferred.reject('Invalid Map ID');
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
            return deferred;
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

            return this._centerAtOrZoom(point, zoomLevel);
        },

        /**
         * Centers the map at a point in the Military Grid Reference System (MGRS) geocoordinate standard, and optionally zooms to the specified or inferred level.
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

            return this._centerAtOrZoom(point, zoomLevel);
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
        },

        /**
         * Centers the map at the referenced point, addes a graphic element to the map at the referenced point, and optionally zooms to the referenced zoom level
         * @param {Point} point an ESRI point object
         * @param {Number} zoomLevel optional zoom level to pass to centerAndZoom function. If omitted map pans to the point and stays at current zoom level
         * @returns {Deferred} the Deferred object created by centerAndZoom or centerAt.
         */
        _centerAtOrZoom: function (point, zoomLevel) {
            //add point to map
            var graphic = new Graphic(point, this.zoomPointSymbol);
            this.zoomPointGraphics.add(graphic);
            //return the deferred generated by centerAndZoom or centerAt method
            return (zoomLevel ? this.map.centerAndZoom(point, zoomLevel) : this.map.centerAt(point));
        }

    });
});
