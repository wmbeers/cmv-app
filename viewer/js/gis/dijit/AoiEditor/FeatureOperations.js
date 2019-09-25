define([
    'dojo/_base/declare',
    'esri/OperationBase'
], function (declare, OperationBase) {
    var customOp = {};

    customOp.Add = declare(OperationBase, {
        label: 'Add Feature',
        constructor: function (feature) {
            this.feature = feature;
        },

        performUndo: function () {
            this.feature.deleteFeature(false);
        },

        performRedo: function () {
            this.feature.restore();
        }
    });

    customOp.Delete = declare(OperationBase, {
        label: 'Delete Feature',
        constructor: function (feature) {
            this.feature = feature;
        },

        performUndo: function () {
            this.feature.restore();
        },

        performRedo: function () {
            this.feature.deleteFeature(false);
        }
    });

    customOp.Update = declare(OperationBase, {
        label: 'Update Feature',
        constructor: function (feature) {
            //preUpdate is a copy of the feature created when the feature is first constructed (either by draw or load), 
            //and remains unchanged when changes are made to the feature (either it's graphics or attributes). It gets refreshed, 
            //below, when this constructor is called from applyEdits.
            this.preUpdate = feature.preUpdate; 
            //a pointer to the feature
            this.feature = feature;
            //Now that this operation has a copy of the preUpdate cache, we call this method to update the cache with current values
            //for use in later operations.
            feature.cachePreUpdate(); 
            //And we keep it here to use in redo.
            this.postUpdate = feature.preUpdate;
        },

        performUndo: function () {
            //updates the feature with cached values
            this.feature.restore(this.preUpdate); 
        },

        performRedo: function () {
            //updates the feature with cached values
            this.feature.restore(this.postUpdate);
        }
    });

    return customOp;
});