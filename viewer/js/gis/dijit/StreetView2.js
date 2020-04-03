define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dojo/_base/lang',
    'dijit/MenuItem',
    'esri/geometry/webMercatorUtils',
    'dojo/i18n!./StreetView2/nls/resource'
], function (
    declare,
    _WidgetBase,
    lang,
    MenuItem,
    webMercatorUtils,
    i18n
) {

    return declare([_WidgetBase], {
        i18n: i18n,

        postCreate: function () {
            this.inherited(arguments);
            
            this.map.on('MouseDown', lang.hitch(this, function (evt) {
                this.mapRightClickPoint = evt.mapPoint;
            }));

            this.mapRightClickMenu.addChild(new MenuItem({
                label: this.i18n.labels.getStreetViewHere,
                onClick: lang.hitch(this, 'showStreetView')
            }));

        },

        showStreetView: function () {
            var location = webMercatorUtils.webMercatorToGeographic(this.mapRightClickPoint),
                url = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + location.y + ',' + location.x;

            window.open(url);

            return false; //prevents info window popup
        }
    });
});