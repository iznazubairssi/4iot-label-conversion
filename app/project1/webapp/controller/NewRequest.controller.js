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
            
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("newRequest").attachPatternMatched(this.onRouteMatched, this);
            
            this.updateProgressBar(0, "0%: Ready to Submit");
        },

        onRouteMatched: function () {
            var oSessionModel = this.getOwnerComponent().getModel("session");
            var sEmail = oSessionModel.getProperty("/userEmail");
            
            if (!sEmail) {
                MessageBox.warning("Please enter your email on the home page first.", {
                    onClose: function () {
                        this.getOwnerComponent().getRouter().navTo("home");
                    }.bind(this)
                });
                return;
            }
            this.clearForm();

            this.byId("idContactMail").setValue(sEmail);
            this.byId("idContactMail").setEditable(false);
            
            this.updateProgressBar(0, "0%: Ready to Submit");
        },

        clearForm: function() {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/labelSoftware", "bartender");
            
            this.byId("idOtherSoftwareName") && this.byId("idOtherSoftwareName").setValue("");
            this.byId("idOtherSoftwareWebsite") && this.byId("idOtherSoftwareWebsite").setValue("");
            this.byId("idNumLabels").setValue("1");
            this.byId("idContactName").setValue("");
            this.byId("idContactMail").setValue("");
            this.byId("idContactPhone").setValue("");
            
            this.byId("idConversionFonts").setSelected(false);
            this.byId("idConversionFieldnames").setSelected(false);
            this.byId("idComparisonPrintScan").setSelected(false);
            this.byId("idSupportADS").setSelected(false);
            
            var oUploader = this.byId("idFileUploader");
            if (oUploader && oUploader.oFileUpload) {
                oUploader.clear();
                oUploader.oFileUpload.value = "";
            }
            
            var oWarning = this.byId("idFileWarning");
            if (oWarning) {
                oWarning.setVisible(false);
            }
        },

        updateProgressBar: function(iPercent, sText) {
            var oProgress = this.byId("idProgressBar");
            if (oProgress) {
                oProgress.setPercentValue(iPercent);
                oProgress.setDisplayValue(sText);
            }
        },

        onSubmitRequest: function () {
            var that = this;
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
            if (aFiles.length === 0) {
                MessageBox.warning("Please upload at least one example file to proceed.");
                return;
            }
            if (aFiles.length > 5) {
                MessageBox.error("Maximum 5 files allowed. You have selected " + aFiles.length + " files. Please remove " + (aFiles.length - 5) + " file(s).");
                return;
            }

            var oFormData = this.collectFormData();
            
            if (!oFormData.contactName || !oFormData.contactMail || !oFormData.numLabels) {
                MessageBox.error("Please fill in all required fields:\n• Full Name\n• Email Address\n• Number of Labels");
                return;
            }
            
            if (oFormData.labelSoftware === 'others' && !oFormData.otherSoftwareName) {
                MessageBox.error("Please enter the software name when 'Other Software' is selected.");
                return;
            }
            
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(oFormData.contactMail)) {
                MessageBox.error("Please enter a valid email address.");
                return;
            }
            
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "/4iot/conversion/Requests?$filter=contactMail eq '" + encodeURIComponent(oFormData.contactMail) + "'");
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    try {
                        var oData = JSON.parse(xhr.responseText);
                        var aResults = oData.value || [];
                        
                        if (aResults.length > 0) {
                            MessageBox.error(
                                "A request already exists for this email address.\n\n" +
                                "Request ID: " + aResults[0].ID + "\n\n" +
                                "You will be redirected to view your existing request.",
                                {
                                    title: "Duplicate Request",
                                    onClose: function () {
                                        that.getOwnerComponent().getRouter().navTo("myRequests");
                                    }
                                }
                            );
                        } else {
                            that.uploadFilesWithXHR(aFiles, oFormData);
                        }
                    } catch (e) {
                        console.error("Error parsing response:", e);
                        MessageBox.error("Failed to verify email. Please try again.");
                    }
                } else {
                    MessageBox.error("Failed to verify email. Please try again.");
                }
            };
            
            xhr.onerror = function() {
                MessageBox.error("Network error. Please try again.");
            };
            
            xhr.send();
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
                        "Your label conversion request has been submitted successfully!",
                        {
                            title: "Success",
                            onClose: function() {
                                that.getOwnerComponent().getRouter().navTo("myRequests");
                            }
                        }
                    );
                } else if (xhr.status === 409) {
                    that.updateProgressBar(0, "0%: Duplicate Request");
                    try {
                        var errorData = JSON.parse(xhr.responseText);
                        MessageBox.error(
                            "A request already exists for this email.\n\n" +
                            "Request ID: " + errorData.existingRequestId,
                            {
                                title: "Duplicate Request",
                                onClose: function() {
                                    that.getOwnerComponent().getRouter().navTo("myRequests");
                                }
                            }
                        );
                    } catch (e) {
                        MessageBox.error("A request already exists for this email.");
                    }
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
            
            if (aFiles.length > 5) {
                oWarning.setText("Too many files selected! Maximum 5 files allowed. You have selected " + aFiles.length + " files. Please remove " + (aFiles.length - 5) + " file(s) before submitting.");
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
