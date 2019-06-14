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
    'dojo/text!./templates/warnUserExpiringSoonDialog.html'
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
    warnUserExpiringSoonDialogTemplate
) {

    return declare(null, {
        lastActivityTime: new Date(), //when was the last time we noted any activity
        sessionStatus: 'unknown', //changes to active, expiring-soon or expired 
        secondsPerSession: 180, //TODO 9000 doesn't change, but using a variable here for ease of development and testing also TODO: can use ETDMSession.getSessionDuration to get the real value
        refreshDelaySeconds: 15, //how many seconds between calls to ETDMSession on the server; don't want to do it every tick
        //activity: false, //set to true by user activity, gets set back to false after we reset everything; basically means "has there been activity since the last time we checked"

        //timeout/interval IDs
        updateSessionStatusInterval: null, //Doesn't ever get cleared in normal circumstances, but making it something that can be cleared for testing/debugging

        //how many seconds are left in the session
        secondsToGo: -1, //don't really need it outside of the updateSessionStatus method, but for debugging I've promoted it to this scope

        //dialogs
        warnUserExpiringSoonDialog: new Dialog({
            id: 'warnUserExpiringSoonDialog',
            title: 'Your Session is About to Expire',
            content: warnUserExpiringSoonDialogTemplate//,
            //style: 'width: 90%; height: 75%'
        }),

        startup: function () {
            topic.subscribe('sessionMixin/setActivity', lang.hitch(this, 'setActivity'));
            topic.subscribe('sessionMixin/updateSessionStatus', lang.hitch(this, 'updateSessionStatus'));
            topic.subscribe('sessionMixin/setExternalActivity', lang.hitch(this, 'setExternalActivity'));

            ko.applyBindings(this, dom.byId('timeOutDialog')); // eslint-disable-line no-undef

            //when user moves mouse, log that we've had some activity
            on(window, 'mousemove', function () {
                topic.publish('sessionMixin/setActivity');
            });
            //TODO probably need keyUp, etc.

            //Set up call to updateSessionStatus to be run every second
            this.updateSessionStatusInterval = window.setInterval(function () {
                topic.publish('sessionMixin/updateSessionStatus'); //TODO is there some less cumbersom way to call updateSessionStatus than using topic.publish?
            }, 1000);

            //add event listener to watch for "resetTimeout" being changed in local storage
            if (typeof (Storage) !== 'undefined') {

                window.addEventListener('storage', function (e) {
                    if (e.key === 'resetTimeout') {
                        topic.publish('sessionMixin/setExternalActivity'); //TODO is there some less cumbersom way to call setExternalActivity than using topic.publish?
                    }
                });
            }

        },

        setActivity: function () {
            //console.log('setActivity');
            this.lastActivityTime = new Date(); //todo: store as getTime? storing this way is easier to read when debugging...
            //this.activity = true;
            this.resetTimeout();
        },

        setExternalActivity: function () {
            //console.log('setExternalActivity')
            this.lastActivityTime = new Date(); //todo: store as getTime? storing this way is easier to read when debugging...
            //this.activity = true;
        },

        //Checks every second if we're getting close to session timeout
        updateSessionStatus: function () {
            if (this.sessionStatus === 'expired') {
                this.promptRelogin();
            }
            //console.log('checkForActivity');
            //console.log(this.sessionStatus);
            //console.log('Last activity: ' + this.lastActivityTime);
            var now = new Date(),
                secondsSinceLastActivity = parseInt((now.getTime() - this.lastActivityTime.getTime()) / 1000, 10);

            this.secondsToGo = this.secondsPerSession - secondsSinceLastActivity;

            //console.log('secondsSinceLastActivity: ' + secondsSinceLastActivity);
            //console.log('secondsToGo: ' + secondsToGo);

            if (this.secondsToGo < 10) {
                this.sessionStatus = 'expired';
            } else if (this.secondsToGo <= 130) {
                this.sessionStatus = 'expiring-soon';
            } else {
                this.sessionStatus = 'active';
                this.resetTimeout(); //alerts other windows by way of local storage
            }

            //if we're not already expired, and we've hit our delay interval (the remainder of secondsToGo / refreshDelaySeconds is 0) 
            if (this.sessionStatus !== 'expired' && this.secondsToGo % this.refreshDelaySeconds === 0) {
                this.pingSession();
            }

            //console.log(this.sessionStatus);
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

        pingSession: function () {
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
                        if (e === 'HTML reply from the server') {
                            //this is the login prompt, means that the session died
                            this.sessionStatus = 'expired';
                        } else if (e === 'Service Temporarily Unavailable') {
                            //shouldn't happen on production, but on dev/stage it probably means the server is in the process of restarting
                            //for our purposes, let's just treat it as session expired
                            this.sessionStatus = 'expired';
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
        keepWorking: function () {
            this.setActivity();
            this.warnUserExpiringSoonDialog.hide();
        },

        warnUserExpiringSoon: function () {
            this.warnUserExpiringSoonDialog.show();
        },

        promptRelogin: function () {
            topic.publish('sessionMixin/promptRelogin');
        },

        logout: function () {
            //console.log('logout');
            if (typeof (window.close()) === 'undefined') {
                document.location = '/est/security/Logout.do';
            }
        }
    });
});
