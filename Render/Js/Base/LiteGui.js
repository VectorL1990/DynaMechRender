// Temp not finished
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
    },

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

// This function is mainly for function property removement
function purgeElement(node){
    var attributeAndProperties = node.attributes;
    var attributeName;
    if (attributeAndProperties)
    {
        for (var i=0; i<attributeAndProperties.length; i++)
        {
            attributeName = attributeAndProperties[i].name;
            if (typeof node[attributeName] === 'function')
            {
                node[attributeName] = null;
            }
        }
    }

    attributeAndProperties = node.childNodes;
    if (attributeAndProperties)
    {
        for (var i=0; i<attributeAndProperties.length; i++)
        {
            purgeElement(node.childNodes[i]);
        }
    }
}

// Temp not finished
if (typeof escapeHtmlEntities == 'undefined')
{

}

// Temp not finished
function beautifyCode(code, reserved, skipCss){

}

// Temp not finished
function beautifyJSON(code, skipCss){

}

// Temp not finished
function dataRUItoBlob(dataRUI){

}

(function(){
    // Button part
    function Button(value, options){
        options = options || {};

        if (typeof(options) === "function")
        {
            options = {callback: options};
        }

        var that = this;
        var element = document.createElement("div");
        element.className = "litegui button";

        this.root = element;
        var button = document.createElement("button");
        this.content = button;
        element.appendChild(button);

        button.innerHTML = value;
        button.addEventListener("click", function(e){
            that.click();
        });

        this.click = function()
        {
            if (options.callback)
            {
                options.callback.call(that);
            }
        }
    }

    LiteGUI.Button = Button;


    // SearchBox part
    function SearchBox(value, options){
        options = options || {};
        value = value || "";
        var element = document.createElement("div");
        element.className = "litegui searchbox";
    }

    SearchBox.prototype.setValue = function(v){
        this.input.value = v;
        this.input.onchange();
    };

    SearchBox.prototype.getValue = function(){
        return this.input.value;
    }

    LiteGUI.SearchBox = SearchBox;


    // ContextMenu part
    function ContextMenu(values, options){

    }

    LiteGUI.ContextMenu = ContextMenu;
    LiteGUI.ContextualMenu = ContextMenu;


    // CheckBox part
    function CheckBox(value, bChange){

    }

    LiteGUI.CheckBox = CheckBox;


    // createLitebox part
    function createLitebox(state, bChange){

    }
    LiteGUI.createLitebox = createLitebox;


    // List part
    function List(id, items, options){

    }
    LiteGUI.List = List;


    // Slider part
    function Slider(value, options){

    }
    LiteGUI.Slider = Slider;


    // LineEditor part
    function LineEditor(value, options){

    }
    LiteGUI.LineEditor = LineEditor;


    // ComplexList part
    function ComplexList(options){

    }
    LiteGUI.ComplexList = ComplexList;

})();