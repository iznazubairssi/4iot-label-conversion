sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.MyRequests", {
        onInit: function () {
            const oModel = new JSONModel({
                selectedRequest: {},
                uploadedFiles: [],
                convertedFiles: [],
                showDetails: false
            });
            this.getView().setModel(oModel, "requestsModel");
            
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("myRequests").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            const email = sessionStorage.getItem("userEmail");
            if (!email) {
                sap.m.MessageToast.show("No email found. Please submit a request first.");
                this.getOwnerComponent().getRouter().navTo("home");
                return;
            }
            
            const oModel = this.getView().getModel("requestsModel");
            oModel.setProperty("/selectedRequest", {});
            oModel.setProperty("/uploadedFiles", []);
            oModel.setProperty("/convertedFiles", []);
            oModel.setProperty("/showDetails", false);
            
            this._loadRequest(email);
        },

        _loadRequest: async function (email) {
            console.log("Loading request for email:", email);
            
            try {
                const response = await fetch(`/api/requests/${email}`);
                const data = await response.json();
                
                if (data.value && data.value.length > 0) {
                    const request = data.value[0];
                    const oModel = this.getView().getModel("requestsModel");
                    oModel.setProperty("/selectedRequest", request);
                    oModel.setProperty("/showDetails", true);
                    
                    this._loadFiles(request.azureFolderName);
                } else {
                    console.log("No request found for email:", email);
                    sap.m.MessageToast.show("No request found for this email.");
                }
            } catch (error) {
                console.error("Error loading request:", error);
            }
        },

        _loadFiles: async function (folderName) {
            try {
                const response = await fetch(`/azure/files?folder=${folderName}`);
                const data = await response.json();
                
                const oModel = this.getView().getModel("requestsModel");
                oModel.setProperty("/uploadedFiles", data.uploadedFiles || []);
                oModel.setProperty("/convertedFiles", data.convertedFiles || []);
                
                if (data.updatedStatus !== null) {
                    oModel.setProperty("/selectedRequest/status", data.updatedStatus);
                }
            } catch (error) {
                console.error("Error loading files:", error);
            }
        },

        onDownloadFile: function (oEvent) {
            const file = oEvent.getSource().getBindingContext("requestsModel").getObject();
            const folderName = this.getView().getModel("requestsModel").getProperty("/selectedRequest/azureFolderName");
            const fileType = file.fullPath.includes('/converted_files/') ? 'converted' : 'uploaded';
            window.open(`/azure/download?folder=${folderName}&file=${file.name}&type=${fileType}`);
        },

        onRefresh: function () {
            const email = sessionStorage.getItem("userEmail");
            if (email) {
                const oModel = this.getView().getModel("requestsModel");
                oModel.setProperty("/selectedRequest", {});
                oModel.setProperty("/uploadedFiles", []);
                oModel.setProperty("/convertedFiles", []);
                
                this._loadRequest(email);
            }
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("home");
        },
        
        formatStatus: function (iStatus) {
            if (iStatus === 0) return "Pending";
            if (iStatus === 50) return "Processing";
            if (iStatus === 100) return "Completed";
            return "Unknown";
        },

        formatStatusState: function (iStatus) {
            if (iStatus === 0) return "None";
            if (iStatus === 50) return "Warning";
            if (iStatus === 100) return "Success";
            return "None";
        },

        formatStatusIcon: function (iStatus) {
            if (iStatus === 0) return "sap-icon://pending";
            if (iStatus === 50) return "sap-icon://process";
            if (iStatus === 100) return "sap-icon://complete";
            return "";
        },

        formatDate: function (sDate) {
            if (!sDate) return "";
            var oDate = new Date(sDate);
            return oDate.toLocaleDateString() + " " + oDate.toLocaleTimeString();
        },

        formatFileSize: function (iBytes) {
            if (!iBytes) return "0 B";
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(iBytes) / Math.log(k));
            return Math.round(iBytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        }
    });
});
