(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AccountsCtrl', AccountsController);

  AccountsController.$inject = ['AccountService', '$state', 'AlertService'];
  function AccountsController(AccountService, $state, AlertService) {
    var AccountsCtrl = this;
    AccountsCtrl.accounts = [];

    function init() {
      AlertService.showLoading("Fetching Accounts...");
      AccountService.getAll().then(
        function (resp) {
          AccountsCtrl.accounts = resp.data;
          AlertService.hideLoading();
        }, function () {
          AlertService.showAlert('error', 'Failure', 'Failed to get accounts!');
          AlertService.hideLoading();
        });
    }

    AccountsCtrl.rowClicked = function (id) {
      $state.go('admin.account', {'id': id});
    };

    init();
  }
})();
