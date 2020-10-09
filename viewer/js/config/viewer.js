define([
    'esri/units',
    'esri/geometry/Extent',
    'esri/config',
    /*'esri/urlUtils',*/
    'esri/tasks/GeometryService',
    'esri/layers/ImageParameters',
    'esri/symbols/PictureMarkerSymbol',
    'esri/tasks/locator',
    'gis/plugins/Google',
    './js/config/projects.js',
    'dojo/i18n!./nls/main',
    'dojo/topic',
    'dojo/sniff'
], function (units, Extent, esriConfig, /*urlUtils,*/ GeometryService, ImageParameters, PictureMarkerSymbol, Locator, GoogleMapsLoader, projects, i18n, topic, has) {
    // url to your proxy page, must be on same machine hosting you app. See proxy folder for readme.
    //esriConfig.defaults.io.proxyUrl = 'proxy/proxy.ashx';
    esriConfig.defaults.io.alwaysUseProxy = false;
    esriConfig.defaults.io.corsEnabledServers.push('gemini.at.geoplan.ufl.edu');
    //might be needed for metadata if we want to load it in a Dialog; not necessary if just opening in new window
    esriConfig.defaults.io.corsEnabledServers.push('tasks.arcgisonline.com');

    // add a proxy rule to force specific domain requests through proxy
    // be sure the domain is added in proxy.config
    /*urlUtils.addProxyRule({
        urlPrefix: 'www.example.com',
        proxyUrl: 'proxy/proxy.ashx'
    });*/

    // url to your geometry server.
    esriConfig.defaults.geometryService = new GeometryService('https://tasks.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer');

    // Use your own Google Maps API Key.
    // https://developers.google.com/maps/documentation/javascript/get-api-key
    GoogleMapsLoader.KEY = 'NOT-A-REAL-API-KEY';

    // helper function returning ImageParameters for dynamic layers
    // example:
    // imageParameters: buildImageParameters({
    //     layerIds: [0],
    //     layerOption: 'show'
    // })
    // eslint-disable-next-line no-unused-vars
    function buildImageParameters (config) {
        config = config || {};
        var ip = new ImageParameters();
        //image parameters for dynamic services, set to png32 for higher quality exports
        ip.format = 'png32';
        for (var key in config) {
            if (config.hasOwnProperty(key)) {
                ip[key] = config[key];
            }
        }
        return ip;
    }

    //some example topics for listening to menu item clicks
    //these topics publish a simple message to the growler
    //in a real world example, these topics would be used
    //in their own widget to listen for layer menu click events
    topic.subscribe('layerControl/hello', function (event) {
        topic.publish('growler/growl', {
            title: 'Hello!',
            message: event.layer._titleForLegend + ' ' +
                (event.subLayer ? event.subLayer.name : '') +
                ' says hello'
        });
    });
    topic.subscribe('layerControl/goodbye', function (event) {
        topic.publish('growler/growl', {
            title: 'Goodbye!',
            message: event.layer._titleForLegend + ' ' +
                (event.subLayer ? event.subLayer.name : '') +
                ' says goodbye'
        });
    });

    // simple clustering example now. should be replaced with a layerControl plugin
    topic.subscribe('layerControl/toggleClustering', function (event) {
        var layer = event.layer;
        if (layer.getFeatureReduction()) {
            if (layer.isFeatureReductionEnabled()) {
                layer.disableFeatureReduction();
            } else {
                layer.enableFeatureReduction();
            }
        }
    });

    return {

        // used for debugging your app
        isDebug: true,

        //default mapClick mode, mapClickMode lets widgets know what mode the map is in to avoid multipult map click actions from taking place (ie identify while drawing).
        defaultMapClickMode: 'identify',
        // map options, passed to map constructor. see: https://developers.arcgis.com/javascript/jsapi/map-amd.html#map1
        mapOptions: {
            basemap: 'streets',
            center: [-84.380741, 28.190003],
            zoom: 1, //use 7 if using default lods; this is the index of the lods listed below,
            sliderStyle: 'small',
            lods: [
                {
                    'level': 6,
                    'resolution': 2445.98490512499,
                    'scale': 9244648.868618
                },
                {
                    'level': 7,
                    'resolution': 1222.992452562495,
                    'scale': 4622324.434309
                },
                {
                    'level': 8,
                    'resolution': 611.4962262813797,
                    'scale': 2311162.217155
                },
                {
                    'level': 9,
                    'resolution': 305.74811314055756,
                    'scale': 1155581.108577
                },
                {
                    'level': 10,
                    'resolution': 152.87405657041106,
                    'scale': 577790.554289
                },
                {
                    'level': 11,
                    'resolution': 76.43702828507324,
                    'scale': 288895.277144
                },
                {
                    'level': 12,
                    'resolution': 38.21851414253662,
                    'scale': 144447.638572
                },
                {
                    'level': 13,
                    'resolution': 19.10925707126831,
                    'scale': 72223.819286
                },
                {
                    'level': 14,
                    'resolution': 9.554628535634155,
                    'scale': 36111.909643
                },
                {
                    'level': 15,
                    'resolution': 4.77731426794937,
                    'scale': 18055.954822
                },
                {
                    'level': 16,
                    'resolution': 2.388657133974685,
                    'scale': 9027.977411
                },
                {
                    'level': 17,
                    'resolution': 1.1943285668550503,
                    'scale': 4513.988705
                },
                {
                    'level': 18,
                    'resolution': 0.5971642835598172,
                    'scale': 2256.994353
                },
                {
                    'level': 19,
                    'resolution': 0.29858214164761665,
                    'scale': 1128.497176
                },
                {
                    'level': 20,
                    'resolution': 0.14929107082380833,
                    'scale': 564.248588
                },
                {
                    'level': 21,
                    'resolution': 0.07464553541190416,
                    'scale': 282.124294
                },
                {
                    'level': 22,
                    'resolution': 0.03732276770595208,
                    'scale': 141.062147
                },
                {
                    'level': 23,
                    'resolution': 0.01866138385297604,
                    'scale': 70.5310735
                }
            ]
            /*,
            titles: {
                header: 'Environmental Screening Tool',
                subHeader: 'Map Viewer',
                pageTitle: 'EST Map Viewer'
            }*/
        },

        //webMapId: 'ef9c7fbda731474d98647bebb4b33c20',  // High Cost Mortgage
        // webMapOptions: {},

        panes: {
            left: {
                splitter: true,
                style: 'width: 370px'
            },
            bottom: {
                id: 'sidebarBottom',
                placeAt: 'outer',
                splitter: true,
                collapsible: true,
                region: 'bottom',
                //style: 'height:200px;width:75%;', //have to set width if open is false, or it gets stuck collapsed; unfortunately setting the width presents other problems and the table doesn't resize properly.
                style: 'height:200px',
                content: '<div id="attributesContainer"></div>',
                open: true //so we're stuck with keeping it open, then closing it after startup is complete.
            }/*,
            right: {
                  id: 'sidebarRight',
                  placeAt: 'outer',
                  region: 'right',
                  splitter: true,
                  collapsible: true
            },
            bottom: {
                id: 'sidebarBottom',
                placeAt: 'outer',
                splitter: true,
                collapsible: true,
                region: 'bottom',
                open: false

            },
         	top: {
         		id: 'sidebarTop',
         		placeAt: 'outer',
                  collapsible: true,
                    open: false,
         		splitter: false,
         		region: 'top'
         	}*/
        },
        collapseButtonsPane: 'center', //center or outer

        // custom titles
        titles: {
            header: i18n.viewer.titles.header,
            subHeader: i18n.viewer.titles.subHeader,
            pageTitle: i18n.viewer.titles.pageTitle
        },

        layout: {
            /*  possible options for sidebar layout:
                    true - always use mobile sidebar, false - never use mobile sidebar,
                    'mobile' - use sidebar for phones and tablets, 'phone' - use sidebar for phones,
                    'touch' - use sidebar for all touch devices, 'tablet' - use sidebar for tablets only (not sure why you'd do this?),
                    other feature detection supported by dojo/sniff and dojo/has- http://dojotoolkit.org/reference-guide/1.10/dojo/sniff.html

                default value is 'phone'
            */
            //sidebar: 'phone'
        },

        // user-defined layer types
        /*
        layerTypes: {
            myCustomLayer: 'widgets/MyCustomLayer'
        },
        */

        // user-defined widget types
        /*
        widgetTypes: [
            'myWidgetType'
        ],
        */

        // ignore the visibility of group layers in dynamic layers? default = true
        //ignoreDynamicGroupVisibility: false,

        // operationalLayers: Array of Layers to load on top of the basemap: valid 'type' options: 'dynamic', 'tiled', 'feature'.
        // The 'options' object is passed as the layers options for constructor. Title will be used in the legend only. id's must be unique and have no spaces.
        // 3 'mode' options: MODE_SNAPSHOT = 0, MODE_ONDEMAND = 1, MODE_SELECTION = 2
        operationalLayers: [
            {
                type: 'dynamic',
                url: projects.previouslyReviewedProjectsService,
                title: 'Projects (Previously Reviewed)',
                options: {
                    id: 'previouslyReviewedProjectsService',
                    opacity: 1.0,
                    visible: true,
                    outFields: ['*'],
                    imageParameters: buildImageParameters({
                        layerIds: [0, 6, 7, 8],
                        layerOption: 'show'
                    }),
                    mode: 1
                },
                editorLayerInfos: {
                    disableGeometryUpdate: false
                },
                legendLayerInfos: {
                    exclude: false,
                    layerInfo: {
                        title: 'Projects (Previously Reviewed)'
                    }
                },
                layerControlLayerInfos: {
                    //layerGroup: 'Project Data',
                    menu: [{
                        label: 'Open Attribute Table',
                        topic: 'openTable',
                        iconClass: 'fa fa-table fa-fw'
                    }]
                }
            },
            {
                type: 'dynamic',
                url: projects.currentlyInReviewProjectsService,
                title: 'Projects (Currently in Review)',
                options: {
                    id: 'currentlyInReviewProjectsService',
                    opacity: 1.0,
                    visible: true,
                    outFields: ['*'],
                    imageParameters: buildImageParameters({
                        layerIds: [0, 6, 7, 8],
                        layerOption: 'show'
                    }),
                    mode: 1
                },
                editorLayerInfos: {
                    disableGeometryUpdate: false
                },
                legendLayerInfos: {
                    exclude: false,
                    layerInfo: {
                        title: 'Projects (Currently in Review)'
                    }
                },
                layerControlLayerInfos: {
                    //layerGroup: 'Project Data',
                    menu: [{
                        label: 'Open Attribute Table',
                        topic: 'openTable',
                        iconClass: 'fa fa-table fa-fw'
                    }]
                }
            },
            {
                type: 'dynamic',
                url: projects.eliminatedProjectsService,
                title: 'Eliminated Project Alternatives',
                options: {
                    id: 'eliminatedProjectsService',
                    opacity: 1.0,
                    visible: true,
                    outFields: ['*'],
                    imageParameters: buildImageParameters({
                        layerIds: [0, 6, 7, 8],
                        layerOption: 'show'
                    }),
                    mode: 1
                },
                editorLayerInfos: {
                    disableGeometryUpdate: false
                },
                legendLayerInfos: {
                    exclude: false,
                    layerInfo: {
                        title: 'Eliminated Project Alternatives'
                    }
                },
                layerControlLayerInfos: {
                    //layerGroup: 'Project Data',
                    menu: [{
                        label: 'Open Attribute Table',
                        topic: 'openTable',
                        iconClass: 'fa fa-table fa-fw'
                    }]
                }
            },
            {
                type: 'dynamic',
                url: projects.draftProjectsService,
                title: 'Projects (Draft)',
                options: {
                    id: 'draftProjectsService',
                    opacity: 1.0,
                    visible: true,
                    outFields: ['*'],
                    imageParameters: buildImageParameters({
                        layerIds: [0, 6, 7, 8],
                        layerOption: 'show'
                    }),
                    mode: 1
                },
                editorLayerInfos: {
                    disableGeometryUpdate: false
                },
                legendLayerInfos: {
                    exclude: false,
                    layerInfo: {
                        title: 'Projects (Draft)'
                    }
                },
                layerControlLayerInfos: {
                    //layerGroup: 'Project Data',
                    menu: [{
                        label: 'Open Attribute Table',
                        topic: 'openTable',
                        iconClass: 'fa fa-table fa-fw'
                    }]
                }
            }//,
            //{
            //    type: 'feature',
            //    url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/1',
            //    title: 'Area of Interest Points',
            //    options: {
            //        id: 'aoiP',
            //        opacity: 1.0,
            //        visible: false,
            //        outFields: ['*'],
            //        imageParameters: buildImageParameters({
            //            layerIds: [0, 7],
            //            layerOption: 'show'
            //        }),
            //        mode: 1
            //    },
            //    editorLayerInfos: {
            //        exclude: false,
            //        disableGeometryUpdate: false
            //    },
            //    legendLayerInfos: {
            //        exclude: false,
            //        layerInfo: {
            //            title: 'AOI Points'
            //        }
            //    },
            //    layerControlLayerInfos: {
            //        //layerGroup: 'Project Data',
            //        menu: [{
            //            label: 'Open Attribute Table',
            //            topic: 'openTable',
            //            iconClass: 'fa fa-table fa-fw'
            //        }]
            //    }
            //},
            //{
            //    type: 'feature',
            //    url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/2',
            //    title: 'Area of Interest Lines',
            //    options: {
            //        id: 'aoiL',
            //        opacity: 1.0,
            //        visible: false,
            //        outFields: ['*'],
            //        imageParameters: buildImageParameters({
            //            layerIds: [0, 7],
            //            layerOption: 'show'
            //        }),
            //        mode: 1
            //    },
            //    editorLayerInfos: {
            //        exclude: false,
            //        disableGeometryUpdate: false
            //    },
            //    legendLayerInfos: {
            //        exclude: false,
            //        layerInfo: {
            //            title: 'AOI Polylines'
            //        }
            //    },
            //    layerControlLayerInfos: {
            //        //layerGroup: 'Project Data',
            //        menu: [{
            //            label: 'Open Attribute Table',
            //            topic: 'openTable',
            //            iconClass: 'fa fa-table fa-fw'
            //        }]
            //    }
            //},
            //{
            //    type: 'feature',
            //    url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/3',
            //    title: 'Area of Interest Polygons',
            //    options: {
            //        id: 'aoiA',
            //        opacity: 1.0,
            //        visible: false,
            //        outFields: ['*'],
            //        imageParameters: buildImageParameters({
            //            layerIds: [0, 7],
            //            layerOption: 'show'
            //        }),
            //        mode: 1
            //    },
            //    editorLayerInfos: {
            //        exclude: false,
            //        disableGeometryUpdate: false
            //    },
            //    legendLayerInfos: {
            //        exclude: false,
            //        layerInfo: {
            //            title: 'AOI Polygons'
            //        }
            //    },
            //    layerControlLayerInfos: {
            //        //layerGroup: 'Project Data',
            //        menu: [{
            //            label: 'Open Attribute Table',
            //            topic: 'openTable',
            //            iconClass: 'fa fa-table fa-fw'
            //        }]
            //    }
            //},
            //{
            //    type: 'feature',
            //    url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/4',
            //    title: 'Area of Interest Analysis Areas',
            //    options: {
            //        id: 'aoiAA',
            //        opacity: 1.0,
            //        visible: false,
            //        outFields: ['*'],
            //        imageParameters: buildImageParameters({
            //            layerIds: [0, 7],
            //            layerOption: 'show'
            //        }),
            //        mode: 1
            //    },
            //    editorLayerInfos: {
            //        exclude: false,
            //        disableGeometryUpdate: false
            //    },
            //    legendLayerInfos: {
            //        exclude: false,
            //        layerInfo: {
            //            title: 'AOI Analysis Areas'
            //        }
            //    },
            //    layerControlLayerInfos: {
            //        //layerGroup: 'Project Data',
            //        menu: [{
            //            label: 'Open Attribute Table',
            //            topic: 'openTable',
            //            iconClass: 'fa fa-table fa-fw'
            //        }]
            //    }
            //}
        ],
        // set include:true to load. For titlePane type set position the the desired order in the sidebar
        widgets: {
            //handles messaging in upper right
            growler: {
                include: true,
                id: 'growler',
                type: 'layout',
                path: 'gis/dijit/Growler',
                placeAt: document.body,
                options: {
                    style: 'position:absolute;top:15px;' + (has('phone') ? 'left:50%;transform:translate(-50%,0);' : 'right:15px;')
                }
            },
            //address/geographic name search, floats upper left of map
            search: {
                include: true,
                type: has('phone') ? 'titlePane' : 'ui',
                path: 'esri/dijit/Search',
                placeAt: has('phone') ? null : 'top-center',
                title: i18n.viewer.widgets.search,
                iconClass: 'fas fa-search',
                position: 0,
                options: {
                    map: true,
                    visible: true,
                    enableInfoWindow: true,
                    enableButtonMode: has('phone') ? false : true,
                    expanded: true, // || has('phone') ? true : false,
                    allPlaceholder: 'Find address, place, county or district',
                    //enableSourcesMenu: true,
                    addLayersFromMap: false, //doesn't seem to to anything
                    //exactMatch: true,
                    sources: [
                        {
                            locator: new Locator('//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer'),
                            singleLineFieldName: 'SingleLine',
                            outFields: ['Addr_type'],
                            name: 'Esri World Geocoder',
                            countryCode: 'US',
                            localSearchOptions: {
                                minScale: 300000,
                                distance: 50000
                            },
                            searchExtent: new Extent({
                                xmin: -87.79,
                                ymin: 24.38,
                                xmax: -79.8,
                                ymax: 31.1,
                                spatialReference: {
                                    wkid: 4326
                                }
                            }),
                            placeholder: 'Find address or place',
                            highlightSymbol: new PictureMarkerSymbol('images/search-pointer.png', 36, 36).setOffset(9, 18)
                        }/*,
                        {
                            featureLayer: new FeatureLayer('https://services.arcgis.com/LBbVDC0hKPAnLRpO/ArcGIS/rest/services/countyBoundary/FeatureServer/1'),
                            searchFields: ['NAME'],
                            suggestionTemplate: '${NAME}', //setting this to 'Name' causes it to return 'Untitled', have to match case
                            //displayField: 'Name',
                            exactMatch: true, //doesn't seem to do anything, still returns match for 'SEMINOLE' before 'LEON' when searching 'LE'
                            outFields: ['*'],
                            name: 'Counties',
                            placeholder: 'County name',
                            maxResults: 6,
                            maxSuggestions: 6,
                            enableSuggestions: true,
                            minCharacters: 0,
                            localSearchOptions: {distance: 5000}
                        },
                        {
                            featureLayer: new FeatureLayer('https://ca.dep.state.fl.us/arcgis/rest/services/Map_Direct/Boundaries/MapServer/9'), //TODO use a geoplan source
                            searchFields: ['NAME'],
                            suggestionTemplate: '${NAME}', //setting this to 'Name' causes it to return 'Untitled', have to match case
                            //displayField: 'Name',
                            exactMatch: false, 
                            outFields: ['*'],
                            name: 'Water Management Districts',
                            placeholder: 'WMD name',
                            maxResults: 6,
                            maxSuggestions: 6,
                            enableSuggestions: true,
                            minCharacters: 0,
                            localSearchOptions: {distance: 5000}
                        }*/
                    ]

                }
            },
            //bottom band
            attributesTable: {
                include: true,
                id: 'attributesTable',
                type: 'domNode',
                srcNodeRef: 'attributesContainer',
                path: 'gis/dijit/AttributesTable',
                options: {
                    map: true,
                    mapClickMode: false, //TODO sort out weirdness where it tries to identify instead of select when this is true

                    // use a tab container for multiple tables or
                    // show only a single table
                    useTabs: true, //Note: nothing shows up if useTabs is set to true. If we really need that we'll have to sort out what's wrong with AttributesTable tab functionality.

                    // used to open the sidebar after a query has completed
                    sidebarID: 'sidebarBottom'

                    //// optional tables to load when the widget is first instantiated
                    //tables: [
                    //    {
                    //        title: 'Census',
                    //        topicID: 'censusQuery',
                    //        queryOptions: {
                    //            queryParameters: {
                    //                url: 'http://sampleserver1.arcgisonline.com/ArcGIS/rest/services/Demographics/ESRI_Census_USA/MapServer/4',
                    //                maxAllowableOffset: 100,
                    //                where: 'STATE_FIPS = \'06\' OR STATE_FIPS = \'08\''
                    //            },
                    //            idProperty: 'ObjectID'
                    //        }
                    //    }
                    //]
                }
            },
            //right-click map to get address
            reverseGeocoder: {
                include: true,
                type: 'invisible',
                path: 'gis/dijit/ReverseGeocoder',
                options: {
                    map: true,
                    mapRightClickMenu: true
                }
            },
            //right-click map to get street view
            streetView: {
                include: true,
                type: 'invisible',
                path: 'gis/dijit/StreetView2',
                options: {
                    map: true,
                    mapRightClickMenu: true
                }
            },
            //floats upper right of map
            basemaps: {
                include: true,
                id: 'basemaps',
                type: 'ui',
                path: 'gis/dijit/Basemaps',
                placeAt: 'top-right',
                position: 'first',
                options: 'config/basemaps'
            },
            //bottom left of map
            mapInfo: {
                include: true,
                id: 'mapInfo',
                type: 'domNode',
                path: 'gis/dijit/MapInfo',
                srcNodeRef: 'mapInfoDijit',
                options: {
                    map: true,
                    mode: 'dms',
                    firstCoord: 'y',
                    unitScale: 3,
                    showScale: true,
                    xLabel: '',
                    yLabel: '',
                    minWidth: 286
                }
            },
            //bottom center of map
            scalebar: {
                include: true,
                id: 'scalebar',
                type: 'map',
                path: 'esri/dijit/Scalebar',
                options: {
                    map: true,
                    attachTo: 'bottom-center',
                    scalebarStyle: 'line',
                    scalebarUnit: 'dual'
                }
            },
            //bottom-right of map, little arrow icon toggles display
            overviewMap: {
                include: true, //has('phone') ? true : false,
                id: 'overviewMap',
                type: 'map',
                path: 'esri/dijit/OverviewMap',
                options: {
                    map: true,
                    attachTo: 'bottom-right',
                    color: '#0000CC',
                    height: 100,
                    width: 125,
                    opacity: 0.30,
                    visible: false
                }
            },
            //upper-right, below zoomIn/ZoomOut
            homeButton: {
                include: true,
                id: 'homeButton',
                type: 'ui',
                path: 'esri/dijit/HomeButton',
                placeAt: 'top-left',
                options: {
                    map: true,
                    extent: new Extent({
                        xmin: -87.79,
                        ymin: 24.38,
                        xmax: -79.8,
                        ymax: 31.1,
                        spatialReference: {
                            wkid: 4326
                        }
                    })
                }
            },
            //floats when toggled from iHelp menu
            help: {
                include: has('phone') ? false : true,
                id: 'help',
                type: 'floating',
                path: 'gis/dijit/Help',
                title: i18n.viewer.widgets.help,
                iconClass: 'fas fa-fw fa-info-circle',
                paneOptions: {
                    draggable: false,
                    html: '<a href="#"><i class="fas fa-fw fa-info-circle"></i>link</a>'.replace('link', i18n.viewer.widgets.help),
                    domTarget: 'helpDijit',
                    style: 'height:345px;width:520px;'
                },
                options: {}
            },
            //title-pane type widgets, in left menu, positioned in the order shown below
            layerLoader: {
                include: true,
                id: 'layerLoader',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/LayerLoader',
                title: 'Map Loader',
                open: true,
                position: 0,
                options: {
                    map: true
                } //'config/layerLoader'
            },
            layerControl: {
                include: true,
                id: 'layerControl',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/LayerControl',
                title: i18n.viewer.widgets.layerControl,
                iconClass: 'fas fa-fw fa-th-list',
                open: true,
                position: 1,
                options: {
                    map: true,
                    layerControlLayerInfos: true,
                    separated: true,
                    vectorReorder: true,
                    overlayReorder: true
                    // create a custom menu entry in all of these feature types
                    // the custom menu item will publish a topic when clicked
                    /*menu: {
                        feature: [{
                            topic: 'hello',
                            iconClass: 'fas fa-fw fa-smile',
                            label: 'Say Hello A'
                        }],
                        dynamic: [{
                            topic: 'hello',
                            iconClass: 'fas fa-fw fa-smile',
                            label: 'Say Hello B'
                        }]
                    }*/

                    //create a example sub layer menu that will
                    /*apply to all layers of type 'dynamic'
                    subLayerMenu: {
                        dynamic: [{
                            topic: 'remove',
                            iconClass: 'fas fa-fw fa-frown',
                            label: 'Remove C'
                        }]
                    }*/
                }
            }, //open
            legend: {
                include: true,
                id: 'legend',
                type: 'titlePane',
                path: 'gis/dijit/Legend',
                title: i18n.viewer.widgets.legend,
                iconClass: 'far fa-fw fa-images',
                open: false,
                position: 2,
                options: {
                    map: true,
                    legendLayerInfos: true
                }
            },

            projectEditor: {
                include: false, //we start with this false, then if use has authority we change to true before processing by _WidgetsMixin.js. This happens in _AuthorizationMixin.js
                id: 'projectEditor',
                type: 'titlePane',
                path: 'gis/dijit/ProjectEditor',
                canFloat: true,
                title: 'Project Editor',
                iconClass: 'fas fa-fw fa-pencil-alt',
                open: true,
                position: 3,
                options: {
                    map: true,
                    mapClickMode: true,
                    settings: {

                    }
                }
            },

            aoiEditor: {
                include: false, //we start with this false, then if use has authority we change to true before processing by _WidgetsMixin.js. This happens in _AuthorizationMixin.js
                id: 'aoiEditor',
                type: 'titlePane',
                path: 'gis/dijit/AoiEditor',
                canFloat: true,
                title: 'AOI Editor',
                iconClass: 'fas fa-fw fa-pencil-alt',
                open: true,
                position: 4,
                options: {
                    map: true,
                    mapClickMode: true,
                    settings: {

                    }
                }
            },
            identify: {
                include: true,
                id: 'identify',
                type: 'titlePane',
                path: 'gis/dijit/Identify',
                title: i18n.viewer.widgets.identify,
                iconClass: 'fas fa-fw fa-info-circle',
                open: false,
                preload: true,
                position: 5,
                options: 'config/identify'
            },
            zoomToRegion: {
                include: true,
                id: 'zoomToRegion',
                type: 'titlePane',
                title: 'Zoom to Region',
                position: 6,
                open: true,
                path: 'gis/dijit/ZoomToFeature',
                options: {
                    map: true,

                    url: projects.queryRegionsLayer,
                    field: 'DESCRIPT',
                    maxAllowableOffset: 100,
                    i18n: {
                        selectFeature: 'Enter a City, County, MPO, WMD, or FDOT District Name'
                    }
                }
            }, //open
            find: { //excluded
                include: false,
                id: 'find',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/Find',
                title: i18n.viewer.widgets.find,
                iconClass: 'fas fa-fw fa-search',
                open: false,
                position: 7,
                options: 'config/find'
            },
            bookmarks: {
                include: true,
                id: 'bookmarks',
                type: 'titlePane',
                path: 'gis/dijit/Bookmarks',
                title: i18n.viewer.widgets.bookmarks,
                iconClass: 'fas fa-fw fa-bookmark',
                open: false,
                position: 8,
                options: 'config/bookmarks'
            },
            draw: {
                include: true,
                id: 'draw',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/Draw',
                title: i18n.viewer.widgets.draw,
                iconClass: 'fas fa-fw fa-paint-brush',
                open: false,
                position: 9,
                options: {
                    map: true,
                    mapClickMode: true
                }
            },
            measure: {
                include: true,
                id: 'measurement',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/Measurement',
                title: i18n.viewer.widgets.measure,
                iconClass: 'fas fa-fw fa-expand',
                open: false,
                position: 10,
                options: {
                    map: true,
                    mapClickMode: true,
                    defaultAreaUnit: units.SQUARE_MILES,
                    defaultLengthUnit: units.MILES
                }
            },
            print: {
                include: true,
                id: 'print',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/Print',
                title: i18n.viewer.widgets.print,
                iconClass: 'fas fa-fw fa-print',
                open: false,
                position: 11,
                options: {
                    map: true,
                    printTaskURL: 'https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task',
                    copyrightText: 'Copyright ' + new Date().getFullYear(),
                    authorText: 'Me',
                    defaultTitle: 'Viewer Map',
                    defaultFormat: 'PDF',
                    defaultLayout: 'Letter ANSI A Landscape',
                    customTextElements: [
                        //property name should match the custom element in the mxd.  Value should be what you want the label to be.
                        /*
                        {
                            subTitle: 'Subtitle'
                        }
                        */
                    ]
                }
            }

            /* TODO: need Google Maps API key,
            streetview: {
                include: true,
                id: 'streetview',
                type: 'titlePane',
                canFloat: true,
                position: 11,
                path: 'gis/dijit/StreetView',
                title: i18n.viewer.widgets.streetview,
                iconClass: 'fas fa-fw fa-street-view',
                paneOptions: {
                    resizable: true,
                    resizeOptions: {
                        minSize: {
                            w: 250,
                            h: 250
                        }
                    }
                },
                options: {
                    map: true,
                    mapClickMode: true,
                    mapRightClickMenu: true
                }
            },*/
            /*directions: {
                include: true,
                id: 'directions',
                type: 'titlePane',
                path: 'gis/dijit/Directions',
                title: i18n.viewer.widgets.directions,
                iconClass: 'fas fa-fw fa-map-signs',
                open: false,
                position: 9,
                options: {
                    map: true,
                    mapRightClickMenu: true,
                    options: {
                        routeTaskUrl: 'https://sampleserver3.arcgisonline.com/ArcGIS/rest/services/Network/USA/NAServer/Route',
                        routeParams: {
                            directionsLanguage: 'en-US',
                            directionsLengthUnits: units.MILES
                        },
                        active: false //for 3.12, starts active by default, which we dont want as it interfears with mapClickMode
                    }
                }
            },*/
            /*,
            dnd: {
            include: true,
            id: 'dnd',
            type: 'titlePane',
            canFloat: true,
            path: 'gis/dijit/DnD',
            title: 'Drag and Drop',
            position: 3,
            options: {
                map: true
            }
        },*/

        }
    
    };


});
