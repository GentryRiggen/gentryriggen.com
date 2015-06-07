(function () {
    'use strict';
    angular
        .module('gr')
        .directive('blogPostEditView', ['$state', '$sce', 'alert', 'dialog', 'blogService', blogPostEditViewDirective]);

    function blogPostEditViewDirective($state, $sce, alert, dialog, blogService) {
        return {
            restrict: 'E',
            scope: {
                model: '=post',
                goBack: '&whenDone'
            },
            templateUrl: '/app/views/directives/blogPostEditView.html',
            controller: function ($scope) {
                $scope.currentTab = 1;

                $scope.showTab = function (tabNumber) {
                    $scope.currentTab = parseInt(tabNumber);
                };

                $scope.save = function (callback) {
                    blogService.save($scope.model.id, $scope.model)
                        .success(function (data, status, headers, config) {
                            if (status === 201)
                                $scope.model = data;
                            alert.showMessage('success', 'Saved!');
                            if (typeof callback != 'undefined')
                                callback();
                        })
                        .error(function (err) {
                            alert.showMessage("danger", "Uh oh!", "Could not save...");
                        });
                };

                $scope.saveAndClose = function () {
                    $scope.save(function () {
                        $scope.goBack();
                    });
                };

                $scope.delete = function () {
                    dialog.confirm('Are you sure?', 'Are you sure you want to delete this blog post?').then(function () {
                        blogService.deleteById($scope.model.id)
                            .success(function (data, status, headers, config) {
                                alert.showMessage('success', 'Deleted!');
                                $state.go('blogAdmin');
                            })
                            .error(function (err) {
                                alert.showMessage("danger", "Uh oh!", "Could not delete...");
                            });
                    });
                };
            }
        }
    };
})();