
var LiteGUI = {
    root: null,
    content: null,

    panels: {},
    windows: [],

    undoSteps: [],
    modalBGDiv: null,
    mainMenu: null,

    init: function(options){
        options = options || {};
        if (options.width && options.height)
        {
            this.setWindowSize(options.width, options.height);
        }
    }

    bind: function(element, event, callback){
        if (!element)
        {
            throw("Can not bind event to null");
        }
        if (!event)
        {
            throw("bind event is null");
        }
        if (!callback)
        {
            throw("Bind callback missing");
        }

        if (element.constructor === String)
        {
            element = document.querySelectorAll(element);
        }
        if (element.constructor === NodeList || element.constructor === Array)
        {
            for (var i=0; i<element.length; ++i)
            {
                inner(element[i]);
            }
        }
        else
        {
            inner(element);
        }

        function inner(element){
            if (element.addEventListener)
            {
                element.addEventListener(event, callback);
            }
            else if (element.innerEvents)
            {
                element.innerEvents.addEventListener(event, callback);
            }
            else
            {
                var span = document.createElement("span");
                span.widget = element;
                Object.defineProperty(element, "innerEvents", {
                    enumerable: false,
                    configurable: false,
                    writable: false,
                    value: span
                });
                element.innerEvents.addEventListener(event, callback);
            }
        }
    },

    tirgger: function(element, eventName, params, origin){
        var event = document.createEvent('CustomEvent');
        event.initCustomEvent(eventName, true, true, params);
        event.srcElement = origin;
        if (element.dispatchEvent)
        {
            element.dispatchEvent(event);
        }
        else if (element.innerEvents)
        {
            element.innerEvents.dispatchEvent(event);
        }
        return event;
    },
};