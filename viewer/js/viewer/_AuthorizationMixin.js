/**
 * This mixin's purpose is to make a DWR call to get user authorities and essentially post-process viewer.js to include editing widgets and layers based on those authorities. It must
 * be listed in app.js so it is declared after _MapMixin and _WidgetsMixin, meaning its startup happens after _ConfigMixin and before _MapMixin and _WidgetsMixin
 */
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'gis/plugins/EstAuthorization',
    'esri/IdentityManager'//,
    //'esri/ServerInfo',
    //'esri/Credential'
], 
function (declare, lang, EstAuthorization, esriId /*, ServerInfo, Credential*/) {

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
                    if (this.config.operationalLayers[i].options.id === 'draftProjectsService') {
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


            this._initEsriId();
            
            //call this last so that the above dynamic config changes are done first
            this.inherited(arguments);

        },

        _initEsriId: function () {
            var idObj = {
                serverInfos: [ //TODO get this from the DWR call
                    {
                        adminTokenServiceUrl: 'https://gemini.at.geoplan.ufl.edu/arcgis/admin/generateToken',
                        currentVersion: 10.61,
                        hasServer: true,
                        server: 'https://gemini.at.geoplan.ufl.edu/arcgis',
                        shortLivedTokenValidity: 60,
                        tokenServiceUrl: 'https://gemini.at.geoplan.ufl.edu/arcgis/tokens/'
                    },
                    {
                        adminTokenServiceUrl: 'https://pisces.at.geoplan.ufl.edu/arcgis/admin/generateToken',
                        currentVersion: 10.61,
                        hasServer: true,
                        server: 'https://pisces.at.geoplan.ufl.edu/arcgis',
                        shortLivedTokenValidity: 60,
                        tokenServiceUrl: 'https://pisces.at.geoplan.ufl.edu/arcgis/tokens/'
                    }
                ],
                credentials: []
            };

            var minExpires = 8640000000000000, //max possible timestamp, will get narrowed down in loop below
                now = new Date().getTime(); 
            this.authorization.credentials.forEach(function (t) {
                var credential = {
                    userId: t.userId,
                    server: t.server,
                    token: t.token,
                    creationTime: t.creationTime,
                    expires: t.expires,
                    ssl: false,
                    scope: 'server'
                };
                minExpires = Math.min(minExpires, t.expires);
                idObj.credentials.push(credential);
            });


            esriId.initialize(idObj);

            //set a timeout to update it
            var msUntilCredentialTimeout = minExpires - now - 60000; //60 seconds before the first credential expires 
            if (minExpires < 8640000000000000) {
                window.setTimeout(this.refreshTokens.bind(this), msUntilCredentialTimeout);
            }

            app.esriId = esriId; //TODO just for testing

            ////todo default currentAuthority based on session or something? local storage?
        },

        _updateTokens: function () {
            console.log('Updating tokens');
            //this.authorization.credentials will have been updated in EstAuthorization.getAuthorities
            //those credentials aren't the same thing, just need the tokens.
            var minExpires = 8640000000000000, //max possible timestamp, will get narrowed down in loop below
                now = new Date().getTime(); 
            this.authorization.credentials.forEach(function (credential) {
                //find the existing credential
                var esriCredential = esriId.credentials.find(function (c) {
                    return c.server === credential.server;
                });
                if (esriCredential) {
                    esriCredential.token = credential.token;
                    esriCredential.expires = credential.expires;
                    esriCredential.creationTime = credential.creationTime;
                } else {
                    //TODO create a new token? Can this happen?
                }
                minExpires = Math.min(minExpires, credential.expires);
            });

             //set a timeout to update it
            var msUntilCredentialTimeout = minExpires - now - 60000; //60 seconds before the first credential expires 
            if (minExpires < 8640000000000000) {
                window.setTimeout(this.refreshTokens.bind(this), msUntilCredentialTimeout);
            }


        },

        refreshTokens: function () {
            EstAuthorization.getAuthorities(this).then(lang.hitch(this, '_updateTokens'));
        },

        checkTokens: function () {
            var now = new Date().getTime(),
                refreshNeeded = false;

            this.esriId.credentials.forEach(function (credential) {
                //is it going to expire in the next minute?
                console.log(credential.expires - now);
                if (credential.expires - now < 60000) {
                    refreshNeeded = true;
                    return false; //break out of loop
                }
                return true; //just to shut up eslint
            });

            if (refreshNeeded) {
                console.log('Refresh Needed');
                //this.refreshTokens();
            }
        }
    });
});
