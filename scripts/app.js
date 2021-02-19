"use strict";

/* Main app script management
 * May need to be broken up, but
 * currently, this is the simplest way
 * to set it up
 * By Griffith T
 */

// global data
var data = {
  loadedShaderCode: "",
  didChange: true,
  texture: null,
  framebuff: null,
  animate: false,
  cameraUniforms: {
    u_fov: 40,
    u_angles: [5,-10],
    u_zoom: 15
  },
  settings: {
    u_bounds: 5,
    u_step_size: 0.25,
    u_line_width: 0.06,
    u_spacing: 1.0,
    u_scale: [1,1,1],
  },
  variables: {
  }
};

window.onload = function () {

//#region initialization------------------------//

  // setup page elements
  let boundsdragger = new Dragger((n) => {
    let prevn = data.settings.u_bounds;
    // TODO: Make the bounds more logmarthmic
    data.settings.u_bounds = n;//Math.pow(1.1, n);
    data.cameraUniforms.u_zoom = (data.cameraUniforms.u_zoom / prevn) * data.settings.u_bounds;
    data.settings.u_spacing = Math.pow(10, Math.round(Math.log10(data.settings.u_bounds)) - 1);
    data.didChange = true;
  }, "Size", data.settings.u_bounds, 0.1, 0.0000001);

  let linedragger = new Dragger((n) => {
    data.settings.u_line_width = n;
    data.didChange = true;
  }, "Line Width", data.settings.u_line_width, 0.01, 0, 1);

  let spacingdragger = new Dragger((n) => {
    data.settings.u_spacing = n;
    data.didChange = true;
  }, "Line Spacing", data.settings.u_spacing, 0.1, 0.01);

  let precisiondragger = new Dragger((n) => {
    data.settings.u_step_size = 1 / n;
    data.didChange = true;
  }, "Precision", 1 / data.settings.u_step_size, 0.1, 0.1, 100);

  // TODO: Make the UI for scale more elegant
  let xscaledragger = new Dragger((n) => {
    data.settings.u_scale[0] = n;
    data.didChange = true;
  }, "X Scale", data.settings.u_scale[0], 0.1, 0.0001);

  let yscaledragger = new Dragger((n) => {
    data.settings.u_scale[1] = n;
    data.didChange = true;
  }, "Y Scale", data.settings.u_scale[1], 0.1, 0.0001);

  let zscaledragger = new Dragger((n) => {
    data.settings.u_scale[2] = n;
    data.didChange = true;
  }, "Z Scale", data.settings.u_scale[2], 0.1, 0.0001);

  let zoomdragger = new Dragger((n) => {
    data.cameraUniforms.u_zoom = n;
    data.didChange = true;
  }, "Zoom", data.cameraUniforms.u_zoom, 0.5, 0.001, 1000);

  $("#mainControls")
    .append(boundsdragger.element)
    .append(linedragger.element)
    // .append(spacingdragger.element)
    .append(precisiondragger.element)
    // .append(xscaledragger.element)
    // .append(yscaledragger.element)
    // .append(zscaledragger.element)
    .append(zoomdragger.element);
  
    if (window.innerWidth > 650) {
      //assume we are using a computer
      zoomdragger.element.style.display = "none";
    }

  let funcs = [];

  function setFuncColors() {
    for (let i in funcs) {
      let e = funcs[i];
      let hue = i / (funcs.length - 0.5);
      e.hue = hue;
    }
  }

  function removeEq(id) {
    for (let e of funcs.slice(id)) {
      // corrects the reference location to ensure they are correctly removed
      e.id--;
    }
    funcs.splice(id,1);
    setFuncColors();
    processMainShaderCode();
  }


  $("#addFunction").on("click", () => {
    funcs.push(new Equation((t) => {
      processMainShaderCode();
    }, removeEq, funcs.length));
    setFuncColors();
    processMainShaderCode();}
  )
  // get settings from URL
  var url_options = window.location.search.split(/[&?]/);
  for (var el in url_options) {
    var string = url_options[el];
    if (string === "") continue;
    let ind = string.indexOf("=");
    var name = string.slice(0, ind);
    let val = string.slice(ind + 1);

    switch (name) {
      case "eqs":
        let streqs = decodeURIComponent(val);
        if (!streqs.match(/[\][]/)) {
          funcs.push(new Equation((t) => {
            processMainShaderCode();
          }, removeEq, funcs.length, streqs));
        } else {
          let eqs = JSON.parse(streqs);
          for (let e of eqs) {
            funcs.push(new Equation((t) => {
              processMainShaderCode();
            }, removeEq, funcs.length, e));
          }
        }
        break;
      case "zoom":
        data.cameraUniforms.u_zoom = Number(decodeURIComponent(val));
        break;
      case "angles":
        data.cameraUniforms.u_angles = JSON.parse(decodeURIComponent(val));
        break;
      default:
        console.warn(`URI Option ${name} not supported. Ignoring.`)
    }
  }

  if (funcs.length === 0) {
    funcs.push(new Equation((t) => {
      processMainShaderCode();
    }, removeEq, funcs.length));
  }

  setFuncColors();

  let variables = {};
  
  function addVariable(name, latex) {
    if (latex === undefined || latex === null) latex = name.slice(2);
    if (variables[name]) {
      // just show it again
      variables[name].element.style.display = "block";
      return;
    }
    data.variables[name] = 1.0;
    let e = new Dragger(
      n => {
        data.variables[name] = n;
        data.didChange = true;
      },
      latex,
      data.variables[name],
      0.1,
      null,null,
      true
    );
    variables[name] = e;
    $("#variables").append(e.element);
  }

  function hideVariables() {
    for (let e in variables) {
      let el = variables[e];
      el.element.style.display = "none";
    }
  }

  addVariable("u_a");

  //general setup
  const canvas = $("canvas")[0];
  const glu = new WebGlUtils(canvas);
  glu.resizeCanvas();

  window.onresize = function() {
    glu.resizeCanvas();
    data.didChange = true;
  }

  let mainShader = new ComputeShader(canvas);
  mainShader.onerror = (m) => {
    message("Invalid function!");
    console.log(m);
  };

  //load code into each shader
  $.get("shaders/main.frag", function(response){
    data.loadedShaderCode = response;
    //make the shader (It needs to be processed with the added functions)
    processMainShaderCode();
  });

  // render all static math
  for (let e of document.getElementsByClassName("math")) {
    MQ.StaticMath(e);
  }
//#endregion initialization

//#region renderloop----------------------------//
  window.requestAnimationFrame(check);

  //used to render only every other frame
  //decreases the max framerate to 30, but 
  //decreases how demanding it is
  var flipFlop = true;
  function check() {
    //see if the scene has changed, and if so, render
    //this saves a lot of processing power
    window.requestAnimationFrame(check);
    //setTimeout(check, 5000);
    let loaded = mainShader.loaded;
    if (data.animate) {
      data.cameraUniforms.u_angles[0]++;
      data.didChange = true;
    }
    if (loaded && flipFlop && data.didChange) {
      render();
      data.didChange = false;
    }
    flipFlop = !flipFlop;
  }

  //called every frame in which something is changed:
  function render() {
    // pass the uniforms once per frame
    // these are not passed elsewhere to ensure they are not
    // changed more than once per frame.
    // optimizations are left to the ComputeShader class
    mainShader.pass(data.settings);
    mainShader.pass(data.variables);
    mainShader.execute(data.cameraUniforms);
  }
//#endregion renderloop

//#region input handling------------------------//
  //TODO: handle inputs

  data.event = {
    pressed: false,
    sensitivity: 0.5,
    prevMouse: [0,0],
    onup: null
  }

  function bodyup(e) {
    data.event.pressed = false;
    if (data.event.onup) {
      // handle up events from other objects
      data.event.onup(e);
      data.event.onup = null;
    }
  }

  function canvasdown(e) {
    data.event.pressed = true;
    data.event.prevMouse = [e.clientX, e.clientY];
  }

  function canvasmove(e) {
    if (data.event.pressed) {
      // TODO: add setting for sensitivity
      if (!data.animate) {
        data.cameraUniforms.u_angles[0] -= (e.clientX - data.event.prevMouse[0]) * data.event.sensitivity;
      }
      data.cameraUniforms.u_angles[1] -= (e.clientY - data.event.prevMouse[1]) * data.event.sensitivity;
      if (data.event.prevMouse != [e.clientX, e.clientY]) {
        data.didChange = true;
        data.event.prevMouse = [e.clientX, e.clientY];
      }
    }
  }

  function canvasscroll(e) {
    data.cameraUniforms.u_zoom += e.originalEvent.deltaY * data.event.sensitivity * data.cameraUniforms.u_zoom / 15.;
    data.didChange = true;
  }

  $("canvas").on("mousedown", canvasdown);
  $("body").on("mouseup", bodyup);
  $("body").on("mousemove", canvasmove);
  $("canvas").on("touchstart", (e) => {canvasdown({clientX: e.touches[0].clientX,clientY: e.touches[0].clientY})});
  $("body").on("touchend", bodyup);
  $("body").on("touchmove", (e) => {canvasmove({clientX: e.touches[0].clientX,clientY: e.touches[0].clientY})});
  $("canvas").on("wheel", canvasscroll);

  function getVariables() {
    let res = "";
    for (let e in data.variables) {
      res += `uniform float ${e};\n`;
    }
    return res;
  }

  /**
   * Formats a string
   * @param {string} str - the string to replace in
   * @param {any} obj - the values to put in
   * @returns {string}
   */
  function format(str, obj) {
    for (let e in obj) {
      let r = "${" + e + "}";
      while (str.indexOf(r) > 0) {
        str = str.replace(r, obj[e]);
      }
    }
    return str;
  }

  function sleep(ms) {
     return new Promise(resolve => setTimeout(resolve, ms));
  }

  // insert the function into the shader and recompile
  async function processMainShaderCode() {
    // somehow, this makes it work?
    await sleep(1);
    let funclist = funcs;
    let textlist = [];
    hideVariables();
    for (let i in funclist) {
      let e = funclist[i];
      if (e.value === undefined) {continue;}
      let eq = latex2GLSL(e.value);
      console.log("Parsed equation: " + eq);
      let vars = eq.matchAll(/u_(([a-zA-Z]|\\[a-zA-Z]+)(_([a-zA-Z0-9]+))?)\b/g);
      for (let v of vars) {
        let name = v[0].replace(/\\/g, "");// just the entire match2
        let latexname = v[0].slice(2).replace(new RegExp(`(${v[4]})`), "{$1}");// change back to latex
        if (!(name == "u_phi_0")) // to allow it to be a constant
          addVariable(name, latexname);
      }
      textlist.push(`${eq.replace(/\\/g, "")}`);
    }
    let sourcecode = format(data.loadedShaderCode, {variables: getVariables()});
    while (sourcecode.indexOf("FOREACH") >= 0) {
      let index = sourcecode.indexOf("FOREACH");
      let start = index + "FOREACH".length;
      while (sourcecode[start] != "{") {
        start++;
      }
      let level = 1;
      let end = start;
      while (level > 0) {
        end++;
        if (sourcecode[end] == "{") {
          level++;
        }
        if (sourcecode[end] == "}") {
          level--;
        }
      }
      let inner = sourcecode.substr(start + 1, end - start - 2);
      let replace = "";
      for (let i in textlist) {
        let eq = textlist[i];
        let ineq = "false";
        
        if (eq.match(/(<|>|<=|>=)/)) {
          var tempList = eq.split(/(<=|>=)/);
          if (tempList.length == 1){
            tempList = eq.split(/(<|>)/);
          }
          if (tempList.length > 3) {
            return "error";
          }
          ineq = `${eq}`;
          eq = `(${tempList[0]}) - (${tempList[2]})`;
        }
        replace += format(inner, {i:i,eq:eq,ineq:ineq,MAX_I:textlist.length});
      }
      sourcecode = sourcecode.slice(0, index) + replace + sourcecode.slice(end + 1);
    }
    mainShader.code = sourcecode;
    data.didChange = true;
  }

  function save(e) {
    render();
    let url = canvas.toDataURL();
    window.open(url);
  }

  $("#download").on("click", save);

  function link(e) {
    let eqList = [];

    for (let f of funcs) {
      eqList.push(f.value);
    }
    let url = window.location.origin + window.location.pathname;
    let eqs = [];
    for (let eq of eqList) {
      eqs.push(`"${eq}"`);
    }
    url += `?eqs=[${eqs}]`;
    url += `&angles=[${data.cameraUniforms.u_angles}]`;
    url += `&zoom=${data.cameraUniforms.u_zoom}`;
    // the string needs to be doubly escaped to be valid JSON
    url = encodeURI(url.replace(/\\/g, "\\\\"));
    message("Copied URL to Clipboard");
    console.log("Copied URL to Clipboard: " + url);
    navigator.clipboard.writeText(url);
  }

  $("#link").on("click", link);
//#endregion input handling

  function message(text) {
    let m = document.createElement("div");
    m.classList.add("message");
    m.innerHTML = text;
    m.onclick = () => {
      document.body.removeChild(m);
    }
    setTimeout(() => {
      m.style.opacity = 0;
      setTimeout(m.onclick, 2000);
    }, 3000);
    document.body.appendChild(m);
  }
};
