

/**
 * Constructor
 * @param {*} container 
 * @param {*} options 
 */
function CanvasManager(options)
{
  this.widgets = [];

  this.init(options);
}

CanvasManager.prototype.init = function (options)
{
  console.log("canvasManager init!!!");
  var container = options.container || "body";
  if (container.constructor === String) {
    container = document.querySelector(container);
  }

  var antialiasing = true;
  
  var webgl_version = 1;
  if (options.webgl_version) {
    webgl_version = options.webgl_version;
  }

  try
  {
    window.gl = GL.create({
      version: webgl_version,
      antialiasing: antialiasing,
      alpha: false,
      stencil: true,
      premultipliedAlpha: false
    });
  }
  catch (err)
  {
    console.error(err);
    console.error("webgl not supported");
    return false;
  }

  gl.canvas.width = options.width;
  gl.canvas.height = options.height;

  gl.ondraw = this.ondraw.bind(this);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  container.appendChild(gl.canvas);
  this.canvas = gl.canvas;
  this.gl = gl;
  gl.animate();
  
}

CanvasManager.prototype.addWidget = function (widget, priority)
{
  widget.canvas_priority = priority;
  this.widgets.push(widget);
  this.widgets.sort(
    function(a,b)
    {
      return a.canvas_priority - b.canvas_priority;
    }
  );
}

CanvasManager.prototype.ondraw = function ()
{
  for (var i = 0; i < this.widgets.length; ++i)
  {
    if (this.widgets[i].render)
    {
      if (this.widgets[i].render(gl, this.must_update) == true)
      {
        break;
      }
    }
  }
  this.must_update = false;
}
