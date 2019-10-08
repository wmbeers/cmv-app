define([
], function () {
    return {
        queryMmaLayer: 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_MMA_Dev/MapServer/0',
        queryDraftLayer: 'https://capricorn.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/v3_Query_Drafts_Dev/MapServer/0',
        aoiLayers: {
            point: {
                url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/1',
                name: 'Points'
            },
            polyline: {
                url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/2',
                name: 'Lines'
            },
            polygon: {
                url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/3',
                name: 'Polygons'
            },
            analysisAreaBuffer: {
                url: 'https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/4',
                name: 'Analysis Area Buffers'
            }
        }
    };
});
