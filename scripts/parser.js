/**
 * A module for parsing the latex code into GLSL
 */

"use strict";

/**
 * Divides a latex string into independent tokens for 
 * further parsing
 * @param {String} latexStr - the latex code to split
 */
function splitTokens(latexStr) {
  //loop through the string, breaking on each token type.
  let tokenTypes = {
    // in order of precedence:
    space: /\\? /g,
    bracket: /[[\](){}]/g,
    operator: /[+\-*/^_,]/g,
    comparison: /(<=|>=|<|>|=)|\\(lt|le|eq|gt|ge)(?![a-zA-Z])/g,
    number: /(\d+\.?\d*|\d*\.?\d+)/g,
    escape: /\\[a-zA-Z]+\b/g,
    variable: /([a-zA-Z]|\\[a-zA-Z]+)(_[a-zA-Z0-9]|_{[a-zA-Z0-9]+})?/g,
    singleslash: /\\/g,
  }
  let extractedTokens = [];
  let tries = 0, LIMIT = 1000;
  while (latexStr.length > 0 && tries < LIMIT) {
    console.log(latexStr);
    for (let type in tokenTypes) {
      let tkn = tokenTypes[type];
      if (latexStr.search(tkn) === 0) {
        if (type === "space") {
          // spaces are not important to this parser after splitting
          latexStr = latexStr.slice(1);
          continue;
        }
        // the current token type is in the front. Extract it.
        let matches = latexStr.match(tkn);
        let match = matches[0];
        extractedTokens.push({
          type,
          string: match
        });
        latexStr = latexStr.slice(match.length);
        break;
      }
    }
    tries++;
  }
  return extractedTokens;
}

/**
 * converts a single latex token to GLSL code
 * @param {{type: String,string: String}} token - the token to parse
 */
function convertToken(token) {
  let s = token.string;
  switch (token.type) {
    case "bracket":
      return s.match(/[[({]/g) ? "(": ")";
    case "variable":
      // match special variables
      if (s.match(/^[xyz]$/g)) {
        // replace with the pt.x version
        return "pt." + s;
      } else if (s.match(/^[er]$/g)) {
        return s;
      } else {
        return "u_" + s.replace(/[{}]/g, "");
      }
    case "operator":
      return s;
    case "escape":
      let specialVars = /(rho|theta|phi|pi)/g;
      let functions = /(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|log|floor|mod|max|min|step|smoothstep|round|float|int|abs)/g;
      let keywords = new RegExp(`${specialVars.source}|${functions.source}`, "g");
      let specialCases = /(cdot|ln)/g;
      if (s.match(keywords)) {
        // convert arc trig to asin, acos, atan
        // TODO: add sec csc and cot support
        s = s.replace(/arc(sin|cos|tan)/g, "a$1");
        return s.slice(1);
      } else if (s.match(specialCases)) {
        switch (s.slice(1)) {
          case "cdot":
            return "*";
          case "ln":
            return "log";
        }
      } else return s; // let the second run handle it
    case "comparison":
      switch (s){
        case "\\le":
          return "<=";
        case "\\lt":
          return "<";
        case "\\ge":
          return ">=";
        case "\\gt":
          return "<";
        case "\\eq":
        case "=":
          return ") - (";
        default:
          return s;
      }
    case "number":
      // ensure it is floating-point
      return s.replace(/((?!\.).\b(\d+)(?!\.)\b)|^\b(\d+)(?!\.)\b/g, "$1$3.");
    case "singleslash":
      return "";
    default:
      console.error(`Token ${token.string} with type ${token.type} not recognized.`);
      return "";
  }
}

/**
 * Moves through a list and finds the location after the 
 * next item, taking into account parentheses
 * @param {String[]} list - the list to check
 * @param {Number} startIndex - the starting location in the array
 * @param {Boolean} reverse - whether to move backwards
 */
function getNextParentheses(list, startIndex, reverse) {
  reverse = reverse || false;
  let direction = reverse ? -1: 1;
  let bracketType = reverse ? ")": "(";
  if (list[startIndex] !== bracketType) return startIndex + (direction + 1) / 2;
  let bracketLevel = 1;
  while (bracketLevel > 0) {
    startIndex += direction;
    if (list[startIndex] == "(") bracketLevel+= direction;
    if (list[startIndex] == ")") bracketLevel-= direction;
  }
  return startIndex;
}

/**
 * inserts an element at the given index and returns the new array
 * @param {Any[]} arr - the array
 * @param {Any} obj - the object to insert
 * @param {Number} ind - the index to insert at
 */
function insert(arr, obj, ind) {
  let newarr = arr.slice(0,ind);
  newarr.push(obj, ...arr.slice(ind))
  return newarr;
}

/**
 * Parses the given LaTeX into valid GLSL code with these variables:  
 * - pt.x: the x position  
 * - pt.y: the y position  
 * - pt.z: the z position  
 * - r: sqrt(x^2 + y^2)  
 * - rho: sqrt(x^2 + y^2 + z^2)  
 * - theta: atan(y/x)  
 * - phi: atan(z/r)  
 * - pi: the mathematical constant  
 * - e: the mathematical constant  
 * @param {String} latexStr - the string to parse (assumed to be valid LaTeX)
 */
function latex2GLSL(latexStr) {
  let spec = /(pow|cust_pow|asin|acos|atan|log|floor|mod|max|min|step|smoothstep|round|float|int|abs)/g;
  latexStr = latexStr.replace(spec, "\\$1");
  let tokens = splitTokens(latexStr);
  // we wrap the entire equation in a set of parentheses to 
  // allow replacing = with ") - ("
  let glslTokens = ["("]; 
  for (let el of tokens) {
    glslTokens.push(convertToken(el));
  }
  for (let i = 0; i < glslTokens.length;i++) {
    let el = glslTokens[i];
    let prevEl = glslTokens[i - 1] || "+";
    // manage all of the multi-token changes, such as power
    if (el.match(/\\[a-zA-Z]+\b/)) {
      switch (el.slice(1)) {
        case "frac":
          let afterNextGroup = getNextParentheses(glslTokens, i + 1);
          glslTokens = insert(glslTokens, "/", afterNextGroup + 1);
          glslTokens.splice(i,1);
          i--;
          continue;
        default:
          // remove it.
          glslTokens.splice(i,1);
          i--;
          continue;
      }
    }
    if (el == "^") {
      // we need to rearrange like this:
      // (...) ^ (...)
      // cust_pow((...), (...))
      let after = getNextParentheses(glslTokens, i + 1);
      let before = getNextParentheses(glslTokens, i - 1, true);
      let temp = glslTokens.slice(0,before);
      temp.push(
        "cust_pow", "(", 
        ...glslTokens.slice(before, i), 
        ",", 
        ...glslTokens.slice(i + 1, after), 
        ")",
        ...glslTokens.slice(after));
      glslTokens = temp;
    }
    if (el == "_") {
      //TODO: add subscripted variable support
    }
    //update the element and previous element, as they may have changed
    el = glslTokens[i];
    prevEl = glslTokens[i - 1] || "*";
    if (!prevEl.match(/[+\-*,/]|<|<=|=|>=|>/) && !el.match(/[+\-*,/]|<|<=|=|>=|>/)) {
      // could need a multiplication sign
      let functions = /(pow|cust_pow|sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|log|floor|mod|max|min|step|smoothstep|round|float|int|abs)/g;
      if (!prevEl.match(functions) && !(prevEl == "(") && !(el == ")")) {
        glslTokens = insert(glslTokens, "*", i);
      }
    }
  }
  return glslTokens.join(" ") + " )";
}
