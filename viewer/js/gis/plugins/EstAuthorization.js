define([
    'dojo/Deferred',
    'dojo/topic'
],
function (Deferred, topic) {
    /**
     * For getting user authorities, called at startup and again when refreshing tokens.
     */
    return {
        //eslint-disable-next-line complexity
        getAuthorities: function (application) {
            var deferred = new Deferred(),
                self = this;

            if (typeof MapDAO !== 'undefined') {
                MapDAO.getAuthorities({
                    callback: function (authorization) {
                        self._setApplicationAuths(application, authorization);
                        deferred.resolve();
                    },
                    errorHandler: function (message, exception) {
                        topic.publish('viewer/handleError', {
                            source: 'EstAUthorization.getAuthorities',
                            error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                        });
                        self._setApplicationAuths(application, null);
                        deferred.resolve(); //yes, we don't want to reject, we'll just toggle back to unauthorized
                    }
                });
                            
            } else {
                //public site doesn't load MapDAO DWR, doesn't require authorization
                self._setApplicationAuths(application, null);
                deferred.resolve(); //yes, we don't want to reject, we'll just toggle back to unauthorized
            }

            return deferred;
        },

        _setApplicationAuths: function (application, authorization) {
            if (!authorization) {
                authorization = {
                    credentials: [],
                    mapAuthorities: [],
                    aoiEditor: false,
                    projectEditor: false,
                    viewDraftProjects: false
                };
            }
            application.authorization = authorization;
            application.authorities = authorization.mapAuthorities;
            application.hasAoiEditAuthority = authorization.aoiEditor;
            application.hasProjectEditAuthority = authorization.projectEditor;
            application.hasViewDraftAuthority = authorization.viewDraftProjects;
            //AuthorizationMixin takes care of modifying options 
            //defining what tools and layers are present
        }
    };
});
