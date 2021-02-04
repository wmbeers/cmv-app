define([
    './js/config/projectConfig.js' //contains constructIdentifies function used to build the Identify widget configuration for project services
], function (projectConfig) {

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
        draggable: true,
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

        //identifies configuration used by Identify widget, resuses the identifyConfig model from projectConfig.js, injected above
        identifies: {
            previouslyReviewedProjectsService: projectConfig.constructIdentifies(true),
            currentlyInReviewProjectsService: projectConfig.constructIdentifies(true),
            eliminatedProjectsService: projectConfig.constructIdentifies(false),
            draftProjectsService: projectConfig.constructIdentifies(false)
        }
    };
});
