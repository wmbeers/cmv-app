define([
    'dojo/topic',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'esri/layers/ArcGISDynamicServiceLayer',
    'esri/InfoTemplate',
    '../LayerControl/plugins/legendUtil',
    'require',
    'dojo/ready'
], function (
    topic,
    _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
    gfx,
    ArcGISDynamicServiceLayer,
    InfoTemplate,
    legendUtil,
    require
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            // description:
            // Widget to create AGS Dynamic Service Layer for an issue
            
            //templateString: template,
            //baseClass: 'esri-DroppedItem',
            //widgetsInTemplate: true,
            //name: 'Defaulterizer Name',
            //title: 'Defaulterizer Title',
            //label: 'Defaulterizer Label',
            //itemId: '',
            //layerIds: [],
            //url: '',
            //serviceType: '',
            //scenarioObj: {},
            //removeIcon: require.toUrl('./images/remove.png'),


            //serviceIcons: {
            //    'defaultIcon': require.toUrl('./images/earth.png'),
            //    'MapServer': require.toUrl('./images/map.png'),
            //    'FeatureServer': require.toUrl('./images/warning.png'),
            //    'MapServer Layer': require.toUrl('./images/map.png'),
            //    'FeatureServer Layer': require.toUrl('./images/database.png'),
            //    'ImageServer': require.toUrl('./images/images.png'),
            //    'loading': require.toUrl('./images/loading.gif')
            //},

            postCreate: function () {

                //topic.subscribe('droppedItems/LayerInfosFailed', lang.hitch(this, function (layer, map, id) {
                //    this._LayerInfosFailed(layer, map, id);
                //}));

                //if (this.hasOwnProperty('serviceType') && this.serviceType === 'FeatureServer') {
                //    // this.setIcon(this.serviceIcons.FeatureServer, 20);
                //} else if (this.hasOwnProperty('url') && this.url !== '') {
                //    // this.setIcon(this.serviceIcons.loading, 20);
                //    this._loadServiceInfo(this.url, null);
                //} else {
                //    // this.setIcon(this.serviceIcons.loading, 20);
                //}
            },
           
            setIcon: function (icon, size, html) {
                if (html) {
                    this.iconNode.outerHTML = html;
                    return;
                }
                put(this.iconNode, '[src=' + icon + ']');
                if (size) {
                    put(this.iconNode, '[style=width:' + size + 'px;height:' + size + 'px;padding:' + Math.abs(32 - size) / 2 + 'px;]');
                }
            },
            _removeItem: function () {
                if (this.removeCallback) {
                    this.removeCallback(this.itemId);
                    this.destroyRecursive();
                }
            },
            _loadServiceInfo: function (url, targetNode) {


            var layer = new ArcGISDynamicServiceLayer


            {
                type: 'dynamic',
                    url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/etdm_contamination/MapServer',
                        title: 'Contamination',
                            options: {
                    id: 'contamination',
                        opacity: 1.0,
                            visible: true,
                                outFields: ['*'],
                                    //featureReduction: has('phone') ? null : {
                                    //    type: 'cluster',
                                    //    clusterRadius: 10
                                    //},
                                    mode: 1
                },
        editorLayerInfos: {
            disableGeometryUpdate: false
        },
        legendLayerInfos: {
            exclude: false,
            layerInfo: {
                title: 'Contamination'
            }
        },
        layerControlLayerInfos: {
            //layerGroup: 'Project Data',
            menu: [{
                label: 'Open Attribute Table',
                topic: 'openTable',
                iconClass: 'fa fa-table fa-fw'
            }/*{
                    id: 'toggle-clustering-menu',
                    topic: 'toggleClustering',
                    label: 'Toggle Clustering',
                    iconClass: 'fas fa-fw fa-toggle-on'
                }*/]
        }
    }



                // function preCallbackFunc (io) {
                //     console.log(io.url, io.content);
                //     return io;
                // }
                var requestHandle = esriRequest({
                    url: url,
                    content: { f: 'json' },
                    handleAs: 'json',
                    callbackParamName: 'callback'
                });

                // requestHandle.setRequestPreCallback(lang.hitch(this, '_preCallbackFunc'));  
                requestHandle.then(lang.hitch(this, '_handleLoadedServiceInfo', url, targetNode), lang.hitch(this, '_handleErrBack', url));
                // setTimeout(requestHandle.then(lang.hitch(this, '_handleLoadedServiceInfo', url, targetNode), lang.hitch(this, '_handleErrBack', url)), 3000);            
            },
            _getLegend: function (layer, targetNode) {
                legendUtil.layerLegend(layer, targetNode, this.map);
            },
            // _preCallbackFunc: function (io) {
            //     console.log(io.url, io.content);
            //     return io;
            // },
            _handleErrBack: function (url) {
                // this.label.show;
                this.label = 'Unable to add resource ' + this.itemId;
                this.labelNode2.innerHTML = '<span title="' + url + '">' + this.label + '</span>';
                // this.setIcon(this.serviceIcons.FeatureServer, 20);
            },
            _handleLoadedServiceInfo: function (url, targetNode, info) {
                // set the label on the first item loaded

                //check if layer info
                if (this.layer.layerInfos.length === 0 ||
                    (typeof this.layer.layerInfos[0] === 'undefined' && this.layer.layerInfos[0] === null)) {
                    //console.info('@ _handleLoadedServiceInfo layerinfos is empty');
                    this.layer.on('update-end', lang.hitch(this, '_LayerInfosFailed', this.layer, this.map, this.id));
                }
                if (this.layer.loaded) {
                    if (targetNode === null) {
                        if (info.hasOwnProperty('documentInfo') && info.documentInfo.hasOwnProperty('Title')) {
                            info.name = (info.documentInfo.Title !== '' ? info.documentInfo.Title : null);
                        }
                        if (info.name && info.hasOwnProperty('mapName')) {
                            info.name = (info.mapName !== '' ? info.mapName : url);
                        }
                        if (!info.hasOwnProperty('name') || !info.name) {
                            info.name = url;
                        }
                        this.label = this.serviceType === '' ? info.name : info.name;
                        // this.label = this.serviceType === '' ? info.name : info.name + '&nbsp;<span class="sub-label">(' + this.serviceType + ')</span>';

                        this.labelNode2.innerHTML = '<span title="' + url + '">' + this.label + '</span>';
                        // var icon = this.serviceType === '' ? 'defaultIcon' : this.serviceType;
                        // if (this.serviceIcons.hasOwnProperty(icon)) {
                        //     this.setIcon(this.serviceIcons[icon], 20);
                        // }
                        // check if a MapServer/Feature server root directory (not a layer)
                        //  if a root directory, recursively call _loadService info on each of
                        //  the layers
                        if (info.hasOwnProperty('layers') && info.layers.length >= 1) {
                            array.forEach(info.layers, lang.hitch(this, function (layer, i) {
                                this._loadServiceInfo(url + '/' + i, this.containerNode);
                            }));
                        } else if (info.hasOwnProperty('drawingInfo')) {
                            var serviceLayerHTML = '<div>';
                            serviceLayerHTML += '<div class="layersInfo">' + this._buildLayersInfo(this._getRendererSymbolArray(info.drawingInfo.renderer)) + '</div>';
                            serviceLayerHTML += '</div>';
                            this.containerNode.innerHTML = serviceLayerHTML;
                        }
                        if (this.layerType) {
                            this._addLayerToLayerControl(this.layer, this.label, this.layerType, this.scenarioObj);
                            topic.publish('identify/addLayerInfos', [{
                                type: this.layerType,
                                layer: this.layer,
                                title: this.label,
                                scenarioObj: this.scenarioObj
                            }]);
                        }
                        this._getLegend(this.layer, this.containerNode);


                    }
                    // else if (targetNode !== undefined) {
                    // put(targetNode, 'div.layerTitle', info.name);
                    //     if (info.drawingInfo && info.drawingInfo.renderer) {
                    //         var outHTML = '<div>';
                    //         outHTML += '<div class="layersInfo">' + this._buildLayersInfo(this._getRendererSymbolArray(info.drawingInfo.renderer)) + '</div>';
                    //         outHTML += '</div>';
                    //         targetNode.innerHTML += outHTML;                  
                    // }
                    // }
                    // this._getLegend(this.layer, targetNode);
                }
            },
            _LayerInfosFailed: function (layer, map, id) {
                console.error('Scenario failed to load: ' + layer.scenarioTitle);
                domConstruct.destroy(id);
                topic.publish('growler/growl', {
                    title: 'Scenario Failed to Load! Retry',
                    message: layer.scenarioTitle,
                    level: 'error',
                    timeout: 6000,
                    opacity: 1.0
                });
                this._removeItem();
                return;
            },
            _getRendererSymbolArray: function (rendererJson) {
                if (rendererJson.hasOwnProperty('uniqueValueInfos')) {
                    return rendererJson.uniqueValueInfos;
                } else if (rendererJson.hasOwnProperty('symbol')) {
                    return [rendererJson];
                }
            },
            _buildLayersInfo: function (layersInfo) {
                var layersHTML = array.map(layersInfo, lang.hitch(this, '_buildLayerInfo')).join('');
                return layersHTML;
            },
            _buildLayerInfo: function (layerInfo) {
                var layerHTML = '<div class="layerInfo">';
                if (layerInfo.symbol.type === 'esriPMS') {
                    layerHTML += '<img class="iconNode iconPatch" src="data:' + layerInfo.symbol.contentType + ';base64,' + layerInfo.symbol.imageData + '">';
                } else {
                    layerHTML += this._createPatchHTML(layerInfo);
                }
                layerHTML += '<div class="labelNode2">' + (layerInfo.label !== '' ? layerInfo.label : 'No label') + '</div>';
                layerHTML += '</div>';
                layerHTML += '<div class="clearer" style="height:5px;"></div>';
                return layerHTML;
            },
            _createPatchHTML: function (layerInfo, symbol) {
                if (!symbol) {
                    // create symbol obj from json
                    symbol = this._createSymbol(layerInfo);
                }
                var docFrag = put('div.iconNode');
                // use gfx to create symbol surface/image
                if (symbol) {
                    var surface = gfx.createSurface(docFrag, 32, 32);
                    var descriptors = symbolJsonUtils.getShapeDescriptors(symbol);
                    var shape = surface.createShape(descriptors.defaultShape)
                        .setFill(descriptors.fill)
                        .setStroke(descriptors.stroke);
                    shape.applyTransform({
                        dx: 16,
                        dy: 16
                    });
                }
                return docFrag.outerHTML;
            },
            _createSymbol: function (layerInfo) {
                if (layerInfo && layerInfo.hasOwnProperty('symbol') && layerInfo.symbol.hasOwnProperty('type')) {
                    var type = layerInfo.symbol.type;
                    if (type === 'esriSFS') {
                        return new SimpleFillSymbol(layerInfo.symbol);
                    } else if (type === 'esriSLS') {
                        return new SimpleLineSymbol(layerInfo.symbol);
                    } else if (type === 'esriSMS') {
                        return new SimpleMarkerSymbol(layerInfo.symbol);
                    }
                }
            },
            _addLayerToLayerControl: function (layer, title, type, scenarioObj) {
                var layerControlInfo = {
                    controlOptions: {
                        expanded: true,
                        metadataUrl: true,
                        swipe: true,
                        noMenu: false,
                        mappkgDL: true,
                        mappkgURL: scenarioObj.mappkgURL,
                        removeControl: true,
                        menu: [{
                            label: 'Open Attribute Table',
                            topic: 'openTable',
                            iconClass: 'fa fa-table fa-fw'
                        }, {
                            label: 'Open Metadata',
                            topic: 'openMetadata',
                            iconClass: 'fa fa-info fa-fw'
                        }]
                    },
                    layer: layer,
                    title: title,
                    type: type
                };
                topic.publish('layerControl/addLayerControls', [layerControlInfo]);
                topic.subscribe('LayerControl/openMetadata', lang.hitch(this, 'openMetaData'));
            },
            openMetaData: function (options) {
                var subLayerId = options.subLayer.id;
                var subLayerName = options.subLayer.name;
                var metadataURL = 'https://web.geoplan.ufl.edu/pub/sls/docs/gis_metadata/';
                var subLayerMetaDataURL;

                if (options.layer.ScenarioType) {
                    switch (subLayerId) {
                        case 1:
                            subLayerMetaDataURL = metadataURL + 'scenarios/' + subLayerName + '.xml';
                            window.open(subLayerMetaDataURL, '_blank');
                            break;
                        case 2:
                            subLayerMetaDataURL = metadataURL + 'scenarios/' + subLayerName + '.xml';
                            window.open(subLayerMetaDataURL, '_blank');
                            break;
                        case 3:
                            subLayerMetaDataURL = metadataURL + 'scenarios/' + subLayerName + '.xml';
                            window.open(subLayerMetaDataURL, '_blank');
                            break;
                        case 4:
                            subLayerMetaDataURL = metadataURL + 'scenarios/' + subLayerName + '.xml';
                            window.open(subLayerMetaDataURL, '_blank');
                            break;
                        case 5:
                            subLayerMetaDataURL = metadataURL + 'scenarios/' + subLayerName + '.xml';
                            window.open(subLayerMetaDataURL, '_blank');
                            break;
                        case 6:
                            subLayerMetaDataURL = metadataURL + 'scenarios/' + subLayerName + '.xml';
                            window.open(subLayerMetaDataURL, '_blank');
                            break;
                        default:
                            break;
                    }
                } else {
                    console.error('Issue with: Opening Metadata for : ' + subLayerName);
                }
            }
        });
    });