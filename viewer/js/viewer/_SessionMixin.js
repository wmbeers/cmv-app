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
    warnUserExpiringSoonDialogTemplate,
    reLoginDialogTemplate
) {

    return declare(null, {
        lastActivityTime: new Date(), //when was the last time we noted any activity
        lastPingTime: new Date(), //when was the last time we pinged the server to keep the server session alive
        sessionStatus: 'unknown', //changes to active, expiring-soon or expired
        warnUserExpiringSoonAt: 100, //TODO should be 120; doesn't need to be a variable, but for clarity, debugging and testing assigning here
        secondsPerSession: 120, //TODO should be 9000. Note: it doesn't change, so could just be a static value, but for debugging and testing I'm using a variable here TODO: can use ETDMSession.getSessionDuration to get the real value
        refreshDelaySeconds: 15, //how many seconds between calls to ETDMSession on the server; don't want to do it every tick
        //activity: false, //set to true by user activity, gets set back to false after we reset everything; basically means "has there been activity since the last time we checked"

        //timeout/interval IDs
        updateSessionStatusInterval: null, //Doesn't ever get cleared in normal circumstances, but making it something that can be cleared for testing/debugging

        //how many seconds are left in the session
        secondsToGo: ko.observable(-1), //doesn't need to be observable, and we don't really need it outside of the updateSessionStatus method, but for debugging I've promoted it to this scope

        

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

            //I would prefer not to use ko here, but I just can't get regular Dojo events right in a Mixin context; would have to convert this to a widget
            ko.applyBindings(this, dom.byId('warnUserExpiringSoonDialogTemplate')); // eslint-disable-line no-undef
            ko.applyBindings(this, dom.byId('reLoginDialogTemplate')); // eslint-disable-line no-undef
            //for debugging session only
            ko.applyBindings(this, dom.byId('sessionDebug'));

            //when user moves mouse, log that we've had some activity
            on(window, 'mousemove', function () {
                self.setActivity();
            });
            //TODO probably need keyUp, etc.

            //Set up call to updateSessionStatus to be run every second
            this.updateSessionStatusInterval = window.setInterval(function () {
                self.updateSessionStatus();
            }, 1000);

            //add event listener to watch for "resetTimeout" being changed in local storage
            if (typeof (Storage) !== 'undefined') {
                window.addEventListener('storage', function (e) {
                    if (e.key === 'resetTimeout') {
                        console.log('resetTimeout from another window');
                        self.warnUserExpiringSoonDialog.hide();
                        self.lastActivityTime = new Date(); //todo: store as getTime? storing this way is easier to read when debugging...
                    }
                });
            }
        },

        //logs that activity has occurred in this window
        setActivity: function () {
            if (this.sessionStatus !== 'expired') {
                this.lastActivityTime = new Date(); //todo: store as getTime? storing this way is easier to read when debugging...
                this.resetTimeout();
            }
        },

        //Checks every second if we're getting close to session timeout
        updateSessionStatus: function () {
            var now = new Date(),
                secondsSinceLastActivity = parseInt((now.getTime() - this.lastActivityTime.getTime()) / 1000, 10);

            this.secondsToGo(this.secondsPerSession - secondsSinceLastActivity);

            if (this.secondsToGo() <= 1) {
                this.sessionStatus = 'expired';
            } else if (this.secondsToGo() <= this.warnUserExpiringSoonAt) {
                this.sessionStatus = 'expiring-soon';
            } else {
                this.sessionStatus = 'active';
            }

            //if all of the following are true:
            // 1. we're not already expired
            // 2. there's been recent activity (defined as activity since the last ping)
            // 3. we've hit our delay interval (the remainder of secondsToGo / refreshDelaySeconds is 0; e.g.every 15 seconds)
            //Then ping the server to keep the server session alive
            if (this.sessionStatus !== 'expired' && // 1
                (this.lastPingTime == null || this.lastActivityTime > this.lastPingTime) && // 2
                this.secondsToGo() % this.refreshDelaySeconds === 0) { // 3
                this.pingSession();
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
                        //console.log(x);
                    },
                    errorHandler: function (e) {
                        //console.log(e);
                        if (e === 'HTML reply from the server.') {
                            //this is the login prompt, means that the session died
                            self.sessionStatus = 'expired';
                        } else if (e === 'Service Temporarily Unavailable') {
                            //shouldn't happen on production, but on dev/stage it probably means the server is in the process of restarting
                            //for our purposes, let's just treat it as session expired
                            self.sessionStatus = 'expired';
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
            console.log('keepWorking');
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
        //bindings for username and password
        userName: ko.observable(), //eslint-disable-line no-undef
        password: ko.observable(), //eslint-disable-line no-undef

        showLogin: function () {
            this.userName(null);
            this.password(null);
            this.userNamePasswordVisible(true);
        },

        //the response message we give to the user if something goes awry with their login attempt
        loginResponseMessage: ko.observable(), //eslint-disable-line no-undef

        //response to the Sign In button
        login: function () {
            var self = this;
            try {
                request.post('/est/j_security_check', {
                    data: {
                        j_username: this.userName(),
                        j_password: this.password()
                    },
                    headers: {
                        //'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                        //maybe because referer isn't ReLogin.do?
                        //or x-Requested-With: XMLHttpRequest is in this request, but not in the usual one
                    }
                }).then(
                    function (response) {
                        //a full page HTML comes back from this if invalid username/password
                        //just look for 'Authentication failure. Invalid username / password combination'
                        if (response.indexOf('Authentication failure. Invalid username / password combination') >= 0) {
                            self.loginResponseMessage('Authentication failure. Invalid username / password combination');
                        } else if (false) {

                        }
                        console.log("login response: " + response);
                    },
                    function (error) {
                        if (error && error.response && error.response.status === 404) {
                            //seems to happen when we log in successfully, but there's nothing to redirect to; but also happens when login fails but there's an existing session?
                        }
                        //if (error && error.indexOf('408') >= 0) {
                        //request timed out; happens after server restarts for some reason
                        //}   
                        console.log("login error: " + error);
                    }
                );
            } catch (e) {
                console.log("login post error: " + e);
            }
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
