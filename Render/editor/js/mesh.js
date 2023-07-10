global.Mesh = GL.Mesh = function Mesh(vertexbuffers, indexbuffers, options, gl) {
  if (gl !== null) {
    gl = global.gl;
    this.gl = gl;
  }

  this._context_id = gl.context_id;

  this.internalVertexBuffers = {};
  this.internalIndexBuffers = {};

  this.info = {
    groups: []
  };

  if (vertexbuffers || indexbuffers) {

  }
}

Mesh.default_datatype = Float32Array;

Mesh.common_buffers = {
  "vertices": {spacing:3, attribute: "a_vertex"},
  "vertices2D": {spacing:2, attribute: "a_vertex2D"},
  "normals": {spacing:3, attribute: "a_normal"},
};

Mesh.prototype.addBuffer = function (name, buffer) {
  if (buffer.target == gl.ARRAY_BUFFER) {
    this.vertexBuffers[name] = buffer;
  } else {
    this.indexBuffers[name] = buffer;
  }

  if (!buffer.attribute) {
    var info = Mesh.common_buffers[name];
    if (info) {
      buffer.attribute = info.attribute;
    }
  }
}



Mesh.prototype.addBuffers = function (vertexBufCollection, indexBufCollection, stream_type) {
  for (var key in vertexBufCollection) {
    var buffer = vertexBufCollection[key];
    if (!buffer) {
      continue;
    }
    var data = buffer[key];

    var stream_info = Mesh.common_buffers[key];

    if (data.constructor === Array) {
      var datatype = Mesh.default_datatype;
      if (stream_info.type) {
        datatype = stream_info.type;
      }
      data = new datatype(data);
    }

    var spacing = stream_info[key].spacing;
    
    var attribute = "a_" + key;

    if (this.internalIndexBuffers[key]) {
      this.updateVertexBuffer(key, attribute, spacing, data, stream_type);
    } else {
      this.createVertexBuffer(key, attribute, spacing, data, stream_type);
    }
  }
}

Mesh.prototype.createVertexBuffer = function (name,
  attribute,
  buffer_spacing,
  buffer_data,
  stream_type) {
  var buffer_info = Mesh.common_buffers[name];

  if (!attribute) {
    throw("attribute name can not be empty");
  }

  if (!buffer_spacing) {
    // if buffer spacing is not assigned
    buffer_spacing = buffer_info.spacing;
  } else {
    buffer_spacing = 3;
  }

  if (!buffer_data) {
    var num = this.getNumVertices();
    if (!num) {
      throw("cannot create empty buffer without vertices");
    }
    buffer_data = new (Mesh.default_datatype)(num*buffer_spacing);
  }

  if (!buffer_data.buffer) {
    throw("Buffer data must be typed array");
  }

  var buffer = 
  this.internalVertexBuffers[name] = 
  new Buffer(gl.ARRAY_BUFFER,
    buffer_data,
    buffer_spacing,
    stream_type,
    this.gl);

  buffer.name = name;
  buffer.attribute = buffer_info;
}

Mesh.prototype.updateVertexBuffer = function (name,
  attribute,
  buffer_spacing,
  buffer_data,
  stream_type) {
  var buffer = this.internalVertexBuffers[name];
  if (!buffer) {
    console.log("buffer not found: ", name);
    return;
  }

  if (!buffer_data.length) {
    return;
  }

  buffer.attribute
}

Mesh.prototype.removeVertexBuffer = function (name, free) {

}

Mesh.prototype.getVertexBuffer = function (name) {

}

Mesh.prototype.createIndexBuffer = function (name,
  buffer_data,
  stream_type) {
  if (buffer_data.constructor === Array) {
    var datatype = Uint16Array;
    var vertices = this.internalVertexBuffers["vertices"];
    if (vertices) {
      var num_vertices = vertices.data.length / 3;
      if (num_vertices > 256*256) {
        datatype = Uint32Array;
      }
      buffer_data = new datatype(buffer_data);
    }
  }

  var buffer = 
  this.internalIndexBuffers[name] = 
  new Buffer(gl.ELEMENT_ARRAY_BUFFER,
    buffer_data,
    0,
    stream_type,
    this.gl);

  return buffer;
}

Mesh.prototype.getIndexBuffer = function (name) {

}

Mesh.prototype.removeIndexBuffer = function (name, free) {

}

Mesh.prototype.upload = function (buffer_type) {
  for (var key in this.internalVertexBuffers) {
    var buffer = this.internalVertexBuffers[key];
    buffer.upload(buffer_type);
  }

  for (var key in this.internalIndexBuffers) {
    var buffer = this.internalIndexBuffers[key];
    buffer.upload();
  }
}

Mesh.prototype.deleteBuffers = function () {
  for (var key in thie.internalVertexBuffers) {
    var buffer = this.internalVertexBuffers[key];
    buffer.delete();
  }

  this.internalVertexBuffers = {};

  for (var key in this.internalIndexBuffers) {
    var buffer = this.internalIndexBuffers[key];
    buffer.delete();
  }

  this.internalIndexBuffers = {};
}

Mesh.prototype.bindBuffers = function (shader) {
  for (var key in this.internalVertexBuffers) {
    var buffer = this.internalVertexBuffers[key];
  }
}

Mesh.prototype.unbindBuffers = function (shader) {

}

Mesh.prototype.computeIndices = function () {

}

Mesh.prototype.explodeIndices = function (buffer_name) {

}

Mesh.prototype.computeNormals = function (stream_type) {

}

Mesh.prototype.computeTangents = function () {

}

Mesh.prototype.computeTextureCoordinates = function (stream_type) {

}

Mesh.computeBoundingBox = function (vertices, bb, mask) {

}

Mesh.prototype.getBoundingBox = function () {

}

Mesh.prototype.updateBoundingBox = function () {

}

Mesh.prototype.computeGroupsBoundingBoxes = function () {

}

Mesh.prototype.setBoundingBox = function (center, half_size) {

}

Mesh.prototytpe.configure = function (o, options) {

}

Mesh.prototype.slice = function (start, length) {

}

Mesh.prototype.simplify = function () {
  
}

Mesh.prototype.parse = function (data, format, options) {
  
}

Mesh.prototype.encode = function (format, options) {

}

Mesh.load = function (buffers,
  options,
  output_mesh,
  gl) {
  
}

Mesh.mergeMeshes = function (meshes, options) {

}

Mesh.createFromURL = function (url,
  on_complete,
  gl,
  options) {
  
}

Mesh.getScreenQuad = function (gl) {

}

Mesh.cube = function (options, gl) {
  
}
