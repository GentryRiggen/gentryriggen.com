(function () {
    'use strict';
    angular
        .module('gr')
        .controller('headerCtrl', ['$scope', 'authToken', headerCtrl]);

    function headerCtrl($scope, authToken) {
        $scope.isAuthenticated = authToken.isAuthenticated;
    }
})();