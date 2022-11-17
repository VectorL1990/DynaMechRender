
var ResourcesManager = {
  path: "", //url to retrieve resources relative to index.html

  resources: {},
  meshes: {},
  textures: {},
  materials: {},
  materials_by_uid: {},

  getNoCache: function (force)
  {

  },
};



///@FILE:../src/resources/resource.js
///@INFO: BASE
/**
* This class contains all the info about a resource and it works as a template for any resource class
* Keep in mind that there are many resource classes like Meshes or Textures that DONT INHERIT FROM THIS CLASS.
* This class is used mainly to generic file resources like text files (scripts, csvs, etc)
*
* @class Resource
* @constructor
*/

function Resource()
{
	this.filename = null; //name of file without folder or path
	this.fullpath = null; //contains the unique name as is to be used to fetch it by the resources manager
	this.remotepath = null; //the string to fetch this resource in internet (local resources do not have this name)
	this._data = null;
	//this.type = 0;
}

//Resource.DATA = 1;
//Resource.SCRIPT = 2;

Object.defineProperty( Resource.prototype, "data", {
	set: function(v){ 
		this._data = v;
		this._modified = true;
	},
	get: function() { 
		return this._data;
	},
	enumerable: true
});

/** makes this resource available by registering in the resources manager
* @method rename
*/
Resource.prototype.register = function()
{
	LS.ResourcesManager.registerResource( this.fullpath || this.filename, this );
}

/** Renames the resource and ensures the resources manager is updated accordingly
* @method rename
* @param {String} new_filename the new filename
*/
Resource.prototype.rename = function( new_filename )
{
	LS.ResourcesManager.renameResource( this.fullpath || this.filename, new_filename );
}

Object.defineProperty( Resource.prototype, "uid", { 
	get: function(){ return this.fullpath || this.filename },
	set: function(v){},
	enumerable: true
});

/**
* Static method: Returns an object with a representation of the resource internal data
* The order to obtain that object is:
* 0. checks if getDataToStore function in resource
* 1. test for _original_file (File or Blob)
* 2. test for _original_data (ArrayBuffer)
* 3. toBinary() (ArrayBuffer)
* 4. toBlob() (Blob)
* 5. toBase64() (String)
* 6. serialize() (Object in JSON format)
* 7. data property 
* 8. JSON.stringify(...)
*
* @method Resource.getDataToStore
* @param {Object} resource 
* @param {Boolean} allow_blob [optional] 
* @return {Object} it has two fields: data and encoding
*/
Resource.getDataToStore = function( resource, allow_blob )
{
	var data = null;
	var encoding = "text";
	var extension = "";

	//get the data
	if (resource.getDataToStore) //function
	{
		data = resource.getDataToStore();
		if(data && data.constructor == ArrayBuffer)
			encoding = "binary";
	}
	else if (resource._original_file) //file
	{
		data = resource._original_file;
		if(data && data.constructor !== File && data.constructor !== Blob)
			console.warn("Resource._original_file is not File or Blob");
		encoding = "file";
	}
	else if( resource._original_data ) //file in ArrayBuffer format
	{
		data = resource._original_data;
		if( data && data.constructor === ArrayBuffer )
			encoding = "binary";
	}
	else if(resource.toBinary) //a function to compute the ArrayBuffer format
	{
		if( resource.constructor === GL.Texture ) //HACK: textures require that extra parameter...
			data = resource.toBinary(true);
		else
			data = resource.toBinary();
		encoding = "binary";
		if(resource.constructor.binary_extension) //special case, textures are in PNG to keep alpha
			extension = resource.constructor.binary_extension;
		else
			extension = "wbin";
	}
	else if(resource.toBlob && allow_blob) //a blob (Canvas should have this)
	{
		data = resource.toBlob();
		encoding = "file";
	}
	else if(resource.toBase64) //a base64 string
	{
		data = resource.toBase64();
		encoding = "base64";
	}
	else if(resource.serialize) //a json object
	{
		var obj = resource.serialize();
		//remove inner stuff from the editor
		delete obj.filename;
		delete obj.fullpath;
		delete obj.remotepath;
		delete obj.preview_url; //just in case is an old resource
		//convert to string
		data = JSON.stringify( obj );
	}
	else if(resource.data) //regular string data
		data = resource.data;
	else
		data = JSON.stringify( resource );

	if(data.buffer && data.buffer.constructor == ArrayBuffer)
		data = data.buffer; //store the data in the arraybuffer

	return { data:data, encoding: encoding, extension: extension };
}

//used in the coding pad to assign content to generic text files
Resource.prototype.getData = function()
{
	return this._data;
}

Resource.prototype.setData = function( v, skip_modified_flag )
{
	//remove old file
	if( this._original_data )
		this._original_data = null;
	this._data = v;
	if(!skip_modified_flag)
		this._modified = true;
}

Resource.prototype.getDataToStore = function()
{
	var data = this.data || "";
	if(data.constructor === Object )
		data = JSON.stringify( data );
	return data;
}

/** Clone the resource
* @method clone
* @return {LS.Resource} the clone of the resource
*/
Resource.prototype.clone = function()
{
	var r = new LS.Resource();
	r._data = this._data;
	return r;
}

/** Returns a string representing to which category this resource belongs
* @method getCategory
*/
Resource.prototype.getCategory = function()
{
	var filename = this.fullpath || this.filename;
	var ext = LS.ResourcesManager.getExtension( filename );
	if(ext == "js")
		return "Script";
	return "Data";
}

/** When dropping this resource into a SceneNode
* @method assignToNode
*/
Resource.prototype.assignToNode = function(node)
{
	if(!node) 
		return false;

	var filename = this.fullpath || this.filename;
	var category = this.getCategory();

	if( category == "Script" )
	{
		var script_component = new LS.Components.ScriptFromFile({ filename: filename });
		node.addComponent( script_component );
	}

	return true;
}

/** Parses the resource data as subfiles (subfiles are fragments of the code identified by a slash followed by name string), used by ShaderCode
* @method getAsSubfiles
* @return {Object} the object that contains every subfile
*/
Resource.prototype.getAsSubfiles = function()
{
	if(!this._data)
		return null;
	return GL.processFileAtlas( this._data );
}

/** Parses the resource as HTML code and returns a HTMLElement containing the html code
* @method getAsHTML
* @return {HTMLElement} the root HTMLElement that contains the code
*/
Resource.prototype.getAsHTML = function()
{
	if(!this._data || this._data.constructor !== String)
		return null;

	var container = document.createElement("div");
	container.innerHTML = this._data;
	return container;
}

/** Used by the editor to know if it can be edited in the text editor
* @method hasEditableText
*/
Resource.prototype.hasEditableText = function()
{
	return this._data && this._data.constructor === String;
}

Resource.hasPreview = false; //should this resource use a preview image?



/**
* Pack is an object that contain several resources, helpful when you want to carry a whole scene in one single file
* 
* @class Pack
* @constructor
*/

function Pack(o)
{
	this.resource_names = []; 
	this.metadata = null;
	this._data = {}; //the original chunks from the WBin, including the @JSON and @resource_names
	this._resources_data = {}; //every resource in arraybuffer format
	if(o)
		this.configure(o);
}

Pack.version = "0.2"; //used to know where the file comes from 
Pack.EXTENSION = "wbin";

/**
* configure the pack from an unpacked WBin
* @method configure
* @param {Object} data an unpacked WBIN (object with every chunk)
**/
Pack.prototype.configure = function( data )
{
	this._data = LS.cloneObject( data );

	//extract resource names
	this.resource_names = data["@resource_names"];
	this._resources_data = {};
	if(this.resource_names)
	{
		delete this._data["@resource_names"];
		for(var i in this.resource_names)
		{
			this._resources_data[ this.resource_names[i] ] = data[ "@RES_" + i ];
			delete this._data[ "@RES_" + i ];
		}
	}

	//store resources in LS.ResourcesManager
	this.processResources();
}

Object.defineProperty( Pack.prototype, 'bindata', {
	set: function(name)
	{
		throw("Pack bindata cannot be assigned");
	},
	get: function(){
		if(!this._original_data)
			this._original_data = LS.Pack.packResources( this.resource_names, this._data );
		return this._original_data;
	},
	enumerable: true
});


Pack.fromBinary = function(data)
{
	if(data.constructor == ArrayBuffer)
		data = WBin.load(data, true);
	return new LS.Pack(data);
}

//given a list of resources that come from the Pack (usually a wbin) it extracts, process and register them 
Pack.prototype.processResources = function()
{
	if(!this.resource_names)
		return;

	var pack_filename = this.fullpath || this.filename;

	//block this resources of being loaded, this is to avoid chain reactions when a resource uses 
	//another one contained in this pack
	for(var i = 0; i < this.resource_names.length; ++i)
	{
		var resname = this.resource_names[i];
		if( LS.ResourcesManager.resources[ resname ] )
			continue; //already loaded
		LS.ResourcesManager.resources_being_processed[ resname ] = true;
	}

	//process and store in LS.ResourcesManager
	for(var i = 0; i < this.resource_names.length; ++i)
	{
		var resname = this.resource_names[i];
		if( LS.ResourcesManager.resources[resname] )
			continue; //already loaded

		var resdata = this._resources_data[ resname ];
		if(!resdata)
		{
			console.warn("resource data in Pack is undefined, skipping it:" + resname);
			continue;
		}
		var resource = LS.ResourcesManager.processResource( resname, resdata, { is_local: true, from_pack: pack_filename } );
	}
}

Pack.prototype.setResources = function( resource_names, mark_them )
{
	this.resource_names = [];
	this._resources_data = {};

	var pack_filename = this.fullpath || this.filename;

	//get resources
	for(var i = 0; i < resource_names.length; ++i)
	{
		var res_name = resource_names[i];
		if(this.resource_names.indexOf(res_name) != -1)
			continue;
		var resource = LS.ResourcesManager.resources[ res_name ];
		if(!resource)
			continue;
		if(mark_them)
			resource.from_pack = pack_filename;
		this.resource_names.push( res_name );
	}

	//repack the pack info
	this._original_data = LS.Pack.packResources( resource_names, this.getBaseData() );
	this._modified = true;
}

Pack.prototype.getBaseData = function()
{
	return { "@metadata": this.metadata, "@version": LS.Pack.version };
}

//adds to every resource in this pack info about where it came from (the pack)
Pack.prototype.setResourcesLink = function( value )
{
	for(var i = 0; i < this.resource_names.length; ++i)
	{
		var res_name = this.resource_names[i];
		var resource = LS.ResourcesManager.resources[ res_name ];
		if(!resource)
			continue;
		if(value)
			resource.from_pack = value;
		else
			delete resource.from_pack;
	}
}

//adds a new resource (or array of resources) to this pack
Pack.prototype.addResources = function( resource_names, mark_them )
{
	if(!resource_names)
		return;
	if(resource_names.constructor !== Array)
		resource_names = [ resource_names ];
	this.setResources( this.resource_names.concat( resource_names ), mark_them );
}

/**
* Adds a resource to the prefab
* @method addResource
* @param {String} filename filename of the resource
**/
Pack.prototype.addResource = function( filename )
{
	filename = LS.ResourcesManager.cleanFullpath( filename );
	var index = this.resource_names.indexOf(filename);
	if(index == -1)
		this.resource_names.push( filename );
}

/**
* Remove a resource to the prefab
* @method removeResource
* @param {String} filename filename of the resource
**/
Pack.prototype.removeResource = function(filename)
{
	filename = LS.ResourcesManager.cleanFullpath( filename );
	var index = this.resource_names.indexOf(filename);
	if(index != -1)
		this.resource_names.splice( index, 1 );
}

/**
* to create a WBin containing all the resource and metadata
* @method Pack.createWBin
* @param {String} fullpath for the pack
* @param {Array} resource_names array with the names of all the resources to store
* @param {Object} metadata [optional] extra data to store
* @param {boolean} mark_them [optional] marks all the resources as if they come from a pack
* @return object containing the pack data ready to be converted to WBin
**/
Pack.createPack = function( filename, resource_names, extra_data, mark_them )
{
	if(!filename)
		return;

	if(!resource_names || resource_names.constructor !== Array)
		throw("Pack.createPack resources must be array with names");
	if(extra_data && extra_data.constructor !== Object)
		throw("Pack.createPack extra_data must be an object with the chunks to store");

	filename = filename.replace(/ /gi,"_");

	var pack = new LS.Pack();
	filename += ".wbin";
	pack.filename = filename;
	if(extra_data)
		pack._data = extra_data;

	pack.resource_names = resource_names;
	for(var i = 0; i < resource_names.length; ++i)
	{
		var res_name = resource_names[i];
		var resource = LS.ResourcesManager.resources[ res_name ];
		if(!resource)
			continue;
		if(mark_them)
			resource.from_pack = pack.filename;
	}

	//create the WBIN in case this pack gets stored
	this.metadata = extra_data;
	var bindata = LS.Pack.packResources( resource_names, pack.getBaseData() );
	pack._original_data = bindata;

	return pack;
}

//Given a bunch of resource names it creates a WBin with all inside
Pack.packResources = function( resource_names, base_object )
{
	var to_binary = base_object || {};
	var final_resource_names = [];

	for(var i = 0; i < resource_names.length; ++i)
	{
		var res_name = resource_names[i];
		var resource = LS.ResourcesManager.resources[ res_name ];
		if(!resource)
			continue;

		var data = null;
		if(resource._original_data) //must be string or bytes
			data = resource._original_data;
		else
		{
			var data_info = LS.Resource.getDataToStore( resource );
			data = data_info.data;
		}

		if(!data)
		{
			console.warn("Wrong data in resource");
			continue;
		}

		if(data.constructor === Blob || data.constructor === File)
		{
			if(!data.data || data.data.constructor !== ArrayBuffer )
			{
				console.warn("WBin does not support to store File or Blob, please, use ArrayBuffer");
				continue;
			}
			data = data.data; //because files have an arraybuffer with the data if it was read
		}

		to_binary["@RES_" + final_resource_names.length ] = data;
		final_resource_names.push( res_name );
		//to_binary[res_name] = data;
	}

	to_binary["@resource_names"] = final_resource_names;
	return WBin.create( to_binary, "Pack" );
}

//just tells the resources where they come from, we cannot do that before because we didnt have the name of the pack
Pack.prototype.flagResources = function()
{
	if(!this.resource_names)
		return;

	for(var i = 0; i < this.resource_names.length; ++i)
	{
		var res_name = this.resource_names[i];
		var resource = LS.ResourcesManager.resources[ res_name ];
		if(!resource)
			continue;

		resource.from_pack = this.fullpath || this.filename;
	}
}

Pack.prototype.getDataToStore = function()
{
	return LS.Pack.packResources( this.resource_names, this.getBaseData() );
}

Pack.prototype.checkResourceNames = function()
{
	if(!this.resource_names)
		return 0;

	var changed = 0;

	for(var i = 0; i < this.resource_names.length; ++i)
	{
		var res_name = this.resource_names[i];
		var old_name = res_name;
		var resource = LS.ResourcesManager.resources[ res_name ];
		if(!resource)
			continue;

		//avoid problematic symbols
		if( LS.ResourcesManager.valid_resource_name_reg.test( res_name ) == false )
		{
			console.warn("Invalid filename in pack/prefab: ", res_name  );
			res_name = res_name.replace( /[^a-zA-Z0-9-_\.\/]/g, '_' );
		}

		//ensure extensions
		var extension = LS.ResourcesManager.getExtension( res_name );
		if(!extension)
		{
			extension = resource.constructor.EXTENSION;
			if(!extension)
				console.warn("Resource without extension and not known default extension: ", res_name , resource.constructor.name );
			else
				res_name = res_name + "." + extension;
		}

		if(old_name == res_name)
			continue;

		this.resource_names[i] = res_name;
		LS.ResourcesManager.renameResource( old_name, res_name ); //force change
		changed++;
	}

	if(changed)
		LS.ResourcesManager.resourceModified( this );

	return changed;
}

Pack.prototype.onResourceRenamed = function( old_name, new_name, resource )
{
	if(!this.resource_names)
		return;
	var index = this.resource_names[ old_name ];
	if( index == -1 )
		return;
	this.resource_names[ index ] = new_name;
	LS.ResourcesManager.resourceModified( this );
}

Pack.prototype.containsResources = function()
{
	return this.resource_names && this.resource_names.length > 0 ? true : false;
}

Pack.prototype.getSizeInBytes = function()
{
	if(this._original_data)
		return this._original_data.byteLength;
	return 0;
}
