// https://tc39.github.io/ecma262/#sec-array.prototype.find
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function (predicate) {
            // 1. Let O be ? ToObject(this value).
            if (this === null) {
                throw new TypeError('"this" is null or not defined');
            }

            var o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            var len = o.length >>> 0;

            // 3. If IsCallable(predicate) is false, throw a TypeError exception.
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }

            // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
            var thisArg = arguments[1];

            // 5. Let k be 0.
            var k = 0;

            // 6. Repeat, while k < len
            while (k < len) {
                // a. Let Pk be ! ToString(k).
                // b. Let kValue be ? Get(O, Pk).
                // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
                // d. If testResult is true, return kValue.
                var kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return kValue;
                }
                // e. Increase k by 1.
                k++;
            }

            // 7. Return undefined.
            return undefined;
        },
        configurable: true,
        writable: true
    });
}
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
if (!Array.prototype.filter) {
    Array.prototype.filter = function (func, thisArg) {
        if (!((typeof func === 'function') && this)) {
            throw new TypeError();
        }

        var len = this.length >>> 0,
            res = new Array(len), // preallocate array
            t = this, c = 0, i = -1; //eslint-disable-line consistent-this

        var kValue;
        if (typeof thisArg === 'undefined') {
            while (++i !== len) {
                // checks to see if the key was set
                if (i in this) {
                    kValue = t[i]; // in case t is changed in callback
                    if (func(t[i], i, t)) {
                        res[c++] = kValue;
                    }
                }
            }
        } else {
            while (++i !== len) {
                // checks to see if the key was set
                if (i in this) {
                    kValue = t[i];
                    if (func.call(thisArg, t[i], i, t)) {
                        res[c++] = kValue;
                    }
                }
            }
        }

        res.length = c; // shrink down array to proper size
        return res;
    };
}

//https://stackoverflow.com/questions/30867172/code-not-running-in-ie-11-works-fine-in-chrome
if (!String.prototype.startsWith) {
    //eslint-disable-next-line no-extend-native
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.indexOf(searchString, position) === position;
    };
}