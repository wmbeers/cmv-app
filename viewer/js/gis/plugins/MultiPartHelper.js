define(['esri/geometry/Polyline'],
    function (Polyline) {
    /**
     * Helper class for handling multi-part geometries that get created from split operations.
     */
    return {
        isMultiPart (geometry) {
            if (!geometry) {
                return false;
            }
            if (geometry.type === 'multipoint') {
                return true;
            }
            if (geometry.paths && geometry.paths.length > 1) {
                //multi-part polyline
                return true;
            }
            if (geometry.rings && geometry.rings.length > 1) {
                //multi-part polygon; HOWEVER--this also would be true of toroids (donuts), which for our purposes aren't really multi-part.
                //Holes are defined by rings ordered counter-clockwise, outer rings are ordered clockwise. So multi-part polygons are defined
                //by having >1 clockwise rings
                var r = this._getOuterAndInnerRings(geometry);
                return r.outerRings.length > 1; // if more than one outer ring, it's a true multi-part feature for our purposes.
            }
            return false;
        },

        explode (geometry) {
            var geometries = [];
            if (this.isMultiPart(geometry)) {
                if (geometry.type === 'polygon') {
                    var r = this._getOuterAndInnerRings(geometry);
                    if (r.innerRings.length > 0) {
                        //TODO special handling of inner rings
                    } else {
                        //multiple outer rings only, easy peasy
                        geometries = r.outerRings;
                    }
                } else if (geometry.type === 'polyline') {
                    //convert from array of numbers to proper polylines
                    //don't know why we need to do this for polyline but not polygon rings, but here we are
                    geometry.paths.forEach(function (path) {
                        var polyline = new Polyline(path);
                        geometries.push(polyline);
                    });
                } else if (geometry.type === 'multipoint') {
                    geometries = geometry.points;
                }
            } else {
                geometries.push(geometry);
            }
            return geometries;
        },

        _getOuterAndInnerRings (geometry) {
            var r = {
                innerRings: [],
                outerRings: []
            };
            for (var n = 0; n < geometry.rings.length; n++) {
                if (geometry.isClockwise(n)) {
                    r.outerRings.push(geometry.rings[n]);
                } else {
                    r.innerRings.push(geometry.rings[n]);
                }
            }
            return r;
        }
    };
});