(function () {
    'use strict';

    angular.module('gr').config(['$urlRouterProvider', '$stateProvider', '$httpProvider', '$locationProvider',
        function ($urlRouterProvider, $stateProvider, $httpProvider, $locationProvider) {
            $locationProvider.hashPrefix('!');
            $urlRouterProvider.otherwise('/');

            $stateProvider
            .state('blog', {
                url: '/',
                templateUrl: '/app/views/blog.html',
                controller: 'blogCtrl',
                controllerAs: 'vm'
            })
            .state('blogPost', {
                url: '/blog/:permalink',
                templateUrl: '/app/views/blogPost.html',
                controller: 'blogPostCtrl',
                controllerAs: 'vm'
            })
            .state('about', {
                url: '/about',
                templateUrl: '/app/views/about.html'
            })
            .state('login', {
                url: '/login',
                templateUrl: '/app/views/login.html',
                controller: 'loginCtrl',
                controllerAs: 'vm'
            })
            .state('logout', {
                url: '/logout',
                controller: 'logoutCtrl'
            })
            // ADMIN STATE
            .state('admin', {
                url: '/admin',
                templateUrl: '/app/views/admin/layout.html',
                controller: 'adminCtrl',
                controllerAs: 'vm'
            })
                // Blogs
                .state('blogAdmin', {
                    parent: 'admin',
                    url: '/blog',
                    templateUrl: '/app/views/admin/blogList.html',
                    controller: 'blogAdminCtrl',
                    controllerAs: 'vm'
                })
                .state('blogAdminEdit', {
                    parent: 'admin',
                    url: '/blog/edit/:id',
                    templateUrl: '/app/views/admin/blogEdit.html',
                    controller: 'blogAdminEditCtrl',
                    controllerAs: 'vm'
                })
                // Files
                .state('fileAdmin', {
                    parent: 'admin',
                    url: '/files',
                    templateUrl: '/app/views/admin/fileList.html',
                    controller: 'fileAdminCtrl',
                    controllerAs: 'vm'
                })
                // Account
                .state('account', {
                    parent: 'admin',
                    url: '/account',
                    templateUrl: '/app/views/admin/account.html',
                    controller: 'accountCtrl',
                    controllerAs: 'vm'
                });

            $httpProvider.interceptors.push('authInterceptor');
        }])

    .constant('API_URL', '/api/');
})();