/**
 * A set of custom input elements to handle math and unlimited sliders
 */

"use strict";
// depends on MathQuill: https://mathquill.com/
let MQ = MathQuill.getInterface(2);

/**
 * A custom input element that allows \
 * for unlimited sliders
 * @class
 */
class Dragger {
  pressed = false;
  element;
  value = 0;
  min = -Number.MAX_VALUE;
  max = Number.MAX_VALUE;
  prevV;
  sensitivity = 0.5;

  /**
   * Creates the DOM elements and the main object
   * @param onchange - The function to call when the number changes
   * @param [value] - the default value
   * @param [sensitivity] - the sensitivity
   * @constructor
   */
  constructor(onchange, name, value, sensitivity, min, max, enableMath) {
    value = value || this.value;
    sensitivity = sensitivity || this.sensitivity;
    if (min === undefined || min === null)
      min = this.min;
    if (max === undefined || max === null)
      max = this.max;
    this.element = document.createElement("div")
    this.element.classList.add("dragger");
    this.element.onmousedown = (e) => {this.ondragstart(e)};
    this.element.ontouchstart = (e) => {this.ondragstart({preventDefault:(() => {}),clientX: e.touches[0].clientX,clientY: e.touches[0].clientY})};
    this.element.onwheel = (e) => {this.onwheel(e)};
    let temp = document.body.onmousemove || (()=>{});
    document.body.onmousemove = (e) => {temp(e);this.ondrag(e)};
    let temp1 = document.body.onmouseup || (()=>{});
    document.body.onmouseup = (e) => {temp1(e);this.ondragend(e)};
    let temp2 = document.body.onmouseleave || (()=>{});
    document.body.onmouseleave = (e) => {temp2(e);this.ondragend(e)};

    let temp3 = document.body.ontouchmove || (()=>{});
    document.body.ontouchmove = (e) => {temp3(e);this.ondrag({preventDefault:(() => {}),clientX: e.touches[0].clientX,clientY: e.touches[0].clientY})};
    let temp4 = document.body.ontouchend || (()=>{});
    document.body.ontouchend = (e) => {temp4(e);this.ondragend(e)};

    this.nameEl = document.createElement("span");
    this.nameEl.id = name;
    this.nameEl.innerHTML = name;

    this.element.appendChild(this.nameEl);
    if (enableMath)
      MQ.StaticMath(this.nameEl);

    this.valueContainer = document.createElement("div");
    this.element.appendChild(this.valueContainer);

    this.onchange = onchange;
    this.sensitivity = sensitivity;
    this.value = value;
    this.name = name;
    this.min = min;
    this.max = max;

    this.setText();
  }

  setText() {
    this.valueContainer.innerHTML = `<span class="dragger-value"><i class="material-icons">unfold_more</i> ${Math.round(this.value * 10) / 10}</span>`;
  }

  ondragstart(e) {
    e.preventDefault();
    this.pressed = true;
    this.prevV = e.clientX - e.clientY;
  }

  ondrag(e) {
    if (this.pressed) {
      e.preventDefault();
      this.value += (e.clientX - e.clientY - this.prevV) * this.sensitivity;
      if (this.value < this.min) {
        this.value = this.min;
      }
      if (this.value > this.max) {
        this.value = this.max;
      }
      this.setText();
      this.onchange(this.value);
      this.prevV = e.clientX - e.clientY;
    }
  }

  onwheel(e) {
    e.preventDefault();
    this.value -= e.deltaY * this.sensitivity;
    if (this.value < this.min) {
      this.value = this.min;
    }
    if (this.value > this.max) {
      this.value = this.max;
    }
    this.setText();
    this.onchange(this.value);
    this.prevV = e.clientX;
  }

  ondragend(e) {
    // for some reason, onmouseleave doesn't give e
    if (e) {e.preventDefault();}
    this.pressed = false;
  }
}

class Equation {
  _equation = "z = x^2";
  _hue = 0;
  onchange = () => {};

  constructor (onchange, ondelete, id, equation) {
    this.onchange = onchange;
    this.rootelement = document.createElement("div");
    this.rootelement.classList.add("function")
    this.rootelement.id = "equation" + id;
    this.labelelement = document.createElement("label");
    this.labelelement.innerHTML = "f";
    this.labelelement.style.backgroundImage = "linear-gradient(60deg, rgb(33, 221, 221), rgb(80, 221, 51), rgb(245, 242, 80))";
    this.labelelement.style.filter = "hue-rotate(" + (this._hue * 360) + "deg)";
    this.rootelement.appendChild(this.labelelement);
    this.mathinput = document.createElement("span");
    this._equation= equation || "r + ax \\le " + (id + 1);
    this._setMath();
    this.closeelement = document.createElement("button");
    this.closeelement.innerHTML = '<i class="material-icons">close</i>';
    this.closeelement.onclick = () => {this.delete();};
    this.rootelement.appendChild(this.closeelement);
    this.id = id;
    this.ondelete = ondelete;
    document.getElementById("functionContainer").appendChild(this.rootelement);
  }

  delete () {
    this.rootelement.parentElement.removeChild(this.rootelement);
    this.ondelete(this.id);
  }

  /**
   * Recreates the MathQuill input to set a new value
   */
  _setMath() {
    if (this.mathField)
      this.mathField.revert();
    console.log(this.mathField);
    this.mathField = MQ.MathField(this.mathinput, {
      autoCommands: "pi rho theta phi sqrt",
      // autoFunctions: "sin cos tan asin acos atan arcsin arccos arctan sinh cosh tanh ln log sqrt",
      supSubsRequireOperand: true,
      handlers: {
        edit: () => {
          var enteredMath = this.mathField.latex(); // Get entered math in LaTeX format
          this._equation = enteredMath; 
          // TODO: only recompile on a meaningful edit, 
          // esp. for many functions - it is slow to compile
          // onchange(this._value);
        },
        enter: () => {
          if (this._equation == "") {this.delete();}
          this.onchange(this._equation);
        },
        selectOutOf: () => {
          if (this._equation == "") {this.delete();}
          this.onchange(this._equation);
        }
      }
    });
    this.mathField.write(this._equation);
    this.rootelement.appendChild(this.mathinput);
  }

  /**
   * Updates the color indicator of the function
   * @param {number} val - the hue to change to
   */
  set hue(val) {
    // change the color indicator
    this._hue = val;
    this.labelelement.style.filter = "hue-rotate(-" + (this._hue * 360) + "deg)";
  }

  /**
   * Updates the value of the underlying text input
   * @param {String} val
   */
  set equation(val) {
    // make sure it will be typed correctly:
    this._equation = val;
    this._setMath();
  }

  get value() {
    return this._equation;
  }
}