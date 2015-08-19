(function() {
  'use strict';
  angular.module('gr')
    .factory('toastr', toastr);

  toastr.$inject = ['$window'];
  function toastr($window) {
      return $window.toastr;
  }
})();
