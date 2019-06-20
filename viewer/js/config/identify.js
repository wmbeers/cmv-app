define([
], function () {

    //var linkTemplate = '<a href="{url}" target="_blank">{text}</a>';
    //function directionsFormatter (noValue, attributes) {
    //    return lang.replace(linkTemplate, {
    //        url: 'https://www.google.com/maps/dir/' + attributes.Address + ' Louisville, KY',
    //        text: 'Get Directions'
    //    });
    //}

    return {
        map: true,
        mapClickMode: true,
        mapRightClickMenu: true,
        identifyLayerInfos: true,
        identifyTolerance: 5,
        draggable: false,
        returnFieldName: false,
        returnUnformattedValues: false,

        // config object definition:
        //  {<layer id>:{
        //      <sub layer number>:{
        //          <pop-up definition, see link below>
        //          }
        //      },
        //  <layer id>:{
        //      <sub layer number>:{
        //          <pop-up definition, see link below>
        //          }
        //      }
        //  }

        // for details on pop-up definition see: https://developers.arcgis.com/javascript/jshelp/intro_popuptemplate.html

        identifies: {
            previouslyReviewedProjectsLayer: {
                2: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'POINT_ID',
                            label: 'Point ID'
                        }
                    ]
                },
                3: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'SEGMENT_ID',
                            label: 'Line ID'
                        }
                    ]
                },
                4: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'POLY _ID',
                            label: 'Polygon ID'
                        }
                    ]
                },
                5: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'STREET_NAME',
                            label: 'Street Name',
                            formatter: function (value) {
                                return value === 'Null' ? '' : value;
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FROM_STREET',
                            label: 'From Street',
                            formatter: function (value) {
                                return value === 'Null' ? '' : value;
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'TO_STREET',
                            label: 'To Street',
                            formatter: function (value) {
                                return value === 'Null' ? '' : value;
                            }
                        }
                    ]
                },
                6: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        }
                    ]
                },
                7: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'SEGMENT_ID',
                            label: 'Segment ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        } 
                    ]
                },
                8: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'POLY_ID',
                            label: 'Poly ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        }
                    ]
                },
                9: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        }
                    ]
                },
                12: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                13: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                14: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                15: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                16: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                17: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                19: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                20: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                21: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                22: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                23: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                24: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                }
            },
            currentlyInReviewProjects: {
                2: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'POINT_ID',
                            label: 'Point ID'
                        }
                    ]
                },
                3: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'SEGMENT_ID',
                            label: 'Line ID'
                        }
                    ]
                },
                4: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'POLY _ID',
                            label: 'Polygon ID'
                        }
                    ]
                },
                5: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'STREET_NAME',
                            label: 'Street Name',
                            formatter: function (value) {
                                return value === 'Null' ? '' : value;
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FROM_STREET',
                            label: 'From Street',
                            formatter: function (value) {
                                return value === 'Null' ? '' : value;
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'TO_STREET',
                            label: 'To Street',
                            formatter: function (value) {
                                return value === 'Null' ? '' : value;
                            }
                        }
                    ]
                },
                6: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        }
                    ]
                },
                7: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'SEGMENT_ID',
                            label: 'Segment ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        }
                    ]
                },
                8: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'POLY_ID',
                            label: 'Poly ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        }
                    ]
                },
                9: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        }
                    ]
                },
                12: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                13: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                14: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                15: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                16: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                17: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        },
                        {
                            visible: true,
                            fieldName: 'FEATURE_DESCRIPTION',
                            label: 'Feature Type',
                            formatter: function (value) {
                                return value.charAt(0) + value.slice(1).toLowerCase();
                            }
                        }
                    ]
                },
                19: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                20: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                21: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                22: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                23: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                },
                24: {
                    fieldInfos: [
                        {
                            visible: true,
                            fieldName: 'ALT_ID',
                            label: 'Project/Analysis Area ID'
                        },
                        {
                            visible: true,
                            fieldName: 'PRJNAME',
                            label: 'Project Name'
                        },
                        {
                            visible: true,
                            fieldName: 'FK_ALT_TYPE',
                            label: 'Type'
                        },
                        {
                            visible: true,
                            fieldName: 'CURRENT_STATUS',
                            label: 'Status'
                        },
                        {
                            visible: true,
                            fieldName: 'BUFFER_DISTANCE',
                            label: 'Buffer Distance',
                            formatter: function (value) {
                                return value.toString() + ' ft.';
                            }
                        }
                    ]
                }
            }
        }
    };
});
