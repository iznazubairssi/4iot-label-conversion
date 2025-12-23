sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.Home", {
        
        onInit: function () {
            var oModel = new JSONModel({ userEmail: "" });
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

        checkEmailExists: async function (sEmail) {
            try {
                const response = await fetch(`/api/requests/${encodeURIComponent(sEmail)}`);
                const data = await response.json();
                
                this.byId("idBusyIndicator").setVisible(false);
                this.byId("idContinueButton").setEnabled(true);
                
                if (data.value && data.value.length > 0) {
                    this.handleExistingRequest(data.value[0]);
                } else {
                    this.handleNewRequest(sEmail);
                }
            } catch (e) {
                this.byId("idBusyIndicator").setVisible(false);
                this.byId("idContinueButton").setEnabled(true);
                MessageBox.error("Failed to check email. Please try again.");
            }
        },

        handleExistingRequest: function (oRequest) {
            var that = this;
            var sStatus = this.formatStatus(oRequest.status);
            
            MessageBox.information(
                "Welcome back!\n\nYou already have an active request:\n\n" +
                "Request ID: " + oRequest.ID + "\nStatus: " + sStatus + "\n" +
                "Submitted: " + this.formatDate(oRequest.createdAt) + "\n" +
                "Contact: " + oRequest.contactName + "\n\n" +
                "You will be redirected to view your request details.",
                {
                    title: "Existing Request Found",
                    onClose: function () {
                        sessionStorage.setItem("userEmail", oRequest.contactMail);
                        that.getOwnerComponent().getRouter().navTo("myRequests");
                    }
                }
            );
        },

        handleNewRequest: function (sEmail) {
            var that = this;
            MessageBox.confirm(
                "No existing request found for this email.\n\nWould you like to create a new conversion request?",
                {
                    title: "Create New Request",
                    actions: [MessageBox.Action.YES, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            sessionStorage.setItem("userEmail", sEmail);
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