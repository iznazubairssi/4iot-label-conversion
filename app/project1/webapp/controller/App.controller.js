// app/project1/webapp/controller/App.controller.js
sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.App", {
        onInit: function () {
            // Initialize router
            this.getOwnerComponent().getRouter().initialize();
        }
    });
});
