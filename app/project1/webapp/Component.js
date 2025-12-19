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
            UIComponent.prototype.init.apply(this, arguments);
            
            var oViewModel = new JSONModel({
                labelSoftware: "bartender"
            });
            this.setModel(oViewModel, "viewModel");

            var oSessionModel = new JSONModel({
                userEmail: ""
            });
            this.setModel(oSessionModel, "session");

            this.getRouter().initialize();
        }
    });
});
