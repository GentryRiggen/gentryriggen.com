(function () {
  'use strict';
  angular
    .module('gr')
    .controller('ShellCtrl', ShellController);

  ShellController.$inject = ['$scope', 'UserService', '$state', '$mdMedia', '$window'];
  function ShellController($scope, UserService, $state, $mdMedia, $window) {
    var ShellCtrl = this;
    ShellCtrl.toggle = ShellCtrl.largeScreen;

    ShellCtrl.toggleMenu = function(toggle, mouseMovement) {
      if (ShellCtrl.smallScreen && mouseMovement === true) {
        return;
      } else if (ShellCtrl.largeScreen) {
        ShellCtrl.toggle = true;
      } else {
        ShellCtrl.toggle = toggle ? toggle : !ShellCtrl.toggle;
      }
    };

    // SCREEN RESIZE EVENTS
    angular.element($window).resize(function(){
      $scope.$apply(function(){
        ShellCtrl.smallScreen = window.innerWidth <= 600;
        ShellCtrl.largeScreen = window.innerWidth >= 1000;
        ShellCtrl.toggle = ShellCtrl.largeScreen;
      });
    });

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
      if (ShellCtrl.smallScreen) {
        ShellCtrl.toggle = false;
      }

      ShellCtrl.adminOpen = toState.name.indexOf('admin') !== -1;
      ShellCtrl.healthOpen = toState.name.indexOf('health') !== -1;
    });

    ShellCtrl.toggleDrawerDropdown = function (name) {
      switch (name) {
        case 'health':
          ShellCtrl.healthOpen = !ShellCtrl.healthOpen;
          break;
        case 'admin':
          ShellCtrl.adminOpen = !ShellCtrl.adminOpen;
          break;
      }
    };

    checkUserAuth();
  }
})();
