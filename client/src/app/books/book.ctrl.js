(function () {
  'use strict';
  angular
    .module('gr')
    .controller('BookCtrl', BookController);

  BookController.$inject = ['$stateParams', 'BookService', 'AlertService', '$state', '$window'];
  function BookController($stateParams, BookService, AlertService, $state, $window) {
    var BookCtrl = this;

    function init() {
      if (angular.isDefined($stateParams.id)) {
        AlertService.showLoading("Fetching Book...");
        BookService.getById($stateParams.id)
          .then(function (resp) {
            AlertService.hideLoading();
            BookCtrl.book = resp.data;
          }, function () {
            AlertService.showAlert('error', 'Failed', 'Failed to get book details');
            AlertService.hideLoading();
          });
      } else {
        AlertService.showAlert('error', 'Failed', 'Failed to get book details');
        $state.go('books');
      }
    }

    BookCtrl.currentUrl = function() {
      return $window.location.href;
    };

    init();
  }
})();
