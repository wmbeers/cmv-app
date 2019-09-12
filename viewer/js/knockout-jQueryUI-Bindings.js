/// <reference path="knockout-2.3.0.debug.js" />
/// <reference path="jquery-2.0.2.js" />
/// <reference path="jquery-ui-1.10.3.js" />
///
///<summary>
/// This sets up custom binding handlers in Knockout that will create and control jQueryUI widgets.
/// The usage is simple add the handler (typically named jq[Widget name]) to the data-bind attribute
/// with an object that would be structurally similar to the options object of the widget as the value.
/// Note that the individual options can each also be data bound. For example:
/// <button data-bind="jqButton: { disabled: formHasErrors }, click: save">Save</button>
///
/// Refer to http://www.jqueryui.com for more information about each widget.
///</summary>

ko.afterInitialBindingCallbacks = [];

ko.afterInitialBindingTrigger = function () {
    for (var i = 0; i < ko.afterInitialBindingCallbacks.length; i++) {
        ko.afterInitialBindingCallbacks[i]();
    }
    ko.afterInitialBindingCallbacks = [];
};

//Animates the background color of the element to highlight it, then sets it back. It only causes the highlighting to happen if the new value is non-null and not false.
//You can also bind it to a "dummy" observable and assign the values 'success', 'warning', or a hex color string.  
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
                e = $(element),
                t = e.css('background-color'),
                resetAfterAnimation = false;
            if (typeof v === 'string') {
                if (v === 'success') {
                    c = '#b2dba1'; //Note: this is actually the border color of our SWEPT theme success alert, but the background is a gradient, and I don't think we need to try animating a gradient for such a short flash
                    resetAfterAnimation = true;
                } else if (v === 'warning') {
                    c = '#f5e79e'; //Note: this is actually the border color of our SWEPT theme warning alert, but the background is a gradient, and I don't think we need to try animating a gradient for such a short flash
                    resetAfterAnimation = true;
                } else if (/^#[0-9,a-f]{6}$/.test(v)) {
                    c = v;
                    resetAfterAnimation = true;
                }
            }

            e.animate({ backgroundColor: c }, 400) //flash the desired color for 400 milliseconds
                .animate({ backgroundColor: t }, 400, 'swing', function () { //swing back to transparent (or whatever it was before)
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
        //    jQuery(e).accordion("option", "active", 0);
        //});
        jQuery(element).accordion(valueAccessor());
    },
    update: function (element, valueAccessor) {
        jQuery(element).accordion("option", valueAccessor()).accordion("refresh");
    }
};

//<input type='text' data-bind='jqAutocomplete: someArray
//the original version of this wasn't very workable
//but then neither is this, really. Luckily I found this:
//https://github.com/rniemeyer/knockout-jqAutocomplete
ko.bindingHandlers.jqAutocompleteForArray = {
    init: function (element, valueAccessor, allBindingsAccessor) {
        var options = allBindingsAccessor().autocompleteOptions || {};

        options.source = function (request, response) {
            AutoComplete.getMatches(options.autocompleteSource, request.term,
                function (matches) {
                    if (matches.length == 0) {
                        //TODO identify a property in the model to set
                    }
                    response(matches);
                }
            );
        }
        //onselect function must also be identified if you want to do something with the completed value, identified as autcompleteOnSelect
        options.select = function (event, ui) {
            var f = options.onSelect;
            if (f) {
                f.call(this, ui.item);
            }
            if (options.preventAutocomplete) return false;
        }
        if (options.preventAutocomplete) {
            options.focus = function (event, ui) {
                //Return false to prevent jQ Autocomplete from populating the textbox with the org user Id
                return false;
            };
        }
        //default options
        if (!options.minLength)
            options.minLength = 2;
        if (!options.hasOwnProperty('autoFocus'))
            options.autoFocus = true;

        jQuery(element).autocomplete(options);

    }
};

ko.bindingHandlers.jqButton = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).button(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).button(options);
    }
};

ko.bindingHandlers.jqButtonset = {
    init: function (element, valueAccessor) {
        jQuery(element).buttonset();
    },
    update: function (element, valueAccessor) {
        //	        var currentValue = valueAccessor();
        //	        jQuery(element).buttonset("option", "disabled", currentValue.enable === false);

        var value = ko.utils.unwrapObservable(valueAccessor());
        var $element = jQuery(element);
        $element.prop("disabled", !value);

        if ($element.hasClass("ui-buttonset")) {
            $element.buttonset("option", "disabled", !value);
        }

        //	        jQuery(element).buttonset("option", valueAccessor());
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
        if (options.id) element.id = options.id;

        if (!options.changeYear)
            options.changeYear = true;

        options.beforeShow = function (input, inst) {
            var calendar = inst.dpDiv;
            //attach the div right after the input box, so it works in scrolling modals
            $(input).after(calendar);
            //set timeout is a dirty hack, but we can't do anything without it because this is before it is shown. 
            setTimeout(function () {
                calendar.position({
                    my: 'left top',
                    at: 'left bottom',
                    collision: 'none',
                    of: input
                });
            }, 1);
        }

        jQuery(element).datepicker(options);

        if (optComputed.getDependenciesCount() > 0) {
            //There's at least one observable value in the jqDatepickerOptions.
            //Create a new computed that will handle applying updates.
            ko.computed({
                read: function () {
                    var opts = ko.toJS(allBindingsAccessor().jqDatepickerOptions);
                    jQuery(element).datepicker("option", opts);
                },
                disposeWhenNodeIsRemoved: element
            });
        }
        //Dispose of the initial computed because it was only needed in order to find out if there were any observables or not.
        optComputed.dispose();

        var observable = valueAccessor();
        if (ko.isObservable(observable)) {
            //handle the field changing
            ko.utils.registerEventHandler(element, "change", function () {
                var d = jQuery(element).datepicker('getDate');
                d = ko.utils.convertDateFromBrowserToServer(d);
                observable(d);
            });
            jQuery(element).datepicker("option", "onSelect", function () {
                //jQuery(element).change(); Not working for some reason
                var d = jQuery(element).datepicker('getDate');
                d = ko.utils.convertDateFromBrowserToServer(d);
                observable(d);
                //element.fireEvent && element.fireEvent('onchange') || jQuery(element)change();
            });
        }

        //handle disposal (if KO removes by the template binding)
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            jQuery(element).datepicker("destroy");
        });
    },
    //update the control when the view model changes
    update: function (element, valueAccessor) {
        var value = ko.unwrap(valueAccessor());
        //convert from server timezone (observable) to actual local timezone (in datepicker) when updating
        //if (typeof(value) != 'undefined' && value != null) alert(value + " convert to: " + ko.utils.convertDateFromServerToBrowser(value))
        value = ko.utils.convertDateFromServerToBrowser(value)
        setTimeout(function () { jQuery(element).datepicker("setDate", value) }, 0);
        ;
    }
};

/*
 		width: "7.5in",
		height: "250",
		controls: "bold italic underline | bullets numbering",
		docCSSFile: "/est/style/cleditor.css"
 */

ko.bindingHandlers.cleditor = {
    init: function (element, valueAccessor, allBindingsAccessor) {
        var observable = valueAccessor();

        //Create a computed in order to get the count of any observables used for setting options.
        var optComputed = ko.computed(function () {
            return ko.toJS(allBindingsAccessor.get("cleditorOptions") || {});
        });

        //initialize cleditor with some optional options
        var options = optComputed();
        if (options.id) element.id = options.id;

        //handle update read/write
        if (ko.isObservable(observable)) {
            options.updateTextArea = function (html) {
                observable(html);
            };
        }

        if (!options.width) {
            options.width = "7.5in";
        }
        if (!options.height) {
            options.height = "250";
        }

        if (!options.controls) {
            // currently the image and preview buttons are using in swept only,
            // when apply to EST, please update the jquery.cleditor.js v1.4.4 and below 
            if (jQuery(location).attr('href').indexOf("swept") > 0)
                options.controls = "bold italic underline | bullets numbering image preview";
            else
                options.controls = "bold italic underline | alignleft center alignright | bullets numbering";
        }
        if (!options.docCSSFile) {
            options.docCSSFile = "/est/style/cleditor.css";
        }

        jQuery(element).cleditor(options);
        //hack for image plugin, make the observable a property of the element.
        element.koBinding = observable;

        //fix to allow right-click pasting anywhere in the cleditor
        jQuery(element).siblings("iframe").each(function () {
            var height = options.height - 40;
            jQuery(this).contents().find("body").height(height);
        });

        if (optComputed.getDependenciesCount() > 0) {
            //There's at least one observable value in the cleditor.
            //Create a new computed that will handle applying updates.
            ko.computed({
                read: function () {
                    var opts = ko.toJS(allBindingsAccessor.get("cleditorOptions"));
                    jQuery(element).cleditor("option", opts);
                },
                disposeWhenNodeIsRemoved: element
            });
        }

        if (allBindingsAccessor.has("enable")) {
            var val = ko.toJS(allBindingsAccessor.get("enable"));
            jQuery(element).cleditor()[0].disable(!val);
        }

        //Dispose of the initial computed because it was only needed in order to find out if there were any observables or not.
        optComputed.dispose();

        //handle disposal (if KO removes by the template binding)
        //ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
        //    jQuery(element).datepicker("destroy");
        // });
    },

    //update the control when the view model changes
    update: function (element, valueAccessor, allBindings) {
        var el = jQuery(element);
        var newVal = ko.unwrap(valueAccessor());
        //        console.log("Update cleditor called for "+ el.attr('id') );
        // Removing this cause it is causing cursor jumping issues in IE. Bug #4966 - switching the project using the switch project option wont update the cleditor text        
        //         var alwaysUpdateFrame;
        //         if(allBindings.get("cleditorOptions")){ 
        //         alwaysUpdateFrame = allBindings.get("cleditorOptions").alwaysUpdateFrame === true 
        //         	};
        //        el.cleditor()[0].updateTextArea();

        //        if(allBindings.get("model")){
        //        	if(allBindings.get("model").permitModel.isPermitLoaded() == -1)
        //        		el.val("");
        //        }
        //       el.attr('id');
        // example in EnvironmentalPermitSetup.vm 
        //        if(allBindings.get("resetValue")){
        ////        	console.log("reset called");
        //        	allBindings.get("resetValue")();
        //        }

        // when reseting the content of cleditor binded observable set it to undefined. User action from the UI cannot make the value undefined so we can safely set the element value to empty string for frameUpdate to get called.
        if (newVal === undefined) {
            console.log("observable reset")
            el.val('');
        }
        var oldVal = el.val();

        if (oldVal != newVal) {
            setTimeout(function () {
                el.val(newVal);
                //                console.log("old val is " + oldVal)
                //                console.log( "id of cleditor " + el.attr('id'))
                //                console.log("new val is " + newVal)
                //          if this condition is not checked then cursor will jump
                if (oldVal == "" || oldVal == null) {
                    //                	 console.log("updating frame");
                    el.cleditor()[0].updateFrame();
                }

            }, 0);
        }

        if (allBindings.has("enable")) {
            var val = ko.toJS(allBindings.get("enable"));
            jQuery(element).cleditor()[0].disable(!val);
        }
    }
};

ko.bindingHandlers.jqDialog = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        if (options.autoOpen === undefined)
            options.autoOpen = options.toggle || false;
        jQuery(element).dialog(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).dialog("option", options);
        if (options.toggle && !jQuery(element).dialog("isOpen")) jQuery(element).dialog("open");
        else if (!options.toggle && jQuery(element).dialog("isOpen")) jQuery(element).dialog("close");
    }
};

ko.bindingHandlers.jqMenu = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).menu(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).menu("option", options);
    }
};

ko.bindingHandlers.jqProgressbar = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).progressbar(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).progressbar("option", options);
    }
};

ko.bindingHandlers.jqSlider = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).slider(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).slider("option", options);
    }
};

ko.bindingHandlers.jqSortable = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).sortable(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).sortable("option", options);
    }
};

ko.bindingHandlers.jqSpinner = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).spinner(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).spinner("option", options);
    }
};

ko.bindingHandlers.jqTabs = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tabs(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tabs("option", options).tabs("refresh");
    }
};

ko.bindingHandlers.jqTooltip = {
    init: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tooltip(options);
    },
    update: function (element, valueAccessor) {
        var options = ko.toJS(valueAccessor());
        jQuery(element).tooltip("option", options);
    }
};

//For binding date objects to text, thanks to http://www.aaronkjackson.com/2012/04/formatting-dates-with-knockoutjs/
//depends on date.js
ko.bindingHandlers.dateString = {
    update: function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var value = valueAccessor(),
            allBindings = allBindingsAccessor();
        var valueUnwrapped = ko.utils.unwrapObservable(value);
        var pattern = allBindings.datePattern || 'mm/dd/yy';
        var valueToWrite = "";
        if (valueUnwrapped != null) {
            if (valueUnwrapped instanceof Date && !isNaN(valueUnwrapped.valueOf())) {
                valueToWrite = jQuery.datepicker.formatDate(pattern, valueUnwrapped);
            } else {
                //it's not a date
                valueToWrite = valueUnwrapped;
            }
        }

        if (element.nodeName == "INPUT") {
            jQuery(element).val(valueToWrite);
        } else {
            jQuery(element).text(valueToWrite);
        }
    }
};

ko.bindingHandlers.fileSizeString = {
    update: function (element, valueAccessor, allBindingsAccessor, viewModel) {
        var value = valueAccessor();
        var valueUnwrapped = ko.utils.unwrapObservable(value);

        if (valueUnwrapped == null) {
            jQuery(element).text("");
        }
        else {
            var units = ["B", "KB", "MB", "GB"];
            var order = 0;
            value = valueUnwrapped;
            while (value >= 1024 && order + 1 < units.length) {
                order++;
                value = value / 1024;
            }
            //round two decimals and convert to string
            value = value.toFixed(2);
            //format with commas is highly unlikely, given that we go up to the GB range
            //but in case anyone adds a terabyte of data and we want to present it as #,###, uncomment the following
            //format with commas--first split so that we only commify the part before the decimal
            //value = value.split('.');
            //format with commas and add back the portion after the decimal, plus the units
            //value = value[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") + "." + value[1] + "&nbsp;" + units[order];
            value = value + "&nbsp;" + units[order];
            jQuery(element).html(value);
        }
    }
}


ko.bindingHandlers.selectable = {
    init: function (element, valueAccessor) {

    },
    update: function (element, valueAccessor) {

    }
};

//use to prevent binding in a particular area. Useful if you have a knockout-bound velocity component inserted within a larger data-bound area of the page
ko.bindingHandlers.stopBinding = {
    init: function () {
        return { controlsDescendantBindings: true };
    }
};
ko.virtualElements.allowedBindings.stopBinding = true;

//add a new function to the knockout observable function to test
//for null or empty/whitespace string
ko.observable.fn.isNullOrWhiteSpace = function () {
    var o = ko.utils.unwrapObservable(this);
    if (o == null) return true;
    if (typeof o == "string") {
        if (o === "") return true;
        if (o.replace(/^\s+|\s+$/g, '').length == 0) return true;
    }
    return false;
}
ko.computed.fn.isNullOrWhiteSpace = ko.observable.fn.isNullOrWhiteSpace;

//makes sure you're only typing numbers
//see http://jsfiddle.net/wmbeers/844so0q9/4/
ko.bindingHandlers.numeric = {
    init: function (element, valueAccessor) {
        var va = valueAccessor();
        var options = { allowDecimal: false, allowNegative: false, allowComma: false };

        if (va != null && typeof va == "object") {
            if (va.allowDecimal != null && typeof va.allowDecimal == "boolean") options.allowDecimal = va.allowDecimal;
            if (va.allowNegative != null && typeof va.allowNegative == "boolean") options.allowNegative = va.allowNegative;
            if (va.allowComma != null && typeof va.allowComma == "boolean") options.allowComma = va.allowComma;
        }
        $(element).on("keydown", function (event) {
            //to figure out if user has already typed a decimal or negative, while handling selection in case they're replacing text with
            //what they've typed, see what the new text would be
            var cv = element.value;
            if (element.selectionStart != element.selectionEnd) {
                cv = cv.substring(0, element.selectionStart) + cv.substring(element.selectionEnd);
            }

            // Allow: delete, backspace, tab, escape, and enter
            if (event.keyCode == 46 || event.keyCode == 8 || event.keyCode == 9 || event.keyCode == 27 || event.keyCode == 13 ||
                // Allow: Ctrl+A, Ctrl+C, Ctrl+V (TODO: need to handle pasting and drag/drop as well!)
                ((event.keyCode == 67 || event.keyCode == 65 || event.keyCode == 86) && event.ctrlKey === true) ||
                // Allow: , TODO: allow it only in the right circumstance (not one right after the other, no preceding one unless three digits back, etc.)
                (options.allowComma && event.keyCode == 188) ||
                // Allow: period (190) and decimal point (110) if allowDecimal==true and user hasn't already typed one
                (options.allowDecimal && cv.indexOf(".") == -1 && (event.keyCode == 190 || event.keyCode == 110)) ||
                // Allow: - subtract (109) or dash (189) if allowNegative == true and user hasn't already typed one
                // (note: if user has selected all the text e.g. "-3333" and types "-", that is allowed)
                (options.allowNegative && element.selectionStart == 0 && cv.indexOf("-") == -1 && (event.keyCode == 109 || event.keyCode == 189)) ||
                // Allow: home, end, left, right
                (event.keyCode >= 35 && event.keyCode <= 39)) {
                // let it happen, don't do anything
                return;
            }
            else {
                // Ensure that it is a number and stop the keypress
                if (event.shiftKey || (event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 96 || event.keyCode > 105)) {
                    event.preventDefault();
                }
            }
        });
    }
};


ko.bindingHandlers.scrollTo = {
    update: function (element, valueAccessor, allBindings) {
        var val, alignToTop = true, offset = 0;
        if (typeof valueAccessor() == "boolean") {
            //simple binding e.g. "data-bind='scrollTo: myProperty'"
            val = ko.unwrap(valueAccessor());
        } else {
            //object binding with options, e.g. "data-bind='scrollTo: {data: myProperty, alignToTop: true, offset: 100}'
            var obj = valueAccessor();
            val = obj.data;
            if (obj.alignToTop != null) alignToTop = obj.alignToTop;
            if (obj.offset != null) offset = obj.offset;
        }
        if (val) {
            console.log("scrollTo with options: alignTop: " + alignToTop + ", offset: " + offset);
            console.log("scrolling from: " + element.top);
            element.scrollIntoView(alignToTop);
            console.log("scroll into view and now at: " + window.scrollTop);
            //todo: this only works for elements that are on a whole-page-scrolling envioronment, and not contained within a scrolling portion of a page
			/*TODOif (offset != 0 && element.offsetParent) {
				element.offsetParent.scrollTop(offset);

			}*/
            window.scrollBy(0, offset);
            console.log("applied offset of " + offset + " and now at: " + window.scrollTop);
        }
    }
};


/**
 * Use instead of ko visible binding to animate elements fading in or out.
 */
ko.bindingHandlers.fadeVisible = {
    init: function (element, valueAccessor) {
        jQuery(element).toggle(ko.unwrap(valueAccessor())); // Use "unwrapObservable" so
        // we can handle values that
        // may or may not be
        // observable
    },
    update: function (element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in
        // or out
        ko.unwrap(valueAccessor()) ? jQuery(element).fadeIn() : jQuery(element)
            .fadeOut();
    }
};

//Similar to visible binding, this will use jQuery to slide the new section
//down
ko.bindingHandlers.slideVisible = {
    init: function (element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on
        // the value
        var value = valueAccessor();
        jQuery(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so
        // we can handle values that
        // may or may not be
        // observable
    },
    update: function (element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in
        // or out
        var value = valueAccessor();
        ko.unwrap(value) ? jQuery(element).slideDown() : jQuery(element)
            .slideUp();
    }
};

ko.bindingHandlers.jqTimepicker = {
    init: function (element, valueAccessor, allBindingsAccessor) {
        jQuery(element).val(ko.unwrap(valueAccessor()));
        //initialize timepicker with some optional options
        var options = allBindingsAccessor().timepickerOptions || {};
        jQuery(element).timepicker(options);

        //handle the field changing
        ko.utils.registerEventHandler(element, "time-change", function (event, time) {
            // We don't actually store a Date object, just the formatted time string.
            var observable = valueAccessor();
            observable(jQuery(element).val());
        });

        //handle disposal (if KO removes by the template binding)
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            jQuery(element).timepicker("destroy");
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

//an array of pairs of character codes of the form [character code, replacement character code]
var pairs = [[96, 39], [225, 97], [233, 101], [237, 105], [243, 111], [250, 117], [253, 121],
[193, 65], [201, 69], [205, 73], [211, 79], [218, 85], [221, 89], [227, 97],
[241, 110], [245, 111], [195, 65], [209, 78], [213, 79], [231, 99], [199, 67],
[8211, 45], [8212, 45], [8216, 39], [8217, 39], [8220, 34], [8221, 34]];
//an array of pairs of regular expression patterns and replacement strings
var substitutions = new Array();
//load multi-character substitutions
substitutions.push([new RegExp(String.fromCharCode(8230), "gm"), "..."]);
//load single-character substitutions
for (var p = 0; p < pairs.length; p++) {
    substitutions.push([new RegExp(String.fromCharCode(pairs[p][0]), "gm"), String.fromCharCode(pairs[p][1])])
}
//function replaceUnicode(event){ 
//	var src =  event.originalEvent.clipboardData.getData('text');      	
//	// global (g), multiline (m) replacements are made according to substitution array mapping.
//	for (var s = 0; s < substitutions.length; s++) {
//		src = src.replace(substitutions[s][0], substitutions[s][1]);
//	}
//	event.originalEvent.clipboardData.set
////  	return src;
//}

ko.bindingHandlers.replaceUnicode = {
    init: function (element, valueAccessor) {
        $(element).on("paste", function (event) {
            setTimeout(function () {
                var pastedText = jQuery(element).val();
                if (!pastedText) return;
                for (var s = 0; s < substitutions.length; s++) {
                    pastedText = pastedText.replace(substitutions[s][0], substitutions[s][1]);
                }
                jQuery(element).val(pastedText);
            }, 100);
        });
    }
};

ko.bindingHandlers.dataTablesForEach = {
    page: 0,
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var options = ko.unwrap(valueAccessor());
        ko.unwrap(options.data);
        if (options.dataTableOptions.paging) {
            valueAccessor().data.subscribe(function (changes) {
                var table = $(element).closest('table').DataTable();
                ko.bindingHandlers.dataTablesForEach.page = table.page();
                table.destroy();
            }, null, 'arrayChange');
        }
        var nodes = Array.prototype.slice.call(element.childNodes, 0);
        ko.utils.arrayForEach(nodes, function (node) {
            if (node && node.nodeType !== 1) {
                node.parentNode.removeChild(node);
            }
        });
        return ko.bindingHandlers.foreach.init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext);
    },
    update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        var options = ko.unwrap(valueAccessor()),
            key = 'DataTablesForEach_Initialized';
        ko.unwrap(options.data);
        var table;
        if (!options.dataTableOptions.paging) {
            table = $(element).closest('table').DataTable();
            table.destroy();
        }
        ko.bindingHandlers.foreach.update(element, valueAccessor, allBindings, viewModel, bindingContext);
        table = $(element).closest('table').DataTable(options.dataTableOptions);
        if (options.dataTableOptions.paging) {
            if (table.page.info().pages - ko.bindingHandlers.dataTablesForEach.page == 0)
                table.page(--ko.bindingHandlers.dataTablesForEach.page).draw(false);
            else
                table.page(ko.bindingHandlers.dataTablesForEach.page).draw(false);
        }
        if (!ko.utils.domData.get(element, key) && (options.data || options.length))
            ko.utils.domData.set(element, key, true);
        return { controlsDescendantBindings: true };
    }
};

ko.utils.convertDateFromServerToBrowser = function (dd) {
    if (typeof (dd) !== "undefined" && dd != null && typeof (dd.getTimezoneOffset) === "function" && typeof moment !== "undefined") {
        try {
            var offSets = moment().utcOffset() + dd.getTimezoneOffset();
            if (offSets != 0) {
                result = moment(dd).add(offSets, 'm').toDate();
                return result;
            }
        } catch (err) {
            if (console.debug) {
                console.debug("typeof dd:" + typeof dd);
                console.debug("typeof dd.getTimezoneOffset:" + typeof dd.getTimezoneOffset);
                console.debug(err);
            }
        }
    }
    return dd;
}
ko.utils.convertDateFromBrowserToServer = function (dd) {
    if (typeof (dd) !== "undefined" && dd != null && typeof (dd.getTimezoneOffset) === "function" && typeof moment !== "undefined") {
        try {
            var offSets = moment().utcOffset() + dd.getTimezoneOffset();
            if (offSets != 0) {
                result = moment(dd).subtract(offSets, 'm').toDate();
                return result;
            }
        } catch (err) {
            if (console.debug) {
                console.debug("typeof dd:" + typeof dd);
                console.debug("typeof dd.getTimezoneOffset:" + typeof dd.getTimezoneOffset);
                console.debug(err);
            }
        }
    }
    return dd;
}
