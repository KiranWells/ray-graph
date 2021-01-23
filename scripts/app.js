"use strict";

/* Main app script management
 * May need to be broken up, but
 * currently, this is the simplest way
 * to set it up
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
  },
  variables: {
  }
};

window.onload = function () {

//#region initialization------------------------//
  //initialize stats
  // var stats = new Stats();
  // stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
  // document.body.appendChild( stats.dom );

  // setup page elements
  let boundsdragger = new Dragger((n) => {
    data.settings.u_bounds = n;
    data.didChange = true;
  }, "Size", data.settings.u_bounds, 0.1, 0.0000001);
  let linedragger = new Dragger((n) => {
    data.settings.u_line_width = n;
    data.didChange = true;
  }, "Line Width", data.settings.u_line_width, 0.01, 0, 1);
  let precisiondragger = new Dragger((n) => {
    data.settings.u_step_size = 1 / n;
    data.didChange = true;
  }, "Precision", 1 / data.settings.u_step_size, 0.1, 0.1, 100);
  let zoomdragger = new Dragger((n) => {
    data.cameraUniforms.u_zoom = n;
    data.didChange = true;
  }, "Zoom", data.cameraUniforms.u_zoom, 0.5, 0.001, 1000);
  $("#mainControls").append(boundsdragger.element)
    .append(linedragger.element)
    .append(precisiondragger.element)
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
    console.log(id);
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
          }, removeEq, funcs.length));
          funcs[0]._value = streqs;
        } else {
          let eqs = JSON.parse(streqs);
          for (let e of eqs) {
            funcs.push(new Equation((t) => {
              processMainShaderCode();
            }, removeEq, funcs.length));
            funcs[funcs.length - 1]._value = e;
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
  
  function addVariable(letter) {
    if (variables["u_" + letter]) {return;}
    data.variables["u_" + letter] = 1.0;
    let e = new Dragger(
      n => {
        data.variables["u_" + letter] = n;
        data.didChange = true;
      },
      letter,
      data.variables["u_" + letter],
      0.1
    );
    variables["u_" + letter] = e;
    $("#variables").append(e.element);
  }

  addVariable("a");

  //general setup
  const canvas = $("canvas")[0];
  const glu = new WebGlUtils(canvas);
  glu.resizeCanvas();

  window.onresize = function() {
    glu.resizeCanvas();
    data.didChange = true;
  }

  let mainShader = new ComputeShader(canvas);

  //load code into each shader
  $.get("shaders/main.frag", function(response){
    data.loadedShaderCode = response;
    //make the shader (It needs to be processed with the added functions)
    processMainShaderCode();
  });
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
    // stats.begin();
    // pass the uniforms once per frame
    // these are not passed elsewhere to ensure they are not
    // changed more than once per frame.
    // optimizations are left to the ComputeShader class
    mainShader.pass(data.settings);
    mainShader.pass(data.variables);
    mainShader.execute(data.cameraUniforms);
    // stats.end();
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
  //canvas.addEventListener("wheel", () => debounce(100, () => {lowQuality = true;}, () => {lowQuality = false;didChange = true;}));
  function parse(math_str) {
    //TODO: clean up
    // process the math equation into runnable glsl code
    math_str = math_str.toLowerCase().replace(/ /g, "");

    // add support for any function format
    if (math_str.match(/(<|>|<=|>=)/)) {
      var tempList = math_str.split(/(<=|>=)/);
      if (tempList.length == 1){
        tempList = math_str.split(/[<>]/);
      }
      if (tempList.length > 3) {
        return "error";
      }
      //math_str = "(" + tempList[0] + ") - (" + tempList[1] + ")";
    } else if (math_str.indexOf("=") != -1) {
      var tempList = math_str.split("=");
      if (tempList.length > 2) {
        return "error";
      }
      if (tempList.length == 2){
        math_str = "(" + tempList[0] + ") - (" + tempList[1] + ")";
      }
    }
    
    //handle inverse trig
    math_str = math_str.replace(/arc(cos|sin|tan)/g, "a$1");
    //handle natural log
    if (math_str.indexOf("log") != -1) {
      console.log("The operator log is not supported. Try ln instead.");
      return eq;
    }
    math_str = math_str.replace(/ln/g, "log");

    // add support for multiplied concatenation
    // replace all special functions with special keys
    // split on the special keys
    // for each element, if it is not a special key, 
    // then replace every letter with u_{letter}
    // except for r,x,y,z
    let specialVars = /(rho|theta|phi|pi)/g;
    let functions = /(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|log|floor|mod|max|min|step|smoothstep|round|float|int)/g;
    let keywords = new RegExp(`${specialVars.source}|${functions}`);
    math_str = math_str.replace(keywords, "_$1_")
    let keys = math_str.split("_");
    let newKeys = [];
    for (let i in keys) {
      let e = keys[i];
      if (!e.match(keywords)) {
        e = e.replace(/x/g, ";");
        e = e.replace(/y/g, ":");
        e = e.replace(/z/g, "?");
        e = e.replace(/r/g, "$");
        e = e.replace(/([a-z])/g, "#u_$1#");
        e = e.replace(/(\d+\.?\d*|\d*\.?\d+)/g, "#$1#");
        e = e.replace(/;/g, "#pt.x#");
        e = e.replace(/:/g, "#pt.y#");
        e = e.replace(/\?/g, "#pt.z#");
        e = e.replace(/\$/g, "#r#");
        newKeys.push(...(e.split("#")));
      } else {
        newKeys.push(e);
      }
    }
    // remove empty strings
    newKeys = newKeys.filter((v,i,a) => {
      if (v == "") {
        return false;
      }
      return true;
    });
    let newString = "";
    for (let i in newKeys) {
      newString += newKeys[i];
      if (i == newKeys.length - 1) continue;
      //if (newKeys[i].match(keywords)) continue;
      if (newKeys[i].match(/[a-z0-9]/) && 
      newKeys[Number(i) + 1].match(/[a-z]|^\(/) || 
      newKeys[i].match(/[a-z]/) && 
      newKeys[Number(i) + 1].match(/[a-z0-9]|^\(/) ||
      newKeys[i].match(/[a-z0-9]|\)$/) && 
      newKeys[Number(i) + 1].match(/[a-z]|^\(/) || 
      newKeys[i].match(/[a-z]|\)$/) && 
      newKeys[Number(i) + 1].match(/[a-z0-9]/)) {
        // concatenated multiplication
        if (!newKeys[i].match(functions))
        newString += "*";
      }
      // fix concatenated parenthases
      newString = newString.replace(/\)\(/, ")*(")
    }
    math_str = newString;

    //a solution for the pow function
    //from https://stackoverflow.com/questions/4901490/rewrite-formula-string-to-replace-ab-with-math-powa-b
    var caretReplace = function(_s, symbol, func) {
      if (_s.indexOf(symbol) > -1) {
        var tab = [];
        var powfunc=func;
        var joker = "___joker___";
        while (_s.indexOf("(") > -1) {
            let reg = new RegExp("(\\([" + symbol + "\\(\\)]*\\))", "g")
            _s = _s.replace(reg, function(m, t) {
                tab.push(t);
                return (joker + (tab.length - 1));
            });
        }
        tab.push(_s);
        _s = joker + (tab.length - 1);
        while (_s.indexOf(joker) > -1) {
            _s = _s.replace(new RegExp(joker + "(\\d+)", "g"), function(m, d) {
                //had to modify this to work with decimals
                let reg = new RegExp("([\\w\\.]*)\\s*\\" + symbol + "\\s*([\\w\\.]*)", "g")
                return tab[d].replace(reg, powfunc+"($1,$2)");
            });
        }
      }
      return _s;
    };

    // format the power function
    math_str = caretReplace(math_str, "^", "cust_pow");
    //math_str = caretReplace(math_str, "%", "mod");


    //make all digits float constants
    math_str = math_str.replace(/^(\d+)(?!(\.))|((?!(\.))(.))(\d+)(?!(\.))/g, "$1$5$6.");

    // console.log(math_str);
    return math_str;
  }

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
    for (let i in funclist) {
      let e = funclist[i];
      if (e.value === undefined) {continue;}
      let eq = parse(e.value);
      let vars = eq.matchAll(/u_[a-z]/g);
      for (let v of vars) {
        let letter = v[0][2];
        addVariable(letter);
      }
      textlist.push(`${eq}`);
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
          eq = `((${tempList[0]}) - (${tempList[2]}))`;
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
    url = encodeURI(url);
    console.log(url);
    navigator.clipboard.writeText(url);
  }

  $("#link").on("click", link);
//#endregion input handling
};
