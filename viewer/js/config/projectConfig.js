/**
 * Helper functions for constructing standard EST project services, referenced in operationalLayers section of config/viewer.js, and
 * standard Identify widget configuration, referenced in config/identify.js
 */
define([
    'esri/layers/ImageParameters',
    './js/config/projects.js'
],
function (ImageParameters, projectUrls) {
    return {

        /**
         * Constructs a standard configuration for a project service, used in building configuration of operational layers in viewer.js
         * @param {string} id ID of the service as referenced in projects.js
         * @param {string} title Display name of the service in LayerControl, Legend, Identify, etc. widgets
         * @returns {object} a JS object compatible with item in CMV viewer.js operationalLayers configuration element
         */
        constructOperationalLayer: function (id, title) {
            var imageParameters = new ImageParameters();
            imageParameters.format = 'png32';
            imageParameters.layerIds = [0, 6, 7, 8];
            imageParameters.layerOption = 'show';

            return {
                type: 'dynamic',
                url: projectUrls[id],
                title: title,
                options: {
                    id: id,
                    opacity: 1.0,
                    visible: true,
                    outFields: ['*'],
                    imageParameters: imageParameters,
                    mode: 1
                },
                editorLayerInfos: {
                    disableGeometryUpdate: false
                },
                legendLayerInfos: {
                    exclude: false,
                    layerInfo: {
                        title: title
                    }
                },
                layerControlLayerInfos: {
                    subLayerMenu: [{
                        label: 'Open Attribute Table',
                        topic: 'openAttributeTable',
                        iconClass: 'fa fa-table fa-fw'
                    }]
                },
                identifyLayerInfos: {
                    layerIds: [5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24]
                }
            };
        },

        /**
        * Construct a standard configuration of a project map service for the identify widget, with tweaks to 
        * handle the structural differences between the different services.
        * @param {boolean} useUnderscoreInFeatureIdFieldNames Set to true when constructing for 
        *  currently in review/previously reviewed services to use field names POINT_ID, SEGMENT_ID and POLY_ID;
        *  omit or set to false for draft/eliminated services to use field names POINTID, SEGMENTID and AREAID;
         * @returns {object} a JS object compatible with identify widget "identifies" configuration
        */
        constructIdentifies: function (useUnderscoreInFeatureIdFieldNames) {
            var identifies = {}, //the identifies object that will be used to configure the Identify widget
                //project name field, used several times
                prjNameFieldInfo = {
                    fieldName: 'PRJNAME',
                    label: 'Project Name'
                },
                //feature description (point, line, polygon) used on feature buffer layers
                featureDescriptionFieldInfo = {
                    fieldName: useUnderscoreInFeatureIdFieldNames ? 'FEATURE_DESCRIPTION' : 'FEAT_DESCRIPT',
                    label: 'Buffered Feature Type',
                    formatter: function (value) {
                        switch (value) {
                        case 'POINT': return 'Point';
                        case 'LINE': return 'Line';
                        case 'POLYGON': return 'Polygon';
                        default: return '';
                        }
                    }
                };

            //  0 Analysis Area Features Folder
            //    1 Labels Folder
            //      2 Point Labels
            //      3 Line Labels
            //      4 Poly Labels
            //    5 Termini
            identifies[5] = this._constructDefaultIdentifyFieldInfos([
                {
                    fieldName: 'TERMINII',
                    label: 'Terminus'
                }
            ]);
            //    6 Points
            identifies[6] = this._constructDefaultIdentifyFieldInfos([
                {
                    fieldName: useUnderscoreInFeatureIdFieldNames ? 'POINT_ID' : 'POINTID',
                    label: 'Point ID'
                }
            ]);
            //    7 Lines
            identifies[7] = this._constructDefaultIdentifyFieldInfos([
                {
                    fieldName: useUnderscoreInFeatureIdFieldNames ? 'SEGMENT_ID' : 'SEGMENTID',
                    label: 'Segment ID'
                }
            ]);

            //    8 Polygons
            identifies[8] = this._constructDefaultIdentifyFieldInfos([
                {
                    fieldName: useUnderscoreInFeatureIdFieldNames ? 'POLY_ID' : 'AREAID',
                    label: 'Polygon ID'
                }
            ]);
            //  9 Analysis Areas (1 ft buffer around points, lines and polys)
            identifies[9] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo
            ]);
            // 10 GIS Buffers folder
            //    11 Feature Buffers folder
            //       12 100' Feature Buffer

            identifies[12] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo,
                featureDescriptionFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       13 200' Feature Buffer
            identifies[13] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo,
                featureDescriptionFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       14 500' Feature Buffer
            identifies[14] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo,
                featureDescriptionFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       15 1320' Feature Buffer
            identifies[15] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo,
                featureDescriptionFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       16 2640' Feature Buffer
            identifies[16] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo,
                featureDescriptionFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       17 5280' Feature Buffer
            identifies[17] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo,
                featureDescriptionFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //    18 Analysis Area Buffers Folder
            //       19 100' Analysis Area Buffer
            identifies[19] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);
            //       20 200' Analysis Area Buffer
            identifies[20] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       21 500' Analysis Area Buffer
            identifies[21] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       22 1320' Analysis Area Buffer
            identifies[22] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       23 2640' Analysis Area Buffer
            identifies[23] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            //       24 5280' Analysis Area Buffer
            identifies[24] = this._constructDefaultIdentifyFieldInfos([
                prjNameFieldInfo
                //buffer distance might be nice, but is missing from draft/eliminated, and is redundant with the name of the layer
            ]);

            return identifies;
        },

        /**
         * Internal constructor of a fieldInfos object, initializing with default fieldInfos of ALT_ID and ALT_NAME,
         * and appending any additional ones passed in via additionalFieldInfos paramter. Called from constructIdentifies function.
         * @param {array<fieldInfo>} additionalFieldInfos An array of fieldInfos to append to the default ALT_ID and ALT_NAME
         * @returns {object} a JS object compatible with fieldInfos property of items in CMV Identify widget identifies configuration element
         */
        _constructDefaultIdentifyFieldInfos: function (additionalFieldInfos) {
            var fieldInfos = [
                {
                    fieldName: 'ALT_ID',
                    label: 'Project/Analysis Area ID'
                },
                {
                    fieldName: 'ALT_NAME',
                    label: 'Analysis Area Name'
                }
            ];
            //concatenate the default fieldInfos (id, name) with any specified for the sublayer
            if (additionalFieldInfos && additionalFieldInfos.length) {
                fieldInfos = fieldInfos.concat(additionalFieldInfos);
            }
            //post-process to add visible=true and default formatter to suppress 'Null' if not specified
            fieldInfos.forEach(function (fieldInfo) {
                fieldInfo.visible = true;
                if (!fieldInfo.formatter) {
                    fieldInfo.formatter = function (value) {
                        return value === 'Null' ? '' : value;
                    };
                }
            });

            return {
                fieldInfos: fieldInfos
            };
        }
    };
});
