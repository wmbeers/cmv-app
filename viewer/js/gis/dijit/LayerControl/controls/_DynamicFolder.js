define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/query',
    'dojo/dom-class',
    'dojo/dom-style',
    'dojo/dom-attr',
    'dojo/fx',
    'dojo/html',
    'dijit/Menu',
    'dijit/MenuItem',
    'dijit/MenuSeparator',
    'dojo/topic',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dojo/text!./templates/Folder.html',
    'dojo/i18n!./../nls/resource'
], function (
    declare,
    lang,
    array,
    on,
    query,
    domClass,
    domStyle,
    domAttr,
    fx,
    html,
    Menu,
    MenuItem,
    MenuSeparator,
    topic,
    WidgetBase,
    TemplatedMixin,
    folderTemplate,
    i18n
) {
    var _DynamicFolder = declare([WidgetBase, TemplatedMixin], {
        control: null,
        sublayerInfo: null,
        menu: null,
        icons: null,
        // ^args
        templateString: folderTemplate,
        _expandClickHandler: null,
        _handlers: [],

        postCreate: function () {
            this.inherited(arguments);
            this._checkHideControl();
            var checkNode = this.checkNode;
            domAttr.set(checkNode, 'data-sublayer-id', this.sublayerInfo.id);
            domAttr.set(checkNode, 'data-layer-folder', true);
            domClass.add(checkNode, this.control.layer.id + '-layerControlSublayerCheck');

            this._handlers.push(on(checkNode, 'click', lang.hitch(this, function (event) {

                // prevent click event from bubbling
                if (event.stopPropagation) {
                    event.stopPropagation();
                }

                if (this.control.controlOptions.ignoreDynamicGroupVisibility) {
                    if (!this._hasAnyInvisibleLayer()) {
                        this._setFolderCheckbox(false, checkNode);
                    } else {
                        this._setFolderCheckbox(true, checkNode);
                    }
                } else {
                    this._setFolderCheckbox(!this._isVisible(), checkNode);
                }

                this._checkboxScaleRange();
            })));
            html.set(this.labelNode, this.sublayerInfo.name);
            this._expandClick();
            if (this.sublayerInfo.minScale !== 0 || this.sublayerInfo.maxScale !== 0) {
                this._checkboxScaleRange();
                this._handlers.push(this.control.layer.getMap().on('zoom-end', lang.hitch(this, '_checkboxScaleRange')));
            }
            if (!this.control.controlOptions.ignoreDynamicGroupVisibility) {
                var layerViz = (array.indexOf(this.control.layer.visibleLayers, this.sublayerInfo.id) !== -1);
                this._setFolderCheckbox(layerViz, checkNode, true);
            }

            //set up menu
            //this wordy property means, if anything other than explicitly set to false,
            //then we'll add a menu
            var defaultMenu = this.control.controlOptions.includeToggleSubLayersMenuOptionForDynamicFolders !== false;
            if (defaultMenu || this.control.controlOptions.folderMenu &&
                    this.control.controlOptions.folderMenu.length) {
                this.menu = new Menu({
                    contextMenuForWindow: false,
                    targetNodeIds: [this.menuClickNode],
                    leftClickToOpen: true
                });
                if (defaultMenu) {
                    this.menu.addChild(new MenuItem({
                        label: i18n.dynamicSublayersOn,
                        iconClass: 'far fa-fw fa-check-square',
                        onClick: lang.hitch(this, '_toggleAllSublayers', true)
                    }));
                    this.menu.addChild(new MenuItem({
                        label: i18n.dynamicSublayersOff,
                        iconClass: 'far fa-fw fa-square',
                        onClick: lang.hitch(this, '_toggleAllSublayers', false)
                    }));
                    this.menu.addChild(new MenuSeparator());
                }
                if (this.control.controlOptions.folderMenu &&
                        this.control.controlOptions.folderMenu.length) {
                    array.forEach(this.control.controlOptions.folderMenu, lang.hitch(this, '_addMenuItem'));
                }
                this.menu.startup();
            } else {
                domClass.add(this.menuClickNode, 'hidden');
            }
        },

        _addMenuItem: function (menuItem) {
            //create the menu item
            var item = new MenuItem(menuItem);
            item.set('onClick', lang.hitch(this, function () {
                topic.publish('layerControl/' + menuItem.topic, {
                    layer: this.control.layer,
                    subLayer: this.sublayerInfo,
                    iconNode: this.iconNode,
                    menuItem: item
                });
            }));
            this.menu.addChild(item);
        },

        // add on event to expandClickNode
        _expandClick: function () {
            var i = this.icons;
            this._handlers.push(this._expandClickHandler = on(this.expandClickNode, 'click', lang.hitch(this, function () {
                var expandNode = this.expandNode,
                    iconNode = this.expandIconNode;
                if (domStyle.get(expandNode, 'display') === 'none') {
                    fx.wipeIn({
                        node: expandNode,
                        duration: 300
                    }).play();
                    domClass.replace(iconNode, i.folderOpen, i.folder);
                } else {
                    fx.wipeOut({
                        node: expandNode,
                        duration: 300
                    }).play();
                    domClass.replace(iconNode, i.folder, i.folderOpen);
                }
            })));
        },

        // toggle all sublayers on/off; differs from _setFolderCheckbox in that it temporarily overrides ignoreDynamicGroupVisibility
        _toggleAllSublayers: function (state) {
            //cache default state of this obscure property
            var _ignoreDynamicGroupVisibility = this.control.controlOptions.ignoreDynamicGroupVisibility;
            //specify it's true, so that _setFolderCheckbox behaves like we want it to
            this.control.controlOptions.ignoreDynamicGroupVisibility = true;
            //let this existing method do the work
            this._setFolderCheckbox(state, this.checkNode, false);
            //restore the desired state
            this.control.controlOptions.ignoreDynamicGroupVisibility = _ignoreDynamicGroupVisibility;
        },

        // toggles visibility of all sub layers
        _setFolderCheckbox: function (checked, checkNode, noPublish) {
            var i = this.icons,
                dataChecked = (checked) ? 'checked' : 'unchecked',
                slNodes = this._getSubLayerNodes();
            checkNode = checkNode || this.checkNode;

            if (this.control.controlOptions.ignoreDynamicGroupVisibility) {
                array.forEach(slNodes, lang.hitch(this, function (node) {
                    // child is folder
                    if (domAttr.get(node, 'data-layer-folder')) {
                        var folderControl = this._getFolderControl(node);
                        if (folderControl) {
                            folderControl._setFolderCheckbox(checked, node, true);
                        }
                    // child is sub layer
                    } else {
                        domAttr.set(node, 'data-checked', dataChecked);
                        if (checked) {
                            domClass.replace(node, i.checked, i.unchecked);
                        } else {
                            domClass.replace(node, i.unchecked, i.checked);
                        }
                    }
                }));
            } else {
                domAttr.set(checkNode, 'data-checked', dataChecked);
                if (checked) {
                    domClass.replace(checkNode, i.checked, i.unchecked);
                } else {
                    domClass.replace(checkNode, i.unchecked, i.checked);
                }
            }

            if (!noPublish) {
                this.control._setVisibleLayers();
            }
        },

        _hasAnyVisibleLayer: function () {
            var slNodes = this._getSubLayerNodes();
            return array.some(slNodes, lang.hitch(this, function (node) {
                if (domAttr.get(node, 'data-layer-folder')) {
                    var folderControl = this._getFolderControl(node);
                    if (folderControl) {
                        return folderControl._hasAnyVisibleLayer();
                    }
                    return true;
                }
                return (domAttr.get(node, 'data-checked') === 'checked');
            }));
        },

        _hasAnyInvisibleLayer: function () {
            var slNodes = this._getSubLayerNodes();
            return array.some(slNodes, lang.hitch(this, function (node) {
                if (domAttr.get(node, 'data-layer-folder')) {
                    var folderControl = this._getFolderControl(node);
                    if (folderControl) {
                        return folderControl._hasAnyInvisibleLayer();
                    }
                    return true;
                }
                return (domAttr.get(node, 'data-checked') !== 'checked');
            }));
        },

        _getSubLayerNodes: function () {
            var layerIds = this.control.controlOptions.layerIds || [];
            var subLayerInfos = [];
            if (this.control.controlOptions.subLayerInfos && !this.control.controlOptions.includeUnspecifiedLayers) {
                subLayerInfos = array.map(this.control.controlOptions.subLayerInfos, function (sli) {
                    return sli.id;
                });
            }

            var subLayerNodes = query('.' + this.control.layer.id + '-layerControlSublayerCheck', this.domNode);
            return array.filter(subLayerNodes, lang.hitch(this, function (node) {
                var subLayerID = parseInt(domAttr.get(node, 'data-sublayer-id'), 10);
                // is the sublayer contained in this folder
                if (array.indexOf(this.sublayerInfo.subLayerIds, subLayerID) < 0) {
                    return false;
                // is the sublayer included in layer's layerIds (if they are defined)
                } else if (layerIds.length && array.indexOf(layerIds, subLayerID) < 0) {
                    return false;
                // is the sublayer included in layer's subLayerInfos (if they are defined)
                } else if (subLayerInfos.length && array.indexOf(subLayerInfos, subLayerID) < 0) {
                    return false;
                }
                return true;
            }));
        },

        _getSubLayerControls: function () {
            var parentLayerId = this.sublayerInfo.id;
            return array.filter(this.control._sublayerControls, function (control) {
                return (control.parentLayerId === parentLayerId);
            });
        },

        _getFolderControls: function () {
            var parentLayerId = this.sublayerInfo.id;
            return array.filter(this.control._folderControls, function (control) {
                return (control.parentLayerId === parentLayerId);
            });
        },

        _getFolderControl: function (node) {
            var subLayerID = parseInt(domAttr.get(node, 'data-sublayer-id'), 10);
            var controls = array.filter(this.control._folderControls, function (control) {
                return (control.sublayerInfo.id === subLayerID);
            });
            if (controls.length) {
                return controls[0];
            }
            return null;
        },

        // set visibility of folder (group layer) based on the visibility
        // of children sub-layers and folders
        _checkFolderVisibility: function () {
            var checkNode = this.checkNode,
                i = this.icons;

            var hasVisible = this._hasAnyVisibleLayer();
            var hasHidden = this._hasAnyInvisibleLayer();

            domClass.remove(checkNode, i.checked);
            domClass.remove(checkNode, i.unchecked);
            domClass.remove(checkNode, i.indeterminate);

            // indeterminate - both visible and invisible layers in group
            if (hasVisible && hasHidden) {
                domAttr.set(checkNode, 'data-checked', 'indeterminate');
                domClass.add(checkNode, i.indeterminate);
            } else if (hasVisible) {
                domAttr.set(checkNode, 'data-checked', 'checked');
                domClass.add(checkNode, i.checked);
            } else {
                domAttr.set(checkNode, 'data-checked', 'unchecked');
                domClass.add(checkNode, i.unchecked);
            }
        },

        // check scales and add/remove disabled classes from checkbox
        _checkboxScaleRange: function () {
            var node = this.checkNode,
                scale = this.control.layer.getMap().getScale(),
                min = this.sublayerInfo.minScale,
                max = this.sublayerInfo.maxScale;
            domClass.remove(node, 'layerControlCheckIconOutScale');
            if ((min !== 0 && scale > min) || (max !== 0 && scale < max)) {
                domClass.add(node, 'layerControlCheckIconOutScale');
            }
        },


        _checkHideControl: function () {
            // Should the control be visible or hidden (depends on subLayerInfos)?
            if (this.control.controlOptions.subLayerInfos && !this.control.controlOptions.includeUnspecifiedLayers) {
                var subLayerInfos = array.map(this.control.controlOptions.subLayerInfos, function (sli) {
                    return sli.id;
                });
                if (array.indexOf(subLayerInfos, this.sublayerInfo.id) < 0) {
                    domClass.add(this.domNode, 'layerControlHidden');
                }
            }
            // Should the control be visible or hidden?
            if (this.control.controlOptions.layerIds && array.indexOf(this.control.controlOptions.layerIds, this.sublayerInfo.id) < 0) {
                domClass.add(this.domNode, 'layerControlHidden');
            }
        },

        _isVisible: function () {
            return (domAttr.get(this.checkNode, 'data-checked') === 'checked');
        },

        destroy: function () {
            this.inherited(arguments);
            this._handlers.forEach(function (h) {
                h.remove();
            });
        }
    });
    return _DynamicFolder;
});
