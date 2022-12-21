function Player(options)
{
  var container = options.container;

  var canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  container.appendChild(canvas);
  options.canvas = canvas;

  this.gl_context = GL.create(options);
  this.canvas = canvas;
  // TODO: suplement scene script
  this.scene = LS.GlobalScene;
  // TODO: suplement renderer script
  this.renderer = LS.Renderer;
  this.renderer.init();

  this.gl_context.animate();

}

Player.prototype._ondraw = function (force)
{
  if (this.scene._must_redraw || this.force_redraw)
  {
    this.renderer.render(scene, scene.info)
  }
}
