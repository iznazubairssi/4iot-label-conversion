// app/project1/webapp/controller/Home.controller.js
sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.Home", {
        
        onInit: function () {
            // Initialize home page
        },

        onNavigateToNewRequest: function () {
            // Navigate to the create request page
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("newRequest");
        },

        onNavigateToMyRequests: function () {
            // Navigate to the my requests page
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("myRequests");
        }
    });
});
