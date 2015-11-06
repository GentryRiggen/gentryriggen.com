var util = {
  idToMMObjArr: function(arrFieldName, idArray, otherFieldName, otherId) {
    return idArray.map(function(o) {
      var x = {};
      x[arrFieldName] = o;
      x[otherFieldName] = otherId;
      return x;
    });
  }
};

module.exports = util;
