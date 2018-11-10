"use strict";

exports.applyIntegerBoundaries = function(min, max, value) {
  if (value > max) {
    return max;
  } else if (value < min) {
    return min;
  }
  return value;
};

exports.getCheckedOption = function(options, fallback, value) {
  if (options.indexOf(value) !== -1) {
    return value;
  }

  return fallback;
};
