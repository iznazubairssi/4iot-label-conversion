// db/schema.cds
namespace four_iot.conversion;

entity Requests {
  key ID : String(50); 
  labelSoftware : String(50);
  
  // Separate fields for "other" software
  otherSoftwareName : String(100);
  otherSoftwareWebsite : String(200);
  
  numLabels : Integer;
  
  // Optional Services (Booleans)
  conversionFonts : Boolean;
  conversionFieldnames : Boolean;
  comparisonPrintScan : Boolean;
  supportADS : Boolean;
  
  // Contact Info
  contactName : String(100);
  contactMail : String(100);
  contactPhone : String(50);
  
  // Progress Tracking
  status : Integer @assert.range: [0, 100]; // 0, 50, 100
  createdAt : DateTime;
  
  // Link to files in Azure (Optional, useful for tracking)
  azureRequestFile : String; 
}
