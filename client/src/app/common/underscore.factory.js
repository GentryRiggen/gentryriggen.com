(function() {
  'use strict';
  angular.module('gr')
    .factory('_', underscore);

  underscore.$inject = ['$window'];
  function underscore($window) {
      return $window._;
  }
})();
