define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dijit/ConfirmDialog',
    'dojo/request',
    'dojo/_base/lang',
    'dojo/on',
    'dojo/query',
    'dojo/dom',
    'dojo/dom-class',
    'dojo/html',
    'dojo/topic',
    'dojo/store/Memory',
    'dojo/Deferred',

    'dojo/text!./AoiEditor/templates/Sidebar.html', // template for the widget in left panel, and some dialogs
    'dojo/text!./AoiEditor/templates/Dialog.html', // template for the open AOI dialog

    'esri/dijit/editing/Add',
    'esri/dijit/editing/Delete',
    'esri/dijit/editing/Update',

    'esri/toolbars/draw',


    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/CheckBox',
    'dijit/form/ValidationTextBox',
    'dijit/form/TextBox',

    'xstyle/css!./LayerLoader/css/layerLoader.css'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, request, lang, on, query, dom,
        domClass, html, topic, Memory, Deferred, AoiEditorSidebarTemplate, AoiEditorDialogTemplate, 
        Add, Delete, Update, Draw) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
                widgetsInTemplate: true,
                templateString: AoiEditorSidebarTemplate,
                topicID: 'AoiEditor',
                baseClass: 'AoiEditor',
                map: this.map,

                //knockout-bound observable properties, will be assigned in _knockoutify method
                aois: null,
                currentAoi: null,
                filterAois: null,
                

                //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
                openAoiDialog: null,
            
                postCreate: function () {
                    this.inherited(arguments);
                    var self = this; //solves the problem of "this" meaning something different in onchange event handler
                    //todo post create code goes here

                },

                startup: function () {
                    this.inherited(arguments);
                    var self = this; //solves the problem of "this" meaning something different in onchange event handler
                    //todo startup code goes here

                },

                _constrectAoiModel: function(aoi) {
                    aoi.name = ko.observable(aoi.name);
                    aoi.type = ko.observable(aoi.type);
                    aoi.expirationDate =ko.observable(aoi.expirationDate);
                    
                },

                _loadAOIs: function() {
                    
                }
            }
     );
});
