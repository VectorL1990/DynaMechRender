
function SceneNode (name)
{
  if (name && name.constructor !== String)
  {
    name = null;
    console.warn("SceneNode constructor must be a string with name");
  }

  this._name = name || ("node_" + (Math.random() * 10000).toFixed(0));

}

SceneNode.prototype.init = function (keep_components, keep_info)
{
  if (!keep_info)
  {
  }
}

SceneNode.prototype.clear = function ()
{
}

SceneNode.prototype.setName = function (new_name)
{
}

SceneNode.prototype.destroy = function (time)
{
}

SceneNode.prototype.getLocator = function (property_name)
{ }

SceneNode.prototype.getPropertyInfo = function (locator)
{ }

SceneNode.prototype.getPropertyInfoFromPath = function (path)
{ }

/**
* Returns the value of a property given a locator in string format
* @method getPropertyValue
* @param {String} locaator
* @return {*} the value of that property
**/
SceneNode.prototype.getPropertyValue = function (locator)
{ }

/**
* Returns the value of a property given a locator in path format
* @method getPropertyValueFromPath
* @param {Array} locator in path format (array)
* @return {*} the value of that property
**/
SceneNode.prototype.getPropertyValueFromPath = function (path)
{ }

/**
* assigns a value to a property given the locator for that property
* @method setPropertyValue
* @param {String} locator
* @param {*} value
**/
SceneNode.prototype.setPropertyValue = function (locator, value)
{ }

/**
* given a locator in path mode (array) and a value, it searches for the corresponding value and applies it
* @method setPropertyValueFromPath
* @param {Array} path
* @param {*} value
* @param {Number} [optional] offset used to skip the firsst positions in the array
**/
SceneNode.prototype.setPropertyValueFromPath = function( path, value, offset )
{ }

/**
* Returns all the resources used by this node and its components (you can include the resources from the children too)
* @method getResources
* @param {Object} res object where to store the resources used (in "res_name":LS.TYPE format)
* @param {Boolean} include_children if you want to add also the resources used by the children nodes
* @return {Object} the same object passed is returned 
**/
SceneNode.prototype.getResources = function( res, include_children )
{ }


SceneNode.prototype.getTransform = function() {
	return this.transform;
}

//Helpers

SceneNode.prototype.getMesh = function( use_lod_mesh ) {
}

//Light component
SceneNode.prototype.getLight = function() {
	return this.light;
}

//Camera component
SceneNode.prototype.getCamera = function() {
	return this.camera;
}

/**
* Allows to load some kind of resource and associate it to this node.
* It can be for prefabs, meshes, scenes from daes, etc
* @method load
* @param {string} url
* @param {Function} on_complete
**/
SceneNode.prototype.load = function( url, on_complete )
{
}

/**
* Assign a resource/element inteligently to a node: if it is a mesh it creates a MeshRenderer, if it is a Material it assigns it, if it is an animation creates a PlayAnimation, if it is a prefab assigns the prefab. etc
* @method assign
* @param {*} resource the resource to assign (it also accepts a resource filename that has been previously loaded).
* @param {Function} on_complete
**/
SceneNode.prototype.assign = function( item, extra )
{
}

/**
* Simple way to assign a mesh to a node, it created a MeshRenderer component or reuses and existing one and assigns the mesh
* @method setMesh
* @param {string} mesh_name the name of the mesh (path to the file)
* @param {Number} submesh_id if you want to assign a submesh
**/
SceneNode.prototype.setMesh = function(mesh_name, submesh_id)
{
}

SceneNode.prototype.getMaterial = function()
{
}

/**
* Apply prefab info (skipping the root components) to node, so all children will be removed and components lost and overwritten
* It is called from prefab.applyToNodes when a prefab is loaded in memory
* @method reloadFromPrefab
**/
SceneNode.prototype.reloadFromPrefab = function()
{
}


/**
* Assigns this node to one layer
* @method setLayer
* @param {number|String} the index of the layer or the name (according to scene.layer_names)
* @param {boolean} value 
*/
SceneNode.prototype.setLayer = function( num_or_name, value )
{
}

/**
* checks if this node is in the given layer
* @method isInLayer
* @param {number|String} index of layer or name according to scene.layer_names
* @return {boolean} true if belongs to this layer
*/
SceneNode.prototype.isInLayer = function( num_or_name )
{
}

SceneNode.prototype.getLayers = function()
{
}

/**
* Returns the root node of the prefab incase it is inside a prefab, otherwise null
* @method insidePrefab
* @return {Object} returns the node where the prefab starts
*/
SceneNode.prototype.insidePrefab = function()
{
}

/**
* remember clones this node and returns the new copy (you need to add it to the scene to see it)
* @method clone
* @return {Object} returns a cloned version of this node
*/
SceneNode.prototype.clone = function()
{
}

/**
* Configure this node from an object containing the info
* @method configure
* @param {Object} info the object with all the info (comes from the serialize method)
* @param {Array} components_aside array to store the data about components so they are configured after creating the scene has been created
*/
SceneNode.prototype.configure = function(info, components_aside)
{
}

//adds components according to a mesh
//used mostly to addapt a node to a collada mesh info
SceneNode.prototype.addMeshComponents = function( mesh_id, extra_info )
{

}

/**
* Serializes this node by creating an object with all the info
* it contains info about the components too
* @method serialize
* @param {bool} ignore_prefab serializing wont returns children if it is a prefab, if you set this to ignore_prefab it will return all the info
* @return {Object} returns the object with the info
*/
SceneNode.prototype.serialize = function( ignore_prefab, simplified )
{

}

//used to recompute matrix so when parenting one node it doesnt lose its global transformation
SceneNode.prototype._onChildAdded = function( child_node, recompute_transform )
{
}

SceneNode.prototype._onChangeParent = function( future_parent, recompute_transform )
{
}

SceneNode.prototype._onChildRemoved = function( node, recompute_transform, remove_components )
{
}

//Computes the bounding box from the render instance of this node
//doesnt take into account children
SceneNode.prototype.getBoundingBox = function( bbox, only_instances )
{
}


/**
* changes the node name
* @method setName
* @param {String} new_name the new name
* @return {Object} returns true if the name changed
*/

Object.defineProperty( SceneNode.prototype, 'name', {
	set: function(name)
	{
		this.setName( name );
	},
	get: function(){
		return this._name;
	},
	enumerable: true
});

Object.defineProperty( SceneNode.prototype, 'fullname', {
	set: function(name)
	{
		throw("You cannot set fullname, it depends on the parent nodes");
	},
	get: function(){
		return this.getPathName();
	},
	enumerable: false
});

//Changing the UID  has lots of effects (because nodes are indexed by UID in the scene)
//If you want to catch the event of the uid_change, remember, the previous uid is stored in LS.SceneNode._last_uid_changed (it is not passed in the event)
Object.defineProperty( SceneNode.prototype, 'uid', {
	set: function(uid)
	{
		if(!uid)
			return;

		//valid uid?
		if(uid[0] != LS._uid_prefix)
		{
			console.warn("Invalid UID, renaming it to: " + uid );
			uid = LS._uid_prefix + uid;
		}

		//no changes?
		if(uid == this._uid)
			return;

		SceneNode._last_uid_changed = this._uid; //hack, in case we want the previous uid of a node 

		//update scene tree indexing
		if( this._in_tree && this._in_tree._nodes_by_uid[ this.uid ] )
			delete this._in_tree._nodes_by_uid[ this.uid ];
		this._uid = uid;
		if( this._in_tree )
			this._in_tree._nodes_by_uid[ this.uid ] = this;
		//events
		LEvent.trigger( this, "uid_changed", uid );
		if(this._in_tree)
			LEvent.trigger( this._in_tree, "node_uid_changed", this );
	},
	get: function(){
		return this._uid;
	},
	enumerable: true
});


Object.defineProperty( SceneNode.prototype, 'visible', {
	set: function(v)
	{
		this.flags.visible = v;
		if( this._children )
		for(var i = 0; i < this._children.length; ++i )
			this._children[i].visible = v;
	},
	get: function(){
		return this.flags.visible;
	},
	enumerable: true
});

Object.defineProperty( SceneNode.prototype, 'is_static', {
	set: function(v)
	{
		this.flags.is_static = v;
		if( v && this._children )
		for(var i = 0; i < this._children.length; ++i )
			this._children[i].is_static = v;
	},
	get: function(){
		return this.flags.is_static;
	},
	enumerable: true
});

Object.defineProperty( SceneNode.prototype, 'material', {
	set: function(v)
	{
		if( this._material == v )
			return;

		this._material = v;
		if(v)
		{
			if(v.constructor === String)
				return;
			if(v._root && v._root != this) //has root and its not me
				console.warn( "Cannot assign a material of one SceneNode to another, you must clone it or register it" )
			else
				v._root = this; //link
		}
		LEvent.trigger( this, "materialChanged" );
	},
	get: function(){
		return this._material;
	},
	enumerable: true
});

Object.defineProperty( SceneNode.prototype, 'prefab', {
	set: function(name)
	{
		this._prefab = name;
		if(!this._prefab)
			return;
		var prefab = LS.RM.getResource(name);
		var that = this;
		if(prefab)
			this.reloadFromPrefab();
		else 
			LS.ResourcesManager.load( name, function(){
				that.reloadFromPrefab();
			});
	},
	get: function(){
		return this._prefab;
	},
	enumerable: true
});


Object.defineProperty( SceneNode.prototype, 'classList', {
	get: function() { return this._classList },
	set: function(v) {},
	enumerable: false
});

/**
* @property className {String}
*/
Object.defineProperty( SceneNode.prototype, 'className', {
	get: function() {
			var keys = null;
			if(Object.keys)
				keys = Object.keys(this._classList); 
			else
			{
				keys = [];
				for(var k in this._classList)
					keys.push(k);
			}
			return keys.join(" ");
		},
	set: function(v) { 
		this._classList = {};
		if(!v)
			return;
		var t = v.split(" ");
		for(var i in t)
			this._classList[ t[i] ] = true;
	},
	enumerable: true
});



Object.defineProperty(SceneNode.prototype, 'name', {
  set: function (name)
  {
    this.setName
  },
});
