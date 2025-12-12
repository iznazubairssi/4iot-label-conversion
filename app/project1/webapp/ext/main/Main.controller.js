sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, JSONModel) {
    "use strict";

    return Controller.extend("label.conversion.project1.ext.main.Main", {
        
        onInit: function () {
            var oViewModel = this.getOwnerComponent().getModel("viewModel");
            if (!oViewModel) {
                oViewModel = new JSONModel({
                    labelSoftware: "bartender"
                });
                this.getView().setModel(oViewModel, "viewModel");
            }
            
            this.updateProgressBar(0, "0%: Start");
        },

        updateProgressBar: function(iPercent, sText) {
            var oProgress = this.byId("idProgressBar");
            if (oProgress) {
                oProgress.setPercentValue(iPercent);
                oProgress.setDisplayValue(sText);
            }
        },

        onSubmitRequest: function () {
            var oUploader = this.byId("idFileUploader");
            
            if (!oUploader) {
                MessageToast.show("File uploader not found.");
                return;
            }

            var oFileUpload = oUploader.oFileUpload;
            var aFiles = [];
            
            if (oFileUpload && oFileUpload.files) {
                aFiles = Array.from(oFileUpload.files);
            }
            
            console.log("Files selected:", aFiles.length);
            
            if (aFiles.length === 0) {
                MessageToast.show("Please upload at least one example file.");
                return;
            }
            if (aFiles.length > 5) {
                MessageToast.show("You can only upload a maximum of 5 example files.");
                return;
            }

            var oFormData = this.collectFormData();
            
            if (!oFormData.contactName || !oFormData.contactMail || !oFormData.numLabels) {
                MessageToast.show("Please fill in all required fields (Name, Email, Number of Labels).");
                return;
            }
            
            console.log("Form data collected:", oFormData);
            
            this.uploadFilesWithXHR(aFiles, oFormData);
        },

        uploadFilesWithXHR: function(aFiles, oFormData) {
            var that = this;
            var formData = new FormData();
            
            for (var i = 0; i < aFiles.length; i++) {
                formData.append('exampleFiles', aFiles[i]);
            }
            
            this.updateProgressBar(10, "10%: Uploading...");
            MessageToast.show("Uploading " + aFiles.length + " file(s)...");
            
            var xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener("progress", function(e) {
                if (e.lengthComputable) {
                    var percentComplete = Math.round((e.loaded / e.total) * 40) + 10;
                    that.updateProgressBar(percentComplete, percentComplete + "%: Uploading...");
                }
            });
            
            xhr.addEventListener("load", function() {
                console.log("Upload complete. Status:", xhr.status, "Response:", xhr.responseText);
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    that.updateProgressBar(50, "50%: Request Submitted Successfully");
                    MessageToast.show("Your request has been successfully submitted and files uploaded to Azure.");
                    that.clearForm();
                } else {
                    that.updateProgressBar(0, "0%: Submission Failed");
                    MessageToast.show("Submission failed. Status: " + xhr.status);
                    console.error("Upload error:", xhr.responseText);
                }
            });
            
            xhr.addEventListener("error", function() {
                that.updateProgressBar(0, "0%: Submission Failed");
                MessageToast.show("Network error occurred during upload.");
                console.error("XHR error");
            });
            
            // IMPORTANT: Use /upload endpoint instead of /Requests
            xhr.open("POST", "/upload");
            
            // Add form data as custom header
            xhr.setRequestHeader("slug", JSON.stringify(oFormData));
            
            // Don't set Content-Type - browser will set it automatically with boundary
            
            xhr.send(formData);
        },

        collectFormData: function() {
            var oViewModel = this.getView().getModel("viewModel");
            var sLabelSoftware = oViewModel.getProperty("/labelSoftware");
            
            return {
                labelSoftware: sLabelSoftware,
                otherSoftware: sLabelSoftware === 'others' ? this.byId("idOtherSoftware").getValue() : null,
                numLabels: parseInt(this.byId("idNumLabels").getValue(), 10) || 0,
                contactName: this.byId("idContactName").getValue(),
                contactMail: this.byId("idContactMail").getValue(),
                contactPhone: this.byId("idContactPhone").getValue(),
                conversionFonts: this.byId("idConversionFonts").getSelected(),
                conversionFieldnames: this.byId("idConversionFieldnames").getSelected(),
                comparisonPrintScan: this.byId("idComparisonPrintScan").getSelected(),
                supportADS: this.byId("idSupportADS").getSelected()
            };
        },
        
        onFileChange: function(oEvent) {
            var oUploader = this.byId("idFileUploader");
            var oFileUpload = oUploader.oFileUpload;
            var aFiles = [];
            
            if (oFileUpload && oFileUpload.files) {
                aFiles = Array.from(oFileUpload.files);
            }
            
            console.log("Files changed. Count:", aFiles.length);
            
            if (aFiles.length > 0) {
                MessageToast.show(aFiles.length + " file(s) selected");
            }
            
            this.updateProgressBar(0, "0%: Start");
        },
        
        clearForm: function() {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/labelSoftware", "bartender");
            
            this.byId("idOtherSoftware").setValue("");
            this.byId("idNumLabels").setValue("");
            this.byId("idContactName").setValue("");
            this.byId("idContactMail").setValue("");
            this.byId("idContactPhone").setValue("");
            this.byId("idConversionFonts").setSelected(false);
            this.byId("idConversionFieldnames").setSelected(false);
            this.byId("idComparisonPrintScan").setSelected(false);
            this.byId("idSupportADS").setSelected(false);
            this.byId("idFileUploader").clear();
            this.updateProgressBar(0, "0%: Start");
        }
    });
});
