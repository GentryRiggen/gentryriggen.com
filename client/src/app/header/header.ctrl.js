(function () {
  'use strict';
  angular
    .module('gr')
    .controller('HeaderCtrl', HeaderController);

  HeaderController.$inject = ['$scope', 'UserService', '$state', '$mdSidenav'];
  function HeaderController($scope, UserService, $state, $mdSidenav) {
    var HeaderCtrl = this;

    function checkUserAuth() {
      UserService.getCurrentUser().then(
        function (user) {
          updatePermissions(user);
        }, function () {
          updatePermissions();
        }
      );
    }

    function updatePermissions(data) {
      if (angular.isDefined(data)) {
        HeaderCtrl.currentUser = angular.isDefined(data.user) ? data.user : data;
        angular.forEach(HeaderCtrl.currentUser.roles, function (role) {
          if (role == "Admin" || role == "Editor") HeaderCtrl.showModerator = true;
        });
      } else {
        HeaderCtrl.currentUser = false;
        HeaderCtrl.showModerator = false;
      }
    }

    HeaderCtrl.navigate = function (state) {
      $mdSidenav("sideNav").close();
      $state.go(state);
    };

    HeaderCtrl.toggleNav = function () {
      $mdSidenav("sideNav").toggle();
    };

    $scope.$on('gr.user.logout', function () {
      updatePermissions();
    });

    $scope.$on('gr.user.login', function (event, authResponse) {
      updatePermissions(authResponse);
    });

    checkUserAuth();
  }
})();
