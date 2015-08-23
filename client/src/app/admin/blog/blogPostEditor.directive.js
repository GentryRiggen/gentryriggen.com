(function () {
    'use strict';
    angular
        .module('gr')
        .directive('blogPostEditor', blogPostEditor);

    blogPostEditor.$inject = ['$state', '$sce', 'AlertService', '$mdDialog', 'BlogService', '$q', '$window'];
    function blogPostEditor($state, $sce, AlertService, $mdDialog, BlogService, $q, $window) {
        return {
            restrict: 'E',
            scope: {
                model: '=post'
            },
            templateUrl: '/src/app/admin/blog/blogPostEditor.tmpl.html',
            controller: function ($scope) {
                $scope.currentTab = 1;

                $scope.showTab = function (tabNumber) {
                    $scope.currentTab = parseInt(tabNumber);
                };

                $scope.save = function () {
                    var deferred = $q.defer();
                    BlogService.save($scope.model.id, $scope.model)
                        .success(function () {
                            AlertService.showAlert('success', 'Success!', 'Blog Post has been saved');
                            deferred.resolve();
                        })
                        .error(function () {
                            AlertService.showAlert('error', 'Failed', 'Failed to save Blog Post');
                            deferred.reject();
                        });

                    return deferred.promise;
                };

                $scope.delete = function (event) {
                    var confirm = $mdDialog.confirm()
                      .parent(angular.element($window.document.body))
                      .title('Are you sure?')
                      .content('Are you sure you want to delete this blog post?')
                      .ariaLabel('Delete Blog Post')
                      .ok('OK')
                      .cancel('Cancel')
                      .targetEvent(event);
                    $mdDialog.show(confirm).then(function () {
                        BlogService.deleteById($scope.model.id)
                            .success(function () {
                                AlertService.showAlert('success', 'Success!', 'Blog Post has been deleted');
                                $state.go('admin.blog');
                            })
                            .error(function () {
                                AlertService.showAlert('error', 'Failed', 'Failed to delete Blog Post');
                            });
                    });
                };
            }
        };
    }
})();
