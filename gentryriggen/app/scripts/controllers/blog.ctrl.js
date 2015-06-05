(function () {
    'use strict';
    angular
        .module('gr')
        .controller('blogCtrl', ['alert', 'blogService', '$location', blogCtrl]);

    function blogCtrl(alert, blogService, $location) {
        var vm = this;
        vm.blogPosts = [];

        var main = function () {
            blogService.getPaginated()
                .success(function (response) {
                    vm.blogPosts = response;
                }).error(function (err) {
                    alert.showMessage("warning", "Uh oh!", "Could not retrieve blog posts!");
                });
        };

        main();
    }
})();