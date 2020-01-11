/**
 * This mixin's purpose is to make a DWR call to get user authorities and essentially post-process viewer.js to include editing widgets and layers based on those authorities. It must
 * be listed in app.js so it is declared after _MapMixin and _WidgetsMixin, meaning its startup happens after _ConfigMixin and before _MapMixin and _WidgetsMixin
 */
define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/on',
    'gis/plugins/EstAuthorization',
    'esri/IdentityManager'//,
    //'esri/ServerInfo',
    //'esri/Credential'
], 
function (declare, lang, on, EstAuthorization, esriId /*, ServerInfo, Credential*/) {

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

            if (this.hasProjectEditAuthority) {
                this.config.widgets.projectEditor.include = true;
                this.config.widgets.projectEditor.options.authorities = this.authorities.filter(function (auth) {
                    return auth.projectEditor;
                });
                this.config.widgets.projectEditor.options.currentAuthority = this.currentAuthority; //a pointer to the ko observable, since we want to avoid referencing app
                this.config.widgets.projectEditor.options.currentAuthority(this.config.widgets.projectEditor.options.authorities[0]); //todo could also cache the last used authority instead of defaulting to the first one
            }

            this._initEsriId();
            
            //call this last so that the above dynamic config changes are done first
            this.inherited(arguments);

        },

        _initEsriId: function () {
            //esriId = esriId(); //Needed when using IdentityManagerBase; remove this line if using IdentityManager.
            app.esriId = esriId; //TODO just for testing

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
                    },
                    {
                        adminTokenServiceUrl: 'https://aquarius.at.geoplan.ufl.edu/arcgis/admin/generateToken',
                        currentVersion: 10.61,
                        hasServer: true,
                        server: 'https://aquarius.at.geoplan.ufl.edu/arcgis',
                        shortLivedTokenValidity: 60,
                        tokenServiceUrl: 'https://aquarius.at.geoplan.ufl.edu/arcgis/tokens/'
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
                //console.log(t.server + ' token expires in ' + ((t.expires - now) / 1000) + ' seconds at ' + new Date(t.expires));
                minExpires = Math.min(minExpires, t.expires);
                idObj.credentials.push(credential);
            });


            esriId.initialize(idObj);

            on(esriId, 'dialog-create', function () {
                console.log('login dialog is being created'); //eslint-disable-line no-console
                esriId.dialog.on('show', function () {
                    console.log('login dialog is showing'); //eslint-disable-line no-console
                    esriId.dialog.hide();
                });
            });

            //set a timeout to update it
            var msUntilCredentialTimeout = minExpires - now - 180000; //180 seconds before the first credential expires; it appears that ESRI will pop up the dialog when there's less than 2 minutes to go, so I'm adding this little buffer
            if (minExpires < 8640000000000000) {
                //console.log('Will refresh in ' + msUntilCredentialTimeout / 1000 + ' seconds');
                window.setTimeout(this.refreshTokens.bind(this), msUntilCredentialTimeout);
            }

            ////todo default currentAuthority based on session or something? local storage?
        },

        _updateTokens: function () {
            //console.log('Updating tokens'); 
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
                //console.log('Refreshed ' + credential.server + ' token expires in ' + (credential.expires - now) + ' at ' + new Date(credential.expires));

                minExpires = Math.min(minExpires, credential.expires);
            });

            //set a timeout to update it
            var msUntilCredentialTimeout = minExpires - now - 180000; //180 seconds before the first credential expires 
            if (minExpires < 8640000000000000) {
                //console.log('Will refresh in ' + msUntilCredentialTimeout);
                window.setTimeout(this.refreshTokens.bind(this), msUntilCredentialTimeout);
            }


        },

        refreshTokens: function () {
            console.log('Refreshing token'); //eslint-disable-line no-console
            EstAuthorization.getAuthorities(this).then(lang.hitch(this, '_updateTokens'));
        }
    });
});
