function MeshEncodeDecoder() {
  
}

MeshEncodeDecoder.prototype.replace_empty_char = function (text) {
  var del_space_text = text.replace(/[ \t]+/g, " ");
  var del_blank_text = del_space_text.replace(/\s\s*$/, "");
  return del_blank_text;
}

MeshEncodeDecoder.prototype.parseOBJ = function (text, options) {
  options = options || {};
  var MATNAME_EXTENSION = options.matextension || "";//".json";
  var support_uint = true;
  
  var vertices = [];
  var normals = [];
  var uvs = [];

  var vertices_buffer_data = [];
  var normals_buffer_data = [];
  var uvs_buffer_data = [];

  var groups = [];
  var current_group_materials = {};
  var last_group_name = null;
  var group = createGroup();

  var indices_map = new Map();
  var next_index = 0;
  var s = 1;

  var scale = 1;
  if (options.scale) {
    scale = options.scale;
  }

  var V_CODE = 1;
	var VT_CODE = 2;
	var VN_CODE = 3;
	var F_CODE = 4;
	var G_CODE = 5;
	var O_CODE = 6;
	var USEMTL_CODE = 7;
	var MTLLIB_CODE = 8;
  var codes = {
    v: V_CODE,
    vt: VT_CODE,
    vn: VN_CODE,
    f: F_CODE,
    g: G_CODE,
    o: O_CODE,
    usemtl: USEMTL_CODE,
    mtllib: MTLLIB_CODE
  };
  var x, y, z;

  function createGroup(name) {
    var g = {
      name: name || "",
      material: "",
      start: -1,
      length: -1,
      indices: []
    };
    groups.push(g);
    return g;
  }

  function getIndex(str) {
    var pos, tex, nor, f;
    var has_negative = false;

    if (str.indexOf("-") == -1) {
      // which means there is no negative indices
      var index = indices_map.get(str);
      if (index !== undefined) {
        return index;
      }
    } else {
      has_negative = true;
    }

    f = str.split("/");
    if (f.length == 1) {
      pos = parseInt(f[0]);
      tex = pos;
      nor = pos;
    } else if (f.length == 2) {
      pos = parseInt(f[0]);
      tex = parseInt(f[1]);
      nor = pos;
    } else if (f.length == 3) {
      pos = parseInt(f[0]);
      tex = parseInt(f[1]);
      nor = parseInt(f[2]);
    } else {
      console.log("Parse error");
      return -1;
    }

    if (pos < 0) {
      pos = vertices.length / 3 + pos + 1;
    }
    if (nor < 0) {
      nor = normals.length / 2 + nor + 1;
    }
    if (tex < 0) {
      tex = uvs.length / 2 + tex + 1;
    }

    if (has_negative) {
      str = pos + "/" + tex + "/" + nor;
      var index = indices_map.get(str);
      if (index !== undefined) {
        return index;
      }
    }

    pos -= 1;
    tex -= 1;
    nor -= 1;
    vertices_buffer_data.push( vertices[pos*3+0], vertices[pos*3+1], vertices[pos*3+2] );
    if (uvs.length) {
      uvs_buffer_data.push( uvs[tex*2+0], uvs[tex*2+1] ); 
    }
    if (normals.length) {
      normals_buffer_data.push(normals[nor * 3 + 0], normals[nor * 3 + 1], normals[nor * 3 + 2]); 
    }

    var index = next_index;
    indices_map.set(str, index);
    ++next_index;
    return index;

  }

  function changeMaterial(mat_name) {
    if (!group.material) {
      group.material = mat_name + MATNAME_EXTENSION;
      current_group_materials[mat_name] = group;
      return group;
    }

    var g = current_group_materials[mat_name];
    if (!g) {
      g = createGroup(last_group_name + "_" + mat_name);
      g.material = mat_name + MATNAME_EXTENSION;
      current_group_materials[mat_name] = g;
    }
    group = g;
    return g;
  }


  var lines = text.split("\n");
  var length = lines.length;
  for (var line_index = 0; line_index < length; ++line_index) {
    var line = lines[line_index];
    line = this.replace_empty_char(line);

    if (line[line.length - 1] == "\\") {
      line_index += 1;
      var next_line = this.replace_empty_char(lines[line_index]);
      var combine_line = (line.substr(0, line.length - 1) + next_line);
      line = this.replace_empty_char(combine_line);
    }

    if (line[0] == "#") {
      // which means it's comment
      continue;
    }
    if (line[0] == "") {
      // which means it's empty line
      continue;
    }

    var tokens = line.split(" ");
    var token_type = codes[tokens[0]];

    if (token_type <= VN_CODE) {
      x = parseFloat(tokens[1]);
      y = parseFloat(tokens[2]);
      if (code != VT_CODE) {
        z = parseFloat(tokens[3]);
      }
    }

    switch (token_type) {
      case V_CODE:
        x *= scale;
        y *= scale;
        z *= scale;
        vertices.push(x, y, z);
        break;
      case VT_CODE:
        uvs.push(x, y);
        break;
      case VN_CODE:
        normals.push(x, y, z);
        break;
      case F_CODE:
        if (tokens.length < 4) {
          // at least 3 vertexes and a token type
          continue;
        }
        var polygon_indices = [];
        for (var i = 1; i < tokens.length; ++i) {
          polygon_indices.push(getIndex(tokens[i]));
        }
        // group.indices is an array like [1, 2, 3]
        // polygon_indices may look like [1, 2, 3, 4]
        // which contains only single integer which represents indices
        // for example it may look like [1, 2, 3]
        group.indices.push(polygon_indices[0], polygon_indices[1], polygon_indices[2]);
        
        // polygons are break into triangles
        // after operation, indices array may looke like
        // [1, 2, 3, 1, 3, 4]
        for (var i = 2; i < polygon_indices.length - 1; ++i) {
          group.indices.push(polygon_indices[0], polygon_indices[i], polygon_indices[i + 1]);
        }
        break;
      case G_CODE:
      case O_CODE:
        var name = tokens[1];
        last_group_name = name;
        if (!group.name) {
          group.name = name;
        } else {
          current_group_materials = {};
          group = createGroup(name);
        }
        break;
      case USEMTL_CODE:
        changeMaterial(tokens[1]);
        break;
      case MTLLIB_CODE:
        mtllib = tokens[1];
        break;
      default:
    }
  }

  var indices = [];
  var group_index = 0;
  var final_groups = [];
  for (var i = 0; i < groups.length; ++i) {
    var group = groups[i];
    if (!group.indices) {
      continue;
    }
    group.start = group_index;
    group.length = group.indices.length;
    indices = indices.concat(group.indices);
    delete group.indices;
    group_index += group.length;
    final_groups.push(group);
  }
  groups = final_groups;

  var mesh = {};

  if (!vertices.length) {
    console.error("mesh without vertices");
    return null;
  }

  if (options.flip_normals && normals_buffer_data.length) {
    var normals = normals_buffer_data;
    for (var i = 0; i < normals.length; ++i) {
      normals[i] *= -1;
    }
  }

  	//create typed arrays
	mesh.vertices = new Float32Array( vertices_buffer_data );
	if ( normals_buffer_data.length )
		mesh.normals = new Float32Array( normals_buffer_data );
	if ( uvs_buffer_data.length )
		mesh.coords = new Float32Array( uvs_buffer_data );
	if ( indices && indices.length > 0 )
		mesh.triangles = new ( support_uint && group_index > 256*256 ? Uint32Array : Uint16Array )(indices);

	//extra info
	mesh.bounding = GL.Mesh.computeBoundingBox( mesh.vertices );
	var info = {};
	if(groups.length > 1)
	{
		info.groups = groups;
		//compute bounding of groups? //TODO: this is complicated, it is affected by indices, etc, better done afterwards
	}

	mesh.info = info;
	if( !mesh.bounding )
	{
		console.log("empty mesh");
		return null;
	}

	//if( mesh.bounding.radius == 0 || isNaN(mesh.bounding.radius))
	//	console.log("no radius found in mesh");
	//console.log(mesh);
	if(options.only_data)
		return mesh;

	//creates and returns a GL.Mesh
	var final_mesh = null;
	final_mesh = Mesh.load( mesh, null, options.mesh );
	//final_mesh.updateBoundingBox();
	return final_mesh;
}

