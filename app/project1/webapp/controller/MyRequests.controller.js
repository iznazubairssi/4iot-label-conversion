// app/project1/webapp/controller/MyRequests.controller.js
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.MyRequests", {
        
        onInit: function () {
            this.getView().setModel(new JSONModel(), "requestsModel");
            this.loadRequests();
        },

        loadRequests: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel();
            
            // Read all requests from OData service
            oModel.read("/Requests", {
                success: function (oData) {
                    var aRequests = oData.results || [];
                    that.getView().getModel("requestsModel").setData({ Requests: aRequests });
                    
                    // Show empty state if no requests
                    var bShowEmpty = aRequests.length === 0;
                    that.byId("idRequestsTable").setVisible(!bShowEmpty);
                    that.byId("idEmptyState").setVisible(bShowEmpty);
                    
                    MessageToast.show("Loaded " + aRequests.length + " request(s)");
                },
                error: function (oError) {
                    MessageToast.show("Failed to load requests");
                    console.error("Error loading requests:", oError);
                }
            });
        },

        onRefresh: function () {
            this.loadRequests();
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var aFilters = [];
            
            if (sQuery && sQuery.length > 0) {
                aFilters = [
                    new Filter({
                        filters: [
                            new Filter("ID", FilterOperator.Contains, sQuery),
                            new Filter("contactName", FilterOperator.Contains, sQuery),
                            new Filter("contactMail", FilterOperator.Contains, sQuery)
                        ],
                        and: false
                    })
                ];
            }
            
            var oTable = this.byId("idRequestsTable");
            var oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
        },

        onRequestSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("requestsModel");
            var sRequestID = oContext.getProperty("ID");
            
            MessageToast.show("Selected: " + sRequestID);
        },

        onViewDetails: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("requestsModel");
            var oRequest = oContext.getObject();
            
            // For now, show details in a message
            // Later, navigate to detail page
            var sMessage = "Request ID: " + oRequest.ID + "\n" +
                          "Status: " + this.formatStatus(oRequest.status) + "\n" +
                          "Contact: " + oRequest.contactName + "\n" +
                          "Email: " + oRequest.contactMail + "\n" +
                          "Labels: " + oRequest.numLabels;
            
            sap.m.MessageBox.information(sMessage, {
                title: "Request Details"
            });
        },

        onDownload: function (oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("requestsModel");
            var oRequest = oContext.getObject();
            
            MessageToast.show("Download functionality coming soon for " + oRequest.ID);
            // TODO: Implement download logic in next phase
        },

        onNavigateToNewRequest: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("newRequest");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("home");
        },

        // Formatters
        formatStatus: function (iStatus) {
            if (iStatus === 0) {
                return "Pending";
            } else if (iStatus === 50) {
                return "Processing";
            } else if (iStatus === 100) {
                return "Completed";
            }
            return "Unknown";
        },

        formatStatusState: function (iStatus) {
            if (iStatus === 0) {
                return "Warning";
            } else if (iStatus === 50) {
                return "Information";
            } else if (iStatus === 100) {
                return "Success";
            }
            return "None";
        },

        formatStatusIcon: function (iStatus) {
            if (iStatus === 0) {
                return "sap-icon://pending";
            } else if (iStatus === 50) {
                return "sap-icon://process";
            } else if (iStatus === 100) {
                return "sap-icon://complete";
            }
            return "";
        }
    });
});
