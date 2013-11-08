define(function(require) {
    'use strict';

    var angular = require('angular'),
        appController = require('js/app-controller'),
        aes = require('cryptoLib/aes-cbc'),
        util = require('cryptoLib/util'),
        str = require('js/app-config').string,
        emailDao;

    //
    // Controller
    //

    var WriteCtrl = function($scope, $filter) {
        $scope.signature = str.signature;
        emailDao = appController._emailDao;

        //
        // Init
        //

        $scope.state.writer = {
            open: false,
            write: function(replyTo) {
                this.open = true;

                resetFields();
                if (replyTo) {
                    fillFields(replyTo);
                    $scope.updatePreview();
                }
                $scope.verifyTo();
            },
            close: function() {
                this.open = false;
            }
        };

        function resetFields() {
            $scope.writerTitle = 'New email';
            $scope.to = '';
            $scope.subject = '';
            $scope.body = '';
            $scope.ciphertextPreview = '';
        }

        function fillFields(re) {
            var from, cleaned, body;

            if (!re) {
                return;
            }

            $scope.writerTitle = 'Reply';
            // fill recipient field
            $scope.to = re.from[0].address;
            // fill subject
            $scope.subject = 'Re: ' + ((re.subject) ? re.subject.replace('Re: ', '') : '');

            // fill text body
            from = re.from[0].name || re.from[0].address;
            body = '<br><br>' + $filter('date')(re.sentDate, 'EEEE, MMM d, yyyy h:mm a') + ' ' + from + ' wrote:<br>';

            // clean text from markup if to prevent injection in contenteditable
            if (!re.html) {
                cleaned = angular.element('<p>' + re.body + '</p>').text();
                body += cleaned.split('\n').join('<br>');
                $scope.body = body;
            }
        }

        //
        // Editing headers
        //

        $scope.verifyTo = function() {
            if (!$scope.to) {
                resetDisplay();
                return;
            }

            // set display to insecure while fetching keys
            displayInsecure();
            // check if to address is contained in known public keys
            emailDao._keychain.getReceiverPublicKey($scope.to, function(err, key) {
                if (err) {
                    console.error(err);
                    return;
                }

                // compare again since model could have changed during the roundtrip
                if (key && key.userId === $scope.to) {
                    displaySecure();
                    $scope.$apply();
                }
            });
        };

        function resetDisplay() {
            $scope.toSecure = undefined;
            $scope.sendBtnText = undefined;
        }

        function displaySecure() {
            $scope.toSecure = true;
            $scope.sendBtnText = 'Send securely';
        }

        function displayInsecure() {
            $scope.toSecure = false;
            $scope.sendBtnText = 'Invite & send securely';
        }

        //
        // Editing email body
        //

        // generate key,iv for encryption preview
        var key = util.random(128),
            iv = util.random(128);

        $scope.updatePreview = function() {
            var body = $scope.body;
            // remove generated html from body
            body = parseBody(body);

            // Although this does encrypt live using AES, this is just for show. The plaintext is encrypted seperately before sending the email.
            $scope.ciphertextPreview = (body) ? aes.encrypt(body, key, iv) : '';
        };

        $scope.sendToOutbox = function() {
            var to, body, email;

            // validate recipients
            to = $scope.to.replace(/\s/g, '').split(/[,;]/);
            if (!to || to.length < 1) {
                console.log('Seperate recipients with a comma!');
                return;
            }

            // remove generated html from body
            body = parseBody($scope.body);

            email = {
                to: [], // list of receivers
                subject: $scope.subject, // Subject line
                body: body // plaintext body
            };
            email.from = [{
                name: '',
                address: emailDao._account.emailAddress
            }];
            to.forEach(function(address) {
                email.to.push({
                    name: '',
                    address: address
                });
            });

            // set an id for the email and store in outbox
            email.id = util.UUID();
            emailDao._devicestorage.storeList([email], 'email_OUTBOX', function(err) {
                if (err) {
                    console.error(err);
                    return;
                }

                $scope.state.writer.close();
                $scope.$apply();
                $scope.emptyOutbox();
            });
        };
    };

    function parseBody(body) {
        var regex = /(\r\n|\n|\r)/gm;

        var text = body.replace(regex, '').split('<div><br>').join('\n').split('<div>').join('\n').split('<br>').join('\n');

        return angular.element('<p>' + text + '</p>').text();
    }

    //
    // Directives
    //

    var ngModule = angular.module('write', []);
    ngModule.directive('contenteditable', function() {
        return {
            require: 'ngModel',
            link: function(scope, elm, attrs, ctrl) {
                // view -> model
                elm.on('keyup keydown', function() {
                    scope.$apply(function() {
                        ctrl.$setViewValue(elm.html());
                    });
                });

                // model -> view
                ctrl.$render = function() {
                    elm.html(ctrl.$viewValue);
                };

                // load init value from DOM
                ctrl.$setViewValue(elm.html());
            }
        };
    });

    ngModule.directive('focusMe', function($timeout, $parse) {
        return {
            //scope: true,   // optionally create a child scope
            link: function(scope, element, attrs) {
                var model = $parse(attrs.focusMe);
                scope.$watch(model, function(value) {
                    if (value === true) {
                        $timeout(function() {
                            element[0].focus();
                        }, 100);
                    }
                });
            }
        };
    });

    ngModule.directive('autoSize', function($parse) {
        return {
            require: 'ngModel',
            link: function(scope, elm, attrs) {
                var model = $parse(attrs.autoSize);
                scope.$watch(model, function(value) {
                    if (!value) {
                        return;
                    }

                    var width = ((value.length + 2) * 8) + 'px';
                    elm.css('width', width);
                });
            }
        };
    });

    return WriteCtrl;
});