sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.Home", {
        
        onInit: function () {
            var oModel = new JSONModel({
                userEmail: ""
            });
            this.getView().setModel(oModel);
        },

        onCheckEmail: function () {
            var oModel = this.getView().getModel();
            var sEmail = oModel.getProperty("/userEmail");
            
            if (!sEmail || sEmail.trim() === "") {
                MessageBox.warning("Please enter your email address.");
                return;
            }
            
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(sEmail)) {
                MessageBox.error("Please enter a valid email address.");
                return;
            }
            
            this.byId("idBusyIndicator").setVisible(true);
            this.byId("idContinueButton").setEnabled(false);
            
            this.checkEmailExists(sEmail);
        },

        checkEmailExists: function (sEmail) {
            var that = this;
            
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/4iot/conversion/Requests?$filter=contactMail eq '" + encodeURIComponent(sEmail) + "'");
            
            xhr.onload = function() {
                that.byId("idBusyIndicator").setVisible(false);
                that.byId("idContinueButton").setEnabled(true);
                
                if (xhr.status === 200) {
                    try {
                        var oData = JSON.parse(xhr.responseText);
                        var aResults = oData.value || [];
                        
                        if (aResults.length > 0) {
                            that.handleExistingRequest(aResults[0]);
                        } else {
                            that.handleNewRequest(sEmail);
                        }
                    } catch (e) {
                        console.error("Error parsing response:", e);
                        MessageBox.error("Failed to check email. Please try again.");
                    }
                } else {
                    MessageBox.error("Failed to check email. Please try again.");
                    console.error("Error checking email. Status:", xhr.status);
                }
            };
            
            xhr.onerror = function() {
                that.byId("idBusyIndicator").setVisible(false);
                that.byId("idContinueButton").setEnabled(true);
                MessageBox.error("Network error. Please check your connection and try again.");
            };
            
            xhr.send();
        },

        handleExistingRequest: function (oRequest) {
            var that = this;
            var sStatus = this.formatStatus(oRequest.status);
            
            MessageBox.information(
                "Welcome back!\n\n" +
                "You already have an active request:\n\n" +
                "Request ID: " + oRequest.ID + "\n" +
                "Status: " + sStatus + "\n" +
                "Submitted: " + this.formatDate(oRequest.createdAt) + "\n" +
                "Contact: " + oRequest.contactName + "\n\n" +
                "You will be redirected to view your request details.",
                {
                    title: "Existing Request Found",
                    onClose: function () {
                        that.getOwnerComponent().getModel("session").setProperty("/userEmail", oRequest.contactMail);
                        that.getOwnerComponent().getRouter().navTo("myRequests");
                    }
                }
            );
        },

        handleNewRequest: function (sEmail) {
            var that = this;
            
            MessageBox.confirm(
                "No existing request found for this email.\n\n" +
                "Would you like to create a new conversion request?",
                {
                    title: "Create New Request",
                    actions: [MessageBox.Action.YES, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            that.getOwnerComponent().getModel("session").setProperty("/userEmail", sEmail);
                            
                            that.getOwnerComponent().getRouter().navTo("newRequest");
                        }
                    }
                }
            );
        },

        formatStatus: function (iStatus) {
            if (iStatus === 0) return "Pending";
            if (iStatus === 50) return "Processing";
            if (iStatus === 100) return "Completed";
            return "Unknown";
        },

        formatDate: function (sDate) {
            if (!sDate) return "";
            var oDate = new Date(sDate);
            return oDate.toLocaleDateString() + " " + oDate.toLocaleTimeString();
        }
    });
});
