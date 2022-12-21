/*
	A component container is someone who could have components attached to it.
	Mostly used for SceneNodes but it could be used for other classes (like Scene or Project).
*/

/**
* ComponentContainer class allows to add component based properties to any other class
* @class ComponentContainer
* @constructor
*/
function ComponentContainer()
{
	//this function never will be called (because only the methods are attached to other classes)
	//unless you instantiate this class directly, something that would be weird
	this._components = [];
	//this._components_by_uid = {}; //TODO
}

/*
Object.defineProperty( ComponentContainer.prototype, "components", {
	enumerable: false,
	get: function() {
		return this._components;
	},
	set: function(v) {
		throw("Components cannot be set, you must use addComponent");
	}
});
*/

/**
* Adds a component to this node.
* @method configureComponents
* @param {Object} info object containing all the info from a previous serialization
*/
ComponentContainer.prototype.configureComponents = function( info )
{
	if(!info.components)
		return;

	var to_configure = [];

	//attach first, configure later
	for(var i = 0, l = info.components.length; i < l; ++i)
	{
		var comp_info = info.components[i];
		var comp_class = comp_info[0];
		var comp = null;

		//special case: this is the only component that comes by default
		if(comp_class == "Transform" && i == 0 && this.transform) 
		{
			comp = this.transform;
		}
		else
		{
			//search for the class
			var classObject = LS.Components[ comp_class ];
			if(!classObject){
				console.error("Unknown component found: " + comp_class);
				classObject = LS.MissingComponent;
			}
			//create component
			comp = new classObject();
			//attach to node
			this.addComponent( comp );

			if( comp.constructor === LS.MissingComponent )
				comp._comp_class = comp_class;
		}

		//what about configure the comp after adding it? 
		//comp.configure( comp_info[1] );
		to_configure.push( comp, comp_info[1] );

		//HACK very special case: due to requireScript
		if( comp.constructor === LS.Components.ScriptFromFile )
			comp._filename = comp_info[1].filename;

		//editor stuff
		if( comp_info[1].editor )
			comp._editor = comp_info[1].editor;

		//ensure the component uid is stored, some components may forgot about it
		if( comp_info[1].uid && comp_info[1].uid !== comp.uid )
			comp.uid = comp_info[1].uid;
	}

	//configure components now that all of them are created
	//this is to avoid problems with components that check if the node has other components and if not they create it
	for(var i = 0, l = to_configure.length; i < l; i+=2)
	{
		var comp = to_configure[i];
		var data = to_configure[i+1];
		if(LS.catch_exceptions)
		{
			try
			{
				comp.configure( data );
			}
			catch (err)
			{
				console.error("Error found when configuring node of type ", LS.getObjectClassName(comp),", skipping. All data for this component is lost.");
				console.error(err);
			}
		}
		else
			comp.configure( data );
	}
}



/**
* Adds a component to this node.
* @method serializeComponents
* @param {Object} o container where the components will be stored
*/
ComponentContainer.prototype.serializeComponents = function( o, simplified )
{
	if(!this._components)
		return;

	o.components = [];
	for(var i = 0, l = this._components.length; i < l; ++i)
	{
		var comp = this._components[i];
		if( !comp.serialize || comp.skip_serialize )
			continue;
		var obj = comp.serialize( simplified );

		//check for bad stuff inside the component
		/*
		for(var j in obj)
		{
			var v = obj[j];
			if( !v || v.constructor === Number || v.constructor === String || v.constructor === Boolean || v.constructor === Object || v.constructor === Array ) //regular data
				continue;
			obj[j] = LS.encodeObject(v);
		}
		*/

		if(comp._editor && !simplified )
			obj.editor = comp._editor;

		//enforce uid storage
		if(comp.hasOwnProperty("_uid") && !obj.uid)
			obj.uid = comp.uid;

		var object_class = null;
		if( comp.constructor === LS.MissingComponent )
			object_class = comp._comp_class;
		else
			object_class = LS.getObjectClassName( comp );

		if( LS.debug && object_class != obj.object_class )
			console.warn("Component serialize without object_class: ", object_class );
		if(!obj.object_class)
			obj.object_class = object_class; //enforce
		
		o.components.push([ object_class, obj ]);
	}
}

/**
* returns an array with all the components
* @method getComponents
* @return {Array} all the components
*/
ComponentContainer.prototype.getComponents = function( class_type )
{
	if(class_type)
	{
		var result = [];
		if(class_type.constructor === String)
			class_type = LS.Components[class_type];
		for(var i = 0, l = this._components.length; i < l; ++i)
		{
			var compo = this._components[i];
			if( compo.constructor === class_type )
				result.push( compo );
		}
		return result;
	}

	return this._components;
}

/**
* Adds a component to this node. (maybe attach would been a better name)
* @method addComponent
* @param {Object} component
* @return {Object} component added
*/
ComponentContainer.prototype.addComponent = function( component, index )
{
	if(!component)
		throw("addComponent cannot receive null");

	//you may pass a component class instead of an instance
	if(component.constructor === String)
	{
		component = LS.Components[ component ];
		if(!component)
			throw("component class not found: " + arguments[0] );
	}
	if(component.is_component)
		component = new component();
	
	//link component with container
	component._root = this;

	//must have uid
	if( !component.uid )
		component.uid = LS.generateUId("COMP-");

	//not very clean, ComponetContainer shouldnt know about LS.SceneNode, but this is more simple
	if( component.onAddedToNode)
		component.onAddedToNode(this);

	if( this._in_tree )
	{
		if( component.uid )
			this._in_tree._components_by_uid[ component.uid ] = component;
		else
			console.warn("component without uid?", component);
		if(	component.onAddedToScene )
			component.onAddedToScene( this.constructor == LS.Scene ? this : this._in_tree );
	}

	//link node with component
	if(!this._components) 
		Object.defineProperty( this, "_components", { value: [], enumerable: false });
	if(this._components.indexOf(component) != -1)
		throw("inserting the same component twice");

	if(index !== undefined && index <= this._components.length )
		this._components.splice(index,0,component);
	else
		this._components.push( component );

	LEvent.trigger( this, "componentAdded", component );

	return component;
}

/**
* Removes a component from this node.
* @method removeComponent
* @param {Object} component
*/
ComponentContainer.prototype.removeComponent = function(component)
{
	if(!component)
		throw("removeComponent cannot receive null");

	//unlink component with container
	component._root = null;

	//not very clean, ComponetContainer shouldnt know about LS.SceneNode, but this is more simple
	if( component.onRemovedFromNode )
		component.onRemovedFromNode(this);

	if( this._in_tree )
	{
		delete this._in_tree._components_by_uid[ component.uid ];
		if(component.onRemovedFromScene)
			component.onRemovedFromScene( this._in_tree );
	}

	//remove all events
	LEvent.unbindAll(this,component);

	//remove from components list
	var pos = this._components.indexOf(component);
	if(pos != -1)
		this._components.splice(pos,1);
	else
		console.warn("removeComponent: Component not found in node");

	LEvent.trigger( this, "componentRemoved", component );
}

/**
* Removes all components from this node.
* @method removeAllComponents
* @param {Object} component
*/
ComponentContainer.prototype.removeAllComponents = function()
{
	while(this._components.length)
		this.removeComponent( this._components[0] );
}


/**
* Returns if the container has a component of this class
* @method hasComponent
* @param {String|Class} component_class the component to search for, could be a string or the class itself
*/
ComponentContainer.prototype.hasComponent = function( component_class )
{
	if(!this._components)
		return false;

	//string
	if( component_class.constructor === String )
	{
		component_class = LS.Components[ component_class ];
		if(!component_class)
			return false;
	}

	//search in components
	for(var i = 0, l = this._components.length; i < l; ++i)
		if( this._components[i].constructor === component_class )
			return true;
	
	return false;
}


/**
* Returns the first component of this container that is of the same class
* @method getComponent
* @param {Object|String} component_class the class to search a component from (could be the class or the name)
* @param {Number} index [optional] if you want the Nth component of this class
*/
ComponentContainer.prototype.getComponent = function( component_class, index )
{
	if(!this._components || !component_class)
		return null;

	//convert string to class
	if( component_class.constructor === String )
	{
		//special case, locator by name (the locator starts with an underscore if it is meant to be a name)
		if( component_class[0] == "_" ) 
		{
			component_class = component_class.substr(1); //remove underscore
			for(var i = 0, l = this._components.length; i < l; ++i)
			{
				if( this._components[i].name == component_class )
				{
					if(index !== undefined && index > 0)
					{
						index--;
						continue;
					}
					return this._components[i];
				}
			}
			return false;
		}

		//otherwise the string represents the class name
		component_class = LS.Components[ component_class ];
		if(!component_class)
			return;
	}

	//search components
	for(var i = 0, l = this._components.length; i < l; ++i)
	{
		if( this._components[i].constructor === component_class )
		{
			if(index !== undefined && index > 0)
			{
				index--;
				continue;
			}
			return this._components[i];
		}
	}

	return null;
}

/**
* Returns the component with the given uid
* @method getComponentByUId
* @param {string} uid the uid to search 
*/
ComponentContainer.prototype.getComponentByUId = function(uid)
{
	if(!this._components)
		return null;
	for(var i = 0, l = this._components.length; i < l; ++i)
		if( this._components[i].uid == uid )
			return this._components[i];
	return null;
}

/**
* Returns the position in the components array of this component
* @method getIndexOfComponent
* @param {Number} position in the array, -1 if not found
*/
ComponentContainer.prototype.getIndexOfComponent = function(component)
{
	if(!this._components)
		return -1;
	return this._components.indexOf( component );
}

/**
* Returns the component at index position
* @method getComponentByIndex
* @param {Object} component
*/
ComponentContainer.prototype.getComponentByIndex = function(index)
{
	if(!this._components)
		return null;
	return this._components[index];
}

/**
* Returns a list of components matching the search, it search in the node and child nodes
* @method findComponent
* @param {Class|String} component the component class or the class name
* @return {Array} an array with all the components of the same class
*/
ComponentContainer.prototype.findComponents = function( comp_name, out )
{
	out = out || [];
	if(!comp_name)
		return out;
	if( comp_name.constructor === String )
		comp_name = LS.Components[ comp_name ];
	if(!comp_name)
		return out;

	for(var i = 0; i < this._components.length; ++i )
	{
		var comp = this._components[i];
		if( comp && comp.constructor === comp_name )
			out.push( comp );
	}

	if(this._children)
		for(var i = 0; i < this._children.length; ++i )
			this._children[i].findComponents( comp_name, out );
	return out;
}

/**
* Changes the order of a component
* @method setComponentIndex
* @param {Object} component
*/
ComponentContainer.prototype.setComponentIndex = function( component, index )
{
	if(!this._components)
		return null;
	if(index < 0)
		index = 0;
	var old_index = this._components.indexOf( component );
	if (old_index == -1)
		return;

	this._components.splice( old_index, 1 );

	/*
	if(index >= old_index)
		index--; 
	*/
	if(index >= this._components.length)
		this._components.push( component );
	else
		this._components.splice( index, 0, component );

}


/**
* Ensures this node has a component of the specified class, if not it creates one and attaches it
* @method requireComponent
* @param {Object|String} component_class the class to search a component from (could be the class or the name)
* @param {Object} data [optional] the object to configure the component from
* @return {Component} the component found or created
*/
ComponentContainer.prototype.requireComponent = function( component_class, data )
{
	if(!component_class)
		throw("no component class specified");

	//convert string to class
	if( component_class.constructor === String )
	{
		component_class = LS.Components[ component_class ];
		if(!component_class)
		{
			console.error("component class not found:", arguments[0] );
			return null;
		}
	}

	//search component
	var l = this._components.length;
	for(var i = 0; i < l; ++i)
	{
		if( this._components[i].constructor === component_class )
			return this._components[i];
	}

	var compo = new component_class();
	this.addComponent(compo, l ); //insert before the latest scripts, to avoid situations where when partially parsed the components the component is attached but not parsed yet
	if(data)
		compo.configure(data);
	return compo;
}

/**
* Ensures this node has a ScriptFromFile component of the specified script url, if not it creates one and attaches it
* @method requireScript
* @param {String} url the url to the script
* @return {Component} the ScriptFromFile component found or created
*/
ComponentContainer.prototype.requireScript = function( url )
{
	if(!url)
		throw("no url specified");

	var component_class = LS.Components.ScriptFromFile;
	url = LS.ResourcesManager.cleanFullpath( url ); //remove double slashes or spaces

	//search component
	var l = this._components.length;
	for(var i = 0; i < l; ++i)
	{
		var comp = this._components[i];
		if( comp.constructor === component_class && comp._filename == url )
			return comp;
	}

	var compo = new component_class();
	compo.filename = url;
	this.addComponent( compo, l );
	return compo;
}

/**
* executes the method with a given name in all the components
* @method processActionInComponents
* @param {String} method_name the name of the function to execute in all components (in string format)
* @param {Array} params array with every parameter that the function may need
* @param {Boolean} skip_scripts [optional] skip scripts
*/
ComponentContainer.prototype.processActionInComponents = function( method_name, params, skip_scripts )
{
	if(this._components && this._components.length)
	{
		for(var i = 0, l = this._components.length; i < l; ++i)
		{
			var comp = this._components[i];
			if( comp[method_name] && comp[method_name].constructor === Function )
			{
				if(!params || params.constructor !== Array)
					comp[method_name].call(comp, params);
				else
					comp[method_name].apply(comp, params);
				continue;
			}

			if(skip_scripts)
				continue;

			if(comp.callMethod)
				comp.callMethod( method_name, params, true );
			else if(comp._script)
				comp._script.callMethod( method_name, params, true );
		}
	}
}

/**
* executes the method with a given name in all the components and its children
* @method broadcastMessage
* @param {String} method_name the name of the function to execute in all components (in string format)
* @param {Array} params array with every parameter that the function may need
*/
ComponentContainer.prototype.broadcastMessage = function( method_name, params )
{
	this.processActionInComponents( method_name, params );

	if(this._children && this._children.length )
		for(var i = 0, l = this._children.length; i < l; ++i)
			this._children[i].broadcastMessage( method_name, params );
}






///@INFO: BASE
/*
*  Components are elements that attach to Nodes or other objects to add functionality
*  Some important components are Transform, Light or Camera
*
*	*  ctor: must accept an optional parameter with the serialized data
*	*  onAddedToNode: triggered when added to node
*	*  onRemovedFromNode: triggered when removed from node
*	*  onAddedToScene: triggered when the node is added to the scene
*	*  onRemovedFromScene: triggered when the node is removed from the scene
*	*  serialize: returns a serialized version packed in an object
*	*  configure: recieves an object to unserialize and configure this instance
*	*  getResources: adds to the object the resources to load
*	*  _root contains the node where the component is added
*
*	*  use the LEvent system to hook events to the node or the scene
*	*  never share the same component instance between two nodes
*
*/

/**
* This is an example class for a component, should never be instantiated by itself, 
* instead components get all the methods from this class attached when the component is registered.
* Components can overwrite this methods if they want.
*
* @class  BaseComponent
* @namespace  LS
*/
function BaseComponent(o)
{
	if(o)
		this.configure(o);
}

/**
* Returns the node where this components is attached
* @method getRootNode
**/
BaseComponent.prototype.getRootNode = function()
{
	return this._root;
}

/**
* Configures the components based on an object that contains the serialized info
* @method configure
* @param {Object} o object with the serialized info
**/
BaseComponent.prototype.configure = function(o)
{ 
	if( !o )
		return;
	if( o.uid ) 
		this.uid = o.uid;
	LS.cloneObject( o, this, false, true, true ); 

	if( this.onConfigure )
		this.onConfigure( o );
}

/**
* Returns an object with all the info about this component in an object form
* @method serialize
* @return {Object} object with the serialized info
**/
BaseComponent.prototype.serialize = function()
{
	var o = LS.cloneObject(this,null,false,false,true);
	if(this.uid) //special case, not enumerable
		o.uid = this.uid;
	if(!o.object_class)
		o.object_class = LS.getObjectClassName( this );

	if( this.onSerialize )
		this.onSerialize( o );

	return o;
}

/**
* Create a clone of this node (the UID is removed to avoid collisions)
* @method clone
* @return {*} component clone
**/
BaseComponent.prototype.clone = function()
{
	var data = this.serialize();
	data.uid = null; //remove id when cloning
	var new_component = new this.constructor( data );
	return new_component;
}

/**
* To create a new property for this component adding some extra useful info to help the editor
* @method createProperty
* @param {String} name the name of the property as it will be accessed
* @param {*} value the value to assign by default to this property
* @param {String|Object} type [optional] an string identifying the type of the variable, could be "number","string","Texture","vec3","mat4", or an object with all the info
* @param {Function} setter [optional] setter function, otherwise one will be created
* @param {Function} getter [optional] getter function, otherwise one will be created
**/
BaseComponent.prototype.createProperty = function( name, value, type, setter, getter )
{
	if(this[name] !== undefined)
		return; //console.warn("createProperty: this component already has a property called " + name );

	//if we have type info, we must store it in the constructor, useful for GUIs
	if(type)
	{
		//control errors
		if(type == "String" || type == "Number" || type == "Boolean")
		{
			console.warn("createProperty: Basic types must be in lowercase -> " + type );
			type = type.toLowerCase();
		}

		if( typeof(type) == "object" )
			this.constructor[ "@" + name ] = type;
		else
			this.constructor[ "@" + name ] = { type: type };

		//is a component
		if( type == LS.TYPES.COMPONENT || LS.Components[ type ] || type.constructor.is_component || type.type == LS.TYPES.COMPONENT )
		{
			var property_root = this; //with proto is problematic, because the getters cannot do this.set (this is the proto, not the component)
			var private_name = "_" + name;
			Object.defineProperty( property_root, name, {
				get: function() { 
					if( !this[ private_name ] )
						return null;
					var scene = this._root && this._root.scene ? this._root._in_tree : LS.GlobalScene;
					return LSQ.get( this[ private_name ], null, scene );
				},
				set: function(v) { 
					if(!v)
						this[ private_name ] = v;
					else
						this[ private_name ] = v.constructor === String ? v : v.uid;
				},
				enumerable: true
				//writable: false //cannot be set to true if setter/getter
			});

			if( LS.Components[ type ] || type.constructor.is_component ) //passing component class name or component class constructor
				type = { type: LS.TYPES.COMPONENT, component_class: type.constructor === String ? type : LS.getClassName( type ) };

			if( typeof(type) == "object" )
				this.constructor[ "@" + name ] = type;
			else
				this.constructor[ "@" + name ] = { type: type };
			return;
		}
	}

	//basic type
	if(  (value === null || value === undefined || value.constructor === Number || value.constructor === String || value.constructor === Boolean) && !setter && !getter )
	{
		this[ name ] = value;
		return;
	}

	var private_name = "_" + name;

	if( Object.hasOwnProperty( this, private_name ) )
		return;


	var property_root = this; //with proto is problematic, because the getters cannot do this.set (this is the proto, not the component)

	//vector type has special type with setters and getters to avoid replacing the container during assignations
	if(value && value.constructor === Float32Array)
	{
		value = new Float32Array( value ); //clone
		this[ private_name ] = value; //this could be removed...

		//create setter
		Object.defineProperty( property_root, name, {
			get: getter || function() { return value; },
			set: setter || function(v) { value.set( v ); },
			enumerable: true
			//writable: false //cannot be set to true if setter/getter
		});
	}
	else //this is for vars that has their own setter/getter
	{
		//define private (writable because it can be overwriten with different values)
		Object.defineProperty( property_root, private_name, { 
			value: value, 
			enumerable: false,
			writable: true 
		});

		var that = this;

		//define public
		Object.defineProperty( property_root, name, {
			get: getter || function() { 
				return this[ private_name ];
			},
			set: setter || function(v) { 
				this[ private_name ] = v;
			},
			enumerable: true
			//writable: false //cannot be set to true if setter/getter
		});
	}
}

//not finished
BaseComponent.prototype.createAction = function( name, callback, options )
{
	if(!callback)
		console.error("action '" + name + "' with no callback associated. Remember to create the action after the callback is defined.");
	var safe_name = name.replace(/ /gi,"_"); //replace spaces
	this[ safe_name ] = callback;
	this.constructor["@" + safe_name ] = options || { type: "function", button_text: name, widget:"button", callback: callback };
}


/**
* Returns the locator string of this component
* @method getLocator
* @param {string} property_name [optional] you can pass the name of a property in this component
* @return {String} the locator string of this component
**/
BaseComponent.prototype.getLocator = function( property_name )
{
	if(!this._root)
		return "";
	if(property_name)
	{
		if(this[ property_name ] === undefined )
			console.warn("No property found in this component with that name:",property_name);
		return this._root.uid + "/" + this.uid + "/" + property_name;
	}
	return this._root.uid + "/" + this.uid;
}

BaseComponent.prototype.getPropertyInfoFromPath = function( path )
{
	if( !path.length )
		return null;

	var v;
	var varname = path[0];

	//to know the value of a property of the given target
	if( this.getPropertyValue )
		v = this.getPropertyValue( varname );

	//special case when the component doesnt specify any locator info but the property referenced does
	//used in TextureFX
	if (v === undefined && path.length > 1 && this[ varname ] && this[ varname ].getPropertyInfoFromPath )
	{
		var r = this[ varname ].getPropertyInfoFromPath( path.slice(1) );
		if(r)
		{
			r.node = this.root;
			return r;
		}
	}

	if( v === undefined && Object.hasOwnProperty( this, varname ) )//this[ varname ] === undefined )
		return null;

	//if we dont have a value yet then take it directly from the object
	var value = v !== undefined ? v : this[ varname ];

	var extra_info = this.constructor[ "@" + varname ];
	var type = "";
	if(extra_info)
		type = extra_info.type;
	if(!type && value !== null && value !== undefined)
	{
		if(value.constructor === String)
			type = "string";
		else if(value.constructor === Boolean)
			type = "boolean";
		else if(value.length)
			type = "vec" + value.length;
		else if(value.constructor === Number)
			type = "number";
	}

	return {
		node: this.root,
		target: this,
		name: varname,
		value: value,
		type: type
	};	
}

/**
* calls a method in all components in this node and all the children nodes
* @method broadcastMessage
* @param {String} method_name 
* @param {*} data
**/
BaseComponent.prototype.broadcastMessage = function( method_name, data )
{
	var node = this._root;
	if(!node)
		return;
	node.broadcastMessage( method_name, data );
}

/**
* returns the first component of type class_name of the SceneNode where this component belongs
* @method getComponent
* @param {String|Component} class_name the name of the class in string format or the component class itself
* @return {*} Component or null
**/
BaseComponent.prototype.getComponent = function( class_name )
{
	if(!this._root)
		return null;
	return this._root.getComponent( class_name );
}

/**
* Bind one object event to a method in this component
* @method bind
* @param {*} object the dispatcher of the event you want to react to
* @param {String} event the name of the event to bind to
* @param {Function} callback the callback to call
* @param {String|Object} type [optional] an string identifying the type of the variable, could be "number","string","Texture","vec3","mat4", or an object with all the info
* @param {Function} setter [optional] setter function, otherwise one will be created
* @param {Function} getter [optional] getter function, otherwise one will be created
**/
BaseComponent.prototype.bind = function( object, method, callback )
{
	var instance = this;
	if(arguments.length > 3 )
	{
		console.error("Component.bind cannot use a fourth parameter, all callbacks will be binded to the component");
		return;
	}

	if(!object)
	{
		console.error("Cannot bind to null.");
		return;
	}

	if(!callback)
	{
		console.error("You cannot bind a method before defining it.");
		return;
	}

	/*
	var found = false;
	for(var i in this)
	{
		if(this[i] == callback)
		{
			found = true;
			break;
		}
	}
	if(!found)
		console.warn("Callback function not found in this object, this is dangerous, remember to unbind it manually or use LEvent instead.");
	*/

	//store info about which objects have events pointing to this instance
	if(!this.__targeted_instances)
		Object.defineProperty( this,"__targeted_instances", { value: [], enumerable: false, writable: true });
	var index = this.__targeted_instances.indexOf( object );
	if(index == -1)
		this.__targeted_instances.push( object );

	return LEvent.bind( object, method, callback, instance );
}

BaseComponent.prototype.unbind = function( object, method, callback )
{
	var instance = this;

	var r = LEvent.unbind( object, method, callback, instance );

	//erase from targeted instances
	if( this.__targeted_instances )
	{
		if( !LEvent.hasBindTo( object, this ) )
			return r;

		var index = this.__targeted_instances.indexOf( object );
		if(index == -1)
			this.__targeted_instances.splice( index, 1 );
		if(this.__targeted_instances.length == 0)
			delete this.__targeted_instances;
	}

	return r;
}

BaseComponent.prototype.unbindAll = function()
{
	if( !this.__targeted_instances )
		return;

	for( var i = 0; i < this.__targeted_instances.length; ++i )
		LEvent.unbindAll( this.__targeted_instances[i], this );
	this.__targeted_instances = null; //delete dont work??
}

//called by register component to add setters and getters to registered Component Classes
BaseComponent.addExtraMethods = function( component )
{
	//add uid property
	Object.defineProperty( component.prototype, 'uid', {
		set: function( uid )
		{
			if(!uid)
				return;

			if(uid[0] != LS._uid_prefix)
			{
				console.warn("Invalid UID, renaming it to: " + uid );
				uid = LS._uid_prefix + uid;
			}

			if(uid == this._uid)
				return;
			//if( this._root && this._root._components_by_uid[ this.uid ] )
			//	delete this._root && this._root._components_by_uid[ this.uid ];
			this._uid = uid;
			//if( this._root )
			//	this._root && this._root._components_by_uid[ this.uid ] = this;
		},
		get: function(){
			return this._uid;
		},
		enumerable: false //uid better not be enumerable (so it doesnt show in the editor)
	});

	Object.defineProperty( component.prototype, 'root', {
		set: function(v)
		{
			throw("root cannot be set, call addComponent to the root");
		},
		get: function(){
			return this._root;
		},
		enumerable: false //uid better not be enumerable (so it doesnt show in the editor)
	});

	//same as root...
	Object.defineProperty( component.prototype, 'parentNode', {
		set: function()
		{
			throw("parentNode cannot be set, call addComponent to the parentNode");
		},
		get: function(){
			return this._root;
		},
		enumerable: false //uid better not be enumerable (so it doesnt show in the editor)
	});

};






///@INFO: BASE
/**
* The Scene contains all the info about the Scene and nodes
*
* @class Scene
* @constructor
*/

//event definitions for scene
EVENT.INIT = "init";
EVENT.CLEAR = "clear";
EVENT.PRECONFIGURE = "preConfigure";
EVENT.CONFIGURE = "configure";
EVENT.CHANGE = "change";
EVENT.BEFORE_LOAD = "beforeLoad";
EVENT.LOAD = "load";
EVENT.LOAD_COMPLETED = "load_completed";
EVENT.BEFORE_RELOAD = "beforeReload";
EVENT.RELOAD = "reload";
EVENT.AWAKE = "awake";
EVENT.START = "start";
EVENT.PAUSE = "pause";
EVENT.UNPAUSE = "unpause";
EVENT.FINISH = "finish";
EVENT.BEFORE_UPDATE = "before_update";
EVENT.UPDATE = "update";
EVENT.FIXED_UPDATE = "fixedUpdate";
EVENT.AFTER_UPDATE = "afterUpdate";
EVENT.COLLECT_RENDER_INSTANCES = "collectRenderInstances";
EVENT.COLLECT_PHYSIC_INSTANCES = "collectPhysicInstances";
EVENT.COLLECT_LIGHTS = "collectLights";
EVENT.COLLECT_CAMERAS = "collectCameras";
EVENT.COLLECT_DATA = "collectData";
EVENT.SERIALIZE = "serialize";
EVENT.NODE_ADDED = "nodeAdded";
EVENT.NODE_REMOVED = "nodeRemoved";
EVENT.REQUEST_FRAME = "requestFrame";



function Scene()
{
	this.uid = LS.generateUId("TREE-");

	this._state = LS.STOPPED;

	this._root = new LS.SceneNode("root");
	this._root.removeAllComponents();
	this._root._is_root  = true;
	this._root._in_tree = this;
	this._nodes = [ this._root ];
	this._nodes_by_name = { "root" : this._root };
	this._nodes_by_uid = {};
	this._nodes_by_uid[ this._root.uid ] = this._root;
	this._components_by_uid = {};

	//used to stored info when collecting from nodes
	this._uniforms = {};
	this._instances = [];
	this._lights = [];
	this._cameras = [];
	this._colliders = [];
	this._reflection_probes = [];

	//MOST OF THE PARAMETERS ARE CREATED IN init() METHOD

	//in case the resources base path are located somewhere else, if null the default is used
	this.external_repository = null;

	//work in progress, not finished yet. This will contain all the objects in cells
	this._spatial_container = new LS.SpatialContainer();

	this.external_scripts = []; //external scripts that must be loaded before initializing the scene (mostly libraries used by this scene) they do not have access to the data in the scene
	this.global_scripts = []; //scripts that are located in the resources folder and must be loaded before launching the app. they have access to the scene data
	this.preloaded_resources = {}; //resources that must be loaded, appart from the ones in the components

	//track with global animations of the scene
	this.animation = null;

	//FEATURES NOT YET FULLY IMPLEMENTED
	this._local_resources = {}; //used to store resources that go with the scene
	this.texture_atlas = null;

	this.layer_names = ["main","secondary"];

	LEvent.bind( this, "treeItemAdded", this.onNodeAdded, this );
	LEvent.bind( this, "treeItemRemoved", this.onNodeRemoved, this );

	this._shaderblock_info = null;

	this.init();
}

//LS.extendClass( Scene, ComponentContainer ); //scene could also have components

Object.defineProperty( Scene.prototype, "root", {
	enumerable: true,
	get: function() {
		return this._root;
	},
	set: function(v) {
		throw("Root node cannot be replaced");
	}
});

Object.defineProperty( Scene.prototype, "time", {
	enumerable: true,
	get: function() {
		return this._time;
	},
	set: function(v) {
		throw("Cannot set time directly");
	}
});

Object.defineProperty( Scene.prototype, "state", {
	enumerable: true,
	get: function() {
		return this._state;
	},
	set: function(v) {
		throw("Cannot set state directly, use start, finish, pause, unpause");
	}
});

Object.defineProperty( Scene.prototype, "globalTime", {
	enumerable: true,
	get: function() {
		return this._global_time;
	},
	set: function(v) {
		throw("Cannot set global_time directly");
	}
});

Object.defineProperty( Scene.prototype, "frame", {
	enumerable: true,
	get: function() {
		return this._frame;
	},
	set: function(v) {
		throw("Cannot set frame directly");
	}
});

//Some useful events
Scene.supported_events = [LS.EVENT.START,LS.EVENT.UPDATE,LS.EVENT.FINISH,LS.EVENT.CLEAR,LS.EVENT.BEFORE_RELOAD,LS.EVENT.CHANGE,EVENT.AFTER_RENDER,LS.EVENT.CONFIGURE,EVENT.NODE_ADDED,"nodeChangeParent","nodeComponentRemoved",LS.EVENT.RELOAD,"renderPicking","scene_loaded",LS.EVENT.SERIALIZE];

//methods

/**
* This initializes the content of the scene.
* Call it to clear the scene content
*
* @method init
* @return {Boolean} Returns true on success
*/
Scene.prototype.init = function()
{
	this.id = "";
	//this.materials = {}; //shared materials cache: moved to LS.RM.resources
	this.external_repository = null;

	this.global_scripts = [];
	this.external_scripts = [];
	this.preloaded_resources = {};
	this.texture_atlas = null;

	this._root.removeAllComponents();
	this._root.uid = LS.generateUId("NODE-");

	this._nodes = [ this._root ];
	this._nodes_by_name = { "root": this._root };
	this._nodes_by_uid = {};
	this._nodes_by_uid[ this._root.uid ] = this._root;
	this._components_by_uid = {};

	//WIP
	this._spatial_container.clear();

	//default components
	this.info = new LS.Components.GlobalInfo();
	this._root.addComponent( this.info );
	this._root.addComponent( new LS.Camera({ eye:[0,100,100], center:[0,0,0]} ) );
	this._root.addComponent( new LS.Light({ position: vec3.fromValues(100,100,100), target: vec3.fromValues(0,0,0) }) );

	this._frame = 0;
	this._last_collect_frame = -1; //force collect
	this._state = LS.STOPPED;

	this._time = 0;
	this._global_time = 0; //in seconds
	this._start_time = 0; //in seconds
	this._last_dt = 1/60; //in seconds
	this._must_redraw = true;
	this._fixed_update_timestep = 1/60;
	this._remaining_fixed_update_time = 0;

	if(this.selected_node) 
		delete this.selected_node;

	this.layer_names = ["main","secondary"];
	this.animation = null;
	this._local_resources = {}; //not used yet
	this.extra = {};
}

/**
* Clears the scene using the init function
* and trigger a "clear" LEvent
*
* @method clear
*/
Scene.prototype.clear = function()
{
	//remove all nodes to ensure no lose callbacks are left
	while(this._root._children && this._root._children.length)
		this._root.removeChild(this._root._children[0], false, true ); //recompute_transform, remove_components

	//remove scene components
	this._root.processActionInComponents("onRemovedFromNode",this); //send to components
	this._root.processActionInComponents("onRemovedFromScene",this); //send to components

	this._instances.length = 0;
	this._lights.length = 0;
	this._cameras.length = 0;
	this._colliders.length = 0;
	this._reflection_probes.length = 0;
	this._local_resources = {};

	this.init();
	/**
	 * Fired when the whole scene is cleared
	 *
	 * @event clear
	 */
	LEvent.trigger(this, EVENT.CLEAR );
	LEvent.trigger(this, EVENT.CHANGE );
}

/**
* Configure the Scene using an object (the object can be obtained from the function serialize)
* Inserts the nodes, configure them, and change the parameters
* ATTENTION: Destroys all previously existing info
*
* @method configure
* @param {Object} scene_info the object containing all the info about the nodes and config of the scene
*/
Scene.prototype.configure = function( scene_info )
{
	if(!scene_info || scene_info.constructor === String)
		throw("Scene configure requires object");

	LEvent.trigger(this, EVENT.PRECONFIGURE, scene_info);

	this._root.removeAllComponents(); //remove light, camera, skybox

	//this._components = [];
	//this.camera = this.light = null; //legacy

	if(scene_info.uid)
		this.uid = scene_info.uid;

	if((scene_info.object_class || scene_info.object_type) != "Scene") //legacy
		console.warn("Warning: object set to scene doesnt look like a propper one.", scene_info);

	if(scene_info.external_repository)
		this.external_repository = scene_info.external_repository;

	//extra info that the user wanted to save (comments, etc)
	if(scene_info.extra)
		this.extra = scene_info.extra;

	//this clears all the nodes
	if(scene_info.root)
	{
		this._spatial_container.clear(); // is this necessary? never used
		//two passes configure, first nodes, then components, in case a component requires a node
		var pending_components = []; 
		//components info could store data about other nodes/components, better catch it in case they are created later during the process
		LS._pending_encoded_objects = [];
		this._root.configure( scene_info.root, pending_components );
		for(var i = 0; i < pending_components.length; i+=2)
			pending_components[i].configureComponents( pending_components[i+1] );
		LS.resolvePendingEncodedObjects();
	}

	if( scene_info.global_scripts )
		this.global_scripts = scene_info.global_scripts.concat();

	if( scene_info.external_scripts )
		this.external_scripts = scene_info.external_scripts.concat();

	if( scene_info.preloaded_resources )
		this.preloaded_resources = LS.cloneObject( scene_info.preloaded_resources );

	if( scene_info.local_resources )
		this._local_resources = scene_info.local_resources;

	if( scene_info.layer_names )
		this.layer_names = scene_info.layer_names.concat();

	if( scene_info.animation )
		this.animation = new LS.Animation( scene_info.animation );

	//if(scene_info.components)
	//	this.configureComponents( scene_info );

	if( scene_info.editor )
		this._editor = scene_info.editor;

	if( scene_info.texture_atlas )
		this.texture_atlas = scene_info.texture_atlas;

	/**
	 * Fired after the scene has been configured
	 * @event configure
	 * @param {Object} scene_info contains all the info to do the configuration
	 */
	LEvent.trigger(this, EVENT.CONFIGURE,scene_info);
	LEvent.trigger(this, EVENT.AWAKE );
	/**
	 * Fired when something changes in the scene
	 * @event change
	 * @param {Object} scene_info contains all the info to do the configuration
	 */
	LEvent.trigger(this, EVENT.CHANGE );
}

/**
* Creates and object containing all the info about the scene and nodes.
* The oposite of configure.
* It calls the serialize method in every node
*
* @method serialize
* @return {Object} return a JS Object with all the scene info
*/

Scene.prototype.serialize = function( simplified  )
{
	var o = {};

	o.version = LS.Version;

	o.uid = this.uid;
	o.object_class = LS.getObjectClassName(this);

	o.external_repository = this.external_repository;

	//o.nodes = [];
	o.extra = this.extra || {};

	//add nodes
	o.root = this.root.serialize( false, simplified );

	if(this.animation)
		o.animation = this.animation.serialize();

	o.layer_names = this.layer_names.concat();
	o.global_scripts = this.global_scripts.concat();
	o.external_scripts = this.external_scripts.concat();
	o.preloaded_resources = LS.cloneObject( this.preloaded_resources );
	o.texture_atlas = LS.cloneObject( this.texture_atlas );
	o.local_resources = LS.cloneObject( this._local_resources );

	if( this._editor )
		o.editor = this._editor;

	//this.serializeComponents( o );

	/**
	 * Fired after the scene has been serialized to an object
	 * @event serialize
	 * @param {Object} object to store the persistent info
	 */
	LEvent.trigger(this,EVENT.SERIALIZE,o);

	return o;
}


/**
* Assigns a scene from a JSON description (or WBIN,ZIP)
*
* @method setFromJSON
* @param {String} data JSON object containing the scene
* @param {Function}[on_complete=null] the callback to call when the scene is ready
* @param {Function}[on_error=null] the callback to call if there is a  loading error
* @param {Function}[on_progress=null] it is called while loading the scene info (not the associated resources)
* @param {Function}[on_resources_loaded=null] it is called when all the resources had been loaded
* @param {Function}[on_scripts_loaded=null] the callback to call when the loading is complete but before assigning the scene
*/

Scene.prototype.setFromJSON = function( data, on_complete, on_error, on_progress, on_resources_loaded, on_scripts_loaded )
{
	if(!data)
		return;

	var that = this;

	if(data.constructor === String)
	{
		try
		{
			data = JSON.parse( data );
		}
		catch (err)
		{
			console.log("Error: " + err );
			return;
		}
	}

	var scripts = LS.Scene.getScriptsList( data, true );
	this.external_scripts = data.external_scripts; //must be copyed before, because it is used inside loadScripts to check origin 

	//check JSON for special scripts
	if ( scripts.length )
		this.loadScripts( scripts, function(){ inner_success( data ); }, inner_error );
	else
		inner_success( data );

	function inner_success( response )
	{
		if(on_scripts_loaded)
			on_scripts_loaded(that,response);

		that.init();
		that.configure(response);

		if( that.texture_atlas )
			LS.RM.loadTextureAtlas( that.texture_atlas, inner_preloaded_all );
		else
			inner_preloaded_all();
	}

	function inner_preloaded_all()
	{
		that.loadResources( inner_all_loaded );
		/**
		 * Fired when the scene has been loaded but before the resources
		 * @event load
		 */
		LEvent.trigger(that, EVENT.LOAD );

		if(!LS.ResourcesManager.isLoading())
			inner_all_loaded();

		if(on_complete)
			on_complete(that);
	}

	function inner_all_loaded()
	{
		if(on_resources_loaded)
			on_resources_loaded(that);
		/**
		 * Fired after all resources have been loaded
		 * @event loadCompleted
		 */
		LEvent.trigger( that, EVENT.LOAD_COMPLETED );
	}

	function inner_error(err,script_url)
	{
		console.error("Error loading script: " + script_url);
		if(on_error)
			on_error(err);
	}
}


/**
* Loads a scene from a relative url pointing to a JSON description (or WBIN,ZIP)
* Warning: this url is not passed through the LS.ResourcesManager so the url is absolute
*
* @method load
* @param {String} url where the JSON object containing the scene is stored
* @param {Function}[on_complete=null] the callback to call when the loading is complete
* @param {Function}[on_error=null] the callback to call if there is a  loading error
* @param {Function}[on_progress=null] it is called while loading the scene info (not the associated resources)
* @param {Function}[on_resources_loaded=null] it is called when all the resources had been loaded
*/

Scene.prototype.load = function( url, on_complete, on_error, on_progress, on_resources_loaded, on_loaded )
{
	if(!url)
		return;

	var that = this;

	var extension = LS.ResourcesManager.getExtension( url );
	var format_info = LS.Formats.getFileFormatInfo( extension );
	if(!format_info) //hack, to avoid errors
		format_info = { dataType: "json" };

	//request scene file using our own library
	LS.Network.request({
		url: url,
		nocache: true,
		dataType: extension == "json" ? "json" : (format_info.dataType || "text"), //datatype of json is text...
		success: extension == "json" ? inner_json_loaded : inner_data_loaded,
		progress: on_progress,
		error: inner_error
	});

	this._state = LS.LOADING;

	/**
	 * Fired before loading scene
	 * @event beforeLoad
	 */
	LEvent.trigger(this,EVENT.BEFORE_LOAD);

	function inner_data_loaded( response )
	{
		//process whatever we loaded (in case it is a pack)
		LS.ResourcesManager.processResource( url, response, null, inner_data_processed );
	}

	function inner_data_processed( pack_url, pack )
	{
		if(!pack)
			return;

		//for DAEs
		if( pack.object_class == "Scene")
		{
			inner_json_loaded( pack );
			return;
		}
		else if( pack.object_class == "SceneNode") 
		{
			var root = pack.serialize();
			inner_json_loaded( { object_class: "Scene", root: root } );
			return;
		}

		//for packs
		if( !pack._data || !pack._data["scene.json"] )
		{
			console.error("Error loading PACK, doesnt look like it has a valid scene inside");
			return;
		}
		var scene = JSON.parse( pack._data["scene.json"] );

		inner_json_loaded( scene );
	}

	function inner_json_loaded( response )
	{
		if( response.constructor !== Object )
			throw("response must be object");

		var scripts = LS.Scene.getScriptsList( response, true );

		//check JSON for special scripts
		if ( scripts.length )
			that.loadScripts( scripts, function(){ inner_success(response); }, on_error );
		else
			inner_success( response );
	}

	function inner_success( response )
	{
		if(on_loaded)
			on_loaded(that, url);

		that.init();
		that.configure(response);

		if(on_complete)
			on_complete(that, url);

		that.loadResources( inner_all_loaded );
		LEvent.trigger(that, EVENT.LOAD );

		if(!LS.ResourcesManager.isLoading())
			inner_all_loaded();
	}

	function inner_all_loaded()
	{
		if(on_resources_loaded)
			on_resources_loaded(that, url);
		LEvent.trigger(that, EVENT.LOAD_COMPLETED );
	}

	function inner_error(e)
	{
		var err_code = (e && e.target) ? e.target.status : 0;
		console.warn("Error loading scene: " + url + " -> " + err_code);
		if(on_error)
			on_error(url, err_code, e);
	}
}


/**
* Loads a scene from a relative url pointing to a JSON description (or WBIN,ZIP)
* It uses the resources folder as the root folder (in comparison with the regular load function)
*
* @method loadFromResources
* @param {String} url where the JSON object containing the scene is stored
* @param {Function}[on_complete=null] the callback to call when the loading is complete
* @param {Function}[on_error=null] the callback to call if there is a  loading error
* @param {Function}[on_progress=null] it is called while loading the scene info (not the associated resources)
* @param {Function}[on_resources_loaded=null] it is called when all the resources had been loaded
*/
Scene.prototype.loadFromResources = function( url, on_complete, on_error, on_progress, on_resources_loaded )
{
	url = LS.ResourcesManager.getFullURL( url );
	this.load( url, on_complete, on_error, on_progress, on_resources_loaded );
}



/**
* Static method, returns a list of all the scripts that must be loaded, in order and with the full path
*
* @method Scene.getScriptsList
* @param {Scene|Object} scene the object containing info about the scripts (could be a scene or a JSON object)
* @param {Boolean} allow_local if we allow local resources
* @param {Boolean} full_paths if true it will return the full path to every resource
*/
Scene.getScriptsList = function( scene, allow_local, full_paths )
{
	if(!scene)
		throw("Scene.getScriptsList: scene cannot be null");

	var scripts = [];
	if ( scene.external_scripts && scene.external_scripts.length )
		scripts = scripts.concat( scene.external_scripts );
	if ( scene.global_scripts && scene.global_scripts.length )
	{
		for(var i in scene.global_scripts)
		{
			var script_url = scene.global_scripts[i];
			if(!script_url || LS.ResourcesManager.getExtension( script_url ) != "js" )
				continue;

			var res = LS.ResourcesManager.getResource( script_url );
			if(res)
			{
				if( allow_local )
					script_url = LS.ResourcesManager.cleanFullpath( script_url );
			}

			if(full_paths)
				script_url = LS.ResourcesManager.getFullURL( script_url );

			scripts.push( script_url );
		}
	}

	scripts = scripts.map(function(a){ return a.trim(); }); //careful with spaces

	return scripts;
}

//reloads external and global scripts taking into account if they come from wbins
Scene.prototype.loadScripts = function( scripts, on_complete, on_error, force_reload )
{
	if(!LS.allow_scripts)
	{
		console.error("LiteScene.allow_scripts is set to false, so scripts imported into this scene are ignored.");
		if(on_complete)
			on_complete();
		return;
	}

	//get a list of scripts (they cannot be fullpaths)
	scripts = scripts || LS.Scene.getScriptsList( this, true );

	if(!scripts.length)
	{
		if(on_complete)
			on_complete();
		return;
	}

	if( LS._block_scripts )
	{
		console.error("Safety: LS.block_scripts enabled, cannot request script");
		return;
	}

	//All this is to allow the use of scripts that are in memory (they came packed inside a WBin with the scene)
	var final_scripts = [];
	var revokable = [];

	for(var i in scripts)
	{
		var script_url = scripts[i];
		var is_external = this.external_scripts.indexOf( script_url ) != -1;
		if( !is_external ) //comes from scene.external_scripts
		{
			var res = LS.ResourcesManager.getResource( script_url );
			if(!res || force_reload)
			{
				var final_url = LS.ResourcesManager.getFullURL( script_url );
				final_scripts.push( final_url );
				continue;
			}

			//we use blobs because we have the data locally but we need to load it from an url (the script loader works like that)
			var blob = new Blob([res.data],{encoding:"UTF-8", type: 'text/plain;charset=UTF-8'});
			var objectURL = URL.createObjectURL( blob );
			final_scripts.push( objectURL );
			revokable.push( objectURL );
		}
		else
			final_scripts.push( script_url );
	}

	LS.Network.requestScript( final_scripts, inner_complete, on_error );

	function inner_complete()
	{
		//revoke urls created
		for(var i in revokable)
			URL.revokeObjectURL( revokable[i] );

		if(on_complete)
			on_complete();
	}
}

//used to ensure that components use the right class when the class comes from a global script
Scene.prototype.checkComponentsCodeModification = function()
{
	for(var i = 0; i < this._nodes.length; ++i )
	{
		//current components
		var node = this._nodes[i];
		for(var j = 0; j < node._components.length; ++j)
		{
			var compo = node._components[j];
			var class_name = LS.getObjectClassName( compo );
			if( compo.constructor == LS.MissingComponent )
				class_name = compo._comp_class;

			var current_class = LS.Components[ class_name ];
			if( !current_class || current_class == compo.constructor ) //already uses the right class
				continue;

			//replace class instance in-place
			var data = compo.serialize();
			var new_compo = new current_class( data );
			var index = node.getIndexOfComponent( compo );
			node.removeComponent( compo );
			node.addComponent( new_compo, index );
			console.log("Class replaced: " + class_name );
		}
	}
}

Scene.prototype.appendScene = function(scene)
{
	//clone: because addNode removes it from scene.nodes array
	var nodes = scene.root.childNodes;

	/*
	//bring materials
	for(var i in scene.materials)
		this.materials[i] = scene.materials[i];
	*/
	
	//add every node one by one
	for(var i in nodes)
	{
		var node = nodes[i];
		var new_node = new LS.SceneNode( node.id );
		this.root.addChild( new_node );
		new_node.configure( node.constructor == LS.SceneNode ? node.serialize() : node  );
	}
}

Scene.prototype.getCamera = function()
{
	var camera = this._root.camera;
	if(camera) 
		return camera;

	if(this._cameras && this._cameras.length)
		return this._cameras[0];

	this.collectData(); //slow
	return this._cameras[0];
}

/**
* Returns an array with all the cameras enabled in the scene
*
* @method getActiveCameras
* @param {boolean} force [optional] if you want to collect the cameras again, otherwise it returns the last ones collected
* @return {Array} cameras
*/
Scene.prototype.getActiveCameras = function( force )
{
	if(force)
		LEvent.trigger(this, EVENT.COLLECT_CAMERAS, this._cameras );
	return this._cameras;
}

/**
* Returns an array with all the cameras in the scene (even if they are disabled)
*
* @method getAllCameras
* @return {Array} cameras
*/
Scene.prototype.getAllCameras = function()
{
	var cameras = [];
	for(var i = 0; i < this._nodes.length; ++i)
	{
		var node = this._nodes[i];
		var node_cameras = node.getComponents( LS.Components.Camera );
		if(node_cameras && node_cameras.length)
			cameras = cameras.concat( node_cameras );
	}
	return cameras;
}

Scene.prototype.getLight = function()
{
	return this._root.light;
}

/**
* Returns an array with all the lights enabled in the scene
*
* @method getActiveLights
* @param {boolean} force [optional] if you want to collect the lights again, otherwise it returns the last ones collected
* @return {Array} lights
*/
Scene.prototype.getActiveLights = function( force )
{
	if(force)
		LEvent.trigger(this, EVENT.COLLECT_LIGHTS, this._lights );
	return this._lights;
}

Scene.prototype.onNodeAdded = function(e,node)
{
	//remove from old scene
	if(node._in_tree && node._in_tree != this)
		throw("Cannot add a node from other scene, clone it");

	if( node._name && !this._nodes_by_name[ node._name ] )
		this._nodes_by_name[ node._name ] = node;

	/*
	//generate unique id
	if(node.id && node.id != -1)
	{
		if(this._nodes_by_id[node.id] != null)
			node.id = node.id + "_" + (Math.random() * 1000).toFixed(0);
		this._nodes_by_id[node.id] = node;
	}
	*/

	//store by uid
	if(!node.uid || this._nodes_by_uid[ node.uid ])
		node._uid = LS.generateUId("NODE-");
	//if( this._nodes_by_uid[ node.uid ] )
	//	console.warn("There are more than one node with the same UID: ", node.uid );
	this._nodes_by_uid[ node.uid ] = node;

	//store nodes linearly
	this._nodes.push(node);

	node.processActionInComponents("onAddedToScene",this); //send to components
	for(var i = 0; i < node._components.length; ++i)
		if(node._components[i].uid)
			this._components_by_uid[ node._components[i].uid ] = node._components[i];
		else
			console.warn("component without uid?", node._components[i].uid );

	/**
	 * Fired when a new node is added to this scene
	 *
	 * @event nodeAdded
	 * @param {LS.SceneNode} node
	 */
	LEvent.trigger(this, EVENT.NODE_ADDED, node);
	LEvent.trigger(this, EVENT.CHANGE );
}

Scene.prototype.onNodeRemoved = function(e,node)
{
	var pos = this._nodes.indexOf(node);
	if(pos == -1) 
		return;

	this._nodes.splice(pos,1);
	if(node._name && this._nodes_by_name[ node._name ] == node )
		delete this._nodes_by_name[ node._name ];
	if(node.uid)
		delete this._nodes_by_uid[ node.uid ];

	//node.processActionInComponents("onRemovedFromNode",node);
	node.processActionInComponents("onRemovedFromScene",this); //send to components
	for(var i = 0; i < node._components.length; ++i)
		delete this._components_by_uid[ node._components[i].uid ];

	/**
	 * Fired after a node has been removed
	 *
	 * @event nodeRemoved
	 * @param {LS.SceneNode} node
	 */
	LEvent.trigger(this, EVENT.NODE_REMOVED, node);
	LEvent.trigger(this, EVENT.CHANGE );
	return true;
}

/**
* all nodes are stored in an array, this function recomputes the array so they are in the right order in case one has changed order
*
* @method recomputeNodesArray
*/
Scene.prototype.recomputeNodesArray = function()
{
	var nodes = this._nodes;
	var pos = 0;
	inner( this._root );

	function inner(node)
	{
		nodes[pos] = node;
		pos+=1;
		if(!node._children || !node._children.length)
			return;
		for(var i = 0; i < node._children.length; ++i)
			inner( node._children[i] );
	}
}

//WIP
Scene.prototype.attachSceneElement = function( element )
{
	this._spatial_container.add( element );
}

Scene.prototype.detachSceneElement = function( element )
{
	this._spatial_container.remove( element );
}


/**
* Returns the array containing all the nodes in the scene
*
* @method getNodes
* @param {bool} recompute [optional] in case you want to rearrange the nodes
* @return {Array} array containing every SceneNode in the scene
*/
Scene.prototype.getNodes = function( recompute )
{
	if(recompute)
		this.recomputeNodesArray();
	return this._nodes;
}

/**
* retrieves a Node based on the name, path ( name|childname|etc ) or uid
*
* @method getNode
* @param {String} name node name to search
* @return {Object} the node or null if it didnt find it
*/
Scene.prototype.getNode = function( name )
{
	if(name == "")
		return this.root;
	if(!name || name.constructor !== String)
		return null;
	if(name.charAt(0) == LS._uid_prefix)
		return this._nodes_by_uid[ name ];

	// the | char is used to specify a node child of another node
	if( name.indexOf("|") != -1)
	{
		var tokens = name.split("|");
		var node = this.root; //another option could be to start in this._nodes_by_name[ tokens[0] ]
		for(var i = 0; i < tokens.length && node; ++i)
			node = node.getChildByName( tokens[i] );
		return node;
	}

	return this._nodes_by_name[ name ];
}

/**
* retrieves a Node that matches that name. It is fast because they are stored in an object.
* If more than one object has the same name, the first one added to the tree is returned
*
* @method getNodeByName
* @param {String} name name of the node
* @return {Object} the node or null if it didnt find it
*/
Scene.prototype.getNodeByName = function( name )
{
	return this._nodes_by_name[ name ];
}

/**
* retrieves a Node based on a given uid. It is fast because they are stored in an object
*
* @method getNodeByUId
* @param {String} uid uid of the node
* @return {Object} the node or null if it didnt find it
*/
Scene.prototype.getNodeByUId = function( uid )
{
	return this._nodes_by_uid[ uid ];
}

/**
* retrieves a Node by its index
*
* @method getNodeByIndex
* @param {Number} node index
* @return {Object} returns the node at the 'index' position in the nodes array
*/
Scene.prototype.getNodeByIndex = function(index)
{
	return this._nodes[ index ];
}

//for those who are more traditional
Scene.prototype.getElementById = Scene.prototype.getNode;

/**
* retrieves a node array filtered by the filter function
*
* @method filterNodes
* @param {function} filter a callback function that receives every node and must return true or false
* @return {Array} array containing the nodes that passes the filter
*/
Scene.prototype.filterNodes = function( filter )
{
	var r = [];
	for(var i = 0; i < this._nodes.length; ++i)
		if( filter(this._nodes[i]) )
			r.push(this._nodes[i]);
	return r;
}

/**
* searches the component with this uid, it iterates through all the nodes and components (slow)
*
* @method findComponentByUId
* @param {String} uid uid of the node
* @return {Object} component or null
*/
Scene.prototype.findComponentByUId = function(uid)
{
	for(var i = 0; i < this._nodes.length; ++i)
	{
		var compo = this._nodes[i].getComponentByUId( uid );
		if(compo)
			return compo;
	}
	return null;
}

/**
* searches the material with this uid, it iterates through all the nodes (slow)
*
* @method findMaterialByUId
* @param {String} uid uid of the material
* @return {Object} Material or null
*/
Scene.prototype.findMaterialByUId = function(uid)
{
	if(LS.RM.materials[uid])
		return LS.RM.materials[uid];

	for(var i = 0; i < this._nodes.length; ++i)
	{
		var material = this._nodes[i].getMaterial();
		if(material && material.uid == uid)
			return material;
	}

	return null;
}


/**
* Returns information of a node component property based on the locator of that property
* Locators are in the form of "{NODE_UID}/{COMPONENT_UID}/{property_name}"
*
* @method getPropertyInfo
* @param {String} locator locator of the property
* @return {Object} object with node, component, name, and value
*/
Scene.prototype.getPropertyInfo = function( property_uid )
{
	var path = property_uid.split("/");

	var start = path[0].substr(0,5);

	//for resources
	if( start == "@RES-")
	{
		var filename = LS.ResourcesManager.convertLocatorToFilename(path[0]);
		var resource = LS.ResourcesManager.getResource(filename);
		if(path.length == 1)
			return resource;
		if(resource && resource.getPropertyInfoFromPath)
			return resource.getPropertyInfoFromPath( path.slice(1) );
		return null;
	}

	//for global materials
	if( start == "@MAT-")
	{
		var material = LS.RM.materials_by_uid[ path[0] ];
		if(!material)
			return null;
		return material.getPropertyInfoFromPath( path.slice(1) );
	}

	//for components
	if( start == "@COMP")
	{
		var comp = this.findComponentByUId( path[0] );
		if(!comp)
			return null;
		if(path.length == 1)
			return {
				node: comp.root,
				target: comp,
				name: comp ? LS.getObjectClassName( comp ) : "",
				type: "component",
				value: comp
			};
		return comp.getPropertyInfoFromPath( path.slice(1) );
	}

	//for regular locators
	var node = this.getNode( path[0] );
	if(!node)
		return null;

	return node.getPropertyInfoFromPath( path.slice(1) );
}

/**
* Returns information of a node component property based on the locator of that property
* Locators are in the form of "{NODE_UID}/{COMPONENT_UID}/{property_name}"
*
* @method getPropertyInfoFromPath
* @param {Array} path
* @return {Object} object with node, component, name, and value
*/
Scene.prototype.getPropertyInfoFromPath = function( path )
{
	var start = path[0].substr(0,5);
	//for resources
	if( start == "@RES-")
	{
		var filename = LS.ResourcesManager.convertLocatorToFilename(path[0]);
		var resource = LS.ResourcesManager.getResource(filename);
		if(path.length == 1)
			return resource;
		if(resource && resource.getPropertyInfoFromPath)
			return resource.getPropertyInfoFromPath( path.slice(1) );
		return null;
	}

	if(start == "@MAT-")
	{
		var material = LS.RM.materials_by_uid[ path[0] ];
		if(!material)
			return null;
		return material.getPropertyInfoFromPath( path.slice(1) );
	}

	var node = this.getNode( path[0] );
	if(!node)
		return null;
	return node.getPropertyInfoFromPath( path.slice(1) );
}


/**
* returns the value of a property given its locator
*
* @method getPropertyValue
* @param {String} locator locator of the property
* @param {*} value the value to assign
* @param {SceneNode} root [Optional] if you want to limit the locator to search inside a node
* @return {Component} the target where the action was performed
*/
Scene.prototype.getPropertyValue = function( locator, root_node )
{
	var path = locator.split("/");
	if(root_node)
		return root_node.getPropertyValueFromPath( path );
	return this.getPropertyValueFromPath( path );
}

Scene.prototype.getPropertyValueFromPath = function( path )
{
	var start = path[0].substr(0,5);

	if( start == "@RES-")
	{
		var filename = LS.ResourcesManager.convertLocatorToFilename(path[0]);
		var resource = LS.ResourcesManager.getResource(filename);
		if(path.length == 1)
			return resource;
		if(resource && resource.getPropertyInfoFromPath)
			return resource.getPropertyInfoFromPath( path.slice(1) );
		return null;
	}

	if(start == "@MAT-")
	{
		var material = LS.RM.materials_by_uid[ path[0] ];
		if(!material)
			return null;
		return material.getPropertyValueFromPath( path.slice(1) );
	}
	var node = this.getNode( path[0] );
	if(!node)
		return null;
	return node.getPropertyValueFromPath( path.slice(1) );
}

/**
* Assigns a value to the property of a component in a node based on the locator of that property
* Locators are in the form of "{NODE_UID}/{COMPONENT_UID}/{property_name}"
*
* @method setPropertyValue
* @param {String} locator locator of the property
* @param {*} value the value to assign
* @param {SceneNode} root [Optional] if you want to limit the locator to search inside a node
* @return {Component} the target where the action was performed
*/
Scene.prototype.setPropertyValue = function( locator, value, root_node )
{
	var path = locator.split("/");
	this.setPropertyValueFromPath( path, value, root_node, 0 );
}

/**
* Assigns a value to the property of a component in a node based on the locator that property
* Locators are in the form of "{NODE_UID}/{COMPONENT_UID}/{property_name}"
*
* @method setPropertyValueFromPath
* @param {Array} path a property locator split by "/"
* @param {*} value the value to assign
* @param {SceneNode} root_node [optional] the root node where you want to search the locator (this is to limit the locator to a branch of the scene tree)
* @param {Number} offset [optional] used to avoir generating garbage, instead of slicing the array every time, we pass the array index
* @return {Component} the target where the action was performed
*/
Scene.prototype.setPropertyValueFromPath = function( path, value, root_node, offset )
{
	offset = offset || 0;
	if(path.length < (offset+1))
		return;

	var start = path[offset].substr(0,5);

	if( start == "@RES-")
	{
		var filename = LS.ResourcesManager.convertLocatorToFilename(path[0]);
		var resource = LS.ResourcesManager.getResource(filename);
		if(path.length == 1)
		{
			console.warn("assigning a value to a locator with only the name of a resource doesn't make any sense");
			return null; 
		}
		if( resource && resource.setPropertyValueFromPath )
			return resource.setPropertyValueFromPath( path, value, offset + 1 );
		return null;
	}

	if(start == "@MAT-")
	{
		var material = LS.RM.materials_by_uid[ path[offset] ];
		if(!material)
			return null;
		return material.setPropertyValueFromPath( path, value, offset + 1 );
	}

	//get node
	var node = null;
	if( root_node )
	{
		var name = path[offset];
		if( name.indexOf("|") != -1)
		{
			var tokens = name.split("|");
			var node = root_node;
			for(var i = 0; i < tokens.length && node; ++i)
				node = node.getChildByName( tokens[i] );
		}
		else
			node = root_node.findNode( path[offset] );
	}
	else
		node = this.getNode( path[offset] );

	if(!node)
		return null;

	return node.setPropertyValueFromPath( path, value, offset + 1 );
}


/**
* Returns the resources used by the scene
* includes the nodes, components, preloads and global_scripts
* doesn't include external_scripts
*
* @method getResources
* @param {Object} resources [optional] object with resources
* @param {Boolean} as_array [optional] returns data in array format instead of object format
* @param {Boolean} skip_in_pack [optional] skips resources that come from a pack
* @param {Boolean} skip_local [optional] skips resources whose name starts with ":" (considered local resources)
* @return {Object|Array} the resources in object format (or if as_array is true, then an array)
*/
Scene.prototype.getResources = function( resources, as_array, skip_in_pack, skip_local )
{
	resources = resources || {};

	//to get the resources as array
	var array = null;
	if(resources.constructor === Array)
	{
		array = resources;
		resources = {};
		as_array = true;
	}

	//first the preload
	//resources that must be preloaded (because they will be used in the future)
	if(this.preloaded_resources)
		for(var i in this.preloaded_resources)
			resources[ i ] = true;

	if(this.texture_atlas)
		resources[ this.texture_atlas.filename ] = true;

	//global scripts
	for(var i = 0; i < this.global_scripts.length; ++i)
		if( this.global_scripts[i] )
			resources[ this.global_scripts[i] ] = true;

	//resources from nodes
	for(var i = 0; i < this._nodes.length; ++i)
		this._nodes[i].getResources( resources );

	//remove the resources that belong to packs or prefabs
	if(skip_in_pack)
		for(var i in resources)
		{
			var resource = LS.ResourcesManager.resources[i];
			if(!resource)
				continue;
			if(resource && (resource.from_prefab || resource.from_pack))
				delete resources[i];
		}

	//remove the resources that are local (generated by the system)
	if(skip_local)
		for(var i in resources)
		{
			if(i[0] == ":")
				delete resources[i];
		}

	//check if any resource requires another resource (a material that requires textures)
	for(var i in resources)
	{
		var resource = LS.ResourcesManager.resources[i];
		if(!resource)
			continue;
		if(resource.getResources)
			resource.getResources(resources);
	}

	//Hack: sometimes some component add this shit
	delete resources[""];
	delete resources["null"];

	//return as object
	if(!as_array)
		return resources;

	//return as array
	var r = array || [];
	for(var i in resources)
		r.push(i);
	return r;
}

/**
* Loads all the resources of all the nodes in this scene
* it sends a signal to every node to get all the resources info
* and load them in bulk using the ResourceManager
*
* @method loadResources
* @param {Function} on_complete called when the load of all the resources is complete
*/
Scene.prototype.loadResources = function( on_complete )
{
	//resources is an object format
	var resources = this.getResources([]);

	//used for scenes with special repository folders
	var options = {};
	if( this.external_repository )
		options.external_repository = this.external_repository;

	//count resources
	var num_resources = 0;
	for(var i in resources)
		++num_resources;

	//load them
	if(num_resources == 0)
	{
		if(on_complete)
			on_complete();
		return;
	}

	LEvent.bind( LS.ResourcesManager, "end_loading_resources", on_loaded );
	LS.ResourcesManager.loadResources( resources );

	function on_loaded()
	{
		LEvent.unbind( LS.ResourcesManager, "end_loading_resources", on_loaded );
		if(on_complete)
			on_complete();
	}
}


/**
* Adds a resource that must be loaded when the scene is loaded
*
* @method addPreloadResource
* @param {String} fullpath the name of the resource
*/
Scene.prototype.addPreloadResource = function( fullpath )
{
	this.preloaded_resources[ fullpath ] = true;
}

/**
* Remove a resource from the list of resources to preload
*
* @method removePreloadResource
* @param {String} fullpath the name of the resource
*/
Scene.prototype.removePreloadResource = function( fullpath )
{
	delete this.preloaded_resources[ fullpath ];
}


/**
* start the scene (triggers an "start" event)
*
* @method start
* @param {Number} dt delta time
*/
Scene.prototype.start = function()
{
	if(this._state == LS.PLAYING)
		return;

	this._state = LS.PLAYING;
	this._start_time = getTime() * 0.001;
	/**
	 * Fired when the nodes need to be initialized
	 *
	 * @event init
	 * @param {LS.Scene} scene
	 */
	LEvent.trigger(this, EVENT.INIT, this);
	this.triggerInNodes( EVENT.INIT );
	/**
	 * Fired when the scene is starting to play
	 *
	 * @event start
	 * @param {LS.Scene} scene
	 */
	LEvent.trigger(this, EVENT.START ,this);
	this.triggerInNodes( EVENT.START );
}

/**
* pauses the scene (triggers an "pause" event)
*
* @method pause
*/
Scene.prototype.pause = function()
{
	if( this._state != LS.PLAYING )
		return;

	this._state = LS.PAUSED;
	/**
	 * Fired when the scene pauses (mostly in the editor)
	 *
	 * @event pause
	 * @param {LS.Scene} scene
	 */
	LEvent.trigger(this, EVENT.PAUSE,this);
	this.triggerInNodes( EVENT.PAUSE );
	this.purgeResidualEvents();
}

/**
* unpauses the scene (triggers an "unpause" event)
*
* @method unpause
*/
Scene.prototype.unpause = function()
{
	if(this._state != LS.PAUSED)
		return;

	this._state = LS.PLAYING;
	/**
	 * Fired when the scene unpauses (mostly in the editor)
	 *
	 * @event unpause
	 * @param {LS.Scene} scene
	 */
	LEvent.trigger(this, EVENT.UNPAUSE,this);
	this.triggerInNodes( EVENT.UNPAUSE );
	this.purgeResidualEvents();
}


/**
* stop the scene (triggers an "finish" event)
*
* @method finish
* @param {Number} dt delta time
*/
Scene.prototype.finish = function()
{
	if(this._state == LS.STOPPED)
		return;

	this._state = LS.STOPPED;
	/**
	 * Fired when the scene stops playing
	 *
	 * @event finish
	 * @param {LS.Scene} scene
	 */
	LEvent.trigger(this, EVENT.FINISH,this);
	this.triggerInNodes( EVENT.FINISH );
	this.purgeResidualEvents();
}

/**
* This methods crawls the whole tree and collects all the useful info (cameras, lights, render instances, colliders, etc)
* Mostly rendering stuff but also some collision info.
* TO DO: refactor this so it doesnt redo the same task in every frame, only if changes are made
* @param {Array} cameras [optional] an array of cameras in case we want to force some viewpoint
* @method collectData
*/
Scene.prototype.collectData = function( cameras )
{
	var instances = this._instances;
	var lights = this._lights;
	var colliders = this._colliders;

	//empty containers
	instances.length = 0;
	lights.length = 0;
	colliders.length = 0;

	//first collect cameras (in case we want to filter nodes by proximity to camera
	if(!cameras || cameras.length == 0)
	{
		cameras = this._cameras;
		cameras.length = 0;
		LEvent.trigger( this, EVENT.COLLECT_CAMERAS, cameras );
	}

	//get nodes: TODO find nodes close to the active cameras
	var nodes = this.getNodes();

	//collect render instances and lights
	for(var i = 0, l = nodes.length; i < l; ++i)
	{
		var node = nodes[i];

		//skip stuff inside invisible nodes
		if(node.flags.visible == false) 
			continue;

		//compute global matrix: shouldnt it be already computed?
		if(node.transform)
			node.transform.updateGlobalMatrix();

		//clear instances per node: TODO: if static maybe just leave it as it is
		node._instances.length = 0;

		//get render instances: remember, triggers only support one parameter
		LEvent.trigger( node, EVENT.COLLECT_RENDER_INSTANCES, node._instances );
		LEvent.trigger( node, EVENT.COLLECT_PHYSIC_INSTANCES, colliders );

		//concatenate all instances in a single array
		instances.push.apply(instances, node._instances);
	}

	//we also collect from the scene itself (used for lights, skybox, etc)
	LEvent.trigger( this, EVENT.COLLECT_RENDER_INSTANCES, instances );
	LEvent.trigger( this, EVENT.COLLECT_PHYSIC_INSTANCES, colliders );
	LEvent.trigger( this, EVENT.COLLECT_LIGHTS, lights );

	//before processing (in case somebody wants to add some data to the containers)
	LEvent.trigger( this, EVENT.COLLECT_DATA );

	//for each render instance collected
	for(var i = 0, l = instances.length; i < l; ++i)
	{
		var instance = instances[i];

		//compute the axis aligned bounding box
		if(instance.use_bounding)
			instance.updateAABB();
	}

	//for each physics instance collected
	for(var i = 0, l = colliders.length; i < l; ++i)
	{
		var collider = colliders[i];
		collider.updateAABB();
	}

	//remember when was last time I collected to avoid repeating it
	this._last_collect_frame = this._frame;
}

/**
* updates the scene (it handles variable update and fixedUpdate)
*
* @method update
* @param {Number} dt delta time in seconds
*/
Scene.prototype.update = function(dt)
{
	/**
	 * Fired before doing an update
	 *
	 * @event beforeUpdate
	 * @param {LS.Scene} scene
	 */
	LEvent.trigger(this,LS.EVENT.BEFORE_UPDATE, this);

	this._global_time = getTime() * 0.001;
	//this._time = this._global_time - this._start_time;
	this._time += dt;
	this._last_dt = dt;

	/**
	 * Fired while updating
	 *
	 * @event update
	 * @param {number} dt
	 */
	LEvent.trigger(this, LS.EVENT.UPDATE, dt);

	/**
	 * Fired while updating but using a fixed timestep (1/60)
	 *
	 * @event fixedUpdate
	 * @param {number} dt
	 */
	if(this._fixed_update_timestep > 0)
	{
		this._remaining_fixed_update_time += dt;
		if(LEvent.hasBind(this, LS.EVENT.FIXED_UPDATE))
			while( this._remaining_fixed_update_time > this._fixed_update_timestep )
			{
				LEvent.trigger(this, LS.EVENT.FIXED_UPDATE, this._fixed_update_timestep );
				this._remaining_fixed_update_time -= this._fixed_update_timestep;
			}
		else
			this._remaining_fixed_update_time = this._remaining_fixed_update_time % this._fixed_update_timestep;
	}

	/**
	 * Fired after updating the scene
	 *
	 * @event afterUpdate
	 */
	LEvent.trigger(this, LS.EVENT.AFTER_UPDATE, this);
}

/**
* triggers an event to all nodes in the scene
* this is slow if the scene has too many nodes, thats why we use bindings
*
* @method triggerInNodes
* @param {String} event_type event type name
* @param {Object} data data to send associated to the event
*/

Scene.prototype.triggerInNodes = function(event_type, data)
{
	LEvent.triggerArray( this._nodes, event_type, data);
}

/**
* generate a unique node name given a prefix
*
* @method generateUniqueNodeName
* @param {String} prefix the prefix, if not given then "node" is used
* @return {String} a node name that it is not in the scene
*/
Scene.prototype.generateUniqueNodeName = function(prefix)
{
	prefix = prefix || "node";
	var i = 1;

	var pos = prefix.lastIndexOf("_");
	if(pos)
	{
		var n = prefix.substr(pos+1);
		if( parseInt(n) )
		{
			i = parseInt(n);
			prefix = prefix.substr(0,pos);
		}
	}

	var node_name = prefix + "_" + i;
	while( this.getNode(node_name) != null )
		node_name = prefix + "_" + (i++);
	return node_name;
}

/**
* Marks that this scene must be rendered again
*
* @method requestFrame
*/
Scene.prototype.requestFrame = function()
{
	this._must_redraw = true;
	LEvent.trigger( this, LS.EVENT.REQUEST_FRAME );
}

Scene.prototype.refresh = Scene.prototype.requestFrame; //DEPRECATED

/**
* returns current scene time (remember that scene time remains freezed if the scene is not playing)
*
* @method getTime
* @return {Number} scene time in seconds
*/
Scene.prototype.getTime = function()
{
	return this._time;
}

//This is ugly but sometimes if scripts fail there is a change the could get hooked to the scene forever
//so this way we remove any event that belongs to a component thats doesnt belong to this scene tree
Scene.prototype.purgeResidualEvents = function()
{
	if(!this.__events)
		return;

	//crawl all 
	for(var i in this.__events)
	{
		var event = this.__events[i];
		if(!event)
			continue;
		var to_keep = [];
		for(var j = 0; j < event.length; ++j)
		{
			var inst = event[j][1];
			if(inst && LS.isClassComponent( inst.constructor ) )
			{
				//no attached node or node not attached to any scene
				if(!inst._root || inst._root.scene !== this )
				{
					console.warn("Event attached to the Scene belongs to a removed node, purged. Event:",i,"Class:", LS.getObjectClassName( inst ) );
					continue; //skip keeping it, so it will no longer exist
				}
			}
			to_keep.push(event[j]);
		}
		this.__events[i] = to_keep;
	}
}

/**
* returns an array with the name of all the layers given a layers mask
*
* @method getLayerNames
* @param {Number} layers a number with the enabled layers in bit mask format, if ommited all layers are returned
* @return {Array} array of strings with the layer names
*/
Scene.prototype.getLayerNames = function(layers)
{
	var r = [];

	for(var i = 0; i < 32; ++i)
	{
		if( layers === undefined || layers & (1<<i) )
			r.push( this.layer_names[i] || ("layer"+i) );
	}
	return r;
}

/**
* returns an array with all the components in the scene and scenenodes that matches this class
*
* @method findNodeComponents
* @param {String||Component} type the type of the components to search (could be a string with the name or the class itself)
* @return {Array} array with the components found
*/
Scene.prototype.findNodeComponents = function( type )
{
	if(!type)
		return;

	var find_component = null;
	if(type.constructor === String)
		find_component = LS.Components[ type ];
	else
		find_component = type;
	if(!find_component)
		return;

	var result = [];
	var nodes = this._nodes;
	for(var i = 0; i < nodes.length; ++i)
	{
		var node = nodes[i];
		var components = node._components;
		for(var j = 0; j < components.length; ++j)
			if( components[j].constructor === find_component )
				result.push( components[j] );
	}
	return result;
}

/**
* Allows to instantiate a prefab from the fullpath of the resource
*
* @method instantiate
* @param {String} prefab_url the filename to the resource containing the prefab
* @param {vec3} position where to instantiate
* @param {quat} rotation the orientation
* @param {SceneNode} parent [optional] if no parent then scene.root will be used
* @return {SceneNode} the resulting prefab node
*/
Scene.prototype.instantiate = function( prefab_url, position, rotation, parent )
{
	if(!prefab_url || prefab_url.constructor !== String)
		throw("prefab must be the url to the prefab");

	var node = new LS.SceneNode();
	if(position && position.length === 3)
		node.transform.position = position;
	if(rotation && rotation.length === 4)
		node.transform.rotation = rotation;

	parent = parent || this.root;
	parent.addChild( node );

	node.prefab = prefab_url;

	return node;
}

/**
* returns a pack containing all the scene and resources, used to save a scene to harddrive
*
* @method toPack
* @param {String} fullpath a given fullpath name, it will be assigned to the scene with the appropiate extension
* @param {Array} resources [optional] array with all the resources to add, if no array is given it will get the active resources in this scene
* @return {LS.Pack} the pack
*/
Scene.prototype.toPack = function( fullpath, resources )
{
	fullpath = fullpath || "unnamed_scene";

	//change name to valid name
	var basename = LS.RM.removeExtension( fullpath, true );
	var final_fullpath = basename + ".SCENE.wbin";

	//extract json info
	var scene_json = JSON.stringify( this.serialize() );

	//get all resources
	if(!resources)
		resources = this.getResources( null, true, true, true );

	//create pack
	var pack = LS.Pack.createPack( LS.RM.getFilename( final_fullpath ), resources, { "scene.json": scene_json } );
	pack.fullpath = final_fullpath;
	pack.category = "Scene";

	return pack;
}

//WIP: this is in case we have static nodes in the scene
Scene.prototype.updateStaticObjects = function()
{
	var old = LS.allow_static;
	LS.allow_static = false;
	this.collectData();
	LS.allow_static = old;
}

/**
* search for the nearest reflection probe to the point
*
* @method findNearestReflectionProbe
* @param {vec3} position
* @return {LS.ReflectionProbe} the reflection probe
*/
Scene.prototype.findNearestReflectionProbe = function( position )
{
	if(!this._reflection_probes.length)
		return null;

	if( this._reflection_probes.length == 1 )
		return this._reflection_probes[0];

	var probes = this._reflection_probes;
	var min_dist = 1000000;
	var nearest_probe = null;
	for(var i = 0; i < probes.length; ++i)
	{
		var probe = probes[i];
		var dist = vec3.squaredDistance( position, probe._position );
		if( dist > min_dist )
			continue;
		min_dist = dist;
		nearest_probe = probe;
	}
	return nearest_probe;
}


//tells to all the components, nodes, materials, etc, that one resource has changed its name so they can update it inside
Scene.prototype.sendResourceRenamedEvent = function( old_name, new_name, resource )
{
	//scene globals that use resources
	for(var i = 0; i < this.external_scripts.length; i++)
	{
		if(this.external_scripts[i] == old_name)
			this.external_scripts[i] = new_name;
	}

	for(var i = 0; i < this.global_scripts.length; i++)
	{
		if(this.global_scripts[i] == old_name)
			this.global_scripts[i] = new_name;
	}

	for(var i in this.preloaded_resources)
	{
		if(i == old_name)
		{
			delete this.preloaded_resources[old_name];
			this.preloaded_resources[ new_name ] = true;
		}
	}

	if( this.texture_atlas && this.texture_atlas.filename == old_name )
		this.texture_atlas.filename = new_name;

	//to nodes
	var nodes = this._nodes.concat();

	//for every node
	for(var i = 0; i < nodes.length; i++)
	{
		//nodes
		var node = nodes[i];

		//prefabs
		if( node.prefab && node.prefab === old_name )
			node.prefab = new_name; //does this launch a reload prefab? dont know

		//components
		for(var j = 0; j < node._components.length; j++)
		{
			var component = node._components[j];
			if(component.onResourceRenamed)
				component.onResourceRenamed( old_name, new_name, resource );
			else //automatic
			{
				for(var k in component)
				{
					if(component[k] != old_name )
						continue;
					var propinfo = component.constructor["@" + k];
					if(!propinfo)
						continue;
					var type = propinfo.type || propinfo.widget;
					if(type && (type == LS.TYPES.RESOURCE || LS.ResourceClasses[ type ])) //is a resource
						component[k] = new_name;
				}
			}
		}

		//materials
		if( node.material )
		{
			if( node.material == old_name )
				node.material = new_name;
			else
			{
				var material = node.getMaterial();
				if( material && material.onResourceRenamed )
				{
					var modified = material.onResourceRenamed( old_name, new_name, resource );
					if(modified) //we need this to remove material._original_data or anything that could interfiere
						LS.RM.resourceModified( material );
				}
				else
					console.warn("sendResourceRenamedEvent: Material not found or it didnt have a onResourceRenamed");
			}
		}
	}
}

//used to search a resource according to the data path of this scene
Scene.prototype.getDataPath = function( path )
{
	path = path || "";
	var folder = this.extra.data_folder || this.extra.folder;
	return LS.RM.cleanFullpath( folder + "/" + path );
}


/**
* Creates and returns an scene animation track
*
* @method createAnimation
* @return {LS.Animation} the animation track
*/
Scene.prototype.createAnimation = function()
{
	if(this.animation)
		return this.animation;
	this.animation = new LS.Animation();
	this.animation.name = LS.Animation.DEFAULT_SCENE_NAME;
	this.animation.createTake( "default", LS.Animation.DEFAULT_DURATION );
	return this.animation;
}



