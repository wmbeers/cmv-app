/**
 * This mixin's purpose is to make a DWR call to get user authorities and essentially post-process viewer.js to include editing widgets and layers based on those authorities. It must
 * be listed in app.js so it is declared after _MapMixin and _WidgetsMixin, meaning its startup happens after _ConfigMixin and before _MapMixin and _WidgetsMixin
 */
define([
    'dojo/_base/declare'
], 
function (declare) {

    return declare(null, {
        //hasAoiEditAuthority: false,        
        //hasProjectEditAuthority: false,
        //hasViewDraftAuthority: false,
        //authorities: [], //redefined
        currentAuthority: ko.observable(), //eslint-disable-line no-undef

        startup: function () {
            //post-process authorities to determine which controls and layers are included--dynamic changes to interpretation of viewer.js
            //this.hasAoiEditAuthority = this.authorities.find(function (auth) {
            //    return auth.aoiEditor;
            //}) ? true : false;
            //this.hasProjectEditAuthority = this.authorities.find(function (auth) {
            //    return auth.projectEditor;
            //}) ? true : false;
            //this.hasViewDraftAuthority = this.authorities.find(function (auth) {
            //    return auth.viewDraftProjects;
            //}) ? true : false;

            //remove draftProjects from operationalLayers if user isn't allowed to see them
            if (!this.hasProjectEditAuthority && !this.hasViewDraftAuthority) {
                for (var i = this.config.operationalLayers.length - 1; i >= 0; --i) {
                    if (this.config.operationalLayers[i].options.id === 'draftProjects') {
                        this.config.operationalLayers.splice(i, 1);
                        break;
                    }
                }
            }

            //todo if we create a separate layer for just remove preScreeningReviewProjects from operationalLayers if user isn't allowed to see them
            //if (!this.hasViewDraftAuthority) {
            //    for (var i = this.config.operationalLayers.length - 1; i >= 0; --i) {
            //        if (this.config.operationalLayers[i].options.id === 'preScreeningReview') {
            //            this.config.operationalLayers.splice(i, 1);
            //            break;
            //        }
            //    }
            //}

            //update widgets config to include AOI editor if user has authority
            if (this.hasAoiEditAuthority) {
                this.config.widgets.aoiEditor.include = true;
                this.config.widgets.aoiEditor.options.authorities = this.authorities.filter(function (auth) { 
                    return auth.aoiEditor;
                });
                this.config.widgets.aoiEditor.options.currentAuthority = this.currentAuthority; //a pointer to the ko observable, since we want to avoid referencing app
                this.config.widgets.aoiEditor.options.currentAuthority(this.config.widgets.aoiEditor.options.authorities[0]); //todo could also cache the last used authority instead of defaulting to the first one
            }

            //todo default currentAuthority based on session or something? local storage?

            //call this last so that the above dynamic config changes are done first
            this.inherited(arguments);

        }
    });
});
