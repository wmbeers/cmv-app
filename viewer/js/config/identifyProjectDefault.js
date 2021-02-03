//standard configuration of an EST project service
define(
    {
        //  0 Analysis Area Features Folder
        //    1 Labels Folder
        //      2 Point Labels
        //      3 Line Labels
        //      4 Poly Labels
        //    5 Terminii
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
        //    6 Points
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
        //    7 Lines
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
        //    8 Polygons
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
        //  9 Analysis Areas (1 ft buffer around points, lines and polys)
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
        // 10 GIS Buffers folder
        //    11 Feature Buffers folder
        //       12 100' Feature Buffer
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
                        return value ? (value.toString() + ' ft.') : '<null>';
                    }
                },
                {
                    visible: true,
                    fieldName: 'FEATURE_DESCRIPTION',
                    label: 'Feature Type',
                    formatter: function (value) {
                        return value ? value.charAt(0) + value.slice(1).toLowerCase() : '<null>';
                    }
                }
            ]
        },
        //       13 200' Feature Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                },
                {
                    visible: true,
                    fieldName: 'FEATURE_DESCRIPTION',
                    label: 'Feature Type',
                    formatter: function (value) {
                        return value ? value.charAt(0) + value.slice(1).toLowerCase() : '<null>';
                    }
                }
            ]
        },
        //       14 500' Feature Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                },
                {
                    visible: true,
                    fieldName: 'FEATURE_DESCRIPTION',
                    label: 'Feature Type',
                    formatter: function (value) {
                        return value ? value.charAt(0) + value.slice(1).toLowerCase() : '<null>';
                    }
                }
            ]
        },
        //       15 1320' Feature Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                },
                {
                    visible: true,
                    fieldName: 'FEATURE_DESCRIPTION',
                    label: 'Feature Type',
                    formatter: function (value) {
                        return value ? value.charAt(0) + value.slice(1).toLowerCase() : '<null>';
                    }
                }
            ]
        },
        //       16 2640' Feature Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                },
                {
                    visible: true,
                    fieldName: 'FEATURE_DESCRIPTION',
                    label: 'Feature Type',
                    formatter: function (value) {
                        return value ? value.charAt(0) + value.slice(1).toLowerCase() : '<null>';
                    }
                }
            ]
        },
        //       17 5280' Feature Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                },
                {
                    visible: true,
                    fieldName: 'FEATURE_DESCRIPTION',
                    label: 'Feature Type',
                    formatter: function (value) {
                        return value ? value.charAt(0) + value.slice(1).toLowerCase() : '<null>';
                    }
                }
            ]
        },
        //    18 Analysis Area Buffers Folder
        //       19 100' Analysis Area Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                }
            ]
        },
        //       20 200' Analysis Area Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                }
            ]
        },
        //       21 500' Analysis Area Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                }
            ]
        },
        //       22 1320' Analysis Area Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                }
            ]
        },
        //       23 2640' Analysis Area Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                }
            ]
        },
        //       24 5280' Analysis Area Buffer
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
                        return value ? value.toString() + ' ft.' : '<null>';
                    }
                }
            ]
        }
    }
);
