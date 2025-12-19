sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.MyRequests", {
        
        onInit: function () {
            var oModel = new JSONModel({
                requests: [],
                selectedRequest: null,
                uploadedFiles: [],
                convertedFiles: [],
                showDetails: false
            });
            this.getView().setModel(oModel, "requestsModel");
            
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("myRequests").attachPatternMatched(this.onRouteMatched, this);
        },

        onRouteMatched: function () {
            this.loadUserRequest();
        },

        loadUserRequest: function () {
            var that = this;
            var oSessionModel = this.getOwnerComponent().getModel("session");
            var sEmail = oSessionModel.getProperty("/userEmail");
            
            console.log("Loading request for email:", sEmail);
            
            if (!sEmail) {
                MessageBox.warning("Please enter your email on the home page first.", {
                    onClose: function () {
                        that.getOwnerComponent().getRouter().navTo("home");
                    }
                });
                return;
            }
            
            this.getView().getModel("requestsModel").setProperty("/requests", []);
            this.getView().getModel("requestsModel").setProperty("/selectedRequest", null);
            this.getView().getModel("requestsModel").setProperty("/uploadedFiles", []);
            this.getView().getModel("requestsModel").setProperty("/convertedFiles", []);
            this.getView().getModel("requestsModel").setProperty("/showDetails", false);

            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/4iot/conversion/Requests?$filter=contactMail eq '" + encodeURIComponent(sEmail) + "'");
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    try {
                        var oData = JSON.parse(xhr.responseText);
                        var aRequests = oData.value || [];
                        
                        console.log("Found requests:", aRequests.length);
                        
                        if (aRequests.length > 0) {
                            var oRequest = aRequests[0];
                            console.log("Loaded request ID:", oRequest.ID);
                            
                            that.getView().getModel("requestsModel").setProperty("/requests", [oRequest]);
                            that.getView().getModel("requestsModel").setProperty("/selectedRequest", oRequest);

                            that.loadFilesFromAzure(oRequest.azureFolderName, oRequest.ID);
                        } else {
                            console.log("No request found for email:", sEmail);
                            MessageBox.information(
                                "You don't have any requests yet.\n\n" +
                                "Would you like to create a new conversion request?",
                                {
                                    title: "No Requests Found",
                                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                    emphasizedAction: MessageBox.Action.YES,
                                    onClose: function(sAction) {
                                        if (sAction === MessageBox.Action.YES) {
                                            that.getOwnerComponent().getRouter().navTo("newRequest");
                                        } else {
                                            that.getOwnerComponent().getRouter().navTo("home");
                                        }
                                    }
                                }
                            );
                        }
                    } catch (e) {
                        console.error("Error parsing response:", e);
                        MessageToast.show("Failed to load request");
                    }
                } else {
                    MessageToast.show("Failed to load request");
                    console.error("Error loading request. Status:", xhr.status);
                }
            };
            
            xhr.onerror = function() {
                MessageToast.show("Network error occurred");
            };
            
            xhr.send();
        },

        loadFilesFromAzure: function(sFolderName, sRequestID) {
            var that = this;
            
            if (!sFolderName) {
                console.error("No folder name provided");
                return;
            }
            
            console.log("Loading files from folder:", sFolderName);
            
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/azure/files?folder=" + encodeURIComponent(sFolderName));
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    try {
                        var oData = JSON.parse(xhr.responseText);
                        
                        var aUploadedFiles = oData.uploadedFiles || [];
                        var aConvertedFiles = oData.convertedFiles || [];
                        var iUpdatedStatus = oData.updatedStatus;
                        
                        that.getView().getModel("requestsModel").setProperty("/uploadedFiles", aUploadedFiles);
                        that.getView().getModel("requestsModel").setProperty("/convertedFiles", aConvertedFiles);
                        that.getView().getModel("requestsModel").setProperty("/showDetails", true);

                        if (iUpdatedStatus !== null && iUpdatedStatus !== undefined) {
                            var oSelectedRequest = that.getView().getModel("requestsModel").getProperty("/selectedRequest");
                            if (oSelectedRequest && oSelectedRequest.status !== iUpdatedStatus) {
                                console.log("Updating status from", oSelectedRequest.status, "to", iUpdatedStatus);
                                oSelectedRequest.status = iUpdatedStatus;
                                that.getView().getModel("requestsModel").setProperty("/selectedRequest", oSelectedRequest);
                                that.getView().getModel("requestsModel").refresh(true);
                            }
                        }
                        
                        console.log("Loaded files:", aUploadedFiles.length, "uploaded,", aConvertedFiles.length, "converted");
                    } catch (e) {
                        console.error("Error parsing files:", e);
                    }
                } else {
                    console.error("Failed to load files. Status:", xhr.status);
                }
            };
            
            xhr.onerror = function() {
                console.error("Network error loading files");
            };
            
            xhr.send();
        },

        onRefresh: function() {
            this.loadUserRequest();
            MessageToast.show("Refreshing...");
        },

        onDownloadFile: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("requestsModel");
            var sFileName = oContext.getProperty("name");
            var sFolderName = this.getView().getModel("requestsModel").getProperty("/selectedRequest/azureFolderName");
            
            var sDownloadUrl = "/azure/download?folder=" + encodeURIComponent(sFolderName) + 
                              "&file=" + encodeURIComponent(sFileName) +
                              "&type=converted";
            
            var link = document.createElement('a');
            link.href = sDownloadUrl;
            link.download = sFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            MessageToast.show("Downloading " + sFileName);
        },

        onDownloadAllConverted: function() {
            var oModel = this.getView().getModel("requestsModel");
            var aConvertedFiles = oModel.getProperty("/convertedFiles");
            var sFolderName = oModel.getProperty("/selectedRequest/azureFolderName");
            
            if (aConvertedFiles.length === 0) {
                MessageBox.warning("No converted files available yet.");
                return;
            }
            
            MessageToast.show("Downloading " + aConvertedFiles.length + " file(s)...");
            
            aConvertedFiles.forEach(function(oFile, index) {
                setTimeout(function() {
                    var sDownloadUrl = "/azure/download?folder=" + encodeURIComponent(sFolderName) + 
                                      "&file=" + encodeURIComponent(oFile.name) +
                                      "&type=converted";
                    
                    var link = document.createElement('a');
                    link.href = sDownloadUrl;
                    link.download = oFile.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, index * 500);
            });
        },

        onNavigateToNewRequest: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("newRequest");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("home");
        },
        formatStatus: function (iStatus) {
            if (iStatus === 0) return "Pending";
            if (iStatus === 50) return "Processing";
            if (iStatus === 100) return "Completed";
            return "Unknown";
        },

        formatStatusState: function (iStatus) {
            if (iStatus === 0) return "Warning";
            if (iStatus === 50) return "Information";
            if (iStatus === 100) return "Success";
            return "None";
        },

        formatStatusIcon: function (iStatus) {
            if (iStatus === 0) return "sap-icon://pending";
            if (iStatus === 50) return "sap-icon://process";
            if (iStatus === 100) return "sap-icon://complete";
            return "";
        },

        formatDate: function(sDate) {
            if (!sDate) return "";
            var oDate = new Date(sDate);

            var day = String(oDate.getDate()).padStart(2, '0');
            var month = String(oDate.getMonth() + 1).padStart(2, '0');
            var year = oDate.getFullYear();
            
            var hours = oDate.getHours();
            var minutes = String(oDate.getMinutes()).padStart(2, '0');
            var seconds = String(oDate.getSeconds()).padStart(2, '0');
            var ampm = hours >= 12 ? 'PM' : 'AM';
            
            hours = hours % 12;
            hours = hours ? hours : 12;
            var hoursStr = String(hours).padStart(2, '0');
            
            return day + "/" + month + "/" + year + " " + hoursStr + ":" + minutes + ":" + seconds + " " + ampm;
        },

        formatFileSize: function(iSize) {
            if (!iSize) return "Unknown";
            if (iSize < 1024) return iSize + " B";
            if (iSize < 1024 * 1024) return (iSize / 1024).toFixed(2) + " KB";
            return (iSize / (1024 * 1024)).toFixed(2) + " MB";
        }
    });
});
