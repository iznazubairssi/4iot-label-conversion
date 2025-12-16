// app/project1/webapp/controller/NewRequest.controller.js
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], function (Controller, MessageToast, MessageBox, JSONModel) {
    "use strict";

    return Controller.extend("label.conversion.project1.controller.NewRequest", {
        
        onInit: function () {
            var oViewModel = this.getOwnerComponent().getModel("viewModel");
            if (!oViewModel) {
                oViewModel = new JSONModel({
                    labelSoftware: "bartender"
                });
                this.getView().setModel(oViewModel, "viewModel");
            }
            
            this.updateProgressBar(0, "0%: Ready to Submit");
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
            
            // File validation
            if (aFiles.length === 0) {
                MessageBox.warning("Please upload at least one example file to proceed.");
                return;
            }
            if (aFiles.length > 5) {
                MessageBox.error("Maximum 5 files allowed. You have selected " + aFiles.length + " files. Please remove " + (aFiles.length - 5) + " file(s).");
                return;
            }

            // Form data validation
            var oFormData = this.collectFormData();
            
            if (!oFormData.contactName || !oFormData.contactMail || !oFormData.numLabels) {
                MessageBox.error("Please fill in all required fields:\n• Full Name\n• Email Address\n• Number of Labels");
                return;
            }
            
            // Validate "Others" software fields
            if (oFormData.labelSoftware === 'others' && !oFormData.otherSoftwareName) {
                MessageBox.error("Please enter the software name when 'Other Software' is selected.");
                return;
            }
            
            // Email validation
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(oFormData.contactMail)) {
                MessageBox.error("Please enter a valid email address.");
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
                    MessageBox.success(
                        "Your label conversion request has been submitted successfully!\n\n" +
                        "Our team will review your request and contact you.",
                        {
                            title: "Success",
                            onClose: function() {
                                // Navigate to My Requests page
                                that.getOwnerComponent().getRouter().navTo("myRequests");
                            }
                        }
                    );
                } else {
                    that.updateProgressBar(0, "0%: Submission Failed");
                    MessageBox.error(
                        "Failed to submit your request. Status: " + xhr.status + "\n\n" +
                        "Please try again or contact support if the problem persists.",
                        {
                            title: "Upload Failed"
                        }
                    );
                    console.error("Upload error:", xhr.responseText);
                }
            });
            
            xhr.addEventListener("error", function() {
                that.updateProgressBar(0, "0%: Submission Failed");
                MessageBox.error("Network error occurred during upload. Please check your connection and try again.");
            });
            
            xhr.open("POST", "/upload");
            xhr.setRequestHeader("slug", JSON.stringify(oFormData));
            xhr.send(formData);
        },

        collectFormData: function() {
            var oViewModel = this.getView().getModel("viewModel");
            var sLabelSoftware = oViewModel.getProperty("/labelSoftware");
            
            // Collect software name and website separately
            var sSoftwareName = null;
            var sSoftwareWebsite = null;
            
            if (sLabelSoftware === 'others') {
                sSoftwareName = this.byId("idOtherSoftwareName").getValue();
                sSoftwareWebsite = this.byId("idOtherSoftwareWebsite").getValue();
            }
            
            return {
                labelSoftware: sLabelSoftware,
                otherSoftwareName: sSoftwareName,
                otherSoftwareWebsite: sSoftwareWebsite,
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
            var oWarning = this.byId("idFileWarning");
            
            if (oFileUpload && oFileUpload.files) {
                aFiles = Array.from(oFileUpload.files);
            }
            
            console.log("Files changed. Count:", aFiles.length);
            
            // Show warning immediately if more than 5 files
            if (aFiles.length > 5) {
                oWarning.setText("Too many files selected! Maximum 5 files allowed.");
                //You have selected " + aFiles.length + " files. Please remove " + (aFiles.length - 5) + " file(s) before submitting
                oWarning.setVisible(true);
                MessageToast.show("Warning: Maximum 5 files allowed!");
            } else if (aFiles.length > 0) {
                oWarning.setVisible(false);
                MessageToast.show(aFiles.length + " file(s) selected");
            } else {
                oWarning.setVisible(false);
            }
            
            this.updateProgressBar(0, "0%: Ready to Submit");
        },

        onNavBack: function() {
            this.getOwnerComponent().getRouter().navTo("home");
        },

        onCancel: function() {
            var that = this;
            MessageBox.confirm(
                "Are you sure you want to cancel? All entered data will be lost.",
                {
                    title: "Confirm Cancel",
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that.getOwnerComponent().getRouter().navTo("home");
                        }
                    }
                }
            );
        }
    });
});
