global.BBox = GL.BBox = {
  center:0,
  halfsize:3,
  min:6,
  max:9,
  radius:12,
  data_length:13,
  corners:[
    vec3.fromvalues(1,1,1),
    vec3.fromvalues(1,1,-1),
    vec3.fromvalues(1,-1,1),
    vec3.fromvalues(1,-1,-1),
    vec3.fromvalues(-1,1,1),
    vec3.fromvalues(-1,1,-1),
    vec3.fromvalues(-1,-1,1),
    vec3.fromvalues(-1,-1,-1)],
  
    create:function() {
      return new Float32Array(13);
    },

    clone:function(bb) {
      return new Float32Array(bb);
    },

    copy:function(out, bb){
      out.set(bb);
      return out;
    },
}