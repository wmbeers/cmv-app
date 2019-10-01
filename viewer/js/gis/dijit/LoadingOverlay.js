//Based on https://github.com/cmv/cmv-app/issues/852
define([
    'dojo/_base/declare',
    'dojo/dom',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dojo/text!./LoadingOverlay/templates/loadingOverlay.html',
    'xstyle/css!./LoadingOverlay/css/loadingOverlay.css'
], function (
    declare,
    dom,
    domStyle,
    domConstruct,
    loadingOverlayTemplate
) {
    return declare(null, {
        name: 'LoadingOverlay',
        domElement: window.document.body,
        //spinnerClass: 'fa fa-spinner fa-spin',
        //spinnerStyle: 'color:#333;text-shadow:2px 2px #eee;font-size:32px;position:absolute;top:calc(50% - 16px);left:calc(50% - 16px);z-index:999',
        //messageClass: '',
        //messageStyle: '',
        //blockerClass: '',
        //blockerStyle: 'display:none;z-index:2000;border:none;margin:0;padding:0;width:100%;height:100%,top:0;left:0;background-color:rgb(0,0,0);opacity:0.6;cursor:wait;position:fixed',

        constructor: function (domElement) {
            if (domElement) {
                if (typeof domElement === 'string') {
                    domElement = dom.byId(domElement);
                }
            } else {
                domElement = document.body;
            }
            //if (spinnerClass) {
            //    this.spinnerClass = spinnerClass;
            //}
            //if (spinnerStyle) {
            //    this.spinnerStyle = spinnerStyle;
            //}
            //if (messageClass) {
            //    this.messageClass = messageClass;
            //}
            //if (messageStyle) {
            //    this.messageStyle = messageStyle;
            //}
            //if (blockerClass) {
            //    this.blockerClass = blockerClass;
            //}
            //if (blockerStyle) {
            //    this.blockerStyle = blockerStyle;
            //}
            //blocker
            this.domElement = domElement;
            this.blocker = domConstruct.create('div', {
                'class': 'loading-overlay-blocker'
            }, domElement);
            //set content
            var c = domConstruct.toDom(loadingOverlayTemplate);
            domConstruct.place(c, this.blocker);
            this.loadingOverlayMessageSpan = dom.byId('loadingOverlayMessage');

            //wrapper around
            //this.loading = put(domElement, 'i', {
            //    className: this.className,
            //    style: this.style
            //});
        },

        show: function (message) {
            if (this.loadingOverlayMessageSpan) {
                message = message || 'Please wait...';
                this.loadingOverlayMessageSpan.textContent = message;
            }
            domStyle.set(this.blocker, 'display', 'block');
        },

        hide: function () {
            domStyle.set(this.blocker, 'display', 'none');
        }
    });
});