
exports.applyIntegerBoundaries = function(min, max, value) {
  if (value > max) {
    return max;
  } else if (value < min) {
    return min;
  }
  return value;
};
