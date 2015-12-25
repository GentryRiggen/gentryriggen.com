(function () {
  'use strict';
  angular
    .module('gr')
    .controller('ShellCtrl', ShellController);

  ShellController.$inject = ['$scope', 'UserService', '$state', '$mdMedia', '$window'];
  function ShellController($scope, UserService, $state, $mdMedia, $window) {
    var ShellCtrl = this;
    ShellCtrl.smallScreen = !$mdMedia('min-width: 900px');
    ShellCtrl.toggle = $mdMedia('min-width: 900px');

    ShellCtrl.toggleMenu = function() {
      ShellCtrl.smallScreen = !$mdMedia('min-width: 900px');
      ShellCtrl.toggle = !ShellCtrl.toggle;
    };

    // SCREEN RESIZE EVENTS
    var w = angular.element($window);
    $scope.$watch(function (){return w.width();}, function (screenWidth) {
      ShellCtrl.toggle = screenWidth > 900;
    }, true);

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
        ShellCtrl.currentUser = angular.isDefined(data.user) ? data.user : data;
        angular.forEach(ShellCtrl.currentUser.roles, function (role) {
          if (role == "Admin" || role == "Editor") ShellCtrl.showModerator = true;
        });
      } else {
        ShellCtrl.currentUser = false;
        ShellCtrl.showModerator = false;
      }
    }

    ShellCtrl.navigate = function (state) {
      $state.go(state);
    };

    $scope.$on('gr.user.logout', function () {
      updatePermissions();
    });

    $scope.$on('gr.user.login', function (event, authResponse) {
      updatePermissions(authResponse);
    });

    $scope.$on('$stateChangeStart', function (event, toState) {
      if (ShellCtrl.toggle && w.width() <= 900) {
        ShellCtrl.toggleMenu();
      }

      ShellCtrl.adminOpen = toState.name.indexOf('admin') !== -1;
      ShellCtrl.healthOpen = toState.name.indexOf('health') !== -1;
    });

    ShellCtrl.toggleDrawerDropdown = function (name) {
      switch (name) {
        case 'health':
          ShellCtrl.healthOpen = !ShellCtrl.healthOpen;
          console.log(ShellCtrl.healthOpen);
          break;
        case 'admin':
          ShellCtrl.adminOpen = !ShellCtrl.adminOpen;
          break;
      }
    };

    checkUserAuth();
  }
})();
