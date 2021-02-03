define([
    './js/config/identifyProjectDefault.js'
], function (identifyProjectDefault) {

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


        //actual identifies configuration used Identify widget, resuses the _projectServiceIdentifyConfig model defined above
        identifies: {
            previouslyReviewedProjectsService: identifyProjectDefault,
            currentlyInReviewProjectsService: identifyProjectDefault,
            eliminatedProjectService: identifyProjectDefault,
            draftProjectsService: identifyProjectDefault
        }
    };
});
