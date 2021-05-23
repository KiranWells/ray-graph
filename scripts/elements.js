/**
 * A set of custom input elements to handle math and unlimited sliders
 */

"use strict";
// depends on MathQuill: https://mathquill.com/
let MQ = MathQuill.getInterface(2);

/**
 * A custom input element that allows 
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
  startV;
  sensitivity = 0.5;

  /**
   * Creates the DOM elements and the main object
   * @param {Function} onchange - The function to call when the number changes
   * @param {String} name - the label to be shown for the value
   * @param {Number} [value] - the default value
   * @param {Number} [sensitivity] - the sensitivity
   * @param {Number} [min] - the minimum value the dragger will allow
   * @param {Number} [max] - the maximum value the dragger will allow
   * @param {Boolean} [enableMath] - whether to use MathQuill
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
    this.element.onmouseup = (e) => {if (this.startV == (e.clientX - e.clientY)) {message("Click and drag or scroll")}};
    this.element.ontouchstart = (e) => {this.ondragstart({preventDefault:(() => {e.passive = false;e.preventDefault();}),clientX: e.touches[0].clientX,clientY: e.touches[0].clientY})};
    this.element.onwheel = (e) => {this.onwheel(e)};
    this.element.ontouchmove = (e) => {this.ondrag({preventDefault:(() => {e.passive = false;e.preventDefault();}),clientX: e.touches[0].clientX,clientY: e.touches[0].clientY})};
    this.element.ontouchend = (e) => {this.ondragend(e)};

    // the way this element allows dragging outside of its bounds
    // is by adding events to the body element. To ensure
    // any other previously set events are handled, they need to
    // be saved and called beforehand
    let temp = document.body.onmousemove || (()=>{});
    document.body.onmousemove = (e) => {temp(e);this.ondrag(e)};
    let temp1 = document.body.onmouseup || (()=>{});
    document.body.onmouseup = (e) => {temp1(e);this.ondragend(e)};
    let temp2 = document.body.onmouseleave || (()=>{});
    document.body.onmouseleave = (e) => {temp2(e);this.ondragend(e)};

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

  handleValueChange() {
    if (this.value < this.min) {
      this.value = this.min;
    }
    if (this.value > this.max) {
      this.value = this.max;
    }
    this.setText();
    this.onchange(this.value);
  }

  ondragstart(e) {
    e.preventDefault();
    this.pressed = true;
    this.prevV = e.clientX - e.clientY;
    this.startV = e.clientX - e.clientY;
  }

  ondrag(e) {
    if (this.pressed) {
      e.preventDefault();
      this.value += (e.clientX - e.clientY - this.prevV) * this.sensitivity;
      this.prevV = e.clientX - e.clientY;
      this.handleValueChange();
    }
  }

  onwheel(e) {
    e.preventDefault();
    this.value -= e.deltaY * this.sensitivity * 0.15;
    this.prevV = e.clientX;
    this.handleValueChange();
  }

  ondragend(e) {
    // for some reason, onmouseleave doesn't give e
    if (e) {e.preventDefault();}
    this.pressed = false;
  }
}

/**
 * A custom math equation input element
 * @class
 */
class Equation {
  _equation = "";
  _hue = 0;
  onchange = () => {};

  /**
   * Creates DOM elements and initializes
   * @param {Function} onchange - the function to run when the value changes
   * @param {Function} ondelete - the function to run when the equation is deleted
   * @param {Number} id - a unique identifier
   * @param {String} [equation] - the equation to use
   * @constructor
   */
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
  }

  delete () {
    this.rootelement.parentElement.removeChild(this.rootelement);
    this.ondelete(this.id);
  }

  /**
   * Recreates the MathQuill input to set a new value
   * @private
   */
  _setMath() {
    if (this.mathField)
      this.mathField.revert();
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
   * The color indicator of the function
   * @param {Number} val
   * @property
   */
  set hue(val) {
    // change the color indicator
    this._hue = val;
    this.labelelement.style.filter = "hue-rotate(-" + (this._hue * 360) + "deg)";
  }

  /**
   * The value of the underlying text input
   * @param {String} val
   * @property
   */
  set equation(val) {
    // make sure it will be typed correctly:
    this._equation = val;
    this._setMath();
  }

  /**
   * The current string for the equation
   * @property
   */
  get value() {
    return this._equation;
  }
}
