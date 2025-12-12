// app/project1/webapp/Component.js
sap.ui.define([
    "sap/fe/core/AppComponent",
    "sap/ui/model/json/JSONModel"
], function(BaseComponent, JSONModel) {
    "use strict";

    /**
     * @namespace label.conversion.project1
     */
    return BaseComponent.extend("label.conversion.project1.Component", {

        metadata: {
            manifest: "json"
        },

        init: function() {
            BaseComponent.prototype.init.apply(this, arguments);
            
            var oViewModel = new JSONModel({
                labelSoftware: "bartender"
            });
            this.setModel(oViewModel, "viewModel");
        }
    });
});