(function() {
  'use strict';

  angular
    .module('gentryriggenCom')
    .run(runBlock);

  /** @ngInject */
  function runBlock($log) {

    $log.debug('runBlock end');
  }

})();
