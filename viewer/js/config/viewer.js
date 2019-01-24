define([
    'esri/units',
    'esri/geometry/Extent',
    'esri/config',
    /*'esri/urlUtils',*/
    'esri/tasks/GeometryService',
    'esri/layers/ImageParameters',
    'esri/tasks/locator',
    'esri/layers/FeatureLayer',
    'gis/plugins/Google',
    'dojo/i18n!./nls/main',
    'dojo/topic',
    'dojo/sniff',
    'dijit/Dialog',
    'dojo/request'
], function (units, Extent, esriConfig, /*urlUtils,*/ GeometryService, ImageParameters, Locator, FeatureLayer, GoogleMapsLoader, i18n, topic, has, Dialog, request) {

    // url to your proxy page, must be on same machine hosting you app. See proxy folder for readme.
    esriConfig.defaults.io.proxyUrl = 'proxy/proxy.ashx';
    esriConfig.defaults.io.alwaysUseProxy = false;
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

    topic.subscribe('layerControl/viewMetadata', function (event) {
        //using request instead of the direct href property so we can handle errors
        //there's probably a way to handle errors with dialog.show, but Dojo documentation isn't clear on that
        request('/est/metadata/' + event.subLayer.sdeLayerName + '.htm', {
            headers: {
                'X-Requested-With': null
            }
        }).then(
            function (data) {
                var dlg = new Dialog({
                    id: event.subLayer.sdeLayerName + '_metadata',
                    title: 'Metadata for ' + event.subLayer.name,
                    content: data
                });
                dlg.show();
            },
            function () {
                //happens when running on a local server that doesn't have /est/metadata path
                //so make request to pub server
                //using window.open to work around CORS issues
                topic.publish('growler/growl', 'Fetching metadata for ' + event.subLayer.name);
                window.open('https://etdmpub.fla-etat.org/est/metadata/' + event.subLayer.sdeLayerName + '.htm');
            });

        //var dlg = new Dialog({
        //    id: event.subLayer.sdeLayerName + '_metadata',
        //    title: 'Metadata for ' + event.subLayer.name,
        //    href: '/est/metadata/' + event.subLayer.sdeLayerName + '.htm'
        //});
        //dlg.show();
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
            zoom: 6,
            sliderStyle: 'small'/*,
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
                splitter: true
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
        operationalLayers: [{
            type: 'dynamic',
            url: 'https://pisces.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/Previously_Reviewed_Dev/MapServer',
            title: 'Projects (Previously Reviewed)',
            options: {
                id: 'projects',
                opacity: 1.0,
                visible: true,
                outFields: ['*'],
                imageParameters: buildImageParameters({
                    layerIds: [0, 7],
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
        }],
        // set include:true to load. For titlePane type set position the the desired order in the sidebar
        widgets: {
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
                    enableSourcesMenu: true,
                    addLayersFromMap: true, //doesn't seem to to anything
                    exactMatch: true,
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
                            placeholder: 'Find address or place',
                            highlightSymbol: {
                                url: 'https://js.arcgis.com/3.27/esri/dijit/Search/images/search-pointer.png',
                                width: 36, height: 36, xoffset: 9, yoffset: 18
                            }
                        },
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
                        }
                    ]

                }
            },
            reverseGeocoder: {
                include: true,
                type: 'invisible',
                path: 'gis/dijit/ReverseGeocoder',
                options: {
                    map: true,
                    mapRightClickMenu: true
                }
            },
            basemaps: {
                include: true,
                id: 'basemaps',
                type: 'ui',
                path: 'gis/dijit/Basemaps',
                placeAt: 'top-right',
                position: 'first',
                options: 'config/basemaps'
            },
            identify: {
                include: true,
                id: 'identify',
                type: 'titlePane',
                path: 'gis/dijit/Identify',
                title: i18n.viewer.widgets.identify,
                iconClass: 'fas fa-info-circle',
                open: false,
                preload: true,
                position: 3,
                options: 'config/identify'
            },
            mapInfo: {
                include: false,
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
            scalebar: {
                include: true,
                id: 'scalebar',
                type: 'map',
                path: 'esri/dijit/Scalebar',
                options: {
                    map: true,
                    attachTo: 'bottom-left',
                    scalebarStyle: 'line',
                    scalebarUnit: 'dual'
                }
            },
            locateButton: {
                include: true,
                id: 'locateButton',
                type: 'ui',
                path: 'gis/dijit/LocateButton',
                placeAt: 'top-left',
                position: 'last',
                options: {
                    map: true,
                    publishGPSPosition: true,
                    highlightLocation: true,
                    useTracking: true,
                    geolocationOptions: {
                        maximumAge: 0,
                        timeout: 15000,
                        enableHighAccuracy: true
                    }
                }
            },
            overviewMap: {
                include: has('phone') ? false : true,
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
            layerLoader: {
                include: true,
                id: 'layerLoader',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/LayerLoader',
                title: 'Map Loader',
                open: true,
                position: 0,
                options: 'config/layerLoader'
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
                    overlayReorder: true,
                    // create a custom menu entry in all of these feature types
                    // the custom menu item will publish a topic when clicked
                    menu: {
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
                    }

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
            },
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
            },
            bookmarks: {
                include: true,
                id: 'bookmarks',
                type: 'titlePane',
                path: 'gis/dijit/Bookmarks',
                title: i18n.viewer.widgets.bookmarks,
                iconClass: 'fas fa-fw fa-bookmark',
                open: false,
                position: 4,
                options: 'config/bookmarks'
            },
            find: {
                include: true,
                id: 'find',
                type: 'titlePane',
                canFloat: true,
                path: 'gis/dijit/Find',
                title: i18n.viewer.widgets.find,
                iconClass: 'fas fa-fw fa-search',
                open: false,
                position: 5,
                options: 'config/find'
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
                position: 6,
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
                position: 7,
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
                position: 8,
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
            },
            directions: {
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
            },
            zoomToCounty: {
                include: true,
                id: 'zoomToCounty',
                type: 'titlePane',
                title: 'Zoom to County',
                position: 10,
                open: true,
                path: 'gis/dijit/ZoomToFeature',
                options: {
                    map: true,

                    url: 'https://services.arcgis.com/LBbVDC0hKPAnLRpO/ArcGIS/rest/services/countyBoundary/FeatureServer/1',
                    field: 'NAME',
                    //where: 'STATE_FIPS = \'12\'',

                    // you can customize the text
                    i18n: {
                        selectFeature: 'Select a County'
                    }
                }
            },
            zoomToWMD: {
                include: true,
                id: 'zoomToWMD',
                type: 'titlePane',
                title: 'Zoom to Water Management District',
                position: 11,
                open: true,
                path: 'gis/dijit/ZoomToFeature',
                options: {
                    map: true,

                    url: 'https://ca.dep.state.fl.us/arcgis/rest/services/Map_Direct/Boundaries/MapServer/9',
                    field: 'NAME',

                    // you can customize the text
                    i18n: {
                        selectFeature: 'Select a District'
                    }
                }
            },
            
            editor: {
                include: false, // TODO has('phone') ? false : true,
                id: 'editor',
                type: 'titlePane',
                path: 'gis/dijit/Editor',
                title: i18n.viewer.widgets.editor,
                iconClass: 'fas fa-fw fa-pencil-alt',
                open: false,
                position: 12,
                options: {
                    map: true,
                    mapClickMode: true,
                    editorLayerInfos: true,
                    settings: {
                        toolbarVisible: true,
                        showAttributesOnClick: true,
                        enableUndoRedo: true,
                        createOptions: {
                            polygonDrawTools: ['freehandpolygon', 'autocomplete']
                        },
                        toolbarOptions: {
                            reshapeVisible: true,
                            cutVisible: true,
                            mergeVisible: true
                        }
                    }
                }
            },
            
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
            /*locale: {
                include: true,
                type: has('phone') ? 'titlePane' : 'domNode',
                id: 'locale',
                position: 0,
                srcNodeRef: 'geocodeDijit',
                path: 'gis/dijit/Locale',
                title: i18n.viewer.widgets.locale,
                iconClass: 'fas fa-fw fa-flag',
                options: {
                    style: has('phone') ? null : 'margin-left: 30px;'
                }
            },*/
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
                    style: 'height:345px;width:450px;'
                },
                options: {}
            }

        }
    
    };


});
