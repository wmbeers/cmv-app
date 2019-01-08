define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/TooltipDialog',
    'dojox/image/LightboxNano',
    'dojo/ready',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/aspect',
    'dojo/dom',
    'dojo/dom-style',
    'dojo/dom-class',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/text!./IssueSelector/templates/issueSelector.html',
    'dojo/text!./IssueSelector/templates/issueSelectorTooltip.html',
    'dojo/query',    
    'dijit/registry',
    'dijit/form/FilteringSelect',
    'xstyle/css!./IssueSelector/css/issueSelector.css',
    // If nested widgets fail on load try adding these
    'dijit/form/Form',
    'dijit/layout/ContentPane',
    'dijit/layout/TabContainer'
],
    function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, TooltipDialog, LightboxNano, ready, popup, lang, array, on, aspect, dom, domStyle, domClass, domConstruct, 
        topic, issueSelectorTemplate, issueSelectorTooltipTemplate, query, registry, fSelect
) {
        return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
            widgetsInTemplate: true,
            templateString: issueSelectorTemplate,
            tooltiptemplateString: issueSelectorTooltipTemplate,            
            topicID: 'issueSelector',            
            baseClass: 'issueSelector',
            map: this.map,
            postCreate: function () {
                this.inherited(arguments);
                this._initializeIssueSelector();
            },
            startup: function () {
                this.inherited(arguments);
                this.initializeTooltip();
            },
            initializeTooltip: function () {
                // tooltip Dialog
                this.inherited(arguments);

                var myTooltipDialog = new TooltipDialog({
                    id: 'myTooltipDialog',
                    style: 'width: 300px;',
                    templateString: issueSelectorTooltipTemplate,
                    onShow: function () {
                        // Focus the first element in the TooltipDialog
                        this.focus();
                    },                    
                    _onBlur: function () {
                        // User must have clicked a blank area of the screen, so close the TooltipDialog
                        // popup.close(myTooltipDialog);
                    },                 
                    onClick: function (evt) {
                        if (evt.target === this.slrTTCloseNode) {
                            popup.close(myTooltipDialog);
                        }
                    }
                });
                this.issueSelectorTooltip = myTooltipDialog;    
                this.issueSelectorTooltip.startup();

                on(this.issueSelectorHelpNode, 'click', function () {
                    popup.open({
                        popup: myTooltipDialog,
                        around: dom.byId('tooltipNode'),
                        onCancel: function () {                            
                            // User pressed escape, so close myself
                            popup.close(myTooltipDialog);
                        }
                    });
                });

            },
            _initializeIssueSelector: function () {
                //flattened list of all layers--will be defined server-side eventually
                var layerDefs = [];
                this.issueServices.forEach(function (issueService) {
                    var span = domConstruct.create('span', null, this.IssueSelectDom);
                    if (!issueService.iconUrl) {
                        //default to image named the same as the issue
                        issueService.iconUrl = issueService.name.replace(/\s/g, '_') + '.png';
                    }
                    domConstruct.create('img', {'alt': issueService.name, 'src': 'js/gis/dijit/IssueSelector/images/' + issueService.iconUrl}, span);
                    domConstruct.create('br', null, span);
                    if (issueService.url) {
                        on(span, 'click', lang.hitch(this, function () {
                            app.addToMap(issueService);
                        }));
                        domClass.add(span, 'enabled');
                        domConstruct.create('span', {'innerHTML': issueService.name}, span);

                        //TODO: it would be faster to do this server-side when generating issueSelector.js
                        //but for now this hackiness will suffice
                        issueService.layers.forEach(function (layerDef) {
                            //test if already listed--included in another issue
                            //build URL
                            layerDef.url = issueService.url + '/' + layerDef.layerIndex;
                            layerDef.type = 'feature';
                            if (!array.some(layerDefs, function (ld) { return ld.sdeLayerName == layerDef.sdeLayerName; })) {
                                layerDefs.push(layerDef);
                            }
                        });
                    } else {
                        domClass.add(span, 'disabled');
                        domConstruct.create('span', {'innerHTML': issueService.name, 'disabled': true}, span);
                    }
                    
                }, this);

                //sort layerDefs by name (again, we'll do this server-side eventually)
                layerDefs.sort(function (a, b) {
                    if (a.name == b.name) return 0;
                    if (a.name > b.name) return 1;
                    return -1;
                });

                //add layerDefs to all-layers list
                layerDefs.forEach(function (layerDef) {
                    var li = domConstruct.create('li', null, this.LayerSelectDom);
                    var a = domConstruct.create('a', { 'href': '#', 'innerHTML': layerDef.name, 'title': layerDef.description }, li);
                    on(a, 'click', lang.hitch(this, function () {
                        app.addToMap(layerDef);
                    }));
                }, this);

            },
            openFilterHelp: function () {
                this.myDialog.show();
            }
        });
    });
