(function () {
    'use strict';

    var app = angular.module('gr');

    app.constant('API_URL', '/api');

    // Handle Auth on every navigation
    app.run(function ($rootScope, $state, UserService) {
        $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {
            if (angular.isDefined(toState.data) &&
                        angular.isDefined(toState.data.requireLogin) &&
                        toState.data.requireLogin === false) {
                return;
            }

            UserService.getCurrentUser().then(
                function (currentUser) {
                    var userIsAdmin = _.contains(currentUser.roles, "Admin");
                    // Check if state requires user to be in certain role (Admin trumps everything)
                    if (!userIsAdmin &&
                        angular.isDefined(toState.data) &&
                        angular.isDefined(toState.data.allowedRoles) &&
                        toState.data.allowedRoles.length > 0) {

                        var allowedThrough = false;
                        angular.forEach(toState.data.allowedRoles, function (role) {
                            if (_.contains(currentUser.roles, role)) {
                                allowedThrough = true;
                            }
                        });

                        if (!allowedThrough) {
                            console.log("Not allowed through, going to log", toState);
                            // If we get this far, they don't have access
                            event.preventDefault();
                            $state.go('login');
                        }
                    }
                },
                function () {
                    event.preventDefault();
                    // Route to login
                    $state.go('login');
                }
            );
        });
    });

    app.config(['$urlRouterProvider', '$stateProvider', '$httpProvider', '$locationProvider', '$mdThemingProvider',
    function ($urlRouterProvider, $stateProvider, $httpProvider, $locationProvider, $mdThemingProvider) {
        $locationProvider.hashPrefix('!');
        $urlRouterProvider.otherwise('/');

        $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: '/client/app/login/login.tmpl.html',
            controller: 'LoginCtrl',
            controllerAs: 'LoginCtrl',
            data: { requireLogin: false }
        })
        .state('blog', {
            url: '/',
            templateUrl: '/client/app/blog/blog.tmpl.html',
            controller: 'BlogCtrl',
            controllerAs: 'BlogCtrl',
            data: { requireLogin: false }
        })
        .state('blogDetail', {
            url: '/blog/:permalink',
            templateUrl: '/client/app/blog/blogDetail.tmpl.html',
            controller: 'BlogDetailCtrl',
            controllerAs: 'BlogDetailCtrl',
            data: { requireLogin: false }
        })
        .state('about', {
            url: '/about',
            templateUrl: '/client/app/about/about.tmpl.html',
            data: { requireLogin: false }
        });

        //.state('logout', {
        //    url: '/logout',
        //    controller: 'logoutCtrl',
        //    data: { requireLogin: false }
        //})
        //// ADMIN STATE
        //.state('admin', {
        //    url: '/admin',
        //    templateUrl: '/app/views/admin/layout.html',
        //    controller: 'adminCtrl',
        //    controllerAs: 'vm',
        //    data: {
        //        allowedRoles: ["Admin"]
        //    }
        //})
        //// Blogs
        //.state('admin.blog', {
        //    url: '/blog',
        //    templateUrl: '/app/views/admin/blogList.html',
        //    controller: 'blogAdminCtrl',
        //    controllerAs: 'vm'
        //})
        //.state('admin.blog.edit', {
        //    url: '/blog/edit/:id',
        //    templateUrl: '/app/views/admin/blogEdit.html',
        //    controller: 'blogAdminEditCtrl',
        //    controllerAs: 'vm'
        //})
        //// Files
        //.state('admin.files', {
        //    url: '/files',
        //    templateUrl: '/app/views/admin/fileList.html',
        //    controller: 'fileAdminCtrl',
        //    controllerAs: 'vm'
        //})
        //// Account
        //.state('admin.account', {
        //    url: '/account',
        //    templateUrl: '/app/views/admin/account.html',
        //    controller: 'accountCtrl',
        //    controllerAs: 'vm'
        //});

        $httpProvider.interceptors.push('AuthInterceptor');

        $mdThemingProvider.definePalette('theme', {
            "50": "#e6f7fd",
            "100": "#b3e7fa",
            "200": "#80d7f7",
            "300": "#55c9f4",
            "400": "#2abbf1",
            "500": "#00aeee",
            "600": "#0098d0",
            "700": "#0083b3",
            "800": "#006d95",
            "900": "#005777",
            "A100": "#b3e7fa",
            "A200": "#80d7f7",
            "A400": "#2abbf1",
            "A700": "#0083b3"
        });

        $mdThemingProvider.definePalette('base', {
            "50": "#f1f1f1",
            "100": "#d5d5d5",
            "200": "#b9b9b9",
            "300": "#a1a1a1",
            "400": "#898989",
            "500": "#727272",
            "600": "#646464",
            "700": "#565656",
            "800": "#474747",
            "900": "#393939",
            "A100": "#d5d5d5",
            "A200": "#b9b9b9",
            "A400": "#898989",
            "A700": "#565656"
        });

        $mdThemingProvider.theme('default')

            .primaryPalette('theme')

            .accentPalette('base');
    }]);
})();