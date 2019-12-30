define([
    'dojo/Deferred'
],
function (Deferred) {
    /**
     * For getting user authorities, called at startup and again when refreshing tokens.
     */
    return {
        //eslint-disable-next-line complexity
        getAuthorities: function (application) {
            var deferred = new Deferred();

            MapDAO.getAuthorities({ //eslint-disable-line no-undef
                callback: function (authorization) {
                    application.authorization = authorization;
                    application.authorities = authorization.mapAuthorities;
                    application.hasAoiEditAuthority = authorization.aoiEditor;
                    application.hasProjectEditAuthority = authorization.projectEditor;
                    application.hasViewDraftAuthority = authorization.viewDraftProjects;

                    //AuthorizationMixin takes care of modifying options 
                    //defining what tools and layers are present
                    deferred.resolve();
                },
                errorHandler: function (message, exception) {
                    topic.publish('viewer/handleError', {
                        source: 'AoiEditor.addFeatureToAnalysisArea',
                        error: 'Error message is: ' + message + ' - Error Details: ' + dwr.util.toDescriptiveString(exception, 2)
                    });
                    //for now just treat this as unauthorized, empty set of authorities
                    application.authorization = {
                        credentials: []
                    };
                    application.authorities = [];
                    application.hasAoiEditAuthority = false;
                    application.hasProjectEditAuthority = false;
                    application.hasViewDraftAuthority = false;

                    deferred.resolve(); //yes, we don't want to reject, we'll just toggle back to unauthorized
                }
            });

            return deferred;
        }
    };
});