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
    'jquery',
    'dojo/text!./templates/warnUserExpiringSoonDialog.html',
    'dojo/text!./templates/reLoginDialog.html'
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
    jQuery,
    warnUserExpiringSoonDialogTemplate,
    reLoginDialogTemplate
) {

    return declare(null, {
        //when was the last time we noted any activity
        lastActivityTime: new Date(),
        //when was the last time we pinged the server to keep the server session alive
        lastPingTime: new Date(), 
        //Status of the session, changes to active, expiring-soon or expired
        sessionStatus: 'unknown', 
        //Controls when to warn the user the session expires soon--
        //when this many seconds are left in the session, popups up the dialog.
        //Doesn't need to be a variable, but for clarity, debugging and testing assigning here 
        warnUserExpiringSoonAt: 130,
        //how many seconds does the server session live without interaction; usually 15, but varies by platform. Updated in startup.
        secondsPerSession: 900, 
        //how many seconds between calls to ETDMSession on the server; don't want to do it every tick
        refreshDelaySeconds: 15,

        //how many seconds are left in the session
        secondsToGo: -1, //we don't really need it outside of the updateSessionStatus method, but for debugging I've promoted it to this scope

        //dialogs
        warnUserExpiringSoonDialog: new Dialog({
            id: 'warnUserExpiringSoonDialog',
            title: 'Your Session is About to Expire',
            content: warnUserExpiringSoonDialogTemplate//,
            //style: 'width: 90%; height: 75%'
        }),
        reLoginDialog: new Dialog({
            id: 'reLoginDialog',
            title: 'Your Session Has Expired',
            content: reLoginDialogTemplate
        }),

        startup: function () {
            var self = this; //needed in event listeners

            //unless we modify ReLogin to not call top.reLoginSuccess, there's no other way to do this
            window.reLoginSuccess = function () {
                self.sessionStatus = 'active';
                self.lastActivityTime = new Date();
                self.reLoginDialog.hide();
                self.userNamePasswordVisible(false);
                self.refreshTokens(); //in _AuthorizationMixin; refresh the tokens now
            };

            //I would prefer not to use ko here, but I just can't get regular Dojo events right in a Mixin context; would have to convert this to a widget
            ko.applyBindings(this, dom.byId('warnUserExpiringSoonDialogTemplate')); // eslint-disable-line no-undef
            ko.applyBindings(this, dom.byId('reLoginDialogTemplate')); // eslint-disable-line no-undef

            //when user moves mouse, log that we've had some activity
            on(window, 'mousemove', function () {
                self.setActivity();
            });
            //TODO probably need keyUp, etc.

            //sync up this applications session length with what's actually on the server
            ETDMSession.getSessionDuration( //eslint-disable-line no-undef
                function (sessionLength) {
                    self.secondsPerSession = sessionLength;
                }
            );

            //Set up call to updateSessionStatus to be run every second
            window.setInterval(function () {
                self.updateSessionStatus();
            }, 1000);

            //add event listener to watch for "resetTimeout" being changed in local storage
            if (typeof (Storage) !== 'undefined') {
                window.addEventListener('storage', function (e) {
                    if (e.key === 'resetTimeout') {
                        self.warnUserExpiringSoonDialog.hide();
                        self.lastActivityTime = new Date(); //todo: store as getTime? storing this way is easier to read when debugging...
                    }
                });
            }
            
            //TODO: eventually our 408 and 403 pages will be cusotmized and we won't need to do this, but for now...
            //hack-ity hack way of seeing if we got a 408 response when waiting too long to sign in, or if the server has restarted
            var loginFormWrapper = dom.byId('loginFormWrapper');
            on(loginFormWrapper, 'load', function () {
                //look for HTTP Status 408
                var iframeDocument = loginFormWrapper.contentDocument || loginFormWrapper.contentWindow.document;
                var content = jQuery(iframeDocument);
                var h = content.find('H1');
                if (h && h.length > 0) {
                    if (h.html().indexOf('HTTP Status 408') >= 0) {
                        self.showLogin();
                    }
                    if (h.html().indexOf('Service Temporarily Unavailable') >= 0) {
                        //even more hackity
                        var p = content.find('P')[0];
                        jQuery('<button type="button">Try Again</button>')
                            .appendTo(p)
                            .on('click', function () {
                                self.showLogin();
                            });
                    }
                }
            });
        },

        //logs that activity has occurred in this window
        setActivity: function () {
            if (this.sessionStatus !== 'expired') {
                this.lastActivityTime = new Date(); //todo: store as getTime? storing this way is easier to read when debugging...
                //removing this line, it wreaks havoc with other pages if called at every little mouse move this.resetTimeout();
            }
        },

        //Checks every second if we're getting close to session timeout
        updateSessionStatus: function () {
            var now = new Date(),
                nowTime = now.getTime(),
                secondsSinceLastActivity = parseInt((nowTime - this.lastActivityTime.getTime()) / 1000, 10),
                secondsSinceLastPing = parseInt((nowTime - this.lastPingTime.getTime()) / 1000, 10);

            this.secondsToGo = this.secondsPerSession - secondsSinceLastActivity;

            if (this.secondsToGo <= 1) {
                this.sessionStatus = 'expired';
            } else if (this.secondsToGo <= this.warnUserExpiringSoonAt) {
                this.sessionStatus = 'expiring-soon';
            } else {
                this.sessionStatus = 'active';
            }

            //if all of the following are true:
            // 1. we're not already expired
            // 2. there's been recent activity (defined as activity since the last ping)
            // 3. It's been more than or equal to the refreshDelaySeconds parameter seconds since we last pinged
            //Then ping the server to keep the server session alive
            if (this.sessionStatus !== 'expired' && // 1
                this.lastActivityTime > this.lastPingTime && // 2
                secondsSinceLastPing >= this.refreshDelaySeconds) { // 3
                this.pingSession();
                this.resetTimeout(); //sends the message along to other windows
            }

            //if we're about to expire, prompt to keep the session alive
            if (this.sessionStatus === 'expiring-soon') {
                this.warnUserExpiringSoon();
            //if we're expired, hide the warning-expired-soon and show the re-login prompt
            } else if (this.sessionStatus === 'expired') {
                this.warnUserExpiringSoonDialog.hide();
                this.promptRelogin();
            }
        },

        //uses localStorage, which is being listened to on other EST pages, to keep the session alive across all EST pages
        resetTimeout: function () {
            try {
                if (typeof (Storage) !== 'undefined') {
                    window.localStorage.setItem('resetTimeout', JSON.stringify(true));
                    window.localStorage.removeItem('resetTimeout');
                }
            } catch (err) {
                //console.log(err);
            }
        },

        //pings the server via DWR to keep the server session alive
        pingSession: function () {
            var self = this; //"this" changes context in callback
            this.lastPingTime = new Date();

            //pings the server to keep the session alive
            try {
                // eslint-disable-next-line no-undef
                ETDMSession.getSessionID({ 
                    callback: function () {
                        //really nothing to do here
                    },
                    errorHandler: function (e) {
                        if (e === 'HTML reply from the server.') {
                            //this is the login prompt, means that the session died
                            self.sessionStatus = 'expired';
                            self.promptRelogin();
                        } else if (e === 'Service Temporarily Unavailable') {
                            //shouldn't happen on production, but on dev/stage it probably means the server is in the process of restarting
                            //for our purposes, let's just treat it as session expired
                            self.sessionStatus = 'expired';
                            self.promptRelogin();
                        } else {
                            topic.publish('viewer/handleError', {
                                source: 'SessionMixin.pingSession DWR error handler',
                                error: e
                            });
                        }
                    }
                });
            } catch (e) {
                topic.publish('viewer/handleError', {
                    source: 'SessionMixin.pingSession',
                    error: e
                });
            }
        },

        //Responds to the button-press on the "Keep Working" button in the warn-user-expiring-soon dialog, to hide the dialog. 
        //Also kind of redundantly calls setActivity, because mouse move will have already done that.
        keepWorking: function () {
            this.setActivity();
            this.warnUserExpiringSoonDialog.hide();
        },

        //shows the warning dialog that the session is going to timeout
        warnUserExpiringSoon: function () {
            if (!this.warnUserExpiringSoonDialog._isShown()) {
                this.warnUserExpiringSoonDialog.show();
            }
        },

        //shows the dialog that the session has expired
        promptRelogin: function () {
            if (!this.reLoginDialog._isShown()) {
                this.reLoginDialog.show();
            }
        },

        //simple observable to control what's shown on the session-expired dialog
        userNamePasswordVisible: ko.observable(false), //eslint-disable-line no-undef

        //shows the iframe with ReLogin.do
        showLogin: function () {
            this.userNamePasswordVisible(true);
            dom.byId('loginFormWrapper').src = '/est/security/ReLogin.do';
        },

        //Responds to the button-press on the "No, Log Off" button on the warn user expiring soon dialog and the "Exit" button on the session-expired dialog
        logout: function () {
            //console.log('logout');
            if (typeof (window.close()) === 'undefined') {
                document.location = '/est/security/Logout.do';
            }
        }


    });
});
