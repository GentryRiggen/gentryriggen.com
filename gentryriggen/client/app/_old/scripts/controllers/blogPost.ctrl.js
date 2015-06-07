(function () {
    'use strict';
    angular
        .module('gr')
        .controller('blogPostCtrl', ['$state', '$stateParams', 'alert', 'blogService', 'blogPost', blogPostCtrl]);

    function blogPostCtrl($state, $stateParams, alert, blogService, blogPost) {
        var vm = this;
        vm.blogPost = blogPost;

        var main = function () {
            if (typeof $stateParams.permalink != 'undefined') {
                blogService.getByPermalink($stateParams.permalink)
                    .success(function (response) {
                        vm.blogPost = response;
                    }).error(function (err) {
                        alert.showMessage("danger", "Uh oh!", "Could not get that blog post...");
                    });
            } else {
                alert.showMessage("danger", "Uh oh!", "Could not find blog post!");
                $state.go('blog');
            }
        };

        main();
    }
})();