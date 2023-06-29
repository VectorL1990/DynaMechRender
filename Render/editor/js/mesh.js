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
