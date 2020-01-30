define(function () {
    /**
     * Tests a coordinates string to determine if it can be interpreted as a lat/lon, and converts to 
     * object with x and y properties, assuming a general bounding box around the State of Florida.
     * @param {String} coordinates a string containing 2, 4 or 6 sets of numbers that can be interpreted 
     *  as lat/long coordinates
     * @return {Object} object with x (longitude, as a negative number) and y (latitude, as a positive number) properties, 
     *  or null if not a valid lat/lon.
     */
    return {
        //eslint-disable-next-line complexity
        interpretCoordinates: function (coordinates) {
            var pattern = new RegExp('(\\d+\\.{0,1}\\d+)', 'g'),
                matches = coordinates.match(pattern),
                d1 = null, d2 = null,
                point = {x: null, y: null};

            if (!matches) {
                return null;
            }

            switch (matches.length) {
            case 2:
                //decimal degrees
                d1 = parseFloat(matches[0]);
                d2 = parseFloat(matches[1]);
                break;
            case 4:
                //degrees decimal minutes
                //test degrees are integers
                if (!this._isInt(matches[0]) || !this._isInt(matches[2])) {
                    return null;
                }
                //test minutes are less than 60
                if (matches[1] > 60 || matches[3] > 60) {
                    return null;
                }
                d1 = parseFloat(matches[0]) + parseFloat(matches[1]) / 60;
                d2 = parseFloat(matches[2]) + parseFloat(matches[3]) / 60;
                break;
            case 6:
                //degrees minutes seconds
                //test degrees and minutes are integers
                if (!this._isInt(matches[0]) || !this._isInt(matches[1]) ||
                    !this._isInt(matches[3]) || !this._isInt(matches[4])) {
                    return null;
                }
                //test minutes and seconds are less than 60
                if (matches[1] > 60 || matches[2] > 60 ||
                    matches[4] > 60 || matches[5] > 60) {
                    return null;
                }
                var m1 = parseFloat(matches[1]) + parseFloat(matches[2]) / 60,
                    m2 = parseFloat(matches[4]) + parseFloat(matches[5]) / 60;
                d1 = parseFloat(matches[0]) + m1 / 60;
                d2 = parseFloat(matches[3]) + m2 / 60;
                break;
            default:
                //unexpected number of sets of numbers
                return null;
            }
            //test which is lat vs which is long
            if (d1 > 32 && d2 < 77) {
                //probably long/lat
                point.y = d2;
                point.x = d1;
            } else {
                //assume lat/long
                point.y = d1;
                point.x = d2;
            }

            //normalize sign
            point.x *= -1;

            //reconfirm valid values for lat and long in a generous envelope around Florida
            if (point.y < 24.5 || point.y > 31.2 || point.x < -88 || point.x > -79.8) {
                return null;
            }

            return point;
        },

        /**
         * Tests a value to see if it is an integer, or string convertable to an integer, returning true if so.
         * Thanks to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger
         * @param {any} value An input value to test
         * @returns {boolean} True if value is integer or string containing an integer
         */
        _isInt: function (value) {
            if (isNaN(value)) {
                return false;
            }
            var x = parseFloat(value);
            return (x | 0) === x;
        }
    };
});