/**
 * This mixin's purpose is to make a DWR call to get user authorities and essentially post-process viewer.js to include editing widgets and layers based on those authorities. It must
 * be listed in app.js so it is declared after _MapMixin and _WidgetsMixin, meaning its startup happens after _ConfigMixin and before _MapMixin and _WidgetsMixin
 */
define([
    'dojo/_base/declare',
    'dijit/_WidgetBase', //needed for data-dojo-attach-event to do anything
    'dijit/_TemplatedMixin', // "
    'dijit/_WidgetsInTemplateMixin', // "
    'dijit/Dialog',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/dom',
    'dojo/topic',
    'dojo/request',
    'dojo/request/iframe',
    'jquery'
], function (
    declare,
    _WidgetBase,
    _TemplatedMixin,
    _WidgetsInTemplateMixin,
    Dialog,
    lang,
    on,
    dom,
    topic,
    request,
    iframe,
    jQuery
) {

    return declare(null, {
        hasAoiEditAuthority: false,        
        hasProjectEditAuthority: false,
        authorities: [],
        currentAuthority: null,

        startup: function () {

            //remove draftProjects from operationalLayers
            if (!this.hasProjectEditAuthority) {
                for (var i = this.config.operationalLayers.length - 1; i >= 0; --i) {
                    if (this.config.operationalLayers[i].options.id === 'draftProjects') {
                        this.config.operationalLayers.splice(i,1);
                        break;
                    }
                }
            }

            //update widgets config    
            this.config.widgets.aoiEditor.include = this.hasAoiEditAuthority;

            //todo default identity

            //call this last so that the above dynamic config changes are done first
            this.inherited(arguments);

        }
    });
});
