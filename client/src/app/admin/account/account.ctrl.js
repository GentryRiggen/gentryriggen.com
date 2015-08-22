(function () {
  'use strict';
  angular
    .module('gr')
    .controller('AccountCtrl', AccountController);

  AccountController.$inject = ['AccountService', '$stateParams', 'AlertService'];
  function AccountController(AccountService, $stateParams, AlertService) {
    var AccountCtrl = this;
    AccountCtrl.account = AccountCtrl.roles = false;
    AccountCtrl.password = '';

    function init() {
      AlertService.showLoading("Fetching Account Details...");
      AccountService.getById($stateParams.id).then(
        function(resp) {
          AccountCtrl.account = resp.data.user;
          AccountCtrl.roles = resp.data.roles;
          angular.forEach(AccountCtrl.roles, function(role) {
            role.selected = false;
            angular.forEach(AccountCtrl.account.roles, function(userRole) {
              if (role.title == userRole) {
                role.selected = true;
              }
            });
          });
          AlertService.hideLoading();
        }, function() {
          AlertService.showAlert('error', 'Failure', 'Failed to get account details!');
          AlertService.hideLoading();
        });
    }

    AccountCtrl.userUpdated = function() {
      AccountService.updateUser(AccountCtrl.account.id, AccountCtrl.account).then(
        function() {
          AlertService.showAlert('success', 'Success', 'Updated account details');
        }, function() {
          AlertService.showAlert('error', 'Failure', 'Failed to update account details!');
        })
    };

    AccountCtrl.updatePassword = function() {
      AccountService.updateUserPassword(AccountCtrl.account.id, AccountCtrl.password).then(
        function() {
          AlertService.showAlert('success', 'Success', 'Updated account password');
        }, function() {
          AlertService.showAlert('error', 'Failure', 'Failed to update account password!');
        });
    };

    AccountCtrl.roleChanged = function() {
      var selectedRoles = [];
      angular.forEach(AccountCtrl.roles, function(role) {
        if (role.selected) {
          selectedRoles.push(role);
        }
      });

      AccountService.updateUserRoles(AccountCtrl.account.id, selectedRoles).then(
        function() {
          AlertService.showAlert('success', 'Success', 'Updated account roles');
        }, function() {
          AlertService.showAlert('error', 'Failure', 'Failed to update account roles!');
        })
    };

    init();
  }
})();
