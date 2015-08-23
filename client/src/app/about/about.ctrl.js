(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AboutCtrl', AboutController);

  AboutController.$inject = ['$timeout', '$window'];
  function AboutController($timeout, $window) {

    function init() {
    }

    init();
  }
})();
