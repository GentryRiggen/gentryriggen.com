'use strict';
angular.module('gr').factory('authToken', ['$window', '$q', function ($window, $q) {
    var tokenKeyName = 'grToken';
    var tokenClaimsKeyName = 'grTokenClaims';
    var tokenUsernameKeyName = 'grName';
    var storage = $window.localStorage;
    var cachedToken, cachedName;
    var cachedClaims = [];
    var authToken = {
        setToken: function (tokenInfo) {
            cachedToken = tokenInfo.bearer;
            cachedName = tokenInfo.user.firstName + " " + tokenInfo.user.lastName;
            cachedClaims = tokenInfo.claims;
            storage.setItem(tokenKeyName, cachedToken);
            storage.setItem(tokenUsernameKeyName, cachedName);
            storage.setItem(tokenClaimsKeyName, JSON.stringify(cachedClaims));
        },
        getToken: function () {
            if (!cachedToken)
                cachedToken = storage.getItem(tokenKeyName);

            return cachedToken;
        },
        getUsersName: function() {
            if (!cachedName)
                cachedName = storage.getItem(tokenUsernameKeyName);

            return cachedName;
        },
        getClaims: function() {
            if (!cachedClaims)
                cachedClaims = JSON.parse(storage.getItem(tokenUsernameKeyName));

            return cachedClaims;
        },
        getClaimsAsPromise: function() {
            return $q(function (resolve, reject) {
                var claims = authToken.getClaims();
                console.log(claims);
                resolve(authToken.getClaims());
            });
        },
        removeToken: function () {
            cachedToken = null;
            storage.removeItem(tokenKeyName);
            storage.removeItem(tokenUsernameKeyName);
            storage.removeItem(tokenClaimsKeyName);
        },
        isAuthenticated: function () {
            return !!authToken.getToken();
        },
        userHasAccess: function (claim) {
            return $q(function (resolve, reject) {
                var claims = authToken.getClaims();
                angular.forEach(claims, function (tokenClaim) {
                    if (tokenClaim === claim)
                        resolve();
                });

                // If we get this far, their claim is invalid
                reject();
            });
        }
    }

    return authToken;
}]);