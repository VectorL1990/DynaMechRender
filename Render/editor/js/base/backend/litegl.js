

(function (global) {
  
  var GL = global.GL = {};

  global.requestAnimationFrame = global.requestAnimationFrame ||
                                 global.mozRequestAnimationFrame || 
                                 global.webkitRequestAnimationFrame || 
                                 function (callback) {
                                   setTimeout(callback, 1000 / 60);
                                 };
  
  

})(typeof (window) != undefined ? window : (typeof (self) != "undefined" ? self : global));


GL.create = function (options)
{
  var canvas = options.canvas;

  var gl_context = null;

  var gl_version_list = null;
  if (options.version == 2)
  {
    gl_version_list = ['webgl2', 'experimental-webgl2'];
  }
  else if (options.version == 1)
  {
    gl_version_list = ['webgl', 'experimental-webgl'];
  }
  else if (options.version == 0)
  {
    gl_version_list = ['webgl2', 'experimental-webgl2', 'webgl', 'experimental-webgl'];
  }

  var context_options = {};

  for (var i = 0; i < gl_version_list.length; i++)
  {
    try
    {
      gl_context = canvas.getContext(gl_version_list[i], context_options);
    }
    catch (e)
    {
      console.error(e);
    }
  }

  global.gl_context = gl_context;
  canvas.gl_context = gl_context;



  gl_context.animate = function ()
  {
    var time = getTime();

    function loop()
    {
      if (gl_context.destroyed)
      {
        return;
      }

      this._requestFrame_id = global.requestAnimationFrame(loop);

      var now = getTime();
      var dt = (time - now) * 0.001;
      this.onupdate(dt);
      this.ondraw();
      time = now;
    }

    this._requestFrame_id = post(loop);
  }

  gl_context.destroy = function ()
  {
    this.canvas.parentNode.removeChild(this.canvas);
    global.gl_context = null;
  }

  return gl_context;
}