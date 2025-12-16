// app/project1/webapp/Component.js
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function(UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("label.conversion.project1.Component", {

        metadata: {
            manifest: "json"
        },

        init: function() {
            // Call parent init
            UIComponent.prototype.init.apply(this, arguments);
            
            // Initialize viewModel for form controls
            var oViewModel = new JSONModel({
                labelSoftware: "bartender"
            });
            this.setModel(oViewModel, "viewModel");

            // Initialize router
            this.getRouter().initialize();
        }
    });
});
