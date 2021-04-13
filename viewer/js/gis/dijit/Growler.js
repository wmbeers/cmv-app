define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dojo/_base/lang',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dojo/_base/fx',
    'dojo/dom-class',
    'dojo/topic',
    'xstyle/css!./Growler/css/Growler.css'
], function (declare, _WidgetBase, _TemplatedMixin, lang, Style, domConstruct, fx, domClass, topic) {

    // the growl itself
    var Growl = declare([_WidgetBase, _TemplatedMixin], {
        templateString: '<div class="growl ${level}" data-dojo-attach-event="onmouseover:hoverOver,onmouseout:hoverOut,onclick:close"><h3>${title}</h3><span data-dojo-attach-point="growlMessageNode"></span></div>',
        title: 'Title',
        message: 'Message',
        level: 'default',
        timeout: 10000,
        opacity: 1.0,
        _container: null,
        _timer: null,
        postCreate: function () {
            this.inherited(arguments);
            if (this._container) {
                Style.set(this.domNode, 'opacity', 0);
                domConstruct.place(this.domNode, this._container);
                this.growlMessageNode.innerHTML = this.message;
                fx.anim(this.domNode, {
                    opacity: this.opacity
                }, 250);
                this.setTimeout();
            } else {
                topic.publish('viewer/handleError', {
                    source: 'Growler',
                    error: 'Growl container not found/specified.'
                });
            }
        },
        setTimeout: function () {
            if (this.timeout > 0) {
                this._timer = setTimeout(lang.hitch(this, 'close'), this.timeout);
            }
        },
        hoverOver: function () {
            clearInterval(this._timer);
            domClass.add(this.domNode, 'hover');
        },
        hoverOut: function () {
            if (this.timeout > 0) {
                this.setTimeout();
            }
            domClass.remove(this.domNode, 'hover');
        },
        close: function () {
            fx.anim(this.domNode, {
                opacity: 0
            }, 500, null, lang.hitch(this, 'remove'));
        },
        remove: function () {
            fx.anim(this.domNode, {
                height: 0,
                margin: 0
            }, 250, null, lang.partial(domConstruct.destroy, this.domNode));
        }
    });

    // main growler dijit container
    var Growler = declare([_WidgetBase, _TemplatedMixin], {
        templateString: '<div class="gis-dijit-Growl" data-dojo-attach-point="containerNode"></div>',
        postCreate: function () {
            this.inherited(arguments);
            this.own(topic.subscribe('growler/growl', lang.hitch(this, 'growl')));
            this.own(topic.subscribe('growler/growlError', lang.hitch(this, 'growlError')));
            this.own(topic.subscribe('growler/growlWarning', lang.hitch(this, 'growlWarning')));
            this.own(topic.subscribe('growler/growlUpdatable', lang.hitch(this, 'growlUpdatable')));
            this.own(topic.subscribe('growler/updateGrowl', lang.hitch(this, 'updateGrowl')));
            this.own(topic.subscribe('growler/removeUpdatable', lang.hitch(this, 'removeUpdatable')));
        },
        growl: function (props) {
            props = props || {};
            //Bill Beers modified to support growling with a simple string, defaulting to 3000 ms, info, no title
            if (typeof props === 'string' || props instanceof String) {
                // it's a string, create default object
                props = {
                    message: props,
                    title: null,
                    level: 'info',
                    timeout: 3000
                };
            }
            lang.mixin(props, {
                _container: this.containerNode
            });
            var g = new Growl(props);
            g.startup();
        },
        //Bill Beers modified to support standardized growling of error and warning messages
        growlError: function (message) {
            var props = {
                message: message + '<br />Please contact the OEM Help Desk at <a href="mailto://help@fla-etat.org">help@fla-etat.org<a> or <a href="tel:850-414-5334">850-414-5334</a> for assistance.',
                title: 'Error',
                level: 'error',
                timeout: 0
            };
            lang.mixin(props, {
                _container: this.containerNode
            });
            var g = new Growl(props);
            g.startup();
        },
        growlWarning: function (message) {
            var props = {
                message: message,
                title: 'Warning',
                level: 'warning',
                timeout: 3000
            };
            lang.mixin(props, {
                _container: this.containerNode
            });
            var g = new Growl(props);
            g.startup();
        },
        //single instance of an updatable growl
        _updatableGrowl: null,
        growlUpdatable: function (props) {
            props = props || {};
            if (typeof props === 'string' || props instanceof String) {
                // it's a string, create default object
                props = {
                    message: props,
                    title: null,
                    level: 'info',
                    timeout: 0
                };
            }
            lang.mixin(props, {
                _container: this.containerNode
            });
            this._updatableGrowl = new Growl(props);
            this._updatableGrowl.startup();
        },
        updateGrowl: function (message) {
            if (this._updatableGrowl) {
                this._updatableGrowl.message = message;
                this._updatableGrowl.growlMessageNode.innerHTML = message;
            } else {
                this.growlUpdatable(message);
            }
        },
        removeUpdatable: function () {
            if (this._updatableGrowl) {
                this._updatableGrowl.close();
            }
        }

    });

    return Growler;
});