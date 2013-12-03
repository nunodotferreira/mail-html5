define(function(require) {
    'use strict';

    var appController = require('js/app-controller'),
        angular = require('angular'),
        crypto, keychain;

    //
    // Controller
    //

    var ReadCtrl = function($scope) {
        crypto = appController._crypto;
        keychain = appController._keychain;

        $scope.state.read = {
            open: false,
            toggle: function(to) {
                this.open = to;
            }
        };

        $scope.lineEmpty = function(line) {
            return line.replace(/>/g, '').trim().length === 0;
        };

        $scope.getFingerprint = function(address) {
            keychain.getReceiverPublicKey(address, function(err, pubkey) {
                var fpr = crypto.getFingerprint(pubkey.publicKey);
                var formatted = fpr.slice(0, 4) + ' ' + fpr.slice(4, 8) + ' ' + fpr.slice(8, 12) + ' ' + fpr.slice(12, 16) + ' ' + fpr.slice(16, 20) + ' ' + fpr.slice(20, 24) + ' ' + fpr.slice(24, 28) + ' ' + fpr.slice(28, 32) + ' ' + fpr.slice(32, 36) + ' ' + fpr.slice(36);

                $scope.fingerprint = formatted;
                $scope.$apply();
            });
        };
    };

    //
    // Directives
    //

    var ngModule = angular.module('read', []);
    ngModule.directive('frameLoad', function() {
        return function(scope, elm) {
            elm.bind('load', function() {
                var frame = elm[0];
                frame.height = frame.contentWindow.document.body.scrollHeight + 'px';
            });
        };
    });

    return ReadCtrl;
});