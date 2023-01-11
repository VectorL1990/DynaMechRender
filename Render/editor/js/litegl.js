

(function (global) {
  
  var GL = global.GL = {};

  global.requestAnimationFrame = global.requestAnimationFrame ||
                                 global.mozRequestAnimationFrame || 
                                 global.webkitRequestAnimationFrame || 
                                 function (callback) {
                                   setTimeout(callback, 1000 / 60);
                                  };
  
  global.createCanvas = GL.createCanvas = function createCanvas(width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  if(typeof(performance) != "undefined")
    global.getTime = performance.now.bind(performance);
  else
    global.getTime = Date.now.bind( Date );
  GL.getTime = global.getTime;

  GL.create = function (options)
  {

    var canvas = this.createCanvas(
      options.width || 800,
      options.height || 600
    );

    var gl = null;

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
        gl = canvas.getContext(gl_version_list[i], context_options);
      }
      catch (e)
      {
        console.error(e);
      }
    }

    global.gl = gl;
    canvas.gl = gl;



    gl.animate = function ()
    {
      var post = global.requestAnimationFrame;
      var time = getTime();

      function loop()
      {
        if (gl.destroyed)
        {
          return;
        }

        this._requestFrame_id = global.requestAnimationFrame(loop);

        var now = getTime();
        var dt = (time - now) * 0.001;
        //this.onupdate(dt);
        gl.ondraw();
        time = now;
      }

      this._requestFrame_id = post(loop);
    }

    gl.destroy = function ()
    {
      this.canvas.parentNode.removeChild(this.canvas);
      global.gl = null;
    }

    return gl;
  }
  
  

})(typeof (window) != undefined ? window : (typeof (self) != "undefined" ? self : global));

