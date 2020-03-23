define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',

    'dojo/_base/lang',
    'dojo/on',
    'dojo/_base/array',

    'dijit/MenuItem',

    'esri/geometry/webMercatorUtils',
    'esri/graphic',
    'esri/symbols/PictureMarkerSymbol',
    'esri/InfoTemplate',
    'esri/layers/GraphicsLayer',

    'dojo/i18n!./StreetView2/nls/resource'

], function (
    declare,
    _WidgetBase,

    lang,
    on,
    array,

    MenuItem,

    webMercatorUtils,
    Graphic,
    PictureMarkerSymbol,
    InfoTemplate,
    GraphicsLayer,

    i18n
) {

    return declare([_WidgetBase], {
        i18n: i18n,
        url: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=',

        symbol: new PictureMarkerSymbol({
            angle: 0,
            xoffset: 3,
            yoffset: 4,
            type: 'esriPMS',
            url: 'js/gis/dijit/StreetView2/images/streetViewMarker.png',
            contentType: 'image/png',
            width: 18,
            height: 28
        }),

        postCreate: function () {
            this.inherited(arguments);
            
            this.map.on('MouseDown', lang.hitch(this, function (evt) {
                this.mapRightClickPoint = evt.mapPoint;
            }));
            this.mapRightClickMenu.addChild(new MenuItem({
                label: this.i18n.labels.getStreetViewHere,
                onClick: lang.hitch(this, 'showStreetView')
            }));

            this.graphics = new GraphicsLayer({
                id: 'streetViewGraphics'
            });
            this.map.addLayer(this.graphics);
            this.graphics.on('click', function (e) {
                //"this" changes context, now refers to the graphicslayer elsewhere referred to as "this.graphics"
                this.clear();
                return false;
            })
        },
        showStreetView: function () {
            var location = webMercatorUtils.webMercatorToGeographic(this.mapRightClickPoint);
            var graphic = new Graphic(location, this.symbol);
            this.graphics.clear();
            this.graphics.add(graphic);
            window.open(this.url+location.y + ',' + location.x);
            return false; //prevents info window popup
        }
    });
});