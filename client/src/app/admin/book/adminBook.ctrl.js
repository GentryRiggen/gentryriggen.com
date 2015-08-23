(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AdminBookCtrl', AdminBookController);

  AdminBookController.$inject = ['BookService', '$stateParams', 'AlertService'];
  function AdminBookController(BookService, $stateParams, AlertService) {
    var AdminBookCtrl = this;
    AdminBookCtrl.book = false;

    function init() {
      AlertService.showLoading('Fetching Book Details...');
      BookService.getById($stateParams.id).then(
        function(resp) {
          AdminBookCtrl.book = resp.data;
          AlertService.hideLoading();
        }, function() {
          AlertService.showAlert('error', 'Failure', 'Failed to get book details!');
          AlertService.hideLoading();
        });
    }

    init();
  }
})();
