/// <reference path='knockout-2.3.0.debug.js' />
/// <reference path='jquery-2.0.2.js' />
/// <reference path='jquery-ui-1.10.3.js' />
///
///<summary>
/// This sets up custom binding handlers in Knockout that will create and control jQueryUI widgets.
/// The usage is simple add the handler (typically named jq[Widget name]) to the data-bind attribute
/// with an object that would be structurally similar to the options object of the widget as the value.
/// Note that the individual options can each also be data bound. For example:
/// <button data-bind='jqButton: { disabled: formHasErrors }, click: save'>Save</button>
///
/// Refer to http://www.jqueryui.com for more information about each widget.
///</summary>

//disable eslint no-undef rule because we reference knockout, jquery, and moment
/* eslint-disable no-undef */
ko.afterInitialBindingCallbacks = [];

ko.afterInitialBindingTrigger = function () {
    for (var i = 0; i < ko.afterInitialBindingCallbacks.length; i++) {
        ko.afterInitialBindingCallbacks[i]();
    }
    ko.afterInitialBindingCallbacks = [];
};

//Animates the background color of the element to highlight it, then sets it back. It only causes the highlighting to happen if the new value is non-null and not false.
//You can also bind it to a 'dummy' observable and assign the values 'success', 'warning', or a hex color string.  
ko.bindingHandlers.flash = {
    update: function (element, valueAccessor) {
        var v = ko.unwrap(valueAccessor());
        if (v) {
            //any non-null value triggers it to flash
            //if the value is the literal string 'success', we use green
            //if the value is the literal string 'warning', we use yellow
            //if the value is a string that looks like a hex color, we use that
            //otherwise we default to a slightly different yellow
            var c = '#ffdd57',
                e = jQuery(element),
                t = e.css('background-color'),
                resetAfterAnimation = false;
            if (typeof v === 'string') {
                if (v === 'success') {
                    c = '#b2dba1'; //Note: this is actually the border color of our SWEPT theme success alert, but the background is a gradient, and I don't think we need to try animating a gradient for such a short flash
                    resetAfterAnimation = true;
                } else if (v === 'warning') {
                    c = '#f5e79e'; //Note: this is actually the border color of our SWEPT theme warning alert, but the background is a gradient, and I don't think we need to try animating a gradient for such a short flash
                    resetAfterAnimation = true;
                } else if ((/^#[0-9,a-f]{6}jQuery/).test(v)) {
                    c = v;
                    resetAfterAnimation = true;
                }
            }

            e.animate({backgroundColor: c}, 400) //flash the desired color for 400 milliseconds
                .animate({backgroundColor: t}, 400, 'swing', function () { //swing back to transparent (or whatever it was before)
                    //reset the bound value to null so that re-flashing with same color works
                    if (resetAfterAnimation) {
                        valueAccessor(null);
                    }
                });
        } //else null, do nothing
    }
};


ko.bindingHandlers.jqAccordion = {
    init: function (element, valueAccessor) {
        //var e = element;
        //ko.afterInitialBindingCallbacks.push(function () {
        //    jQuery(e).accordion('option', 'active', 0);
        //});
        jQuery(element).accordion(valueAccessor());
    },
    update: function (element, valueAccessor) {
        jQuery(element).accordion('option', valueAccessor()).accordion('refresh');
    }
};

ko.bindingHandlers.jqDatepicker = {
    init: function (element, valueAccessor, allBindingsAccessor) {
        //Create a computed in order to get the count of any observables used for setting options.
        var optComputed = ko.computed(function () {
            return ko.toJS(allBindingsAccessor().jqDatepickerOptions || {});
        });
        //initialize datepicker with some optional options
        var options = optComputed();
        if (options.id) {
            element.id = options.id;
        }
        if (!options.changeYear) {
            options.changeYear = true;
        }
        options.beforeShow = function (input, inst) {
            var calendar = inst.dpDiv;
            //attach the div right after the input box, so it works in scrolling modals
            jQuery(input).after(calendar);
            //set timeout is a dirty hack, but we can't do anything without it because this is before it is shown. 
            setTimeout(function () {
                calendar.position({
                    my: 'left top',
                    at: 'left bottom',
                    collision: 'none',
                    of: input
                });
            }, 1);
        };

        jQuery(element).datepicker(options);

        if (optComputed.getDependenciesCount() > 0) {
            //There's at least one observable value in the jqDatepickerOptions.
            //Create a new computed that will handle applying updates.
            ko.computed({
                read: function () {
                    var opts = ko.toJS(allBindingsAccessor().jqDatepickerOptions);
                    jQuery(element).datepicker('option', opts);
                },
                disposeWhenNodeIsRemoved: element
            });
        }
        //Dispose of the initial computed because it was only needed in order to find out if there were any observables or not.
        optComputed.dispose();

        var observable = valueAccessor();
        if (ko.isObservable(observable)) {
            //handle the field changing
            ko.utils.registerEventHandler(element, 'change', function () {
                var d = jQuery(element).datepicker('getDate');
                d = ko.utils.convertDateFromBrowserToServer(d);
                observable(d);
            });
            jQuery(element).datepicker('option', 'onSelect', function () {
                //jQuery(element).change(); Not working for some reason
                var d = jQuery(element).datepicker('getDate');
                d = ko.utils.convertDateFromBrowserToServer(d);
                observable(d);
                //element.fireEvent && element.fireEvent('onchange') || jQuery(element)change();
            });
        }

        //handle disposal (if KO removes by the template binding)
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            jQuery(element).datepicker('destroy');
        });
    },
    //update the control when the view model changes
    update: function (element, valueAccessor) {
        var value = ko.unwrap(valueAccessor());
        //convert from server timezone (observable) to actual local timezone (in datepicker) when updating
        //if (typeof(value) != 'undefined' && value != null) alert(value + ' convert to: ' + ko.utils.convertDateFromServerToBrowser(value))
        value = ko.utils.convertDateFromServerToBrowser(value);
        window.setTimeout(function () {
            jQuery(element).datepicker('setDate', value);
        }, 0);
    }
};


ko.bindingHandlers.jqProgressbar = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).progressbar(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).progressbar('option', options);
    }
};

ko.bindingHandlers.jqSlider = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).slider(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).slider('option', options);
    }
};

ko.bindingHandlers.jqSortable = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).sortable(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).sortable('option', options);
    }
};

ko.bindingHandlers.jqSpinner = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).spinner(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).spinner('option', options);
    }
};

ko.bindingHandlers.jqTabs = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tabs(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tabs('option', options).tabs('refresh');
    }
};

ko.bindingHandlers.jqTooltip = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tooltip(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tooltip('option', options);
    }
};

//For binding date objects to text, thanks to http://www.aaronkjackson.com/2012/04/formatting-dates-with-knockoutjs/
//depends on date.js
ko.bindingHandlers.dateString = {
    update: function (element, valueAccessor, allBindingsAccessor) {
        var value = valueAccessor(),
            allBindings = allBindingsAccessor();
        var valueUnwrapped = ko.utils.unwrapObservable(value);
        var pattern = allBindings.datePattern || 'mm/dd/yy';
        var valueToWrite = '';
        if (valueUnwrapped !== null) {
            if (valueUnwrapped instanceof Date && !isNaN(valueUnwrapped.valueOf())) {
                valueToWrite = jQuery.datepicker.formatDate(pattern, valueUnwrapped);
            } else {
                //it's not a date
                valueToWrite = valueUnwrapped;
            }
        }

        if (element.nodeName === 'INPUT') {
            jQuery(element).val(valueToWrite);
        } else {
            jQuery(element).text(valueToWrite);
        }
    }
};

ko.bindingHandlers.fileSizeString = {
    update: function (element, valueAccessor) {
        var value = valueAccessor(),
            valueUnwrapped = ko.utils.unwrapObservable(value);

        if (valueUnwrapped === null) {
            jQuery(element).text('');
        } else {
            var units = ['B', 'KB', 'MB', 'GB'];
            var order = 0;
            value = valueUnwrapped;
            while (value >= 1024 && order + 1 < units.length) {
                order++;
                value /= 1024;
            }
            //round two decimals and convert to string
            value = value.toFixed(2);
            //format with commas is highly unlikely, given that we go up to the GB range
            //but in case anyone adds a terabyte of data and we want to present it as #,###, uncomment the following
            //format with commas--first split so that we only commify the part before the decimal
            //value = value.split('.');
            //format with commas and add back the portion after the decimal, plus the units
            //value = value[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, 'jQuery1,') + '.' + value[1] + '&nbsp;' + units[order];
            value = value + '&nbsp;' + units[order];
            jQuery(element).html(value);
        }
    }
};

ko.observableArray.fn.setAt = function (index, value) {
    this.valueWillMutate();
    this()[index] = value;
    this.valueHasMutated();
};

ko.observableArray.fn.insertAt = function (index, value) {
    this.valueWillMutate();
    this.splice(index, 0, value);
    this.valueHasMutated();
};

//use to prevent binding in a particular area. Useful if you have a knockout-bound velocity component inserted within a larger data-bound area of the page
ko.bindingHandlers.stopBinding = {
    init: function () {
        return {
            controlsDescendantBindings: true
        };
    }
};
ko.virtualElements.allowedBindings.stopBinding = true;

//add a new function to the knockout observable function to test
//for null or empty/whitespace string
ko.observable.fn.isNullOrWhiteSpace = function () {
    var o = ko.utils.unwrapObservable(this);
    if (o === null) {
        return true;
    }
    if (typeof o === 'string') {
        if (o === '') {
            return true;
        }
        if (o.replace(/^\s+|\s+jQuery/g, '').length === 0) {
            return true;
        }
    }
    return false;
};
ko.computed.fn.isNullOrWhiteSpace = ko.observable.fn.isNullOrWhiteSpace;
//not used, doesn't work with current version of ko
//ko.bindingHandlers['tristate'] = {
//    'after': ['value', 'attr'],
//    'init': function (element, valueAccessor, allBindings) {
//        var checkedValue = ko.pureComputed(function () {
//            // Treat "value" like "checkedValue" when it is included with "checked" binding
//            if (allBindings['has']('checkedValue')) {
//                return ko.utils.unwrapObservable(allBindings.get('checkedValue'));
//            } else if (allBindings['has']('value')) {
//                return ko.utils.unwrapObservable(allBindings.get('value'));
//            }

//            return element.value;
//        });

//        function updateModel() {
//            // This updates the model value from the view value.
//            // It runs in response to DOM events (click) and changes in checkedValue.
//            var isChecked = element.checked,
//                elemValue = useCheckedValue ? checkedValue() : isChecked;

//            // When we're first setting up this computed, don't change any model state.
//            if (ko.computedContext.isInitial()) {
//                return;
//            }

//            // We can ignore unchecked radio buttons, because some other radio
//            // button will be getting checked, and that one can take care of updating state.
//            if (isRadio && !isChecked) {
//                return;
//            }

//            var modelValue = ko.dependencyDetection.ignore(valueAccessor);
//            if (isValueArray) {
//                if (oldElemValue !== elemValue) {
//                    // When we're responding to the checkedValue changing, and the element is
//                    // currently checked, replace the old elem value with the new elem value
//                    // in the model array.
//                    if (isChecked) {
//                        ko.utils.addOrRemoveItem(modelValue, elemValue, true);
//                        ko.utils.addOrRemoveItem(modelValue, oldElemValue, false);
//                    }

//                    oldElemValue = elemValue;
//                } else {
//                    // When we're responding to the user having checked/unchecked a checkbox,
//                    // add/remove the element value to the model array.
//                    ko.utils.addOrRemoveItem(modelValue, elemValue, isChecked);
//                }
//            } else {
//                if (tristateType == 'cycle' && elemValue && modelValue() !== null)
//                    elemValue = null;
//                ko.expressionRewriting.writeValueToProperty(modelValue, allBindings, 'checked', elemValue, true);
//            }
//        };

//        function updateView() {
//            // This updates the view value from the model value.
//            // It runs in response to changes in the bound (checked) value.
//            var modelValue = ko.utils.unwrapObservable(valueAccessor());

//            if (isValueArray) {
//                // When a checkbox is bound to an array, being checked represents its value being present in that array
//                element.checked = ko.utils.arrayIndexOf(modelValue, checkedValue()) >= 0;
//            } else if (isCheckbox) {
//                // When a checkbox is bound to any other value (not an array), being checked represents the value being trueish
//                element.checked = modelValue;
//                if (tristateType)
//                    element.indeterminate = modelValue === null;
//            } else {
//                // For radio buttons, being checked means that the radio button's value corresponds to the model value
//                element.checked = (checkedValue() === modelValue);
//            }
//        };

//        var isCheckbox = element.type == "checkbox",
//            isRadio = element.type == "radio";

//        // Only bind to check boxes and radio buttons
//        if (!isCheckbox && !isRadio) {
//            return;
//        }

//        var tristateType = isCheckbox && allBindings['has']('tristateType') && allBindings.get('tristateType'),
//            isValueArray = isCheckbox && (ko.utils.unwrapObservable(valueAccessor()) instanceof Array),
//            oldElemValue = isValueArray ? checkedValue() : undefined,
//            useCheckedValue = isRadio || isValueArray;

//        // IE 6 won't allow radio buttons to be selected unless they have a name
//        if (isRadio && !element.name)
//            ko.bindingHandlers['uniqueName']['init'](element, function () { return true });

//        // Set up two computeds to update the binding:

//        // The first responds to changes in the checkedValue value and to element clicks
//        ko.computed(updateModel, null, { disposeWhenNodeIsRemoved: element });
//        ko.utils.registerEventHandler(element, "click", updateModel);

//        // The second responds to changes in the model value (the one associated with the checked binding)
//        ko.computed(updateView, null, { disposeWhenNodeIsRemoved: element });
//    }
//};


function markChecked(el) {
    el.readOnly = false;
    el.indeterminate = false;
    el.checked = true;
}

function markUnchecked(el) {
    el.readOnly = false;
    el.indeterminate = false;
    el.checked = false;
}

function markUnspecified(el) {
    el.readOnly = true;
    el.indeterminate = true;
    el.checked = false;
}

ko.bindingHandlers.triState = {
    init: function (element, valueAccessor) {
        element.onclick = function () {
            var value = valueAccessor();
            var unwrappedValue = ko.unwrap(value);

            if (unwrappedValue) {
                value(false); //this effectively prevents clicking to null state
            } else if (unwrappedValue === false) {
                value(true);
            } else {
                value(false);
            }
        };
    },
    update: function (element, valueAccessor) {
        var value = ko.unwrap(valueAccessor());

        if (value) {
            markChecked(element);
        } else if (value === false) {
            markUnchecked(element);
        } else {
            markUnspecified(element);
        }
    }
};

//makes sure you're only typing numbers
//see http://jsfiddle.net/wmbeers/844so0q9/4/
ko.bindingHandlers.numeric = {
    init: function (element, valueAccessor) {
        var va = valueAccessor();
        var options = {
            allowDecimal: false,
            allowNegative: false,
            allowComma: false
        };

        if (va !== null && typeof va === 'object') {
            if (va.allowDecimal !== null && typeof va.allowDecimal === 'boolean') {
                options.allowDecimal = va.allowDecimal;
            }
            if (va.allowNegative !== null && typeof va.allowNegative === 'boolean') {
                options.allowNegative = va.allowNegative;
            }
            if (va.allowComma !== null && typeof va.allowComma === 'boolean') {
                options.allowComma = va.allowComma;
            }
        }
        jQuery(element).on('keydown', function (event) {
            //to figure out if user has already typed a decimal or negative, while handling selection in case they're replacing text with
            //what they've typed, see what the new text would be
            var cv = element.value;
            if (element.selectionStart !== element.selectionEnd) {
                cv = cv.substring(0, element.selectionStart) + cv.substring(element.selectionEnd);
            }

            // Allow: delete, backspace, tab, escape, and enter
            if (event.keyCode === 46 || event.keyCode === 8 || event.keyCode === 9 || event.keyCode === 27 || event.keyCode === 13 ||
                // Allow: Ctrl+A, Ctrl+C, Ctrl+V (TODO: need to handle pasting and drag/drop as well!)
                ((event.keyCode === 67 || event.keyCode === 65 || event.keyCode === 86) && event.ctrlKey === true) ||
                // Allow: , TODO: allow it only in the right circumstance (not one right after the other, no preceding one unless three digits back, etc.)
                (options.allowComma && event.keyCode === 188) ||
                // Allow: period (190) and decimal point (110) if allowDecimal==true and user hasn't already typed one
                (options.allowDecimal && cv.indexOf('.') === -1 && (event.keyCode === 190 || event.keyCode === 110)) ||
                // Allow: - subtract (109) or dash (189) if allowNegative == true and user hasn't already typed one
                // (note: if user has selected all the text e.g. '-3333' and types '-', that is allowed)
                (options.allowNegative && element.selectionStart === 0 && cv.indexOf('-') === -1 && (event.keyCode === 109 || event.keyCode === 189)) ||
                // Allow: home, end, left, right
                (event.keyCode >= 35 && event.keyCode <= 39)) {
                // let it happen, don't do anything
                return;
            }
            if (event.shiftKey || (event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 96 || event.keyCode > 105)) {
                // Ensure that it is a number and stop the keypress
                event.preventDefault();
            }
        });
    }
};

/**
 * Use instead of ko visible binding to animate elements fading in or out.
 */
ko.bindingHandlers.fadeVisible = {
    init: function (element, valueAccessor) {
        jQuery(element).toggle(ko.unwrap(valueAccessor())); // Use 'unwrapObservable' so
        // we can handle values that
        // may or may not be
        // observable
    },
    update: function (element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in
        // or out
        if (ko.unwrap(valueAccessor())) {
            jQuery(element).fadeIn();
        } else {
            jQuery(element).fadeOut();
        }
    }
};

//Similar to visible binding, this will use jQueryUI to slide the new section
//down
ko.bindingHandlers.slideVisible = {
    init: function (element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on
        // the value
        jQuery(element).toggle(ko.unwrap(valueAccessor())); 
    },
    update: function (element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in
        // or out
        if (ko.unwrap(valueAccessor())) {
            jQuery(element).slideDown();
        } else {
            jQuery(element).slideUp();
        }
    }
};

ko.bindingHandlers.jqTimepicker = {
    init: function (element, valueAccessor, allBindingsAccessor) {
        jQuery(element).val(ko.unwrap(valueAccessor()));
        //initialize timepicker with some optional options
        var options = allBindingsAccessor().timepickerOptions || {};
        jQuery(element).timepicker(options);

        //handle the field changing
        ko.utils.registerEventHandler(element, 'time-change', function () {
            // We don't actually store a Date object, just the formatted time string.
            var observable = valueAccessor();
            observable(jQuery(element).val());
        });

        //handle disposal (if KO removes by the template binding)
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            jQuery(element).timepicker('destroy');
        });
    },

    update: function (element, valueAccessor) {
        var value = ko.unwrap(valueAccessor());
        // calling timepicker() on an element already initialized will return a TimePicker object
        var instance = jQuery(element).timepicker();

        //value will likely be a string, so don't try to do math with it, just use it.
        //if (value - instance.getTime() !== 0) {
        instance.setTime(value);
        //}
    }
};


ko.utils.convertDateFromServerToBrowser = function (dd) {
    if (dd && typeof (dd.getTimezoneOffset) === 'function' && typeof moment !== 'undefined') {
        try {
            var offSets = moment().utcOffset() + dd.getTimezoneOffset();
            if (offSets !== 0) {
                return moment(dd).add(offSets, 'm').toDate();
            }
        } catch (err) {
            /* eslint-disable no-console */
            if (console.debug) {
                console.debug('typeof dd:' + typeof dd);
                console.debug('typeof dd.getTimezoneOffset:' + typeof dd.getTimezoneOffset);
                console.debug(err);
            }
            /* eslint-enable no-console */
        }
    }
    return dd;
};

ko.utils.convertDateFromBrowserToServer = function (dd) {
    if (dd && typeof (dd.getTimezoneOffset) === 'function' && typeof moment !== 'undefined') {
        try {
            var offSets = moment().utcOffset() + dd.getTimezoneOffset();
            if (offSets !== 0) {
                return moment(dd).subtract(offSets, 'm').toDate();
            }
        } catch (err) {
            /* eslint-disable no-console */
            if (console.debug) {
                console.debug('typeof dd:' + typeof dd);
                console.debug('typeof dd.getTimezoneOffset:' + typeof dd.getTimezoneOffset);
                console.debug(err);
            }
            /* eslint-enable no-console */
        }
    }
    return dd;
};
/* eslint-enable no-undef */
