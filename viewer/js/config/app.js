(function () {
    /* eslint no-useless-escape: off */
    var path = location.pathname.replace(/[^\/]+$/, '');
    window.dojoConfig = {
        async: true,
        packages: [
            {
                name: 'viewer',
                location: path + 'js/viewer'
            }, {
                name: 'gis',
                location: path + 'js/gis'
            }, {
                name: 'config',
                location: path + 'js/config'
            }, {
                name: 'proj4js',
                location: '//cdnjs.cloudflare.com/ajax/libs/proj4js/2.3.15' //TODO copy locally and don't use CDN
            }, {
                name: 'flag-icon-css',
                location: '//cdnjs.cloudflare.com/ajax/libs/flag-icon-css/2.8.0' //TODO copy locally and don't use CDN
            }
        ], 
        paths: {
            configPath: path + 'js/config',
            jquery: 'https://code.jquery.com/jquery-3.3.1.min', //TODO copy locally and don't use CDN
            jqueryUi: 'https://code.jquery.com/ui/1.12.1/jquery-ui.min', //TODO copy locally and don't use CDN
            koBindings: path + 'js/knockout-jQueryUI-Bindings'
        }
    };

    require(window.dojoConfig, [
        'dojo/_base/declare',

        'gis/plugins/EstAuthorization',

        // minimal Base Controller
        'viewer/_ControllerBase',

        // *** Controller Mixins
        // Use the core mixins, add custom mixins
        // or replace core mixins with your own
        'viewer/_ConfigMixin', // manage the Configuration
        'viewer/_LayoutMixin', // build and manage the Page Layout and User Interface
        
        
        'viewer/_AuthorizationMixin', //handle authorization before loading layers and widgets

        'viewer/_MapMixin', // build and manage the Map
        'viewer/_WidgetsMixin', // build and manage the Widgets

        // 'viewer/_WebMapMixin' // for WebMaps

        'viewer/_SidebarMixin', // for mobile sidebar

        //'config/_customMixin'
        'viewer/_LayerLoadMixin',

        'viewer/_SessionMixin'

    ], function (
        declare, 

        EstAuthorization,

        _ControllerBase,
        _ConfigMixin,
        _LayoutMixin,
        _AuthorizationMixin,
        _MapMixin,
        _WidgetsMixin,

        // _WebMapMixin

        _SidebarMixin,
        _LayerLoadMixin,
        _SessionMixin
        //_MyCustomMixin

    ) {
        var App = declare([

            // add custom mixins here...note order may be important and
            // overriding certain methods incorrectly may break the app
            // First on the list are last called last, for instance the startup
            // method on _ControllerBase is called FIRST, and _LayoutMixin is called LAST
            // for the most part they are interchangeable, except _ConfigMixin
            // and _ControllerBase
            //
            _SessionMixin,

            _LayerLoadMixin,

            // Mixin for Mobile Sidebar
            _SidebarMixin,

            _LayoutMixin,
            _WidgetsMixin,
            // _WebMapMixin,
            _MapMixin,

            _AuthorizationMixin,

            // configMixin should be right before _ControllerBase so it is
            // called first to initialize the config object
            _ConfigMixin,

            // controller base needs to be last
            _ControllerBase
        ]);
        var app = new App();
        //call app.startup in callback from getAuthorities to avoid a race condition between the callback and things happening in _MapMixin
        EstAuthorization.getAuthorities(app).then(function () {
            app.startup();
        });
    });
})();
