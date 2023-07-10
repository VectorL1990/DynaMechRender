global.Mesh = GL.Mesh = function Mesh(vertexbuffers, indexbuffers, options, gl) {
  if (gl !== null) {
    gl = global.gl;
    this.gl = gl;
  }

  this._context_id = gl.context_id;

  this.vertexBuffers = {};
  this.indexBuffers = {};

  this.info = {
    groups: []
  };

  if (vertexbuffers || indexbuffers) {

  }
}

Mesh.prototype.addBuffer = function (name, buffer) {
  if (buffer.target == gl.ARRAY_BUFFER) {
    this.vertexBuffers[name] = buffer;
  } else {
    this.indexBuffers[name] = buffer;
  }

  if (!buffer.attribute) {
    var 
  }
}

Mesh.prototype.addBuffers = function (vertexbuffers, indexbuffers, stream_type) {

}

Mesh.prototype.createVertexBuffer = function (name,
  attribute,
  buffer_spacing,
  buffer_data,
  stream_type) {
  
}

Mesh.prototype.updateVertexBuffer = function (name,
  attribute,
  buffer_spacing,
  buffer_data,
  stream_type) {
  
}

Mesh.prototype.removeVertexBuffer = function (name, free) {

}

Mesh.prototype.getVertexBuffer = function (name) {

}

Mesh.prototype.createIndexBuffer = function (name,
  buffer_data,
  stream_type) {
  
}

Mesh.prototype.getIndexBuffer = function (name) {

}

Mesh.prototype.removeIndexBuffer = function (name, free) {

}

Mesh.prototype.upload = function (buffer_type) {

}

Mesh.prototype.deleteBuffers = function () {

}

Mesh.prototype.bindBuffers = function (shader) {

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
