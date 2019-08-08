define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Dialog',
    'dijit/ConfirmDialog',
    'dijit/form/DateTextBox',
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
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Dialog, ConfirmDialog, DateTextBox, request, lang, on, query, dom, //eslint-disable-line no-unused-vars
        domClass, html, topic, Memory, Deferred, AoiEditorSidebarTemplate, AoiEditorDialogTemplate, //eslint-disable-line no-unused-vars
        Add, Delete, Update, Draw) { //eslint-disable-line no-unused-vars
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: AoiEditorSidebarTemplate,
            topicID: 'AoiEditor',
            baseClass: 'AoiEditor',
            map: this.map,

            constructor: function (options) {
                this.currentAuthority = options.currentAuthority;
            },

            //knockout-bound observable properties, will be assigned in _knockoutify method
            aois: null,
            currentAoi: null,
            filterAois: null,

            aoiAuthorities: [], //populated in startup
                

            //Dialogs. Broader scope needed for these dialogs to support closing when option is selected, so declaring these here
            openAoiDialog: null,

            openAOI: function () {
                //todo
            },

            createAOI: function () {
                var aoi = this._constructAoiModel();
                this.currentAoi(aoi);
                this._loadAoiLayers(aoi).then(function () {
                    aoi.mode('editName');
                });
            },

            _loadAoiLayers: function (aoiModel) {
                aoiModel.foo();
                //todo: create new features layers from the point, line, and poly AOI layers, with assigned definition queries
                //var deferred = new Deferred();
                //window.setTimeout(function() { deferred.resolve(); }, 3000); //TODO the deferred is resolved when all layers are added to map

            },
            _constructFeatureLayer: function (layerId, aoiId) {
                var layer = new FeatureLayer('https://aquarius.at.geoplan.ufl.edu/arcgis/rest/services/etdm_services/AOIDEV_INPUT/FeatureServer/' + layerId, {
                    opacity: 0.75,
                    mode: FeatureLayer.MODE_ONDEMAND,
                    infoTemplate: new InfoTemplate(null, '${*}'),
                    id: 'aoi_' + aoiId + '_' + layerId,
                    definitionQuery: '1=1' //TODO
                });
                return this.map.addLayer(layer);
                
            },
            
            postCreate: function () {
                this.inherited(arguments);
                //todo post create code goes here

            },

            startup: function () {
                this.inherited(arguments);
                //this entire widget will be hidden if user doesn't have at least one aoi auth, so don't need to worry about index out of bounds
                if (!this.currentAuthority() || this.currentAuthority().aoiEditor === false) {
                    this.currentAuthority(this.aoiAuthorities[0]);
                }

                this._knockoutifyAoiEditor();
            },

            _constructAoiModel: function (aoi) {
                aoi = aoi || {id: null, name: null, type: null, expirationDate: null, orgUserId: null};

                if (!aoi.expirationDate) {
                    //default date is current date + 30 days TODO confirm this
                    aoi.expirationDate = new Date();
                    aoi.expirationDate.setDate(aoi.expirationDate.getDate() + 30);
                }
                var authority = null;
                if (aoi.orgUserId) {
                    //loading existing--if we allow loading all aois for all of the current user's orgUsers, rather than having to select to filter them, we don't need this bit
                    //about tracking authority, and just use currentAuthority
                    authority = this.aoiAuthorities.find(function (auth) {
                        return auth.orgUserId === aoi.orgUserId;
                    });
                } else {
                    authority = this.currentAuthority(); //default
                }
                /* eslint-disable no-undef */
                aoi.name = ko.observable(aoi.name); //eslint-disable-line no-undef
                aoi.type = ko.observable(aoi.type); //eslint-disable-line no-undef
                aoi.expirationDate = ko.observable(aoi.expirationDate);  //eslint-disable-line no-undef
                aoi.mode = ko.observable();
                aoi.authority = ko.observable(authority); 
                aoi.showAuthoritySelection = ko.pureComputed(function () {
                    return !aoi.id && app.authorities.length > 1;
                }, this);
                /* eslint-enable no-undef */
                return aoi;
            },

            loadAOIs: function () {
                //todo DWR call to get list of AOIs with basic properties of  id, name, type and description
            },

            _knockoutifyAoiEditor: function () {
                /* eslint-disable no-undef */
                this.aois = ko.observable();
                this.currentAoi = ko.observable();
                this.filterAois = ko.observable(false);

                //apply knockout bindings
                ko.applyBindings(this, dom.byId('aoiEditorSidebar')); 

                /* eslint-enable no-undef */

            }
        }
    );
    });
