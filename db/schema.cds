namespace four_iot.conversion;

entity Requests {
  key ID : String(50); 
  labelSoftware : String(50);
  otherSoftware : String;
  numLabels : Integer;
  
  conversionFonts : Boolean;
  conversionFieldnames : Boolean;
  comparisonPrintScan : Boolean;
  supportADS : Boolean;
  
  contactName : String(100);
  contactMail : String(100);
  contactPhone : String(50);
  
  status : Integer @assert.range: [0, 100];
  createdAt : DateTime;
  
  azureRequestFile : String; 
}
